"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";

import Accordion from "../../components/menu/Accordion";
import ProductRow from "../../components/menu/ProductRow";
import ProductDetail from "../../components/menu/ProductDetail";

type Language = "tr" | "en" | "ru";
type Dietary = "none" | "vegan" | "vegetarian";

type Category = {
  id: number;
  slug: string;
  name_tr: string;
  name_en: string;
  name_ru: string;
  sort_order: number;
  active: boolean;
};

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
  portion: string | null;

  category: string | null;
  category_id: number | null;

  calories_per_100g: number | null;
  calories_per_portion: number | null;

  allergens: string[] | null;
  dietary: Dietary | null;
  spicy_level: number | null;

  image_url: string | null;

  active: boolean;
  sort_order: number;
};

type GroupedCategory = {
  category: Category;
  items: MenuItem[];
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const texts = {
  tr: {
    title: "Günün Menüsü",
    subtitle:
      "Günlük hazırlanan mezeler, şarküteri ürünleri, sandviçler, sosisliler ve tostlar.",
    loading: "Menü yükleniyor...",
    error: "Menü şu anda yüklenemiyor.",
    emptyMenu: "Bugün için görüntülenecek ürün bulunmuyor.",
    emptyCategory: "Bu kategoride bugün ürün bulunmuyor.",
    productCount: "ürün",
    portion: "Porsiyon",
    calories: "Porsiyon kalorisi",
    calories100: "100 g kalori",
    allergens: "Alerjenler",
    dietary: "Beslenme",
    spicy: "Acılık",
    vegan: "Vegan",
    vegetarian: "Vejetaryen",
    noAllergen: "Belirtilen alerjen yok",
    closeCategory: "Kategoriyi Kapat",
    home: "Ana Sayfa",
    homeInfo:
      "Leman's Deli'nin hikâyesi, galerisi ve iletişim bilgileri",
    spicyLevels: [
      "Acısız",
      "Hafif acılı",
      "Acılı",
      "Çok acılı",
    ],
    footer:
      "Çeşitler günlük üretim ve stok durumuna göre değişebilir.",
  },

  en: {
    title: "Today’s Menu",
    subtitle:
      "Fresh meze, delicatessen products, sandwiches, hot dogs and toasted sandwiches.",
    loading: "Loading menu...",
    error: "The menu is currently unavailable.",
    emptyMenu: "There are no products to display today.",
    emptyCategory:
      "No products are available in this category today.",
    productCount: "items",
    portion: "Portion",
    calories: "Calories per portion",
    calories100: "Calories per 100 g",
    allergens: "Allergens",
    dietary: "Dietary",
    spicy: "Spice level",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    noAllergen: "No allergens specified",
    closeCategory: "Close Category",
    home: "Home",
    homeInfo:
      "Our story, gallery and contact information",
    spicyLevels: [
      "Not spicy",
      "Mildly spicy",
      "Spicy",
      "Very spicy",
    ],
    footer:
      "Selections may vary depending on daily production and availability.",
  },

  ru: {
    title: "Меню на сегодня",
    subtitle:
      "Свежие мезе, деликатесы, сэндвичи, хот-доги и тосты.",
    loading: "Меню загружается...",
    error: "Меню временно недоступно.",
    emptyMenu: "Сегодня нет доступных позиций.",
    emptyCategory:
      "Сегодня в этой категории нет доступных блюд.",
    productCount: "позиций",
    portion: "Порция",
    calories: "Калории на порцию",
    calories100: "Калории на 100 г",
    allergens: "Аллергены",
    dietary: "Тип питания",
    spicy: "Острота",
    vegan: "Веган",
    vegetarian: "Вегетарианское",
    noAllergen: "Аллергены не указаны",
    closeCategory: "Закрыть категорию",
    home: "Главная",
    homeInfo:
      "Наша история, галерея и контактная информация",
    spicyLevels: [
      "Не острое",
      "Слегка острое",
      "Острое",
      "Очень острое",
    ],
    footer:
      "Ассортимент может меняться в зависимости от ежедневного производства и наличия.",
  },
} satisfies Record<
  Language,
  Record<string, string | string[]>
>;

const allergenLabels: Record<
  Language,
  Record<string, string>
> = {
  tr: {
    milk: "Süt",
    dairy: "Süt ürünü",
    gluten: "Gluten",
    egg: "Yumurta",
    eggs: "Yumurta",
    nuts: "Kuruyemiş",
    peanut: "Yer fıstığı",
    peanuts: "Yer fıstığı",
    sesame: "Susam",
    celery: "Kereviz",
    soy: "Soya",
    mustard: "Hardal",
    fish: "Balık",
    shellfish: "Kabuklu deniz ürünü",
  },

  en: {
    milk: "Milk",
    dairy: "Dairy",
    gluten: "Gluten",
    egg: "Egg",
    eggs: "Egg",
    nuts: "Nuts",
    peanut: "Peanut",
    peanuts: "Peanut",
    sesame: "Sesame",
    celery: "Celery",
    soy: "Soy",
    mustard: "Mustard",
    fish: "Fish",
    shellfish: "Shellfish",
  },

  ru: {
    milk: "Молоко",
    dairy: "Молочные продукты",
    gluten: "Глютен",
    egg: "Яйцо",
    eggs: "Яйцо",
    nuts: "Орехи",
    peanut: "Арахис",
    peanuts: "Арахис",
    sesame: "Кунжут",
    celery: "Сельдерей",
    soy: "Соя",
    mustard: "Горчица",
    fish: "Рыба",
    shellfish: "Морепродукты",
  },
};

function getCategoryName(
  category: Category,
  language: Language
) {
  if (language === "en") {
    return category.name_en || category.name_tr;
  }

  if (language === "ru") {
    return category.name_ru || category.name_tr;
  }

  return category.name_tr;
}

function getProductName(
  item: MenuItem,
  language: Language
) {
  if (language === "en") {
    return (
      item.name_en ||
      item.name_tr ||
      item.name ||
      "Unnamed product"
    );
  }

  if (language === "ru") {
    return (
      item.name_ru ||
      item.name_tr ||
      item.name ||
      "Без названия"
    );
  }

  return item.name_tr || item.name || "İsimsiz ürün";
}

function getProductDescription(
  item: MenuItem,
  language: Language
) {
  if (language === "en") {
    return item.description_en || item.description_tr || "";
  }

  if (language === "ru") {
    return item.description_ru || item.description_tr || "";
  }

  return item.description_tr || "";
}

function getDietaryLabel(
  dietary: Dietary | null,
  language: Language
) {
  if (dietary === "vegan") {
    return texts[language].vegan as string;
  }

  if (dietary === "vegetarian") {
    return texts[language].vegetarian as string;
  }

  return null;
}

function getAllergenLabels(
  allergens: string[] | null,
  language: Language
) {
  return (allergens ?? []).map((allergen) => {
    const normalized = allergen.trim().toLowerCase();

    return (
      allergenLabels[language][normalized] ||
      allergen.trim()
    );
  });
}

function normalizeSpicyLevel(value: number | null) {
  return Math.max(0, Math.min(value ?? 0, 3));
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>(
    []
  );

  const [items, setItems] = useState<MenuItem[]>([]);

  const [language, setLanguage] =
    useState<Language>("tr");

  const [openCategoryId, setOpenCategoryId] =
    useState<number | null>(null);

  const [openProductId, setOpenProductId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const categoryRefs = useRef<
    Record<number, HTMLDivElement | null>
  >({});

  const loadMenu = useCallback(async () => {
    const [categoriesResult, itemsResult] =
      await Promise.all([
        supabase
          .from("categories")
          .select(
            "id, slug, name_tr, name_en, name_ru, sort_order, active"
          )
          .eq("active", true)
          .order("sort_order", {
            ascending: true,
          }),

        supabase
          .from("menu_items")
          .select(
            `
              id,
              name,
              name_tr,
              name_en,
              name_ru,
              description_tr,
              description_en,
              description_ru,
              price,
              portion,
              category,
              category_id,
              calories_per_100g,
              calories_per_portion,
              allergens,
              dietary,
              spicy_level,
              image_url,
              active,
              sort_order
            `
          )
          .eq("active", true)
          .order("sort_order", {
            ascending: true,
          }),
      ]);

    if (categoriesResult.error) {
      console.error(
        "CATEGORY ERROR:",
        categoriesResult.error
      );

      setError(categoriesResult.error.message);
      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      console.error(
        "MENU ERROR:",
        itemsResult.error
      );

      setError(itemsResult.error.message);
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

    const menuChannel = supabase
      .channel("public-menu-items-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
        },
        () => {
          void loadMenu();
        }
      )
      .subscribe();

    const categoryChannel = supabase
      .channel("public-menu-categories-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
        },
        () => {
          void loadMenu();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(menuChannel);
      void supabase.removeChannel(categoryChannel);
    };
  }, [loadMenu]);

  const groupedCategories =
    useMemo<GroupedCategory[]>(() => {
      return categories.map((category) => {
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
      });
    }, [categories, items]);

  useEffect(() => {
    if (groupedCategories.length === 0) {
      setOpenCategoryId(null);
      setOpenProductId(null);
      return;
    }

    if (openCategoryId === null) {
      return;
    }

    const currentCategoryStillExists =
      groupedCategories.some(
        (group) =>
          group.category.id === openCategoryId
      );

    if (!currentCategoryStillExists) {
      setOpenCategoryId(null);
      setOpenProductId(null);
    }
  }, [groupedCategories, openCategoryId]);

  function toggleCategory(categoryId: number) {
    setOpenCategoryId((current) =>
      current === categoryId ? null : categoryId
    );

    setOpenProductId(null);
  }

  function goToCategory(categoryId: number) {
    setOpenCategoryId(categoryId);
    setOpenProductId(null);

    window.setTimeout(() => {
      categoryRefs.current[
        categoryId
      ]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  function closeCategory(categoryId: number) {
    setOpenCategoryId(null);
    setOpenProductId(null);

    window.setTimeout(() => {
      categoryRefs.current[
        categoryId
      ]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setOpenProductId(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#6e1f12]/15 border-t-[#6e1f12]" />

          <p
            className="text-lg text-[#6e1f12]"
            style={{
              fontFamily: BRAND_FONT,
            }}
          >
            {texts[language].loading as string}
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-5">
        <p
          className="text-center text-lg text-[#6e1f12]"
          style={{
            fontFamily: BRAND_FONT,
          }}
        >
          {texts[language].error as string}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] text-[#292821]">
      <header className="sticky top-0 z-40 border-b border-[#6e1f12]/15 bg-[#f4efe5]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <img
              src="/logo-horizontal.png"
              alt="Leman's Deli"
              className="h-20 w-auto max-w-full object-contain object-left sm:h-24"
            />
          </div>

          <a
            href="/home"
            className="hidden shrink-0 rounded-full border border-[#6e1f12]/20 bg-white/60 px-4 py-2 text-sm font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white sm:block"
          >
            🏠 {texts[language].home as string}
          </a>

          <div
            className="flex shrink-0 rounded-full border border-[#6e1f12]/15 bg-white/60 p-1"
            aria-label="Dil seçimi"
          >
            {(["tr", "en", "ru"] as Language[]).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    changeLanguage(option)
                  }
                  aria-pressed={language === option}
                  className={`rounded-full px-2.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                    language === option
                      ? "bg-[#6e1f12] text-white"
                      : "text-[#6e1f12] hover:bg-[#6e1f12]/5"
                  }`}
                >
                  {option.toUpperCase()}
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-7 md:px-8 md:py-10">
        <a
          href="/home"
          className="mx-auto mb-7 block max-w-3xl rounded-2xl border border-[#6e1f12]/10 bg-white/60 px-5 py-4 text-center transition hover:border-[#6e1f12]/25 hover:bg-white/80"
        >
          <span className="block text-sm font-bold text-[#6e1f12] sm:hidden">
            🏠 {texts[language].home as string}
          </span>

          <span className="mt-1 block text-xs leading-5 text-[#6e1f12]/65 sm:mt-0 sm:text-sm">
            {texts[language].homeInfo as string}
          </span>
        </a>

        <section className="mb-7 text-center md:mb-9">
          <h1
            className="text-3xl font-bold text-[#6e1f12] md:text-5xl"
            style={{
              fontFamily: BRAND_FONT,
            }}
          >
            {texts[language].title as string}
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#292821]/55 md:text-base">
            {texts[language].subtitle as string}
          </p>
        </section>

        {groupedCategories.length > 0 && (
          <nav className="sticky top-[112px] z-30 -mx-4 mb-5 border-y border-[#6e1f12]/10 bg-[#f4efe5]/95 px-4 py-3 backdrop-blur sm:top-[128px] md:-mx-8 md:px-8">
            <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto pb-1">
              {groupedCategories.map(
                ({ category }) => {
                  const selected =
                    openCategoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        goToCategory(category.id)
                      }
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${
                        selected
                          ? "border-[#6e1f12] bg-[#6e1f12] text-white"
                          : "border-[#6e1f12]/20 bg-white/60 text-[#6e1f12] hover:bg-[#6e1f12]/5"
                      }`}
                    >
                      {getCategoryName(
                        category,
                        language
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </nav>
        )}

        {groupedCategories.length === 0 ? (
          <div className="rounded-2xl border border-[#6e1f12]/10 bg-white/60 px-6 py-12 text-center">
            <p className="text-sm text-[#292821]/55">
              {texts[language].emptyMenu as string}
            </p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {groupedCategories.map(
              ({
                category,
                items: categoryItems,
              }) => {
                const categoryOpen =
                  openCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    ref={(element) => {
                      categoryRefs.current[
                        category.id
                      ] = element;
                    }}
                    className="scroll-mt-44 sm:scroll-mt-48"
                  >
                    <Accordion
                      title={getCategoryName(
                        category,
                        language
                      )}
                      count={categoryItems.length}
                      open={categoryOpen}
                      onToggle={() =>
                        toggleCategory(category.id)
                      }
                    >
                      {categoryItems.length === 0 ? (
                        <>
                          <p className="px-6 py-7 text-sm text-[#292821]/45">
                            {
                              texts[language]
                                .emptyCategory as string
                            }
                          </p>

                          <div className="border-t border-[#6e1f12]/10 px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                closeCategory(
                                  category.id
                                )
                              }
                              className="rounded-full border border-[#6e1f12]/25 bg-[#f4efe5] px-5 py-2.5 text-sm font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white"
                            >
                              ↑{" "}
                              {
                                texts[language]
                                  .closeCategory as string
                              }
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          {categoryItems.map((item) => {
                            const productOpen =
                              openProductId === item.id;

                            const name =
                              getProductName(
                                item,
                                language
                              );

                            const description =
                              getProductDescription(
                                item,
                                language
                              );

                            const dietaryLabel =
                              getDietaryLabel(
                                item.dietary,
                                language
                              );

                            const spicyLevel =
                              normalizeSpicyLevel(
                                item.spicy_level
                              );

                            const details: {
                              label: string;
                              value: string;
                            }[] = [];

                            if (item.portion) {
                              details.push({
                                label:
                                  texts[language]
                                    .portion as string,
                                value: item.portion,
                              });
                            }

                            if (
                              item.calories_per_portion !==
                              null
                            ) {
                              details.push({
                                label:
                                  texts[language]
                                    .calories as string,
                                value: `${item.calories_per_portion} kcal`,
                              });
                            }

                            if (
                              item.calories_per_100g !==
                              null
                            ) {
                              details.push({
                                label:
                                  texts[language]
                                    .calories100 as string,
                                value: `${item.calories_per_100g} kcal`,
                              });
                            }

                            if (dietaryLabel) {
                              details.push({
                                label:
                                  texts[language]
                                    .dietary as string,
                                value: dietaryLabel,
                              });
                            }

                            if (spicyLevel > 0) {
                              const spicyLevels = texts[
                                language
                              ].spicyLevels as string[];

                              details.push({
                                label:
                                  texts[language]
                                    .spicy as string,
                                value:
                                  spicyLevels[
                                    spicyLevel
                                  ],
                              });
                            }

                            return (
                              <article
                                key={item.id}
                                className="border-b border-[#6e1f12]/10 last:border-b-0"
                              >
                                <ProductRow
                                  name={name}
                                  description={
                                    description
                                  }
                                  portion={item.portion}
                                  calories={
                                    item.calories_per_portion
                                  }
                                  dietaryLabel={
                                    dietaryLabel
                                  }
                                  price={item.price}
                                  open={productOpen}
                                  onToggle={() =>
                                    setOpenProductId(
                                      productOpen
                                        ? null
                                        : item.id
                                    )
                                  }
                                />

                                {productOpen && (
                                  <ProductDetail
                                    name={name}
                                    imageUrl={
                                      item.image_url
                                    }
                                    description={
                                      description
                                    }
                                    details={details}
                                    allergens={getAllergenLabels(
                                      item.allergens,
                                      language
                                    )}
                                    allergensTitle={
                                      texts[language]
                                        .allergens as string
                                    }
                                    noAllergenText={
                                      texts[language]
                                        .noAllergen as string
                                    }
                                  />
                                )}
                              </article>
                            );
                          })}

                          <div className="border-t border-[#6e1f12]/10 px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                closeCategory(
                                  category.id
                                )
                              }
                              className="rounded-full border border-[#6e1f12]/25 bg-[#f4efe5] px-5 py-2.5 text-sm font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white"
                            >
                              ↑{" "}
                              {
                                texts[language]
                                  .closeCategory as string
                              }
                            </button>
                          </div>
                        </>
                      )}
                    </Accordion>
                  </div>
                );
              }
            )}
          </div>
        )}

        <footer className="mt-10 border-t border-[#6e1f12]/12 pt-6 text-center text-xs leading-5 text-[#292821]/45">
          {texts[language].footer as string}
        </footer>
      </div>
    </main>
  );
}