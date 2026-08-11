"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";

type Unit = "kg" | "gr" | "adet" | "lt" | "ml";

type StockItem = {
  id: number;
  name: string;
  unit: Unit;
  current_quantity: number;
  cost_per_unit: number;
};

type ProductionRecipe = {
  id: number;
  output_stock_item_id: number;
  output_quantity: number;
  output_unit: Unit;
  active: boolean;
};

type ProductionRecipeItem = {
  id: number;
  production_recipe_id: number;
  input_stock_item_id: number;
  quantity: number;
  unit: Unit;
  sort_order: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function convertQuantity(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit
) {
  if (fromUnit === toUnit) return quantity;
  if (fromUnit === "gr" && toUnit === "kg") return quantity / 1000;
  if (fromUnit === "kg" && toUnit === "gr") return quantity * 1000;
  if (fromUnit === "ml" && toUnit === "lt") return quantity / 1000;
  if (fromUnit === "lt" && toUnit === "ml") return quantity * 1000;
  return quantity;
}

export default function ProductionPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<
    ProductionRecipeItem[]
  >([]);

  const [selectedOutputId, setSelectedOutputId] =
    useState<number | null>(null);

  const [inputStockId, setInputStockId] =
    useState<number | null>(null);

  const [inputQuantity, setInputQuantity] = useState("");
  const [inputUnit, setInputUnit] = useState<Unit>("gr");

  const [produceQuantity, setProduceQuantity] = useState("");
  const [productionNote, setProductionNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [stockResult, recipeResult, itemResult] =
      await Promise.all([
        supabase
          .from("stock_items")
          .select(
            "id,name,unit,current_quantity,cost_per_unit"
          )
          .eq("active", true)
          .order("name", { ascending: true }),

        supabase
          .from("production_recipes")
          .select(
            "id,output_stock_item_id,output_quantity,output_unit,active"
          )
          .eq("active", true),

        supabase
          .from("production_recipe_items")
          .select(
            "id,production_recipe_id,input_stock_item_id,quantity,unit,sort_order"
          )
          .order("sort_order", { ascending: true }),
      ]);

    const error =
      stockResult.error ||
      recipeResult.error ||
      itemResult.error;

    if (error) {
      alert(`Üretim verileri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    const loadedStock = (stockResult.data ?? []) as StockItem[];

    setStockItems(loadedStock);
    setRecipes(
      (recipeResult.data ?? []) as ProductionRecipe[]
    );
    setRecipeItems(
      (itemResult.data ?? []) as ProductionRecipeItem[]
    );

    setSelectedOutputId((current) =>
      current ?? loadedStock[0]?.id ?? null
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedOutput = stockItems.find(
    (item) => item.id === selectedOutputId
  );

  const selectedRecipe = recipes.find(
    (recipe) =>
      recipe.output_stock_item_id === selectedOutputId
  );

  const selectedRecipeItems = useMemo(() => {
    if (!selectedRecipe) return [];

    return recipeItems
      .filter(
        (item) =>
          item.production_recipe_id === selectedRecipe.id
      )
      .map((item) => ({
        ...item,
        stockItem: stockItems.find(
          (stock) =>
            stock.id === item.input_stock_item_id
        ),
      }));
  }, [selectedRecipe, recipeItems, stockItems]);

  const productionCost = useMemo(() => {
    return selectedRecipeItems.reduce((sum, item) => {
      if (!item.stockItem) return sum;

      const converted = convertQuantity(
        Number(item.quantity),
        item.unit,
        item.stockItem.unit
      );

      return (
        sum +
        converted *
          Number(item.stockItem.cost_per_unit || 0)
      );
    }, 0);
  }, [selectedRecipeItems]);

  async function ensureRecipe() {
    if (!selectedOutputId || !selectedOutput) {
      throw new Error("Önce üretilecek stok kalemini seçin.");
    }

    if (selectedRecipe) return selectedRecipe.id;

    const { data, error } = await supabase
      .from("production_recipes")
      .insert({
        output_stock_item_id: selectedOutputId,
        output_quantity: 1,
        output_unit: selectedOutput.unit,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id as number;
  }

  async function addInput(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!inputStockId) {
      alert("Hammadde seçin.");
      return;
    }

    const numericQuantity = Number(
      inputQuantity.replace(",", ".")
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

      const nextSort =
        selectedRecipeItems.length > 0
          ? Math.max(
              ...selectedRecipeItems.map(
                (item) => item.sort_order
              )
            ) + 1
          : 1;

      const { error } = await supabase
        .from("production_recipe_items")
        .insert({
          production_recipe_id: recipeId,
          input_stock_item_id: inputStockId,
          quantity: numericQuantity,
          unit: inputUnit,
          sort_order: nextSort,
        });

      if (error) throw error;

      setInputStockId(null);
      setInputQuantity("");
      setInputUnit("gr");

      await loadData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Hammadde eklenemedi."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteInput(id: number) {
    const { error } = await supabase
      .from("production_recipe_items")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function produce() {
    if (!selectedRecipe || !selectedOutput) {
      alert("Önce üretim reçetesi oluşturun.");
      return;
    }

    const amount = Number(
      produceQuantity.replace(",", ".")
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Geçerli üretim miktarı girin.");
      return;
    }

    if (selectedRecipeItems.length === 0) {
      alert("Üretim reçetesine hammadde ekleyin.");
      return;
    }

    setSaving(true);

    try {
      const multiplier =
        amount / Number(selectedRecipe.output_quantity || 1);

      for (const item of selectedRecipeItems) {
        if (!item.stockItem) continue;

        const usage = convertQuantity(
          Number(item.quantity) * multiplier,
          item.unit,
          item.stockItem.unit
        );

        const nextQuantity =
          Number(item.stockItem.current_quantity) - usage;

        const { error: movementError } = await supabase
          .from("stock_movements")
          .insert({
            stock_item_id: item.stockItem.id,
            movement_type: "production",
            quantity: -usage,
            reference_type: "production_recipe",
            reference_id: selectedRecipe.id,
            note: `${
              selectedOutput.name
            } üretimi`,
          });

        if (movementError) throw movementError;

        const { error: stockError } = await supabase
          .from("stock_items")
          .update({
            current_quantity: nextQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.stockItem.id);

        if (stockError) throw stockError;
      }

      const outputConverted = convertQuantity(
        amount,
        selectedRecipe.output_unit,
        selectedOutput.unit
      );

      const nextOutput =
        Number(selectedOutput.current_quantity) +
        outputConverted;

      const { error: outputMovementError } =
        await supabase
          .from("stock_movements")
          .insert({
            stock_item_id: selectedOutput.id,
            movement_type: "production",
            quantity: outputConverted,
            reference_type: "production_recipe",
            reference_id: selectedRecipe.id,
            note: `${
              selectedOutput.name
            } üretim girişi`,
          });

      if (outputMovementError) throw outputMovementError;

      const { error: outputStockError } = await supabase
        .from("stock_items")
        .update({
          current_quantity: nextOutput,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedOutput.id);

      if (outputStockError) throw outputStockError;

      const { error: batchError } = await supabase
        .from("production_batches")
        .insert({
          production_recipe_id: selectedRecipe.id,
          produced_quantity: amount,
          produced_unit: selectedRecipe.output_unit,
          note: productionNote.trim() || null,
        });

      if (batchError) throw batchError;

      setProduceQuantity("");
      setProductionNote("");
      await loadData();

      alert("Üretim kaydedildi.");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Üretim kaydedilemedi."
      );
    } finally {
      setSaving(false);
    }
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
              Üretim Yönetimi
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Hammaddeleri düşür, üretilen ürünü stoğa ekle
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/pos/stock"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              Stok
            </a>

            <a
              href="/pos/dashboard"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              Dashboard
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
              Üretilecek Ürün
            </h2>

            <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
              {loading ? (
                <p className="py-6 text-center opacity-50">
                  Yükleniyor...
                </p>
              ) : (
                stockItems.map((item) => {
                  const hasRecipe = recipes.some(
                    (recipe) =>
                      recipe.output_stock_item_id === item.id
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedOutputId(item.id)
                      }
                      className={`w-full rounded-xl border px-3 py-3 text-left ${
                        selectedOutputId === item.id
                          ? "border-[#6e1f12] bg-[#6e1f12] text-white"
                          : "border-black/10"
                      }`}
                    >
                      <p className="font-semibold">
                        {item.name}
                      </p>

                      <p className="mt-1 text-xs opacity-60">
                        {hasRecipe
                          ? "Üretim reçetesi tanımlı"
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
              <h2
                className="text-2xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                {selectedOutput?.name ?? "Ürün seçin"}
              </h2>

              {selectedOutput && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric
                    label="Mevcut Stok"
                    value={`${formatNumber(
                      selectedOutput.current_quantity
                    )} ${selectedOutput.unit}`}
                  />

                  <Metric
                    label="Reçete Maliyeti"
                    value={`${formatNumber(
                      productionCost
                    )} ₺`}
                  />

                  <Metric
                    label="Hammadde"
                    value={`${selectedRecipeItems.length} kalem`}
                  />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5">
              <h3
                className="text-xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                Üretim Reçetesi
              </h3>

              {selectedRecipeItems.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#f4efe5] px-4 py-6 text-center text-sm opacity-50">
                  Henüz hammadde eklenmedi.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-black/8">
                  {selectedRecipeItems.map((item) => (
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
                          Stok:{" "}
                          {formatNumber(
                            item.stockItem
                              ?.current_quantity ?? 0
                          )}{" "}
                          {item.stockItem?.unit ?? ""}
                        </p>
                      </div>

                      <p className="font-bold">
                        {formatNumber(item.quantity)}{" "}
                        {item.unit}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          void deleteInput(item.id)
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
              onSubmit={addInput}
              className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5"
            >
              <h3
                className="text-xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                Hammadde Ekle
              </h3>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_120px_auto]">
                <select
                  value={inputStockId ?? ""}
                  onChange={(event) =>
                    setInputStockId(
                      event.target.value
                        ? Number(event.target.value)
                        : null
                    )
                  }
                  className="rounded-xl border border-black/15 bg-white px-4 py-3"
                >
                  <option value="">Hammadde seçin</option>

                  {stockItems
                    .filter(
                      (item) =>
                        item.id !== selectedOutputId
                    )
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name}
                      </option>
                    ))}
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={inputQuantity}
                  onChange={(event) =>
                    setInputQuantity(event.target.value)
                  }
                  placeholder="Miktar"
                  className="rounded-xl border border-black/15 px-4 py-3"
                />

                <select
                  value={inputUnit}
                  onChange={(event) =>
                    setInputUnit(
                      event.target.value as Unit
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
                  disabled={saving || !selectedOutputId}
                  className="rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40"
                >
                  Ekle
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5">
              <h3
                className="text-xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                Üretim Kaydı
              </h3>

              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={produceQuantity}
                  onChange={(event) =>
                    setProduceQuantity(event.target.value)
                  }
                  placeholder={`Miktar (${
                    selectedRecipe?.output_unit ??
                    selectedOutput?.unit ??
                    ""
                  })`}
                  className="rounded-xl border border-black/15 px-4 py-3"
                />

                <input
                  value={productionNote}
                  onChange={(event) =>
                    setProductionNote(event.target.value)
                  }
                  placeholder="Üretim notu"
                  className="rounded-xl border border-black/15 px-4 py-3"
                />

                <button
                  type="button"
                  onClick={() => void produce()}
                  disabled={saving || !selectedRecipe}
                  className="rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40"
                >
                  Üret
                </button>
              </div>
            </div>
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