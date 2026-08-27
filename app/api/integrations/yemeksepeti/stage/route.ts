import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Stage = "accepted" | "ready" | "on_the_way";

type CallbackUrls = {
  orderAcceptedUrl?: string;
  orderPreparedUrl?: string;
  orderPickedUpUrl?: string;
};

type YemeksepetiPayload = {
  callbackUrls?: CallbackUrls;
  delivery?: {
    expectedDeliveryTime?: string | null;
  };
};

function supabaseForRequest(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !key || !authorization) return null;

  return createClient(url, key, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseForRequest(request);

    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Personel oturumu bulunamadı." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Personel oturumu bulunamadı." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      orderId?: number;
      stage?: Stage;
    };

    if (
      !body.orderId ||
      !["accepted", "ready", "on_the_way"].includes(body.stage || "")
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz sipariş aşaması." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("pos_orders")
      .select("id,source,status,external_payload")
      .eq("id", body.orderId)
      .eq("source", "yemeksepeti")
      .eq("status", "open")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { ok: false, error: "Açık Yemeksepeti siparişi bulunamadı." },
        { status: 404 }
      );
    }

    const payload = (order.external_payload || {}) as YemeksepetiPayload;
    const callbacks = payload.callbackUrls || {};

    const callbackUrl =
      body.stage === "accepted"
        ? callbacks.orderAcceptedUrl
        : body.stage === "ready"
          ? callbacks.orderPreparedUrl
          : callbacks.orderPickedUpUrl;

    if (!callbackUrl) {
      return NextResponse.json(
        { ok: false, error: "Yemeksepeti durum callback adresi bulunamadı." },
        { status: 400 }
      );
    }

    const callbackBody =
      body.stage === "accepted"
        ? {
            remoteOrderId: String(order.id),
            expectedDeliveryTime:
              payload.delivery?.expectedDeliveryTime ||
              new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          }
        : {
            remoteOrderId: String(order.id),
          };

    const callbackResponse = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callbackBody),
      cache: "no-store",
    });

    const callbackText = await callbackResponse.text();

    if (!callbackResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Yemeksepeti bildirimi başarısız: HTTP ${callbackResponse.status}`,
          response: callbackText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const { error: updateError } = await supabase
      .from("pos_orders")
      .update({
        pos_stage: body.stage,
        external_status:
          body.stage === "accepted"
            ? "accepted"
            : body.stage === "ready"
              ? "ready_for_pickup"
              : "picked_up",
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      stage: body.stage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Yemeksepeti durum güncellenemedi.",
      },
      { status: 500 }
    );
  }
}