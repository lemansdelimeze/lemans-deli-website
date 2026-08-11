"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../../lib/supabase";

type ProductionOrderStatus =
  | "planned"
  | "started"
  | "completed"
  | "cancelled";

type ProductionOrder = {
  id: number;
  production_recipe_id: number;
  planned_quantity: number;
  planned_unit: string;
  actual_quantity: number | null;
  actual_unit: string | null;
  status: ProductionOrderStatus;
  planned_for: string;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
  created_at: string;
};

type ProductionRecipe = {
  id: number;
  output_stock_item_id: number;
  output_quantity: number;
  output_unit: string;
  active: boolean;
};

type StockItem = {
  id: number;
  name: string;
  unit: string;
  current_quantity: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  planned: "Planlandı",
  started: "Başladı",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

function formatNumber(value: number | null) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedRecipeId, setSelectedRecipeId] =
    useState<number | null>(null);
  const [plannedQuantity, setPlannedQuantity] = useState("");
  const [plannedFor, setPlannedFor] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState("");

  const [completeOrder, setCompleteOrder] =
    useState<ProductionOrder | null>(null);
  const [actualQuantity, setActualQuantity] = useState("");
  const [completionNote, setCompletionNote] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    const [ordersResult, recipesResult, stockResult] =
      await Promise.all([
        supabase
          .from("production_orders")
          .select(
            "id,production_recipe_id,planned_quantity,planned_unit,actual_quantity,actual_unit,status,planned_for,started_at,completed_at,note,created_at"
          )
          .order("planned_for", { ascending: false })
          .order("created_at", { ascending: false }),

        supabase
          .from("production_recipes")
          .select(
            "id,output_stock_item_id,output_quantity,output_unit,active"
          )
          .eq("active", true),

        supabase
          .from("stock_items")
          .select("id,name,unit,current_quantity")
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

    const error =
      ordersResult.error ||
      recipesResult.error ||
      stockResult.error;

    if (error) {
      alert(`Üretim emirleri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrders((ordersResult.data ?? []) as ProductionOrder[]);
    setRecipes(
      (recipesResult.data ?? []) as ProductionRecipe[]
    );
    setStockItems((stockResult.data ?? []) as StockItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "planned" ||
          order.status === "started"
      ),
    [orders]
  );

  const completedOrders = useMemo(
    () =>
      orders.filter((order) => order.status === "completed"),
    [orders]
  );

  function outputName(recipeId: number) {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) return "Silinmiş üretim reçetesi";

    return (
      stockItems.find(
        (item) => item.id === recipe.output_stock_item_id
      )?.name ?? "Silinmiş stok kalemi"
    );
  }

  async function createOrder(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedRecipeId) {
      alert("Üretim reçetesi seçin.");
      return;
    }

    const amount = Number(plannedQuantity.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Geçerli üretim miktarı girin.");
      return;
    }

    const recipe = recipes.find(
      (item) => item.id === selectedRecipeId
    );

    if (!recipe) {
      alert("Üretim reçetesi bulunamadı.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("production_orders")
      .insert({
        production_recipe_id: selectedRecipeId,
        planned_quantity: amount,
        planned_unit: recipe.output_unit,
        planned_for: plannedFor,
        note: note.trim() || null,
        status: "planned",
        updated_at: new Date().toISOString(),
      });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSelectedRecipeId(null);
    setPlannedQuantity("");
    setNote("");
    await loadData();
    setSaving(false);
  }

  async function startOrder(orderId: number) {
    const { error } = await supabase
      .from("production_orders")
      .update({
        status: "started",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function cancelOrder(orderId: number) {
    if (!window.confirm("Üretim emri iptal edilsin mi?")) {
      return;
    }

    const { error } = await supabase
      .from("production_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function finishOrder() {
    if (!completeOrder) return;

    const amount = Number(actualQuantity.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Gerçek üretim miktarını girin.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc(
      "complete_production_order",
      {
        p_production_order_id: completeOrder.id,
        p_actual_quantity: amount,
        p_note: completionNote.trim() || null,
      }
    );

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setCompleteOrder(null);
    setActualQuantity("");
    setCompletionNote("");
    await loadData();
    setSaving(false);
    alert("Üretim tamamlandı ve stoklar güncellendi.");
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
              Üretim Emirleri
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Planla, başlat ve tek işlemde tamamla
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/pos/production"
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            >
              Üretim Reçeteleri
            </a>

            <a
              href="/pos/dashboard"
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
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

        <form
          onSubmit={createOrder}
          className="rounded-3xl border bg-white p-5"
        >
          <h2
            className="text-xl font-bold text-[#6e1f12]"
            style={{ fontFamily: BRAND_FONT }}
          >
            Yeni Üretim Emri
          </h2>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_170px_170px_1fr_auto]">
            <select
              value={selectedRecipeId ?? ""}
              onChange={(event) =>
                setSelectedRecipeId(
                  event.target.value
                    ? Number(event.target.value)
                    : null
                )
              }
              className="rounded-xl border bg-white px-4 py-3"
            >
              <option value="">Üretim reçetesi seçin</option>

              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {outputName(recipe.id)}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="0.001"
              value={plannedQuantity}
              onChange={(event) =>
                setPlannedQuantity(event.target.value)
              }
              placeholder="Planlanan miktar"
              className="rounded-xl border px-4 py-3"
            />

            <input
              type="date"
              value={plannedFor}
              onChange={(event) =>
                setPlannedFor(event.target.value)
              }
              className="rounded-xl border px-4 py-3"
            />

            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Not"
              className="rounded-xl border px-4 py-3"
            />

            <button
              disabled={saving}
              className="rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40"
            >
              Planla
            </button>
          </div>
        </form>

        <section className="mt-5 overflow-hidden rounded-3xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2
              className="text-xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Aktif Üretim Emirleri
            </h2>
          </div>

          {loading ? (
            <p className="p-8 text-center">Yükleniyor...</p>
          ) : activeOrders.length === 0 ? (
            <p className="p-8 text-center opacity-50">
              Aktif üretim emri yok.
            </p>
          ) : (
            <div className="divide-y">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-bold text-[#6e1f12]">
                      {outputName(order.production_recipe_id)}
                    </p>

                    <p className="mt-1 text-xs opacity-45">
                      #{order.id} · {order.planned_for}
                    </p>
                  </div>

                  <p className="font-semibold">
                    {formatNumber(order.planned_quantity)}{" "}
                    {order.planned_unit}
                  </p>

                  <p className="text-sm">
                    {STATUS_LABELS[order.status]}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {order.status === "planned" && (
                      <button
                        type="button"
                        onClick={() => void startOrder(order.id)}
                        className="rounded-xl border border-[#6e1f12]/20 px-4 py-2 text-sm font-semibold text-[#6e1f12]"
                      >
                        Başlat
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCompleteOrder(order);
                        setActualQuantity(
                          String(order.planned_quantity)
                        );
                        setCompletionNote(order.note ?? "");
                      }}
                      className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Tamamla
                    </button>

                    <button
                      type="button"
                      onClick={() => void cancelOrder(order.id)}
                      className="rounded-xl border border-red-900/15 px-4 py-2 text-sm text-red-800"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2
              className="text-xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Son Tamamlananlar
            </h2>
          </div>

          {completedOrders.length === 0 ? (
            <p className="p-8 text-center opacity-50">
              Tamamlanmış üretim emri yok.
            </p>
          ) : (
            <div className="divide-y">
              {completedOrders.slice(0, 20).map((order) => (
                <div
                  key={order.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr] md:items-center"
                >
                  <p className="font-semibold">
                    {outputName(order.production_recipe_id)}
                  </p>

                  <p>
                    {formatNumber(order.actual_quantity)}{" "}
                    {order.actual_unit}
                  </p>

                  <p className="text-sm opacity-50">
                    {order.completed_at
                      ? new Date(
                          order.completed_at
                        ).toLocaleString("tr-TR")
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {completeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <h2
              className="text-2xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Üretimi Tamamla
            </h2>

            <p className="mt-2 text-sm opacity-50">
              {outputName(completeOrder.production_recipe_id)}
            </p>

            <input
              autoFocus
              type="number"
              min="0"
              step="0.001"
              value={actualQuantity}
              onChange={(event) =>
                setActualQuantity(event.target.value)
              }
              placeholder="Gerçek üretim miktarı"
              className="mt-5 w-full rounded-xl border px-4 py-4 text-xl font-bold"
            />

            <textarea
              value={completionNote}
              onChange={(event) =>
                setCompletionNote(event.target.value)
              }
              rows={3}
              placeholder="Tamamlama notu"
              className="mt-3 w-full resize-y rounded-xl border px-4 py-3"
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCompleteOrder(null)}
                className="rounded-xl border px-4 py-3"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={() => void finishOrder()}
                disabled={saving}
                className="rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40"
              >
                Tamamla
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}