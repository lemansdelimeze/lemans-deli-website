"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Customer = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  discount_percent: number;
  discount_active: boolean;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
};

export default function PosCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customer_profiles")
      .select(
        "user_id,full_name,phone,email,discount_percent,discount_active,order_count,total_spent,last_order_at,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(`Üyeler yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  async function updateDiscount(
    customer: Customer,
    discountPercent: number,
    discountActive: boolean
  ) {
    const safePercent = Math.max(
      0,
      Math.min(100, Number(discountPercent || 0))
    );

    const { error } = await supabase
      .from("customer_profiles")
      .update({
        discount_percent: safePercent,
        discount_active: discountActive,
      })
      .eq("user_id", customer.user_id);

    if (error) {
      alert(`İndirim kaydedilemedi: ${error.message}`);
      return;
    }

    setCustomers((current) =>
      current.map((row) =>
        row.user_id === customer.user_id
          ? {
              ...row,
              discount_percent: safePercent,
              discount_active: discountActive,
            }
          : row
      )
    );
  }

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");

    if (!query) return customers;

    return customers.filter((customer) => {
      const haystack = `${customer.full_name ?? ""} ${customer.email ?? ""} ${
        customer.phone ?? ""
      }`.toLocaleLowerCase("tr-TR");

      return haystack.includes(query);
    });
  }, [customers, search]);

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-6 text-[#292821]">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#6e1f12]">Üyeler</h1>
            <p className="mt-1 text-sm opacity-50">
              Müşteri bazında üye indirimi tanımla
            </p>
          </div>

          <a
            href="/pos"
            className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold"
          >
            ← POS
          </a>
        </header>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="İsim, e-posta veya telefon ara"
          className="mb-4 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-[#6e1f12]/50"
        />

        {loading ? (
          <p className="rounded-2xl bg-white p-5 text-sm opacity-60">
            Üyeler yükleniyor...
          </p>
        ) : visibleCustomers.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm opacity-60">
            Henüz üye bulunamadı.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleCustomers.map((customer) => (
              <article
                key={customer.user_id}
                className="rounded-2xl border border-black/10 bg-white p-4"
              >
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="text-lg font-bold text-[#6e1f12]">
                      {customer.full_name || "İsimsiz üye"}
                    </p>

                    <p className="mt-1 text-xs opacity-55">
                      {customer.email || "E-posta yok"}
                      {customer.phone ? ` · ${customer.phone}` : ""}
                    </p>

                    <p className="mt-2 text-xs opacity-60">
                      Sipariş: {customer.order_count} · Harcama:{" "}
                      {Number(customer.total_spent || 0).toLocaleString("tr-TR")} ₺
                    </p>

                    {customer.last_order_at && (
                      <p className="mt-1 text-xs opacity-45">
                        Son sipariş:{" "}
                        {new Date(customer.last_order_at).toLocaleString("tr-TR")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-bold">
                      İndirim %
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={customer.discount_percent}
                        onChange={(event) => {
                          const value = Number(event.target.value || 0);

                          setCustomers((current) =>
                            current.map((row) =>
                              row.user_id === customer.user_id
                                ? {
                                    ...row,
                                    discount_percent: value,
                                  }
                                : row
                            )
                          );
                        }}
                        onBlur={() =>
                          void updateDiscount(
                            customer,
                            customer.discount_percent,
                            customer.discount_active
                          )
                        }
                        className="ml-2 w-20 rounded-lg border border-black/10 px-2 py-2"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        void updateDiscount(
                          customer,
                          customer.discount_percent,
                          !customer.discount_active
                        )
                      }
                      className={`rounded-xl px-3 py-2 text-xs font-bold ${
                        customer.discount_active
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {customer.discount_active ? "İndirim Aktif" : "İndirim Pasif"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}