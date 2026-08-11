"use client";

import type { PaymentMethod } from "./types";
import { BRAND_FONT, INTERNAL_REASONS, PAYMENT_LABELS, money } from "./utils";

type Props = {
  subtotal: number;
  discountAmount: number;
  discountLabel: string;
  total: number;
  payment: PaymentMethod;
  cash: string;
  card: string;
  mealCard: string;
  internalReason: string;
  printAfterClose: boolean;
  saving: boolean;
  onPaymentChange: (value: PaymentMethod) => void;
  onCashChange: (value: string) => void;
  onCardChange: (value: string) => void;
  onMealCardChange: (value: string) => void;
  onInternalReasonChange: (value: string) => void;
  onPrintAfterCloseChange: (value: boolean) => void;
  onCancel: () => void;
  onClose: () => void;
};

export default function PaymentModal(props: Props) {
  const mixedEntered =
    (Number(props.cash) || 0) +
    (Number(props.card) || 0) +
    (Number(props.mealCard) || 0);

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <h3 className="text-2xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>
          Hesabı Kapat
        </h3>

        <div className="mt-3 rounded-2xl bg-[#f4efe5] p-4">
          <div className="flex justify-between text-sm"><span>Ara toplam</span><span>{money(props.subtotal)} ₺</span></div>
          {props.discountAmount > 0 && (
            <div className="mt-1 flex justify-between text-sm text-[#6e1f12]">
              <span>İndirim {props.discountLabel}</span><span>-{money(props.discountAmount)} ₺</span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-2xl font-bold"><span>Ödenecek</span><span>{money(props.total)} ₺</span></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => props.onPaymentChange(method)}
              className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                props.payment === method ? "border-[#6e1f12] bg-[#6e1f12] text-white" : "border-black/10"
              }`}
            >
              {PAYMENT_LABELS[method]}
            </button>
          ))}
        </div>

        {props.payment === "mixed" && (
          <div className="mt-5 space-y-3">
            <input type="number" value={props.cash} onChange={(e) => props.onCashChange(e.target.value)} placeholder="Nakit" className="w-full rounded-xl border px-4 py-3" />
            <input type="number" value={props.card} onChange={(e) => props.onCardChange(e.target.value)} placeholder="Kredi kartı" className="w-full rounded-xl border px-4 py-3" />
            <input type="number" value={props.mealCard} onChange={(e) => props.onMealCardChange(e.target.value)} placeholder="Yemek kartı" className="w-full rounded-xl border px-4 py-3" />
            <p className="text-sm">Girilen: {money(mixedEntered)} ₺ · Kalan: {money(props.total - mixedEntered)} ₺</p>
          </div>
        )}

        {props.payment === "internal" && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">Çıkış nedeni</p>
            <div className="flex flex-wrap gap-2">
              {INTERNAL_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => props.onInternalReasonChange(reason)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    props.internalReason === reason ? "border-[#6e1f12] bg-[#6e1f12] text-white" : "border-black/10"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="mt-5 flex items-center gap-3 rounded-xl bg-[#f4efe5] p-4">
          <input type="checkbox" checked={props.printAfterClose} onChange={(e) => props.onPrintAfterCloseChange(e.target.checked)} />
          <span>Kapatınca adisyon yazdır</span>
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={props.onCancel} className="rounded-xl border px-4 py-3">Vazgeç</button>
          <button type="button" onClick={props.onClose} disabled={props.saving} className="rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40">
            {props.saving ? "Kapatılıyor..." : "Kapat"}
          </button>
        </div>
      </div>
    </div>
  );
}
