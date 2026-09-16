import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { buildLucaArchiveInvoiceDraft } from "../../../../../lib/integrations/luca/archiveInvoice";

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

async function authorize(request: NextRequest) {
  const client = supabaseForRequest(request);
  if (!client) return false;
  const { data } = await client.auth.getUser();
  if (!data.user) return false;
  const { data: staff } = await supabaseAdmin
    .from("staff_profiles")
    .select("role,active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return Boolean(staff?.active && ["admin", "owner"].includes(String(staff.role)));
}

function paymentCategory(order: {
  payment_method: string | null;
  external_payload: unknown;
}) {
  const payment = order.external_payload && typeof order.external_payload === 'object'
    ? (order.external_payload as { payment?: { type?: unknown; paymentType?: unknown } }).payment
    : null;
  const text = [order.payment_method, payment?.type, payment?.paymentType]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('tr-TR');

  if (text.includes('pay_with_card') || text.includes('online')) return 'online';
  if (text.includes('setcard') || text.includes('edenred') || text.includes('pluxee') || text.includes('meal_card') || text.includes('yemek kart')) return 'meal_card';
  if (text.includes('cash') || text.includes('nakit')) return 'cash';
  if (text.includes('card') || text.includes('kredi kart')) return 'card';
  return 'other';
}

function isOnlineInvoicePayment(order: {
  source: string | null;
  payment_method: string | null;
  external_payload: unknown;
}) {
  return ['web', 'trendyol', 'yemeksepeti'].includes(String(order.source)) &&
    paymentCategory(order) === 'online';
}

export async function GET(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, error: "Fatura önizleme yetkiniz bulunmuyor." }, { status: 403 });
  }

  const source = request.nextUrl.searchParams.get("source") || "all";
  const payment = request.nextUrl.searchParams.get("payment") || "all";
  const from = request.nextUrl.searchParams.get("from");
  const until = request.nextUrl.searchParams.get("until");
  const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;

  if (!["all", "web", "trendyol", "yemeksepeti"].includes(source)) {
    return NextResponse.json({ ok: false, error: "Geçersiz sipariş kanalı." }, { status: 400 });
  }
  if (!["all", "online", "card", "cash", "meal_card"].includes(payment)) {
    return NextResponse.json({ ok: false, error: "Geçersiz ödeme türü." }, { status: 400 });
  }
  if ((from && !datePattern.test(from)) || (until && !datePattern.test(until))) {
    return NextResponse.json({ ok: false, error: "Tarih YYYY-AA-GG formatında olmalı." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("pos_orders")
    .select("id,receipt_number,customer_name,total,source,payment_method,external_payload,created_at,closed_at,invoice_status")
    .eq("status", "closed")
    .neq("invoice_status", "sent")
    .order("closed_at", { ascending: true });

  query = source === "all"
    ? query.in("source", ["web", "trendyol", "yemeksepeti"])
    : query.eq("source", source);

  if (from) {
    query = query.gte("closed_at", new Date(`${from}T00:00:00+03:00`).toISOString());
  }
  if (until) {
    const end = new Date(`${until}T00:00:00+03:00`);
    end.setDate(end.getDate() + 1);
    query = query.lt("closed_at", end.toISOString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const candidates = (data ?? [])
    .filter((order) => payment === "all" || paymentCategory(order) === payment)
    .map((order) => ({
      id: order.id,
      receiptNumber: order.receipt_number,
      customerName: order.customer_name || "Nihai Tüketici",
      source: order.source,
      paymentMethod: order.payment_method,
      paymentKind: paymentCategory(order),
      invoiceEligible: isOnlineInvoicePayment(order),
      total: Number(order.total || 0),
      closedAt: order.closed_at || order.created_at,
      invoiceStatus: order.invoice_status || "none",
    }));
  return NextResponse.json({
    ok: true,
    sendToLuca: false,
    count: candidates.length,
    grossTotal: candidates.reduce((sum, order) => sum + order.total, 0),
    candidates,
  });
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, error: "Fatura önizleme yetkiniz bulunmuyor." }, { status: 403 });
  }
  const body = (await request.json()) as { orderId?: number };
  if (!body.orderId) return NextResponse.json({ ok: false, error: "Sipariş numarası zorunlu." }, { status: 400 });

  const { data: order, error } = await supabaseAdmin
    .from("pos_orders")
    .select("id,receipt_number,customer_name,customer_phone,delivery_address,total,status,source,payment_method,external_payload,invoice_status")
    .eq("id", body.orderId)
    .single();
  if (error || !order) return NextResponse.json({ ok: false, error: "Sipariş bulunamadı." }, { status: 404 });
  if (order.status !== "closed" || !isOnlineInvoicePayment(order)) {
    return NextResponse.json({ ok: false, error: "Bu sipariş online tahsilatlı kapanmış pazar yeri siparişi değil." }, { status: 409 });
  }
  const { data: lines, error: linesError } = await supabaseAdmin
    .from("pos_order_items")
    .select("product_name,quantity,line_total")
    .eq("order_id", order.id)
    .order("id");
  if (linesError) return NextResponse.json({ ok: false, error: linesError.message }, { status: 500 });

  const draft = buildLucaArchiveInvoiceDraft(order, lines ?? []);
  return NextResponse.json({
    ok: true,
    sendToLuca: false,
    order: { id: order.id, receiptNumber: order.receipt_number, total: Number(order.total || 0) },
    draft,
  });
}
