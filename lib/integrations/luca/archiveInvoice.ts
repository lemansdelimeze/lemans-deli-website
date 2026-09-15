type InvoiceLine = {
  product_name: string;
  quantity: number | string;
  line_total: number | string;
};

type ClosedOrder = {
  id: number;
  receipt_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  invoice_tax_number?: string | null;
  total: number | string | null;
};

type LucaConfig = {
  serviceUrl: string;
  companyTaxCode: string;
  sender: {
    address: string;
    cityCode: string;
    cityName: string;
    townName: string;
    taxOfficeName: string;
  };
  defaultReceiverTaxCode: string;
  defaultReceiverName: string;
  defaultReceiverAddress: string;
  vatRate: number;
  pricesIncludeVat: boolean;
};

export type LucaArchiveResult = {
  externalCode: string;
  invoiceNumber: string | null;
  invoiceUuid: string | null;
  rawResponse: string;
};

export type LucaArchiveDraft = {
  externalCode: string;
  xml: string;
  grossTotal: number;
  netTotal: number;
  vatTotal: number;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} sunucuda tanımlı değil.`);
  return value;
}

function bool(name: string) {
  return required(name).toLowerCase() === "true";
}

function numberValue(name: string) {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} 0 ile 100 arasında geçerli bir oran olmalı.`);
  }
  return value;
}

function config(): LucaConfig {
  return {
    serviceUrl: required("LUCA_PROD_INVOICE_SERVICE_URL"),
    companyTaxCode: required("LUCA_PROD_COMPANY_TAX_CODE"),
    sender: {
      address: required("LUCA_PROD_SENDER_ADDRESS"),
      cityCode: required("LUCA_PROD_SENDER_CITY_CODE"),
      cityName: required("LUCA_PROD_SENDER_CITY"),
      townName: required("LUCA_PROD_SENDER_DISTRICT"),
      taxOfficeName: required("LUCA_PROD_SENDER_TAX_OFFICE"),
    },
    defaultReceiverTaxCode: required("LUCA_DEFAULT_CUSTOMER_TAX_CODE"),
    defaultReceiverName: required("LUCA_DEFAULT_CUSTOMER_NAME"),
    defaultReceiverAddress: required("LUCA_DEFAULT_CUSTOMER_ADDRESS"),
    vatRate: numberValue("LUCA_PROD_DEFAULT_VAT_RATE"),
    pricesIncludeVat: bool("LUCA_PROD_PRICES_INCLUDE_VAT"),
  };
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number) {
  return value.toFixed(2);
}

function xmlValue(xml: string, localName: string) {
  const match = xml.match(
    new RegExp(`<[^>]*:?${localName}[^>]*>([\\s\\S]*?)</[^>]*:?${localName}>`, "i")
  );
  return match?.[1]?.trim() || null;
}

function externalCode(order: ClosedOrder) {
  const receipt = String(order.receipt_number || `POS-${order.id}`)
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 42);
  return `LD-${receipt}-${order.id}`.slice(0, 64);
}

function isBeverage(name: string) {
  const value = name.toLocaleLowerCase("tr-TR");
  return ["ayran", "cola", "kola", "ice tea", "lipton", "fanta", "sprite", "soda", "su", "kahve", "çay", "limonata", "meyve suyu", "red bull"].some((term) => value.includes(term));
}

function groupedInvoiceLines(lines: InvoiceLine[]) {
  const totals = lines.reduce((result, line) => {
    const total = Number(line.line_total);
    if (!Number.isFinite(total) || total <= 0) return result;
    if (isBeverage(String(line.product_name || ""))) result.beverage += total;
    else result.food += total;
    return result;
  }, { food: 0, beverage: 0 });

  return [
    totals.food > 0 ? { product_name: "Yiyecek Bedeli", quantity: 1, line_total: totals.food } : null,
    totals.beverage > 0 ? { product_name: "İçecek Bedeli", quantity: 1, line_total: totals.beverage } : null,
  ].filter((line): line is { product_name: string; quantity: number; line_total: number } => line !== null);
}

