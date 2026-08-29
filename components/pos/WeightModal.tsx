"use client";

import type { MenuItem } from "./types";
import { BRAND_FONT, money, nameOf } from "./utils";

type Props = {
  item: MenuItem;
  grams: string;
  calculatedPrice: number;
  baseWeightGrams: number;
  onGramsChange: (value: string) => void;
  onCancel: () => void;
  onAdd: () => void;
};

export default function WeightModal({
  item,
  grams,
  calculatedPrice,
  baseWeightGrams,
  onGramsChange,
  onCancel,
  onAdd,
}: Props) {
  const priceLabel =
    baseWeightGrams === 1000
      ? "Kg fiyatı"
      : `${baseWeightGrams} gr fiyatı`;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h3
          className="text-2xl font-bold text-[#6e1f12]"
          style={{ fontFamily: BRAND_FONT }}
        >
          {nameOf(item)}
        </h3>
        <p className="mt-2 text-sm opacity-55">
          {priceLabel}: {money(item.price ?? 0)} ₺
        </p>
        <input
          autoFocus
          type="number"
          min="1"
          step="1"
          value={grams}
          onChange={(event) => onGramsChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAdd();
            if (event.key === "Escape") onCancel();
          }}
          placeholder={`Gram girin (örn. ${baseWeightGrams})`}
          className="mt-5 w-full rounded-xl border border-black/15 px-4 py-4 text-2xl font-bold outline-none focus:border-[#6e1f12]"
        />
        <p className="mt-3 text-sm opacity-55">
          Girilen gramaj, ürünün {baseWeightGrams} gr porsiyon fiyatına göre hesaplanır.
        </p>
        <p className="mt-4 rounded-xl bg-[#f4efe5] p-4 text-2xl font-bold text-[#6e1f12]">
          {money(calculatedPrice)} ₺
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-black/10 px-4 py-3"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white"
          >
            Sepete Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
