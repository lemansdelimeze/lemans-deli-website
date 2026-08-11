"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";

type Channel = "yemeksepeti" | "trendyol";

type IntegrationAccount = {
  id: number;
  channel: Channel;
  restaurant_id: string | null;
  account_name: string | null;
  environment: "stage" | "production";
  active: boolean;
  credentials_configured: boolean;
  last_sync_at: string | null;
};

type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  price: number | null;
  active: boolean;
};

type Mapping = {
  id: number;
  channel: Channel;
  menu_item_id: number;
  external_product_id: string;
  external_variant_id: string | null;
  external_name: string | null;
  active: boolean;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const CHANNEL_LABELS: Record<Channel, string> = {
  yemeksepeti: "Yemeksepeti",
  trendyol: "Trendyol Yemek / GO",
};

function productName(item: MenuItem) {
  return item.name_tr || item.name || "İsimsiz ürün";
}

function formatMoney(value: number | null) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function IntegrationsPage() {
  const [accounts, setAccounts] = useState<IntegrationAccount[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [channel, setChannel] = useState<Channel>("yemeksepeti");
  const [selectedMenuItemId, setSelectedMenuItemId] =
    useState<number | null>(null);
  const [externalProductId, setExternalProductId] = useState("");
  const [externalVariantId, setExternalVariantId] = useState("");
  const [externalName, setExternalName] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [environment, setEnvironment] =
    useState<"stage" | "production">("production");
  const [credentialsConfigured, setCredentialsConfigured] =
    useState(false);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [accountsResult, menuResult, mappingsResult] =
      await Promise.all([
        supabase
          .from("integration_accounts")
          .select(
            "id,channel,restaurant_id,account_name,environment,active,credentials_configured,last_sync_at"
          )
          .order("channel", { ascending: true }),

        supabase
          .from("menu_items")
          .select("id,name,name_tr,price,active")
          .eq("active", true)
          .order("name_tr", { ascending: true }),

        supabase
          .from("integration_product_mappings")
          .select(
            "id,channel,menu_item_id,external_product_id,external_variant_id,external_name,active"
          )
          .order("created_at", { ascending: false }),
      ]);

    const error =
      accountsResult.error ||
      menuResult.error ||
      mappingsResult.error;

    if (error) {
      alert(`Entegrasyon verileri yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    setAccounts(
      (accountsResult.data ?? []) as IntegrationAccount[]
    );
    setMenuItems((menuResult.data ?? []) as MenuItem[]);
    setMappings((mappingsResult.data ?? []) as Mapping[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const account = accounts.find(
      (item) =>
        item.channel === channel &&
        item.environment === environment
    );

    setRestaurantId(account?.restaurant_id ?? "");
    setAccountName(account?.account_name ?? "");
    setCredentialsConfigured(
      account?.credentials_configured ?? false
    );
    setActive(account?.active ?? false);
  }, [accounts, channel, environment]);

  const channelMappings = useMemo(
    () =>
      mappings.filter((mapping) => mapping.channel === channel),
    [channel, mappings]
  );

  async function saveAccount() {
    setSaving(true);

    const { error } = await supabase
      .from("integration_accounts")
      .upsert(
        {
          channel,
          environment,
          restaurant_id: restaurantId.trim() || null,
          account_name: accountName.trim() || null,
          credentials_configured: credentialsConfigured,
          active,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "channel,environment",
        }
      );

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    await loadData();
    setSaving(false);
    alert("Entegrasyon hesabı kaydedildi.");
  }

  async function addMapping(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedMenuItemId) {
      alert("Menü ürünü seçin.");
      return;
    }

    if (!externalProductId.trim()) {
      alert("Harici ürün ID zorunlu.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("integration_product_mappings")
      .insert({
        channel,
        menu_item_id: selectedMenuItemId,
        external_product_id: externalProductId.trim(),
        external_variant_id:
          externalVariantId.trim() || null,
        external_name: externalName.trim() || null,
        active: true,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setSelectedMenuItemId(null);
    setExternalProductId("");
    setExternalVariantId("");
    setExternalName("");
    await loadData();
    setSaving(false);
  }

  async function deleteMapping(id: number) {
    const { error } = await supabase
      .from("integration_product_mappings")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#6e1f12]"
              style={{ fontFamily: BRAND_FONT }}
            >
              Kanal Entegrasyonları
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Yemeksepeti ve Trendyol ürün eşleştirme altyapısı
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/pos/dashboard"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              Dashboard
            </a>

            <a
              href="/pos"
              className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white"
            >
              POS&apos;a Dön
            </a>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3">
          {(["yemeksepeti", "trendyol"] as Channel[]).map(
            (item) => {
              const account = accounts.find(
                (account) =>
                  account.channel === item &&
                  account.environment === environment
              );

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setChannel(item)}
                  className={`rounded-2xl border p-4 text-left ${
                    channel === item
                      ? "border-[#6e1f12] bg-[#6e1f12] text-white"
                      : "border-[#6e1f12]/10 bg-white"
                  }`}
                >
                  <p className="font-bold">
                    {CHANNEL_LABELS[item]}
                  </p>

                  <p className="mt-2 text-sm opacity-65">
                    {account?.credentials_configured
                      ? "Kimlik bilgileri tanımlı"
                      : "Kimlik bilgileri bekleniyor"}
                  </p>

                  <p className="mt-1 text-xs opacity-55">
                    {account?.active ? "Aktif" : "Pasif"}
                  </p>
                </button>
              );
            }
          )}
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center">
            Entegrasyon verileri yükleniyor...
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <aside className="h-fit rounded-3xl border border-[#6e1f12]/10 bg-white p-5">
              <h2
                className="text-xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                Hesap Ayarları
              </h2>

              <div className="mt-4 space-y-3">
                <select
                  value={environment}
                  onChange={(event) =>
                    setEnvironment(
                      event.target.value as
                        | "stage"
                        | "production"
                    )
                  }
                  className="w-full rounded-xl border border-black/15 bg-white px-4 py-3"
                >
                  <option value="stage">Test / Stage</option>
                  <option value="production">Canlı</option>
                </select>

                <input
                  value={accountName}
                  onChange={(event) =>
                    setAccountName(event.target.value)
                  }
                  placeholder="Hesap adı"
                  className="w-full rounded-xl border border-black/15 px-4 py-3"
                />

                <input
                  value={restaurantId}
                  onChange={(event) =>
                    setRestaurantId(event.target.value)
                  }
                  placeholder="Restaurant / Vendor ID"
                  className="w-full rounded-xl border border-black/15 px-4 py-3"
                />

                <label className="flex items-center gap-3 rounded-xl bg-[#f4efe5] p-4">
                  <input
                    type="checkbox"
                    checked={credentialsConfigured}
                    onChange={(event) =>
                      setCredentialsConfigured(
                        event.target.checked
                      )
                    }
                  />

                  <span>API bilgileri tanımlandı</span>
                </label>

                <label className="flex items-center gap-3 rounded-xl bg-[#f4efe5] p-4">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) =>
                      setActive(event.target.checked)
                    }
                  />

                  <span>Entegrasyon aktif</span>
                </label>

                <button
                  type="button"
                  onClick={() => void saveAccount()}
                  disabled={saving}
                  className="w-full rounded-xl bg-[#6e1f12] px-4 py-3 font-bold text-white disabled:opacity-40"
                >
                  Hesabı Kaydet
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-700/20 bg-amber-50 p-4 text-sm text-amber-900">
                API anahtarı ve gizli anahtar gibi hassas bilgileri
                tarayıcıdaki bu forma yazmayacağız. Bunlar daha sonra
                sunucu ortam değişkenlerine eklenecek.
              </div>
            </aside>

            <section className="space-y-5">
              <form
                onSubmit={addMapping}
                className="rounded-3xl border border-[#6e1f12]/10 bg-white p-5"
              >
                <h2
                  className="text-xl font-bold text-[#6e1f12]"
                  style={{ fontFamily: BRAND_FONT }}
                >
                  Ürün Eşleştir
                </h2>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <select
                    value={selectedMenuItemId ?? ""}
                    onChange={(event) =>
                      setSelectedMenuItemId(
                        event.target.value
                          ? Number(event.target.value)
                          : null
                      )
                    }
                    className="rounded-xl border border-black/15 bg-white px-4 py-3"
                  >
                    <option value="">Menü ürünü seçin</option>

                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {productName(item)} ·{" "}
                        {formatMoney(item.price)} ₺
                      </option>
                    ))}
                  </select>

                  <input
                    value={externalProductId}
                    onChange={(event) =>
                      setExternalProductId(event.target.value)
                    }
                    placeholder="Harici ürün ID"
                    className="rounded-xl border border-black/15 px-4 py-3"
                  />

                  <input
                    value={externalVariantId}
                    onChange={(event) =>
                      setExternalVariantId(event.target.value)
                    }
                    placeholder="Harici varyant ID (isteğe bağlı)"
                    className="rounded-xl border border-black/15 px-4 py-3"
                  />

                  <input
                    value={externalName}
                    onChange={(event) =>
                      setExternalName(event.target.value)
                    }
                    placeholder="Platformdaki ürün adı"
                    className="rounded-xl border border-black/15 px-4 py-3"
                  />
                </div>

                <button
                  disabled={saving}
                  className="mt-4 rounded-xl bg-[#6e1f12] px-5 py-3 font-bold text-white disabled:opacity-40"
                >
                  Eşleştirme Ekle
                </button>
              </form>

              <section className="overflow-hidden rounded-3xl border border-[#6e1f12]/10 bg-white">
                <div className="border-b border-black/8 px-5 py-4">
                  <h2
                    className="text-xl font-bold text-[#6e1f12]"
                    style={{ fontFamily: BRAND_FONT }}
                  >
                    {CHANNEL_LABELS[channel]} Eşleştirmeleri
                  </h2>
                </div>

                {channelMappings.length === 0 ? (
                  <p className="p-8 text-center opacity-50">
                    Henüz ürün eşleştirmesi yok.
                  </p>
                ) : (
                  <div className="divide-y divide-black/8">
                    {channelMappings.map((mapping) => {
                      const menuItem = menuItems.find(
                        (item) =>
                          item.id === mapping.menu_item_id
                      );

                      return (
                        <div
                          key={mapping.id}
                          className="grid gap-3 px-5 py-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center"
                        >
                          <div>
                            <p className="font-semibold">
                              {menuItem
                                ? productName(menuItem)
                                : "Silinmiş menü ürünü"}
                            </p>

                            <p className="mt-1 text-xs opacity-50">
                              {mapping.external_name ||
                                "Harici ad belirtilmedi"}
                            </p>
                          </div>

                          <div className="text-sm">
                            <p>
                              Ürün ID:{" "}
                              <strong>
                                {mapping.external_product_id}
                              </strong>
                            </p>

                            {mapping.external_variant_id && (
                              <p className="mt-1 opacity-50">
                                Varyant:{" "}
                                {mapping.external_variant_id}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              void deleteMapping(mapping.id)
                            }
                            className="rounded-xl border border-red-900/15 px-4 py-2 text-sm text-red-800"
                          >
                            Sil
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}