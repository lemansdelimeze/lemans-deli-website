"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../../../lib/supabase";

type Category =
  | "meze"
  | "zeytinyagli"
  | "sandvic"
  | "sosisli"
  | "tost"
  | "sarkuteri"
  | "peynir"
  | "icecek";

type Dietary = "none" | "vegan" | "vegetarian";

type MenuItem = {
  id: number;

  name: string | null;
  name_tr: string | null;
  name_en: string | null;
  name_ru: string | null;

  description_tr: string | null;
  description_en: string | null;
  description_ru: string | null;

  price: number | null;
  category: Category;
  portion: string | null;

  calories_per_100g: number | null;
  calories_per_portion: number | null;

  allergens: string[] | null;
  dietary: Dietary | null;
  spicy_level: number | null;

  image_url: string | null;

  active: boolean;
  sort_order: number;
};

type DraftItem = {
  name_tr: string;
  name_en: string;
  name_ru: string;

  description_tr: string;
  description_en: string;
  description_ru: string;

  price: string;
  category: Category;
  portion: string;

  calories_per_100g: string;
  calories_per_portion: string;

  allergens: string[];
  dietary: Dietary;
  spicy_level: number;

  image_url: string;

  sort_order: string;
  active: boolean;
};

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const DAILY_REFERENCE_KCAL = 2000;

const categories: {
  value: Category;
  label: string;
}[] = [
  { value: "meze", label: "Mezeler" },
  { value: "zeytinyagli", label: "Zeytinyağlılar" },
  { value: "sandvic", label: "Sandviçler" },
  { value: "sosisli", label: "Sosisliler" },
  { value: "tost", label: "Tostlar" },
  { value: "sarkuteri", label: "Şarküteri" },
  { value: "peynir", label: "Peynirler" },
  { value: "icecek", label: "İçecekler" },
];

const allergenOptions = [
  { value: "milk", label: "Süt" },
  { value: "gluten", label: "Gluten" },
  { value: "egg", label: "Yumurta" },
  { value: "nuts", label: "Kuruyemiş" },
  { value: "peanut", label: "Yer fıstığı" },
  { value: "sesame", label: "Susam" },
  { value: "celery", label: "Kereviz" },
  { value: "soy", label: "Soya" },
  { value: "mustard", label: "Hardal" },
  { value: "fish", label: "Balık" },
  { value: "shellfish", label: "Kabuklu deniz ürünü" },
];

