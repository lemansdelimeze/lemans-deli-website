import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "../supabaseAdmin";

export type PrintDocument = {
  receiptNumber: string;
  orderLabel: string;
  orderNote?: string;
  paymentLabel: string;
  subtotal: number;
  discount: number;
  discountLabel: string;
  total: number;
  items: { name: string; quantity: number; lineTotal: number }[];
};

export async function staffForPrint(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) return { userId: null, reason: "token_missing" } as const;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { userId: null, reason: "auth_config_missing" } as const;
  // GoTrue's getUser() without an argument reads its own session storage.
  // Server requests do not have that storage, so pass the bearer token explicitly.
  const requestSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await requestSupabase.auth.getUser(authorization.slice(7));
  if (error || !data.user) {
    let issuerHost = "unreadable";
    try {
      const payload = JSON.parse(Buffer.from(authorization.slice(7).split(".")[1], "base64url").toString("utf8"));
      issuerHost = typeof payload.iss === "string" ? new URL(payload.iss).host : "missing";
    } catch { /* Never log the token or its payload. */ }
    const detail = String(error?.message || "no_user")
      .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[redacted]")
      .slice(0, 180);
    console.error("POS print auth rejected:", {
      code: error?.code || "no_code", status: error?.status || null,
      detail, issuerHost, configuredHost: new URL(url).host,
    });
    return { userId: null, reason: "token_invalid" } as const;
  }
  const { data: staff, error: staffError } = await supabaseAdmin.from("staff_profiles")
    .select("active,role").eq("user_id", data.user.id).maybeSingle();
  if (staffError) return { userId: null, reason: "staff_lookup_failed" } as const;
  if (!staff?.active || !["cashier", "kitchen", "admin", "owner"].includes(staff.role)) {
    return { userId: null, reason: "staff_not_allowed" } as const;
  }
  return { userId: data.user.id, reason: "ok" } as const;
}

export function workerAuthorized(request: NextRequest) {
  const expected = process.env.POS_PRINT_WORKER_TOKEN;
  const received = request.headers.get("authorization")?.replace(/^Bearer /i, "").trim();
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parsePrintDocument(value: unknown): PrintDocument | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Record<string, unknown>;
  const text = (v: unknown, limit: number) => typeof v === "string" ? v.trim().slice(0, limit) : "";
  const amount = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1_000_000 ? v : null;
  const receiptNumber = text(doc.receiptNumber, 80);
  const orderLabel = text(doc.orderLabel, 120);
  const paymentLabel = text(doc.paymentLabel, 120);
  const subtotal = amount(doc.subtotal);
  const discount = amount(doc.discount);
  const total = amount(doc.total);
  if (!receiptNumber || !orderLabel || subtotal === null || discount === null || total === null ||
      !Array.isArray(doc.items) || !doc.items.length || doc.items.length > 100) return null;
  const items = doc.items.map((value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const name = text(item.name, 200);
    const quantity = amount(item.quantity);
    const lineTotal = amount(item.lineTotal);
    return name && quantity && quantity <= 1000 && lineTotal !== null ? { name, quantity, lineTotal } : null;
  });
  if (items.some((item) => !item)) return null;
  return { receiptNumber, orderLabel, paymentLabel, subtotal, discount,
    orderNote: text(doc.orderNote, 500),
    discountLabel: text(doc.discountLabel, 100), total,
    items: items as PrintDocument["items"] };
}
