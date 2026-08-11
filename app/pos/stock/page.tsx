"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type StockUnit = "kg" | "gr" | "adet" | "lt" | "ml";
type MovementType = "purchase" | "production" | "waste" | "internal" | "correction";

type StockItem = {
  id: number;
  name: string;
  unit: StockUnit;
  current_quantity: number;
  minimum_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
  active: boolean;
  updated_at: string;
};

const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';

const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase: "Alış",
  production: "Üretim",
  waste: "Fire",
  internal: "İç Tüketim",
  correction: "Sayım Düzeltmesi",
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<StockUnit>("kg");
  const [currentQuantity, setCurrentQuantity] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [supplier, setSupplier] = useState("");

  const [movementItem, setMovementItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<MovementType>("purchase");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementNote, setMovementNote] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("stock_items")
      .select("id,name,unit,current_quantity,minimum_quantity,cost_per_unit,supplier,active,updated_at")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      alert(`Stok yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as StockItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const summary = useMemo(() => {
    const critical = items.filter(
      (item) => Number(item.current_quantity) <= Number(item.minimum_quantity)
    ).length;

    const estimatedValue = items.reduce(
      (sum, item) =>
        sum + Number(item.current_quantity) * Number(item.cost_per_unit),
      0
    );

    return { count: items.length, critical, estimatedValue };
  }, [items]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      alert("Stok adı zorunlu.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("stock_items").insert({
      name: name.trim(),
      unit,
      current_quantity: Number(currentQuantity) || 0,
      minimum_quantity: Number(minimumQuantity) || 0,
      cost_per_unit: Number(costPerUnit) || 0,
      supplier: supplier.trim() || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setName("");
    setUnit("kg");
    setCurrentQuantity("");
    setMinimumQuantity("");
    setCostPerUnit("");
    setSupplier("");
    setNewOpen(false);
    await loadItems();
    setSaving(false);
  }

  async function saveMovement() {
    if (!movementItem) return;

    const entered = Number(movementQuantity.replace(",", "."));

    if (!Number.isFinite(entered) || entered <= 0) {
      alert("Geçerli miktar girin.");
      return;
    }

    setSaving(true);

    const subtract = movementType === "waste" || movementType === "internal";
    const movementAmount = subtract ? -entered : entered;
    const nextQuantity = Number(movementItem.current_quantity) + movementAmount;

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        stock_item_id: movementItem.id,
        movement_type: movementType,
        quantity: movementAmount,
        unit_cost: movementType === "purchase" ? Number(movementItem.cost_per_unit) : null,
        note: movementNote.trim() || null,
      });

    if (movementError) {
      alert(movementError.message);
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("stock_items")
      .update({
        current_quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", movementItem.id);

    if (updateError) {
      alert(updateError.message);
      setSaving(false);
      return;
    }

    setMovementItem(null);
    setMovementQuantity("");
    setMovementNote("");
    await loadItems();
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
              Stok Yönetimi
            </h1>
            <p className="mt-1 text-sm opacity-50">
              Peynir, şarküteri, meze ve sarf malzemeleri
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              + Yeni Stok
            </button>
            <a href="/pos/report" className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold">
              Raporlar
            </a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">
              POS&apos;a Dön
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="Aktif Stok" value={String(summary.count)} />
          <SummaryCard label="Kritik Stok" value={String(summary.critical)} />
          <SummaryCard label="Tahmini Stok Değeri" value={`${formatNumber(summary.estimatedValue)} ₺`} />
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-[#6e1f12]/10 bg-white">
          {loading ? (
            <p className="p-8 text-center">Stoklar yükleniyor...</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center opacity-50">Henüz stok kartı yok.</p>
          ) : (
            <div className="divide-y divide-black/8">
              {items.map((item) => {
                const critical =
                  Number(item.current_quantity) <= Number(item.minimum_quantity);

                return (
                  <div key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                    <div>
                      <p className="font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs opacity-45">{item.supplier || "Tedarikçi yok"}</p>
                    </div>

                    <div>
                      <p className={`text-lg font-bold ${critical ? "text-red-700" : "text-green-800"}`}>
                        {formatNumber(item.current_quantity)} {item.unit}
                      </p>
                      <p className="text-xs opacity-45">
                        Minimum: {formatNumber(item.minimum_quantity)} {item.unit}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold">{formatNumber(item.cost_per_unit)} ₺ / {item.unit}</p>
                      <p className="text-xs opacity-45">
                        Değer: {formatNumber(Number(item.current_quantity) * Number(item.cost_per_unit))} ₺
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMovementItem(item);
                        setMovementType("purchase");
                        setMovementQuantity("");
                        setMovementNote("");
                      }}
                      className="rounded-xl border border-[#6e1f12]/20 px-4 py-3 font-semibold text-[#6e1f12]"
                    >
                      Hareket Ekle
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <form onSubmit={addItem} className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6">
            <h2 className="text-2xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
              Yeni Stok Kartı
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ürün / malzeme adı" className="rounded-xl border border-black/15 px-4 py-3 sm:col-span-2" />
              <select value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} className="rounded-xl border border-black/15 bg-white px-4 py-3">
                <option value="kg">kg</option>
                <option value="gr">gr</option>
                <option value="adet">adet</option>
                <option value="lt">lt</option>
                <option value="ml">ml</option>
              </select>
              <input type="number" step="0.001" value={currentQuantity} onChange={(e) => setCurrentQuantity(e.target.value)} placeholder="Mevcut miktar" className="rounded-xl border border-black/15 px-4 py-3" />
              <input type="number" step="0.001" value={minimumQuantity} onChange={(e) => setMinimumQuantity(e.target.value)} placeholder="Minimum stok" className="rounded-xl border border-black/15 px-4 py-3" />
              <input type="number" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="Birim maliyet" className="rounded-xl border border-black/15 px-4 py-3" />
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Tedarikçi" className="rounded-xl border border-black/15 px-4 py-3 sm:col-span-2" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setNewOpen(false)} className="rounded-xl border border-black/10 px-4 py-3">Vazgeç</button>
              <button disabled={saving} className="rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40">Kaydet</button>
            </div>
          </form>
        </div>
      )}

      {movementItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <h2 className="text-2xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>{movementItem.name}</h2>
            <p className="mt-2 text-sm opacity-50">Mevcut: {formatNumber(movementItem.current_quantity)} {movementItem.unit}</p>

            <select value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType)} className="mt-5 w-full rounded-xl border border-black/15 bg-white px-4 py-3">
              {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <input autoFocus type="number" min="0" step="0.001" value={movementQuantity} onChange={(e) => setMovementQuantity(e.target.value)} placeholder={`Miktar (${movementItem.unit})`} className="mt-3 w-full rounded-xl border border-black/15 px-4 py-4 text-xl font-bold" />
            <textarea value={movementNote} onChange={(e) => setMovementNote(e.target.value)} rows={3} placeholder="Not" className="mt-3 w-full resize-y rounded-xl border border-black/15 px-4 py-3" />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setMovementItem(null)} className="rounded-xl border border-black/10 px-4 py-3">Vazgeç</button>
              <button type="button" onClick={() => void saveMovement()} disabled={saving} className="rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#6e1f12]/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p>
    </div>
  );
}