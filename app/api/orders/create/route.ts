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