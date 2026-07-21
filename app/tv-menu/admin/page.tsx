"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Category =
  | "meze"
  | "zeytinyagli"
  | "sandvic"
  | "sarkuteri"
  | "peynir";

type MenuItem = {
  id: number;
  name: string;
  price: number | null;
  category: Category;
  portion: string | null;
  active: boolean;
  sort_order: number;
};

const categories: { value: Category; label: string }[] = [
  { value: "meze", label: "Mezeler" },
  { value: "zeytinyagli", label: "Zeytinyağlılar" },
  { value: "sandvic", label: "Sandviçler" },
  { value: "sarkuteri", label: "Şarküteri" },
  { value: "peynir", label: "Peynirler" },
];

export default function TvMenuAdminPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("meze");
  const [newPortion, setNewPortion] = useState("200 gr");
  const [newSortOrder, setNewSortOrder] = useState("1");

  async function loadItems() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setItems(data ?? []);
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
        loadItems();
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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  async function updateItem(
    id: number,
    changes: Partial<MenuItem>
  ) {
    setSavingId(id);

    const { error } = await supabase
      .from("menu_items")
      .update({
        ...changes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Ürün güncellenemedi.");
      setSavingId(null);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );

    setSavingId(null);
  }

  async function toggleItem(item: MenuItem) {
    await updateItem(item.id, {
      active: !item.active,
    });
  }

  async function deleteItem(item: MenuItem) {
    const confirmed = window.confirm(
      `${item.name} silinsin mi?`
    );

    if (!confirmed) return;

    setSavingId(item.id);

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error(error);
      alert("Ürün silinemedi.");
      setSavingId(null);
      return;
    }

    setItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );

    setSavingId(null);
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newName.trim()) return;

    setAdding(true);

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        name: newName.trim(),
        price: newPrice ? Number(newPrice) : null,
        category: newCategory,
        portion: newPortion.trim() || null,
        active: true,
        sort_order: Number(newSortOrder) || 0,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Ürün eklenemedi.");
      setAdding(false);
      return;
    }

    setItems((current) => [...current, data]);

    setNewName("");
    setNewPrice("");
    setNewPortion(
      newCategory === "meze" || newCategory === "zeytinyagli"
        ? "200 gr"
        : ""
    );
    setNewSortOrder("1");

    setAdding(false);
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-[#f4efe5] flex items-center justify-center">
        <p>Yükleniyor...</p>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center px-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-white rounded-2xl p-8 shadow-sm border"
        >
          <h1 className="text-3xl font-semibold mb-2">
            Leman&apos;s Deli
          </h1>

          <p className="mb-8 opacity-70">
            TV Menü Yönetimi
          </p>

          <label className="block mb-5">
            <span className="block mb-2 text-sm font-medium">
              E-posta
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full border rounded-lg px-4 py-3"
            />
          </label>

          <label className="block mb-5">
            <span className="block mb-2 text-sm font-medium">
              Şifre
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full border rounded-lg px-4 py-3"
            />
          </label>

          {loginError && (
            <p className="mb-4 text-sm text-red-700">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-[#242820] text-white py-3 font-medium"
          >
            Giriş Yap
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] text-[#242820] px-5 py-8 md:px-10">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-semibold">
              TV Menü Yönetimi
            </h1>

            <p className="mt-2 opacity-70">
              Ürün, fiyat, kategori ve stok durumunu buradan yönet.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="border rounded-lg px-4 py-2"
          >
            Çıkış
          </button>
        </header>

        <section className="bg-white border rounded-2xl p-5 mb-10">
          <h2 className="text-2xl font-semibold mb-5">
            Yeni Ürün Ekle
          </h2>

          <form
            onSubmit={addItem}
            className="grid grid-cols-1 md:grid-cols-6 gap-4"
          >
            <input
              type="text"
              placeholder="Ürün adı"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
              className="border rounded-lg px-3 py-3 md:col-span-2"
            />

            <input
              type="number"
              step="0.01"
              placeholder="Fiyat"
              value={newPrice}
              onChange={(event) => setNewPrice(event.target.value)}
              className="border rounded-lg px-3 py-3"
            />

            <select
              value={newCategory}
              onChange={(event) => {
                const value = event.target.value as Category;
                setNewCategory(value);

                if (
                  value === "meze" ||
                  value === "zeytinyagli"
                ) {
                  setNewPortion("200 gr");
                } else {
                  setNewPortion("");
                }
              }}
              className="border rounded-lg px-3 py-3"
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

            <input
              type="text"
              placeholder="Porsiyon"
              value={newPortion}
              onChange={(event) => setNewPortion(event.target.value)}
              className="border rounded-lg px-3 py-3"
            />

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Sıra"
                value={newSortOrder}
                onChange={(event) =>
                  setNewSortOrder(event.target.value)
                }
                className="border rounded-lg px-3 py-3 w-24"
              />

              <button
                type="submit"
                disabled={adding}
                className="flex-1 bg-[#242820] text-white rounded-lg px-4 py-3"
              >
                {adding ? "Ekleniyor" : "Ekle"}
              </button>
            </div>
          </form>
        </section>

        {loading ? (
          <p>Ürünler yükleniyor...</p>
        ) : (
          <div className="space-y-10">
            {categories.map((category) => (
              <MenuSection
                key={category.value}
                title={category.label}
                items={items
                  .filter(
                    (item) =>
                      item.category === category.value
                  )
                  .sort(
                    (a, b) =>
                      a.sort_order - b.sort_order
                  )}
                savingId={savingId}
                onToggle={toggleItem}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function MenuSection({
  title,
  items,
  savingId,
  onToggle,
  onUpdate,
  onDelete,
}: {
  title: string;
  items: MenuItem[];
  savingId: number | null;
  onToggle: (item: MenuItem) => void;
  onUpdate: (
    id: number,
    changes: Partial<MenuItem>
  ) => void;
  onDelete: (item: MenuItem) => void;
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">
        {title}
      </h2>

      <div className="bg-white border rounded-2xl overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-5 opacity-50">
            Bu kategoride ürün yok.
          </p>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`grid grid-cols-1 lg:grid-cols-[2fr_120px_140px_110px_120px_100px] gap-3 items-center px-5 py-4 ${
                index !== items.length - 1
                  ? "border-b"
                  : ""
              }`}
            >
              <input
                defaultValue={item.name}
                onBlur={(event) =>
                  onUpdate(item.id, {
                    name: event.target.value,
                  })
                }
                className="border rounded-lg px-3 py-2"
              />

              <input
                type="number"
                step="0.01"
                defaultValue={
                  item.price !== null
                    ? Number(item.price)
                    : ""
                }
                onBlur={(event) =>
                  onUpdate(item.id, {
                    price: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                className="border rounded-lg px-3 py-2"
              />

              <select
                value={item.category}
                onChange={(event) =>
                  onUpdate(item.id, {
                    category: event.target
                      .value as Category,
                  })
                }
                className="border rounded-lg px-3 py-2"
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

              <input
                defaultValue={item.portion ?? ""}
                placeholder="Porsiyon"
                onBlur={(event) =>
                  onUpdate(item.id, {
                    portion:
                      event.target.value.trim() || null,
                  })
                }
                className="border rounded-lg px-3 py-2"
              />

              <input
                type="number"
                defaultValue={item.sort_order}
                onBlur={(event) =>
                  onUpdate(item.id, {
                    sort_order:
                      Number(event.target.value) || 0,
                  })
                }
                className="border rounded-lg px-3 py-2"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => onToggle(item)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${
                    item.active
                      ? "bg-green-700 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {item.active ? "Açık" : "Kapalı"}
                </button>

                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => onDelete(item)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}