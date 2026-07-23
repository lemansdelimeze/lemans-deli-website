"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Language = "tr" | "en" | "ru";

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

  image_url: string | null;

  active: boolean;
  sort_order: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const DAILY_REFERENCE_KCAL = 2000;

const categories: Category[] = [
  "meze",
  "zeytinyagli",
  "sandvic",
  "sarkuteri",
  "peynir",
  "icecek",
];

const categoryLabels: Record<
  Language,
  Record<Category, string>
> = {
  tr: {
    meze: "Mezeler",
    zeytinyagli: "Zeytinyağlılar",
    sandvic: "Sandviçler",
    sarkuteri: "Şarküteri",
    peynir: "Peynirler",
    icecek: "İçecekler",
  },

  en: {
    meze: "Meze",
    zeytinyagli: "Olive Oil Dishes",
    sandvic: "Sandwiches",
    sarkuteri: "Charcuterie",
    peynir: "Cheeses",
    icecek: "Drinks",
  },

  ru: {
    meze: "Мезе",
    zeytinyagli: "Блюда с оливковым маслом",
    sandvic: "Сэндвичи",
    sarkuteri: "Деликатесы",
    peynir: "Сыры",
    icecek: "Напитки",
  },
};

const allergenLabels: Record<
  Language,
  Record<string, string>
> = {
  tr: {
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
  },

  en: {
    milk: "Milk",
    gluten: "Gluten",
    egg: "Egg",
    nuts: "Tree nuts",
    peanut: "Peanut",
    sesame: "Sesame",
    celery: "Celery",
    soy: "Soy",
    mustard: "Mustard",
    fish: "Fish",
    shellfish: "Shellfish",
  },

  ru: {
    milk: "Молоко",
    gluten: "Глютен",
    egg: "Яйцо",
    nuts: "Орехи",
    peanut: "Арахис",
    sesame: "Кунжут",
    celery: "Сельдерей",
    soy: "Соя",
    mustard: "Горчица",
    fish: "Рыба",
    shellfish: "Моллюски / ракообразные",
  },
};

const dietaryLabels: Record<
  Language,
  Record<Dietary, string>
> = {
  tr: {
    none: "",
    vegan: "Vegan",
    vegetarian: "Vejetaryen",
  },

  en: {
    none: "",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
  },

  ru: {
    none: "",
    vegan: "Веган",
    vegetarian: "Вегетарианское",
  },
};

const uiText = {
  tr: {
    eyebrow: "Bugün Leman's Deli'de",
    title: "Günlük Menü",
    subtitle:
      "Günlük hazırlanan mezeler, zeytinyağlılar, sandviçler ve seçili şarküteri ürünleri.",
    all: "Tümü",
    allergen: "Alerjen",
    kcalReference: "günlük referansın",
    empty: "Bugün bu kategoride aktif ürün bulunmuyor.",
    loading: "Menü yükleniyor...",
    error: "Menü yüklenemedi.",
    seasonal:
      "Çeşitler günlük ve mevsimsel olarak değişebilir.",
  },

  en: {
    eyebrow: "Today at Leman's Deli",
    title: "Daily Menu",
    subtitle:
      "Freshly prepared meze, olive oil dishes, sandwiches and selected deli products.",
    all: "All",
    allergen: "Allergen",
    kcalReference: "of daily reference intake",
    empty: "There are no active items in this category today.",
    loading: "Loading menu...",
    error: "Menu could not be loaded.",
    seasonal:
      "Selections may change daily and seasonally.",
  },

  ru: {
    eyebrow: "Сегодня в Leman's Deli",
    title: "Меню на сегодня",
    subtitle:
      "Свежие мезе, блюда с оливковым маслом, сэндвичи и избранные деликатесы.",
    all: "Все",
    allergen: "Аллерген",
    kcalReference: "от суточной нормы",
    empty: "Сегодня в этой категории нет активных позиций.",
    loading: "Меню загружается...",
    error: "Не удалось загрузить меню.",
    seasonal:
      "Ассортимент может меняться ежедневно и сезонно.",
  },
};

