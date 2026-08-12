"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import PaymentModal from "../../components/pos/PaymentModal";
import Receipt from "../../components/pos/Receipt";
import WeightModal from "../../components/pos/WeightModal";
import type {
  CartItem,
  Category,
  DiscountType,
  MenuItem,
  OpenOrder,
  OrderType,
  PaymentMethod,
  PortionType,
  PosTable,
} from "../../components/pos/types";
import {
  BRAND_FONT,
  HALF_CATEGORIES,
  PAYMENT_LABELS,
  WEIGHT_CATEGORIES,
  categorySlug,
  halfPortion,
  money,
  nameOf,
  receiptNo,
} from "../../components/pos/utils";


type IncomingOrder = {
  id: number;
  receipt_number: string | null;
  order_type: string | null;
  table_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  order_note: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total: number | null;
  payment_method: string | null;
  status: string;
  source: string | null;
  external_order_id: string | null;
  external_status: string | null;
  created_at: string;
};

type IntegrationAccount = {
  channel: "trendyol" | "yemeksepeti";
  active: boolean;
  credentials_configured: boolean;
  last_sync_at: string | null;
};

function sourceLabel(source: string | null) {
  if (source === "web") return "WEB SİPARİŞİ";
  if (source === "trendyol") return "TRENDYOL GO";
  if (source === "yemeksepeti") return "YEMEKSEPETİ";
  return "SİPARİŞ";
}

function sourceBadgeClass(source: string | null) {
  if (source === "web") return "bg-emerald-100 text-emerald-800";
  if (source === "trendyol") return "bg-orange-100 text-orange-800";
  if (source === "yemeksepeti") return "bg-pink-100 text-pink-800";
  return "bg-slate-100 text-slate-700";
}

function phoneHref(phone: string | null) {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9+]/g, "");
  return clean ? `tel:${clean}` : null;
}

function whatsappHref(phone: string | null) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits ? `https://wa.me/${digits}` : null;
}

