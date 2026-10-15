export type MealCardInvoiceInput = {
  provider: "edenred" | "setcard" | "pluxee";
  requestNo: string;
  invoiceDate: string;
  grossCents: number;
  netCents: number;
  vatCents: number;
  vatRate: number;
  receiverName: string;
  receiverTaxCode: string;
  receiverInboxTag: string;
  receiverAddress: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverTaxOffice: string;
  memberNo: string;
};

export class MealCardInvoiceSendError extends Error {
  uncertain: boolean;

  constructor(message: string, uncertain: boolean) {
    super(message);
    this.name = "MealCardInvoiceSendError";
    this.uncertain = uncertain;
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " sunucuda tanımlı değil.");
  return value;
}

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function amount(cents: number) {
  return (cents / 100).toFixed(2);
}

function senderAddress() {
  return {
    address: required("LUCA_PROD_SENDER_ADDRESS"),
    cityCode: required("LUCA_PROD_SENDER_CITY_CODE"),
    city: required("LUCA_PROD_SENDER_CITY"),
    district: required("LUCA_PROD_SENDER_DISTRICT"),
    taxOffice: required("LUCA_PROD_SENDER_TAX_OFFICE"),
  };
}

export function buildMealCardInvoiceXml(input: MealCardInvoiceInput) {
  const companyTaxCode = required("LUCA_PROD_COMPANY_TAX_CODE");
  const sender = senderAddress();
  const serviceUrl = required("LUCA_PROD_INVOICE_SERVICE_URL");
  const externalCode = ("LD-MC-" + input.provider + "-" + input.requestNo + "-" + input.invoiceDate.replace(/-/g, ""))
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 64);
  const note = "Ticket Restaurant yemek bedeli - Fatura Talep No: " + input.requestNo +
    (input.memberNo ? " - Üye No: " + input.memberNo : "");
  const net = amount(input.netCents);
  const vat = amount(input.vatCents);
  const gross = amount(input.grossCents);
  const rate = input.vatRate.toFixed(2);

  const detail = "<ein:InvoiceDetail>" +
    "<ein:CurrencyCode>TRY</ein:CurrencyCode>" +
    "<ein:DiscountAmount>0.00</ein:DiscountAmount>" +
    "<ein:DiscountRate>0</ein:DiscountRate>" +
    "<ein:LineExtensionAmount>" + net + "</ein:LineExtensionAmount>" +
    "<ein:Note>" + xml(note) + "</ein:Note>" +
    "<ein:Product>" +
      "<ein:ExternalProductCode>YIYECEK-BEDELI</ein:ExternalProductCode>" +
      "<ein:MeasureUnit>NIU</ein:MeasureUnit>" +
      "<ein:ProductCode>YIYECEK-BEDELI</ein:ProductCode>" +
      "<ein:ProductName>Yemek Bedeli</ein:ProductName>" +
      "<ein:UnitPrice>" + net + "</ein:UnitPrice>" +
    "</ein:Product>" +
    "<ein:Quantity>1.00</ein:Quantity>" +
    "<ein:VATAmount>" + vat + "</ein:VATAmount>" +
    "<ein:VATRate>" + rate + "</ein:VATRate>" +
    "</ein:InvoiceDetail>";

  const invoice = "<ein:Invoice>" +
    "<ein:CompanyBranchAddress>" +
      "<ein:BoulevardAveneuStreetName>" + xml(sender.address) + "</ein:BoulevardAveneuStreetName>" +
      "<ein:CityCode>" + xml(sender.cityCode) + "</ein:CityCode>" +
      "<ein:CityName>" + xml(sender.city) + "</ein:CityName>" +
      "<ein:TaxOfficeCode>0</ein:TaxOfficeCode>" +
      "<ein:TaxOfficeName>" + xml(sender.taxOffice) + "</ein:TaxOfficeName>" +
      "<ein:TownCode>0</ein:TownCode>" +
      "<ein:TownName>" + xml(sender.district) + "</ein:TownName>" +
    "</ein:CompanyBranchAddress>" +
    "<ein:CrossRate>0</ein:CrossRate>" +
    "<ein:CurrencyCode>TRY</ein:CurrencyCode>" +
    "<ein:ExternalInvoiceCode>" + xml(externalCode) + "</ein:ExternalInvoiceCode>" +
    "<ein:InvoiceDate>" + xml(input.invoiceDate) + "</ein:InvoiceDate>" +
    "<ein:InvoiceDetails>" + detail + "</ein:InvoiceDetails>" +
    "<ein:InvoiceType>SATIS</ein:InvoiceType>" +
    "<ein:ScenarioType>TEMELFATURA</ein:ScenarioType>" +
    "<ein:Notes><arr:string>" + xml(note) + "</arr:string></ein:Notes>" +
    "<ein:Receiver>" +
      "<ein:Address>" +
        "<ein:BoulevardAveneuStreetName>" + xml(input.receiverAddress) + "</ein:BoulevardAveneuStreetName>" +
        "<ein:CityName>" + xml(input.receiverCity) + "</ein:CityName>" +
        "<ein:TownName>" + xml(input.receiverDistrict) + "</ein:TownName>" +
        "<ein:TaxOfficeName>" + xml(input.receiverTaxOffice) + "</ein:TaxOfficeName>" +
      "</ein:Address>" +
      "<ein:ReceiverName>" + xml(input.receiverName) + "</ein:ReceiverName>" +
      "<ein:ReceiverTaxCode>" + xml(input.receiverTaxCode) + "</ein:ReceiverTaxCode>" +
      "<ein:SendingType>NONE</ein:SendingType>" +
    "</ein:Receiver>" +
    "<ein:ReceiverBranchAddress><ein:BoulevardAveneuStreetName>" + xml(input.receiverAddress) +
      "</ein:BoulevardAveneuStreetName></ein:ReceiverBranchAddress>" +
    "<ein:ReceiverInboxTag>" + xml(input.receiverInboxTag) + "</ein:ReceiverInboxTag>" +
    "<ein:SendMailAutomatically>false</ein:SendMailAutomatically>" +
    "<ein:TotalDiscountAmount>0.00</ein:TotalDiscountAmount>" +
    "<ein:TotalLineExtensionAmount>" + net + "</ein:TotalLineExtensionAmount>" +
    "<ein:TotalPayableAmount>" + gross + "</ein:TotalPayableAmount>" +
    "<ein:TotalTaxInclusiveAmount>" + gross + "</ein:TotalTaxInclusiveAmount>" +
    "<ein:TotalVATAmount>" + vat + "</ein:TotalVATAmount>" +
    "</ein:Invoice>";

  const xmlBody = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
    "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
    "xmlns:tem=\"http://tempuri.org/\" " +
    "xmlns:ein=\"http://schemas.datacontract.org/2004/07/EInvoice.Service.Model\" " +
    "xmlns:arr=\"http://schemas.microsoft.com/2003/10/Serialization/Arrays\">" +
    "<soapenv:Header/><soapenv:Body><tem:SendInvoice><tem:request>" +
    "<ein:CompanyTaxCode>" + xml(companyTaxCode) + "</ein:CompanyTaxCode>" +
    "<ein:Invoices>" + invoice + "</ein:Invoices>" +
    "</tem:request></tem:SendInvoice></soapenv:Body></soapenv:Envelope>";

  return { xml: xmlBody, externalCode, serviceUrl };
}

