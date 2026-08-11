import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

type QueueRow = {
  id: number;
  menu_item_id: number;
  action: string;
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

  if (["ACTIVE", "OPEN", "ON_SALE"].includes(value)) {
    return true;
  }

  if (["PASSIVE", "CLOSED", "OFF_SALE"].includes(value)) {
    return false;
  }

  return null;
}

async function markQueue(
  id: number,
  values: Record<string, unknown>
) {
  const { error } = await supabaseAdmin
    .from("integration_product_queue")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function POST() {
  try {
    /*
     * SADECE mapping'i olan ürünlerin "sync" işlerini al.
     *
     * action=create olan yeni/eşleşmemiş ürünleri burada işlemiyoruz.
     * Böylece pendingCreate kayıtları kendi kendini tekrar tetiklemez.
     */
    const { data: queueData, error: queueError } =
      await supabaseAdmin
        .from("integration_product_queue")
        .select("id,menu_item_id,action,attempts")
        .eq("channel", "trendyol")
        .eq("status", "pending")
        .eq("action", "sync")
        .order("updated_at", { ascending: true })
        .limit(50);

    if (queueError) throw queueError;

    const queue = (queueData ?? []) as QueueRow[];

    if (!queue.length) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        message: "Bekleyen Trendyol Go sync işi yok.",
      });
    }

    const sellerId = getTrendyolGoSellerId();

    /*
     * Trendyol menüsünü request başına yalnızca bir kez çek.
     */
    const tgoMenu =
      await trendyolGoRequest<TrendyolMenuResponse>(
        `/integrator/product/meal/suppliers/${sellerId}/stores/${STORE_ID}/products`
      );

    const remoteProducts = extractProducts(tgoMenu);
    const remoteById = new Map<string, TrendyolProduct>();

    for (const product of remoteProducts) {
      const id = product.productId ?? product.id;

      if (id !== undefined && id !== null) {
        remoteById.set(String(id), product);
      }
    }

    const results: Array<Record<string, unknown>> = [];

    for (const row of queue) {
      /*
       * İş satırını atomik olarak "processing" durumuna almaya çalış.
       * Aynı anda iki request gelirse yalnızca biri bu satırı alır.
       */
      const { data: claimed, error: claimError } =
        await supabaseAdmin
          .from("integration_product_queue")
          .update({
            status: "processing",
            attempts: Number(row.attempts || 0) + 1,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "pending")
          .eq("action", "sync")
          .select("id")
          .maybeSingle();

      if (claimError) {
        results.push({
          menuItemId: row.menu_item_id,
          ok: false,
          error: claimError.message,
        });
        continue;
      }

      /*
       * Başka bir request satırı önce aldıysa atla.
       */
      if (!claimed) {
        continue;
      }

      try {
        const { data: menuItem, error: menuError } =
          await supabaseAdmin
            .from("menu_items")
            .select(
              "id,name,name_tr,price,active,category"
            )
            .eq("id", row.menu_item_id)
            .single();

        if (menuError) throw menuError;

        const item = menuItem as MenuItem;
        const category = String(
          item.category || ""
        ).toLowerCase();

        /*
         * Yemek kanalında peynir ve şarküteri yok.
         */
        if (EXCLUDED.has(category)) {
          await markQueue(row.id, {
            status: "done",
            last_error: null,
          });

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

        /*
         * Mapping sonradan silinmişse create kuyruğuna çevir,
         * AMA status=pending bırakma. Bu processor tekrar tekrar
         * aynı ürünü işlemeye çalışmasın.
         */
        if (!mapping) {
          await markQueue(row.id, {
            action: "create",
            status: "waiting_create",
            last_error:
              "Trendyol Go ürün eşleştirmesi yok. Yeni ürün aktarımı bekleniyor.",
          });

          results.push({
            menuItemId: row.menu_item_id,
            ok: false,
            waitingCreate: true,
          });

          continue;
        }

        const map = mapping as Mapping;
        const remote = remoteById.get(
          map.external_product_id
        );

        if (!remote) {
          throw new Error(
            `Trendyol Go ürünü bulunamadı: ${map.external_product_id}`
          );
        }

        const localPrice = Number(item.price || 0);
        const remotePriceRaw =
          remote.sellingPrice ?? remote.price;

        const remotePrice =
          remotePriceRaw === undefined
            ? null
            : Number(remotePriceRaw);

        /*
         * 0 veya negatif fiyatı ASLA Trendyol'a gönderme.
         */
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
                    productId: Number(
                      map.external_product_id
                    ),
                    sellingPrice: localPrice,
                  },
                ],
              }),
            }
          );
        }

        const remoteActive = normalizeActive(
          remote.status
        );

        if (
          remoteActive !== null &&
          remoteActive !== item.active
        ) {
          await trendyolGoRequest(
            `/integrator/product/meal/suppliers/${sellerId}/stores/${STORE_ID}/products/${map.external_product_id}/status`,
            {
              method: "PUT",
              body: JSON.stringify({
                status: item.active
                  ? "ACTIVE"
                  : "PASSIVE",
              }),
            }
          );
        }

        await markQueue(row.id, {
          status: "done",
          last_error: null,
        });

        results.push({
          menuItemId: row.menu_item_id,
          ok: true,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        /*
         * Hata olursa yeniden denenebilir, ama pg_net trigger olmadığı
         * için kendi kendine sonsuz döngü oluşmaz.
         */
        await markQueue(row.id, {
          status: "pending",
          last_error: message,
        });

        results.push({
          menuItemId: row.menu_item_id,
          ok: false,
          error: message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
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