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

type MenuItem = {
  id: number;

  name: string | null;
  name_tr: string | null;
  description_tr: string | null;

  price: number | null;
  category: Category;
  portion: string | null;

  active: boolean;
  sort_order: number;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

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
      console.error("TV MENU ERROR:", error);
      setError(`Menü yüklenemedi: ${error.message}`);
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
    return categoryOrder
      .map((category) => ({
        category,
        items: items
          .filter((item) => item.category === category)
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((group) => group.items.length > 0);
  }, [items]);

  if (loading) {
    return (
      <main className="h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center overflow-hidden">
        <p
          style={{ fontFamily: BRAND_FONT }}
          className="text-2xl"
        >
          Menü yükleniyor...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center px-6 text-center overflow-hidden">
        <p className="text-xl">{error}</p>
      </main>
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#f4efe5] text-[#242820]">
      {/* WATERMARK */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      >
        <img
          src="/logo.png"
          alt=""
          className="w-[38vw] max-w-[620px] max-h-[68vh] object-contain opacity-[0.028]"
        />
      </div>

      <div className="relative z-10 flex h-screen flex-col px-[3.2vw] py-[2.2vh]">
        {/* HEADER */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#6e1f12]/20 pb-[1.4vh]">
          <div>
            <p
              style={{ fontFamily: BRAND_FONT }}
              className="text-[0.72vw] uppercase tracking-[0.2em] text-[#6e1f12]/65"
            >
              Kaş
            </p>

            <h1
              style={{
                fontFamily: BRAND_FONT,
                fontWeight: 700,
              }}
              className="mt-[0.3vh] text-[2.7vw] leading-none text-[#6e1f12]"
            >
              Leman&apos;s Deli
            </h1>
          </div>

          <p
            style={{ fontFamily: BRAND_FONT }}
            className="max-w-[28vw] text-right text-[0.85vw] leading-[1.4] text-[#242820]/55"
          >
            Günlük hazırlanan mezeler · seçkin şarküteri · sandviçler
          </p>
        </header>

        {/* MENU GRID */}
        <div className="mt-[1.8vh] grid min-h-0 flex-1 grid-cols-3 content-start gap-x-[3vw] gap-y-[2.2vh] overflow-hidden">
          {groupedItems.map(({ category, items: categoryItems }) => (
            <section key={category} className="min-w-0">
              <div className="mb-[1vh] flex items-end gap-[0.7vw]">
                <h2
                  style={{
                    fontFamily: BRAND_FONT,
                    fontWeight: 700,
                  }}
                  className="shrink-0 text-[1.55vw] leading-none text-[#6e1f12]"
                >
                  {categoryLabels[category]}
                </h2>

                <span className="mb-[0.15vh] h-px flex-1 bg-[#6e1f12]/16" />
              </div>

              <div className="space-y-[0.85vh]">
                {categoryItems.map((item) => {
                  const name =
                    item.name_tr ||
                    item.name ||
                    "İsimsiz ürün";

                  const description =
                    item.description_tr?.trim() || "";

                  return (
                    <article
                      key={item.id}
                      className="border-b border-[#242820]/8 pb-[0.75vh]"
                    >
                      {/* NAME + PORTION + PRICE */}
                      <div className="flex items-baseline gap-[0.55vw]">
                        <div className="min-w-0 flex-1">
                          <span
                            style={{
                              fontFamily: BRAND_FONT,
                              fontWeight: 700,
                            }}
                            className="text-[1.02vw] leading-tight text-[#6e1f12]"
                          >
                            {name}
                          </span>

                          {item.portion && (
                            <span
                              style={{ fontFamily: BRAND_FONT }}
                              className="ml-[0.35vw] text-[0.72vw] text-[#242820]/45"
                            >
                              · {item.portion}
                            </span>
                          )}
                        </div>

                        {item.price !== null && (
                          <span
                            style={{
                              fontFamily: BRAND_FONT,
                              fontWeight: 700,
                            }}
                            className="shrink-0 text-[0.98vw] text-[#6e1f12]"
                          >
                            {formatPrice(item.price)} ₺
                          </span>
                        )}
                      </div>

                      {/* CONTENT */}
                      {description && (
                        <p className="mt-[0.35vh] line-clamp-2 max-w-[96%] text-[0.7vw] leading-[1.35] text-[#242820]/55">
                          {description}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* FOOTER */}
        <footer className="mt-[1.4vh] flex shrink-0 items-center justify-between border-t border-[#6e1f12]/16 pt-[0.8vh] text-[0.65vw] text-[#242820]/40">
          <span>
            Günlük hazırlanır · çeşitler stok durumuna göre değişebilir
          </span>

          <span style={{ fontFamily: BRAND_FONT }}>
            @lemansdeli · Kaş
          </span>
        </footer>
      </div>
    </main>
  );
}