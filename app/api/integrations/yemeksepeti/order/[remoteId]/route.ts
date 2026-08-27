import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type DeliveryHeroProduct = {
  id?: string;
  name?: string;
  quantity?: string | number;
  paidPrice?: string | number;
  unitPrice?: string | number;
  remoteCode?: string | null;
  comment?: string | null;
};

type DeliveryHeroOrder = {
  token?: string;
  code?: string;
  shortCode?: string | null;
  test?: boolean;
  createdAt?: string | null;
  expeditionType?: "delivery" | "pickup";
  comments?: { customerComment?: string | null };
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
    mobilePhone?: string | null;
  };
  payment?: {
    status?: string | null;
    type?: string | null;
  };
  delivery?: {
    expectedDeliveryTime?: string | null;
    address?: {
      city?: string | null;
      district?: string | null;
      street?: string | null;
      number?: string | null;
      building?: string | null;
      floor?: string | null;
      room?: string | null;
      flatNumber?: string | null;
      postcode?: string | null;
      deliveryMainArea?: string | null;
      deliveryInstructions?: string | null;
    };
  };
  platformRestaurant?: { id?: string | null };
  price?: {
    grandTotal?: string | number | null;
    totalNet?: string | number | null;
  };
  products?: DeliveryHeroProduct[];
  [key: string]: unknown;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value?: string | null) {
  return value?.trim() || null;
}

