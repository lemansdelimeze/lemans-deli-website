import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type JwtCheck = { valid: boolean; reason: string };

function verifyMiddlewareJwt(request: NextRequest): JwtCheck {
  const secret = process.env.YEMEKSEPETI_MIDDLEWARE_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret) return { valid: false, reason: "secret_missing" };
  if (!authorization.startsWith("Bearer ")) {
    return { valid: false, reason: "authorization_missing" };
  }

  const parts = authorization.slice(7).trim().split(".");
  if (parts.length !== 3) return { valid: false, reason: "token_format_invalid" };

  try {
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as {
      alg?: string;
    };
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      service?: string;
      exp?: number;
    };
    if (header.alg !== "HS512" || payload.service !== "middleware") {
      return { valid: false, reason: "claims_invalid" };
    }
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: "token_expired" };
    }

    const expected = createHmac("sha512", secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest();
    const received = Buffer.from(signaturePart, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return { valid: false, reason: "signature_mismatch" };
    }
    return { valid: true, reason: "valid" };
  } catch {
    return { valid: false, reason: "token_payload_invalid" };
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ remoteId: string; remoteOrderId: string }> }
) {
  const { remoteId, remoteOrderId } = await params;
  const jwt = verifyMiddlewareJwt(request);

  if (remoteId !== process.env.YEMEKSEPETI_REMOTE_ID) {
    return NextResponse.json(
      { reason: "INVALID_REQUEST", message: "Geçersiz Remote ID." },
      { status: 400 }
    );
  }
  if (!jwt.valid) {
    console.warn("YS status callback yetkisiz", { remoteId, reason: jwt.reason });
    return NextResponse.json(
      { reason: "UNAUTHORIZED", message: "Yetkilendirme doğrulanamadı." },
      { status: 401 }
    );
  }

  const orderId = Number(remoteOrderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json(
      { reason: "INVALID_REQUEST", message: "Geçersiz sipariş numarası." },
      { status: 400 }
    );
  }

  let body: { status?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { reason: "INVALID_REQUEST", message: "Geçersiz JSON gövdesi." },
      { status: 400 }
    );
  }

  if (body.status !== "ORDER_CANCELLED") {
    // Acknowledge supported notification endpoint while leaving unhandled events unchanged.
    console.info("YS status callback alındı; değişiklik uygulanmadı", {
      remoteOrderId,
      status: body.status ?? "unknown",
    });
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const { data: order, error: findError } = await supabaseAdmin
    .from("pos_orders")
    .select("id,status,source,external_order_id")
    .eq("id", orderId)
    .eq("source", "yemeksepeti")
    .maybeSingle();

  if (findError) {
    console.error("YS iptal siparişi aranamadı", { remoteOrderId, error: findError });
    return NextResponse.json({ reason: "INTERNAL_SERVICE_ERROR" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ reason: "NOT_FOUND" }, { status: 404 });
  }

  if (order.status === "cancelled") {
    return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date().toISOString();
  const reason = body.message?.trim() || "Yemeksepeti üzerinden iptal edildi";
  const update: Record<string, unknown> = {
    external_status: "cancelled",
    cancel_reason: reason,
  };
  if (order.status === "open") {
    Object.assign(update, {
      status: "cancelled",
      pos_stage: "cancelled",
      cancelled_at: now,
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("pos_orders")
    .update(update)
    .eq("id", order.id)
    .eq("source", "yemeksepeti");

  if (updateError) {
    console.error("YS sipariş iptali kaydedilemedi", { remoteOrderId, error: updateError });
    return NextResponse.json({ reason: "INTERNAL_SERVICE_ERROR" }, { status: 500 });
  }

  await supabaseAdmin.from("integration_events").insert({
    channel: "yemeksepeti",
    event_type: "order.cancelled",
    external_order_id: order.external_order_id,
    direction: "inbound",
    status: "processed",
    payload: body,
    processed_at: now,
  });

  console.info("YS sipariş iptali işlendi", { remoteOrderId, orderStatus: order.status });
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
