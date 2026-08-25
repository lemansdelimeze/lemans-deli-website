"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Dietary = "none" | "vegan" | "vegetarian";

type Category = {
  id: number;
  slug: string;
  name_tr: string;
  sort_order: number;
  active: boolean;
};

type MenuItem = {
  id: number;

  name: string | null;
  name_tr: string | null;
  description_tr: string | null;

  price: number | null;
  category: string | null;
  category_id: number | null;
  portion: string | null;

  calories_per_100g: number | null;
  calories_per_portion: number | null;

  allergens: string[] | null;
  dietary: Dietary | null;

  active: boolean;
  sort_order: number;
};

type CategoryGroup = {
  category: Category;
  items: MenuItem[];
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const DAILY_REFERENCE_KCAL = 2000;

const allergenLabels: Record<string, string> = {
  milk: "Süt",
  gluten: "Gluten",
  egg: "Yumurta",
  nuts: "Kuruyemiş",
  peanut: "Yer fıstığı",
  sesame: "Susam",
  celery: "Kereviz",
  soy: "Soya",
  mustard: "Hardal",
  fish: "Balık",
  shellfish: "Kabuklu deniz ürünü",
};

const dietaryLabels: Record<Dietary, string> = {
  none: "",
  vegan: "Vegan",
  vegetarian: "Vejetaryen",
};

function formatPrice(price: number) {
  return Number(price).toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });
}

function dailyReferencePercent(calories: number | null) {
  if (!calories || calories <= 0) return null;

  return Math.round(
    (calories / DAILY_REFERENCE_KCAL) * 100
  );
}