function mapsHref(address: string | null) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<IncomingOrder[]>([]);
  const [integrationAccounts, setIntegrationAccounts] = useState<IntegrationAccount[]>([]);
  const [channelMessage, setChannelMessage] = useState("");
  const [syncingTrendyol, setSyncingTrendyol] = useState(false);
  const [trendyolAutoSync, setTrendyolAutoSync] = useState(false);
  const [newOrderNotice, setNewOrderNotice] = useState<IncomingOrder | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("Masa");
  const [tableId, setTableId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weightItem, setWeightItem] = useState<MenuItem | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [mealCard, setMealCard] = useState("");
  const [internalReason, setInternalReason] = useState("Personel");
  const [printAfterClose, setPrintAfterClose] = useState(true);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = useState("");

  const [printedReceipt, setPrintedReceipt] = useState("");
  const [printedPayment, setPrintedPayment] = useState("");
  const [printedCart, setPrintedCart] = useState<CartItem[]>([]);
  const [printedSubtotal, setPrintedSubtotal] = useState(0);
  const [printedDiscount, setPrintedDiscount] = useState(0);
  const [printedDiscountLabel, setPrintedDiscountLabel] = useState("");
  const [printedTotal, setPrintedTotal] = useState(0);
  const [printedOrderLabel, setPrintedOrderLabel] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      categoryResult,
      itemResult,
      tableResult,
      orderResult,
      incomingResult,
      accountResult,
    ] = await Promise.all([
      supabase.from("categories").select("id,slug,name_tr,sort_order,active").eq("active", true).order("sort_order"),
      supabase.from("menu_items").select("id,name,name_tr,price,portion,category_id,category,active,sort_order").eq("active", true).not("price", "is", null).order("sort_order"),
      supabase.from("pos_tables").select("id,name,sort_order,active").eq("active", true).order("sort_order"),
      supabase.from("pos_orders").select("id,table_id,total").eq("status", "open"),
      supabase
        .from("pos_orders")
        .select("id,receipt_number,order_type,table_id,customer_name,customer_phone,delivery_address,order_note,subtotal,discount_amount,total,payment_method,status,source,external_order_id,external_status,created_at")
        .eq("status", "open")
        .in("source", ["web", "trendyol", "yemeksepeti"])
        .order("created_at", { ascending: false }),
      supabase
        .from("integration_accounts")
        .select("channel,active,credentials_configured,last_sync_at")
        .eq("environment", "production"),
    ]);
    const error =
      categoryResult.error ||
      itemResult.error ||
      tableResult.error ||
      orderResult.error ||
      incomingResult.error ||
      accountResult.error;
    if (error) {
      alert(`POS verileri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }
    const loadedCategories = (categoryResult.data ?? []) as Category[];
    setCategories(loadedCategories);
    setItems((itemResult.data ?? []) as MenuItem[]);
    setTables((tableResult.data ?? []) as PosTable[]);
    setOpenOrders((orderResult.data ?? []) as OpenOrder[]);
    setIncomingOrders((incomingResult.data ?? []) as IncomingOrder[]);
    setIntegrationAccounts((accountResult.data ?? []) as IntegrationAccount[]);
    if (loadedCategories.length > 0) setActiveCategoryId((current) => current ?? loadedCategories[0].id);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("pos-live-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_orders" },
        (payload) => {
          const row = payload.new as Partial<IncomingOrder> | null;

          if (
            payload.eventType === "INSERT" &&
            row &&
            row.status === "open" &&
            ["web", "trendyol", "yemeksepeti"].includes(String(row.source))
          ) {
            setNewOrderNotice(row as IncomingOrder);
          }

          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    if (!trendyolAutoSync) return;

    const timer = window.setInterval(() => {
      void syncTrendyol(false);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [trendyolAutoSync]);

  async function syncTrendyol(showMessage = true) {
    if (syncingTrendyol) return;

    setSyncingTrendyol(true);
    if (showMessage) setChannelMessage("Trendyol Go siparişleri sorgulanıyor...");

    try {
      const response = await fetch("/api/integrations/trendyolgo/sync", {
        method: "POST",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        fetched?: number;
        imported?: number;
        skipped?: number;
        unmatched?: number;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Trendyol Go sorgusu başarısız.");
      }

      if (showMessage || Number(data.imported || 0) > 0) {
        setChannelMessage(
          `Trendyol: ${data.imported ?? 0} yeni sipariş · ${data.unmatched ?? 0} eşleşmeyen ürün`
        );
      }

      await loadData();
    } catch (error) {
      setChannelMessage(
        error instanceof Error ? error.message : "Trendyol Go sorgulanamadı."
      );
    } finally {
      setSyncingTrendyol(false);
    }
  }

  async function openIncomingOrder(order: IncomingOrder) {
    const { data, error } = await supabase
      .from("pos_order_items")
      .select("id,menu_item_id,product_name,quantity,portion_type,portion_label,weight_grams,unit_price")
      .eq("order_id", order.id)
      .order("id");

    if (error) {
      alert(error.message);
      return;
    }

    const restored = (data ?? []).map((row): CartItem => {
      const source = items.find((item) => item.id === row.menu_item_id);
      return {
        id: source?.id ?? row.menu_item_id ?? -1,
        name: source?.name ?? row.product_name,
        name_tr: source?.name_tr ?? row.product_name,
        price: source?.price ?? Number(row.unit_price),
        portion: source?.portion ?? null,
        category_id: source?.category_id ?? null,
        category: source?.category ?? null,
        active: true,
        sort_order: source?.sort_order ?? 0,
        lineId: `saved-${row.id}`,
        quantity: Number(row.quantity),
        portionType: (row.portion_type as PortionType) ?? "unit",
        unitPrice: Number(row.unit_price),
        displayPortion: row.portion_label,
        weightGrams: row.weight_grams,
      };
    });

    setOrderType(order.order_type === "Gel-Al" ? "Gel-Al" : "Paket");
    setTableId(null);
    setOrderId(order.id);
    setCustomerName(order.customer_name || "");
    setOrderNote(order.order_note || "");
    setDiscountType("none");
    setDiscountValue("");
    setCart(restored);
    setNewOrderNotice(null);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  async function setIncomingStage(
    orderIdValue: number,
    stage: "new" | "preparing" | "ready"
  ) {
    const { error } = await supabase
      .from("pos_orders")
      .update({ external_status: stage })
      .eq("id", orderIdValue);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  const visibleItems = useMemo(() => {
    const category = categories.find((item) => item.id === activeCategoryId);
    if (!category) return [];
    return items
      .filter((item) => item.category_id !== null ? item.category_id === category.id : item.category === category.slug)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [activeCategoryId, categories, items]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const discountAmount = useMemo(() => {
    const value = Number(discountValue.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (discountType === "percent") return Math.min(subtotal, (subtotal * value) / 100);
    if (discountType === "amount") return Math.min(subtotal, value);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);
  const discountLabel = discountType === "percent" && discountAmount > 0
    ? `%${Number(discountValue.replace(",", "."))}`
    : discountType === "amount" && discountAmount > 0 ? "Tutar indirimi" : "";

  const calculatedWeightPrice = useMemo(() => {
    if (!weightItem) return 0;
    const grams = Number(weightInput.replace(",", "."));
    return Number.isFinite(grams) && grams > 0 ? ((weightItem.price ?? 0) * grams) / 1000 : 0;
  }, [weightInput, weightItem]);

  async function selectTable(table: PosTable) {
    setOrderType("Masa"); setTableId(table.id); setCart([]); setOrderId(null);
    setCustomerName(""); setOrderNote(""); setDiscountType("none"); setDiscountValue("");
    const { data: order, error } = await supabase
      .from("pos_orders")
      .select("id,customer_name,order_note,discount_type,discount_value")
      .eq("table_id", table.id).eq("status", "open").maybeSingle();
    if (error) { alert(error.message); return; }
    if (!order) return;
    const { data, error: itemError } = await supabase
      .from("pos_order_items")
      .select("id,menu_item_id,product_name,quantity,portion_type,portion_label,weight_grams,unit_price")
      .eq("order_id", order.id).order("id");
    if (itemError) { alert(itemError.message); return; }
    const restored = (data ?? []).map((row): CartItem => {
      const source = items.find((item) => item.id === row.menu_item_id);
      return {
        id: source?.id ?? row.menu_item_id ?? -1,
        name: source?.name ?? row.product_name,
        name_tr: source?.name_tr ?? row.product_name,
        price: source?.price ?? Number(row.unit_price),
        portion: source?.portion ?? null,
        category_id: source?.category_id ?? null,
        category: source?.category ?? null,
        active: true,
        sort_order: source?.sort_order ?? 0,
        lineId: `saved-${row.id}`,
        quantity: Number(row.quantity),
        portionType: (row.portion_type as PortionType) ?? "unit",
        unitPrice: Number(row.unit_price),
        displayPortion: row.portion_label,
        weightGrams: row.weight_grams,
      };
    });
    setOrderId(order.id); setCustomerName(order.customer_name || ""); setOrderNote(order.order_note || "");
    setDiscountType((order.discount_type as DiscountType) || "none");
    setDiscountValue(order.discount_value ? String(order.discount_value) : "");
    setCart(restored);
  }

  function startNonTable(type: "Paket" | "Gel-Al") {
    setOrderType(type); setTableId(null); setOrderId(null); setCart([]);
    setCustomerName(""); setOrderNote(""); setDiscountType("none"); setDiscountValue("");
  }

  function addStandard(item: MenuItem, portionType: PortionType) {
    const unitPrice = (item.price ?? 0) * (portionType === "half" ? 0.5 : 1);
    const lineId = `${item.id}-${portionType}`;
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.lineId === lineId);
      if (existing) return current.map((cartItem) => cartItem.lineId === lineId ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem);
      return [...current, {
        ...item, lineId, quantity: 1, portionType, unitPrice, weightGrams: null,
        displayPortion: portionType === "half" ? halfPortion(item.portion) : item.portion,
      }];
    });
  }

  function addWeight() {
    if (!weightItem) return;
    const grams = Number(weightInput.replace(",", "."));
    if (!Number.isFinite(grams) || grams <= 0) { alert("Geçerli gramaj girin."); return; }
    setCart((current) => [...current, {
      ...weightItem,
      lineId: `${weightItem.id}-weight-${Date.now()}`,
      quantity: 1,
      portionType: "weight",
      unitPrice: ((weightItem.price ?? 0) * grams) / 1000,
      displayPortion: `${grams} gr`,
      weightGrams: grams,
    }]);
    setWeightItem(null); setWeightInput("");
  }

  function changeQuantity(lineId: string, amount: number) {
    setCart((current) => current
      .map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + amount } : item)
      .filter((item) => item.quantity > 0));
  }

  async function replaceItems(targetOrderId: number) {
    const { error: deleteError } = await supabase.from("pos_order_items").delete().eq("order_id", targetOrderId);
    if (deleteError) throw deleteError;
    if (!cart.length) return;
    const { error } = await supabase.from("pos_order_items").insert(cart.map((item) => ({
      order_id: targetOrderId,
      menu_item_id: item.id > 0 ? item.id : null,
      product_name: nameOf(item),
      quantity: item.quantity,
      portion_type: item.portionType,
      portion_label: item.displayPortion,
      weight_grams: item.weightGrams,
      unit_price: item.unitPrice,
      line_total: item.unitPrice * item.quantity,
    })));
    if (error) throw error;
  }

  async function saveOpen() {
    if (!cart.length) { alert("Sipariş boş."); return; }
    if (orderType === "Masa" && !tableId) { alert("Önce masa seçin."); return; }
    setSaving(true);
    try {
      let targetOrderId = orderId;
      const values = {
        customer_name: customerName || null,
        order_note: orderNote || null,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue ? Number(discountValue.replace(",", ".")) : 0,
        discount_amount: discountAmount,
        total,
      };
      if (!targetOrderId) {
        const { data, error } = await supabase.from("pos_orders").insert({
          receipt_number: `OPEN-${receiptNo()}`,
          order_type: orderType,
          table_id: orderType === "Masa" ? tableId : null,
          ...values,
          payment_method: "pending",
          status: "open",
        }).select("id").single();
        if (error) throw error;
        targetOrderId = data.id; setOrderId(targetOrderId);
      } else {
        const { error } = await supabase.from("pos_orders").update(values).eq("id", targetOrderId);
        if (error) throw error;
      }
     if (!targetOrderId) {
  throw new Error("Sipariş ID oluşturulamadı.");
}

await replaceItems(targetOrderId);
await loadData();
      alert(orderType === "Masa" ? "Adisyon masaya kaydedildi." : "Sipariş beklemeye alındı.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally { setSaving(false); }
  }

  function preparePrint(label: string, paymentLabel: string, nextReceipt: string) {
    setPrintedReceipt(nextReceipt); setPrintedPayment(paymentLabel); setPrintedCart([...cart]);
    setPrintedSubtotal(subtotal); setPrintedDiscount(discountAmount); setPrintedDiscountLabel(discountLabel);
    setPrintedTotal(total); setPrintedOrderLabel(label);
  }

  function printCurrentOrder() {
    if (!cart.length) { alert("Sipariş boş."); return; }
    const label = orderType === "Masa" ? tables.find((table) => table.id === tableId)?.name || "Masa" : orderType;
    preparePrint(label, "ÖDENMEDİ / AÇIK ADİSYON", orderId ? `AÇIK-${orderId}` : `AÇIK-${receiptNo()}`);
    window.setTimeout(() => window.print(), 150);
  }

  async function closeOrder() {
    const mixed = (Number(cash) || 0) + (Number(card) || 0) + (Number(mealCard) || 0);
    if (payment === "mixed" && Math.abs(mixed - total) > 0.01) {
      alert(`Karma ödeme ${money(total)} ₺ olmalı.`); return;
    }
    setSaving(true);
    try {
      const nextReceipt = receiptNo();
      const label = orderType === "Masa" ? tables.find((table) => table.id === tableId)?.name || "Masa" : orderType;
      const paymentLabel = payment === "internal" ? `${PAYMENT_LABELS[payment]} – ${internalReason}` : PAYMENT_LABELS[payment];
      let targetOrderId = orderId;
      const amounts = {
        cash_amount: payment === "cash" ? total : payment === "mixed" ? Number(cash) || 0 : 0,
        card_amount: payment === "card" ? total : payment === "mixed" ? Number(card) || 0 : 0,
        meal_card_amount: payment === "meal_card" ? total : payment === "mixed" ? Number(mealCard) || 0 : 0,
      };
      const values = {
        receipt_number: nextReceipt,
        customer_name: customerName || null,
        order_note: orderNote || null,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue ? Number(discountValue.replace(",", ".")) : 0,
        discount_amount: discountAmount,
        total,
        payment_method: payment,
        ...amounts,
        internal_reason: payment === "internal" ? internalReason : null,
        status: "closed",
        closed_at: new Date().toISOString(),
      };
      if (!targetOrderId) {
        const { data, error } = await supabase.from("pos_orders").insert({
          ...values,
          order_type: orderType,
          table_id: orderType === "Masa" ? tableId : null,
        }).select("id").single();
        if (error) throw error;
        targetOrderId = data.id;
      } else {
        const { error } = await supabase.from("pos_orders").update(values).eq("id", targetOrderId);
        if (error) throw error;
      }

      if (!targetOrderId) {
        throw new Error("Adisyon ID oluşturulamadı.");
      }

      await replaceItems(targetOrderId);

      const { error: stockError } = await supabase.rpc(
        "apply_stock_for_pos_order",
        { p_order_id: targetOrderId }
      );

      if (stockError) {
        throw new Error(`Adisyon kapandı fakat stok düşürülemedi: ${stockError.message}`);
      }

      preparePrint(label, paymentLabel, nextReceipt);
      setPaymentOpen(false);
      if (printAfterClose) window.setTimeout(() => window.print(), 200);
      setCart([]); setOrderId(null); setTableId(null); setCustomerName(""); setOrderNote("");
      setDiscountType("none"); setDiscountValue("");
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Adisyon kapatılamadı.");
    } finally { setSaving(false); }
  }

  return (
    <>
      <style jsx global>{`
        @page { size: 58mm auto; margin: 0; }
        @media print {
          html, body { width: 58mm !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; box-sizing: border-box !important; }
          #thermal-receipt { position: absolute !important; top: 0 !important; left: 0 !important; width: 48mm !important; margin: 0 !important; padding: 1.5mm !important; background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <main className="min-h-screen bg-[#f4efe5] text-[#292821]">
        <div className="no-print mx-auto max-w-[1500px] px-4 py-5">
          <header className="mb-5 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Leman&apos;s Deli POS</h1>
              <p className="mt-1 text-sm opacity-50">Masa, gramaj, indirim ve ödeme yönetimi</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => startNonTable("Paket")} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">📦 Yeni Paket</button>
              <button type="button" onClick={() => startNonTable("Gel-Al")} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">🛍 Yeni Gel-Al</button>
              <a href="/pos/orders" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Kapanan Adisyonlar</a>
              <a href="/pos/report" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Raporlar</a>
              <a href="/pos/stock" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Stok</a>
              <a href="/pos/stock/link" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Stok Bağlantıları</a>
              <a href="/tv-menu/admin" className="rounded-xl border bg-white px-4 py-2 text-sm">Menü Yönetimi</a>
            </div>
          </header>

          <section className="mb-5 rounded-3xl border border-[#6e1f12]/10 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2
                  className="text-xl font-bold text-[#6e1f12]"
                  style={{ fontFamily: BRAND_FONT }}
                >
                  Sipariş Kanalları
                </h2>
                <p className="mt-1 text-xs opacity-50">
                  Web siparişleri anlık gelir. Trendyol Go burada sorgulanabilir; istersen 60 sn otomatik sorgu açabilirsin.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void syncTrendyol(true)}
                  disabled={syncingTrendyol}
                  className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-800 disabled:opacity-50"
                >
                  {syncingTrendyol ? "Trendyol Sorgulanıyor..." : "🟠 Trendyol'u Çek"}
                </button>

                <button
                  type="button"
                  onClick={() => setTrendyolAutoSync((value) => !value)}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                    trendyolAutoSync
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-black/10 bg-white text-[#292821]"
                  }`}
                >
                  {trendyolAutoSync ? "✓ Trendyol Otomatik: Açık" : "Trendyol Otomatik: Kapalı"}
                </button>

                <button
                  type="button"
                  disabled
                  title="Yemeksepeti Partner API erişimi henüz bağlı değil."
                  className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-800 opacity-55"
                >
                  🩷 Yemeksepeti · API Bekleniyor
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {integrationAccounts.map((account) => (
                <span
                  key={account.channel}
                  className="rounded-full bg-[#f4efe5] px-3 py-1.5"
                >
                  {account.channel === "trendyol" ? "Trendyol" : "Yemeksepeti"}:{" "}
                  {account.active ? "aktif" : "pasif"} ·{" "}
                  {account.credentials_configured ? "bilgiler hazır" : "bilgiler eksik"}
                </span>
              ))}
            </div>

            {channelMessage && (
              <p className="mt-3 rounded-xl bg-[#f4efe5] px-4 py-3 text-sm">
                {channelMessage}
              </p>
            )}
          </section>

          {incomingOrders.length > 0 && (
            <section className="mb-5 rounded-3xl border-2 border-[#6e1f12]/20 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2
                    className="text-xl font-bold text-[#6e1f12]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    Yeni Siparişler
                  </h2>
                  <p className="mt-1 text-xs opacity-50">
                    Web, Trendyol Go ve ileride Yemeksepeti siparişleri burada toplanır.
                  </p>
                </div>
                <span className="rounded-full bg-[#6e1f12] px-3 py-1.5 text-xs font-bold text-white">
                  {incomingOrders.length}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {incomingOrders.map((order) => {
                  const call = phoneHref(order.customer_phone);
                  const whatsapp = whatsappHref(order.customer_phone);
                  const maps = mapsHref(order.delivery_address);
                  const stage = order.external_status || "new";

                  return (
                    <article
                      key={order.id}
                      className="rounded-2xl border border-black/10 bg-[#fffdf8] p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${sourceBadgeClass(order.source)}`}>
                            {stage === "new" ? "YENİ · " : ""}
                            {sourceLabel(order.source)}
                          </span>
                          <p className="mt-2 text-lg font-bold text-[#6e1f12]">
                            {order.customer_name || "İsimsiz müşteri"}
                          </p>
                          <p className="mt-1 text-xs opacity-55">
                            {order.receipt_number || `Sipariş #${order.id}`} ·{" "}
                            {order.order_type || "Paket"}
                          </p>
                        </div>
                        <p className="text-xl font-bold text-[#6e1f12]">
                          {money(Number(order.total || 0))} ₺
                        </p>
                      </div>

                      {order.customer_phone && (
                        <p className="mt-3 text-sm font-semibold">
                          📱 {order.customer_phone}
                        </p>
                      )}
                      {order.delivery_address && (
                        <p className="mt-2 text-sm leading-5">
                          📍 {order.delivery_address}
                        </p>
                      )}
                      {order.order_note && (
                        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                          <strong>Not:</strong> {order.order_note}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {call && (
                          <a
                            href={call}
                            className="rounded-xl border bg-white px-3 py-2 text-xs font-bold"
                          >
                            📞 Ara
                          </a>
                        )}
                        {whatsapp && (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-800"
                          >
                            WhatsApp
                          </a>
                        )}
                        {maps && (
                          <a
                            href={maps}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"
                          >
                            📍 Haritada Aç
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void openIncomingOrder(order)}
                          className="rounded-xl bg-[#6e1f12] px-3 py-2 text-xs font-bold text-white"
                        >
                          Siparişi Aç
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => void setIncomingStage(order.id, "new")}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${stage === "new" ? "bg-slate-800 text-white" : "bg-white"}`}
                        >
                          Yeni
                        </button>
                        <button
                          type="button"
                          onClick={() => void setIncomingStage(order.id, "preparing")}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${stage === "preparing" ? "bg-amber-500 text-white" : "bg-white"}`}
                        >
                          Hazırlanıyor
                        </button>
                        <button
                          type="button"
                          onClick={() => void setIncomingStage(order.id, "ready")}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${stage === "ready" ? "bg-green-600 text-white" : "bg-white"}`}
                        >
                          Hazır
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mb-5 rounded-3xl border border-[#6e1f12]/10 bg-white p-4">
            <h2 className="mb-3 text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Masalar</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {tables.map((table) => {
                const open = openOrders.find((order) => order.table_id === table.id);
                const selected = tableId === table.id && orderType === "Masa";
                return (
                  <button key={table.id} type="button" onClick={() => void selectTable(table)} className={`rounded-2xl border p-4 text-left ${selected ? "border-[#6e1f12] ring-2 ring-[#6e1f12]/20" : open ? "border-red-800/30 bg-red-50" : "border-green-800/20 bg-green-50"}`}>
                    <p className="font-bold">{table.name}</p><p className="mt-2 text-xs opacity-60">{open ? `${money(open.total)} ₺` : "Boş"}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_410px]">
            <section>
              <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#6e1f12]">
                Aktif işlem: {orderType === "Masa" ? tables.find((table) => table.id === tableId)?.name || "Masa seçilmedi" : orderType}
              </div>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                {categories.map((category) => (
                  <button key={category.id} type="button" onClick={() => setActiveCategoryId(category.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${activeCategoryId === category.id ? "bg-[#6e1f12] text-white" : "bg-white text-[#6e1f12]"}`}>
                    {category.name_tr}
                  </button>
                ))}
              </div>
              {loading ? <p>Ürünler yükleniyor...</p> : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {visibleItems.map((item) => {
                    const slug = categorySlug(item, categories);
                    const isPortion = HALF_CATEGORIES.has(slug);
                    const isWeight = WEIGHT_CATEGORIES.has(slug);
                    return (
                      <article key={item.id} className="flex min-h-40 flex-col rounded-2xl border border-[#6e1f12]/10 bg-white p-4 shadow-sm">
                        <div className="flex-1">
                          <p className="font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>{nameOf(item)}</p>
                          {item.portion && <p className="mt-1 text-sm opacity-55">{item.portion}</p>}
                          <p className="mt-3 text-lg font-bold">{money(item.price ?? 0)} ₺{isWeight ? " / kg" : ""}</p>
                        </div>
                        {isPortion ? (
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => addStandard(item, "full")} className="rounded-xl bg-[#6e1f12] px-3 py-3 text-sm font-bold text-white">+ Tam</button>
                            <button type="button" onClick={() => addStandard(item, "half")} className="rounded-xl border bg-[#f4efe5] px-3 py-3 text-sm font-bold text-[#6e1f12]">+ ½</button>
                          </div>
                        ) : isWeight ? (
                          <button type="button" onClick={() => { setWeightItem(item); setWeightInput(""); }} className="mt-4 rounded-xl bg-[#6e1f12] px-3 py-3 text-sm font-bold text-white">Gram Gir</button>
                        ) : (
                          <button type="button" onClick={() => addStandard(item, "unit")} className="mt-4 rounded-xl bg-[#6e1f12] px-3 py-3 text-sm font-bold text-white">+ Sepete Ekle</button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="h-fit rounded-3xl border border-[#6e1f12]/10 bg-white p-5 shadow-sm lg:sticky lg:top-5">
              <h2 className="text-2xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Adisyon</h2>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Müşteri adı" className="mt-4 w-full rounded-xl border px-3 py-3" />
              <div className="mt-5 space-y-3">
                {!cart.length ? <p className="rounded-xl bg-[#f4efe5] px-4 py-6 text-center text-sm opacity-50">Henüz ürün eklenmedi.</p> : cart.map((item) => (
                  <div key={item.lineId} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{item.portionType === "half" ? "½ " : ""}{nameOf(item)}</p>{item.displayPortion && <p className="mt-1 text-xs opacity-50">{item.displayPortion}</p>}</div>
                      <p className="shrink-0 font-bold">{money(item.unitPrice * item.quantity)} ₺</p>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => changeQuantity(item.lineId, -1)} className="h-9 w-9 rounded-full border">−</button>
                      <span className="min-w-8 text-center font-bold">{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.lineId, 1)} className="h-9 w-9 rounded-full border">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <textarea value={orderNote} onChange={(e) => setOrderNote(e.target.value)} rows={3} placeholder="Sipariş notu..." className="mt-4 w-full rounded-xl border px-3 py-3" />

              <div className="mt-5 rounded-2xl bg-[#f4efe5] p-4">
                <p className="mb-3 text-sm font-semibold text-[#6e1f12]">İndirim</p>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => { setDiscountType("none"); setDiscountValue(""); }} className={`rounded-xl border px-2 py-2 text-xs font-bold ${discountType === "none" ? "bg-[#6e1f12] text-white" : "bg-white"}`}>Yok</button>
                  {[5, 10, 15].map((value) => <button key={value} type="button" onClick={() => { setDiscountType("percent"); setDiscountValue(String(value)); }} className={`rounded-xl border px-2 py-2 text-xs font-bold ${discountType === "percent" && discountValue === String(value) ? "bg-[#6e1f12] text-white" : "bg-white"}`}>%{value}</button>)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setDiscountType("percent"); setDiscountValue("20"); }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${discountType === "percent" && discountValue === "20" ? "bg-[#6e1f12] text-white" : "bg-white"}`}>%20</button>
                  <button type="button" onClick={() => { setDiscountType("amount"); setDiscountValue(""); }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${discountType === "amount" ? "bg-[#6e1f12] text-white" : "bg-white"}`}>₺ Manuel</button>
                </div>
                {discountType !== "none" && <input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percent" ? "İndirim yüzdesi" : "İndirim tutarı"} className="mt-2 w-full rounded-xl border bg-white px-3 py-3" />}
              </div>

              <div className="mt-5 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between"><span>Ara toplam</span><span>{money(subtotal)} ₺</span></div>
                {discountAmount > 0 && <div className="flex justify-between text-[#6e1f12]"><span>İndirim {discountLabel}</span><span>-{money(discountAmount)} ₺</span></div>}
                <div className="flex justify-between pt-2 text-lg font-semibold"><span>Ödenecek</span><span className="text-2xl font-bold text-[#6e1f12]">{money(total)} ₺</span></div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={printCurrentOrder} disabled={!cart.length} className="rounded-xl border px-4 py-4 font-bold disabled:opacity-40">Adisyon Yazdır</button>
                <button type="button" onClick={() => void saveOpen()} disabled={saving || !cart.length} className="rounded-xl border border-[#6e1f12]/20 px-4 py-4 font-bold text-[#6e1f12] disabled:opacity-40">{orderType === "Masa" ? "Masaya Kaydet" : "Beklemeye Al"}</button>
              </div>
              <button type="button" onClick={() => { if (!cart.length) return; setPaymentOpen(true); setPayment("cash"); setCash(""); setCard(""); setMealCard(""); }} disabled={saving || !cart.length} className="mt-3 w-full rounded-xl bg-[#6e1f12] px-4 py-4 font-bold text-white disabled:opacity-40">Hesabı Kapat</button>
            </aside>
          </div>
        </div>

        {newOrderNotice && (
          <div className="fixed inset-x-4 top-4 z-[120] mx-auto max-w-xl rounded-2xl border-2 border-[#6e1f12] bg-white p-4 shadow-2xl no-print">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${sourceBadgeClass(newOrderNotice.source)}`}>
                  YENİ · {sourceLabel(newOrderNotice.source)}
                </span>
                <p className="mt-2 text-lg font-bold text-[#6e1f12]">
                  {newOrderNotice.customer_name || "Yeni müşteri"}
                </p>
                <p className="mt-1 text-sm">
                  {money(Number(newOrderNotice.total || 0))} ₺
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewOrderNotice(null)}
                className="rounded-full border px-3 py-2 text-sm"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {weightItem && <WeightModal item={weightItem} grams={weightInput} calculatedPrice={calculatedWeightPrice} onGramsChange={setWeightInput} onCancel={() => { setWeightItem(null); setWeightInput(""); }} onAdd={addWeight} />}
        {paymentOpen && <PaymentModal subtotal={subtotal} discountAmount={discountAmount} discountLabel={discountLabel} total={total} payment={payment} cash={cash} card={card} mealCard={mealCard} internalReason={internalReason} printAfterClose={printAfterClose} saving={saving} onPaymentChange={setPayment} onCashChange={setCash} onCardChange={setCard} onMealCardChange={setMealCard} onInternalReasonChange={setInternalReason} onPrintAfterCloseChange={setPrintAfterClose} onCancel={() => setPaymentOpen(false)} onClose={() => void closeOrder()} />}
        <Receipt receiptNumber={printedReceipt} orderLabel={printedOrderLabel} paymentLabel={printedPayment} cart={printedCart} subtotal={printedSubtotal} discount={printedDiscount} discountLabel={printedDiscountLabel} total={printedTotal} />
      </main>
    </>
  );
}