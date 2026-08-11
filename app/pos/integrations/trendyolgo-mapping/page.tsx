"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type ExternalProduct = { productId: string; name: string };
type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  category: string | null;
  active: boolean;
};
type Mapping = {
  id: number;
  menu_item_id: number;
  external_product_id: string;
  external_name: string | null;
};

const EXCLUDED = new Set(["sarkuteri", "peynir"]);

function label(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

export default function TrendyolGoMappingPage() {
  const [products, setProducts] = useState<ExternalProduct[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selected, setSelected] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  async function loadData() {
    setLoading(true);
    setErrorText("");

    const [pRes, menuRes, mapRes] = await Promise.all([
      fetch("/api/integrations/trendyolgo/products", { cache: "no-store" }),
      supabase
        .from("menu_items")
        .select("id,name,name_tr,category,active")
        .order("name_tr"),
      supabase
        .from("integration_product_mappings")
        .select("id,menu_item_id,external_product_id,external_name")
        .eq("channel", "trendyol")
        .eq("active", true),
    ]);

    const pJson = await pRes.json();

    if (!pRes.ok || !pJson.ok) {
      setErrorText(pJson.error || "Trendyol Go ürünleri alınamadı.");
      setLoading(false);
      return;
    }

    if (menuRes.error || mapRes.error) {
      setErrorText(menuRes.error?.message || mapRes.error?.message || "Veri yüklenemedi.");
      setLoading(false);
      return;
    }

    const loadedProducts = (pJson.products ?? []) as ExternalProduct[];
    const loadedMenu = ((menuRes.data ?? []) as MenuItem[]).filter(
      (x) => !EXCLUDED.has(String(x.category || "").toLowerCase())
    );
    const loadedMappings = (mapRes.data ?? []) as Mapping[];

    setProducts(loadedProducts);
    setMenuItems(loadedMenu);
    setMappings(loadedMappings);

    const initial: Record<string, number | null> = {};
    for (const product of loadedProducts) {
      const existing = loadedMappings.find(
        (m) => m.external_product_id === product.productId
      );
      initial[product.productId] = existing?.menu_item_id ?? null;
    }
    setSelected(initial);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const mappedIds = useMemo(
    () => new Set(mappings.map((m) => m.external_product_id)),
    [mappings]
  );

  async function saveMapping(product: ExternalProduct) {
    const menuItemId = selected[product.productId];
    if (!menuItemId) return alert("Ürün seç.");

    const existing = mappings.find(
      (m) => m.external_product_id === product.productId
    );

    const payload = {
      menu_item_id: menuItemId,
      external_name: product.name,
      active: true,
      updated_at: new Date().toISOString(),
    };

    const result = existing
      ? await supabase
          .from("integration_product_mappings")
          .update(payload)
          .eq("id", existing.id)
      : await supabase
          .from("integration_product_mappings")
          .insert({
            channel: "trendyol",
            external_product_id: product.productId,
            external_variant_id: null,
            ...payload,
          });

    if (result.error) return alert(result.error.message);
    await loadData();
  }

  const mappedCount = products.filter((p) =>
    mappedIds.has(p.productId)
  ).length;

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-6 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between border-b pb-5">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]">
              Trendyol Go Ürün Eşleştirme
            </h1>
            <p className="mt-1 text-sm opacity-50">
              Şarküteri ve peynir hariç
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="rounded-xl bg-[#6e1f12] px-4 py-2 font-semibold text-white"
          >
            Yenile
          </button>
        </header>

        <section className="grid grid-cols-3 gap-3">
          <Card label="Trendyol Ürünü" value={String(products.length)} />
          <Card label="Eşleşmiş" value={String(mappedCount)} />
          <Card label="Kalan" value={String(products.length - mappedCount)} />
        </section>

        {loading ? (
          <div className="mt-5 rounded-3xl bg-white p-10 text-center">
            Yükleniyor...
          </div>
        ) : errorText ? (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
            {errorText}
          </div>
        ) : (
          <section className="mt-5 overflow-hidden rounded-3xl border bg-white">
            <div className="divide-y">
              {products.map((product) => {
                const existing = mappedIds.has(product.productId);

                return (
                  <div
                    key={product.productId}
                    className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_1.5fr_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs opacity-45">
                        ID: {product.productId}
                        {existing ? " · eşleşmiş" : ""}
                      </p>
                    </div>

                    <select
                      value={selected[product.productId] ?? ""}
                      onChange={(e) =>
                        setSelected((current) => ({
                          ...current,
                          [product.productId]: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }))
                      }
                      className="rounded-xl border bg-white px-4 py-3"
                    >
                      <option value="">Leman&apos;s Deli ürünü seç</option>
                      {menuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {label(item)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => void saveMapping(product)}
                      className="rounded-xl bg-[#6e1f12] px-4 py-3 text-sm font-bold text-white"
                    >
                      {existing ? "Güncelle" : "Eşleştir"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p>
    </div>
  );
}