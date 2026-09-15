import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendLucaArchiveInvoice } from "../../../../../lib/integrations/luca/archiveInvoice";

export const runtime = "nodejs";

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

async function event(orderId: number, eventType: string, status: string, message: string) {
  await supabaseAdmin.from("pos_invoice_events").insert({
    order_id: orderId,
    provider: "luca",
    event_type: eventType,
    status,
    message,
  });
}

function isOnlinePlatformPayment(order: {
  source: string | null;
  payment_method: string | null;
  external_payload: unknown;
}) {
  if (!["trendyol", "yemeksepeti"].includes(String(order.source))) {
    return false;
  }

  const payloadPayment =
    order.external_payload && typeof order.external_payload === "object"
      ? (order.external_payload as { payment?: { type?: unknown; paymentType?: unknown } }).payment
      : null;
  const value = [
    order.payment_method,
    payloadPayment?.type,
    payloadPayment?.paymentType,
  ]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return value.includes("online") || value.includes("pay_with_card");
}

export async function POST(request: NextRequest) {
  const requestSupabase = supabaseForRequest(request);
  if (!requestSupabase) {
    return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
  }

  const { data: authData, error: authError } = await requestSupabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
  }

  const { data: staff, error: staffError } = await supabaseAdmin
    .from("staff_profiles")
    .select("role,active")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (
    staffError ||
    !staff?.active ||
    !["admin", "owner"].includes(String(staff.role))
  ) {
    return NextResponse.json(
      { ok: false, error: "Fatura kesme yetkiniz bulunmuyor." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as { orderId?: number; manual?: boolean };
  if (!body.orderId) {
    return NextResponse.json({ ok: false, error: "Sipariş numarası zorunlu." }, { status: 400 });
  }

  if (!body.manual && process.env.LUCA_AUTO_INVOICE_ENABLED !== "true") {
    return NextResponse.json({ ok: true, status: "disabled" });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("pos_orders")
    .select("id,receipt_number,customer_name,customer_phone,delivery_address,total,status,source,payment_method,external_payload,invoice_status,invoice_customer_name,invoice_address,invoice_tax_number")
    .eq("id", body.orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ ok: false, error: "Sipariş bulunamadı." }, { status: 404 });
  }
  if (order.status !== "closed") {
    return NextResponse.json({ ok: false, error: "Sadece kapanmış sipariş faturalandırılabilir." }, { status: 409 });
  }
  if (!isOnlinePlatformPayment(order)) {
    return NextResponse.json({ ok: true, status: "out_of_scope" });
  }
  if (order.invoice_status === "sent") {
    return NextResponse.json({ ok: true, status: "already_sent" });
  }
  if (!body.manual && order.invoice_status !== "none") {
    return NextResponse.json({ ok: true, status: "not_automatic" });
  }
  if (body.manual && !["ready", "failed"].includes(String(order.invoice_status))) {
    return NextResponse.json({ ok: false, error: "Önce fatura taslağını kaydedin." }, { status: 409 });
  }

  const { data: locked, error: lockError } = await supabaseAdmin
    .from("pos_orders")
    .update({
      invoice_requested: true,
      invoice_type: "e_arsiv",
      invoice_status: "sending",
      invoice_error: null,
      invoice_created_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("invoice_status", body.manual ? ["ready", "failed"] : ["none"])
    .select("id")
    .maybeSingle();

  if (lockError) throw lockError;
  if (!locked) return NextResponse.json({ ok: true, status: "already_processing" });

  try {
    await event(order.id, "archive.sending", "sending", "LUCA e-Arşiv faturası gönderiliyor.");
    const { data: lines, error: linesError } = await supabaseAdmin
      .from("pos_order_items")
      .select("product_name,quantity,line_total")
      .eq("order_id", order.id)
      .order("id");
    if (linesError) throw linesError;

    const invoiceOrder = body.manual ? { ...order, customer_name: order.invoice_customer_name || order.customer_name, delivery_address: order.invoice_address || order.delivery_address } : order;
    const result = await sendLucaArchiveInvoice(invoiceOrder, lines ?? []);
    const { error: sentError } = await supabaseAdmin
      .from("pos_orders")
      .update({
        invoice_status: "sent",
        invoice_number: result.invoiceNumber,
        invoice_uuid: result.invoiceUuid || result.externalCode,
        invoice_error: null,
      })
      .eq("id", order.id);
    if (sentError) throw sentError;

    await event(order.id, "archive.sent", "sent", `LUCA e-Arşiv faturası gönderildi: ${result.invoiceNumber || result.externalCode}`);
    return NextResponse.json({ ok: true, status: "sent", invoiceNumber: result.invoiceNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LUCA e-Arşiv faturası gönderilemedi.";
    await supabaseAdmin
      .from("pos_orders")
      .update({ invoice_status: "failed", invoice_error: message })
      .eq("id", order.id);
    await event(order.id, "archive.failed", "failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
