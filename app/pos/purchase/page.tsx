"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type StockItem = {
  id: number;
  name: string;
  unit: string;
  current_quantity: number;
  minimum_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
};

type SuggestedItem = StockItem & {
  suggestedQuantity: number;
  selected: boolean;
};

const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

export default function PurchasePage() {
  const [items, setItems] = useState<SuggestedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_items")
      .select("id,name,unit,current_quantity,minimum_quantity,cost_per_unit,supplier")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      alert(`Stoklar yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    const prepared = ((data ?? []) as StockItem[])
      .filter((item) => Number(item.current_quantity) <= Number(item.minimum_quantity))
      .map((item) => {
        const minimum = Number(item.minimum_quantity || 0);
        const current = Number(item.current_quantity || 0);
        return {
          ...item,
          suggestedQuantity: Math.max(minimum * 2 - current, minimum > 0 ? minimum : 1),
          selected: true,
        };
      });

    setItems(prepared);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const selectedItems = useMemo(() => items.filter((item) => item.selected), [items]);

  const estimatedTotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.suggestedQuantity * Number(item.cost_per_unit || 0), 0),
    [selectedItems]
  );

  function updateQuantity(id: number, value: string) {
    const numeric = Number(value.replace(",", "."));
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, suggestedQuantity: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0 }
          : item
      )
    );
  }

  function toggleItem(id: number) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  }

  async function createPurchaseOrder() {
    if (!selectedItems.length) {
      alert("En az bir stok kalemi seçin.");
      return;
    }

    setSaving(true);

    try {
      let supplierId: number | null = null;

      if (supplierName.trim()) {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("name", supplierName.trim())
          .maybeSingle();

        if (existing) {
          supplierId = existing.id;
        } else {
          const { data, error } = await supabase
            .from("suppliers")
            .insert({ name: supplierName.trim() })
            .select("id")
            .single();
          if (error) throw error;
          supplierId = data.id;
        }
      }

      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: supplierId,
          status: "draft",
          note: note.trim() || null,
          total_amount: estimatedTotal,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(
        selectedItems.map((item) => ({
          purchase_order_id: order.id,
          stock_item_id: item.id,
          quantity: item.suggestedQuantity,
          unit: item.unit,
          unit_cost: item.cost_per_unit,
          line_total: item.suggestedQuantity * item.cost_per_unit,
        }))
      );

      if (itemsError) throw itemsError;

      alert("Satın alma taslağı oluşturuldu.");
      setSupplierName("");
      setNote("");
      await loadItems();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Taslak oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
              Satın Alma Önerileri
            </h1>
            <p className="mt-1 text-sm opacity-50">Kritik stoklardan otomatik sipariş taslağı oluştur</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/pos/stock" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Stok</a>
            <a href="/pos/dashboard" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Dashboard</a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">POS&apos;a Dön</a>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Kritik Kalem" value={String(items.length)} />
          <SummaryCard label="Seçili Kalem" value={String(selectedItems.length)} />
          <SummaryCard label="Tahmini Toplam" value={`${formatMoney(estimatedTotal)} ₺`} />
        </section>

        <section className="mt-5 rounded-3xl border bg-white p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Tedarikçi adı (isteğe bağlı)" className="rounded-xl border px-4 py-3" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sipariş notu" className="rounded-xl border px-4 py-3" />
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border bg-white">
          {loading ? (
            <p className="p-8 text-center">Öneriler hazırlanıyor...</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-green-800">Kritik stok bulunmuyor.</p>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[auto_1.4fr_1fr_170px_auto] md:items-center">
                  <input type="checkbox" checked={item.selected} onChange={() => toggleItem(item.id)} className="h-5 w-5" />
                  <div>
                    <p className="font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>{item.name}</p>
                    <p className="mt-1 text-xs opacity-45">{item.supplier || "Tedarikçi tanımsız"}</p>
                  </div>
                  <div className="text-sm">
                    <p>Mevcut: <strong>{formatNumber(item.current_quantity)} {item.unit}</strong></p>
                    <p className="mt-1 opacity-50">Minimum: {formatNumber(item.minimum_quantity)} {item.unit}</p>
                  </div>
                  <input type="number" min="0" step="0.001" value={item.suggestedQuantity} onChange={(e) => updateQuantity(item.id, e.target.value)} className="rounded-xl border px-4 py-3" />
                  <p className="text-right font-bold">{formatMoney(item.suggestedQuantity * item.cost_per_unit)} ₺</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <button type="button" onClick={() => void createPurchaseOrder()} disabled={saving || !selectedItems.length} className="mt-5 w-full rounded-xl bg-[#6e1f12] px-5 py-4 font-bold text-white disabled:opacity-40">
          {saving ? "Taslak oluşturuluyor..." : "Satın Alma Taslağı Oluştur"}
        </button>
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