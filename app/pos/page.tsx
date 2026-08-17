"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  pos_stage: string | null;
  created_at: string;
};

type IntegrationAccount = {
  channel: "trendyol" | "yemeksepeti";
  active: boolean;
  credentials_configured: boolean;
  last_sync_at: string | null;
};


type OnlineOrderSettings = {
  id: number;
  ordering_enabled: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  auto_schedule_enabled: boolean;
  open_time: string;
  close_time: string;
  pickup_minimum: number;
  delivery_minimum: number;
  prep_time_min: number;
  prep_time_max: number;
  closed_message: string;
  busy_message: string | null;
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
  const [onlineSettings, setOnlineSettings] =
    useState<OnlineOrderSettings | null>(null);
  const [savingOnlineSettings, setSavingOnlineSettings] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const alertsEnabledRef = useRef(false);
  const [alarmMuted, setAlarmMuted] = useState(false);
  const knownIncomingIdsRef = useRef<Set<number>>(new Set());
  const alarmRepeatTimerRef = useRef<number | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const initialIncomingLoadedRef = useRef(false);
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
      onlineSettingsResult,
    ] = await Promise.all([
      supabase.from("categories").select("id,slug,name_tr,sort_order,active").eq("active", true).order("sort_order"),
      supabase.from("menu_items").select("id,name,name_tr,price,portion,category_id,category,active,sort_order").eq("active", true).not("price", "is", null).order("sort_order"),
      supabase.from("pos_tables").select("id,name,sort_order,active").eq("active", true).order("sort_order"),
      supabase.from("pos_orders").select("id,table_id,total").eq("status", "open"),
      supabase
        .from("pos_orders")
        .select("id,receipt_number,order_type,table_id,customer_name,customer_phone,delivery_address,order_note,subtotal,discount_amount,total,payment_method,status,source,external_order_id,external_status,pos_stage,created_at")
        .eq("status", "open")
        .in("source", ["web", "trendyol", "yemeksepeti"])
        .order("created_at", { ascending: false }),
      supabase
        .from("integration_accounts")
        .select("channel,active,credentials_configured,last_sync_at")
        .eq("environment", "production"),
      supabase
        .from("online_order_settings")
        .select(
          "id,ordering_enabled,pickup_enabled,delivery_enabled,auto_schedule_enabled,open_time,close_time,pickup_minimum,delivery_minimum,prep_time_min,prep_time_max,closed_message,busy_message"
        )
        .eq("id", 1)
        .single(),
    ]);
    const error =
      categoryResult.error ||
      itemResult.error ||
      tableResult.error ||
      orderResult.error ||
      incomingResult.error ||
      accountResult.error ||
      onlineSettingsResult.error;
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
    setOnlineSettings(onlineSettingsResult.data as OnlineOrderSettings);
    if (loadedCategories.length > 0) setActiveCategoryId((current) => current ?? loadedCategories[0].id);
    setLoading(false);
  }, []);

  const loadIncomingOrdersOnly = useCallback(async () => {
    const { data, error } = await supabase
      .from("pos_orders")
      .select(
        "id,receipt_number,order_type,table_id,customer_name,customer_phone,delivery_address,order_note,subtotal,discount_amount,total,payment_method,status,source,external_order_id,external_status,pos_stage,created_at"
      )
      .eq("status", "open")
      .in("source", ["web", "trendyol", "yemeksepeti"])
      .order("created_at", { ascending: false });

    if (error) return;

    const rows = (data ?? []) as IncomingOrder[];

    if (!initialIncomingLoadedRef.current) {
      knownIncomingIdsRef.current = new Set(rows.map((row) => row.id));
      initialIncomingLoadedRef.current = true;
      setIncomingOrders(rows);
      return;
    }

    const fresh = rows.filter(
      (row) => !knownIncomingIdsRef.current.has(row.id)
    );

    knownIncomingIdsRef.current = new Set(rows.map((row) => row.id));
    setIncomingOrders(rows);

    if (fresh.length > 0) {
      const newest = fresh[0];
      setAlarmMuted(false);
      setNewOrderNotice(newest);
      ringNewOrder();

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification(`Yeni ${sourceLabel(newest.source)}`, {
          body: `${newest.customer_name || "Müşteri"} · ${money(
            Number(newest.total || 0)
          )} ₺`,
        });
      }
    }
  }, [alertsEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadIncomingOrdersOnly();
      }
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadIncomingOrdersOnly]);

 useEffect(() => {
  void loadData();

  if (typeof window !== "undefined") {
    const saved =
      localStorage.getItem("lemans-pos-alerts") === "1";

    alertsEnabledRef.current = saved;
    setAlertsEnabled(saved);
  }
}, [loadData]);

