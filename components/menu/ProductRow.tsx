"use client";

import Price from "./Price";

type ProductRowProps = {
  name: string;
  description?: string | null;
  portion?: string | null;
  calories?: number | null;
  dietaryLabel?: string | null;
  price: number | null;
  open: boolean;
  onToggle: () => void;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

export default function ProductRow({
  name,
  description,
  portion,
  calories,
  dietaryLabel,
  price,
  open,
  onToggle,
}: ProductRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#6e1f12]/[0.025] md:gap-4 md:px-7 md:py-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <h3
            className="text-base font-bold leading-snug text-[#6e1f12] md:text-xl"
            style={{ fontFamily: BRAND_FONT }}
          >
            {name}
          </h3>

          <div className="shrink-0">
            <Price value={price} />
          </div>
        </div>

        {description && (
          <p className="mt-1 line-clamp-1 pr-2 text-sm leading-5 text-[#292821]/50">
            {description}
          </p>
        )}

        {(portion || calories != null || dietaryLabel) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#292821]/45">
            {portion && <span>{portion}</span>}

            {calories != null && <span>{calories} kcal</span>}

            {dietaryLabel && <span>{dietaryLabel}</span>}
          </div>
        )}
      </div>

      <span
        aria-hidden="true"
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#6e1f12]/15 text-lg text-[#6e1f12]"
      >
        {open ? "−" : "+"}
      </span>
    </button>
  );
}