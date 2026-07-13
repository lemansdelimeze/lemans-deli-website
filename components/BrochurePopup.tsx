"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageContext";

export default function BrochurePopup() {
  const { language } = useLanguage();

  const [isOpen, setIsOpen] = useState(true);
  const [brochureLanguage, setBrochureLanguage] = useState<"tr" | "en">(
    language === "tr" ? "tr" : "en"
  );

  useEffect(() => {
    setBrochureLanguage(language === "tr" ? "tr" : "en");
  }, [language]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  if (!isOpen) return null;

  const brochure =
    brochureLanguage === "tr"
      ? "/brochure-tr.jpg"
      : "/brochure-en.jpg";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#1c0d09]/95 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Leman's Deli açılış broşürü"
    >
      {/* Arka plana basınca kapat */}
      <button
        type="button"
        aria-label="Broşürü kapat"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col items-center">
        {/* Üst kontroller */}
        <div className="mb-3 flex w-full max-w-[680px] items-center justify-between gap-3">
          <div className="flex rounded-full border border-white/20 bg-black/30 p-1 backdrop-blur">
            <button
              type="button"
              onClick={() => setBrochureLanguage("tr")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                brochureLanguage === "tr"
                  ? "bg-[#922800] text-white"
                  : "text-white/65 hover:text-white"
              }`}
            >
              TR
            </button>

            <button
              type="button"
              onClick={() => setBrochureLanguage("en")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                brochureLanguage === "en"
                  ? "bg-[#922800] text-white"
                  : "text-white/65 hover:text-white"
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/30 text-2xl text-white transition hover:bg-white hover:text-[#2b160f]"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        {/* Broşür */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <img
            src={brochure}
            alt={
              brochureLanguage === "tr"
                ? "Leman's Deli açılış broşürü"
                : "Leman's Deli grand opening brochure"
            }
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>

        {/* Alt buton */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="mt-3 rounded-full bg-[#922800] px-8 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#ad3810]"
        >
          {brochureLanguage === "tr"
            ? "Siteye Devam Et"
            : "Continue to Website"}
        </button>
      </div>
    </div>
  );
}