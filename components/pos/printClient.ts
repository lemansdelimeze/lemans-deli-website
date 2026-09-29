import { supabase } from "../../lib/supabase";

export type PrintDocumentInput = {
  receiptNumber: string;
  orderLabel: string;
  paymentLabel: string;
  subtotal: number;
  discount: number;
  discountLabel: string;
  total: number;
  items: { name: string; quantity: number; lineTotal: number }[];
};

export async function queuePosPrint(document: PrintDocumentInput) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("POS oturumu bulunamadı.");
  const response = await fetch("/api/pos/print-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(document),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Yazıcıya gönderilemedi.");
  return body.jobId as string;
}
