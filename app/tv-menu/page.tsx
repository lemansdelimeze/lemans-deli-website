"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Category =
  | "meze"
  | "zeytinyagli"
  | "sandvic"
  | "sarkuteri"
  | "peynir";

type MenuItem = {
  id: number;
  name: string;
  price: number | null;
  category: Category;
  portion: string | null;
  active: boolean;
  sort_order: number;
};

const categoryLabels: Record<Category, string> = {
  meze: "Mezeler",
  zeytinyagli: "Zeytinyağlılar",
  sandvic: "Sandviçler",
  sarkuteri: "Şarküteri",
  peynir: "Peynirler",
};

const categoryOrder: Category[] = [
  "meze",
  "zeytinyagli",
  "sandvic",
  "sarkuteri",
  "peynir",
];

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
      console.error("SUPABASE ERROR:", error);
      setError("Menü yüklenemedi.");
      setLoading(false);
      return;
    }

    console.log("SUPABASE DATA:", data);

    setItems(data ?? []);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    loadMenu();

    const interval = setInterval(() => {
      loadMenu();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center">
        <p className="text-2xl">Menü yükleniyor...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center">
        <p className="text-2xl">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] text-[#242820]">
      <div className="min-h-screen px-[5vw] py-[4vh]">

        <header className="flex items-end justify-between border-b border-[#242820]/30 pb-[2vh] mb-[4vh]">
          <div>
            <p className="text-[1.3vw] uppercase tracking-[0.35em] mb-2">
              Kaş
            </p>

            <h1 className="text-[4.2vw] leading-none font-semibold tracking-tight">
              Leman&apos;s Deli
            </h1>
          </div>

          <div className="text-right">
            <p className="text-[1.5vw]">
              Günlük hazırlanan
            </p>

            <p className="text-[1.5vw]">
              mezeler &amp; gurme ürünler
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-[6vw] gap-y-[5vh]">
          {categoryOrder.map((category) => {
            const categoryItems = items
              .filter((item) => item.category === category)
              .sort((a, b) => a.sort_order - b.sort_order);

            if (categoryItems.length === 0) return null;

            return (
              <section key={category}>
                <h2 className="text-[2.7vw] font-semibold mb-[2vh]">
                  {categoryLabels[category]}
                </h2>

                <div className="space-y-[1.2vh]">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-baseline text-[1.45vw]"
                    >
                      <span className="font-medium whitespace-nowrap">
                        {item.name}
                      </span>

                      <span className="mx-3 border-b border-dotted border-[#242820]/40 flex-1" />

                      {item.price !== null && (
                        <span className="font-semibold whitespace-nowrap">
                          {Number(item.price)} ₺
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="border-t border-[#242820]/30 mt-[5vh] pt-[2vh] flex justify-between items-center text-[1.15vw]">
          <span>İyi malzeme · doğru tarif · özenli üretim</span>
          <span>@lemansdeli</span>
        </footer>

      </div>
    </main>
  );
}