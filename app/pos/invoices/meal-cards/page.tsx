"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type Provider = "edenred" | "setcard" | "pluxee";
type Profile = {
  receiverName: string;
  receiverTaxCode: string;
  receiverAlias: string;
  receiverAddress: string;
  receiverCity: string;
  receiverDistrict: string;
  receiverTaxOffice: string;
  memberNo: string;
};
type RecordRow = {
  id: number;
  provider: Provider;
  request_no: string;
  invoice_date: string;
  gross_amount: number;
  vat_rate: number;
  taxable_amount: number;
  vat_amount: number;
  receiver_name: string;
  receiver_tax_code: string;
  receiver_alias: string;
  receiver_address: string;
  receiver_city: string;
  receiver_district: string;
  receiver_tax_office: string;
  member_no: string | null;
  status: "sending" | "sent" | "failed" | "unknown";
  invoice_no: string | null;
  error_message: string | null;
  created_at: string;
};
type FormState = {
  provider: Provider;
  requestNo: string;
  invoiceDate: string;
  grossAmount: string;
  vatRate: string;
  profile: Profile;
};

const BRAND_FONT = '"American Typewriter", "Courier New", Courier, monospace';
const LABELS: Record<Provider, string> = {
  edenred: "Edenred",
  setcard: "Setcard",
  pluxee: "Pluxee",
};
const DEFAULT_PROFILES: Record<Provider, Profile> = {
  edenred: {
    receiverName: "EDENRED KURUMSAL ÇÖZÜMLER A.Ş.",
    receiverTaxCode: "9470043431",
    receiverAlias: "urn:mail:defaultpk@edenred.com",
    receiverAddress: "Ayazağa Mah. Kemerburgaz Cad. Vadi İstanbul Park Sitesi 7B Blok No:7C İç Kapı No:10",
    receiverCity: "İstanbul",
    receiverDistrict: "Sarıyer",
    receiverTaxOffice: "Boğaziçi Kurumlar",
    memberNo: "31762557",
  },
  setcard: {
    receiverName: "SET KURUMSAL HİZMETLER TİCARET A.Ş.",
    receiverTaxCode: "7640179796",
    receiverAlias: "",
    receiverAddress: "",
    receiverCity: "",
    receiverDistrict: "",
    receiverTaxOffice: "Boğaziçi Kurumlar",
    memberNo: "",
  },
  pluxee: {
    receiverName: "PLUXEE ÇALIŞAN DENEYİMİ DANIŞMANLIK VE PAZARLAMA HİZMETLERİ A.Ş.",
    receiverTaxCode: "7720023795",
    receiverAlias: "urn:mail:uyepk@pluxeegroup.com",
    receiverAddress: "Aydınevler Mah. İsmet İnönü Cad. Küçükyalı Ofis Park A Blok No:20/1",
    receiverCity: "İstanbul",
    receiverDistrict: "Maltepe",
    receiverTaxOffice: "Boğaziçi Kurumlar",
    memberNo: "",
  },
};

function todayIstanbul() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emptyForm(): FormState {
  return {
    provider: "edenred",
    requestNo: "",
    invoiceDate: todayIstanbul(),
    grossAmount: "",
    vatRate: "10",
    profile: { ...DEFAULT_PROFILES.edenred },
  };
}

