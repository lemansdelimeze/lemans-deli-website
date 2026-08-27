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

let cachedAccessToken: {
  token: string;
  expiresAt: number;
} | null = null;

async function middlewareAccessToken() {
  if (
    cachedAccessToken &&
    cachedAccessToken.expiresAt > Date.now() + 30_000
  ) {
    return cachedAccessToken.token;
  }

  const baseUrl = process.env.YEMEKSEPETI_MIDDLEWARE_BASE_URL;
  const username = process.env.YEMEKSEPETI_MIDDLEWARE_USERNAME;
  const password = process.env.YEMEKSEPETI_MIDDLEWARE_PASSWORD;

  if (!baseUrl || !username || !password) {
    throw new Error("Yemeksepeti erişim bilgileri eksik.");
  }

  const body = new URLSearchParams({
    username,
    password,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v2/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Yemeksepeti token alınamadı: HTTP ${response.status}`
    );
  }

  const data = JSON.parse(raw) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Yemeksepeti erişim tokenı dönmedi.");
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 300) * 1000,
  };

  return cachedAccessToken.token;
}

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
            status: "accepted",
            expectedDeliveryTime:
              payload.delivery?.expectedDeliveryTime ||
              new Date(Date.now() + 45 * 60 * 1000).toISOString(),
          }
        : body.stage === "ready"
          ? {
              remoteOrderId: String(order.id),
            }
          : {
              remoteOrderId: String(order.id),
              status: "picked_up",
            };

    const callbackResponse = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${await middlewareAccessToken()}`,
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