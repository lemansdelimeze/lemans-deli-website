"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";

type DateMode = "today" | "yesterday" | "sevenDays" | "custom";

type PosOrder = {
  id: number;
  total: number;
  payment_method: string;
  status: string;
  closed_at: string | null;
  created_at: string;
};

type OrderItem = {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  product_name: string;
  quantity: number;
  portion_type: string | null;
  weight_grams: number | null;
  unit_price: number;
  line_total: number;
};

type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  stock_item_id: number | null;
  stock_usage_quantity: number | null;
  stock_usage_unit: string | null;
};

type StockItem = {
  id: number;
  name: string;
  unit: string;
  cost_per_unit: number;
};

type Recipe = {
  id: number;
  menu_item_id: number;
  active: boolean;
};

type RecipeItem = {
  id: number;
  recipe_id: number;
  stock_item_id: number;
  quantity: number;
  unit: string;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeFor(
  mode: DateMode,
  customStart: string,
  customEnd: string
) {
  const now = new Date();

  if (mode === "today") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ),
      end: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      ),
    };
  }

  if (mode === "yesterday") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1
      ),
      end: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ),
    };
  }

  if (mode === "sevenDays") {
    return {
      start: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6
      ),
      end: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      ),
    };
  }

  const start = new Date(`${customStart}T00:00:00`);
  const end = new Date(`${customEnd}T00:00:00`);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function convertQuantity(
  quantity: number,
  fromUnit: string | null,
  toUnit: string
) {
  if (!fromUnit || fromUnit === toUnit) return quantity;

  if (fromUnit === "gr" && toUnit === "kg") return quantity / 1000;
  if (fromUnit === "kg" && toUnit === "gr") return quantity * 1000;
  if (fromUnit === "ml" && toUnit === "lt") return quantity / 1000;
  if (fromUnit === "lt" && toUnit === "ml") return quantity * 1000;

  return quantity;
}

