"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type StockUnit = "kg" | "gr" | "adet" | "lt" | "ml";

type StockItem = {
  id: number;
  name: string;
  unit: StockUnit;
  current_quantity: number;
};

type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  category: string | null;
  category_id: number | null;
  stock_item_id: number | null;
  stock_usage_quantity: number | null;
  stock_usage_unit: StockUnit | null;
  sort_order: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

function itemName(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

export default function StockLinkPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const [menuResult, stockResult] = await Promise.all([
      supabase
        .from("menu_items")
        .select(
          "id,name,name_tr,category,category_id,stock_item_id,stock_usage_quantity,stock_usage_unit,sort_order"
        )
        .eq("active", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true }),

      supabase
        .from("stock_items")
        .select("id,name,unit,current_quantity")
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);

    const error = menuResult.error || stockResult.error;

    if (error) {
      alert(`Veriler yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setMenuItems((menuResult.data ?? []) as MenuItem[]);
    setStockItems((stockResult.data ?? []) as StockItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    if (!term) return menuItems;

    return menuItems.filter((item) =>
      itemName(item).toLocaleLowerCase("tr-TR").includes(term)
    );
  }, [menuItems, search]);

  function updateLocal(id: number, changes: Partial<MenuItem>) {
    setMenuItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  }

  async function save(item: MenuItem) {
    setSavingId(item.id);

    const selectedStock = stockItems.find(
      (stock) => stock.id === item.stock_item_id
    );

    const { error } = await supabase
      .from("menu_items")
      .update({
        stock_item_id: item.stock_item_id,
        stock_usage_quantity:
          item.stock_usage_quantity && item.stock_usage_quantity > 0
            ? item.stock_usage_quantity
            : null,
        stock_usage_unit:
          item.stock_item_id !== null
            ? item.stock_usage_unit || selectedStock?.unit || null
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      setSavingId(null);
      return;
    }

    setSavingId(null);
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
              Menü – Stok Bağlantıları
            </h1>
            <p className="mt-1 text-sm opacity-50">
              Satış kapanınca hangi stoktan ne kadar düşeceğini belirle
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/pos/stock"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              Stok Yönetimi
            </a>
            <a
              href="/pos"
              className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white"
            >
              POS&apos;a Dön
            </a>
          </div>
        </header>

        <div className="mb-5 rounded-2xl border border-[#6e1f12]/10 bg-white p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Menü ürünü ara..."
            className="w-full rounded-xl border border-black/15 px-4 py-3"
          />

          <p className="mt-3 text-xs leading-5 opacity-55">
            Peynir ve şarküteride miktar alanını boş bırakabilirsin; POS&apos;ta
            girilen gram otomatik düşer. Meze gibi porsiyon ürünlerinde tam
            porsiyon kullanımını yaz: örneğin 200 gr. Yarım porsiyon otomatik
            olarak bunun yarısını düşürür.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center">
            Bağlantılar yükleniyor...
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const selectedStock = stockItems.find(
                (stock) => stock.id === item.stock_item_id
              );

              return (
                <section
                  key={item.id}
                  className="rounded-2xl border border-[#6e1f12]/10 bg-white p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_180px_150px_auto] lg:items-end">
                    <div>
                      <p
                        className="font-bold text-[#6e1f12]"
                        style={{ fontFamily: BRAND_FONT }}
                      >
                        {itemName(item)}
                      </p>
                      <p className="mt-1 text-xs opacity-45">
                        {item.category || "Kategori yok"}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold">
                        Stok kartı
                      </span>
                      <select
                        value={item.stock_item_id ?? ""}
                        onChange={(event) => {
                          const nextId = event.target.value
                            ? Number(event.target.value)
                            : null;
                          const stock = stockItems.find(
                            (entry) => entry.id === nextId
                          );

                          updateLocal(item.id, {
                            stock_item_id: nextId,
                            stock_usage_unit:
                              stock?.unit ?? item.stock_usage_unit,
                          });
                        }}
                        className="w-full rounded-xl border border-black/15 bg-white px-3 py-3"
                      >
                        <option value="">Bağlantı yok</option>
                        {stockItems.map((stock) => (
                          <option key={stock.id} value={stock.id}>
                            {stock.name} ({stock.current_quantity} {stock.unit})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold">
                        Tam porsiyon kullanım
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.stock_usage_quantity ?? ""}
                        onChange={(event) =>
                          updateLocal(item.id, {
                            stock_usage_quantity: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        placeholder="Örn. 200"
                        disabled={!item.stock_item_id}
                        className="w-full rounded-xl border border-black/15 px-3 py-3 disabled:bg-black/5"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold">
                        Birim
                      </span>
                      <select
                        value={
                          item.stock_usage_unit ||
                          selectedStock?.unit ||
                          "gr"
                        }
                        onChange={(event) =>
                          updateLocal(item.id, {
                            stock_usage_unit:
                              event.target.value as StockUnit,
                          })
                        }
                        disabled={!item.stock_item_id}
                        className="w-full rounded-xl border border-black/15 bg-white px-3 py-3 disabled:bg-black/5"
                      >
                        <option value="gr">gr</option>
                        <option value="kg">kg</option>
                        <option value="adet">adet</option>
                        <option value="ml">ml</option>
                        <option value="lt">lt</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => void save(item)}
                      disabled={savingId === item.id}
                      className="rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40"
                    >
                      {savingId === item.id ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
