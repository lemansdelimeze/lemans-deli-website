import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  getTrendyolGoSellerId,
  trendyolGoRequest,
} from "../../../../../lib/integrations/trendyolgo/client";

export const runtime = "nodejs";

type Stage = "accepted" | "on_the_way" | "delivered";

type TrendyolPayload = {
  id?: string;
  deliveryType?: string;
};

function supabaseForRequest(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !key || !authorization) return null;

  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseForRequest(request);

    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Personel oturumu bulunamadÄ±." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Personel oturumu bulunamadÄ±." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      orderId?: number;
      stage?: Stage;
      preparationTime?: number;
    };

    if (
      !body.orderId ||
      !["accepted", "on_the_way", "delivered"].includes(body.stage || "")
    ) {
      return NextResponse.json(
        { ok: false, error: "GeÃ§ersiz Trendyol Go sipariÅŸ aÅŸamasÄ±." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("pos_orders")
      .select("id,external_order_id,source,status,external_payload")
      .eq("id", body.orderId)
      .eq("source", "trendyol")
      .eq("status", "open")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { ok: false, error: "AÃ§Ä±k Trendyol Go sipariÅŸi bulunamadÄ±." },
        { status: 404 }
      );
    }

    const payload = (order.external_payload || {}) as TrendyolPayload;
    const packageId = String(payload.id || "").trim();

    if (!packageId) {
      return NextResponse.json(
        { ok: false, error: "Trendyol Go paket kimliÄŸi bulunamadÄ±." },
        { status: 400 }
      );
    }

    if (payload.deliveryType !== "STORE") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu sipariÅŸ kendi kurye teslimatÄ± deÄŸil; Trendyol Go durumunu kurye yÃ¶netir.",
        },
        { status: 400 }
      );
    }

    const sellerId = getTrendyolGoSellerId();
    const packagePath = `/integrator/order/meal/suppliers/${sellerId}/packages`;
    const preparationTime = Math.min(
      120,
      Math.max(1, Math.round(Number(body.preparationTime || 30)))
    );

    if (body.stage === "accepted") {
      await trendyolGoRequest(`${packagePath}/picked`, {
        method: "PUT",
        body: JSON.stringify({ packageId, preparationTime }),
      });
    } else if (body.stage === "on_the_way") {
      await trendyolGoRequest(
        `${packagePath}/${encodeURIComponent(packageId)}/manual-shipped`,
        { method: "PUT" }
      );
    } else {
      await trendyolGoRequest(
        `${packagePath}/${encodeURIComponent(packageId)}/manual-delivered`,
        { method: "PUT" }
      );
    }

    const updates: Record<string, unknown> =
      body.stage === "accepted"
        ? { pos_stage: "accepted", external_status: "Picked" }
        : body.stage === "on_the_way"
          ? { pos_stage: "on_the_way", external_status: "Shipped" }
          : {
              status: "closed",
              pos_stage: "delivered",
              external_status: "Delivered",
              closed_at: new Date().toISOString(),
            };

    const { error: updateError } = await supabaseAdmin
      .from("pos_orders")
      .update(updates)
      .eq("id", order.id);

    if (updateError) throw updateError;

    await supabaseAdmin.from("integration_events").insert({
      channel: "trendyol",
      event_type: `order.${body.stage}`,
      external_order_id: order.external_order_id,
      direction: "outbound",
      status: "processed",
      payload: { packageId, stage: body.stage, preparationTime },
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, stage: body.stage });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Trendyol Go durumu gÃ¼ncellenemedi.",
      },
      { status: 500 }
    );
  }
}