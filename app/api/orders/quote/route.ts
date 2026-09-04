import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type QuoteItem = {
  menuItemId: number;
  quantity: number;
  portionType?: "unit" | "half" | "weight";
  weightGrams?: number | null;
};

type QuoteBody = {
  deliveryZoneId?: number | null;
  orderType?: "pickup" | "delivery";
  items?: QuoteItem[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuoteBody;

    const requestedLines = new Map<
      string,
      { menuItemId: number; quantity: number; portionType: "unit" | "half" | "weight"; weightGrams: number | null }
    >();

    for (const row of body.items ?? []) {
      const id = Number(row.menuItemId);
      const quantity = Number(row.quantity);
      const portionType = row.portionType === "half" ? "half" : row.portionType === "weight" ? "weight" : "unit";
      const weightGrams = portionType === "weight" ? Number(row.weightGrams) : null;

      if (
        Number.isInteger(id) && id > 0 && Number.isInteger(quantity) && quantity > 0 && quantity <= 20 &&
        (portionType !== "weight" || [50, 100, 250, 500].includes(weightGrams ?? 0))
      ) {
        const key = `${id}-${portionType}-${weightGrams ?? ""}`;
        const existing = requestedLines.get(key);

        requestedLines.set(key, {
          menuItemId: id,
          portionType,
          weightGrams,
          quantity: Math.min(20, (existing?.quantity ?? 0) + quantity),
        });
      }
    }

    const ids = Array.from(
      new Set(Array.from(requestedLines.values()).map((line) => line.menuItemId))
    );

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Sepet boş." },
        { status: 400 }
      );
    }

    const { data: products, error: productError } = await supabaseAdmin
      .from("menu_items")
      .select("id,price,active,category,category_id")
      .in("id", ids)
      .eq("active", true);

    if (productError) throw productError;

    if ((products ?? []).length !== ids.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sepetteki ürünlerden biri artık satışta değil.",
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

    let subtotal = 0;

    for (const requestedLine of requestedLines.values()) {
      const product = productById.get(requestedLine.menuItemId);

      if (!product) {
        return NextResponse.json(
          {
            ok: false,
            error: "Sepetteki ürünlerden biri artık satışta değil.",
          },
          { status: 409 }
        );
      }

      const basePrice = Number(product.price ?? 0);

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return NextResponse.json(
          { ok: false, error: "Sepette geçersiz fiyatlı ürün var." },
          { status: 409 }
        );
      }

      const categorySlug =
        (product.category ? String(product.category) : "") ||
        categorySlugById.get(Number(product.category_id)) ||
        "";

      const halfAllowed =
        categorySlug === "meze" || categorySlug === "zeytinyagli";

      if (requestedLine.portionType === "half" && !halfAllowed) {
        return NextResponse.json(
          { ok: false, error: "Bu ürün yarım porsiyon satılamaz." },
          { status: 400 }
        );
      }

      const weightAllowed = categorySlug === "peynir" || categorySlug === "sarkuteri";
      if (requestedLine.portionType === "weight" && !weightAllowed) {
        return NextResponse.json({ ok: false, error: "Bu ürün gramajla satılamaz." }, { status: 400 });
      }

      const unitPrice =
        requestedLine.portionType === "half" ? basePrice * 0.5 :
        requestedLine.portionType === "weight" && requestedLine.weightGrams ? basePrice * (requestedLine.weightGrams / 50) :
        basePrice;

      subtotal += unitPrice * requestedLine.quantity;
    }

    let deliveryZone: {
      id: number;
      name: string;
      minimum_order: number;
      delivery_fee: number;
    } | null = null;

    if (body.orderType === "delivery") {
      const deliveryZoneId = Number(body.deliveryZoneId);

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

      deliveryZone = {
        id: Number(zone.id),
        name: String(zone.name),
        minimum_order: Number(zone.minimum_order ?? 0),
        delivery_fee: Number(zone.delivery_fee ?? 0),
      };

      if (subtotal < deliveryZone.minimum_order) {
        return NextResponse.json(
          {
            ok: false,
            error: `${deliveryZone.name} için minimum ürün tutarı ${deliveryZone.minimum_order.toLocaleString(
              "tr-TR"
            )} ₺.`,
            subtotal,
            minimum: deliveryZone.minimum_order,
          },
          { status: 409 }
        );
      }
    }

    let memberDiscountPercent = 0;
    let customerUserId: string | null = null;

    const authorization = request.headers.get("authorization");

    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.slice(7);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const authClient = createClient(supabaseUrl, supabaseAnonKey);

        const { data: authData } = await authClient.auth.getUser(token);

        if (authData.user) {
          customerUserId = authData.user.id;

          const { data: profile, error: profileError } = await supabaseAdmin
            .from("customer_profiles")
            .select("discount_percent,discount_active,active")
            .eq("user_id", authData.user.id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (profile?.active && profile?.discount_active) {
            memberDiscountPercent = Number(profile.discount_percent ?? 0);
          }
        }
      }
    }

    const memberDiscountAmount =
      Math.round(subtotal * (memberDiscountPercent / 100) * 100) / 100;

    const deliveryFee = Number(deliveryZone?.delivery_fee ?? 0);
    const total = subtotal - memberDiscountAmount + deliveryFee;

    return NextResponse.json({
      ok: true,
      subtotal,
      memberDiscountPercent,
      memberDiscountAmount,
      deliveryFee,
      total,
      deliveryZone,
      customerUserId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Sipariş toplamı hesaplanamadı.",
      },
      { status: 500 }
    );
  }
}
