"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Channel = "yemeksepeti" | "trendyol";

type DailySummary = {
  business_date: string;
  channel: Channel;
  order_count: number;
  gross_sales: number;
  order_discount: number;
  commission_amount: number;
  service_fee_amount: number;
  delivery_fee_amount: number;
  campaign_discount_amount: number;
  platform_discount_amount: number;
  restaurant_discount_amount: number;
  withholding_amount: number;
  other_deduction_amount: number;
  expected_net_amount: number;
};

type ChannelInvoice = {
  id: number;
  channel: Channel;
  invoice_direction: "issued_to_platform" | "received_from_platform";
  invoice_type: string;
  invoice_no: string | null;
  invoice_date: string;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  status: string;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const CHANNEL_LABELS: Record<Channel, string> = {
  yemeksepeti: "Yemeksepeti",
  trendyol: "Trendyol Yemek / GO",
};

function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function ChannelFinancePage() {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [invoices, setInvoices] = useState<ChannelInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [summaryResult, invoiceResult] = await Promise.all([
      supabase
        .from("channel_daily_finance_summary")
        .select("*")
        .eq("business_date", date),
      supabase
        .from("channel_invoices")
        .select(
          "id,channel,invoice_direction,invoice_type,invoice_no,invoice_date,taxable_amount,vat_rate,vat_amount,total_amount,status"
        )
        .eq("invoice_date", date)
        .order("created_at", { ascending: false }),
    ]);

    const error = summaryResult.error || invoiceResult.error;

    if (error) {
      alert(`Kanal finans verileri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setSummaries((summaryResult.data ?? []) as DailySummary[]);
    setInvoices((invoiceResult.data ?? []) as ChannelInvoice[]);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totals = useMemo(
    () =>
      summaries.reduce(
        (result, row) => {
          result.orders += Number(row.order_count || 0);
          result.gross += Number(row.gross_sales || 0);
          result.commission += Number(row.commission_amount || 0);
          result.fees +=
            Number(row.service_fee_amount || 0) +
            Number(row.delivery_fee_amount || 0);
          result.discounts += Number(row.restaurant_discount_amount || 0);
          result.withholding += Number(row.withholding_amount || 0);
          result.other += Number(row.other_deduction_amount || 0);
          result.net += Number(row.expected_net_amount || 0);
          return result;
        },
        {
          orders: 0,
          gross: 0,
          commission: 0,
          fees: 0,
          discounts: 0,
          withholding: 0,
          other: 0,
          net: 0,
        }
      ),
    [summaries]
  );

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Kanal Finans ve Fatura Detayı
            </h1>
            <p className="mt-1 text-sm opacity-50">
              Yemeksepeti ve Trendyol gün sonu mutabakatı
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/pos/integrations" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
              Entegrasyonlar
            </a>
            <a href="/pos/report" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
              Gün Sonu
            </a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">
              POS&apos;a Dön
            </a>
          </div>
        </header>

        <section className="mb-5 rounded-3xl border bg-white p-4">
          <label className="block text-sm font-semibold">
            Gün sonu tarihi
          </label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 rounded-xl border px-4 py-3"
          />
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center">
            Kanal finans verileri yükleniyor...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              <Card label="Sipariş" value={String(totals.orders)} />
              <Card label="Brüt Satış" value={`${money(totals.gross)} ₺`} />
              <Card label="Komisyon" value={`${money(totals.commission)} ₺`} />
              <Card label="Hizmet/Kurye" value={`${money(totals.fees)} ₺`} />
              <Card label="Restoran İndirimi" value={`${money(totals.discounts)} ₺`} />
              <Card label="Tevkifat/Kesinti" value={`${money(totals.withholding)} ₺`} />
              <Card label="Diğer Kesinti" value={`${money(totals.other)} ₺`} />
              <Card label="Beklenen Net" value={`${money(totals.net)} ₺`} />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2">
              {(["yemeksepeti", "trendyol"] as Channel[]).map(
                (channel) => {
                  const row = summaries.find(
                    (item) => item.channel === channel
                  );

                  return (
                    <div key={channel} className="rounded-3xl border bg-white p-5">
                      <h2
                        className="text-xl font-bold text-[#6e1f12]"
                        style={{ fontFamily: BRAND_FONT }}
                      >
                        {CHANNEL_LABELS[channel]}
                      </h2>

                      {!row ? (
                        <p className="mt-4 rounded-xl bg-[#f4efe5] p-5 text-center text-sm opacity-50">
                          Bu tarihte kayıt yok.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          <Row label="Sipariş" value={String(row.order_count)} />
                          <Row label="Brüt satış" value={`${money(row.gross_sales)} ₺`} />
                          <Row label="Sipariş indirimi" value={`${money(row.order_discount)} ₺`} />
                          <Row label="Komisyon" value={`-${money(row.commission_amount)} ₺`} />
                          <Row label="Hizmet bedeli" value={`-${money(row.service_fee_amount)} ₺`} />
                          <Row label="Kurye bedeli" value={`-${money(row.delivery_fee_amount)} ₺`} />
                          <Row label="Kampanya indirimi" value={`-${money(row.campaign_discount_amount)} ₺`} />
                          <Row label="Platform indirimi" value={`${money(row.platform_discount_amount)} ₺`} />
                          <Row label="Restoran indirimi" value={`-${money(row.restaurant_discount_amount)} ₺`} />
                          <Row label="Tevkifat / vergi kesintisi" value={`-${money(row.withholding_amount)} ₺`} />
                          <Row label="Diğer kesintiler" value={`-${money(row.other_deduction_amount)} ₺`} />
                          <Row label="Beklenen net ödeme" value={`${money(row.expected_net_amount)} ₺`} strong />
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border bg-white">
              <div className="border-b px-5 py-4">
                <h2
                  className="text-xl font-bold text-[#6e1f12]"
                  style={{ fontFamily: BRAND_FONT }}
                >
                  Günün Fatura Kayıtları
                </h2>
              </div>

              {invoices.length === 0 ? (
                <p className="p-8 text-center opacity-50">
                  Bu tarihte fatura kaydı yok.
                </p>
              ) : (
                <div className="divide-y">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-semibold">
                          {CHANNEL_LABELS[invoice.channel]}
                        </p>
                        <p className="mt-1 text-xs opacity-50">
                          {invoice.invoice_direction === "issued_to_platform"
                            ? "Platforma kesilen"
                            : "Platformdan gelen"}
                        </p>
                      </div>

                      <p>{invoice.invoice_no || "Taslak"}</p>

                      <p>
                        Matrah {money(invoice.taxable_amount)} ₺
                        {" · "}
                        KDV %{invoice.vat_rate}
                      </p>

                      <p className="font-bold">
                        {money(invoice.total_amount)} ₺
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="mt-5 rounded-2xl border border-amber-700/20 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Fatura yönü, KDV oranı, komisyon, kampanya katkısı ve
              kesintiler platform sözleşmesi ile mali müşavir
              kayıtlarına göre kesinleştirilmelidir. Sistem hem
              platforma kesilen hem platformdan gelen faturaları
              ayrı tutacak şekilde hazırlandı.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">{label}</p>
      <p className="mt-2 text-lg font-bold text-[#6e1f12]">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 rounded-xl px-3 py-2 ${
        strong ? "bg-[#f4efe5] font-bold" : "bg-black/[0.025]"
      }`}
    >
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}