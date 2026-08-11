"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type StockItem = {
  id: number;
  name: string;
  unit: string;
  current_quantity: number;
  cost_per_unit: number;
};

type WasteRecord = {
  id: number;
  stock_item_id: number;
  reason: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  total_cost: number;
  note: string | null;
  created_at: string;
};

type WasteReason =
  | "fire"
  | "bozulma"
  | "son_kullanma"
  | "personel"
  | "tadim"
  | "ikram"
  | "diger";

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const REASON_LABELS: Record<WasteReason, string> = {
  fire: "Fire",
  bozulma: "Bozulma",
  son_kullanma: "Son Kullanma",
  personel: "Personel Tüketimi",
  tadim: "Tadım",
  ikram: "İkram",
  diger: "Diğer",
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function WastePage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<number | null>(null);
  const [reason, setReason] = useState<WasteReason>("fire");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("gr");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [stockResult, recordsResult] = await Promise.all([
      supabase
        .from("stock_items")
        .select("id,name,unit,current_quantity,cost_per_unit")
        .eq("active", true)
        .order("name", { ascending: true }),

      supabase
        .from("stock_waste_records")
        .select("id,stock_item_id,reason,quantity,unit,unit_cost,total_cost,note,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const error = stockResult.error || recordsResult.error;

    if (error) {
      alert(`Fire kayıtları yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setStockItems((stockResult.data ?? []) as StockItem[]);
    setRecords((recordsResult.data ?? []) as WasteRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedStock = stockItems.find((item) => item.id === selectedStockId);

  useEffect(() => {
    if (selectedStock) setUnit(selectedStock.unit);
  }, [selectedStock]);

  const summary = useMemo(() => {
    return records.reduce(
      (result, record) => {
        const cost = Number(record.total_cost || 0);
        result.count += 1;
        result.totalCost += cost;

        if (["personel", "tadim", "ikram"].includes(record.reason)) {
          result.internalCost += cost;
        } else {
          result.wasteCost += cost;
        }

        return result;
      },
      { count: 0, totalCost: 0, wasteCost: 0, internalCost: 0 }
    );
  }, [records]);

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStockId) {
      alert("Stok kalemi seçin.");
      return;
    }

    const numericQuantity = Number(quantity.replace(",", "."));

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      alert("Geçerli miktar girin.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc("record_stock_waste", {
      p_stock_item_id: selectedStockId,
      p_reason: reason,
      p_quantity: numericQuantity,
      p_unit: unit,
      p_note: note.trim() || null,
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setQuantity("");
    setNote("");
    await loadData();
    setSaving(false);

    const result = data as { total_cost?: number };

    alert(
      `Kayıt oluşturuldu. Tahmini maliyet: ${formatMoney(
        Number(result?.total_cost || 0)
      )} ₺`
    );
  }

  function stockName(id: number) {
    return stockItems.find((item) => item.id === id)?.name ??
      "Silinmiş stok kalemi";
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Fire ve İç Tüketim
            </h1>
            <p className="mt-1 text-sm opacity-50">
              Zayi, personel, tadım ve ikram kayıtları
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/pos/stock" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
              Stok
            </a>
            <a href="/pos/dashboard" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
              Dashboard
            </a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">
              POS&apos;a Dön
            </a>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Kayıt" value={String(summary.count)} />
          <SummaryCard label="Toplam Maliyet" value={`${formatMoney(summary.totalCost)} ₺`} />
          <SummaryCard label="Fire / Zayi" value={`${formatMoney(summary.wasteCost)} ₺`} />
          <SummaryCard label="İç Tüketim" value={`${formatMoney(summary.internalCost)} ₺`} />
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[380px_1fr]">
          <form onSubmit={saveRecord} className="h-fit rounded-3xl border bg-white p-5">
            <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
              Yeni Kayıt
            </h2>

            <div className="mt-4 space-y-3">
              <select
                value={selectedStockId ?? ""}
                onChange={(event) =>
                  setSelectedStockId(event.target.value ? Number(event.target.value) : null)
                }
                className="w-full rounded-xl border bg-white px-4 py-3"
              >
                <option value="">Stok kalemi seçin</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatNumber(item.current_quantity)} {item.unit}
                  </option>
                ))}
              </select>

              <select
                value={reason}
                onChange={(event) => setReason(event.target.value as WasteReason)}
                className="w-full rounded-xl border bg-white px-4 py-3"
              >
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Miktar"
                  className="rounded-xl border px-4 py-3"
                />

                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  className="rounded-xl border bg-white px-4 py-3"
                >
                  <option value="gr">gr</option>
                  <option value="kg">kg</option>
                  <option value="adet">adet</option>
                  <option value="ml">ml</option>
                  <option value="lt">lt</option>
                </select>
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Açıklama"
                className="w-full resize-y rounded-xl border px-4 py-3"
              />

              <button
                disabled={saving}
                className="w-full rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40"
              >
                {saving ? "Kaydediliyor..." : "Kaydet ve Stoktan Düş"}
              </button>
            </div>
          </form>

          <section className="overflow-hidden rounded-3xl border bg-white">
            <div className="border-b px-5 py-4">
              <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
                Son Kayıtlar
              </h2>
            </div>

            {loading ? (
              <p className="p-8 text-center">Kayıtlar yükleniyor...</p>
            ) : records.length === 0 ? (
              <p className="p-8 text-center opacity-50">
                Henüz fire veya iç tüketim kaydı yok.
              </p>
            ) : (
              <div className="divide-y">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_1fr_auto_auto] md:items-center"
                  >
                    <div>
                      <p className="font-semibold">{stockName(record.stock_item_id)}</p>
                      <p className="mt-1 text-xs opacity-45">
                        {new Date(record.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold">
                        {REASON_LABELS[record.reason as WasteReason] ?? record.reason}
                      </p>
                      {record.note && (
                        <p className="mt-1 text-xs opacity-50">{record.note}</p>
                      )}
                    </div>

                    <p className="font-bold">
                      -{formatNumber(record.quantity)} {record.unit}
                    </p>

                    <p className="font-bold text-[#6e1f12]">
                      {formatMoney(record.total_cost)} ₺
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p>
    </div>
  );
}