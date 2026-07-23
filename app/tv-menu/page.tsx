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

  price: number | null;
  category: Category;
  portion: string | null;

  active: boolean;
  sort_order: number;
};

type MenuBlock = {
  category: Category;
  items: MenuItem[];
  continuation: boolean;
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

/*
  Bir kategoride 6'dan fazla ürün varsa,
  devamı otomatik olarak bir sonraki kolona geçer.
*/
const MAX_ITEMS_PER_BLOCK = 6;

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

  const menuBlocks = useMemo<MenuBlock[]>(() => {
    const blocks: MenuBlock[] = [];

    categoryOrder.forEach((category) => {
      const categoryItems = items
        .filter((item) => item.category === category)
        .sort((a, b) => a.sort_order - b.sort_order);

      if (categoryItems.length === 0) return;

      for (
        let i = 0;
        i < categoryItems.length;
        i += MAX_ITEMS_PER_BLOCK
      ) {
        blocks.push({
          category,
          items: categoryItems.slice(
            i,
            i + MAX_ITEMS_PER_BLOCK
          ),
          continuation: i > 0,
        });
      }
    });

    return blocks;
  }, [items]);

  if (loading) {
    return (
      <main className="h-screen bg-[#f4efe5] flex items-center justify-center overflow-hidden">
        <p
          style={{ fontFamily: BRAND_FONT }}
          className="text-2xl text-[#6e1f12]"
        >
          Menü yükleniyor...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen bg-[#f4efe5] flex items-center justify-center px-6 text-center overflow-hidden">
        <p
          style={{ fontFamily: BRAND_FONT }}
          className="text-xl text-[#6e1f12]"
        >
          {error}
        </p>
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
          className="w-[37vw] max-w-[680px] max-h-[64vh] object-contain opacity-[0.032]"
        />
      </div>

      <div className="relative z-10 flex h-full flex-col px-[3vw] py-[2vh]">

        {/* HEADER */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#6e1f12]/22 pb-[1.3vh]">

          <img
            src="/logo-horizontal.png"
            alt="Leman's Deli"
            className="w-[19vw] max-h-[8vh] object-contain object-left"
          />

          <div
            style={{ fontFamily: BRAND_FONT }}
            className="text-right text-[0.9vw] leading-[1.45] text-[#6e1f12]/75"
          >
            <p>Günlük hazırlanan mezeler</p>
            <p>şarküteri &amp; sandviçler</p>
          </div>

        </header>

        {/* MENU */}
        <div className="grid min-h-0 flex-1 grid-cols-3 auto-rows-min content-start gap-x-[3vw] gap-y-[2.2vh] pt-[2vh] overflow-hidden">

          {menuBlocks.map((block, blockIndex) => (
            <section
              key={`${block.category}-${blockIndex}`}
              className="min-w-0"
            >

              {/* CATEGORY TITLE */}
              <div className="mb-[1.15vh] flex items-end gap-[0.75vw]">

                <h2
                  style={{
                    fontFamily: BRAND_FONT,
                    fontWeight: 700,
                  }}
                  className="shrink-0 text-[1.65vw] leading-none text-[#6e1f12]"
                >
                  {categoryLabels[block.category]}

                  {block.continuation && (
                    <span className="ml-[0.4vw] text-[0.7vw] font-normal opacity-45">
                      devam
                    </span>
                  )}
                </h2>

                <span className="mb-[0.1vh] h-px flex-1 bg-[#6e1f12]/18" />

              </div>

              {/* PRODUCTS */}
              <div className="space-y-[1.2vh]">

                {block.items.map((item) => {
                  const name =
                    item.name_tr ||
                    item.name ||
                    "İsimsiz ürün";

                  return (
                    <article
                      key={item.id}
                      className="border-b border-[#6e1f12]/10 pb-[1vh]"
                    >

                      {/* PRODUCT NAME */}
                      <h3
                        style={{
                          fontFamily: BRAND_FONT,
                          fontWeight: 700,
                        }}
                        className="text-[1.2vw] leading-[1.15] text-[#6e1f12]"
                      >
                        {name}
                      </h3>

                      {/* PORTION + PRICE */}
                      <div className="mt-[0.5vh] flex items-baseline">

                        {item.portion ? (
                          <span
                            style={{
                              fontFamily: BRAND_FONT,
                              fontWeight: 600,
                            }}
                            className="shrink-0 text-[0.92vw] text-[#242820]/72"
                          >
                            {item.portion}
                          </span>
                        ) : (
                          <span />
                        )}

                        <span className="mx-[0.65vw] flex-1 border-b border-dotted border-[#6e1f12]/30" />

                        {item.price !== null && (
                          <span
                            style={{
                              fontFamily: BRAND_FONT,
                              fontWeight: 700,
                            }}
                            className="shrink-0 text-[1.08vw] text-[#6e1f12]"
                          >
                            {formatPrice(item.price)} ₺
                          </span>
                        )}

                      </div>

                    </article>
                  );
                })}

              </div>

            </section>
          ))}

        </div>

        {/* FOOTER */}
        <footer
          style={{ fontFamily: BRAND_FONT }}
          className="mt-[1vh] flex shrink-0 justify-between border-t border-[#6e1f12]/18 pt-[0.75vh] text-[0.65vw] text-[#6e1f12]/55"
        >
          <span>
            Çeşitler günlük ve stok durumuna göre değişebilir.
          </span>

          <span>
            @lemansdeli · Kaş
          </span>
        </footer>

      </div>
    </main>
  );
}