export default function ProfitPage() {
  const now = new Date();

  const [mode, setMode] = useState<DateMode>("today");
  const [customStart, setCustomStart] = useState(
    localDateInput(now)
  );
  const [customEnd, setCustomEnd] = useState(
    localDateInput(now)
  );

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { start, end } = rangeFor(
      mode,
      customStart,
      customEnd
    );

    const [
      ordersResult,
      menuResult,
      stockResult,
      recipesResult,
      recipeItemsResult,
    ] = await Promise.all([
      supabase
        .from("pos_orders")
        .select(
          "id,total,payment_method,status,closed_at,created_at"
        )
        .eq("status", "closed")
        .gte("closed_at", start.toISOString())
        .lt("closed_at", end.toISOString()),

      supabase
        .from("menu_items")
        .select(
          "id,name,name_tr,stock_item_id,stock_usage_quantity,stock_usage_unit"
        ),

      supabase
        .from("stock_items")
        .select("id,name,unit,cost_per_unit"),

      supabase
        .from("recipes")
        .select("id,menu_item_id,active")
        .eq("active", true),

      supabase
        .from("recipe_items")
        .select(
          "id,recipe_id,stock_item_id,quantity,unit"
        ),
    ]);

    const firstError =
      ordersResult.error ||
      menuResult.error ||
      stockResult.error ||
      recipesResult.error ||
      recipeItemsResult.error;

    if (firstError) {
      alert(
        `Kârlılık verileri yüklenemedi: ${firstError.message}`
      );
      setLoading(false);
      return;
    }

    const loadedOrders =
      (ordersResult.data ?? []) as PosOrder[];

    setOrders(loadedOrders);
    setMenuItems((menuResult.data ?? []) as MenuItem[]);
    setStockItems((stockResult.data ?? []) as StockItem[]);
    setRecipes((recipesResult.data ?? []) as Recipe[]);
    setRecipeItems(
      (recipeItemsResult.data ?? []) as RecipeItem[]
    );

    if (loadedOrders.length === 0) {
      setOrderItems([]);
      setLoading(false);
      return;
    }

    const orderIds = loadedOrders.map((order) => order.id);

    const { data, error } = await supabase
      .from("pos_order_items")
      .select(
        `
          id,
          order_id,
          menu_item_id,
          product_name,
          quantity,
          portion_type,
          weight_grams,
          unit_price,
          line_total
        `
      )
      .in("order_id", orderIds);

    if (error) {
      alert(`Satış kalemleri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrderItems((data ?? []) as OrderItem[]);
    setLoading(false);
  }, [mode, customStart, customEnd]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const productRows = useMemo(() => {
    const stockMap = new Map(
      stockItems.map((item) => [item.id, item])
    );

    const recipeMap = new Map(
      recipes.map((recipe) => [
        recipe.menu_item_id,
        recipe,
      ])
    );

    const menuMap = new Map(
      menuItems.map((item) => [item.id, item])
    );

    const aggregated = new Map<
      string,
      {
        productName: string;
        quantity: number;
        revenue: number;
        cost: number;
        missingCost: boolean;
      }
    >();

    orderItems.forEach((orderItem) => {
      const menuItem = orderItem.menu_item_id
        ? menuMap.get(orderItem.menu_item_id)
        : undefined;

      let lineCost = 0;
      let missingCost = false;

      const recipe = orderItem.menu_item_id
        ? recipeMap.get(orderItem.menu_item_id)
        : undefined;

      if (recipe) {
        const ingredients = recipeItems.filter(
          (item) => item.recipe_id === recipe.id
        );

        if (ingredients.length === 0) {
          missingCost = true;
        } else {
          const portionMultiplier =
            orderItem.portion_type === "half" ? 0.5 : 1;

          ingredients.forEach((ingredient) => {
            const stock = stockMap.get(
              ingredient.stock_item_id
            );

            if (!stock) {
              missingCost = true;
              return;
            }

            const converted = convertQuantity(
              Number(ingredient.quantity),
              ingredient.unit,
              stock.unit
            );

            lineCost +=
              converted *
              Number(stock.cost_per_unit || 0) *
              Number(orderItem.quantity || 1) *
              portionMultiplier;
          });
        }
      } else if (
        menuItem?.stock_item_id &&
        orderItem.weight_grams
      ) {
        const stock = stockMap.get(
          menuItem.stock_item_id
        );

        if (!stock) {
          missingCost = true;
        } else {
          const converted = convertQuantity(
            Number(orderItem.weight_grams),
            "gr",
            stock.unit
          );

          lineCost =
            converted *
            Number(stock.cost_per_unit || 0) *
            Number(orderItem.quantity || 1);
        }
      } else if (
        menuItem?.stock_item_id &&
        menuItem.stock_usage_quantity
      ) {
        const stock = stockMap.get(
          menuItem.stock_item_id
        );

        if (!stock) {
          missingCost = true;
        } else {
          const portionMultiplier =
            orderItem.portion_type === "half" ? 0.5 : 1;

          const converted = convertQuantity(
            Number(menuItem.stock_usage_quantity),
            menuItem.stock_usage_unit,
            stock.unit
          );

          lineCost =
            converted *
            Number(stock.cost_per_unit || 0) *
            Number(orderItem.quantity || 1) *
            portionMultiplier;
        }
      } else {
        missingCost = true;
      }

      const key =
        orderItem.menu_item_id?.toString() ??
        orderItem.product_name;

      const current = aggregated.get(key) ?? {
        productName: orderItem.product_name,
        quantity: 0,
        revenue: 0,
        cost: 0,
        missingCost: false,
      };

      current.quantity += Number(orderItem.quantity || 0);
      current.revenue += Number(orderItem.line_total || 0);
      current.cost += lineCost;
      current.missingCost =
        current.missingCost || missingCost;

      aggregated.set(key, current);
    });

    return Array.from(aggregated.values())
      .map((row) => ({
        ...row,
        profit: row.revenue - row.cost,
        margin:
          row.revenue > 0
            ? ((row.revenue - row.cost) / row.revenue) *
              100
            : 0,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [
    menuItems,
    orderItems,
    recipeItems,
    recipes,
    stockItems,
  ]);

  const summary = useMemo(() => {
    const revenue = orders.reduce((sum, order) => {
      if (order.payment_method === "internal") return sum;
      return sum + Number(order.total || 0);
    }, 0);

    const cost = productRows.reduce(
      (sum, row) => sum + row.cost,
      0
    );

    const missingCostProducts = productRows.filter(
      (row) => row.missingCost
    ).length;

    return {
      revenue,
      cost,
      profit: revenue - cost,
      margin:
        revenue > 0
          ? ((revenue - cost) / revenue) * 100
          : 0,
      missingCostProducts,
    };
  }, [orders, productRows]);

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Kârlılık Analizi
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Satış, reçete maliyeti ve tahmini brüt kâr
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/pos/recipes"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              Reçeteler
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

        <section className="mb-5 rounded-3xl border border-[#6e1f12]/10 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as DateMode)
              }
              className="rounded-xl border border-black/15 bg-white px-4 py-3"
            >
              <option value="today">Bugün</option>
              <option value="yesterday">Dün</option>
              <option value="sevenDays">Son 7 Gün</option>
              <option value="custom">
                Özel Tarih Aralığı
              </option>
            </select>

            {mode === "custom" && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) =>
                    setCustomStart(event.target.value)
                  }
                  className="rounded-xl border border-black/15 px-4 py-3"
                />

                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) =>
                    setCustomEnd(event.target.value)
                  }
                  className="rounded-xl border border-black/15 px-4 py-3"
                />
              </>
            )}

            {mode !== "custom" && (
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-xl border border-black/10 px-4 py-3 font-semibold"
              >
                Yenile
              </button>
            )}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center">
            Kârlılık hesaplanıyor...
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Card
                label="Net Satış"
                value={`${money(summary.revenue)} ₺`}
              />

              <Card
                label="Tahmini Maliyet"
                value={`${money(summary.cost)} ₺`}
              />

              <Card
                label="Brüt Kâr"
                value={`${money(summary.profit)} ₺`}
              />

              <Card
                label="Brüt Marj"
                value={`%${summary.margin.toFixed(1)}`}
              />

              <Card
                label="Eksik Maliyet"
                value={String(
                  summary.missingCostProducts
                )}
              />
            </section>

            {summary.missingCostProducts > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-700/20 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                Bazı ürünlerde reçete veya stok maliyeti
                eksik. Bu ürünlerin maliyeti sıfır
                göründüğü için toplam kâr olduğundan yüksek
                hesaplanabilir.
              </div>
            )}

            <section className="mt-5 overflow-hidden rounded-3xl border border-[#6e1f12]/10 bg-white">
              <div className="border-b border-black/8 px-5 py-4">
                <h2
                  className="text-xl font-bold text-[#6e1f12]"
                  style={{ fontFamily: BRAND_FONT }}
                >
                  Ürün Bazında Kârlılık
                </h2>
              </div>

              {productRows.length === 0 ? (
                <p className="p-8 text-center opacity-50">
                  Bu tarih aralığında satış kaydı yok.
                </p>
              ) : (
                <div className="divide-y divide-black/8">
                  {productRows.map((row) => (
                    <div
                      key={row.productName}
                      className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_auto_auto_auto_auto] md:items-center"
                    >
                      <div>
                        <p className="font-semibold">
                          {row.productName}
                        </p>

                        <p className="mt-1 text-xs opacity-50">
                          {row.quantity} satış
                          {row.missingCost
                            ? " · maliyet eksik"
                            : ""}
                        </p>
                      </div>

                      <Metric
                        label="Satış"
                        value={`${money(row.revenue)} ₺`}
                      />

                      <Metric
                        label="Maliyet"
                        value={`${money(row.cost)} ₺`}
                      />

                      <Metric
                        label="Kâr"
                        value={`${money(row.profit)} ₺`}
                      />

                      <Metric
                        label="Marj"
                        value={`%${row.margin.toFixed(1)}`}
                      />
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

function Card({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#6e1f12]/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide opacity-45">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold text-[#6e1f12]">
        {value}
      </p>
    </div>
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
    <div className="min-w-[110px] rounded-xl bg-[#f4efe5] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide opacity-45">
        {label}
      </p>

      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}