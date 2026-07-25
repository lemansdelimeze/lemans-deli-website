"use client";

import { ReactNode } from "react";

type AccordionProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export default function Accordion({
  title,
  subtitle,
  count,
  open,
  onToggle,
  children,
}: AccordionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#6e1f12]/10 bg-white shadow-sm">

      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-[#faf7f2]"
      >
        <div className="min-w-0">

          <h2
            className="text-xl font-bold text-[#6e1f12]"
            style={{
              fontFamily:
                '"American Typewriter","Courier New",monospace',
            }}
          >
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm text-neutral-500">
              {subtitle}
            </p>
          )}

        </div>

        <div className="flex items-center gap-3">

          {count !== undefined && (
            <span className="rounded-full bg-[#f5efe6] px-3 py-1 text-xs font-semibold text-[#6e1f12]">
              {count}
            </span>
          )}

          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#6e1f12]/15 text-xl text-[#6e1f12]">
            {open ? "−" : "+"}
          </span>

        </div>
      </button>

      {open && (
        <div className="border-t border-[#6e1f12]/10">
          {children}
        </div>
      )}

    </section>
  );
}