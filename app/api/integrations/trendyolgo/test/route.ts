import { NextResponse } from "next/server";

import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

export async function GET() {
  try {
    const sellerId = getTrendyolGoSellerId();

    const params = new URLSearchParams({
      page: "0",
      size: "1",
    });

    const data = await trendyolGoRequest<unknown>(
      `/integrator/order/meal/suppliers/${sellerId}/packages?${params.toString()}`
    );

    return NextResponse.json({
      ok: true,
      sellerId,
      message: "Uber Eats Trendyol Go Yemek API bağlantısı başarılı.",
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Bağlantı testi başarısız.",
      },
      { status: 500 }
    );
  }
}