import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type RequestedItem = {
  menuItemId: number;
  quantity: number;
};

type CreateOrderBody = {
  orderType?: "pickup" | "delivery";
  customerName?: string;
  phone?: string;
  address?: string;
  note?: string;
  website?: string; // honeypot
  items?: RequestedItem[];
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, "").slice(0, 20);
}


type OrderSettings = {
  ordering_enabled: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  auto_schedule_enabled: boolean;
  open_time: string;
  close_time: string;
  pickup_minimum: number | string;
  delivery_minimum: number | string;
  closed_message: string;
};

function turkeyMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function insideSchedule(openTime: string, closeTime: string) {
  const now = turkeyMinutesNow();
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);

  if (open === close) return true;
  if (open < close) return now >= open && now < close;
  return now >= open || now < close;
}

async function getOrderSettings(): Promise<OrderSettings> {
  const { data, error } = await supabaseAdmin
    .from("online_order_settings")
    .select(
      "ordering_enabled,pickup_enabled,delivery_enabled,auto_schedule_enabled,open_time,close_time,pickup_minimum,delivery_minimum,closed_message"
    )
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data as OrderSettings;
}

function makeOrderCode() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WEB-${stamp}-${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderBody;

    // Basit bot honeypot'ı. Normal kullanıcı bu alanı hiç görmez/doldurmaz.
    if (cleanText(body.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const orderType = body.orderType === "delivery" ? "delivery" : "pickup";
    const customerName = cleanText(body.customerName, 120);
    const phone = normalizePhone(cleanText(body.phone, 40));
    const address = cleanText(body.address, 500);
    const note = cleanText(body.note, 500);

    const settings = await getOrderSettings();

    if (!settings.ordering_enabled) {
      return NextResponse.json(
        {
          ok: false,
          error:
            settings.closed_message ||
            "Şu anda online sipariş alamıyoruz.",
        },
        { status: 409 }
      );
    }

    if (
      settings.auto_schedule_enabled &&
      !insideSchedule(settings.open_time, settings.close_time)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Online sipariş saatlerimiz ${settings.open_time.slice(
            0,
            5
          )}–${settings.close_time.slice(0, 5)}.`,
        },
        { status: 409 }
      );
    }

    if (orderType === "pickup" && !settings.pickup_enabled) {
      return NextResponse.json(
        { ok: false, error: "Gel-Al siparişi şu anda kapalı." },
        { status: 409 }
      );
    }

    if (orderType === "delivery" && !settings.delivery_enabled) {
      return NextResponse.json(
        { ok: false, error: "Paket servis şu anda kapalı." },
        { status: 409 }
      );
    }

    if (customerName.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Ad soyad gerekli." },
        { status: 400 }
      );
    }

    if (phone.replace(/\D/g, "").length < 7) {
      return NextResponse.json(
        { ok: false, error: "Geçerli bir telefon numarası gerekli." },
        { status: 400 }
      );
    }

    if (orderType === "delivery" && address.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Paket servis için teslimat adresi gerekli." },
        { status: 400 }
      );
    }

    const requested = Array.isArray(body.items) ? body.items : [];

    if (!requested.length || requested.length > 25) {
      return NextResponse.json(
        { ok: false, error: "Sepet boş veya çok fazla ürün içeriyor." },
        { status: 400 }
      );
    }

    const quantities = new Map<number, number>();

    for (const row of requested) {
      const id = Number(row?.menuItemId);
      const quantity = Number(row?.quantity);

      if (!Number.isInteger(id) || id <= 0) continue;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) continue;

      quantities.set(id, Math.min(20, (quantities.get(id) ?? 0) + quantity));
    }

    const ids = Array.from(quantities.keys());

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Geçerli ürün bulunamadı." },
        { status: 400 }
      );
    }

    // FİYATI CLIENT'TAN ALMIYORUZ. Güncel fiyatı DB'den tekrar okuyoruz.
    const { data: products, error: productError } = await supabaseAdmin
      .from("menu_items")
      .select("id,name,name_tr,price,portion,active")
      .in("id", ids)
      .eq("active", true);

    if (productError) throw productError;

    if ((products ?? []).length !== ids.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sepetteki ürünlerden biri artık satışta değil. Menüyü yenileyin.",
        },
        { status: 409 }
      );
    }

    const lines = (products ?? []).map((product) => {
      const quantity = quantities.get(Number(product.id)) ?? 1;
      const unitPrice = Number(product.price ?? 0);

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(`${product.name_tr || product.name || "Ürün"} için geçerli fiyat yok.`);
      }

      return {
        menu_item_id: Number(product.id),
        product_name: product.name_tr || product.name || `Ürün ${product.id}`,
        quantity,
        portion_type: "unit",
        portion_label: product.portion || null,
        weight_grams: null,
        unit_price: unitPrice,
        line_total: unitPrice * quantity,
      };
    });

    const total = lines.reduce((sum, line) => sum + line.line_total, 0);

    const minimum =
      orderType === "delivery"
        ? Number(settings.delivery_minimum || 0)
        : Number(settings.pickup_minimum || 0);

    if (total < minimum) {
      return NextResponse.json(
        {
          ok: false,
          error: `Minimum sipariş tutarı ${minimum.toLocaleString("tr-TR")} ₺.`,
        },
        { status: 409 }
      );
    }

    const orderCode = makeOrderCode();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("pos_orders")
      .insert({
        receipt_number: orderCode,
        order_type: orderType === "delivery" ? "Paket" : "Gel-Al",
        table_id: null,
        customer_name: customerName,
        customer_phone: phone,
        delivery_address: orderType === "delivery" ? address : null,
        order_note: note || null,
        subtotal: total,
        total,
        payment_method: "pending",
        status: "open",
        pos_stage: "new",
        source: "web",
        external_order_id: orderCode,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    const { error: itemError } = await supabaseAdmin
      .from("pos_order_items")
      .insert(
        lines.map((line) => ({
          order_id: order.id,
          ...line,
        }))
      );

    if (itemError) {
      await supabaseAdmin.from("pos_orders").delete().eq("id", order.id);
      throw itemError;
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderCode,
      total,
      orderType,
      message: "Siparişiniz alındı.",
    });
  } catch (error) {
    console.error("WEB ORDER CREATE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Sipariş oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}