export default function PrintableMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);

    const [categoriesResult, itemsResult] =
      await Promise.all([
        supabase
          .from("categories")
          .select(
            "id, slug, name_tr, sort_order, active"
          )
          .eq("active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("menu_items")
          .select(
            `
              id,
              name,
              name_tr,
              description_tr,
              price,
              category,
              category_id,
              portion,
              calories_per_100g,
              calories_per_portion,
              allergens,
              dietary,
              active,
              sort_order
            `
          )
          .eq("active", true)
          .order("sort_order", { ascending: true }),
      ]);

    if (categoriesResult.error) {
      console.error(
        "PRINT CATEGORY ERROR:",
        categoriesResult.error
      );

      setError(
        `Kategoriler yüklenemedi: ${categoriesResult.error.message}`
      );

      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      console.error(
        "PRINT MENU ERROR:",
        itemsResult.error
      );

      setError(
        `Menü yüklenemedi: ${itemsResult.error.message}`
      );

      setLoading(false);
      return;
    }

    setCategories(
      (categoriesResult.data ?? []) as Category[]
    );

    setItems(
      (itemsResult.data ?? []) as MenuItem[]
    );

    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const groupedCategories = useMemo<CategoryGroup[]>(() => {
    return categories
      .map((category) => {
        const categoryItems = items
          .filter((item) => {
            if (item.category_id !== null) {
              return item.category_id === category.id;
            }

            return item.category === category.slug;
          })
          .sort(
            (first, second) =>
              first.sort_order - second.sort_order
          );

        return {
          category,
          items: categoryItems,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [categories, items]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] text-[#242820]">
        Menü hazırlanıyor...
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-6 text-center text-[#242820]">
        {error}
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #d8d2c8;
        }

        @media print {
          html,
          body {
            background: #f4efe5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          .print-sheet {
            margin: 0 !important;
            box-shadow: none !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          .menu-section {
            break-inside: auto;
            page-break-inside: auto;
          }

          .menu-item {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .menu-category-heading {
            break-after: avoid;
            page-break-after: avoid;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-50 flex items-center justify-between border-b border-[#6e1f12]/15 bg-[#f4efe5]/85 px-6 py-3 text-[#242820] backdrop-blur-md">
        <div>
          <strong style={{ fontFamily: BRAND_FONT }}>
            Leman&apos;s Deli
          </strong>

          <span className="ml-2 opacity-50">
            Baskı Önizleme
          </span>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-[#6e1f12] px-5 py-2 text-sm font-semibold text-white"
        >
          Yazdır / PDF Kaydet
        </button>
      </div>

      <main className="print-sheet relative mx-auto my-8 min-h-[297mm] w-[210mm] overflow-hidden bg-[#f4efe5] px-[14mm] py-[11mm] text-[#242820] shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
        >
          <img
            src="/logo.png"
            alt=""
            className="max-h-[180mm] w-[130mm] object-contain opacity-[0.022]"
          />
        </div>

        <div className="relative z-10">
          <header className="mb-[9mm] text-center">
            <img
              src="/logo-horizontal.png"
              alt="Leman's Deli"
              className="mx-auto block w-[94mm] object-contain"
            />

            <div className="mt-[4.5mm] flex items-center justify-center gap-[5mm]">
              <span className="h-px w-[32mm] bg-[#6e1f12]/22" />

              <div>
                <p
                  style={{ fontFamily: BRAND_FONT }}
                  className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#6e1f12]"
                >
                  Menü
                </p>

                <p
                  style={{ fontFamily: BRAND_FONT }}
                  className="mt-[1mm] text-[8px] uppercase tracking-[0.16em] text-[#242820]/45"
                >
                  Kaş
                </p>
              </div>

              <span className="h-px w-[32mm] bg-[#6e1f12]/22" />
            </div>
          </header>

          <div className="columns-2 gap-x-[11mm]">
            {groupedCategories.map((group) => (
              <MenuCategory
                key={group.category.id}
                title={group.category.name_tr}
                items={group.items}
              />
            ))}
          </div>

          <footer className="mt-[11mm] flex items-center justify-between border-t border-[#6e1f12]/18 pt-[3mm] text-[7px] tracking-[0.035em] text-[#242820]/48">
            <span>
              Günlük hazırlanır · Mevsimsel ürünlere göre
              çeşitler değişebilir.
            </span>

            <span style={{ fontFamily: BRAND_FONT }}>
              @lemansdeli · Kaş
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}

function MenuCategory({
  title,
  items,
}: {
  title: string;
  items: MenuItem[];
}) {
  return (
    <section className="menu-section">
      <div className="menu-category-heading mb-[2.5mm]">
        <h2
          style={{ fontFamily: BRAND_FONT }}
          className="text-[23px] font-semibold leading-none text-[#6e1f12]"
        >
          {title}
        </h2>

        <div className="mt-[2.2mm] h-px w-full bg-[#6e1f12]/18" />
      </div>

      <div className="space-y-[2.5mm]">
        {items.map((item) => {
          const name =
            item.name_tr ||
            item.name ||
            "İsimsiz ürün";

          const allergens = item.allergens ?? [];

          const dietary =
            item.dietary &&
            item.dietary !== "none"
              ? dietaryLabels[item.dietary]
              : "";

          const percentage =
            dailyReferencePercent(
              item.calories_per_portion
            );

          return (
            <article
              key={item.id}
              className="menu-item"
            >
              <div className="flex items-start justify-between gap-[2.5mm]">
                <div className="min-w-0 flex-1">
                  <h3
                    style={{
                      fontFamily: BRAND_FONT,
                      fontWeight: 700,
                    }}
                    className="text-[13px] leading-[1.2] text-[#6e1f12]"
                  >
                    {name}
                  </h3>

                  {item.portion && (
                    <p
                      style={{
                        fontFamily: BRAND_FONT,
                      }}
                      className="mt-[0.5mm] text-[8.5px] text-[#242820]/48"
                    >
                      {item.portion}
                    </p>
                  )}
                </div>

                {item.price !== null && (
                  <span
                    style={{
                      fontFamily: BRAND_FONT,
                    }}
                    className="shrink-0 text-[12px] font-semibold text-[#6e1f12]"
                  >
                    {formatPrice(item.price)} ₺
                  </span>
                )}
              </div>

              {item.description_tr && (
                <p className="mt-[1.25mm] max-w-[96%] text-[8.2px] leading-[1.5] text-[#242820]/58">
                  {item.description_tr}
                </p>
              )}

              {(dietary ||
                allergens.length > 0 ||
                item.calories_per_portion !== null) && (
                <div className="mt-[1.25mm] flex flex-wrap gap-x-[2.2mm] gap-y-[1mm] text-[6.8px] uppercase tracking-[0.06em]">
                  {dietary && (
                    <span
                      style={{
                        fontFamily: BRAND_FONT,
                      }}
                      className="font-semibold text-[#6e1f12]"
                    >
                      {dietary}
                    </span>
                  )}

                  {allergens.length > 0 && (
                    <span className="text-[#242820]/48">
                      Alerjen:{" "}
                      {allergens
                        .map(
                          (allergen) =>
                            allergenLabels[allergen] ??
                            allergen
                        )
                        .join(" · ")}
                    </span>
                  )}

                  {item.calories_per_portion !== null && (
                    <span className="text-[#242820]/48">
                      {item.calories_per_portion} kcal
                      {percentage !== null &&
                        ` · %${percentage} referans`}
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}