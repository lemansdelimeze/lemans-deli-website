import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { parsePrintDocument, staffForPrint, workerAuthorized } from "../../../../lib/pos/printJobs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await staffForPrint(request);
  if (!auth.userId) {
    const message = auth.reason === "staff_not_allowed" ? "POS kullanıcısı yazdırmaya yetkili değil."
      : auth.reason === "staff_lookup_failed" ? "POS yetkisi kontrol edilemedi."
      : "POS oturumu sunucuda doğrulanamadı.";
    return NextResponse.json({ error: message, code: auth.reason }, { status: auth.reason === "staff_lookup_failed" ? 503 : 401 });
  }
  if (!process.env.POS_PRINT_WORKER_TOKEN || process.env.POS_PRINT_WORKER_TOKEN.length < 32) {
    return NextResponse.json({ error: "Ana bilgisayar yazıcısı henüz kurulmadı." }, { status: 503 });
  }
  let input: unknown;
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Adisyon okunamadı." }, { status: 400 });
  }
  const document = parsePrintDocument(input);
  if (!document) return NextResponse.json({ error: "Adisyon bilgileri eksik." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("pos_print_jobs")
    .insert({ created_by: auth.userId, receipt_number: document.receiptNumber, document })
    .select("id").single();
  if (error) {
    console.error("POS print queue insert:", error.message);
    return NextResponse.json({ error: "Yazdırma kuyruğuna eklenemedi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, jobId: data.id, status: "queued" }, { status: 201 });
}

export async function GET(request: NextRequest) {
  if (!workerAuthorized(request)) return NextResponse.json({ error: "Yetkisiz yazıcı." }, { status: 401 });
  const workerId = request.nextUrl.searchParams.get("workerId")?.slice(0, 80) || "windows-pos";
  const { data, error } = await supabaseAdmin.rpc("claim_pos_print_job", { p_worker_id: workerId });
  if (error) {
    console.error("POS print queue claim:", error.message);
    return NextResponse.json({ error: "Kuyruk okunamadı." }, { status: 500 });
  }
  const job = data?.[0];
  return NextResponse.json(job ? {
    job: { id: job.id, leaseToken: job.lease_token, document: job.document },
  } : { job: null }, { headers: { "Cache-Control": "no-store" } });
}
