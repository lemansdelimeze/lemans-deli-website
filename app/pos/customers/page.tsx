"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Order = {
  id: number; receipt_number: string | null; customer_name: string | null;
  customer_phone: string | null; delivery_address: string | null; order_note: string | null;
  total: number | null; status: string; source: "web" | "trendyol" | "yemeksepeti" | "pos" | null;
  payment_method: string | null; created_at: string; closed_at: string | null;
};
type CrmCustomer = {
  key: string; name: string; phone: string | null; addresses: string[]; orders: Order[];
  completedOrders: number; totalSpent: number; lastOrderAt: string;
};
const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';
const money = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
function sourceLabel(source: Order["source"]) {
  return source === "trendyol" ? "Trendyol Go" : source === "yemeksepeti" ? "Yemeksepeti" : source === "web" ? "Website" : "POS";
}
function sourceClass(source: Order["source"]) {
  return source === "trendyol" ? "bg-orange-100 text-orange-800" : source === "yemeksepeti" ? "bg-pink-100 text-pink-800" : source === "web" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
}
function normalizePhone(value: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits.length === 10 ? `0${digits}` : digits;
}
function customerKey(order: Order) {
  const phone = normalizePhone(order.customer_phone);
  if (phone) return `phone:${phone}`;
  return `fallback:${String(order.customer_name || "").trim().toLocaleLowerCase("tr-TR")}|${String(order.delivery_address || "").trim().toLocaleLowerCase("tr-TR")}`;
}
function customerList(orders: Order[]): CrmCustomer[] {
  const grouped = new Map<string, CrmCustomer>();
  for (const order of orders) {
    const key = customerKey(order);
    if (!grouped.has(key)) grouped.set(key, { key, name: order.customer_name?.trim() || "İsimsiz müşteri", phone: normalizePhone(order.customer_phone) || null, addresses: [], orders: [], completedOrders: 0, totalSpent: 0, lastOrderAt: order.closed_at || order.created_at });
    const customer = grouped.get(key)!;
    customer.orders.push(order);
    if (order.delivery_address?.trim() && !customer.addresses.includes(order.delivery_address.trim())) customer.addresses.push(order.delivery_address.trim());
    if (order.customer_name?.trim() && customer.name === "İsimsiz müşteri") customer.name = order.customer_name.trim();
    if (order.status === "closed") { customer.completedOrders += 1; customer.totalSpent += Number(order.total || 0); }
  }
  return [...grouped.values()].map((customer) => ({ ...customer, orders: customer.orders.sort((a, b) => new Date(b.closed_at || b.created_at).getTime() - new Date(a.closed_at || a.created_at).getTime()) })).sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime());
}

export default function PosCustomersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  async function loadCustomers() {
    setLoading(true);
    const { data, error } = await supabase.from("pos_orders").select("id,receipt_number,customer_name,customer_phone,delivery_address,order_note,total,status,source,payment_method,created_at,closed_at").in("status", ["open", "closed"]).order("created_at", { ascending: false }).limit(2000);
    if (error) alert(`CRM kayıtları yüklenemedi: ${error.message}`); else setOrders((data ?? []) as Order[]);
    setLoading(false);
  }
  useEffect(() => { void loadCustomers(); }, []);
  const customers = useMemo(() => customerList(orders), [orders]);
  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return term ? customers.filter((customer) => [customer.name, customer.phone || "", ...customer.addresses].join(" ").toLocaleLowerCase("tr-TR").includes(term)) : customers;
  }, [customers, search]);
  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-6 text-[#292821] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#6e1f12]/15 pb-5">
          <div><h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>CRM / Müşteriler</h1><p className="mt-1 text-sm opacity-55">Telefon, teslimat adresleri ve tüm kanal sipariş geçmişi</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void loadCustomers()} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Yenile</button><a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-bold text-white">POS&apos;a Dön</a></div>
        </header>
        <section className="mb-5 grid gap-3 sm:grid-cols-3"><Summary label="Müşteri" value={String(customers.length)} /><Summary label="Kayıtlı adres" value={String(customers.reduce((sum, customer) => sum + customer.addresses.length, 0))} /><Summary label="Sipariş" value={String(orders.length)} /></section>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="İsim, telefon veya adres ara" className="mb-4 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/50" />
        <section className="overflow-hidden rounded-3xl border border-[#6e1f12]/10 bg-white">
          {loading ? <p className="p-8 text-center opacity-60">CRM yükleniyor...</p> : visibleCustomers.length === 0 ? <p className="p-8 text-center opacity-60">Müşteri kaydı bulunamadı.</p> : <div className="divide-y divide-black/8">{visibleCustomers.map((customer) => <button key={customer.key} type="button" onClick={() => setSelectedCustomer(customer)} className="grid w-full gap-3 px-5 py-4 text-left hover:bg-[#f4efe5]/60 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"><div><p className="font-bold text-[#6e1f12]">{customer.name}</p><p className="mt-1 text-sm opacity-65">{customer.phone || "Telefon yok"}</p></div><p className="text-sm opacity-65">{customer.addresses[0] || "Adres yok"}{customer.addresses.length > 1 ? ` +${customer.addresses.length - 1}` : ""}</p><p className="text-sm">{customer.completedOrders} tamamlanan sipariş</p><p className="font-bold md:text-right">{money(customer.totalSpent)} ₺</p></button>)}</div>}
        </section>
      </div>
      {selectedCustomer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>{selectedCustomer.name}</h2><a href={selectedCustomer.phone ? `tel:${selectedCustomer.phone}` : undefined} className="mt-1 block text-sm font-semibold">{selectedCustomer.phone || "Telefon bilgisi yok"}</a></div><button type="button" onClick={() => setSelectedCustomer(null)} className="h-10 w-10 rounded-full border">×</button></div>
        <section className="mt-5 rounded-2xl bg-[#f4efe5] p-4"><p className="text-xs font-bold uppercase opacity-50">Kayıtlı adresler</p>{selectedCustomer.addresses.length ? <div className="mt-2 space-y-2">{selectedCustomer.addresses.map((address) => <p key={address} className="text-sm">{address}</p>)}</div> : <p className="mt-2 text-sm opacity-55">Adres bilgisi yok.</p>}</section>
        <section className="mt-5"><div className="flex items-center justify-between"><h3 className="font-bold">Sipariş Geçmişi</h3><p className="text-sm opacity-55">{selectedCustomer.completedOrders} tamamlanan · {money(selectedCustomer.totalSpent)} ₺</p></div><div className="mt-3 space-y-3">{selectedCustomer.orders.map((order) => <article key={order.id} className="rounded-2xl border border-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${sourceClass(order.source)}`}>{sourceLabel(order.source)}</span><p className="mt-2 font-bold">{order.receipt_number || `Sipariş #${order.id}`}</p><p className="mt-1 text-xs opacity-50">{new Date(order.closed_at || order.created_at).toLocaleString("tr-TR")} · {order.status === "closed" ? "Tamamlandı" : "Açık"}</p></div><p className="text-lg font-bold">{money(Number(order.total || 0))} ₺</p></div>{order.delivery_address && <p className="mt-3 text-sm opacity-70">{order.delivery_address}</p>}{order.order_note && <p className="mt-2 whitespace-pre-wrap text-sm text-[#6e1f12]">{order.order_note}</p>}</article>)}</div></section>
      </div></div>}
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#6e1f12]/10 bg-white p-4"><p className="text-xs uppercase tracking-wide opacity-45">{label}</p><p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p></div>; }
