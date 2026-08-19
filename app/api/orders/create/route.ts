import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendPosPush } from "../../../../lib/sendPosPush";

type RequestedItem = {
  menuItemId: number;
  quantity: number;
  portionType?: "unit" | "half";
};

type CreateOrderBody = {
  orderType?: "pickup" | "delivery";
  customerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
  website?: string;
  deliveryZoneId?: number | null;
  language?: "tr" | "en" | "ru";
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
  prep_time_min: number | string;
  prep_time_max: number | string;
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
      "ordering_enabled,pickup_enabled,delivery_enabled,auto_schedule_enabled,open_time,close_time,pickup_minimum,delivery_minimum,prep_time_min,prep_time_max,closed_message"
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
      email: null as string | null,
      discountPercent: 0,
    };
  }

  const token = authorization.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      userId: null as string | null,
      email: null as string | null,
      discountPercent: 0,
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData } = await authClient.auth.getUser(token);

  if (!authData.user) {
    return {
      userId: null as string | null,
      email: null as string | null,
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
    email: authData.user.email ?? null,
    discountPercent:
      profile?.active && profile?.discount_active
        ? Number(profile.discount_percent ?? 0)
        : 0,
  };
}


function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 254);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function sendOrderConfirmationEmail(args: {
  to: string;
  language: "tr" | "en" | "ru";
  customerName: string;
  orderCode: string;
  orderType: "pickup" | "delivery";
  lines: Array<{
    product_name: string;
    quantity: number;
    portion_type: "unit" | "half";
    portion_label: string | null;
    unit_price: number;
    line_total: number;
  }>;
  subtotal: number;
  memberDiscountAmount: number;
  deliveryFee: number;
  total: number;
  prepTimeMin: number;
  prepTimeMax: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY tanımlı değil; sipariş onay maili gönderilmedi.");
    return false;
  }

  const copy = {
    tr: {
      subject: `Siparişinizi aldık · ${args.orderCode}`,
      title: "Siparişinizi aldık",
      hello: `Merhaba ${args.customerName},`,
      intro: "Siparişiniz Leman's Deli'ye ulaştı.",
      orderNo: "Sipariş No",
      orderType: "Sipariş Türü",
      pickup: "Gel-Al",
      delivery: "Paket Servis",
      prep: "Tahmini hazırlık",
      minutes: "dk",
      subtotal: "Ara Toplam",
      discount: "Üye İndirimi",
      deliveryFee: "Paket Ücreti",
      total: "Toplam",
      footer: "Siparişinizle ilgili bir sorunuz olursa bize WhatsApp veya telefon üzerinden ulaşabilirsiniz.",
    },
    en: {
      subject: `We received your order · ${args.orderCode}`,
      title: "We received your order",
      hello: `Hello ${args.customerName},`,
      intro: "Your order has reached Leman's Deli.",
      orderNo: "Order No",
      orderType: "Order Type",
      pickup: "Pickup",
      delivery: "Delivery",
      prep: "Estimated preparation",
      minutes: "min",
      subtotal: "Subtotal",
      discount: "Member Discount",
      deliveryFee: "Delivery Fee",
      total: "Total",
      footer: "If you have any questions about your order, you can reach us by WhatsApp or phone.",
    },
    ru: {
      subject: `Мы получили ваш заказ · ${args.orderCode}`,
      title: "Мы получили ваш заказ",
      hello: `Здравствуйте, ${args.customerName}!`,
      intro: "Ваш заказ поступил в Leman's Deli.",
      orderNo: "Номер заказа",
      orderType: "Тип заказа",
      pickup: "Самовывоз",
      delivery: "Доставка",
      prep: "Ориентировочное время приготовления",
      minutes: "мин",
      subtotal: "Сумма",
      discount: "Скидка участника",
      deliveryFee: "Стоимость доставки",
      total: "Итого",
      footer: "Если у вас есть вопросы по заказу, свяжитесь с нами по WhatsApp или телефону.",
    },
  } as const;

  const t = copy[args.language];
  const itemRows = args.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #ead8ce;color:#2a1711;">
            ${escapeHtml(line.product_name)}
            ${line.portion_type === "half" ? ` · ${escapeHtml(line.portion_label || "Yarım porsiyon")}` : ""}
            × ${line.quantity}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #ead8ce;text-align:right;color:#2a1711;font-weight:700;">
            ${money(line.line_total)} ₺
          </td>
        </tr>`
    )
    .join("");

  const discountRow =
    args.memberDiscountAmount > 0
      ? `<tr><td style="padding:7px 0;color:#6b5a51;">${t.discount}</td><td style="padding:7px 0;text-align:right;color:#2f7a48;font-weight:700;">−${money(args.memberDiscountAmount)} ₺</td></tr>`
      : "";

  const deliveryRow =
    args.deliveryFee > 0
      ? `<tr><td style="padding:7px 0;color:#6b5a51;">${t.deliveryFee}</td><td style="padding:7px 0;text-align:right;color:#2a1711;font-weight:700;">${money(args.deliveryFee)} ₺</td></tr>`
      : "";

  const html = `
    <div style="margin:0;padding:32px 16px;background:#f5efe7;font-family:Arial,Helvetica,sans-serif;color:#2a1711;">
      <div style="max-width:580px;margin:0 auto;background:#fffaf4;border:1px solid #ead8ce;border-radius:24px;overflow:hidden;">
        <div style="padding:30px 28px 18px;text-align:center;">
          <img src="https://lemansdeli.com/logo-horizontal.png" alt="Leman's Deli" width="250" style="display:block;width:250px;max-width:82%;height:auto;margin:0 auto;" />
        </div>

        <div style="padding:8px 30px 34px;">
          <h1 style="margin:0 0 14px;text-align:center;font-family:'Courier New',Courier,monospace;font-size:28px;color:#922800;">
            ${t.title}
          </h1>
          <p style="margin:0 0 6px;font-size:16px;line-height:1.6;">${escapeHtml(t.hello)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#6b5a51;">${t.intro}</p>

          <div style="margin-bottom:22px;padding:16px 18px;background:#f5efe7;border-radius:16px;">
            <div style="margin-bottom:7px;"><strong>${t.orderNo}:</strong> ${escapeHtml(args.orderCode)}</div>
            <div style="margin-bottom:7px;"><strong>${t.orderType}:</strong> ${args.orderType === "delivery" ? t.delivery : t.pickup}</div>
            <div><strong>${t.prep}:</strong> ${args.prepTimeMin}–${args.prepTimeMax} ${t.minutes}</div>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
            ${itemRows}
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:7px 0;color:#6b5a51;">${t.subtotal}</td><td style="padding:7px 0;text-align:right;color:#2a1711;font-weight:700;">${money(args.subtotal)} ₺</td></tr>
            ${discountRow}
            ${deliveryRow}
            <tr>
              <td style="padding:12px 0 0;border-top:1px solid #ead8ce;color:#922800;font-size:17px;font-weight:800;">${t.total}</td>
              <td style="padding:12px 0 0;border-top:1px solid #ead8ce;text-align:right;color:#922800;font-size:18px;font-weight:800;">${money(args.total)} ₺</td>
            </tr>
          </table>

          <p style="margin:26px 0 0;font-size:12px;line-height:1.6;text-align:center;color:#8a756a;">
            ${t.footer}
          </p>
        </div>

        <div style="border-top:1px solid #ead8ce;padding:18px 24px;text-align:center;font-size:12px;color:#9a8478;">
          Leman's Deli · Kaş · +90 530 700 57 04
        </div>
      </div>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "lemans-deli-order-api/1.0",
      "Idempotency-Key": `order-confirmation-${args.orderCode}`,
    },
    body: JSON.stringify({
      from: "Leman's Deli <no-reply@lemansdeli.com>",
      to: [args.to],
      subject: t.subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("RESEND ORDER EMAIL ERROR:", response.status, detail);
    return false;
  }

  return true;
}

function halfPortionLabel(portion: string | null) {
  if (!portion) return "Yarım porsiyon";

  const match = portion.match(/^\s*(\d+(?:[.,]\d+)?)\s*(g|gr|gram|ml)\s*$/i);

  if (match) {
    const amount = Number(match[1].replace(",", ".")) / 2;
    const amountText = Number.isInteger(amount)
      ? String(amount)
      : amount.toLocaleString("tr-TR");

    return `${amountText} ${match[2]}`;
  }

  return `Yarım · ${portion}`;
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
    const submittedEmail = normalizeEmail(body.email);
    const language =
      body.language === "en" || body.language === "ru" ? body.language : "tr";
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

    const customerAuth = await getAuthenticatedCustomer(request);
    const customerEmail = normalizeEmail(customerAuth.email || submittedEmail);

    if (!isValidEmail(customerEmail)) {
      return NextResponse.json(
        { ok: false, error: "Geçerli bir e-posta adresi gerekli." },
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

    const requestedLines = new Map<
      string,
      { menuItemId: number; quantity: number; portionType: "unit" | "half" }
    >();

    for (const row of requested) {
      const id = Number(row?.menuItemId);
      const quantity = Number(row?.quantity);
      const portionType = row?.portionType === "half" ? "half" : "unit";

      if (!Number.isInteger(id) || id <= 0) continue;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) continue;

      const key = `${id}-${portionType}`;
      const existing = requestedLines.get(key);

      requestedLines.set(key, {
        menuItemId: id,
        portionType,
        quantity: Math.min(20, (existing?.quantity ?? 0) + quantity),
      });
    }

    const ids = Array.from(
      new Set(Array.from(requestedLines.values()).map((line) => line.menuItemId))
    );

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Geçerli ürün bulunamadı." },
        { status: 400 }
      );
    }

    const { data: products, error: productError } = await supabaseAdmin
      .from("menu_items")
      .select("id,name,name_tr,price,portion,category,category_id,active")
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

    const categoryIds = Array.from(
      new Set(
        (products ?? [])
          .map((product) => Number(product.category_id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    const categorySlugById = new Map<number, string>();

    if (categoryIds.length > 0) {
      const { data: categoryRows, error: categoryError } = await supabaseAdmin
        .from("categories")
        .select("id,slug")
        .in("id", categoryIds);

      if (categoryError) throw categoryError;

      for (const category of categoryRows ?? []) {
        categorySlugById.set(Number(category.id), String(category.slug));
      }
    }

    const productById = new Map(
      (products ?? []).map((product) => [Number(product.id), product])
    );

    const lines = Array.from(requestedLines.values()).map((requestedLine) => {
      const product = productById.get(requestedLine.menuItemId);

      if (!product) {
        throw new Error("Sepetteki ürünlerden biri artık satışta değil.");
      }

      const basePrice = Number(product.price ?? 0);

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new Error(
          `${product.name_tr || product.name || "Ürün"} için geçerli fiyat yok.`
        );
      }

      const categorySlug =
        (product.category ? String(product.category) : "") ||
        categorySlugById.get(Number(product.category_id)) ||
        "";

      const halfAllowed =
        categorySlug === "meze" || categorySlug === "zeytinyagli";

      if (requestedLine.portionType === "half" && !halfAllowed) {
        throw new Error(
          `${product.name_tr || product.name || "Ürün"} yarım porsiyon satılamaz.`
        );
      }

      const portionType = requestedLine.portionType;
      const unitPrice = basePrice * (portionType === "half" ? 0.5 : 1);
      const portionLabel =
        portionType === "half"
          ? halfPortionLabel(product.portion || null)
          : product.portion || null;

      return {
        menu_item_id: Number(product.id),
        product_name: product.name_tr || product.name || `Ürün ${product.id}`,
        quantity: requestedLine.quantity,
        portion_type: portionType,
        portion_label: portionLabel,
        weight_grams: null,
        unit_price: unitPrice,
        line_total: unitPrice * requestedLine.quantity,
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
        customer_email: customerEmail,
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

    try {
      await sendPosPush({
        title: "🚨 YENİ WEB SİPARİŞİ",
        body: `${customerName} · ${total.toLocaleString("tr-TR")} ₺ · ${
          orderType === "delivery" ? "Paket Servis" : "Gel-Al"
        }`,
        orderId: order.id,
        tag: `web-order-${order.id}`,
        url: "/pos",
      });
    } catch (pushError) {
      console.error("POS PUSH FAILED:", pushError);
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

    let confirmationEmailSent = false;

    try {
      confirmationEmailSent = await sendOrderConfirmationEmail({
        to: customerEmail,
        language,
        customerName,
        orderCode,
        orderType,
        lines,
        subtotal,
        memberDiscountAmount,
        deliveryFee,
        total,
        prepTimeMin: Number(settings.prep_time_min || 20),
        prepTimeMax: Number(settings.prep_time_max || 35),
      });
    } catch (emailError) {
      console.error("ORDER CONFIRMATION EMAIL FAILED:", emailError);
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
      confirmationEmailSent,
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