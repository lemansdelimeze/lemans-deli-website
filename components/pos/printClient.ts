import { supabase } from "../../lib/supabase";

export type PrintDocumentInput = {
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

export async function queuePosPrint(document: PrintDocumentInput) {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }
  if (!session) throw new Error("POS uygulamasında oturum okunamadı. Çıkış yapıp yeniden giriş yapın.");
  const send = (token: string) => fetch("/api/pos/print-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(document),
  });
  let response = await send(session.access_token);
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session) response = await send(refreshed.data.session.access_token);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Yazıcıya gönderilemedi.");
  return body.jobId as string;
}
