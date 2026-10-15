import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  MealCardInvoiceSendError,
  sendMealCardInvoice,
} from "../../../../../lib/integrations/luca/mealCardInvoice";

export const runtime = "nodejs";

const PROVIDERS = ["edenred", "setcard", "pluxee"] as const;
type Provider = (typeof PROVIDERS)[number];

function requestClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authorizedUser(request: NextRequest) {
  const client = requestClient(request);
  if (!client) return null;
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  const { data: staff } = await supabaseAdmin
    .from("staff_profiles")
    .select("role,active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!staff?.active || !["admin", "owner"].includes(String(staff.role))) return null;
  return data.user;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function GET(request: NextRequest) {
  const user = await authorizedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Fatura ekranı için yönetici yetkisi gerekiyor." }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("meal_card_invoice_records")
    .select("id,provider,request_no,invoice_date,gross_amount,vat_rate,taxable_amount,vat_amount,receiver_name,receiver_tax_code,receiver_alias,receiver_address,receiver_city,receiver_district,receiver_tax_office,member_no,status,invoice_no,invoice_uuid,error_message,created_at,sent_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, records: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await authorizedUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Fatura kesme yetkisi gerekiyor." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const provider = String(body.provider || "") as Provider;
  const requestNo = String(body.requestNo || "").trim();
  const invoiceDate = body.invoiceDate;
  const grossAmount = Number(body.grossAmount);
  const vatRate = Number(body.vatRate);
  const receiverName = String(body.receiverName || "").trim();
  const receiverTaxCode = String(body.receiverTaxCode || "").trim();
  const receiverAlias = String(body.receiverAlias || "").trim();
  const receiverAddress = String(body.receiverAddress || "").trim();
  const receiverCity = String(body.receiverCity || "").trim();
  const receiverDistrict = String(body.receiverDistrict || "").trim();
  const receiverTaxOffice = String(body.receiverTaxOffice || "").trim();
  const memberNo = String(body.memberNo || "").trim();

  if (!PROVIDERS.includes(provider)) return NextResponse.json({ ok: false, error: "Setcard, Edenred veya Pluxee seçin." }, { status: 400 });
  if (!/^[A-Za-z0-9-]{1,50}$/.test(requestNo)) return NextResponse.json({ ok: false, error: "Fatura talep numarası geçersiz." }, { status: 400 });
  if (!validDate(invoiceDate)) return NextResponse.json({ ok: false, error: "Fatura tarihi geçersiz." }, { status: 400 });
  if (!Number.isFinite(grossAmount) || grossAmount <= 0 || grossAmount > 10000000) return NextResponse.json({ ok: false, error: "Toplam tutar geçersiz." }, { status: 400 });
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 20) return NextResponse.json({ ok: false, error: "KDV oranı 0–20 arasında olmalı." }, { status: 400 });
  if (!receiverName || !/^\d{10}$/.test(receiverTaxCode) || !receiverAlias.startsWith("urn:mail:") || !receiverAddress || !receiverCity || !receiverDistrict || !receiverTaxOffice) {
    return NextResponse.json({ ok: false, error: "Alıcı unvanı, 10 haneli VKN, aktif e-Fatura etiketi, adres, il, ilçe ve vergi dairesini kontrol edin." }, { status: 400 });
  }

  const grossCents = Math.round(grossAmount * 100);
  const vatBasisPoints = Math.round(vatRate * 100);
  const taxableCents = Math.round((grossCents * 10000) / (10000 + vatBasisPoints));
  const vatCents = grossCents - taxableCents;
  const externalCode = ("LD-MC-" + provider + "-" + requestNo + "-" + String(invoiceDate).replace(/-/g, ""))
    .replace(/[^A-Za-z0-9-]/g, "-")
    .slice(0, 64);

  const recordValues = {
    provider,
    request_no: requestNo,
    external_code: externalCode,
    invoice_date: invoiceDate,
    gross_amount: grossCents / 100,
    vat_rate: vatRate,
    taxable_amount: taxableCents / 100,
    vat_amount: vatCents / 100,
    receiver_name: receiverName,
    receiver_tax_code: receiverTaxCode,
    receiver_alias: receiverAlias,
    receiver_address: receiverAddress,
    receiver_city: receiverCity,
    receiver_district: receiverDistrict,
    receiver_tax_office: receiverTaxOffice,
    member_no: memberNo || null,
  };

  let row: { id: number } | null = null;
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("meal_card_invoice_records")
    .insert({
      ...recordValues,
      status: "sending",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("meal_card_invoice_records")
        .select("id,status,invoice_no")
        .eq("provider", provider)
        .eq("request_no", requestNo)
        .maybeSingle();
      if (existing?.status === "failed" && !existing.invoice_no) {
        const { data: retried, error: retryError } = await supabaseAdmin
          .from("meal_card_invoice_records")
          .update({ ...recordValues, status: "sending", error_message: null })
          .eq("id", existing.id)
          .eq("status", "failed")
          .select("id")
          .maybeSingle();
        if (retryError) return NextResponse.json({ ok: false, error: retryError.message }, { status: 500 });
        row = retried;
      }
      if (!row) return NextResponse.json({
        ok: false,
        error: "Bu sağlayıcı ve talep numarası daha önce kaydedilmiş. Yeniden kesim engellendi.",
        existing,
      }, { status: 409 });
    } else {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  } else {
    row = inserted;
  }

  if (!row) {
    return NextResponse.json({ ok: false, error: "Fatura kaydı başlatılamadı." }, { status: 500 });
  }

  try {
    const result = await sendMealCardInvoice({
      provider,
      requestNo,
      invoiceDate,
      grossCents,
      netCents: taxableCents,
      vatCents,
      vatRate,
      receiverName,
      receiverTaxCode,
      receiverInboxTag: receiverAlias,
      receiverAddress,
      receiverCity,
      receiverDistrict,
      receiverTaxOffice,
      memberNo,
    });
    const { error: updateError } = await supabaseAdmin
      .from("meal_card_invoice_records")
      .update({
        status: "sent",
        invoice_no: result.invoiceNumber,
        invoice_uuid: result.invoiceUuid || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", row.id);
    if (updateError) {
      return NextResponse.json({
        ok: false,
        status: "unknown",
        error: "LUCA Success döndürdü ancak POS kaydı güncellenemedi. LUCA'dan kontrol edin; tekrar göndermeyin.",
        invoiceNumber: result.invoiceNumber,
      }, { status: 502 });
    }
    return NextResponse.json({ ok: true, status: "sent", invoiceNumber: result.invoiceNumber, invoiceUuid: result.invoiceUuid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LUCA e-Fatura gönderimi başarısız.";
    const status = error instanceof MealCardInvoiceSendError && error.uncertain
      ? "unknown"
      : "failed";
    await supabaseAdmin
      .from("meal_card_invoice_records")
      .update({ status, error_message: message })
      .eq("id", row.id);
    return NextResponse.json({ ok: false, status, error: message }, { status: 502 });
  }
}
