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
  packageStatus: string;
  totalPrice: number;
  customer?: {
    firstName?: string;
    lastName?: string;
  } | null;
  customerNote?: string | null;
  lines: TgLine[];
  promotions?: TgPromotion[];
  totalDeliveryPrice?: number;
};

type TgPackageResponse = {
  totalCount: number;
  totalPages: number;
  page: number;
  size: number;
  content: TgPackage[];
};

async function findMenuItemId(
  productId: number
): Promise<number | null> {
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
    let skipped = 0;
    let unmatched = 0;
    const unmatchedProducts = new Map<string, string>();

    for (const pkg of response.content ?? []) {
      const externalOrderId = pkg.orderNumber || pkg.orderId || pkg.id;

      const { data: existing, error: existingError } =
        await supabaseAdmin
          .from("pos_orders")
          .select("id")
          .eq("source", "trendyol")
          .eq("external_order_id", externalOrderId)
          .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        skipped += 1;
        continue;
      }

      const rows = [];
      let hasUnmatched = false;

      for (const line of pkg.lines ?? []) {
        const menuItemId = await findMenuItemId(line.productId);

        if (!menuItemId) {
          hasUnmatched = true;
          unmatched += 1;
          unmatchedProducts.set(
            String(line.productId),
            line.name
          );
          continue;
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

      if (hasUnmatched || rows.length === 0) {
        await supabaseAdmin.from("integration_events").insert({
          channel: "trendyol",
          event_type: "order.mapping_required",
          external_order_id: externalOrderId,
          direction: "inbound",
          status: "failed",
          payload: pkg,
          error_message:
            "Siparişte eşleştirilmemiş Trendyol Go ürünü var.",
        });

        continue;
      }

      const subtotal = rows.reduce(
        (sum, row) => sum + row.line_total,
        0
      );

      const sellerPromotionTotal = (pkg.promotions ?? []).reduce(
        (sum, promotion) =>
          sum + Number(promotion.totalSellerAmount || 0),
        0
      );

      const orderStatus =
        pkg.packageStatus === "Delivered" ? "closed" : "open";

      const { data: order, error: orderError } =
        await supabaseAdmin
          .from("pos_orders")
          .insert({
            receipt_number: `TGO-${externalOrderId}`,
            order_type: "Paket",
            customer_name:
              `${pkg.customer?.firstName ?? ""} ${
                pkg.customer?.lastName ?? ""
              }`.trim() || null,
            order_note: pkg.customerNote || null,
            subtotal,
            discount_amount: sellerPromotionTotal,
            total: Number(pkg.totalPrice || subtotal),
            payment_method: "pending",
            status: orderStatus,
            source: "trendyol",
            external_order_id: externalOrderId,
            external_restaurant_id: String(pkg.storeId),
            external_status: pkg.packageStatus,
            external_payload: pkg,
            restaurant_discount_amount: sellerPromotionTotal,
            channel_net_amount: Number(pkg.totalPrice || subtotal),
            closed_at:
              orderStatus === "closed"
                ? new Date().toISOString()
                : null,
          })
          .select("id")
          .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabaseAdmin
        .from("pos_order_items")
        .insert(
          rows.map((row) => ({
            order_id: order.id,
            ...row,
          }))
        );

      if (itemsError) {
        await supabaseAdmin
          .from("pos_orders")
          .delete()
          .eq("id", order.id);
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
      skipped,
      unmatched,
      unmatchedProducts: Array.from(unmatchedProducts.entries()).map(
        ([productId, name]) => ({
          productId,
          name,
        })
      ),
    });
    } catch (error: unknown) {
    console.error("TRENDYOL GO SYNC ERROR:", error);

    let message = "Trendyol Go sipariş senkronizasyonu başarısız.";

    if (error instanceof Error) {
      message = error.message;
    } else if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      message = String(
        (error as { message?: unknown }).message
      );
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        detail: error,
      },
      { status: 500 }
    );
  }
}