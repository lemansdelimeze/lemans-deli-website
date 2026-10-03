import { NextRequest, NextResponse } from "next/server";
import { requireIntegrationUser } from "../../../../../lib/integrations/requireUser";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

type TgLine = { productId: number; name: string };
type TgPackage = { lines?: TgLine[] };
type TgResponse = { content?: TgPackage[] };

export async function GET(request: NextRequest) {
  try {
    if (!(await requireIntegrationUser(request))) {
      return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
    }
    const sellerId = getTrendyolGoSellerId();
    const params = new URLSearchParams({ page: "0", size: "50" });

    const data = await trendyolGoRequest<TgResponse>(
      `/integrator/order/meal/suppliers/${sellerId}/packages?${params.toString()}`
    );

    const products = new Map<string, string>();

    for (const pkg of data.content ?? []) {
      for (const line of pkg.lines ?? []) {
        products.set(String(line.productId), line.name);
      }
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
