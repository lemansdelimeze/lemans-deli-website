import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  price: number | null;
  active: boolean;
  category: string | null;
};

type Mapping = {
  menu_item_id: number;
  external_product_id: string;
  external_name: string | null;
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

const STORE_ID = Number(process.env.TRENDYOL_GO_STORE_ID ?? "468005");
const EXCLUDED = new Set(["sarkuteri", "peynir"]);

function nameOf(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

function activeFromStatus(status?: string) {
  const s = String(status || "").toUpperCase();
  if (["ACTIVE", "OPEN", "ON_SALE"].includes(s)) return true;
  if (["PASSIVE", "CLOSED", "OFF_SALE"].includes(s)) return false;
  return null;
}

function productsFrom(data: TrendyolMenuResponse) {
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

async function buildDiff() {
  const sellerId = getTrendyolGoSellerId();

  const [{ data: menuData, error: menuError }, { data: mapData, error: mapError }] =
    await Promise.all([
      supabaseAdmin
        .from("menu_items")
        .select("id,name,name_tr,price,active,category"),
      supabaseAdmin
        .from("integration_product_mappings")
        .select("menu_item_id,external_product_id,external_name")
        .eq("channel", "trendyol")
        .eq("active", true),
    ]);

  if (menuError) throw menuError;
  if (mapError) throw mapError;

  const menuItems = ((menuData ?? []) as MenuItem[]).filter(
    (item) => !EXCLUDED.has(String(item.category || "").toLowerCase())
  );
  const mappings = (mapData ?? []) as Mapping[];

  const tgoMenu = await trendyolGoRequest<TrendyolMenuResponse>(
    `/integrator/product/meal/suppliers/${sellerId}/stores/${STORE_ID}/products`
  );

  const tgoProducts = productsFrom(tgoMenu);
  const byId = new Map<string, TrendyolProduct>();

  for (const p of tgoProducts) {
    const id = p.productId ?? p.id;
    if (id !== undefined && id !== null) byId.set(String(id), p);
  }

  const priceChanges: any[] = [];
  const statusChanges: any[] = [];
  const skipped: any[] = [];

  for (const mapping of mappings) {
    const local = menuItems.find((x) => x.id === mapping.menu_item_id);
    if (!local) continue;

    const remote = byId.get(mapping.external_product_id);
    if (!remote) continue;

    const localPrice = Number(local.price || 0);
    const remotePriceRaw = remote.sellingPrice ?? remote.price;
    const remotePrice =
      remotePriceRaw === undefined ? null : Number(remotePriceRaw);

    if (localPrice <= 0) {
      skipped.push({
        productId: mapping.external_product_id,
        name: nameOf(local),
        reason: "Yerel fiyat 0 veya negatif.",
      });
    } else if (
      remotePrice !== null &&
      Math.abs(localPrice - remotePrice) >= 0.01
    ) {
      priceChanges.push({
        productId: mapping.external_product_id,
        name: nameOf(local),
        localPrice,
        trendyolPrice: remotePrice,
      });
    }

    const remoteActive = activeFromStatus(remote.status);

    if (remoteActive !== null && remoteActive !== local.active) {
      statusChanges.push({
        productId: mapping.external_product_id,
        name: nameOf(local),
        localActive: local.active,
        trendyolActive: remoteActive,
        trendyolStatus: remote.status || null,
      });
    }
  }

  return { sellerId, mappings, tgoProducts, priceChanges, statusChanges, skipped };
}

export async function GET() {
  try {
    const diff = await buildDiff();

    return NextResponse.json({
      ok: true,
      dryRun: true,
      sellerId: diff.sellerId,
      storeId: STORE_ID,
      summary: {
        mappedProducts: diff.mappings.length,
        trendyolProducts: diff.tgoProducts.length,
        priceChanges: diff.priceChanges.length,
        statusChanges: diff.statusChanges.length,
        skipped: diff.skipped.length,
      },
      priceChanges: diff.priceChanges,
      statusChanges: diff.statusChanges,
      skipped: diff.skipped,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        dryRun: true,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body?.confirm !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Gerçek senkronizasyon için {"confirm":true} gönder.',
        },
        { status: 400 }
      );
    }

    const diff = await buildDiff();

    let priceBatch: unknown = null;

    if (diff.priceChanges.length > 0) {
      priceBatch = await trendyolGoRequest<unknown>(
        `/integrator/product/meal/suppliers/${diff.sellerId}/products/price`,
        {
          method: "POST",
          body: JSON.stringify({
            items: diff.priceChanges.map((item) => ({
              restaurantId: STORE_ID,
              productId: Number(item.productId),
              sellingPrice: item.localPrice,
            })),
          }),
        }
      );
    }

    const statusResults = [];

    for (const item of diff.statusChanges) {
      const status = item.localActive ? "ACTIVE" : "PASSIVE";

      try {
        await trendyolGoRequest<unknown>(
          `/integrator/product/meal/suppliers/${diff.sellerId}/stores/${STORE_ID}/products/${item.productId}/status`,
          {
            method: "PUT",
            body: JSON.stringify({ status }),
          }
        );

        statusResults.push({ productId: item.productId, status, ok: true });
      } catch (error) {
        statusResults.push({
          productId: item.productId,
          status,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      summary: {
        pricesRequested: diff.priceChanges.length,
        statusesRequested: diff.statusChanges.length,
        skipped: diff.skipped.length,
      },
      priceBatch,
      statusResults,
      skipped: diff.skipped,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        dryRun: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}