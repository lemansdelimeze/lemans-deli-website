"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";

type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  price: number | null;
  category: string | null;
  active: boolean;
};

type StockItem = {
  id: number;
  name: string;
  unit: "kg" | "gr" | "adet" | "lt" | "ml";
  current_quantity: number;
  cost_per_unit: number;
};

type Recipe = {
  id: number;
  menu_item_id: number;
  yield_quantity: number;
  yield_unit: string;
  active: boolean;
};

type RecipeItem = {
  id: number;
  recipe_id: number;
  stock_item_id: number;
  quantity: number;
  unit: "kg" | "gr" | "adet" | "lt" | "ml";
  sort_order: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

function productName(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function convertToStockUnit(
  quantity: number,
  fromUnit: RecipeItem["unit"],
  stockUnit: StockItem["unit"]
) {
  if (fromUnit === stockUnit) return quantity;

  if (fromUnit === "gr" && stockUnit === "kg") {
    return quantity / 1000;
  }

  if (fromUnit === "kg" && stockUnit === "gr") {
    return quantity * 1000;
  }

  if (fromUnit === "ml" && stockUnit === "lt") {
    return quantity / 1000;
  }

  if (fromUnit === "lt" && stockUnit === "ml") {
    return quantity * 1000;
  }

  return quantity;
}

export default function RecipesPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  const [selectedMenuItemId, setSelectedMenuItemId] =
    useState<number | null>(null);

  const [selectedStockItemId, setSelectedStockItemId] =
    useState<number | null>(null);

  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] =
    useState<RecipeItem["unit"]>("gr");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      menuResult,
      stockResult,
      recipeResult,
      recipeItemResult,
    ] = await Promise.all([
      supabase
        .from("menu_items")
        .select("id,name,name_tr,price,category,active")
        .eq("active", true)
        .order("name_tr", { ascending: true }),

      supabase
        .from("stock_items")
        .select(
          "id,name,unit,current_quantity,cost_per_unit"
        )
        .eq("active", true)
        .order("name", { ascending: true }),

      supabase
        .from("recipes")
        .select(
          "id,menu_item_id,yield_quantity,yield_unit,active"
        )
        .eq("active", true),

      supabase
        .from("recipe_items")
        .select(
          "id,recipe_id,stock_item_id,quantity,unit,sort_order"
        )
        .order("sort_order", { ascending: true }),
    ]);

    const firstError =
      menuResult.error ||
      stockResult.error ||
      recipeResult.error ||
      recipeItemResult.error;

    if (firstError) {
      alert(`Reçeteler yüklenemedi: ${firstError.message}`);
      setLoading(false);
      return;
    }

    setMenuItems((menuResult.data ?? []) as MenuItem[]);
    setStockItems((stockResult.data ?? []) as StockItem[]);
    setRecipes((recipeResult.data ?? []) as Recipe[]);
    setRecipeItems(
      (recipeItemResult.data ?? []) as RecipeItem[]
    );

    setSelectedMenuItemId((current) => {
      if (current) return current;
      return menuResult.data?.[0]?.id ?? null;
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedMenuItem = menuItems.find(
    (item) => item.id === selectedMenuItemId
  );

  const selectedRecipe = recipes.find(
    (recipe) =>
      recipe.menu_item_id === selectedMenuItemId
  );

  const currentRecipeItems = useMemo(() => {
    if (!selectedRecipe) return [];

    return recipeItems
      .filter(
        (item) => item.recipe_id === selectedRecipe.id
      )
      .map((item) => ({
        ...item,
        stockItem: stockItems.find(
          (stock) => stock.id === item.stock_item_id
        ),
      }));
  }, [selectedRecipe, recipeItems, stockItems]);

  const recipeCost = useMemo(() => {
    return currentRecipeItems.reduce((sum, item) => {
      if (!item.stockItem) return sum;

      const stockQuantity = convertToStockUnit(
        Number(item.quantity),
        item.unit,
        item.stockItem.unit
      );

      return (
        sum +
        stockQuantity *
          Number(item.stockItem.cost_per_unit || 0)
      );
    }, 0);
  }, [currentRecipeItems]);

  async function ensureRecipe() {
    if (!selectedMenuItemId) {
      throw new Error("Önce menü ürünü seçin.");
    }

    if (selectedRecipe) return selectedRecipe.id;

    const { data, error } = await supabase
      .from("recipes")
      .insert({
        menu_item_id: selectedMenuItemId,
        yield_quantity: 1,
        yield_unit: "adet",
        active: true,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id as number;
  }

  async function addRecipeItem(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedStockItemId) {
      alert("Stok kalemi seçin.");
      return;
    }

    const numericQuantity = Number(
      quantity.replace(",", ".")
    );

    if (
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    ) {
      alert("Geçerli miktar girin.");
      return;
    }

    setSaving(true);

    try {
      const recipeId = await ensureRecipe();

      const nextSortOrder =
        currentRecipeItems.length > 0
          ? Math.max(
              ...currentRecipeItems.map(
                (item) => item.sort_order
              )
            ) + 1
          : 1;

      const { error } = await supabase
        .from("recipe_items")
        .insert({
          recipe_id: recipeId,
          stock_item_id: selectedStockItemId,
          quantity: numericQuantity,
          unit,
          sort_order: nextSortOrder,
        });

      if (error) throw error;

      setSelectedStockItemId(null);
      setQuantity("");
      setUnit("gr");

      await loadData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Reçete kalemi eklenemedi."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecipeItem(id: number) {
    const { error } = await supabase
      .from("recipe_items")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  const margin =
    selectedMenuItem?.price && selectedMenuItem.price > 0
      ? ((selectedMenuItem.price - recipeCost) /
          selectedMenuItem.price) *
        100
      : null;

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Reçete Yönetimi
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Menü ürünlerini stok kalemleriyle bağla
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

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit rounded-3xl border border-[#6e1f12]/10 bg-white p-4 lg:sticky lg:top-5">
            <h2
              className="text-xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Menü Ürünleri
            </h2>

            <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <p className="py-6 text-center opacity-50">
                  Yükleniyor...
                </p>
              ) : (
                menuItems.map((item) => {
                  const hasRecipe = recipes.some(
                    (recipe) =>
                      recipe.menu_item_id === item.id
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedMenuItemId(item.id)
                      }
                      className={`w-full rounded-xl border px-3 py-3 text-left ${
                        selectedMenuItemId === item.id
                          ? "border-[#6e1f12] bg-[#6e1f12] text-white"
                          : "border-black/10 bg-white"
                      }`}
                    >
                      <p className="font-semibold">
                        {productName(item)}
                      </p>

                      <p className="mt-1 text-xs opacity-60">
                        {hasRecipe
                          ? "Reçete tanımlı"
                          : "Reçete yok"}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="space-y-5">
            <div className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2
                    className="text-2xl font-bold text-[#6e1f12]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    {selectedMenuItem
                      ? productName(selectedMenuItem)
                      : "Ürün seçin"}
                  </h2>

                  {selectedMenuItem && (
                    <p className="mt-1 text-sm opacity-50">
                      Satış fiyatı:{" "}
                      {formatMoney(
                        selectedMenuItem.price ?? 0
                      )}{" "}
                      ₺
                    </p>
                  )}
                </div>

                {selectedMenuItem && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Metric
                      label="Maliyet"
                      value={`${formatMoney(recipeCost)} ₺`}
                    />

                    <Metric
                      label="Brüt Kâr"
                      value={`${formatMoney(
                        Math.max(
                          0,
                          Number(
                            selectedMenuItem.price || 0
                          ) - recipeCost
                        )
                      )} ₺`}
                    />

                    <Metric
                      label="Marj"
                      value={
                        margin === null
                          ? "—"
                          : `%${margin.toFixed(1)}`
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5">
              <h3
                className="text-xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                Reçete Kalemleri
              </h3>

              {currentRecipeItems.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#f4efe5] px-4 py-6 text-center text-sm opacity-50">
                  Henüz reçete kalemi eklenmedi.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-black/8">
                  {currentRecipeItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div>
                        <p className="font-semibold">
                          {item.stockItem?.name ??
                            "Silinmiş stok kalemi"}
                        </p>

                        <p className="mt-1 text-xs opacity-50">
                          Birim maliyet:{" "}
                          {formatMoney(
                            item.stockItem
                              ?.cost_per_unit ?? 0
                          )}{" "}
                          ₺ /{" "}
                          {item.stockItem?.unit ?? "—"}
                        </p>
                      </div>

                      <p className="font-bold">
                        {item.quantity} {item.unit}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void deleteRecipeItem(item.id)
                        }
                        className="rounded-xl border border-red-900/15 px-3 py-2 text-sm text-red-800"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={addRecipeItem}
              className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5"
            >
              <h3
                className="text-xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                Malzeme Ekle
              </h3>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_120px_auto]">
                <select
                  value={selectedStockItemId ?? ""}
                  onChange={(event) =>
                    setSelectedStockItemId(
                      event.target.value
                        ? Number(event.target.value)
                        : null
                    )
                  }
                  className="rounded-xl border border-black/15 bg-white px-4 py-3"
                >
                  <option value="">Stok kalemi seçin</option>

                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(event.target.value)
                  }
                  placeholder="Miktar"
                  className="rounded-xl border border-black/15 px-4 py-3"
                />

                <select
                  value={unit}
                  onChange={(event) =>
                    setUnit(
                      event.target.value as RecipeItem["unit"]
                    )
                  }
                  className="rounded-xl border border-black/15 bg-white px-4 py-3"
                >
                  <option value="gr">gr</option>
                  <option value="kg">kg</option>
                  <option value="adet">adet</option>
                  <option value="ml">ml</option>
                  <option value="lt">lt</option>
                </select>

                <button
                  disabled={saving || !selectedMenuItemId}
                  className="rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40"
                >
                  Ekle
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#f4efe5] px-4 py-3">
      <p className="text-xs uppercase tracking-wide opacity-45">
        {label}
      </p>
      <p className="mt-1 font-bold text-[#6e1f12]">
        {value}
      </p>
    </div>
  );
}