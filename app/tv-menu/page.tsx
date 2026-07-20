"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type MenuItem = {
  id: number;
  name: string;
  price: number | null;
  category: "meze" | "sandvic";
  portion: string | null;
  active: boolean;
  sort_order: number;
};

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

  const mezeler = items.filter((item) => item.category === "meze");
  const sandvicler = items.filter((item) => item.category === "sandvic");

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
    <main className="min-h-screen bg-[#f4efe5] text-[#242820] overflow-hidden">
      <div className="min-h-screen px-[5vw] py-[4vh] flex flex-col">

        <header className="flex items-end justify-between border-b border-[#242820]/30 pb-[2vh]">
          <div>
            <p className="text-[1.3vw] uppercase tracking-[0.35em] mb-2">
              Kaş
            </p>

            <h1 className="text-[4.2vw] leading-none font-semibold tracking-tight">
              Leman&apos;s Deli
            </h1>
          </div>

          <div className="text-right">
            <p className="text-[1.5vw]">Günlük hazırlanan</p>
            <p className="text-[1.5vw]">
              mezeler &amp; gurme sandviçler
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-[6vw] flex-1 pt-[4vh]">

          <div>
            <div className="flex items-end justify-between mb-[2.5vh]">
              <h2 className="text-[3vw] font-semibold">
                Mezeler
              </h2>

              <span className="text-[1.1vw] opacity-60">
                200 gr
              </span>
            </div>

            <div className="space-y-[1.4vh]">
              {mezeler.map((item) => (
                <div
                  key={item.id}
                  className="flex items-baseline text-[1.55vw]"
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
          </div>

          <div>
            <div className="flex items-end justify-between mb-[2.5vh]">
              <h2 className="text-[3vw] font-semibold">
                Sandviçler
              </h2>
            </div>

            <div className="space-y-[1.4vh]">
              {sandvicler.map((item) => (
                <div
                  key={item.id}
                  className="flex items-baseline text-[1.55vw]"
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
          </div>

        </section>

        <footer className="border-t border-[#242820]/30 pt-[2vh] flex justify-between items-center text-[1.15vw]">
          <span>İyi malzeme · doğru tarif · özenli üretim</span>
          <span>@lemansdeli</span>
        </footer>

      </div>
    </main>
  );
}