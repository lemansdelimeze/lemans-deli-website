"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../../lib/supabase";

type Category = {
  id: number;
  slug: string;
  name_tr: string;
  name_en: string | null;
  name_ru: string | null;
  sort_order: number;
  active: boolean;
};

type MenuItem = {
  id: number;

  name: string | null;
  name_tr: string | null;

  price: number | null;
  portion: string | null;

  category: string | null;
  category_id: number | null;

  active: boolean;
  sort_order: number;
};

type MenuSlide = {
  id: string;
  category: Category;
  items: MenuItem[];
  part: number;
  totalParts: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const MAX_ITEMS_PER_SLIDE = 15;
const SLIDE_DURATION = 7000;

function formatPrice(price: number) {
  return Number(price).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getProductName(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

function getCategoryTitle(slide: MenuSlide) {
  const title = slide.category.name_tr.toLocaleUpperCase("tr-TR");

  if (slide.totalParts <= 1) {
    return title;
  }

  return `${title} ${slide.part}/${slide.totalParts}`;
}

export default function TvMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    const [categoriesResult, itemsResult] =
      await Promise.all([
        supabase
          .from("categories")
          .select(
            "id, slug, name_tr, name_en, name_ru, sort_order, active"
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
              price,
              portion,
              category,
              category_id,
              active,
              sort_order
            `
          )
          .eq("active", true)
          .order("sort_order", { ascending: true }),
      ]);

    if (categoriesResult.error) {
      console.error(
        "TV CATEGORY ERROR:",
        categoriesResult.error
      );

      setError(
        `Kategoriler yüklenemedi: ${categoriesResult.error.message}`
      );

      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      console.error("TV MENU ERROR:", itemsResult.error);

      setError(
        `Menü yüklenemedi: ${itemsResult.error.message}`
      );

      setLoading(false);
      return;
    }

    setCategories(
      (categoriesResult.data ?? []) as Category[]
    );

    setItems((itemsResult.data ?? []) as MenuItem[]);

    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMenu();

    const menuChannel = supabase
      .channel("tv-menu-items-live")
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

    const categoriesChannel = supabase
      .channel("tv-menu-categories-live")
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
      void supabase.removeChannel(categoriesChannel);
    };
  }, [loadMenu]);

  const slides = useMemo<MenuSlide[]>(() => {
    const result: MenuSlide[] = [];

    categories.forEach((category) => {
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

      if (categoryItems.length === 0) {
        return;
      }

      const totalParts = Math.ceil(
        categoryItems.length / MAX_ITEMS_PER_SLIDE
      );

      for (let index = 0; index < totalParts; index += 1) {
        const start = index * MAX_ITEMS_PER_SLIDE;

        result.push({
          id: `${category.id}-${index}`,
          category,
          items: categoryItems.slice(
            start,
            start + MAX_ITEMS_PER_SLIDE
          ),
          part: index + 1,
          totalParts,
        });
      }
    });

    return result;
  }, [categories, items]);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) =>
        current >= slides.length - 1 ? 0 : current + 1
      );
    }, SLIDE_DURATION);

    return () => {
      window.clearInterval(timer);
    };
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0) {
      setActiveSlideIndex(0);
      return;
    }

    if (activeSlideIndex >= slides.length) {
      setActiveSlideIndex(0);
    }
  }, [activeSlideIndex, slides.length]);

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[#f4efe5]">
        <div className="text-center">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-[#6e1f12]/15 border-t-[#6e1f12]" />

          <p
            style={{ fontFamily: BRAND_FONT }}
            className="text-2xl text-[#6e1f12]"
          >
            Menü yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[#f4efe5] px-8 text-center">
        <p
          style={{ fontFamily: BRAND_FONT }}
          className="text-xl text-[#6e1f12]"
        >
          {error}
        </p>
      </main>
    );
  }

  if (slides.length === 0) {
    return (
      <main className="flex h-screen items-center justify-center overflow-hidden bg-[#f4efe5] px-8 text-center">
        <p
          style={{ fontFamily: BRAND_FONT }}
          className="text-2xl text-[#6e1f12]"
        >
          Bugün için görüntülenecek ürün bulunmuyor.
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#f4efe5] text-[#292821]">
      {/* WATERMARK */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      >
        <img
          src="/logo.png"
          alt=""
          className="max-h-[68vh] w-[42vw] max-w-[760px] object-contain opacity-[0.035]"
        />
      </div>

      <div className="relative z-10 flex h-full flex-col px-[3.5vw] py-[2.2vh]">
        {/* HEADER */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#6e1f12]/20 pb-[1.5vh]">
          <img
            src="/logo-horizontal.png"
            alt="Leman's Deli"
            className="max-h-[8vh] w-[20vw] object-contain object-left"
          />

          <div
            style={{ fontFamily: BRAND_FONT }}
            className="text-right text-[0.9vw] leading-[1.5] text-[#6e1f12]/70"
          >
            <p>Günlük hazırlanan mezeler</p>
            <p>şarküteri &amp; sandviçler</p>
          </div>
        </header>

        {/* SLIDES */}
        <section className="relative min-h-0 flex-1">
          {slides.map((slide, index) => {
            const active = index === activeSlideIndex;

            const firstColumn = slide.items.slice(0, 8);
            const secondColumn = slide.items.slice(8);

            return (
              <div
                key={slide.id}
                aria-hidden={!active}
                className={`absolute inset-0 flex flex-col py-[2.7vh] transition-opacity duration-1000 ease-in-out ${
                  active
                    ? "z-10 opacity-100"
                    : "pointer-events-none z-0 opacity-0"
                }`}
              >
                {/* CATEGORY TITLE */}
                <div className="mb-[2.5vh] flex shrink-0 items-center gap-[1.2vw]">
                  <h1
                    style={{
                      fontFamily: BRAND_FONT,
                      fontWeight: 700,
                    }}
                    className="shrink-0 text-[3vw] leading-none tracking-[0.025em] text-[#6e1f12]"
                  >
                    {getCategoryTitle(slide)}
                  </h1>

                  <span className="h-px flex-1 bg-[#6e1f12]/25" />
                </div>

                {/* PRODUCTS */}
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-x-[5vw]">
                  <ProductColumn items={firstColumn} />

                  <ProductColumn items={secondColumn} />
                </div>
              </div>
            );
          })}
        </section>

        {/* FOOTER */}
        <footer
          style={{ fontFamily: BRAND_FONT }}
          className="flex shrink-0 items-center justify-between border-t border-[#6e1f12]/18 pt-[0.9vh] text-[0.68vw] text-[#6e1f12]/55"
        >
          <span>
            Çeşitler günlük üretim ve stok durumuna göre
            değişebilir.
          </span>

          <div className="flex items-center gap-[1vw]">
            {slides.length > 1 && (
              <span>
                {activeSlideIndex + 1} / {slides.length}
              </span>
            )}

            <span>@lemansdeli · Kaş</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

function ProductColumn({
  items,
}: {
  items: MenuItem[];
}) {
  return (
    <div className="flex min-w-0 flex-col">
      {items.map((item) => {
        const name = getProductName(item);

        return (
          <article
            key={item.id}
            className="flex min-h-0 flex-1 flex-col justify-center border-b border-[#6e1f12]/11 last:border-b-0"
          >
            <div className="flex min-w-0 items-baseline gap-[0.7vw]">
              <h2
                style={{
                  fontFamily: BRAND_FONT,
                  fontWeight: 700,
                }}
                className="min-w-0 shrink text-[1.45vw] leading-[1.15] text-[#6e1f12]"
              >
                {name}
              </h2>

              <span className="mb-[0.2vh] min-w-[1vw] flex-1 border-b border-dotted border-[#6e1f12]/30" />

              {item.price !== null && (
                <span
                  style={{
                    fontFamily: BRAND_FONT,
                    fontWeight: 700,
                  }}
                  className="shrink-0 text-[1.32vw] text-[#6e1f12]"
                >
                  {formatPrice(item.price)} ₺
                </span>
              )}
            </div>

            {item.portion && (
              <p
                style={{ fontFamily: BRAND_FONT }}
                className="mt-[0.55vh] text-[0.82vw] text-[#292821]/55"
              >
                {item.portion}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}