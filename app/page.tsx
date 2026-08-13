"use client";

import { useEffect, useState } from "react";
import HomeContent from "../components/HomeContent";

type Language = "tr" | "en" | "ru";

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const text = {
  tr: {
    menu: "Menü & Sipariş",
    home: "Ana Sayfaya Devam Et",
    contact: "İletişim",
    call: "Ara",
    whatsapp: "WhatsApp",
    directions: "Yol Tarifi",
  },
  en: {
    menu: "Menu & Order",
    home: "Continue to Homepage",
    contact: "Contact",
    call: "Call",
    whatsapp: "WhatsApp",
    directions: "Getting There",
  },
  ru: {
    menu: "Меню и заказ",
    home: "Перейти на главную",
    contact: "Связаться",
    call: "Позвонить",
    whatsapp: "WhatsApp",
    directions: "Как добраться",
  },
} satisfies Record<Language, Record<string, string>>;

export default function RootPage() {
  const [language, setLanguage] = useState<Language>("tr");
  const [showEntrance, setShowEntrance] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem(
      "lemans-entrance-dismissed"
    );

    if (dismissed === "1") {
      setShowEntrance(false);
    }
  }, []);

  function continueToHome() {
    window.sessionStorage.setItem("lemans-entrance-dismissed", "1");
    setShowEntrance(false);
  }

  const t = text[language];

  return (
    <div className="relative min-h-screen">
      <HomeContent />

      {showEntrance && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto px-5 py-8">
          <div className="absolute inset-0 bg-[#2a1711]/45 backdrop-blur-[7px]" />

          <section className="relative z-10 w-full max-w-[430px] rounded-[30px] border border-white/20 bg-[#f5efe7]/92 p-6 shadow-[0_24px_90px_rgba(28,13,9,0.28)] sm:p-7">
            <div className="mb-6 flex justify-center">
              <img
                src="/logo-horizontal.png"
                alt="Leman's Deli"
                className="h-auto w-full max-w-[280px] object-contain"
              />
            </div>

            <div className="mb-6 flex justify-center">
              <div className="flex rounded-full border border-[#922800]/15 bg-white/45 p-1">
                {(["tr", "en", "ru"] as Language[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLanguage(item)}
                    className={`rounded-full px-3.5 py-2 text-[11px] font-bold tracking-[0.12em] transition ${
                      language === item
                        ? "bg-[#922800] text-white"
                        : "text-[#922800]/70 hover:text-[#922800]"
                    }`}
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <a
                href="/menu"
                className="flex min-h-[58px] w-full items-center justify-center rounded-2xl bg-[#922800] px-6 py-4 text-center text-[15px] font-bold tracking-[0.04em] text-white transition hover:bg-[#a9360d]"
                style={{ fontFamily: BRAND_FONT }}
              >
                {t.menu}
              </a>

              <button
                type="button"
                onClick={continueToHome}
                className="flex min-h-[58px] w-full items-center justify-center rounded-2xl border border-[#922800]/15 bg-white/65 px-6 py-4 text-center text-[14px] font-bold tracking-[0.025em] text-[#2a1711] transition hover:bg-white"
                style={{ fontFamily: BRAND_FONT }}
              >
                {t.home}
              </button>

              <button
                type="button"
                onClick={() => setContactOpen((open) => !open)}
                aria-expanded={contactOpen}
                className="flex min-h-[58px] w-full items-center justify-center rounded-2xl border border-[#922800]/15 bg-white/65 px-6 py-4 text-center text-[14px] font-bold tracking-[0.025em] text-[#2a1711] transition hover:bg-white"
                style={{ fontFamily: BRAND_FONT }}
              >
                {t.contact}
              </button>

              {contactOpen && (
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="tel:+905307005704"
                    className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#922800]/15 bg-white px-4 py-3 text-center text-[13px] font-bold text-[#922800]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    {t.call}
                  </a>

                  <a
                    href="https://wa.me/905307005704"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[52px] items-center justify-center rounded-2xl border border-[#922800]/15 bg-white px-4 py-3 text-center text-[13px] font-bold text-[#922800]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    {t.whatsapp}
                  </a>
                </div>
              )}

              <a
                href="https://maps.app.goo.gl/bmf25xzx2GC47bvCA"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[58px] w-full items-center justify-center rounded-2xl border border-[#922800]/15 bg-white/65 px-6 py-4 text-center text-[14px] font-bold tracking-[0.025em] text-[#2a1711] transition hover:bg-white"
                style={{ fontFamily: BRAND_FONT }}
              >
                {t.directions}
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}