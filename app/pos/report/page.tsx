"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type PosOrder = {
  id: number;
  receipt_number: string;
  order_type: string;
  subtotal: number;
  discount_amount: number | null;
  total: number;
  payment_method: string;
  cash_amount: number;
  card_amount: number;
  meal_card_amount: number;
  internal_reason: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
};

type PosOrderItem = {
  id: number;
  order_id: number;
  product_name: string;
  quantity: number;
  weight_grams: number | null;
  line_total: number;
};

type DateMode = "today" | "yesterday" | "sevenDays" | "custom";

const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';

function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });
}

function dateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getRange(mode: DateMode, startText: string, endText: string) {
  const now = new Date();

  if (mode === "today") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    };
  }

  if (mode === "yesterday") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }

  if (mode === "sevenDays") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
    };
  }

  const start = new Date(`${startText}T00:00:00`);
  const end = new Date(`${endText}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default function PosReportPage() {
  const today = new Date();
  const [mode, setMode] = useState<DateMode>("today");
  const [customStart, setCustomStart] = useState(dateInput(today));
  const [customEnd, setCustomEnd] = useState(dateInput(today));
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [items, setItems] = useState<PosOrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    const range = getRange(mode, customStart, customEnd);

    const { data: orderData, error: orderError } = await supabase
      .from("pos_orders")
      .select(`
        id,
        receipt_number,
        order_type,
        subtotal,
        discount_amount,
        total,
        payment_method,
        cash_amount,
        card_amount,
        meal_card_amount,
        internal_reason,
        status,
        created_at,
        closed_at
      `)
      .eq("status", "closed")
      .gte("closed_at", range.start.toISOString())
      .lt("closed_at", range.end.toISOString())
      .order("closed_at", { ascending: false });

    if (orderError) {
      alert(`Rapor yüklenemedi: ${orderError.message}`);
      setLoading(false);
      return;
    }

    const loadedOrders = (orderData ?? []) as PosOrder[];
    setOrders(loadedOrders);

    if (loadedOrders.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("pos_order_items")
      .select("id, order_id, product_name, quantity, weight_grams, line_total")
      .in("order_id", loadedOrders.map((order) => order.id));

    if (itemError) {
      alert(`Ürün raporu yüklenemedi: ${itemError.message}`);
      setLoading(false);
      return;
    }

    setItems((itemData ?? []) as PosOrderItem[]);
    setLoading(false);
  }, [mode, customStart, customEnd]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const summary = useMemo(() => {
    return orders.reduce(
      (result, order) => {
        const total = Number(order.total || 0);
        result.count += 1;
        result.gross += Number(order.subtotal || 0);
        result.discount += Number(order.discount_amount || 0);
        result.cash += Number(order.cash_amount || 0);
        result.card += Number(order.card_amount || 0);
        result.mealCard += Number(order.meal_card_amount || 0);

        if (order.payment_method === "internal") {
          result.internal += total;
          const reason = order.internal_reason || "Diğer";
          result.internalReasons[reason] = (result.internalReasons[reason] || 0) + total;
        } else {
          result.net += total;
        }

        result.orderTypes[order.order_type] =
          (result.orderTypes[order.order_type] || 0) + 1;

        return result;
      },
      {
        count: 0,
        gross: 0,
        discount: 0,
        net: 0,
        cash: 0,
        card: 0,
        mealCard: 0,
        internal: 0,
        internalReasons: {} as Record<string, number>,
        orderTypes: {} as Record<string, number>,
      }
    );
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; grams: number; revenue: number }>();

    items.forEach((item) => {
      const current = map.get(item.product_name) ?? {
        name: item.product_name,
        quantity: 0,
        grams: 0,
        revenue: 0,
      };
      current.quantity += Number(item.quantity || 0);
      current.grams += Number(item.weight_grams || 0);
      current.revenue += Number(item.line_total || 0);
      map.set(item.product_name, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [items]);

  const average = summary.count > 0 ? summary.net / summary.count : 0;

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
              Gün Sonu ve Satış Raporu
            </h1>
            <p className="mt-1 text-sm opacity-50">Ciro, ödeme dağılımı, indirim ve ürün performansı</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/pos/orders" className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold">
              Kapanan Adisyonlar
            </a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">
              POS&apos;a Dön
            </a>
          </div>
        </header>

        <section className="mb-5 rounded-3xl border border-[#6e1f12]/10 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <select value={mode} onChange={(e) => setMode(e.target.value as DateMode)} className="rounded-xl border border-black/15 bg-white px-4 py-3">
              <option value="today">Bugün</option>
              <option value="yesterday">Dün</option>
              <option value="sevenDays">Son 7 Gün</option>
              <option value="custom">Özel Tarih</option>
            </select>

            {mode === "custom" && (
              <>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-xl border border-black/15 px-4 py-3" />
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-xl border border-black/15 px-4 py-3" />
              </>
            )}

            <button type="button" onClick={() => void loadReport()} className="rounded-xl border border-black/10 px-4 py-3 font-semibold">
              Yenile
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center">Rapor hazırlanıyor...</div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Card label="Adisyon" value={String(summary.count)} />
              <Card label="Brüt Satış" value={`${money(summary.gross)} ₺`} />
              <Card label="İndirim" value={`${money(summary.discount)} ₺`} />
              <Card label="Net Ciro" value={`${money(summary.net)} ₺`} />
              <Card label="Ortalama Adisyon" value={`${money(average)} ₺`} />
              <Card label="İkram / İç Tüketim" value={`${money(summary.internal)} ₺`} />
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-3">
              <Panel title="Ödeme Dağılımı">
                <Row label="Nakit" value={`${money(summary.cash)} ₺`} />
                <Row label="Kredi Kartı" value={`${money(summary.card)} ₺`} />
                <Row label="Yemek Kartı" value={`${money(summary.mealCard)} ₺`} />
                <Row label="Toplam Tahsilat" value={`${money(summary.cash + summary.card + summary.mealCard)} ₺`} strong />
              </Panel>

              <Panel title="Sipariş Türleri">
                {Object.entries(summary.orderTypes).length === 0 ? (
                  <Empty />
                ) : (
                  Object.entries(summary.orderTypes).map(([key, value]) => (
                    <Row key={key} label={key} value={`${value} adisyon`} />
                  ))
                )}
              </Panel>

              <Panel title="İkram / İç Tüketim">
                {Object.entries(summary.internalReasons).length === 0 ? (
                  <Empty />
                ) : (
                  Object.entries(summary.internalReasons).map(([key, value]) => (
                    <Row key={key} label={key} value={`${money(value)} ₺`} />
                  ))
                )}
              </Panel>
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border border-[#6e1f12]/10 bg-white">
              <div className="border-b border-black/8 px-5 py-4">
                <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
                  En Çok Satan Ürünler
                </h2>
              </div>

              {topProducts.length === 0 ? (
                <p className="p-8 text-center opacity-50">Bu tarih aralığında ürün satışı yok.</p>
              ) : (
                <div className="divide-y divide-black/8">
                  {topProducts.map((product, index) => (
                    <div key={product.name} className="grid gap-3 px-5 py-4 md:grid-cols-[60px_1fr_auto_auto] md:items-center">
                      <p className="text-lg font-bold text-[#6e1f12]">#{index + 1}</p>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm opacity-60">
                        {product.grams > 0 ? `${money(product.grams)} gr` : `${money(product.quantity)} adet/porsiyon`}
                      </p>
                      <p className="font-bold">{money(product.revenue)} ₺</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#6e1f12]/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5">
      <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
        {title}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 ${strong ? "bg-[#f4efe5] font-bold" : "bg-black/[0.025]"}`}>
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Empty() {
  return <p className="rounded-xl bg-black/[0.025] px-4 py-5 text-center text-sm opacity-45">Bu tarih aralığında veri yok.</p>;
}