export default function MealCardInvoicesPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function apiRequest(path: string, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (session?.access_token || ""),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  }

  async function loadRecords() {
    setLoading(true);
    try {
      const response = await apiRequest("/api/integrations/luca/meal-card-invoice");
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Kayıtlar yüklenemedi.");
      const rows = (result.records ?? []) as RecordRow[];
      setRecords(rows);
      setForm((current) => {
        const nextProfiles = { ...DEFAULT_PROFILES };
        for (const provider of ["edenred", "setcard", "pluxee"] as Provider[]) {
          const latest = rows.find((row) => row.provider === provider);
          if (latest) {
            nextProfiles[provider] = {
              receiverName: latest.receiver_name,
              receiverTaxCode: latest.receiver_tax_code,
              receiverAlias: latest.receiver_alias,
              receiverAddress: latest.receiver_address,
              receiverCity: latest.receiver_city,
              receiverDistrict: latest.receiver_district,
              receiverTaxOffice: latest.receiver_tax_office,
              memberNo: latest.member_no || "",
            };
          }
        }
        return { ...current, profile: nextProfiles[current.provider] };
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kayıtlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  const gross = Number(form.grossAmount);
  const vatRate = Number(form.vatRate);
  const preview = useMemo(() => {
    if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(vatRate) || vatRate < 0) return null;
    const grossCents = Math.round(gross * 100);
    const taxableCents = Math.round((grossCents * 10000) / (10000 + Math.round(vatRate * 100)));
    return {
      taxable: taxableCents / 100,
      vat: (grossCents - taxableCents) / 100,
      gross: grossCents / 100,
    };
  }, [gross, vatRate]);

  function changeProvider(provider: Provider) {
    const latest = records.find((row) => row.provider === provider);
    const profile = latest
      ? {
          receiverName: latest.receiver_name,
          receiverTaxCode: latest.receiver_tax_code,
          receiverAlias: latest.receiver_alias,
          receiverAddress: latest.receiver_address,
          receiverCity: latest.receiver_city,
          receiverDistrict: latest.receiver_district,
          receiverTaxOffice: latest.receiver_tax_office,
          memberNo: latest.member_no || "",
        }
      : { ...DEFAULT_PROFILES[provider] };
    setForm((current) => ({ ...current, provider, profile }));
  }

  function updateProfile(key: keyof Profile, value: string) {
    setForm((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!preview) {
      setMessage("Toplam tutarı kontrol edin.");
      return;
    }
    const duplicate = records.find((row) => row.provider === form.provider && row.request_no === form.requestNo.trim());
    if (duplicate && duplicate.status !== "failed") {
      setMessage("Bu sağlayıcı ve talep numarası daha önce kaydedilmiş. Durum: " + duplicate.status + (duplicate.invoice_no ? " · Fatura: " + duplicate.invoice_no : ""));
      return;
    }
    const summary = LABELS[form.provider] + " · Talep " + form.requestNo + " · " +
      form.invoiceDate + " · Matrah " + money(preview.taxable) + " TL · KDV " +
      money(preview.vat) + " TL · Toplam " + money(preview.gross) + " TL";
    if (!confirm(summary + "\n\nBu işlem canlı LUCA e-Fatura gönderir. Kesilsin mi?")) return;

    setSending(true);
    try {
      const response = await apiRequest("/api/integrations/luca/meal-card-invoice", {
        method: "POST",
        body: JSON.stringify({
          provider: form.provider,
          requestNo: form.requestNo.trim(),
          invoiceDate: form.invoiceDate,
          grossAmount: preview.gross,
          vatRate,
          ...form.profile,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "LUCA e-Fatura gönderilemedi.");
      }
      setMessage("Fatura kesildi: " + result.invoiceNumber);
      setForm((current) => ({ ...current, requestNo: "", grossAmount: "" }));
      await loadRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "LUCA e-Fatura gönderilemedi.");
      await loadRecords();
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-6 text-[#292821] md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Yemek Kartı Faturası</h1>
            <p className="mt-1 text-sm opacity-55">Setcard, Edenred ve Pluxee taleplerini LUCA e-Fatura olarak kesin.</p>
          </div>
          <div className="flex gap-2">
            <a href="/pos/invoices" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Diğer Faturalar</a>
            <a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">POS&apos;a Dön</a>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-[#6e1f12]/15 bg-white p-5 md:p-6">
            <div>
              <h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Yeni e-Fatura</h2>
              <p className="mt-1 text-sm opacity-55">Talep numarası ve tutarı girin. Aynı sağlayıcı-talep numarası ikinci kez gönderilemez.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Yemek kartı sağlayıcısı
                <select value={form.provider} onChange={(event) => changeProvider(event.target.value as Provider)} className="mt-1 w-full rounded-xl border bg-white px-3 py-3">
                  <option value="edenred">Edenred</option><option value="setcard">Setcard</option><option value="pluxee">Pluxee</option>
                </select>
              </label>
              <label className="text-sm font-semibold">Fatura talep numarası
                <input value={form.requestNo} onChange={(event) => setForm((current) => ({ ...current, requestNo: event.target.value }))} required maxLength={50} className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Örn. 0006858673" />
              </label>
              <label className="text-sm font-semibold">Fatura tarihi
                <input type="date" value={form.invoiceDate} onChange={(event) => setForm((current) => ({ ...current, invoiceDate: event.target.value }))} required className="mt-1 w-full rounded-xl border px-3 py-3" />
              </label>
              <label className="text-sm font-semibold">KDV dâhil toplam (TL)
                <input type="number" min="0.01" step="0.01" value={form.grossAmount} onChange={(event) => setForm((current) => ({ ...current, grossAmount: event.target.value }))} required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="3165,00" />
              </label>
              <label className="text-sm font-semibold">KDV oranı (%)
                <input type="number" min="0" max="20" step="0.01" value={form.vatRate} onChange={(event) => setForm((current) => ({ ...current, vatRate: event.target.value }))} required className="mt-1 w-full rounded-xl border px-3 py-3" />
              </label>
            </div>

            {preview && <section className="grid grid-cols-3 gap-2 rounded-2xl bg-[#f4efe5] p-4 text-center">
              <div><p className="text-xs opacity-55">Matrah</p><p className="mt-1 font-bold">{money(preview.taxable)} ₺</p></div>
              <div><p className="text-xs opacity-55">KDV (%{form.vatRate})</p><p className="mt-1 font-bold">{money(preview.vat)} ₺</p></div>
              <div><p className="text-xs opacity-55">Toplam</p><p className="mt-1 font-bold text-[#6e1f12]">{money(preview.gross)} ₺</p></div>
            </section>}

            <section className="space-y-3 border-t pt-4">
              <div><h3 className="font-bold">Alıcı bilgileri</h3><p className="text-xs opacity-55">Sağlayıcı başına son kullanılan bilgiler otomatik gelir; ilk kullanımda kontrol edip tamamlayın.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Firma unvanı" value={form.profile.receiverName} onChange={(value) => updateProfile("receiverName", value)} required />
                <Field label="VKN (10 hane)" value={form.profile.receiverTaxCode} onChange={(value) => updateProfile("receiverTaxCode", value)} required />
                <Field label="e-Fatura posta kutusu etiketi" value={form.profile.receiverAlias} onChange={(value) => updateProfile("receiverAlias", value)} required placeholder="urn:mail:..." />
                <Field label="Vergi dairesi" value={form.profile.receiverTaxOffice} onChange={(value) => updateProfile("receiverTaxOffice", value)} required />
                <Field label="Adres" value={form.profile.receiverAddress} onChange={(value) => updateProfile("receiverAddress", value)} required />
                <Field label="İl" value={form.profile.receiverCity} onChange={(value) => updateProfile("receiverCity", value)} required />
                <Field label="İlçe" value={form.profile.receiverDistrict} onChange={(value) => updateProfile("receiverDistrict", value)} required />
                <Field label="Üye numarası (varsa)" value={form.profile.memberNo} onChange={(value) => updateProfile("memberNo", value)} />
              </div>
            </section>

            {message && <p role="status" className="rounded-xl bg-[#f4efe5] p-3 text-sm">{message}</p>}
            <button type="submit" disabled={sending} className="w-full rounded-xl bg-[#6e1f12] px-4 py-3.5 font-bold text-white disabled:opacity-50">
              {sending ? "LUCA’ya gönderiliyor…" : "Kontrol et ve e-Fatura kes"}
            </button>
            <p className="text-xs leading-5 text-red-800">Buton canlı fatura gönderir. Talep numarası daha önce gönderilmişse tekrar kesim engellenir. Gönderim sonucu belirsiz kaldıysa LUCA’dan kontrol etmeden yeniden denemeyin.</p>
          </form>

          <section className="rounded-3xl border border-[#6e1f12]/15 bg-white p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h2 className="text-xl font-bold text-[#6e1f12]" style={{ fontFamily: BRAND_FONT }}>Son yemek kartı faturaları</h2><p className="mt-1 text-sm opacity-55">Aynı talebin yeniden kesilmesini önlemek için kayıtlar burada tutulur.</p></div>
              <button type="button" onClick={() => void loadRecords()} className="rounded-xl border px-3 py-2 text-sm font-semibold">Yenile</button>
            </div>
            {loading ? <p className="py-8 text-center opacity-50">Yükleniyor…</p> : records.length === 0 ? <p className="rounded-xl bg-[#f4efe5] p-5 text-center text-sm opacity-60">Henüz kayıt yok.</p> :
              <div className="space-y-3">
                {records.map((row) => <article key={row.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{LABELS[row.provider]} · {row.request_no}</p><p className="mt-1 text-xs opacity-55">{row.invoice_date} · {row.receiver_name}</p></div><Status status={row.status} /></div>
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span>Matrah {money(Number(row.taxable_amount))} ₺ + KDV {money(Number(row.vat_amount))} ₺</span><strong>{money(Number(row.gross_amount))} ₺</strong></div>
                  {row.invoice_no && <p className="mt-2 text-sm font-semibold text-green-800">Fatura no: {row.invoice_no}</p>}
                  {row.error_message && <p className="mt-2 text-xs text-red-800">{row.error_message}</p>}
                </article>)}
              </div>}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
  return <label className="text-sm font-semibold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} className="mt-1 w-full rounded-xl border px-3 py-3" /></label>;
}

function Status({ status }: { status: RecordRow["status"] }) {
  const label = status === "sent" ? "Kesildi" : status === "sending" ? "Gönderiliyor" : status === "unknown" ? "LUCA kontrolü gerekli" : "Başarısız";
  const style = status === "sent" ? "bg-green-100 text-green-800" : status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900";
  return <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + style}>{label}</span>;
}
