import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  website?: string;
  deliveryZoneId?: number | null;
  items?: RequestedItem[];
};

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

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, "").slice(0, 20);
}

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

async function getAuthenticatedCustomer(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      userId: null as string | null,
      discountPercent: 0,
    };
  }

  const token = authorization.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      userId: null as string | null,
      discountPercent: 0,
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData } = await authClient.auth.getUser(token);

  if (!authData.user) {
    return {
      userId: null as string | null,
      discountPercent: 0,
    };
  }

  const { data: profile, error } = await supabaseAdmin
    .from("customer_profiles")
    .select("discount_percent,discount_active,active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    userId: authData.user.id,
    discountPercent:
      profile?.active && profile?.discount_active
        ? Number(profile.discount_percent ?? 0)
        : 0,
  };
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
        throw new Error(
          `${product.name_tr || product.name || "Ürün"} için geçerli fiyat yok.`
        );
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

    const subtotal = lines.reduce((sum, line) => sum + line.line_total, 0);

    let deliveryZoneId: number | null = null;
    let deliveryFee = 0;
    let minimum = Number(settings.pickup_minimum || 0);

    if (orderType === "delivery") {
      deliveryZoneId = Number(body.deliveryZoneId);

      if (!Number.isInteger(deliveryZoneId) || deliveryZoneId <= 0) {
        return NextResponse.json(
          { ok: false, error: "Teslimat bölgesi seçin." },
          { status: 400 }
        );
      }

      const { data: zone, error: zoneError } = await supabaseAdmin
        .from("delivery_zones")
        .select("id,name,minimum_order,delivery_fee")
        .eq("id", deliveryZoneId)
        .eq("active", true)
        .single();

      if (zoneError) throw zoneError;

      minimum = Number(zone.minimum_order ?? 0);
      deliveryFee = Number(zone.delivery_fee ?? 0);

      if (subtotal < minimum) {
        return NextResponse.json(
          {
            ok: false,
            error: `${zone.name} için minimum ürün tutarı ${minimum.toLocaleString(
              "tr-TR"
            )} ₺.`,
          },
          { status: 409 }
        );
      }
    } else if (subtotal < minimum) {
      return NextResponse.json(
        {
          ok: false,
          error: `Minimum sipariş tutarı ${minimum.toLocaleString("tr-TR")} ₺.`,
        },
        { status: 409 }
      );
    }

    const customerAuth = await getAuthenticatedCustomer(request);
    const memberDiscountPercent = customerAuth.discountPercent;
    const memberDiscountAmount =
      Math.round(subtotal * (memberDiscountPercent / 100) * 100) / 100;

    const total = subtotal - memberDiscountAmount + deliveryFee;
    const orderCode = makeOrderCode();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("pos_orders")
      .insert({
        receipt_number: orderCode,
        order_type: orderType === "delivery" ? "Paket" : "Gel-Al",
        table_id: null,
        customer_name: customerName,
        customer_phone: phone,
        customer_user_id: customerAuth.userId,
        delivery_address: orderType === "delivery" ? address : null,
        delivery_zone_id: orderType === "delivery" ? deliveryZoneId : null,
        delivery_fee: deliveryFee,
        order_note: note || null,
        subtotal,
        discount_amount: memberDiscountAmount,
        member_discount_percent: memberDiscountPercent,
        member_discount_amount: memberDiscountAmount,
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

    if (customerAuth.userId) {
      const { data: profile } = await supabaseAdmin
        .from("customer_profiles")
        .select("order_count,total_spent")
        .eq("user_id", customerAuth.userId)
        .maybeSingle();

      if (profile) {
        await supabaseAdmin
          .from("customer_profiles")
          .update({
            order_count: Number(profile.order_count ?? 0) + 1,
            total_spent: Number(profile.total_spent ?? 0) + total,
            last_order_at: new Date().toISOString(),
          })
          .eq("user_id", customerAuth.userId);
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderCode,
      subtotal,
      memberDiscountPercent,
      memberDiscountAmount,
      deliveryFee,
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