const dietaryOptions = [
  { value: "none", label: "Yok" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vejetaryen" },
];

const spicyOptions = [
  { value: 0, label: "Acısız" },
  { value: 1, label: "Hafif acılı" },
  { value: 2, label: "Acılı" },
  { value: 3, label: "Çok acılı" },
];

const inputClass =
  "w-full rounded-xl border border-black/15 bg-white px-3 py-3 outline-none focus:border-[#6e1f12]/60";

function defaultPortion(category: Category) {
  return category === "meze" || category === "zeytinyagli"
    ? "200 gr"
    : "";
}

function emptyDraft(category: Category = "meze"): DraftItem {
  return {
    name_tr: "",
    name_en: "",
    name_ru: "",

    description_tr: "",
    description_en: "",
    description_ru: "",

    price: "",
    category,
    portion: defaultPortion(category),

    calories_per_100g: "",
    calories_per_portion: "",

    allergens: [],
    dietary: "none",
    spicy_level: 0,

    image_url: "",

    sort_order: "1",
    active: true,
  };
}

function itemToDraft(item: MenuItem): DraftItem {
  return {
    name_tr: item.name_tr ?? item.name ?? "",
    name_en: item.name_en ?? "",
    name_ru: item.name_ru ?? "",

    description_tr: item.description_tr ?? "",
    description_en: item.description_en ?? "",
    description_ru: item.description_ru ?? "",

    price: item.price !== null ? String(item.price) : "",
    category: item.category,
    portion: item.portion ?? "",

    calories_per_100g:
      item.calories_per_100g !== null
        ? String(item.calories_per_100g)
        : "",

    calories_per_portion:
      item.calories_per_portion !== null
        ? String(item.calories_per_portion)
        : "",

    allergens: item.allergens ?? [],
    dietary: item.dietary ?? "none",
    spicy_level: item.spicy_level ?? 0,

    image_url: item.image_url ?? "",

    sort_order: String(item.sort_order ?? 0),
    active: item.active,
  };
}

function dailyReferencePercent(calories: string) {
  const kcal = Number(calories);

  if (!kcal || kcal <= 0) return null;

  return Math.round((kcal / DAILY_REFERENCE_KCAL) * 100);
}

function sanitizeFilename(filename: string) {
  const extension =
    filename.split(".").pop()?.toLowerCase() || "jpg";

  const base = filename.replace(/\.[^/.]+$/, "");

  const safeBase =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "menu-image";

  return `${safeBase}.${extension}`;
}

async function uploadMenuImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Lütfen bir görsel dosyası seçin.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Görsel en fazla 8 MB olabilir.");
  }

  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(
    file.name
  )}`;

  const { error } = await supabase.storage
    .from("menu-images")
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("menu-images")
    .getPublicUrl(filename);

  return data.publicUrl;
}

function getStoragePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/menu-images/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}

export default function TvMenuAdminPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftItem>>({});

  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const [openCategories, setOpenCategories] = useState<
  Record<Category, boolean>
>({
  meze: true,
  zeytinyagli: false,
  sandvic: false,
  sosisli: false,
  tost: false,
  sarkuteri: false,
  peynir: false,
  icecek: false,
});
  const [openItemId, setOpenItemId] = useState<number | null>(null);

  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newItem, setNewItem] = useState<DraftItem>(emptyDraft());
  const [adding, setAdding] = useState(false);

  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState("");

  async function loadItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      alert(`Ürünler yüklenemedi: ${error.message}`);
      setLoading(false);
      return;
    }

    const loaded = (data ?? []) as MenuItem[];

    setItems(loaded);

    const nextDrafts: Record<number, DraftItem> = {};

    loaded.forEach((item) => {
      nextDrafts[item.id] = itemToDraft(item);
    });

    setDrafts(nextDrafts);
    setLoading(false);
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setLoggedIn(Boolean(session));
      setSessionLoading(false);

      if (session) {
        await loadItems();
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));

      if (session) {
        loadItems();
      } else {
        setItems([]);
        setDrafts({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const groupedItems = useMemo(() => {
    return categories.map((category) => ({
      ...category,

      items: items
        .filter((item) => item.category === category.value)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  }, [items]);

  function toggleCategory(category: Category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }

  function updateDraft(id: number, changes: Partial<DraftItem>) {
    setDrafts((current) => ({
      ...current,

      [id]: {
        ...current[id],
        ...changes,
      },
    }));
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError("E-posta veya şifre hatalı.");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function quickToggle(item: MenuItem) {
    const active = !item.active;

    setSavingId(item.id);

    const { error } = await supabase
      .from("menu_items")
      .update({
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      alert(`Durum değiştirilemedi: ${error.message}`);
      setSavingId(null);
      return;
    }

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id
          ? {
              ...currentItem,
              active,
            }
          : currentItem
      )
    );

    updateDraft(item.id, { active });

    setSavingId(null);
  }

  function toggleAllergen(id: number, allergen: string) {
    const draft = drafts[id];

    if (!draft) return;

    updateDraft(id, {
      allergens: draft.allergens.includes(allergen)
        ? draft.allergens.filter((value) => value !== allergen)
        : [...draft.allergens, allergen],
    });
  }

  async function saveItem(id: number) {
    const draft = drafts[id];

    if (!draft) return;

    if (!draft.name_tr.trim()) {
      alert("Türkçe ürün adı boş olamaz.");
      return;
    }

    setSavingId(id);

    const changes = {
      name: draft.name_tr.trim(),
      name_tr: draft.name_tr.trim(),
      name_en: draft.name_en.trim() || null,
      name_ru: draft.name_ru.trim() || null,

      description_tr: draft.description_tr.trim() || null,
      description_en: draft.description_en.trim() || null,
      description_ru: draft.description_ru.trim() || null,

      price: draft.price ? Number(draft.price) : null,
      category: draft.category,
      portion: draft.portion.trim() || null,

      calories_per_100g: draft.calories_per_100g
        ? Number(draft.calories_per_100g)
        : null,

      calories_per_portion: draft.calories_per_portion
        ? Number(draft.calories_per_portion)
        : null,

      allergens: draft.allergens,
      dietary: draft.dietary,
      spicy_level: draft.spicy_level,

      image_url: draft.image_url || null,

      active: draft.active,
      sort_order: Number(draft.sort_order) || 0,

      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("menu_items")
      .update(changes)
      .eq("id", id);

    if (error) {
      alert(`Ürün güncellenemedi: ${error.message}`);
      setSavingId(null);
      return;
    }

    await loadItems();

    setSavingId(null);
  }

  async function handleExistingImageUpload(id: number, file: File) {
    try {
      setUploadingId(id);

      const draft = drafts[id];

      if (!draft) return;

      const oldUrl = draft.image_url;

      const newUrl = await uploadMenuImage(file);

      const { error } = await supabase
        .from("menu_items")
        .update({
          image_url: newUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      updateDraft(id, {
        image_url: newUrl,
      });

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                image_url: newUrl,
              }
            : item
        )
      );

      if (oldUrl) {
        const oldPath = getStoragePathFromPublicUrl(oldUrl);

        if (oldPath) {
          await supabase.storage.from("menu-images").remove([oldPath]);
        }
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Görsel yüklenemedi."
      );
    } finally {
      setUploadingId(null);
    }
  }

  async function removeExistingImage(id: number) {
    const draft = drafts[id];

    if (!draft?.image_url) return;

    if (!window.confirm("Ürün görseli kaldırılsın mı?")) return;

    const oldUrl = draft.image_url;

    setUploadingId(id);

    const { error } = await supabase
      .from("menu_items")
      .update({
        image_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      setUploadingId(null);
      return;
    }

    updateDraft(id, { image_url: "" });

    const path = getStoragePathFromPublicUrl(oldUrl);

    if (path) {
      await supabase.storage.from("menu-images").remove([path]);
    }

    setUploadingId(null);
  }

  async function deleteItem(item: MenuItem) {
    const name = item.name_tr || item.name || "Bu ürün";

    if (!window.confirm(`${name} silinsin mi?`)) return;

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (item.image_url) {
      const path = getStoragePathFromPublicUrl(item.image_url);

      if (path) {
        await supabase.storage.from("menu-images").remove([path]);
      }
    }

    setItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );

    setOpenItemId(null);
  }

  function handleNewImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (newImagePreview) {
      URL.revokeObjectURL(newImagePreview);
    }

    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newItem.name_tr.trim()) {
      alert("Türkçe ürün adı zorunlu.");
      return;
    }

    setAdding(true);

    let imageUrl: string | null = null;

    try {
      if (newImageFile) {
        imageUrl = await uploadMenuImage(newImageFile);
      }

      const payload = {
        name: newItem.name_tr.trim(),

        name_tr: newItem.name_tr.trim(),
        name_en: newItem.name_en.trim() || null,
        name_ru: newItem.name_ru.trim() || null,

        description_tr: newItem.description_tr.trim() || null,
        description_en: newItem.description_en.trim() || null,
        description_ru: newItem.description_ru.trim() || null,

        price: newItem.price ? Number(newItem.price) : null,

        category: newItem.category,
        portion: newItem.portion.trim() || null,

        calories_per_100g: newItem.calories_per_100g
          ? Number(newItem.calories_per_100g)
          : null,

        calories_per_portion: newItem.calories_per_portion
          ? Number(newItem.calories_per_portion)
          : null,

        allergens: newItem.allergens,
        dietary: newItem.dietary,
        spicy_level: newItem.spicy_level,

        image_url: imageUrl,

        active: newItem.active,
        sort_order: Number(newItem.sort_order) || 0,
      };

      const { error } = await supabase
        .from("menu_items")
        .insert(payload);

      if (error) throw error;

      setNewItem(emptyDraft(newItem.category));

      if (newImagePreview) {
        URL.revokeObjectURL(newImagePreview);
      }

      setNewImageFile(null);
      setNewImagePreview("");

      setNewProductOpen(false);

      await loadItems();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Ürün eklenemedi."
      );
    } finally {
      setAdding(false);
    }
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-[#f4efe5] flex items-center justify-center">
        Yükleniyor...
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#f4efe5] flex items-center justify-center px-5">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-7"
        >
          <h1
            style={{ fontFamily: BRAND_FONT }}
            className="text-3xl font-bold text-[#6e1f12]"
          >
            Leman&apos;s Deli
          </h1>

          <p className="mb-7 mt-2 opacity-55">
            Menü Yönetimi
          </p>

          <Field label="E-posta">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <div className="mt-4">
            <Field label="Şifre">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                required
              />
            </Field>
          </div>

          {loginError && (
            <p className="mt-4 text-sm text-red-700">
              {loginError}
            </p>
          )}

          <button className="mt-6 w-full rounded-xl bg-[#6e1f12] py-3 font-medium text-white">
            Giriş Yap
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] px-4 py-6 text-[#292821] md:px-8">

      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div>
            <h1
              style={{
                fontFamily: BRAND_FONT,
                fontWeight: 700,
              }}
              className="text-3xl text-[#6e1f12] md:text-4xl"
            >
              Menü Yönetimi
            </h1>

            <p className="mt-1 text-sm opacity-50">
              Günlük kullanım için sade görünüm
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <a
              href="/tv-menu"
              target="_blank"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
            >
              TV Menüsü
            </a>

            <a
              href="/menu"
              target="_blank"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
            >
              Canlı Menü
            </a>

            <a
              href="/tv-menu/print"
              target="_blank"
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
            >
              Printable
            </a>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
            >
              Çıkış
            </button>

          </div>

        </header>

        {/* NEW PRODUCT ACCORDION */}
        <section className="mb-7 overflow-hidden rounded-2xl border border-[#6e1f12]/12 bg-white">

          <button
            type="button"
            onClick={() => setNewProductOpen(!newProductOpen)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span
              style={{ fontFamily: BRAND_FONT }}
              className="font-bold text-[#6e1f12]"
            >
              ＋ Yeni Ürün Ekle
            </span>

            <span>
              {newProductOpen ? "−" : "+"}
            </span>
          </button>

          {newProductOpen && (
            <form
              onSubmit={addItem}
              className="space-y-6 border-t border-black/8 p-5"
            >

              <ImageUpload
                imageUrl={newImagePreview}
                uploading={adding}
                onFile={(file) => {
                  if (newImagePreview) {
                    URL.revokeObjectURL(newImagePreview);
                  }

                  setNewImageFile(file);
                  setNewImagePreview(URL.createObjectURL(file));
                }}
                onRemove={() => {
                  setNewImageFile(null);
                  setNewImagePreview("");
                }}
              />

              <LanguageFields
                value={newItem}
                onChange={(changes) =>
                  setNewItem((current) => ({
                    ...current,
                    ...changes,
                  }))
                }
              />

              <MainFields
                value={newItem}
                onChange={(changes) =>
                  setNewItem((current) => ({
                    ...current,
                    ...changes,
                  }))
                }
              />

              <NutritionFields
                value={newItem}
                onChange={(changes) =>
                  setNewItem((current) => ({
                    ...current,
                    ...changes,
                  }))
                }
              />

              <Allergens
                selected={newItem.allergens}
                onToggle={(allergen) =>
                  setNewItem((current) => ({
                    ...current,

                    allergens: current.allergens.includes(allergen)
                      ? current.allergens.filter(
                          (value) => value !== allergen
                        )
                      : [...current.allergens, allergen],
                  }))
                }
              />

              <OptionsFields
                value={newItem}
                onChange={(changes) =>
                  setNewItem((current) => ({
                    ...current,
                    ...changes,
                  }))
                }
              />

              <button
                disabled={adding}
                className="rounded-xl bg-[#6e1f12] px-6 py-3 font-medium text-white"
              >
                {adding ? "Ekleniyor..." : "Ürünü Ekle"}
              </button>

            </form>
          )}

        </section>

        {/* CATEGORIES */}
        {loading ? (
          <p>Ürünler yükleniyor...</p>
        ) : (
          <div className="space-y-3">

            {groupedItems.map((group) => {

              const categoryOpen = openCategories[group.value];

              return (
                <section
                  key={group.value}
                  className="overflow-hidden rounded-2xl border border-[#6e1f12]/12 bg-white"
                >

                  {/* CATEGORY HEADER */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.value)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >

                    <div className="flex items-center gap-3">

                      <span className="w-4 text-[#6e1f12]">
                        {categoryOpen ? "▼" : "▶"}
                      </span>

                      <h2
                        style={{
                          fontFamily: BRAND_FONT,
                          fontWeight: 700,
                        }}
                        className="text-lg text-[#6e1f12]"
                      >
                        {group.label}
                      </h2>

                    </div>

                    <span className="text-sm opacity-40">
                      {group.items.length} ürün
                    </span>

                  </button>

                  {/* PRODUCTS */}
                  {categoryOpen && (
                    <div className="border-t border-black/8">

                      {group.items.length === 0 ? (
                        <p className="px-5 py-5 text-sm opacity-45">
                          Bu kategoride ürün yok.
                        </p>
                      ) : (
                        group.items.map((item) => {

                          const draft = drafts[item.id];

                          if (!draft) return null;

                          const detailOpen = openItemId === item.id;

                          return (
                            <div
                              key={item.id}
                              className="border-b border-black/7 last:border-b-0"
                            >

                              {/* SIMPLE PRODUCT ROW */}
                              <div className="flex items-center gap-3 px-5 py-3">

                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenItemId(
                                      detailOpen ? null : item.id
                                    )
                                  }
                                  className="min-w-0 flex-1 text-left"
                                >

                                  <span
                                    style={{
                                      fontFamily: BRAND_FONT,
                                      fontWeight: 700,
                                    }}
                                    className="text-[15px] text-[#6e1f12]"
                                  >
                                    {draft.name_tr ||
                                      item.name ||
                                      "İsimsiz ürün"}
                                  </span>

                                  {(draft.portion || draft.price) && (
                                    <span className="ml-2 text-xs opacity-35">
                                      {draft.portion}

                                      {draft.portion && draft.price
                                        ? " · "
                                        : ""}

                                      {draft.price
                                        ? `${draft.price} ₺`
                                        : ""}
                                    </span>
                                  )}

                                </button>

                                {/* QUICK OPEN CLOSE */}
                                <button
                                  type="button"
                                  disabled={savingId === item.id}
                                  onClick={() => quickToggle(item)}
                                  className={`min-w-[82px] rounded-full px-3 py-2 text-xs font-bold ${
                                    item.active
                                      ? "bg-green-700 text-white"
                                      : "bg-black/8 text-black/55"
                                  }`}
                                >
                                  {item.active ? "AÇIK" : "KAPALI"}
                                </button>

                                {/* DETAILS */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenItemId(
                                      detailOpen ? null : item.id
                                    )
                                  }
                                  className="h-9 w-9 rounded-full border border-black/10"
                                >
                                  {detailOpen ? "⌃" : "⌄"}
                                </button>

                              </div>

                              {/* PRODUCT ACCORDION */}
                              {detailOpen && (
                                <div className="space-y-7 border-t border-black/7 bg-[#fbf8f2] p-5 md:p-6">

                                  <ImageUpload
                                    imageUrl={draft.image_url}
                                    uploading={uploadingId === item.id}
                                    onFile={(file) =>
                                      handleExistingImageUpload(
                                        item.id,
                                        file
                                      )
                                    }
                                    onRemove={() =>
                                      removeExistingImage(item.id)
                                    }
                                  />

                                  <LanguageFields
                                    value={draft}
                                    onChange={(changes) =>
                                      updateDraft(item.id, changes)
                                    }
                                  />

                                  <MainFields
                                    value={draft}
                                    onChange={(changes) =>
                                      updateDraft(item.id, changes)
                                    }
                                  />

                                  <NutritionFields
                                    value={draft}
                                    onChange={(changes) =>
                                      updateDraft(item.id, changes)
                                    }
                                  />

                                  <Allergens
                                    selected={draft.allergens}
                                    onToggle={(allergen) =>
                                      toggleAllergen(
                                        item.id,
                                        allergen
                                      )
                                    }
                                  />

                                  <OptionsFields
                                    value={draft}
                                    onChange={(changes) =>
                                      updateDraft(item.id, changes)
                                    }
                                  />

                                  <div className="flex flex-col gap-3 sm:flex-row">

                                    <button
                                      type="button"
                                      disabled={savingId === item.id}
                                      onClick={() => saveItem(item.id)}
                                      className="flex-1 rounded-xl bg-[#6e1f12] px-5 py-3 font-medium text-white"
                                    >
                                      {savingId === item.id
                                        ? "Kaydediliyor..."
                                        : "Değişiklikleri Kaydet"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => deleteItem(item)}
                                      className="rounded-xl border border-red-900/20 px-5 py-3 text-red-800"
                                    >
                                      Ürünü Sil
                                    </button>

                                  </div>

                                </div>
                              )}

                            </div>
                          );
                        })
                      )}

                    </div>
                  )}

                </section>
              );
            })}

          </div>
        )}

      </div>

    </main>
  );
}

/* ---------- REUSABLE UI ---------- */

function ImageUpload({
  imageUrl,
  uploading,
  onFile,
  onRemove,
}: {
  imageUrl: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    onFile(file);

    event.target.value = "";
  }

  return (
    <div>

      <h4 className="mb-3 font-semibold">
        Ürün Görseli
      </h4>

      {imageUrl ? (
        <div className="flex flex-col gap-4 sm:flex-row">

          <img
            src={imageUrl}
            alt=""
            className="h-36 w-36 rounded-2xl border border-black/10 object-cover"
          />

          <div className="flex flex-col gap-2">

            <label className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-3 text-center text-sm">

              {uploading
                ? "Yükleniyor..."
                : "Görseli Değiştir"}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleChange}
              />

            </label>

            <button
              type="button"
              onClick={onRemove}
              className="rounded-xl border border-red-900/15 px-4 py-3 text-sm text-red-800"
            >
              Görseli Kaldır
            </button>

          </div>

        </div>
      ) : (
        <label className="flex min-h-28 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-black/20 bg-white text-sm">

          {uploading
            ? "Yükleniyor..."
            : "＋ Ürün Görseli Yükle"}

          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleChange}
          />

        </label>
      )}

    </div>
  );
}

function LanguageFields({
  value,
  onChange,
}: {
  value: DraftItem;
  onChange: (changes: Partial<DraftItem>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

      <LanguageBox
        title="🇹🇷 Türkçe"
        nameLabel="Ürün adı"
        descriptionLabel="Muhteviyat / Açıklama"
        name={value.name_tr}
        description={value.description_tr}
        onName={(name_tr) => onChange({ name_tr })}
        onDescription={(description_tr) =>
          onChange({ description_tr })
        }
      />

      <LanguageBox
        title="🇬🇧 English"
        nameLabel="Product name"
        descriptionLabel="Ingredients / Description"
        name={value.name_en}
        description={value.description_en}
        onName={(name_en) => onChange({ name_en })}
        onDescription={(description_en) =>
          onChange({ description_en })
        }
      />

      <LanguageBox
        title="🇷🇺 Русский"
        nameLabel="Название"
        descriptionLabel="Состав / Описание"
        name={value.name_ru}
        description={value.description_ru}
        onName={(name_ru) => onChange({ name_ru })}
        onDescription={(description_ru) =>
          onChange({ description_ru })
        }
      />

    </div>
  );
}

function LanguageBox({
  title,
  nameLabel,
  descriptionLabel,
  name,
  description,
  onName,
  onDescription,
}: {
  title: string;
  nameLabel: string;
  descriptionLabel: string;
  name: string;
  description: string;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-black/7 bg-white p-4">

      <h4 className="mb-4 font-semibold text-[#6e1f12]">
        {title}
      </h4>

      <Field label={nameLabel}>
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="mt-4">

        <Field label={descriptionLabel}>
          <textarea
            rows={4}
            value={description}
            onChange={(event) =>
              onDescription(event.target.value)
            }
            className={`${inputClass} resize-y`}
          />
        </Field>

      </div>

    </div>
  );
}

function MainFields({
  value,
  onChange,
}: {
  value: DraftItem;
  onChange: (changes: Partial<DraftItem>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

      <Field label="Kategori">

        <select
          value={value.category}
          onChange={(event) => {
            const category = event.target.value as Category;

            onChange({
              category,

              portion:
                value.portion ||
                defaultPortion(category),
            });
          }}
          className={inputClass}
        >

          {categories.map((category) => (
            <option
              key={category.value}
              value={category.value}
            >
              {category.label}
            </option>
          ))}

        </select>

      </Field>

      <Field label="Gramaj / Porsiyon">

        <input
          value={value.portion}
          onChange={(event) =>
            onChange({
              portion: event.target.value,
            })
          }
          placeholder="200 gr, 330 ml, adet..."
          className={inputClass}
        />

      </Field>

      <Field label="Fiyat">

        <input
          type="number"
          step="0.01"
          value={value.price}
          onChange={(event) =>
            onChange({
              price: event.target.value,
            })
          }
          className={inputClass}
        />

      </Field>

      <Field label="Menü Sırası">

        <input
          type="number"
          value={value.sort_order}
          onChange={(event) =>
            onChange({
              sort_order: event.target.value,
            })
          }
          className={inputClass}
        />

      </Field>

    </div>
  );
}

function NutritionFields({
  value,
  onChange,
}: {
  value: DraftItem;
  onChange: (changes: Partial<DraftItem>) => void;
}) {
  const percentage = dailyReferencePercent(
    value.calories_per_portion
  );

  return (
    <div className="rounded-2xl border border-black/7 bg-white p-4">

      <h4 className="font-semibold">
        Besin Bilgisi
      </h4>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">

        <Field label="100 g / 100 ml Kalori">

          <input
            type="number"
            min="0"
            value={value.calories_per_100g}
            onChange={(event) =>
              onChange({
                calories_per_100g: event.target.value,
              })
            }
            className={inputClass}
          />

        </Field>

        <Field label="Porsiyon Kalorisi">

          <input
            type="number"
            min="0"
            value={value.calories_per_portion}
            onChange={(event) =>
              onChange({
                calories_per_portion: event.target.value,
              })
            }
            className={inputClass}
          />

        </Field>

      </div>

      {percentage !== null && (
        <p className="mt-3 text-sm opacity-50">
          {value.calories_per_portion} kcal · yaklaşık %{percentage} günlük referans
        </p>
      )}

    </div>
  );
}

function Allergens({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>

      <h4 className="mb-3 font-semibold">
        Alerjenler
      </h4>

      <div className="flex flex-wrap gap-2">

        {allergenOptions.map((option) => {

          const active = selected.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={`rounded-full border px-3 py-2 text-sm ${
                active
                  ? "border-[#6e1f12] bg-[#6e1f12] text-white"
                  : "border-black/12 bg-white"
              }`}
            >
              {active ? "✓ " : ""}
              {option.label}
            </button>
          );
        })}

      </div>

    </div>
  );
}

function OptionsFields({
  value,
  onChange,
}: {
  value: DraftItem;
  onChange: (changes: Partial<DraftItem>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

      <ChoiceGroup
        title="Beslenme"
        options={dietaryOptions}
        value={value.dietary}
        onChange={(dietary) =>
          onChange({
            dietary: dietary as Dietary,
          })
        }
      />

      <ChoiceGroup
        title="Acılık"
        options={spicyOptions}
        value={value.spicy_level}
        onChange={(spicy_level) =>
          onChange({
            spicy_level: Number(spicy_level),
          })
        }
      />

    </div>
  );
}

function ChoiceGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: {
    value: string | number;
    label: string;
  }[];
  value: string | number;
  onChange: (value: string | number) => void;
}) {
  return (
    <div>

      <h4 className="mb-3 font-semibold">
        {title}
      </h4>

      <div className="flex flex-wrap gap-2">

        {options.map((option) => {

          const active =
            String(value) === String(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-full border px-4 py-2 text-sm ${
                active
                  ? "border-[#292821] bg-[#292821] text-white"
                  : "border-black/12 bg-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}

      </div>

    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-sm font-medium">
        {label}
      </span>

      {children}

    </label>
  );
}