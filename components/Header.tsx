"use client";

import { useEffect, useState } from "react";
import { useLanguage, type Language } from "./LanguageContext";

const translations = {
  tr: {
    selection: "Tezgâhtan Seçmeler",
    about: "Hakkımızda",
    gallery: "Dükkândan Kareler",
    contact: "İletişim",
    openMenu: "Menüyü aç",
    closeMenu: "Menüyü kapat",
  },

  en: {
    selection: "From the Counter",
    about: "About Us",
    gallery: "Inside Leman's",
    contact: "Contact",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },

  ru: {
    selection: "С витрины",
    about: "О нас",
    gallery: "Наше пространство",
    contact: "Контакты",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
  },
};

const languages: Language[] = ["tr", "en", "ru"];

export default function Header() {
  const { language, setLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const text = translations[language];

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function changeLanguage(item: Language) {
    setLanguage(item);
    setMenuOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#802400] shadow-md">
      <div className="mx-auto flex h-[96px] max-w-[1500px] items-center justify-between px-5 sm:px-7 lg:h-[118px] lg:px-10">
        <a
          href="#hero"
          className="shrink-0"
          onClick={closeMenu}
          aria-label="Leman's Deli ana sayfa"
        >
          <img
            src="/logo-horizontal-dark.png"
            alt="Leman's Deli"
            className="h-[72px] w-auto object-contain sm:h-[78px] lg:h-[96px]"
          />
        </a>

        {/* Masaüstü menü */}
        <nav className="hidden items-center gap-7 font-sans text-[15px] font-normal text-[#fff4e8] lg:flex xl:gap-9 xl:text-[16px]">
          <a
            href="#menu"
            className="whitespace-nowrap transition-colors hover:text-[#f1b18c]"
          >
            {text.selection}
          </a>

          <a
            href="#about"
            className="whitespace-nowrap transition-colors hover:text-[#f1b18c]"
          >
            {text.about}
          </a>

          <a
            href="#gallery"
            className="whitespace-nowrap transition-colors hover:text-[#f1b18c]"
          >
            {text.gallery}
          </a>

          <a
            href="#contact"
            className="whitespace-nowrap transition-colors hover:text-[#f1b18c]"
          >
            {text.contact}
          </a>

          <div className="ml-1 flex items-center gap-4 border-l border-[#fff4e8]/30 pl-6 text-[13px]">
            {languages.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLanguage(item)}
                className={`uppercase transition-colors ${
                  language === item
                    ? "text-[#f1b18c]"
                    : "text-[#fff4e8] hover:text-[#f1b18c]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobil hamburger butonu */}
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="relative z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-[#fff4e8] transition hover:bg-white/10 lg:hidden"
          aria-label={menuOpen ? text.closeMenu : text.openMenu}
          aria-expanded={menuOpen}
        >
          <span className="sr-only">
            {menuOpen ? text.closeMenu : text.openMenu}
          </span>

          <span className="relative block h-5 w-6">
            <span
              className={`absolute left-0 top-0 h-[2px] w-6 bg-current transition duration-300 ${
                menuOpen ? "translate-y-[9px] rotate-45" : ""
              }`}
            />

            <span
              className={`absolute left-0 top-[9px] h-[2px] w-6 bg-current transition duration-300 ${
                menuOpen ? "opacity-0" : "opacity-100"
              }`}
            />

            <span
              className={`absolute bottom-0 left-0 h-[2px] w-6 bg-current transition duration-300 ${
                menuOpen ? "-translate-y-[9px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobil menü paneli */}
      <div
        className={`fixed inset-0 top-[96px] z-40 bg-[#802400] transition duration-300 lg:hidden ${
          menuOpen
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-4 opacity-0"
        }`}
      >
        <nav className="flex h-full flex-col px-7 pb-12 pt-10 text-[#fff4e8]">
          <div className="flex flex-col gap-1">
            <a
              href="#menu"
              onClick={closeMenu}
              className="border-b border-white/15 py-5 text-2xl transition hover:text-[#f1b18c]"
            >
              {text.selection}
            </a>

            <a
              href="#about"
              onClick={closeMenu}
              className="border-b border-white/15 py-5 text-2xl transition hover:text-[#f1b18c]"
            >
              {text.about}
            </a>

            <a
              href="#gallery"
              onClick={closeMenu}
              className="border-b border-white/15 py-5 text-2xl transition hover:text-[#f1b18c]"
            >
              {text.gallery}
            </a>

            <a
              href="#contact"
              onClick={closeMenu}
              className="border-b border-white/15 py-5 text-2xl transition hover:text-[#f1b18c]"
            >
              {text.contact}
            </a>
          </div>

          <div className="mt-10">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/55">
              Language
            </p>

            <div className="flex gap-3">
              {languages.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => changeLanguage(item)}
                  className={`min-w-14 rounded-full border px-4 py-3 text-sm uppercase transition ${
                    language === item
                      ? "border-[#f1b18c] bg-[#f1b18c] text-[#802400]"
                      : "border-white/25 text-[#fff4e8] hover:border-[#f1b18c] hover:text-[#f1b18c]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-auto text-sm text-white/55">
            Kaş • Mediterranean Deli
          </p>
        </nav>
      </div>
    </header>
  );
}