export function buildLucaArchiveInvoiceDraft(
  order: ClosedOrder,
  lines: InvoiceLine[]
): LucaArchiveDraft {
  const settings = config();
  const validLines = groupedInvoiceLines(lines)
    .map((line) => ({
      name: String(line.product_name || "Ürün").trim() || "Ürün",
      quantity: Number(line.quantity),
      total: Number(line.line_total),
    }))
    .filter(
      (line) =>
        Number.isFinite(line.quantity) &&
        line.quantity > 0 &&
        Number.isFinite(line.total) &&
        line.total >= 0
    );

  if (!validLines.length) throw new Error("Faturalanacak sipariş satırı bulunamadı.");

  const grossTotal = validLines.reduce((sum, line) => sum + line.total, 0);
  if (grossTotal <= 0) throw new Error("Fatura tutarı sıfır olamaz.");

  const factor = settings.pricesIncludeVat
    ? 1 + settings.vatRate / 100
    : 1;
  const details = validLines.map((line, index) => {
    const lineNet = line.total / factor;
    const lineVat = line.total - lineNet;
    const unitNet = lineNet / line.quantity;
    const productCode = `POS-${order.id}-${index + 1}`;

    return {
      productCode,
      name: line.name,
      quantity: line.quantity,
      lineNet,
      lineVat,
      unitNet,
    };
  });
  const netTotal = details.reduce((sum, line) => sum + line.lineNet, 0);
  const vatTotal = details.reduce((sum, line) => sum + line.lineVat, 0);
  const payable = settings.pricesIncludeVat
    ? grossTotal
    : grossTotal * (1 + settings.vatRate / 100);
  const code = externalCode(order);
  const receiverName = order.customer_name?.trim() || settings.defaultReceiverName;
  const receiverTaxCode = order.invoice_tax_number?.trim() || settings.defaultReceiverTaxCode;
  const receiverAddress =
    order.delivery_address?.trim() || settings.defaultReceiverAddress;

  const detailXml = details
    .map(
      (line) => `
        <ein:ArchiveInvoiceDetail>
          <ein:CurrencyCode>TRY</ein:CurrencyCode>
          <ein:DiscountAmount>0</ein:DiscountAmount>
          <ein:DiscountRate>0</ein:DiscountRate>
          <ein:LineExtensionAmount>${money(line.lineNet)}</ein:LineExtensionAmount>
          <ein:Note>${escapeXml(order.receipt_number || `POS #${order.id}`)}</ein:Note>
          <ein:Product>
            <ein:ExternalProductCode>${escapeXml(line.productCode)}</ein:ExternalProductCode>
            <ein:MeasureUnit>NIU</ein:MeasureUnit>
            <ein:ProductCode>${escapeXml(line.productCode)}</ein:ProductCode>
            <ein:ProductName>${escapeXml(line.name)}</ein:ProductName>
            <ein:UnitPrice>${money(line.unitNet)}</ein:UnitPrice>
          </ein:Product>
          <ein:Quantity>${money(line.quantity)}</ein:Quantity>
          <ein:VATAmount>${money(line.lineVat)}</ein:VATAmount>
          <ein:VATRate>${money(settings.vatRate)}</ein:VATRate>
        </ein:ArchiveInvoiceDetail>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ein="http://schemas.datacontract.org/2004/07/EInvoice.Service.Model" xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:SendArchiveInvoice>
      <tem:request>
        <ein:ArchiveInvoices>
          <ein:ArchiveInvoice>
            <ein:CompanyBranchAddress>
              <ein:BoulevardAveneuStreetName>${escapeXml(settings.sender.address)}</ein:BoulevardAveneuStreetName>
              <ein:CityCode>${escapeXml(settings.sender.cityCode)}</ein:CityCode>
              <ein:CityName>${escapeXml(settings.sender.cityName)}</ein:CityName>
              <ein:TaxOfficeCode>0</ein:TaxOfficeCode>
              <ein:TaxOfficeName>${escapeXml(settings.sender.taxOfficeName)}</ein:TaxOfficeName>
              <ein:TownCode>0</ein:TownCode>
              <ein:TownName>${escapeXml(settings.sender.townName)}</ein:TownName>
            </ein:CompanyBranchAddress>
            <ein:CrossRate>0</ein:CrossRate>
            <ein:CurrencyCode>TRY</ein:CurrencyCode>
            <ein:ExternalArchiveInvoiceCode>${escapeXml(code)}</ein:ExternalArchiveInvoiceCode>
            <ein:InvoiceDate>${new Date().toISOString().slice(0, 10)}</ein:InvoiceDate>
            <ein:InvoiceDetails>${detailXml}
            </ein:InvoiceDetails>
            <ein:InvoiceType>SATIS</ein:InvoiceType>
            <ein:IsArchived>false</ein:IsArchived>
            <ein:Notes><arr:string>POS siparişi: ${escapeXml(order.receipt_number || `#${order.id}`)}</arr:string></ein:Notes>
            <ein:Receiver>
              <ein:Address>
                <ein:BoulevardAveneuStreetName>${escapeXml(receiverAddress)}</ein:BoulevardAveneuStreetName>
                <ein:CityName>${escapeXml(settings.sender.cityName)}</ein:CityName>
              </ein:Address>
              <ein:ReceiverName>${escapeXml(receiverName)}</ein:ReceiverName>
              <ein:ReceiverTaxCode>${escapeXml(receiverTaxCode)}</ein:ReceiverTaxCode>
              <ein:SendingType>KAGIT</ein:SendingType>
            </ein:Receiver>
            <ein:ReceiverBranchAddress><ein:BoulevardAveneuStreetName>${escapeXml(receiverAddress)}</ein:BoulevardAveneuStreetName></ein:ReceiverBranchAddress>
            <ein:SendMailAutomatically>false</ein:SendMailAutomatically>
            <ein:TotalDiscountAmount>0</ein:TotalDiscountAmount>
            <ein:TotalLineExtensionAmount>${money(netTotal)}</ein:TotalLineExtensionAmount>
            <ein:TotalPayableAmount>${money(payable)}</ein:TotalPayableAmount>
            <ein:TotalTaxInclusiveAmount>${money(payable)}</ein:TotalTaxInclusiveAmount>
            <ein:TotalVATAmount>${money(vatTotal)}</ein:TotalVATAmount>
          </ein:ArchiveInvoice>
        </ein:ArchiveInvoices>
        <ein:CompanyTaxCode>${escapeXml(settings.companyTaxCode)}</ein:CompanyTaxCode>
      </tem:request>
    </tem:SendArchiveInvoice>
  </soapenv:Body>
</soapenv:Envelope>`;

  return { externalCode: code, xml, grossTotal, netTotal, vatTotal };
}

export async function sendLucaArchiveInvoice(
  order: ClosedOrder,
  lines: InvoiceLine[]
): Promise<LucaArchiveResult> {
  const settings = config();
  const draft = buildLucaArchiveInvoiceDraft(order, lines);
  const response = await fetch(settings.serviceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: '"http://tempuri.org/IInvoiceService/SendArchiveInvoice"',
    },
    body: draft.xml,
    cache: "no-store",
  });
  const rawResponse = await response.text();
  const result = xmlValue(rawResponse, "Result");
  const errorMessage = xmlValue(rawResponse, "ErrorMessage");

  if (!response.ok || result?.toLowerCase() !== "success") {
    throw new Error(
      errorMessage || `LUCA e-Arşiv gönderimi başarısız: HTTP ${response.status}`
    );
  }

  return {
    externalCode: draft.externalCode,
    invoiceNumber: xmlValue(rawResponse, "InvoiceNumber"),
    invoiceUuid: xmlValue(rawResponse, "ETTN") || xmlValue(rawResponse, "Ettn"),
    rawResponse,
  };
}
