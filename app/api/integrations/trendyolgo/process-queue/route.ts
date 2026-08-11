import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

type QueueRow = {
  id: number;
  menu_item_id: number;
  action: "sync" | "create";
  attempts: number;
};

type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  price: number | null;
  active: boolean;
  category: string | null;
};

type Mapping = {
  external_product_id: string;
};

type TrendyolProduct = {
  id?: number | string;
  productId?: number | string;
  sellingPrice?: number;
  price?: number;
  status?: string;
};

type TrendyolMenuResponse = {
  content?: TrendyolProduct[];
  products?: TrendyolProduct[];
  items?: TrendyolProduct[];
};

const STORE_ID = Number(
  process.env.TRENDYOL_GO_STORE_ID ?? "468005"
);

const EXCLUDED = new Set(["peynir", "sarkuteri"]);

function extractProducts(data: TrendyolMenuResponse) {
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeActive(status?: string) {
  const value = String(status || "").toUpperCase();
  if (["ACTIVE", "OPEN", "ON_SALE"].includes(value)) return true;
  if (["PASSIVE", "CLOSED", "OFF_SALE"].includes(value)) return false;
  return null;
}

export async function POST() {
  try {
    const sellerId = getTrendyolGoSellerId();

    const { data: queueData, error: queueError } =
      await supabaseAdmin
        .from("integration_product_queue")
        .select("id,menu_item_id,action,attempts")
        .eq("channel", "trendyol")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);

    if (queueError) throw queueError;

    const queue = (queueData ?? []) as QueueRow[];

    if (!queue.length) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        message: "Bekleyen senkronizasyon yok.",
      });
    }

    const tgoMenu = await trendyolGoRequest<TrendyolMenuResponse>(
      `/integrator/product/meal/suppliers/${sellerId}/stores/${STORE_ID}/products`
    );

    const remoteProducts = extractProducts(tgoMenu);
    const remoteById = new Map<string, TrendyolProduct>();

    for (const p of remoteProducts) {
      const id = p.productId ?? p.id;
      if (id !== undefined && id !== null) {
        remoteById.set(String(id), p);
      }
    }

    const results = [];

    for (const row of queue) {
      try {
        const { data: menuItem, error: menuError } =
          await supabaseAdmin
            .from("menu_items")
            .select("id,name,name_tr,price,active,category")
            .eq("id", row.menu_item_id)
            .single();

        if (menuError) throw menuError;

        const item = menuItem as MenuItem;
        const category = String(item.category || "").toLowerCase();

        if (EXCLUDED.has(category)) {
          await supabaseAdmin
            .from("integration_product_queue")
            .update({
              status: "done",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          results.push({
            menuItemId: row.menu_item_id,
            ok: true,
            skipped: "excluded_category",
          });

          continue;
        }

        const { data: mapping, error: mappingError } =
          await supabaseAdmin
            .from("integration_product_mappings")
            .select("external_product_id")
            .eq("channel", "trendyol")
            .eq("menu_item_id", row.menu_item_id)
            .eq("active", true)
            .maybeSingle();

        if (mappingError) throw mappingError;

        if (!mapping) {
          await supabaseAdmin
            .from("integration_product_queue")
            .update({
              action: "create",
              status: "pending",
              attempts: row.attempts + 1,
              last_error:
                "Trendyol Go Meal create-product endpointi henüz doğrulanmadı; ürün kuyrukta bekliyor.",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          results.push({
            menuItemId: row.menu_item_id,
            ok: false,
            pendingCreate: true,
          });

          continue;
        }

        const map = mapping as Mapping;
        const remote = remoteById.get(map.external_product_id);

        if (!remote) {
          throw new Error(
            `Trendyol ürünü bulunamadı: ${map.external_product_id}`
          );
        }

        const localPrice = Number(item.price || 0);
        const remotePriceRaw = remote.sellingPrice ?? remote.price;
        const remotePrice =
          remotePriceRaw === undefined ? null : Number(remotePriceRaw);

        const remoteActive = normalizeActive(remote.status);

        if (
          localPrice > 0 &&
          remotePrice !== null &&
          Math.abs(localPrice - remotePrice) >= 0.01
        ) {
          await trendyolGoRequest(
            `/integrator/product/meal/suppliers/${sellerId}/products/price`,
            {
              method: "POST",
              body: JSON.stringify({
                items: [
                  {
                    restaurantId: STORE_ID,
                    productId: Number(map.external_product_id),
                    sellingPrice: localPrice,
                  },
                ],
              }),
            }
          );
        }

        if (
          remoteActive !== null &&
          remoteActive !== item.active
        ) {
          await trendyolGoRequest(
            `/integrator/product/meal/suppliers/${sellerId}/stores/${STORE_ID}/products/${map.external_product_id}/status`,
            {
              method: "PUT",
              body: JSON.stringify({
                status: item.active ? "ACTIVE" : "PASSIVE",
              }),
            }
          );
        }

        await supabaseAdmin
          .from("integration_product_queue")
          .update({
            status: "done",
            attempts: row.attempts + 1,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        results.push({
          menuItemId: row.menu_item_id,
          ok: true,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        await supabaseAdmin
          .from("integration_product_queue")
          .update({
            status: "pending",
            attempts: row.attempts + 1,
            last_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        results.push({
          menuItemId: row.menu_item_id,
          ok: false,
          error: message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: queue.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}