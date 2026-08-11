import type { Category, MenuItem, PaymentMethod } from "./types";

export const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

export const HALF_CATEGORIES = new Set(["meze", "zeytinyagli"]);
export const WEIGHT_CATEGORIES = new Set(["sarkuteri", "peynir"]);

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  card: "Kredi Kartı",
  meal_card: "Yemek Kartı",
  mixed: "Karma",
  internal: "İkram / İç Tüketim",
};

export const INTERNAL_REASONS = ["Personel", "İkram", "Fire", "Tadım", "Diğer"];

export function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function nameOf(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

export function receiptNo() {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  return `${date}-${time}-${Math.floor(Math.random() * 90 + 10)}`;
}

export function halfPortion(portion: string | null) {
  if (!portion) return null;
  const match = portion.trim().match(/^(\d+(?:[.,]\d+)?)\s*(gr|g|kg|ml|cl|lt|l|adet)\b(.*)$/i);
  if (!match) return `½ ${portion}`;
  const value = Number(match[1].replace(",", ".")) / 2;
  const shown = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return `${shown} ${match[2]}${match[3] || ""}`.trim();
}

export function categorySlug(item: MenuItem, categories: Category[]) {
  if (item.category) return item.category;
  return categories.find((category) => category.id === item.category_id)?.slug ?? "";
}
