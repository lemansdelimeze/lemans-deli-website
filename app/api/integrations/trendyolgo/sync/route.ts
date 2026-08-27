import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

type TgPromotion = {
  promotionId?: number;
  description?: string;
  totalSellerAmount?: number | null;
};

type TgLine = {
  productId: number;
  name: string;
  price: number;
  unitSellingPrice: number;
  description?: string | null;
  modifierProducts?: unknown[];
  extraIngredients?: unknown[];
  removedIngredients?: unknown[];
  items?: {
    packageItemId?: string;
    lineItemId?: number;
    isCancelled?: boolean;
  }[];
};

type TgPackage = {
  id: string;
  supplierId: number;
  storeId: number;
  orderId: string;
  orderNumber: string;
  orderCode?: string | null;
  packageStatus: string;
  totalPrice: number;
  eta?: string | null;
  customerNote?: string | null;
  packageCreationDate?: number | null;
  packageModificationDate?: number | null;
  totalDeliveryPrice?: number;
  address?: unknown;
  payment?: unknown;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    identityNumber?: string;
    identityNo?: string;
    taxNumber?: string;
    taxOffice?: string;
    companyName?: string;
    address?: unknown;
    invoiceAddress?: unknown;
    [key: string]: unknown;
  } | null;
  invoiceAddress?: unknown;
  billingAddress?: unknown;
  deliveryAddress?: unknown;
  lines: TgLine[];
  promotions?: TgPromotion[] | null;
  [key: string]: unknown;
};

type TgPackageResponse = {
  totalCount: number;
  totalPages: number;
  page: number;
  size: number;
  content: TgPackage[];
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;

  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }

  return current;
}

function firstString(source: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = stringValue(readPath(source, path));
    if (value) return value;
  }

  return null;
}

function firstRecord(source: unknown, paths: string[][]): JsonRecord | null {
  for (const path of paths) {
    const value = readPath(source, path);
    if (isRecord(value)) return value;
  }

  return null;
}

function cleanTaxNumber(value: string | null): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return digits;

  return value.trim() || null;
}

