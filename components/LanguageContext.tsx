"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Language = "tr" | "en" | "ru";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const STORAGE_KEY = "lemans-language";

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

function isLanguage(value: string | null): value is Language {
  return value === "tr" || value === "en" || value === "ru";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("tr");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);

    if (isLanguage(savedLanguage)) {
      setLanguageState(savedLanguage);
      document.documentElement.lang = savedLanguage;
    } else {
      document.documentElement.lang = "tr";
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;

      if (isLanguage(event.newValue)) {
        setLanguageState(event.newValue);
        document.documentElement.lang = event.newValue;
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function setLanguage(newLanguage: Language) {
    setLanguageState(newLanguage);
    window.localStorage.setItem(STORAGE_KEY, newLanguage);
    document.documentElement.lang = newLanguage;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}