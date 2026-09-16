"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Order = {
  id: number;
  receipt_number: string | null;
  total: number;
  status: string;
  order_type: string;
  created_at: string;
  closed_at: string | null;
  invoice_requested: boolean;
  invoice_type: "e_fatura" | "e_arsiv" | null;
  invoice_status:
    | "none"
    | "draft"
    | "ready"
    | "sending"
    | "sent"
    | "failed"
    | "cancelled";
  invoice_uuid: string | null;
  invoice_number: string | null;
  invoice_customer_type: "individual" | "company" | null;
  invoice_customer_name: string | null;
  invoice_tax_number: string | null;
  invoice_tax_office: string | null;
  invoice_email: string | null;
  invoice_address: string | null;
  invoice_city: string | null;
  invoice_district: string | null;
  invoice_error: string | null;
};

type Draft = {
  customerType: "individual" | "company";
  customerName: string;
  taxNumber: string;
  taxOffice: string;
  email: string;
  address: string;
  city: string;
  district: string;
};

type RetroCandidate = {
  id: number;
  receiptNumber: string | null;
  customerName: string;
  source: "trendyol" | "yemeksepeti";
  paymentMethod: string | null;
  total: number;
  closedAt: string;
  invoiceStatus: string;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

function money(value: number) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function emptyDraft(): Draft {
  return {
    customerType: "individual",
    customerName: "",
    taxNumber: "",
    taxOffice: "",
    email: "",
    address: "",
    city: "",
    district: "",
  };
}

export default function PosInvoicesPage() {
  const searchParams = useSearchParams();
  const orderIdFromOrdersPage = Number(searchParams.get("order"));
  const openedFromOrdersPage = useRef<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "waiting" | "sent">("all");
  const [retroCandidates, setRetroCandidates] = useState<RetroCandidate[] | null>(null);
  const [retroGrossTotal, setRetroGrossTotal] = useState(0);
  const [retroTitle, setRetroTitle] = useState("Geçmiş Online Tahsilat Önizlemesi");
  const [retroLoading, setRetroLoading] = useState(false);
  const [xmlPreview, setXmlPreview] = useState<{ receiptNumber: string | null; xml: string } | null>(null);

  async function retroRequest(path: string, init?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  async function loadRetroCandidates(filters?: { source?: "trendyol" | "yemeksepeti"; until?: string; title?: string }) {
    setRetroLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.source) params.set("source", filters.source);
      if (filters?.until) params.set("until", filters.until);
      const query = params.toString();
      const response = await retroRequest(`/api/integrations/luca/retro-preview${query ? `?${query}` : ""}`);
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Önizleme listesi alınamadı.");
      setRetroCandidates(result.candidates || []);
      setRetroGrossTotal(Number(result.grossTotal || 0));
      setRetroTitle(filters?.title || "Geçmiş Online Tahsilat Önizlemesi");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Önizleme listesi alınamadı.");
    } finally {
      setRetroLoading(false);
    }
  }

  async function openXmlPreview(candidate: RetroCandidate) {
    try {
      const response = await retroRequest("/api/integrations/luca/retro-preview", {
        method: "POST",
        body: JSON.stringify({ orderId: candidate.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "XML taslağı üretilemedi.");
      setXmlPreview({ receiptNumber: candidate.receiptNumber, xml: result.draft.xml });
    } catch (error) {
      alert(error instanceof Error ? error.message : "XML taslağı üretilemedi.");
    }
  }

  async function loadOrders() {
    setLoading(true);

    const { data, error } = await supabase
      .from("pos_orders")
      .select(
        "id,receipt_number,total,status,order_type,created_at,closed_at,invoice_requested,invoice_type,invoice_status,invoice_uuid,invoice_number,invoice_customer_type,invoice_customer_name,invoice_tax_number,invoice_tax_office,invoice_email,invoice_address,invoice_city,invoice_district,invoice_error"
      )
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(250);

    if (error) {
      alert(`Fatura listesi yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrders((data ?? []) as Order[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  const visibleOrders = useMemo(() => {
    if (filter === "waiting") {
      return orders.filter(
        (order) =>
          order.invoice_status === "draft" ||
          order.invoice_status === "ready" ||
          order.invoice_status === "failed"
      );
    }

    if (filter === "sent") {
      return orders.filter((order) => order.invoice_status === "sent");
    }

    return orders;
  }, [orders, filter]);

  function openDraft(order: Order) {
    setSelectedOrder(order);

    setDraft({
      customerType: order.invoice_customer_type ?? "individual",
      customerName: order.invoice_customer_name ?? "",
      taxNumber: order.invoice_tax_number ?? "",
      taxOffice: order.invoice_tax_office ?? "",
      email: order.invoice_email ?? "",
      address: order.invoice_address ?? "",
      city: order.invoice_city ?? "",
      district: order.invoice_district ?? "",
    });
  }

  useEffect(() => {
    if (
      loading ||
      !Number.isInteger(orderIdFromOrdersPage) ||
      orderIdFromOrdersPage <= 0 ||
      openedFromOrdersPage.current === orderIdFromOrdersPage
    ) {
      return;
    }

    const order = orders.find((item) => item.id === orderIdFromOrdersPage);
    if (!order) return;

    openedFromOrdersPage.current = orderIdFromOrdersPage;
    openDraft(order);
  }, [loading, orderIdFromOrdersPage, orders]);

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrder) return;

    if (!draft.customerName.trim()) {
      alert("Müşteri / firma adı zorunlu.");
      return;
    }

    if (!draft.taxNumber.trim()) {
      alert("TCKN / VKN zorunlu.");
      return;
    }

    setSaving(true);

    const invoiceType =
      draft.customerType === "company" ? "e_fatura" : "e_arsiv";

    const { error } = await supabase
      .from("pos_orders")
      .update({
        invoice_requested: true,
        invoice_type: invoiceType,
        invoice_status: "ready",
        invoice_customer_type: draft.customerType,
        invoice_customer_name: draft.customerName.trim(),
        invoice_tax_number: draft.taxNumber.trim(),
        invoice_tax_office: draft.taxOffice.trim() || null,
        invoice_email: draft.email.trim() || null,
        invoice_address: draft.address.trim() || null,
        invoice_city: draft.city.trim() || null,
        invoice_district: draft.district.trim() || null,
        invoice_error: null,
        invoice_created_at: new Date().toISOString(),
      })
      .eq("id", selectedOrder.id);

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await supabase.from("pos_invoice_events").insert({
      order_id: selectedOrder.id,
      event_type: "draft.created",
      status: "ready",
      provider: "luca",
      message:
        "LUCA API bağlantısı beklenirken fatura taslağı hazırlandı.",
    });

    setSelectedOrder(null);
    setDraft(emptyDraft());
    await loadOrders();
    setSaving(false);
  }

  async function sendInvoice() {
    if (!selectedOrder) return;
    if (!confirm("Bu işlem canlı LUCA e-Arşiv faturası keser. Devam edilsin mi?")) return;
    setSaving(true);
    try {
      const response = await retroRequest("/api/integrations/luca/auto-invoice", { method: "POST", body: JSON.stringify({ orderId: selectedOrder.id, manual: true }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Fatura gönderilemedi.");
      alert(result.status === "sent" ? `Fatura kesildi: ${result.invoiceNumber || ""}` : "Fatura durumu: " + result.status);
      setSelectedOrder(null); await loadOrders();
    } catch (error) { alert(error instanceof Error ? error.message : "Fatura gönderilemedi."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-6 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              e-Fatura / e-Arşiv
            </h1>
            <p className="mt-1 text-sm opacity-50">
              Kapanan adisyonlardan LUCA için fatura taslağı hazırla
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadRetroCandidates({
                source: "trendyol",
                until: "2026-09-14",
                title: "Trendyol Go · online ödeme · 14 Eylül 2026'ya kadar",
              })}
              disabled={retroLoading}
              className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {retroLoading ? "Online ödemeler taranıyor..." : "Trendyol Online · 14 Eylüle Kadar"}
            </button>
            <button
              type="button"
              onClick={() => void loadRetroCandidates()}
              disabled={retroLoading}
              className="rounded-xl border border-[#6e1f12]/20 bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#6e1f12] disabled:opacity-50"
            >
              Tüm Geçmiş Online Ödemeler
            </button>
            <button
              onClick={() => void loadOrders()}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            >
              Yenile
            </button>
            <a
              href="/pos/orders"
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
            >
              Kapanan Adisyonlar
            </a>
            <a
              href="/pos"
              className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white"
            >
              POS&apos;a Dön
            </a>
          </div>
        </header>

        {retroCandidates && (
          <section className="mb-6 overflow-hidden rounded-3xl border border-[#6e1f12]/20 bg-white">
            <div className="flex flex-col gap-2 border-b bg-[#fff8ef] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-bold text-[#6e1f12]">{retroTitle}</h2>
                <p className="mt-1 text-sm opacity-60">Yemeksepeti ve Trendyol Go&apos;da online ödenmiş, henüz faturalanmamış kapanmış siparişler. Bu ekran LUCA&apos;ya gönderim yapmaz.</p>
              </div>
              <p className="shrink-0 text-lg font-bold text-[#6e1f12]">{retroCandidates.length} sipariş · {money(retroGrossTotal)} ₺</p>
            </div>
            {retroCandidates.length === 0 ? (
              <p className="p-5 text-sm opacity-60">Faturalandırılmayı bekleyen online tahsilat bulunamadı.</p>
            ) : (
              <div className="divide-y">
                {retroCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{candidate.receiptNumber || `Sipariş #${candidate.id}`}</p>
                      <p className="mt-1 text-xs opacity-55">{candidate.source === "trendyol" ? "Trendyol Go" : "Yemeksepeti"} · {candidate.paymentMethod || "Online ödeme"} · {new Date(candidate.closedAt).toLocaleString("tr-TR")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold">{money(candidate.total)} ₺</p>
                      <button type="button" onClick={() => void openXmlPreview(candidate)} className="rounded-xl border border-[#6e1f12]/20 px-3 py-2 text-sm font-semibold text-[#6e1f12]">XML&apos;i Gör</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mb-5 flex flex-wrap gap-2">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Tümü
          </FilterButton>

          <FilterButton
            active={filter === "waiting"}
            onClick={() => setFilter("waiting")}
          >
            Fatura Bekleyen
          </FilterButton>

          <FilterButton
            active={filter === "sent"}
            onClick={() => setFilter("sent")}
          >
            Gönderilmiş
          </FilterButton>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center">
            Faturalar yükleniyor...
          </div>
        ) : (
          <section className="overflow-hidden rounded-3xl border bg-white">
            {visibleOrders.length === 0 ? (
              <p className="p-10 text-center opacity-50">
                Bu filtrede kayıt bulunmuyor.
              </p>
            ) : (
              <div className="divide-y">
                {visibleOrders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="font-semibold">
                        {order.receipt_number || `Adisyon #${order.id}`}
                      </p>
                      <p className="mt-1 text-xs opacity-45">
                        {order.order_type} ·{" "}
                        {new Date(
                          order.closed_at || order.created_at
                        ).toLocaleString("tr-TR")}
                      </p>
                    </div>

                    <p className="font-bold">{money(order.total)} ₺</p>

                    <InvoiceStatus order={order} />

                    <button
                      type="button"
                      onClick={() => openDraft(order)}
                      className="rounded-xl border border-[#6e1f12]/20 px-4 py-2 text-sm font-semibold text-[#6e1f12]"
                    >
                      {order.invoice_status === "none"
                        ? "Fatura Oluştur"
                        : "Fatura Bilgileri"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <form
              onSubmit={saveDraft}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#f4efe5] p-5 shadow-2xl md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    className="text-2xl font-bold text-[#6e1f12]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    Fatura Taslağı
                  </h2>
                  <p className="mt-1 text-sm opacity-50">
                    {selectedOrder.receipt_number ||
                      `Adisyon #${selectedOrder.id}`}{" "}
                    · {money(selectedOrder.total)} ₺
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-full border bg-white px-3 py-2"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Müşteri Tipi">
                  <select
                    value={draft.customerType}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        customerType: event.target.value as
                          | "individual"
                          | "company",
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  >
                    <option value="individual">
                      Bireysel / e-Arşiv
                    </option>
                    <option value="company">
                      Firma / e-Fatura
                    </option>
                  </select>
                </Field>

                <Field label="TCKN / VKN">
                  <input
                    value={draft.taxNumber}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        taxNumber: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  />
                </Field>

                <Field label="Ad Soyad / Firma Unvanı">
                  <input
                    value={draft.customerName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  />
                </Field>

                <Field label="Vergi Dairesi">
                  <input
                    value={draft.taxOffice}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        taxOffice: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  />
                </Field>

                <Field label="E-posta">
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  />
                </Field>

                <Field label="İl">
                  <input
                    value={draft.city}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  />
                </Field>

                <Field label="İlçe">
                  <input
                    value={draft.district}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        district: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border bg-white px-4 py-3"
                  />
                </Field>

                <Field label="Adres">
                  <textarea
                    rows={3}
                    value={draft.address}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    className="w-full resize-y rounded-xl border bg-white px-4 py-3"
                  />
                </Field>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-700/15 bg-amber-50 p-4 text-sm text-amber-900">
                Şimdilik yalnızca taslak hazırlanır. LUCA API erişimi
                açıldığında bu hazır kayıtlar e-Fatura / e-Arşiv olarak
                gönderilecek.
              </div>

              {(selectedOrder.invoice_status === "ready" || selectedOrder.invoice_status === "failed") && (
                <button type="button" disabled={saving} onClick={() => void sendInvoice()} className="mt-5 w-full rounded-xl bg-green-700 px-5 py-4 font-bold text-white disabled:opacity-40">
                  {saving ? "Gönderiliyor..." : "LUCA’ya Gönder ve Fatura Kes"}
                </button>
              )}

              <button
                disabled={saving}
                className="mt-5 w-full rounded-xl bg-[#6e1f12] px-5 py-4 font-bold text-white disabled:opacity-40"
              >
                {saving ? "Kaydediliyor..." : "Fatura Taslağını Kaydet"}
              </button>
            </form>
          </div>
        )}

        {xmlPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-xl font-bold text-[#6e1f12]">XML Taslağı</h2><p className="text-sm opacity-55">{xmlPreview.receiptNumber || "Sipariş"} · LUCA&apos;ya gönderilmedi</p></div>
                <button type="button" onClick={() => setXmlPreview(null)} className="rounded-full border px-3 py-2">✕</button>
              </div>
              <pre className="mt-4 overflow-auto rounded-xl bg-[#292821] p-4 text-xs leading-5 text-white">{xmlPreview.xml}</pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function InvoiceStatus({ order }: { order: Order }) {
  if (order.invoice_status === "sent") {
    return (
      <div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
          GÖNDERİLDİ
        </span>
        {order.invoice_number && (
          <p className="mt-1 text-xs opacity-45">{order.invoice_number}</p>
        )}
      </div>
    );
  }

  if (order.invoice_status === "failed") {
    return (
      <div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
          HATA
        </span>
        {order.invoice_error && (
          <p className="mt-1 max-w-xs text-xs text-red-700">
            {order.invoice_error}
          </p>
        )}
      </div>
    );
  }

  if (
    order.invoice_status === "draft" ||
    order.invoice_status === "ready"
  ) {
    return (
      <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
        TASLAK HAZIR
      </span>
    );
  }

  return (
    <span className="w-fit rounded-full bg-black/5 px-3 py-1 text-xs font-semibold opacity-55">
      FATURA YOK
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
        active
          ? "bg-[#6e1f12] text-white"
          : "border bg-white text-[#292821]"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
