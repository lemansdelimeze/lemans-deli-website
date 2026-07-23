"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Category =
  | "meze"
  | "zeytinyagli"
  | "sandvic"
  | "sarkuteri"
  | "peynir"
  | "icecek";

type Dietary = "none" | "vegan" | "vegetarian";

type MenuItem = {
  id: number;

  name: string | null;
  name_tr: string | null;
  name_en: string | null;
  name_ru: string | null;

  description_tr: string | null;
  description_en: string | null;
  description_ru: string | null;

  price: number | null;
  category: Category;
  portion: string | null;

  calories_per_100g: number | null;
  calories_per_portion: number | null;

  allergens: string[] | null;
  dietary: Dietary | null;
  spicy_level: number | null;

  active: boolean;
  sort_order: number;
};

const DAILY_REFERENCE_KCAL = 2000;

const categoryLabels: Record<Category, string> = {
  meze: "Mezeler",
  zeytinyagli: "Zeytinyağlılar",
  sandvic: "Sandviçler",
  sarkuteri: "Şarküteri",
  peynir: "Peynirler",
  icecek: "İçecekler",
};

const categoryOrder: Category[] = [
  "meze",
  "zeytinyagli",
  "sandvic",
  "sarkuteri",
  "peynir",
  "icecek",
];

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

function dailyReferencePercent(calories: number | null) {
  if (!calories || calories <= 0) return null;

  return Math.round(
    (calories / DAILY_REFERENCE_KCAL) * 100
  );
}

function formatPrice(price: number) {
  return Number(price).toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });
}

export default function TvMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMenu() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("SUPABASE ERROR:", error);

      setError(
        `Menü yüklenemedi: ${error.message}`
      );

      setLoading(false);
      return;
    }

    setItems((data ?? []) as MenuItem[]);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    loadMenu();

    const channel = supabase
      .channel("tv-menu-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
        },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const groupedItems = useMemo(() => {
    return categoryOrder.map((category) => ({
      category,

      items: items
        .filter(
          (item) =>
            item.category === category
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order
        ),
    }));
  }, [items]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center">
        <p className="text-2xl">
          Menü yükleniyor...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center px-6 text-center">
        <p className="text-2xl">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#f4efe5] text-[#242820] overflow-hidden">

      {/* WATERMARK */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      >
        <img
          src="/logo.png"
          alt=""
          className="w-[42vw] max-w-[720px] max-h-[70vh] object-contain opacity-[0.035]"
        />
      </div>

      <div className="relative z-10 min-h-screen px-[4vw] py-[3vh]">

        {/* HEADER */}
        <header className="flex items-end justify-between border-b border-[#6e1f12]/25 pb-[1.8vh] mb-[3vh]">

          <div>
            <p className="text-[1vw] uppercase tracking-[0.35em] text-[#6e1f12] mb-[0.6vh]">
              Kaş
            </p>

            <h1 className="text-[3.8vw] leading-none font-semibold tracking-tight text-[#6e1f12]">
              Leman&apos;s Deli
            </h1>
          </div>

          <div className="text-right max-w-[32vw]">
            <p className="text-[1.15vw] leading-snug">
              Günlük hazırlanan mezeler,
            </p>

            <p className="text-[1.15vw] leading-snug">
              seçkin şarküteri ve gurme ürünler
            </p>
          </div>

        </header>

        {/* MENU */}
        <div className="grid grid-cols-2 gap-x-[5vw] gap-y-[3.5vh]">

          {groupedItems.map(
            ({
              category,
              items: categoryItems,
            }) => {
              if (
                categoryItems.length === 0
              ) {
                return null;
              }

              return (
                <section key={category}>

                  <h2 className="text-[2.15vw] font-semibold mb-[1.5vh] text-[#6e1f12]">
                    {
                      categoryLabels[
                        category
                      ]
                    }
                  </h2>

                  <div className="space-y-[1.35vh]">

                    {categoryItems.map(
                      (item) => {
                        const displayName =
                          item.name_tr ||
                          item.name ||
                          "İsimsiz ürün";

                        const description =
                          item.description_tr?.trim() ||
                          "";

                        const allergens =
                          item.allergens ??
                          [];

                        const dietary =
                          item.dietary &&
                          item.dietary !==
                            "none"
                            ? dietaryLabels[
                                item
                                  .dietary
                              ]
                            : "";

                        const percentage =
                          dailyReferencePercent(
                            item.calories_per_portion
                          );

                        return (
                          <article
                            key={
                              item.id
                            }
                            className="border-b border-[#242820]/10 pb-[1.15vh]"
                          >

                            {/* NAME + PRICE */}
                            <div className="flex items-baseline text-[1.32vw] leading-none">

                              <span className="font-semibold whitespace-nowrap">

                                {
                                  displayName
                                }

                                {item.portion && (
                                  <span className="font-normal opacity-60">
                                    {" "}
                                    ·{" "}
                                    {
                                      item.portion
                                    }
                                  </span>
                                )}

                              </span>

                              <span className="mx-[0.7vw] border-b border-dotted border-[#242820]/30 flex-1 translate-y-[-0.15em]" />

                              {item.price !== null && (
                                <span className="font-semibold whitespace-nowrap text-[#6e1f12]">
                                  {formatPrice(
                                    item.price
                                  )}{" "}
                                  ₺
                                </span>
                              )}

                            </div>

                            {/* DESCRIPTION */}
                            {description && (
                              <p className="mt-[0.65vh] text-[0.88vw] leading-[1.35] opacity-65 max-w-[94%]">
                                {
                                  description
                                }
                              </p>
                            )}

                            {/* CALORIES */}
                            {item.calories_per_portion !==
                              null && (
                              <p className="mt-[0.5vh] text-[0.72vw] text-[#6e1f12]/80">
                                {
                                  item.calories_per_portion
                                }{" "}
                                kcal
                                {percentage !==
                                  null &&
                                  ` · 2.000 kcal referansın %${percentage}'i`}
                              </p>
                            )}

                            {/* LABELS */}
                            {(dietary ||
                              allergens.length >
                                0) && (
                              <div className="mt-[0.5vh] flex flex-wrap gap-x-[0.7vw] gap-y-[0.2vh] text-[0.68vw] uppercase tracking-[0.08em]">

                                {dietary && (
                                  <span className="text-[#6e1f12] font-semibold">
                                    {
                                      dietary
                                    }
                                  </span>
                                )}

                                {allergens.length >
                                  0 && (
                                  <span className="opacity-55">
                                    Alerjen:{" "}
                                    {allergens
                                      .map(
                                        (
                                          allergen
                                        ) =>
                                          allergenLabels[
                                            allergen
                                          ] ??
                                          allergen
                                      )
                                      .join(
                                        " · "
                                      )}
                                  </span>
                                )}

                              </div>
                            )}

                          </article>
                        );
                      }
                    )}

                  </div>

                </section>
              );
            }
          )}

        </div>

        {/* FOOTER */}
        <footer className="border-t border-[#6e1f12]/25 mt-[3.5vh] pt-[1.5vh] flex justify-between items-center text-[0.85vw]">

          <span>
            Günlük hazırlanır · paylaşmak için tasarlanır
          </span>

          <span>
            @lemansdeli
          </span>

        </footer>

      </div>
    </main>
  );
}