function formatTurkeyTime(value?: string | null) {
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

function deliveryAddressOf(payload: DeliveryHeroOrder) {
  const address = payload.delivery?.address;
  if (!address) return null;

  return [
    address.deliveryMainArea,
    address.street,
    address.number ? `No: ${address.number}` : null,
    address.building,
    address.floor ? `Kat: ${address.floor}` : null,
    address.room ? `Daire: ${address.room}` : null,
    address.flatNumber ? `İç Kapı: ${address.flatNumber}` : null,
    address.district,
    address.city,
    address.postcode,
  ]
    .filter(Boolean)
    .join(", ") || null;
}

function orderNoteOf(payload: DeliveryHeroOrder) {
  const paymentType = textValue(payload.payment?.type);
  const customerNote = textValue(payload.comments?.customerComment);
  const deliveryNote = textValue(
    payload.delivery?.address?.deliveryInstructions
  );
  const orderTime = formatTurkeyTime(payload.createdAt);
  const expectedTime = formatTurkeyTime(
    payload.delivery?.expectedDeliveryTime
  );

  const notes = [
    payload.shortCode ? `Yemeksepeti Sipariş No: ${payload.shortCode}` : null,
    paymentType ? `Ödeme: ${paymentType}` : null,
    orderTime ? `Sipariş saati: ${orderTime}` : null,
    expectedTime ? `Hedef teslim: ${expectedTime}` : null,
    customerNote && customerNote !== paymentType
      ? `Müşteri notu: ${customerNote}`
      : null,
    deliveryNote &&
    deliveryNote !== paymentType &&
    deliveryNote !== customerNote
      ? `Teslimat notu: ${deliveryNote}`
      : null,
  ].filter(Boolean);

  return notes.join("\n") || null;
}

function verifyMiddlewareJwt(request: NextRequest) {
  const secret = process.env.YEMEKSEPETI_MIDDLEWARE_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (!secret || !authorization.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  const parts = token.split(".");

  if (parts.length !== 3) return false;

  try {
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(
      Buffer.from(headerPart, "base64url").toString("utf8")
    ) as { alg?: string };

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8")
    ) as { service?: string; exp?: number };

    if (header.alg !== "HS512" || payload.service !== "middleware") {
      return false;
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    const expected = createHmac("sha512", secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest("base64url");

    const receivedBuffer = Buffer.from(signaturePart);
    const expectedBuffer = Buffer.from(expected);

    return (
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

async function findMenuItemId(
  remoteCode?: string | null,
  productId?: string
): Promise<number | null> {
  for (const externalProductId of [remoteCode, productId]) {
    if (!externalProductId) continue;

    const { data, error } = await supabaseAdmin
      .from("integration_product_mappings")
      .select("menu_item_id")
      .eq("channel", "yemeksepeti")
      .eq("external_product_id", String(externalProductId))
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    if (data?.menu_item_id) return data.menu_item_id;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ remoteId: string }> }
) {
  const { remoteId } = await params;
  const configuredRemoteId = process.env.YEMEKSEPETI_REMOTE_ID;

  if (!configuredRemoteId || remoteId !== configuredRemoteId) {
    return NextResponse.json(
      { reason: "INVALID_REQUEST", message: "Geçersiz Remote ID." },
      { status: 400 }
    );
  }

  if (!verifyMiddlewareJwt(request)) {
    return NextResponse.json(
      { reason: "UNAUTHORIZED", message: "Yetkilendirme doğrulanamadı." },
      { status: 401 }
    );
  }

  try {
    const payload = (await request.json()) as DeliveryHeroOrder;
    const externalOrderId = String(payload.token || payload.code || "").trim();

    if (!externalOrderId || !Array.isArray(payload.products)) {
      return NextResponse.json(
        { reason: "INVALID_REQUEST", message: "Sipariş verisi eksik." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("pos_orders")
      .select("id")
      .eq("source", "yemeksepeti")
      .eq("external_order_id", externalOrderId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json({
        remoteResponse: { remoteOrderId: String(existing.id) },
      });
    }

    const rows = await Promise.all(
      payload.products.map(async (product) => {
        const quantity = Math.max(1, numberValue(product.quantity));
        const lineTotal = numberValue(product.paidPrice);
        const unitPrice =
          numberValue(product.unitPrice) || lineTotal / quantity;

        return {
          menu_item_id: await findMenuItemId(product.remoteCode, product.id),
          product_name: product.name || "Yemeksepeti ürünü",
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal || unitPrice * quantity,
        };
      })
    );

    if (!rows.length) {
      return NextResponse.json(
        { reason: "INVALID_REQUEST", message: "Sipariş ürünü bulunamadı." },
        { status: 400 }
      );
    }

    const subtotal = rows.reduce((sum, row) => sum + row.line_total, 0);
    const customerName =
      [payload.customer?.firstName, payload.customer?.lastName]
        .filter(Boolean)
        .join(" ") || null;

    const total =
      numberValue(payload.price?.grandTotal) ||
      numberValue(payload.price?.totalNet) ||
      subtotal;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("pos_orders")
      .insert({
        receipt_number: `YS-${payload.code || externalOrderId}`,
        order_type:
          payload.expeditionType === "pickup" ? "Gel Al" : "Paket",
        customer_name: customerName,
        customer_phone: textValue(payload.customer?.mobilePhone),
        delivery_address: deliveryAddressOf(payload),
        order_note: orderNoteOf(payload),
        subtotal,
        discount_amount: 0,
        total,
        payment_method:
          textValue(payload.payment?.type) ||
          (payload.payment?.status === "paid"
            ? "Online Ödeme"
            : "Kapıda Ödeme"),
        status: "open",
        source: "yemeksepeti",
        external_order_id: externalOrderId,
        external_restaurant_id: payload.platformRestaurant?.id || null,
        external_status: payload.test ? "test_order" : "received",
        external_payload: payload,
        channel_net_amount: total,
        invoice_type: null,
        invoice_status: "none",
        invoice_requested: false,
        closed_at: null,
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
      channel: "yemeksepeti",
      event_type: "order.received",
      external_order_id: externalOrderId,
      direction: "inbound",
      status: "processed",
      payload,
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      remoteResponse: { remoteOrderId: String(order.id) },
    });
  } catch (error) {
    console.error("Yemeksepeti sipariş alma hatası:", error);

    return NextResponse.json(
      {
        reason: "EXTERNAL_SERVICE_ERROR",
        message: "Sipariş kaydedilemedi.",
      },
      { status: 500 }
    );
  }
}