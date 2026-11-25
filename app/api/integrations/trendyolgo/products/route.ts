import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationUser } from "../../../../../lib/integrations/requireUser";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

type TrendyolProduct = {
  id?: number | string;
  productId?: number | string;
  name?: string;
  productName?: string;
  title?: string;
};
type TrendyolProductsResponse = {
  content?: TrendyolProduct[];
  products?: TrendyolProduct[];
  items?: TrendyolProduct[];
};

const STORE_ID = Number(process.env.TRENDYOL_GO_STORE_ID ?? "468005");

function productsFrom(data: TrendyolProductsResponse) {
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireIntegrationUser(request))) {
      return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
    }
    const sellerId = getTrendyolGoSellerId();
    const data = await trendyolGoRequest<TrendyolProductsResponse>(
      `/integrator/product/meal/suppliers/${sellerId}/stores/${STORE_ID}/products`
    );

    const products = new Map<string, string>();
    for (const product of productsFrom(data)) {
      const id = product.productId ?? product.id;
      if (id === undefined || id === null) continue;
      const name = product.name || product.productName || product.title || `Trendyol ürünü ${id}`;
      products.set(String(id), name);
    }

    return NextResponse.json({
      ok: true,
      count: products.size,
      products: Array.from(products.entries()).map(([productId, name]) => ({
        productId,
        name,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Trendyol Go ürünleri alınamadı.",
      },
      { status: 500 }
    );
  }
}