useEffect(() => {
  if (!alertsEnabled || alarmMuted) return;

  const pendingOrder = incomingOrders.find(
    (order) => (order.pos_stage || "new") === "new"
  );

  if (!pendingOrder) {
    return;
  }

  if (newOrderNotice?.id !== pendingOrder.id) {
    setNewOrderNotice(pendingOrder);
    ringNewOrder();
  }
}, [
  incomingOrders,
  alertsEnabled,
  alarmMuted,
  newOrderNotice?.id,
]);

useEffect(() => {
  alertsEnabledRef.current = alertsEnabled;
}, [alertsEnabled]);

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
            const incoming = row as IncomingOrder;
            knownIncomingIdsRef.current.add(incoming.id);
            setAlarmMuted(false);
            setNewOrderNotice(incoming);
            ringNewOrder();

            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              new Notification(`Yeni ${sourceLabel(incoming.source)}`, {
                body: `${incoming.customer_name || "Müşteri"} · ${money(
                  Number(incoming.total || 0)
                )} ₺`,
              });
            }
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
}, 6_000);

    return () => window.clearInterval(timer);
  }, [trendyolAutoSync]);

  useEffect(() => {
    if (alarmRepeatTimerRef.current) {
      window.clearTimeout(alarmRepeatTimerRef.current);
      alarmRepeatTimerRef.current = null;
    }

    if (!newOrderNotice || !alertsEnabled || alarmMuted) return;

    // İlk alarm yeni sipariş algılandığı anda zaten çalıyor.
    // Kabul edilmezse yalnızca 60 saniye sonra BİR KEZ daha hatırlat.
    alarmRepeatTimerRef.current = window.setTimeout(() => {
      ringNewOrder();
      alarmRepeatTimerRef.current = null;
    }, 60_000);

    return () => {
      if (alarmRepeatTimerRef.current) {
        window.clearTimeout(alarmRepeatTimerRef.current);
        alarmRepeatTimerRef.current = null;
      }
    };
  }, [newOrderNotice, alertsEnabled, alarmMuted]);

  function ringNewOrder(force = false) {
if (
  (!alertsEnabledRef.current && !force) ||
  typeof window === "undefined"
) {
  return;
}
    try {
      let audio = alarmAudioRef.current;
      if (!audio) {
        audio = new Audio("/pos-alarm.wav");
        audio.preload = "auto";
        audio.volume = 1;
        alarmAudioRef.current = audio;
      }

      audio.pause();
      audio.currentTime = 0;

      void audio.play().catch(() => {
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }).webkitAudioContext;

          if (!AudioContextClass) return;

          const context = new AudioContextClass();
          const now = context.currentTime;

          [0, 0.25, 0.5, 0.75].forEach((offset, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = "square";
            oscillator.frequency.setValueAtTime(
              index % 2 === 0 ? 1200 : 700,
              now + offset
            );
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.55, now + offset + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.21);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.22);
          });

          window.setTimeout(() => void context.close(), 1500);
        } catch {}
      });
    } catch {}
  }

  async function toggleAlerts() {
    const next = !alertsEnabled;

alertsEnabledRef.current = next;
setAlertsEnabled(next);

localStorage.setItem(
  "lemans-pos-alerts",
  next ? "1" : "0"
);

    if (!next) {
      setAlarmMuted(true);
      if (alarmRepeatTimerRef.current) {
        window.clearTimeout(alarmRepeatTimerRef.current);
        alarmRepeatTimerRef.current = null;
      }
      setChannelMessage("Yeni sipariş sesi kapatıldı.");
      return;
    }

    setAlarmMuted(false);

    try {
      let audio = alarmAudioRef.current;
      if (!audio) {
        audio = new Audio("/pos-alarm.wav");
        audio.preload = "auto";
        audio.volume = 1;
        alarmAudioRef.current = audio;
      }
      audio.currentTime = 0;
      await audio.play();
    } catch {}

    ringNewOrder(true);

    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      await Notification.requestPermission();
    }

    setChannelMessage("Yeni sipariş alarmı ve tarayıcı bildirimi etkinleştirildi.");
  }

  function muteCurrentAlarm() {
    setAlarmMuted(true);

    if (alarmRepeatTimerRef.current) {
      window.clearTimeout(alarmRepeatTimerRef.current);
      alarmRepeatTimerRef.current = null;
    }

    setChannelMessage(
      "Mevcut sipariş alarmı susturuldu. Yeni sipariş geldiğinde alarm tekrar çalışır."
    );
  }

  async function saveOnlineSettings(
    patch: Partial<OnlineOrderSettings>
  ) {
    if (!onlineSettings) return;

    const next = { ...onlineSettings, ...patch };
    setOnlineSettings(next);
    setSavingOnlineSettings(true);

    const { error } = await supabase
      .from("online_order_settings")
      .update({
        ordering_enabled: next.ordering_enabled,
        pickup_enabled: next.pickup_enabled,
        delivery_enabled: next.delivery_enabled,
        auto_schedule_enabled: next.auto_schedule_enabled,
        open_time: next.open_time,
        close_time: next.close_time,
        pickup_minimum: Number(next.pickup_minimum || 0),
        delivery_minimum: Number(next.delivery_minimum || 0),
        prep_time_min: Number(next.prep_time_min || 0),
        prep_time_max: Number(next.prep_time_max || 0),
        closed_message: next.closed_message,
        busy_message: next.busy_message || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    setSavingOnlineSettings(false);

    if (error) {
      alert(error.message);
      await loadData();
    }
  }

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
    const { error: stageError } = await supabase
      .from("pos_orders")
      .update({ pos_stage: "accepted" })
      .eq("id", order.id);

    if (stageError) {
      alert(stageError.message);
      return;
    }

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

  async function acceptIncomingOrder(order: IncomingOrder) {
    const paidOnline =
      order.source === "trendyol" && order.payment_method !== "pending";

    if (!paidOnline) {
      // Ödeme bekleyen siparişlerde mevcut adisyon akışını aç.
      await openIncomingOrder(order);
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("pos_orders")
      .update({
        status: "closed",
        closed_at: now,
        pos_stage: "accepted",
        card_amount: Number(order.total || 0),
        cash_amount: 0,
        meal_card_amount: 0,
      })
      .eq("id", order.id);

    if (error) {
      alert(error.message);
      return;
    }

    const { error: stockError } = await supabase.rpc(
      "apply_stock_for_pos_order",
      { p_order_id: order.id }
    );

    if (stockError) {
      alert(
        `Sipariş kabul edildi ve kapandı; stok düşümü kontrol edilmeli: ${stockError.message}`
      );
    }

    setNewOrderNotice(null);
    setChannelMessage(
      `${sourceLabel(order.source)} ${order.receipt_number || `#${order.id}`} kabul edildi ve ödendi olarak kapatıldı.`
    );
    await loadData();
  }

  async function setIncomingStage(
  orderIdValue: number,
  stage: "new" | "preparing" | "ready"
) {
  const { error } = await supabase
    .from("pos_orders")
    .update({ pos_stage: stage })
    .eq("id", orderIdValue);

  if (error) {
    alert(error.message);
    return;
  }

  if (stage === "preparing" || stage === "ready") {
    try {
      const response = await fetch("/api/orders/status-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: orderIdValue,
          stage,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        console.error(
          "Durum maili gönderilemedi:",
          result.error
        );
      }
    } catch (emailError) {
      console.error(
        "Durum maili gönderilemedi:",
        emailError
      );
    }
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

          {onlineSettings && (
            <section className="mb-5 rounded-3xl border-2 border-[#6e1f12]/15 bg-white p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2
                    className="text-xl font-bold text-[#6e1f12]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    Online Sipariş Kontrolü
                  </h2>
                  <p className="mt-1 text-xs opacity-50">
                    lemansdeli.com menüsünden gelen siparişleri buradan açıp kapat.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={savingOnlineSettings}
                  onClick={() =>
                    void saveOnlineSettings({
                      ordering_enabled: !onlineSettings.ordering_enabled,
                    })
                  }
                  className={`rounded-2xl px-5 py-3 text-sm font-bold text-white ${
                    onlineSettings.ordering_enabled
                      ? "bg-green-700"
                      : "bg-red-700"
                  }`}
                >
                  {onlineSettings.ordering_enabled
                    ? "🟢 ONLINE SİPARİŞ AÇIK"
                    : "🔴 ONLINE SİPARİŞ KAPALI"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() =>
                    void saveOnlineSettings({
                      pickup_enabled: !onlineSettings.pickup_enabled,
                    })
                  }
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    onlineSettings.pickup_enabled
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  Gel-Al: {onlineSettings.pickup_enabled ? "Açık" : "Kapalı"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void saveOnlineSettings({
                      delivery_enabled: !onlineSettings.delivery_enabled,
                    })
                  }
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    onlineSettings.delivery_enabled
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  Paket Servis: {onlineSettings.delivery_enabled ? "Açık" : "Kapalı"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void saveOnlineSettings({
                      auto_schedule_enabled:
                        !onlineSettings.auto_schedule_enabled,
                    })
                  }
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    onlineSettings.auto_schedule_enabled
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-black/10 bg-white"
                  }`}
                >
                  Saat Kuralı:{" "}
                  {onlineSettings.auto_schedule_enabled ? "Açık" : "Kapalı"}
                </button>

                <button
                  type="button"
                  onClick={() => void toggleAlerts()}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                    alertsEnabled
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-black/10 bg-white"
                  }`}
                >
                  🔔 Alarm & Bildirim: {alertsEnabled ? "Açık" : "Kapalı"}
                </button>
                <button
                  type="button"
                  onClick={() => ringNewOrder(true)}
                  className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-800"
                >
                  🚨 TEST ALARMI
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold">
                  Açılış
                  <input
                    type="time"
                    value={onlineSettings.open_time.slice(0, 5)}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        open_time: event.target.value,
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold">
                  Kapanış
                  <input
                    type="time"
                    value={onlineSettings.close_time.slice(0, 5)}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        close_time: event.target.value,
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold">
                  Gel-Al minimum ₺
                  <input
                    type="number"
                    min="0"
                    value={onlineSettings.pickup_minimum}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        pickup_minimum: Number(event.target.value || 0),
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold">
                  Paket minimum ₺
                  <input
                    type="number"
                    min="0"
                    value={onlineSettings.delivery_minimum}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        delivery_minimum: Number(event.target.value || 0),
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold">
                  Hazırlık min. dk
                  <input
                    type="number"
                    min="0"
                    value={onlineSettings.prep_time_min}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        prep_time_min: Number(event.target.value || 0),
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold">
                  Hazırlık max. dk
                  <input
                    type="number"
                    min={onlineSettings.prep_time_min}
                    value={onlineSettings.prep_time_max}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        prep_time_max: Number(event.target.value || 0),
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold md:col-span-2">
                  Yoğunluk mesajı
                  <input
                    value={onlineSettings.busy_message || ""}
                    onChange={(event) =>
                      setOnlineSettings({
                        ...onlineSettings,
                        busy_message: event.target.value,
                      })
                    }
                    onBlur={() => void saveOnlineSettings({})}
                    placeholder="Örn. Yoğunluk nedeniyle hazırlık süresi uzayabilir."
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
            </section>
          )}

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
                  const stage = order.pos_stage || "new";

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
                        <div className="text-right">
                          <p className="text-xl font-bold text-[#6e1f12]">
                            {money(Number(order.total || 0))} ₺
                          </p>
                          {order.source === "trendyol" && order.payment_method !== "pending" && (
                            <span className="mt-1 inline-flex rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-800">
                              ✓ ONLINE ÖDENDİ
                            </span>
                          )}
                        </div>
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
                          onClick={() => void acceptIncomingOrder(order)}
                          className="rounded-xl bg-[#6e1f12] px-3 py-2 text-xs font-bold text-white"
                        >
                          ✓ Kabul Et
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={muteCurrentAlarm}
                  className="rounded-xl border px-4 py-2 text-sm font-bold"
                >
                  🔕 Sustur
                </button>
                <button
                  type="button"
                  onClick={() => void acceptIncomingOrder(newOrderNotice)}
                  className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-bold text-white"
                >
                  ✓ Kabul Et
                </button>
              </div>
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