function formatTurkeyTime(value?: number | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function joinAddress(address: JsonRecord | null): string | null {
  if (!address) return null;

  const parts = [
    firstString(address, [
      ["address1"],
      ["addressLine1"],
      ["street"],
      ["address"],
    ]),
    firstString(address, [["address2"], ["addressLine2"]]),
    firstString(address, [["neighborhood"], ["mahalle"]]),
    firstString(address, [["addressDescription"]]),
    firstString(address, [["district"], ["districtName"], ["ilce"]]),
    firstString(address, [["city"], ["cityName"], ["province"], ["il"]]),
    firstString(address, [["postalCode"], ["postcode"]]),
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function trendyolAddress(pkg: TgPackage) {
  const addressRecord = firstRecord(pkg, [
    ["address"],
    ["deliveryAddress"],
    ["customer", "address"],
  ]);

  return (
    joinAddress(addressRecord) ||
    firstString(pkg, [
      ["address", "fullAddress"],
      ["deliveryAddress", "fullAddress"],
      ["customer", "address", "fullAddress"],
    ])
  );
}

function trendyolPhone(pkg: TgPackage) {
  return firstString(pkg, [
    ["address", "phone"],
    ["deliveryAddress", "phone"],
    ["customer", "phone"],
    ["customer", "mobilePhone"],
    ["callCenterPhone"],
  ]);
}

function trendyolPaymentMethod(pkg: TgPackage) {
  const paymentType =
    firstString(pkg, [["payment", "paymentType"]])?.toUpperCase() ?? "";

  if (
    paymentType === "PAY_WITH_CARD" ||
    paymentType.includes("CARD") ||
    paymentType.includes("ONLINE")
  ) {
    return "Online Kart Ödemesi";
  }

  if (
    paymentType.includes("CASH") ||
    paymentType.includes("ON_DELIVERY")
  ) {
    return "Kapıda Ödeme";
  }

  return paymentType || "Ödeme bilgisi bekleniyor";
}

function trendyolOrderNote(pkg: TgPackage) {
  const notes = [
    pkg.orderCode ? `Trendyol Sipariş Kodu: ${pkg.orderCode}` : null,
    `Ödeme: ${trendyolPaymentMethod(pkg)}`,
    formatTurkeyTime(pkg.packageCreationDate)
      ? `Sipariş saati: ${formatTurkeyTime(pkg.packageCreationDate)}`
      : null,
    pkg.eta ? `Tahmini teslimat: ${pkg.eta}` : null,
    pkg.customerNote ? `Müşteri notu: ${pkg.customerNote}` : null,
  ].filter(Boolean);

  return notes.join("\n") || null;
}

function extractInvoiceData(pkg: TgPackage) {
  const customerName =
    [
      firstString(pkg, [["customer", "firstName"]]),
      firstString(pkg, [["customer", "lastName"]]),
    ]
      .filter(Boolean)
      .join(" ") || null;

  const companyName = firstString(pkg, [
    ["customer", "companyName"],
    ["customer", "company"],
    ["companyName"],
    ["invoiceAddress", "companyName"],
    ["billingAddress", "companyName"],
  ]);

  const taxNumber = cleanTaxNumber(
    firstString(pkg, [
      ["customer", "taxNumber"],
      ["customer", "identityNumber"],
      ["customer", "identityNo"],
      ["customer", "tckn"],
      ["customer", "vkn"],
      ["taxNumber"],
      ["identityNumber"],
      ["identityNo"],
      ["tckn"],
      ["vkn"],
      ["invoiceAddress", "taxNumber"],
      ["invoiceAddress", "identityNumber"],
      ["billingAddress", "taxNumber"],
      ["billingAddress", "identityNumber"],
    ])
  );

  const taxOffice = firstString(pkg, [
    ["customer", "taxOffice"],
    ["taxOffice"],
    ["invoiceAddress", "taxOffice"],
    ["billingAddress", "taxOffice"],
  ]);

  const email = firstString(pkg, [
    ["customer", "email"],
    ["customerEmail"],
    ["email"],
    ["invoiceAddress", "email"],
    ["billingAddress", "email"],
  ]);

  const addressRecord = firstRecord(pkg, [
    ["invoiceAddress"],
    ["billingAddress"],
    ["customer", "invoiceAddress"],
    ["customer", "address"],
    ["address"],
    ["deliveryAddress"],
  ]);

  const address =
    joinAddress(addressRecord) ||
    firstString(pkg, [
      ["invoiceAddress", "fullAddress"],
      ["billingAddress", "fullAddress"],
      ["address", "fullAddress"],
      ["deliveryAddress", "fullAddress"],
      ["customer", "address", "fullAddress"],
    ]);

  const city = firstString(addressRecord, [
    ["city"],
    ["cityName"],
    ["province"],
    ["provinceName"],
    ["il"],
  ]);

  const district = firstString(addressRecord, [
    ["district"],
    ["districtName"],
    ["town"],
    ["ilce"],
  ]);

  const digits = taxNumber?.replace(/\D/g, "") ?? "";
  const invoiceCustomerType: "individual" | "company" | null =
    companyName || digits.length === 10
      ? "company"
      : digits.length === 11
        ? "individual"
        : null;

  return {
    customerName,
    invoiceCustomerName: companyName || customerName,
    invoiceCustomerType,
    taxNumber,
    taxOffice,
    email,
    address,
    city,
    district,
  };
}

function posStatusForPackage(packageStatus: string) {
  const status = packageStatus.toUpperCase();

  if (status === "CANCELLED" || status === "UNDELIVERED") {
    return "cancelled";
  }

  if (status === "DELIVERED") {
    return "closed";
  }

  return "open";
}

async function findMenuItemId(productId: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("integration_product_mappings")
    .select("menu_item_id")
    .eq("channel", "trendyol")
    .eq("external_product_id", String(productId))
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;

  return data?.menu_item_id ?? null;
}

export async function POST() {
  try {
    const sellerId = getTrendyolGoSellerId();

    const params = new URLSearchParams({
      page: "0",
      size: "50",
    });

    const response = await trendyolGoRequest<TgPackageResponse>(
      `/integrator/order/meal/suppliers/${sellerId}/packages?${params.toString()}`
    );

    let imported = 0;
    let updated = 0;
    let unmatched = 0;
    const unmatchedProducts = new Map<string, string>();

    for (const pkg of response.content ?? []) {
      const externalOrderId = pkg.orderNumber || pkg.orderId || pkg.id;

      const invoice = extractInvoiceData(pkg);
      const posStatus = posStatusForPackage(pkg.packageStatus);

      const commonValues = {
        customer_name: invoice.customerName,
        customer_phone: trendyolPhone(pkg),
        delivery_address: trendyolAddress(pkg),
        order_note: trendyolOrderNote(pkg),
        payment_method: trendyolPaymentMethod(pkg),
        external_restaurant_id: String(pkg.storeId),
        external_status: pkg.packageStatus,
        external_payload: pkg,
        invoice_customer_type: invoice.invoiceCustomerType,
        invoice_customer_name: invoice.invoiceCustomerName,
        invoice_tax_number: invoice.taxNumber,
        invoice_tax_office: invoice.taxOffice,
        invoice_email: invoice.email,
        invoice_address: invoice.address,
        invoice_city: invoice.city,
        invoice_district: invoice.district,
      };

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("pos_orders")
        .select("id,status")
        .eq("source", "trendyol")
        .eq("external_order_id", externalOrderId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const updates: Record<string, unknown> = {
          ...commonValues,
        };

        if (posStatus === "closed") {
          updates.status = "closed";
          updates.pos_stage = "completed";
          updates.closed_at = new Date().toISOString();
        }

        if (posStatus === "cancelled") {
          updates.status = "cancelled";
          updates.pos_stage = "cancelled";
          updates.cancelled_at = new Date().toISOString();
          updates.cancel_reason = "Trendyol Go üzerinden iptal edildi";
        }

        const { error: updateError } = await supabaseAdmin
          .from("pos_orders")
          .update(updates)
          .eq("id", existing.id);

        if (updateError) throw updateError;

        updated += 1;
        continue;
      }

      const rows = [];
      let hasUnmatched = false;

      for (const line of pkg.lines ?? []) {
        const menuItemId = await findMenuItemId(line.productId);

        if (!menuItemId) {
          hasUnmatched = true;
          unmatched += 1;
          unmatchedProducts.set(String(line.productId), line.name);
        }

        const activeItemCount =
          line.items?.filter((item) => !item.isCancelled).length || 1;

        rows.push({
          menu_item_id: menuItemId,
          product_name: line.name,
          quantity: activeItemCount,
          unit_price: Number(line.unitSellingPrice || line.price || 0),
          line_total:
            activeItemCount *
            Number(line.unitSellingPrice || line.price || 0),
        });
      }

      if (!rows.length) {
        await supabaseAdmin.from("integration_events").insert({
          channel: "trendyol",
          event_type: "order.empty",
          external_order_id: externalOrderId,
          direction: "inbound",
          status: "failed",
          payload: pkg,
          error_message: "Siparişte aktarılabilecek ürün satırı yok.",
        });
        continue;
      }

      if (hasUnmatched) {
        await supabaseAdmin.from("integration_events").insert({
          channel: "trendyol",
          event_type: "order.mapping_warning",
          external_order_id: externalOrderId,
          direction: "inbound",
          status: "processed",
          payload: pkg,
          error_message:
            "Bazı Trendyol Go ürünleri eşleştirilmemiş; sipariş yine POS'a aktarıldı.",
          processed_at: new Date().toISOString(),
        });
      }

      const subtotal = rows.reduce((sum, row) => sum + row.line_total, 0);

      const sellerPromotionTotal = (pkg.promotions ?? []).reduce(
        (sum, promotion) =>
          sum + Number(promotion.totalSellerAmount || 0),
        0
      );

      const { data: order, error: orderError } = await supabaseAdmin
        .from("pos_orders")
        .insert({
          receipt_number: `TGO-${externalOrderId}`,
          order_type: "Paket",
          ...commonValues,
          subtotal,
          discount_amount: sellerPromotionTotal,
          total: Number(pkg.totalPrice || subtotal),
          status: posStatus,
          source: "trendyol",
          external_order_id: externalOrderId,
          restaurant_discount_amount: sellerPromotionTotal,
          channel_net_amount: Number(pkg.totalPrice || subtotal),
          invoice_type: null,
          invoice_status: "none",
          invoice_requested: false,
          closed_at: posStatus === "closed" ? new Date().toISOString() : null,
          cancelled_at:
            posStatus === "cancelled" ? new Date().toISOString() : null,
          cancel_reason:
            posStatus === "cancelled"
              ? "Trendyol Go üzerinden iptal edildi"
              : null,
          pos_stage:
            posStatus === "closed"
              ? "completed"
              : posStatus === "cancelled"
                ? "cancelled"
                : "new",
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabaseAdmin
        .from("pos_order_items")
        .insert(rows.map((row) => ({ order_id: order.id, ...row })));

      if (itemsError) {
        await supabaseAdmin.from("pos_orders").delete().eq("id", order.id);
        throw itemsError;
      }

      await supabaseAdmin.from("integration_events").insert({
        channel: "trendyol",
        event_type: "order.synced",
        external_order_id: externalOrderId,
        direction: "inbound",
        status: "processed",
        payload: pkg,
        processed_at: new Date().toISOString(),
      });

      imported += 1;
    }

    return NextResponse.json({
      ok: true,
      fetched: response.content?.length ?? 0,
      imported,
      updated,
      unmatched,
      unmatchedProducts: Array.from(unmatchedProducts.entries()).map(
        ([productId, name]) => ({ productId, name })
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Trendyol Go sipariş senkronizasyonu başarısız.",
      },
      { status: 500 }
    );
  }
}