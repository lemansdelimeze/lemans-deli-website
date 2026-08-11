"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type PaymentMethod = "cash" | "card" | "meal_card" | "mixed" | "internal" | "pending";
type DateFilter = "today" | "yesterday" | "sevenDays" | "all";
type PaymentFilter = "all" | "cash" | "card" | "meal_card" | "mixed" | "internal";

type PosOrder = {
  id: number;
  receipt_number: string;
  order_type: string;
  table_id: number | null;
  customer_name: string | null;
  order_note: string | null;
  subtotal: number;
  discount_amount: number | null;
  total: number;
  payment_method: PaymentMethod;
  cash_amount: number;
  card_amount: number;
  meal_card_amount: number;
  internal_reason: string | null;
  created_at: string;
  closed_at: string | null;
};

type PosOrderItem = {
  id: number;
  order_id: number;
  product_name: string;
  quantity: number;
  portion_type: string | null;
  portion_label: string | null;
  unit_price: number;
  line_total: number;
};

type PosTable = { id: number; name: string };

const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Nakit",
  card: "Kredi Kartı",
  meal_card: "Yemek Kartı",
  mixed: "Karma",
  internal: "İkram / İç Tüketim",
  pending: "Bekliyor",
};

function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeFor(filter: DateFilter) {
  const now = new Date();
  if (filter === "all") return null;
  if (filter === "today") {
    return {
      start: startOfDay(now),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    };
  }
  if (filter === "yesterday") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      end: startOfDay(now),
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  };
}

