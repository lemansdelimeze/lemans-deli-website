"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type SalesChannel = {
  id: number;
  code: string;
  name: string;
  channel_type: string;
  active: boolean;
  commission_rate: number;
  service_fee_rate: number;
  vat_rate: number;
  invoice_direction: "issued_to_platform" | "received_from_platform";
  note: string | null;
};

type ChannelInvoice = {
  id: number;
  channel: string;
  invoice_direction: "issued_to_platform" | "received_from_platform";
  invoice_no: string | null;
  invoice_date: string;
  total_amount: number;
  status: string;
};

const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';
const money = (value: number) => Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export default function ChannelsPage() {
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [invoices, setInvoices] = useState<ChannelInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState("marketplace");
  const [commissionRate, setCommissionRate] = useState("");
  const [serviceFeeRate, setServiceFeeRate] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [invoiceDirection, setInvoiceDirection] = useState<"issued_to_platform" | "received_from_platform">("received_from_platform");
  const [note, setNote] = useState("");
  const [invoiceChannel, setInvoiceChannel] = useState("yemeksepeti");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceVatRate, setInvoiceVatRate] = useState("20");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [channelsResult, invoicesResult] = await Promise.all([
      supabase.from("sales_channels").select("id,code,name,channel_type,active,commission_rate,service_fee_rate,vat_rate,invoice_direction,note").order("name"),
      supabase.from("channel_invoices").select("id,channel,invoice_direction,invoice_no,invoice_date,total_amount,status").order("invoice_date", { ascending: false }).limit(100),
    ]);
    const error = channelsResult.error || invoicesResult.error;
    if (error) {
      alert(`Kanal verileri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }
    setChannels((channelsResult.data ?? []) as SalesChannel[]);
    setInvoices((invoicesResult.data ?? []) as ChannelInvoice[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const marketplaceChannels = useMemo(
    () => channels.filter((item) => item.channel_type === "marketplace" && item.active),
    [channels]
  );

  async function addChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || !name.trim()) return alert("Kanal kodu ve adı zorunlu.");
    setSaving(true);
    const { error } = await supabase.from("sales_channels").insert({
      code: code.trim().toLowerCase(),
      name: name.trim(),
      channel_type: channelType,
      active: true,
      commission_rate: Number(commissionRate) || 0,
      service_fee_rate: Number(serviceFeeRate) || 0,
      vat_rate: Number(vatRate) || 0,
      invoice_direction: invoiceDirection,
      note: note.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (error) alert(error.message);
    else {
      setCode(""); setName(""); setCommissionRate(""); setServiceFeeRate(""); setVatRate("20"); setNote("");
      await loadData();
    }
    setSaving(false);
  }

  async function toggleChannel(channel: SalesChannel) {
    const { error } = await supabase.from("sales_channels").update({ active: !channel.active, updated_at: new Date().toISOString() }).eq("id", channel.id);
    if (error) return alert(error.message);
    await loadData();
  }

  async function createInvoiceDraft() {
    setSaving(true);
    const { data, error } = await supabase.rpc("create_channel_invoice_draft", {
      p_channel: invoiceChannel,
      p_invoice_date: invoiceDate,
      p_vat_rate: Number(invoiceVatRate) || 0,
    });
    if (error) alert(error.message);
    else {
      const result = data as { invoice_id?: number; total_amount?: number };
      alert(`Fatura taslağı oluşturuldu. #${result.invoice_id ?? ""} · ${money(Number(result.total_amount || 0))} ₺`);
      await loadData();
    }
    setSaving(false);
  }

  async function updateInvoiceStatus(invoice: ChannelInvoice) {
    const invoiceNo = window.prompt("Fatura numarası:");
    if (!invoiceNo?.trim()) return;
    const status = invoice.invoice_direction === "issued_to_platform" ? "issued" : "received";
    const { error } = await supabase.from("channel_invoices").update({ status, invoice_no: invoiceNo.trim(), updated_at: new Date().toISOString() }).eq("id", invoice.id);
    if (error) return alert(error.message);
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Satış Kanalları ve Faturalar</h1>
            <p className="mt-1 text-sm opacity-50">POS, Yemeksepeti, Trendyol, web ve diğer kanallar</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/pos/channel-finance" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Kanal Finans</a>
            <a href="/pos/integrations" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Entegrasyonlar</a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">POS&apos;a Dön</a>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <form onSubmit={addChannel} className="h-fit rounded-3xl border bg-white p-5">
            <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Yeni Kanal</h2>
            <div className="mt-4 space-y-3">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Kanal kodu: getir" className="w-full rounded-xl border px-4 py-3" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kanal adı" className="w-full rounded-xl border px-4 py-3" />
              <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className="w-full rounded-xl border bg-white px-4 py-3">
                <option value="marketplace">Pazaryeri</option><option value="website">Web Sitesi</option><option value="whatsapp">WhatsApp</option><option value="other">Diğer</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="0.01" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="Komisyon %" className="rounded-xl border px-4 py-3" />
                <input type="number" step="0.01" value={serviceFeeRate} onChange={(e) => setServiceFeeRate(e.target.value)} placeholder="Hizmet %" className="rounded-xl border px-4 py-3" />
              </div>
              <input type="number" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} placeholder="KDV %" className="w-full rounded-xl border px-4 py-3" />
              <select value={invoiceDirection} onChange={(e) => setInvoiceDirection(e.target.value as typeof invoiceDirection)} className="w-full rounded-xl border bg-white px-4 py-3">
                <option value="issued_to_platform">Platforma kesilen</option><option value="received_from_platform">Platformdan gelen</option>
              </select>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Not" className="w-full resize-y rounded-xl border px-4 py-3" />
              <button disabled={saving} className="w-full rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40">Kanal Ekle</button>
            </div>
          </form>

          <section className="overflow-hidden rounded-3xl border bg-white">
            <div className="border-b px-5 py-4"><h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Tanımlı Kanallar</h2></div>
            {loading ? <p className="p-8 text-center">Yükleniyor...</p> : (
              <div className="divide-y">{channels.map((channel) => (
                <div key={channel.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                  <div><p className="font-semibold">{channel.name}</p><p className="mt-1 text-xs opacity-50">{channel.code} · {channel.channel_type}</p></div>
                  <p className="text-sm">Komisyon %{channel.commission_rate} · Hizmet %{channel.service_fee_rate}</p>
                  <p className="text-sm">KDV %{channel.vat_rate}</p>
                  <button type="button" onClick={() => void toggleChannel(channel)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${channel.active ? "bg-green-50 text-green-800" : "bg-black/5 text-black/50"}`}>{channel.active ? "Aktif" : "Pasif"}</button>
                </div>
              ))}</div>
            )}
          </section>
        </section>

        <section className="mt-5 rounded-3xl border bg-white p-5">
          <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Gün Sonundan Fatura Taslağı</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_140px_auto]">
            <select value={invoiceChannel} onChange={(e) => setInvoiceChannel(e.target.value)} className="rounded-xl border bg-white px-4 py-3">
              {marketplaceChannels.map((channel) => <option key={channel.code} value={channel.code}>{channel.name}</option>)}
            </select>
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="rounded-xl border px-4 py-3" />
            <input type="number" step="0.01" value={invoiceVatRate} onChange={(e) => setInvoiceVatRate(e.target.value)} placeholder="KDV %" className="rounded-xl border px-4 py-3" />
            <button type="button" onClick={() => void createInvoiceDraft()} disabled={saving} className="rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40">Taslak Oluştur</button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border bg-white">
          <div className="border-b px-5 py-4"><h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Fatura Kayıtları</h2></div>
          {invoices.length === 0 ? <p className="p-8 text-center opacity-50">Henüz fatura kaydı yok.</p> : (
            <div className="divide-y">{invoices.map((invoice) => (
              <div key={invoice.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center">
                <div><p className="font-semibold">{channels.find((channel) => channel.code === invoice.channel)?.name ?? invoice.channel}</p><p className="mt-1 text-xs opacity-50">{invoice.invoice_date}</p></div>
                <p>{invoice.invoice_no || "Taslak"}</p>
                <p className="font-bold">{money(invoice.total_amount)} ₺</p>
                {invoice.status === "draft" ? <button type="button" onClick={() => void updateInvoiceStatus(invoice)} className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">Numarala</button> : <span className="rounded-xl bg-black/5 px-4 py-2 text-sm font-semibold">{invoice.status}</span>}
              </div>
            ))}</div>
          )}
        </section>

        <div className="mt-5 rounded-2xl border border-amber-700/20 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Otomatik taslak komisyon, hizmet, kurye ve diğer kesintileri baz alır. Gerçek fatura yönü ve KDV oranı platform sözleşmesi ile mali müşavir teyidiyle kesinleştirilmelidir.
        </div>
      </div>
    </main>
  );
}