function formatPrice(price: number) {
  return Number(price).toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });
}

function dailyReferencePercent(
  calories: number | null
) {
  if (!calories || calories <= 0) {
    return null;
  }

  return Math.round(
    (calories / DAILY_REFERENCE_KCAL) * 100
  );
}

function getName(
  item: MenuItem,
  language: Language
) {
  if (language === "en") {
    return (
      item.name_en ||
      item.name_tr ||
      item.name ||
      ""
    );
  }

  if (language === "ru") {
    return (
      item.name_ru ||
      item.name_tr ||
      item.name ||
      ""
    );
  }

  return (
    item.name_tr ||
    item.name ||
    ""
  );
}

function getDescription(
  item: MenuItem,
  language: Language
) {
  if (language === "en") {
    return (
      item.description_en ||
      item.description_tr ||
      ""
    );
  }

  if (language === "ru") {
    return (
      item.description_ru ||
      item.description_tr ||
      ""
    );
  }

  return (
    item.description_tr ||
    ""
  );
}

export default function MenuPage() {
  const [items, setItems] =
    useState<MenuItem[]>([]);

  const [language, setLanguage] =
    useState<Language>("tr");

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState<Category | "all">(
    "all"
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  async function loadMenu() {
    const {
      data,
      error,
    } = await supabase
      .from("menu_items")
      .select("*")
      .eq("active", true)
      .order("category", {
        ascending: true,
      })
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      console.error(
        "PUBLIC MENU ERROR:",
        error
      );

      setError(
        error.message
      );

      setLoading(false);
      return;
    }

    setItems(
      (data ??
        []) as MenuItem[]
    );

    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    loadMenu();

    const channel =
      supabase
        .channel(
          "public-menu-live"
        )
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
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  const availableCategories =
    useMemo(() => {
      return categories.filter(
        (category) =>
          items.some(
            (item) =>
              item.category ===
              category
          )
      );
    }, [items]);

  const visibleGroups =
    useMemo(() => {
      const groupCategories =
        selectedCategory ===
        "all"
          ? availableCategories
          : [
              selectedCategory,
            ];

      return groupCategories
        .map((category) => ({
          category,

          items: items
            .filter(
              (item) =>
                item.category ===
                category
            )
            .sort(
              (a, b) =>
                a.sort_order -
                b.sort_order
            ),
        }))
        .filter(
          (group) =>
            group.items.length >
            0
        );
    }, [
      items,
      selectedCategory,
      availableCategories,
    ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4efe5] flex items-center justify-center text-[#292821]">
        <p
          style={{
            fontFamily:
              BRAND_FONT,
          }}
          className="text-lg"
        >
          {
            uiText[
              language
            ].loading
          }
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4efe5] flex items-center justify-center px-6 text-center text-[#292821]">
        <div>
          <p
            style={{
              fontFamily:
                BRAND_FONT,
            }}
            className="text-xl text-[#6e1f12]"
          >
            {
              uiText[
                language
              ].error
            }
          </p>

          <p className="mt-2 text-sm opacity-55">
            {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4efe5] text-[#292821]">

      {/* WATERMARK */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
      >
        <img
          src="/logo.png"
          alt=""
          className="w-[78vw] max-w-[760px] opacity-[0.025]"
        />
      </div>

      <div className="relative z-10">

        {/* HEADER */}
        <header className="border-b border-[#6e1f12]/12 bg-[#f4efe5]/88 backdrop-blur-md">

          <div className="mx-auto max-w-7xl px-5 py-5 md:px-8">

            <div className="flex items-center justify-between gap-5">

              <a
                href="/"
                className="block"
              >
                <img
                  src="/logo-horizontal.png"
                  alt="Leman's Deli"
                  className="w-[185px] md:w-[235px]"
                />
              </a>

              <div className="flex rounded-full border border-[#6e1f12]/15 bg-white/55 p-1">

                {(
                  [
                    "tr",
                    "en",
                    "ru",
                  ] as Language[]
                ).map(
                  (
                    lang
                  ) => (
                    <button
                      key={
                        lang
                      }
                      type="button"
                      onClick={() =>
                        setLanguage(
                          lang
                        )
                      }
                      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase transition ${
                        language ===
                        lang
                          ? "bg-[#6e1f12] text-white"
                          : "text-[#6e1f12]"
                      }`}
                    >
                      {
                        lang
                      }
                    </button>
                  )
                )}

              </div>
            </div>

          </div>

        </header>

        {/* INTRO */}
        <section className="mx-auto max-w-7xl px-5 pb-7 pt-9 md:px-8 md:pb-10 md:pt-14">

          <p
            style={{
              fontFamily:
                BRAND_FONT,
            }}
            className="text-[11px] uppercase tracking-[0.18em] text-[#6e1f12]/70 md:text-xs"
          >
            {
              uiText[
                language
              ].eyebrow
            }
          </p>

          <h1
            style={{
              fontFamily:
                BRAND_FONT,
              fontWeight: 700,
            }}
            className="mt-3 text-4xl leading-none text-[#6e1f12] md:text-6xl"
          >
            {
              uiText[
                language
              ].title
            }
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-6 text-[#292821]/62 md:text-base md:leading-7">
            {
              uiText[
                language
              ].subtitle
            }
          </p>

        </section>

        {/* CATEGORY NAV */}
        <div className="sticky top-0 z-30 border-y border-[#6e1f12]/10 bg-[#f4efe5]/92 backdrop-blur-xl">

          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3 md:px-8">

            <CategoryButton
              active={
                selectedCategory ===
                "all"
              }
              onClick={() =>
                setSelectedCategory(
                  "all"
                )
              }
            >
              {
                uiText[
                  language
                ].all
              }
            </CategoryButton>

            {availableCategories.map(
              (
                category
              ) => (
                <CategoryButton
                  key={
                    category
                  }
                  active={
                    selectedCategory ===
                    category
                  }
                  onClick={() =>
                    setSelectedCategory(
                      category
                    )
                  }
                >
                  {
                    categoryLabels[
                      language
                    ][
                      category
                    ]
                  }
                </CategoryButton>
              )
            )}

          </div>

        </div>

        {/* MENU */}
        <section className="mx-auto max-w-7xl px-5 py-9 md:px-8 md:py-12">

          <div className="space-y-14 md:space-y-20">

            {visibleGroups.map(
              (
                group
              ) => (
                <section
                  key={
                    group.category
                  }
                >

                  <div className="mb-6 flex items-end justify-between gap-4 border-b border-[#6e1f12]/15 pb-3">

                    <h2
                      style={{
                        fontFamily:
                          BRAND_FONT,
                        fontWeight:
                          700,
                      }}
                      className="text-2xl text-[#6e1f12] md:text-4xl"
                    >
                      {
                        categoryLabels[
                          language
                        ][
                          group.category
                        ]
                      }
                    </h2>

                    <span className="text-xs uppercase tracking-[0.14em] text-[#292821]/35">
                      {
                        group.items.length
                      }
                    </span>

                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

                    {group.items.map(
                      (
                        item
                      ) => (
                        <ProductCard
                          key={
                            item.id
                          }
                          item={
                            item
                          }
                          language={
                            language
                          }
                        />
                      )
                    )}

                  </div>

                </section>
              )
            )}

          </div>

        </section>

        {/* FOOTER */}
        <footer className="border-t border-[#6e1f12]/12 px-5 py-8 md:px-8">

          <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[#292821]/50 md:flex-row md:items-center md:justify-between">

            <span>
              {
                uiText[
                  language
                ].seasonal
              }
            </span>

            <span
              style={{
                fontFamily:
                  BRAND_FONT,
              }}
              className="text-[#6e1f12]/75"
            >
              @lemansdeli · Kaş
            </span>

          </div>

        </footer>

      </div>
    </main>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;

  onClick: () => void;

  children:
    React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        fontFamily:
          BRAND_FONT,
      }}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-[#6e1f12] bg-[#6e1f12] text-white"
          : "border-[#6e1f12]/14 bg-white/45 text-[#6e1f12]"
      }`}
    >
      {children}
    </button>
  );
}

function ProductCard({
  item,
  language,
}: {
  item: MenuItem;
  language: Language;
}) {
  const name =
    getName(
      item,
      language
    );

  const description =
    getDescription(
      item,
      language
    );

  const allergens =
    item.allergens ??
    [];

  const dietary =
    item.dietary &&
    item.dietary !==
      "none"
      ? dietaryLabels[
          language
        ][
          item.dietary
        ]
      : "";

  const percentage =
    dailyReferencePercent(
      item.calories_per_portion
    );

  return (
    <article className="group overflow-hidden rounded-[26px] border border-[#6e1f12]/10 bg-[#fbf8f2]/82 shadow-[0_10px_35px_rgba(45,35,25,0.045)] backdrop-blur-sm">

      {/* IMAGE */}
      {item.image_url && (
        <div className="aspect-[4/3] overflow-hidden bg-[#ece5d8]">
          <img
            src={
              item.image_url
            }
            alt={
              name
            }
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        </div>
      )}

      {/* CONTENT */}
      <div className="p-5 md:p-6">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <h3
              style={{
                fontFamily:
                  BRAND_FONT,
                fontWeight:
                  700,
              }}
              className="text-[21px] leading-[1.18] text-[#6e1f12]"
            >
              {name}
            </h3>

            {item.portion && (
              <p
                style={{
                  fontFamily:
                    BRAND_FONT,
                }}
                className="mt-1.5 text-[12px] text-[#292821]/42"
              >
                {
                  item.portion
                }
              </p>
            )}

          </div>

          {item.price !==
            null && (
            <span
              style={{
                fontFamily:
                  BRAND_FONT,
                fontWeight:
                  700,
              }}
              className="shrink-0 text-lg text-[#6e1f12]"
            >
              {formatPrice(
                item.price
              )}{" "}
              ₺
            </span>
          )}

        </div>

        {description && (
          <p className="mt-4 text-sm leading-[1.65] text-[#292821]/62">
            {
              description
            }
          </p>
        )}

        {(dietary ||
          allergens.length >
            0) && (
          <div className="mt-5 flex flex-wrap gap-2">

            {dietary && (
              <span
                style={{
                  fontFamily:
                    BRAND_FONT,
                }}
                className="rounded-full bg-[#6e1f12]/8 px-3 py-1.5 text-[11px] font-semibold text-[#6e1f12]"
              >
                {
                  dietary
                }
              </span>
            )}

            {allergens.map(
              (
                allergen
              ) => (
                <span
                  key={
                    allergen
                  }
                  className="rounded-full border border-[#292821]/8 bg-white/60 px-3 py-1.5 text-[10px] text-[#292821]/55"
                >
                  {
                    allergenLabels[
                      language
                    ][
                      allergen
                    ] ??
                    allergen
                  }
                </span>
              )
            )}

          </div>
        )}

        {(item.calories_per_portion !==
          null ||
          item.calories_per_100g !==
            null) && (
          <div className="mt-5 border-t border-[#6e1f12]/10 pt-4 text-[11px] leading-5 text-[#292821]/45">

            {item.calories_per_portion !==
              null && (
              <span>
                {
                  item.calories_per_portion
                }{" "}
                kcal

                {percentage !==
                  null &&
                  ` · %${percentage} ${
                    uiText[
                      language
                    ]
                      .kcalReference
                  }`}
              </span>
            )}

            {item.calories_per_portion !==
              null &&
              item.calories_per_100g !==
                null && (
                <span>
                  {" "}
                  ·{" "}
                </span>
              )}

            {item.calories_per_100g !==
              null && (
              <span>
                {
                  item.calories_per_100g
                }{" "}
                kcal / 100 g
              </span>
            )}

          </div>
        )}

      </div>
    </article>
  );
}