export default function PosOrdersPage() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PosOrder | null>(null);
  const [selectedItems, setSelectedItems] = useState<PosOrderItem[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("pos_orders")
      .select(`
        id, receipt_number, order_type, table_id, customer_name, order_note,
        subtotal, discount_amount, total, payment_method,
        cash_amount, card_amount, meal_card_amount,
        internal_reason, created_at, closed_at
      `)
      .eq("status", "closed")
      .order("closed_at", { ascending: false });

    const range = rangeFor(dateFilter);
    if (range) {
      query = query
        .gte("closed_at", range.start.toISOString())
        .lt("closed_at", range.end.toISOString());
    }
    if (paymentFilter !== "all") {
      query = query.eq("payment_method", paymentFilter);
    }

    const [ordersResult, tablesResult] = await Promise.all([
      query,
      supabase.from("pos_tables").select("id, name").order("sort_order"),
    ]);

    if (ordersResult.error) {
      alert(`Adisyonlar yüklenemedi: ${ordersResult.error.message}`);
      setLoading(false);
      return;
    }

    setOrders((ordersResult.data ?? []) as PosOrder[]);
    setTables((tablesResult.data ?? []) as PosTable[]);
    setLoading(false);
  }, [dateFilter, paymentFilter]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const tableName = useCallback(
    (order: PosOrder) => {
      if (order.order_type !== "Masa") return order.order_type;
      return tables.find((table) => table.id === order.table_id)?.name ?? "Masa";
    },
    [tables]
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    if (!term) return orders;
    return orders.filter((order) =>
      [
        order.receipt_number,
        order.customer_name ?? "",
        order.order_type,
        tableName(order),
        PAYMENT_LABELS[order.payment_method] ?? order.payment_method,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(term)
    );
  }, [orders, search, tableName]);

  const summary = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.count += 1;
        acc.discount += Number(order.discount_amount || 0);
        acc.cash += Number(order.cash_amount || 0);
        acc.card += Number(order.card_amount || 0);
        acc.mealCard += Number(order.meal_card_amount || 0);
        if (order.payment_method === "internal") {
          acc.internal += Number(order.total || 0);
        } else {
          acc.revenue += Number(order.total || 0);
        }
        return acc;
      },
      { count: 0, revenue: 0, discount: 0, cash: 0, card: 0, mealCard: 0, internal: 0 }
    );
  }, [filteredOrders]);

  async function openOrder(order: PosOrder) {
    setSelectedOrder(order);
    setSelectedItems([]);
    setDetailLoading(true);
    const { data, error } = await supabase
      .from("pos_order_items")
      .select("id, order_id, product_name, quantity, portion_type, portion_label, unit_price, line_total")
      .eq("order_id", order.id)
      .order("id");

    if (error) {
      alert(`Ürünler yüklenemedi: ${error.message}`);
      setDetailLoading(false);
      return;
    }

    setSelectedItems((data ?? []) as PosOrderItem[]);
    setDetailLoading(false);
  }

  function printSelected() {
    if (!selectedOrder || selectedItems.length === 0) return;
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <>
      <style jsx global>{`
        @page { size: 58mm auto; margin: 0; }
        @media print {
          html, body { width: 58mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          #order-reprint, #order-reprint * { visibility: visible !important; box-sizing: border-box !important; }
          #order-reprint { position: absolute !important; top: 0 !important; left: 0 !important; width: 48mm !important; padding: 1.5mm !important; background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
        <div className="no-print mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Kapanan Adisyonlar</h1>
              <p className="mt-1 text-sm opacity-50">Ödeme geçmişi, indirimler ve tekrar yazdırma</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void loadOrders()} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Yenile</button>
              <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">POS&apos;a Dön</a>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Summary label="Adisyon" value={String(summary.count)} />
            <Summary label="Net Ciro" value={`${money(summary.revenue)} ₺`} />
            <Summary label="Nakit" value={`${money(summary.cash)} ₺`} />
            <Summary label="Kredi Kartı" value={`${money(summary.card)} ₺`} />
            <Summary label="Yemek Kartı" value={`${money(summary.mealCard)} ₺`} />
            <Summary label="İkram / İç Tüketim" value={`${money(summary.internal)} ₺`} />
          </section>

          <section className="mb-5 rounded-3xl border border-[#6e1f12]/10 bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Adisyon no, müşteri, masa..." className="rounded-xl border px-4 py-3" />
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className="rounded-xl border bg-white px-4 py-3">
                <option value="today">Bugün</option>
                <option value="yesterday">Dün</option>
                <option value="sevenDays">Son 7 Gün</option>
                <option value="all">Tümü</option>
              </select>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)} className="rounded-xl border bg-white px-4 py-3">
                <option value="all">Tüm Ödemeler</option>
                <option value="cash">Nakit</option>
                <option value="card">Kredi Kartı</option>
                <option value="meal_card">Yemek Kartı</option>
                <option value="mixed">Karma</option>
                <option value="internal">İkram / İç Tüketim</option>
              </select>
            </div>
            {summary.discount > 0 && <p className="mt-3 text-sm text-[#6e1f12]">Toplam indirim: <strong>{money(summary.discount)} ₺</strong></p>}
          </section>

          <section className="overflow-hidden rounded-3xl border border-[#6e1f12]/10 bg-white">
            {loading ? (
              <p className="p-8 text-center">Adisyonlar yükleniyor...</p>
            ) : filteredOrders.length === 0 ? (
              <p className="p-8 text-center opacity-50">Bu filtrelerde kapanan adisyon yok.</p>
            ) : (
              <div className="divide-y divide-black/8">
                {filteredOrders.map((order) => (
                  <button key={order.id} type="button" onClick={() => void openOrder(order)} className="grid w-full gap-3 px-5 py-4 text-left hover:bg-[#f4efe5]/60 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                    <div>
                      <p className="font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>{order.receipt_number}</p>
                      <p className="mt-1 text-xs opacity-45">{new Date(order.closed_at ?? order.created_at).toLocaleString("tr-TR")}</p>
                    </div>
                    <div>
                      <p className="font-semibold">{tableName(order)}</p>
                      {order.customer_name && <p className="mt-1 text-xs opacity-50">{order.customer_name}</p>}
                    </div>
                    <div>
                      <p className="font-semibold">{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</p>
                      {order.internal_reason && <p className="mt-1 text-xs opacity-50">{order.internal_reason}</p>}
                    </div>
                    <div className="md:text-right">
                      <p className="text-lg font-bold">{money(order.total)} ₺</p>
                      {Number(order.discount_amount) > 0 && <p className="text-xs text-[#6e1f12]">-{money(order.discount_amount)} ₺ indirim</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {selectedOrder && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-5">
            <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>{selectedOrder.receipt_number}</h2>
                  <p className="mt-1 text-sm opacity-50">{tableName(selectedOrder)} · {new Date(selectedOrder.closed_at ?? selectedOrder.created_at).toLocaleString("tr-TR")}</p>
                </div>
                <button type="button" onClick={() => setSelectedOrder(null)} className="h-10 w-10 rounded-full border">×</button>
              </div>

              {detailLoading ? (
                <p className="py-10 text-center">Ürünler yükleniyor...</p>
              ) : (
                <>
                  <div className="mt-5 space-y-3">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border p-3">
                        <div>
                          <p className="font-semibold">{Number(item.quantity) > 1 ? `${item.quantity} × ` : ""}{item.portion_type === "half" ? "½ " : ""}{item.product_name}</p>
                          {item.portion_label && <p className="mt-1 text-xs opacity-50">{item.portion_label}</p>}
                        </div>
                        <p className="shrink-0 font-bold">{money(item.line_total)} ₺</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-2 rounded-2xl bg-[#f4efe5] p-4">
                    <div className="flex justify-between"><span>Ara toplam</span><span>{money(selectedOrder.subtotal)} ₺</span></div>
                    {Number(selectedOrder.discount_amount) > 0 && <div className="flex justify-between text-[#6e1f12]"><span>İndirim</span><span>-{money(selectedOrder.discount_amount)} ₺</span></div>}
                    <div className="flex justify-between border-t pt-2 text-xl font-bold"><span>Toplam</span><span>{money(selectedOrder.total)} ₺</span></div>
                    <div className="flex justify-between text-sm"><span>Ödeme</span><span>{PAYMENT_LABELS[selectedOrder.payment_method] ?? selectedOrder.payment_method}</span></div>
                  </div>

                  {selectedOrder.order_note && <div className="mt-4 rounded-xl border p-4"><p className="text-xs font-bold uppercase opacity-50">Not</p><p className="mt-2 whitespace-pre-wrap">{selectedOrder.order_note}</p></div>}

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-xl border px-4 py-3">Kapat</button>
                    <button type="button" onClick={printSelected} disabled={selectedItems.length === 0} className="rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40">Tekrar Yazdır</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <section id="order-reprint" className="mx-auto hidden w-[48mm] bg-white px-[1.5mm] py-[2mm] font-mono text-black print:block">
          {selectedOrder && (
            <>
              <div className="text-center"><img src="/logo-pos.png" alt="Leman's Deli" className="mx-auto w-[42mm] object-contain" /></div>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="space-y-0.5 text-[9px] leading-[1.35]">
                <p>Adisyon No: {selectedOrder.receipt_number}</p>
                <p>Tarih: {new Date(selectedOrder.closed_at ?? selectedOrder.created_at).toLocaleString("tr-TR")}</p>
                <p>Sipariş: {tableName(selectedOrder)}</p>
              </div>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="space-y-2 text-[10px] font-semibold leading-[1.3]">
                {selectedItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-1.5">
                    <span className="min-w-0 break-words pr-1">{Number(item.quantity) > 1 ? `${item.quantity} x ` : ""}{item.portion_type === "half" ? "½ " : ""}{item.product_name}{item.portion_label ? ` (${item.portion_label})` : ""}</span>
                    <span className="whitespace-nowrap text-right">{money(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="space-y-1 text-[9px]">
                <div className="grid grid-cols-[1fr_auto]"><span>Ara toplam</span><span>{money(selectedOrder.subtotal)} ₺</span></div>
                {Number(selectedOrder.discount_amount) > 0 && <div className="grid grid-cols-[1fr_auto]"><span>İndirim</span><span>-{money(selectedOrder.discount_amount)} ₺</span></div>}
              </div>
              <div className="mt-1 grid grid-cols-[1fr_auto] text-[15px] font-bold"><span>TOPLAM</span><span>{money(selectedOrder.total)} ₺</span></div>
              <p className="mt-2 text-[9px] font-bold">Ödeme: {PAYMENT_LABELS[selectedOrder.payment_method] ?? selectedOrder.payment_method}</p>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="text-center text-[9px] font-bold leading-[1.45]"><p>BU BELGE MALİ DEĞERİ OLMAYAN</p><p>BİLGİLENDİRME AMAÇLI ADİSYONDUR.</p></div>
              <div className="mt-3 text-center text-[9px]"><p>Tekrar baskıdır.</p><p>@lemansdeli · Kaş</p></div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#6e1f12]/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p>
    </div>
  );
}