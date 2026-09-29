import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { workerAuthorized } from "../../../../../../lib/pos/printJobs";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!workerAuthorized(request)) return NextResponse.json({ error: "Yetkisiz yazıcı." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Geçersiz iş." }, { status: 400 });
  let input: { leaseToken?: string; ok?: boolean; error?: string };
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Geçersiz sonuç." }, { status: 400 });
  }
  if (!input.leaseToken || typeof input.ok !== "boolean") {
    return NextResponse.json({ error: "Eksik sonuç." }, { status: 400 });
  }
  const { data: job, error: lookupError } = await supabaseAdmin.from("pos_print_jobs")
    .select("id,attempts").eq("id", id).eq("lease_token", input.leaseToken)
    .eq("status", "printing").maybeSingle();
  if (lookupError || !job) return NextResponse.json({ error: "İş artık geçerli değil." }, { status: 409 });
  const status = input.ok ? "done" : job.attempts < 3 ? "pending" : "failed";
  const { data, error } = await supabaseAdmin.from("pos_print_jobs")
    .update({ status, finished_at: input.ok ? new Date().toISOString() : null,
      last_error: input.ok ? null : String(input.error || "Yazıcı hatası").slice(0, 500),
      lease_token: null, leased_until: null })
    .eq("id", id).eq("lease_token", input.leaseToken).eq("status", "printing")
    .select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Sonuç kaydedilemedi." }, { status: 409 });
  return NextResponse.json({ ok: true, status });
}