export async function sendMealCardInvoice(input: MealCardInvoiceInput) {
  const draft = buildMealCardInvoiceXml(input);
  let response: Response;
  try {
    response = await fetch(draft.serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '"http://tempuri.org/IInvoiceService/SendInvoice"',
      },
      body: draft.xml,
      cache: "no-store",
    });
  } catch {
    throw new MealCardInvoiceSendError(
      "LUCA bağlantısı kesildi; faturanın ulaşıp ulaşmadığı belirsiz. LUCA'dan kontrol etmeden yeniden göndermeyin.",
      true
    );
  }
  const raw = await response.text();
  const result = raw.match(/<[^>]*:?Result[^>]*>([\s\S]*?)<\/[^>]*:?Result>/i)?.[1]?.trim() || "";
  const errorMessage = raw.match(/<[^>]*:?ErrorMessage[^>]*>([\s\S]*?)<\/[^>]*:?ErrorMessage>/i)?.[1]?.trim() || "";
  const invoiceNumber = raw.match(/<[^>]*:?(?:InvoiceNumber|InvoiceNo)[^>]*>([\s\S]*?)<\/[^>]*:?(?:InvoiceNumber|InvoiceNo)>/i)?.[1]?.trim() || "";
  const invoiceUuid = raw.match(/<[^>]*:?(?:ETTN|Ettn)[^>]*>([\s\S]*?)<\/[^>]*:?(?:ETTN|Ettn)>/i)?.[1]?.trim() || "";

  if (!response.ok || result.toLowerCase() !== "success") {
    throw new MealCardInvoiceSendError(
      errorMessage || ("LUCA e-Fatura gönderimi başarısız (HTTP " + response.status + ")."),
      false
    );
  }
  if (!invoiceNumber) {
    throw new MealCardInvoiceSendError(
      "LUCA Success döndürdü ancak fatura numarası alınamadı. LUCA'dan kontrol edin; yeniden göndermeyin.",
      true
    );
  }
  return { externalCode: draft.externalCode, invoiceNumber, invoiceUuid, rawResponse: raw };
}
