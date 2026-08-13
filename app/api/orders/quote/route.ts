import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type QuoteItem = {
  menuItemId: number;
  quantity: number;
};

type QuoteBody = {
  deliveryZoneId?: number | null;
  orderType?: "pickup" | "delivery";
  items?: QuoteItem[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuoteBody;

    const quantities = new Map<number, number>();

    for (const row of body.items ?? []) {
      const id = Number(row.menuItemId);
      const quantity = Number(row.quantity);

      if (
        Number.isInteger(id) &&
        id > 0 &&
        Number.isInteger(quantity) &&
        quantity > 0
      ) {
        quantities.set(id, Math.min(20, quantity));
      }
    }

    const ids = Array.from(quantities.keys());

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Sepet boş." },
        { status: 400 }
      );
    }

    const { data: products, error: productError } = await supabaseAdmin
      .from("menu_items")
      .select("id,price,active")
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

    const subtotal = (products ?? []).reduce((sum, product) => {
      const quantity = quantities.get(Number(product.id)) ?? 0;
      return sum + Number(product.price ?? 0) * quantity;
    }, 0);

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