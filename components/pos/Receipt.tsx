"use client";

import type { CartItem } from "./types";
import { money, nameOf } from "./utils";

type Props = {
  receiptNumber: string;
  orderLabel: string;
  paymentLabel: string;
  cart: CartItem[];
  subtotal: number;
  discount: number;
  discountLabel: string;
  total: number;
};

export default function Receipt(props: Props) {
  const now = new Date();

  return (
    <section id="thermal-receipt" className="mx-auto hidden w-[48mm] bg-white px-[1.5mm] py-[2mm] font-mono text-black print:block">
      <div className="text-center">
        <img src="/logo-pos.png" alt="Leman's Deli" className="mx-auto w-[42mm] object-contain" />
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-0.5 text-[9px] leading-[1.35]">
        <p>Adisyon No: {props.receiptNumber}</p>
        <p>Tarih: {now.toLocaleDateString("tr-TR")}</p>
        <p>Saat: {now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
        <p>Sipariş: {props.orderLabel}</p>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-2 text-[10px] font-semibold leading-[1.3]">
        {props.cart.map((item) => (
          <div key={item.lineId} className="grid grid-cols-[1fr_auto] gap-1.5">
            <span className="min-w-0 break-words pr-1">
              {item.quantity > 1 ? `${item.quantity} x ` : ""}
              {item.portionType === "half" ? "½ " : ""}
              {nameOf(item)}
              {item.displayPortion ? ` (${item.displayPortion})` : ""}
            </span>
            <span className="whitespace-nowrap text-right">{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-1 text-[9px]">
        <div className="grid grid-cols-[1fr_auto]"><span>Ara toplam</span><span>{money(props.subtotal)} ₺</span></div>
        {props.discount > 0 && (
          <div className="grid grid-cols-[1fr_auto]"><span>İndirim {props.discountLabel}</span><span>-{money(props.discount)} ₺</span></div>
        )}
      </div>
      <div className="mt-1 grid grid-cols-[1fr_auto] text-[15px] font-bold"><span>TOPLAM</span><span>{money(props.total)} ₺</span></div>
      {props.paymentLabel && <p className="mt-2 text-[9px] font-bold">Durum: {props.paymentLabel}</p>}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center text-[9px] font-bold leading-[1.45]">
        <p>BU BELGE MALİ DEĞERİ OLMAYAN</p><p>BİLGİLENDİRME AMAÇLI ADİSYONDUR.</p>
      </div>
      <div className="mt-3 text-center text-[9px]"><p>Teşekkür ederiz.</p><p>@lemansdeli · Kaş</p></div>
    </section>
  );
}
