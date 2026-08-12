"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import ProductRow from "../../components/menu/ProductRow";
import ProductDetail from "../../components/menu/ProductDetail";

type Language = "tr" | "en" | "ru";
type Dietary = "none" | "vegan" | "vegetarian";

type Category = {
  id: number;
  slug: string;
  name_tr: string;
  name_en: string;
  name_ru: string;
  sort_order: number;
  active: boolean;
};

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
  portion: string | null;

  category: string | null;
  category_id: number | null;

  calories_per_100g: number | null;
  calories_per_portion: number | null;

  allergens: string[] | null;
  dietary: Dietary | null;
  spicy_level: number | null;

  image_url: string | null;

  active: boolean;
  sort_order: number;
};

type GroupedCategory = {
  category: Category;
  items: MenuItem[];
};

type CartItem = {
  item: MenuItem;
  quantity: number;
};

type OrderType = "pickup" | "delivery";

const orderTexts = {
  tr: {
    add: "Sepete Ekle",
    cart: "Sepet",
    item: "ürün",
    total: "Toplam",
    checkout: "Sipariş Ver",
    continue: "Menüye Dön",
    empty: "Sepetiniz boş.",
    pickup: "Gel-Al",
    delivery: "Paket Servis",
    name: "Ad Soyad",
    phone: "Telefon",
    address: "Teslimat Adresi",
    note: "Sipariş Notu",
    notePlaceholder: "Örn. sos ayrı olsun",
    submit: "Siparişi Gönder",
    sending: "Gönderiliyor...",
    success: "Siparişiniz alındı",
    successDetail: "Sipariş numaranız",
    close: "Kapat",
    remove: "Sil",
    orderInfo: "Sipariş Bilgileri",
    payment: "Ödeme mağazada / teslimatta alınacaktır.",
  },
  en: {
    add: "Add to Cart",
    cart: "Cart",
    item: "items",
    total: "Total",
    checkout: "Order",
    continue: "Back to Menu",
    empty: "Your cart is empty.",
    pickup: "Pickup",
    delivery: "Delivery",
    name: "Full Name",
    phone: "Phone",
    address: "Delivery Address",
    note: "Order Note",
    notePlaceholder: "e.g. sauce on the side",
    submit: "Place Order",
    sending: "Sending...",
    success: "Your order has been received",
    successDetail: "Order number",
    close: "Close",
    remove: "Remove",
    orderInfo: "Order Details",
    payment: "Payment will be collected at pickup / delivery.",
  },
  ru: {
    add: "В корзину",
    cart: "Корзина",
    item: "тов.",
    total: "Итого",
    checkout: "Заказать",
    continue: "Вернуться в меню",
    empty: "Корзина пуста.",
    pickup: "Самовывоз",
    delivery: "Доставка",
    name: "Имя и фамилия",
    phone: "Телефон",
    address: "Адрес доставки",
    note: "Комментарий",
    notePlaceholder: "Напр. соус отдельно",
    submit: "Отправить заказ",
    sending: "Отправка...",
    success: "Ваш заказ принят",
    successDetail: "Номер заказа",
    close: "Закрыть",
    remove: "Удалить",
    orderInfo: "Данные заказа",
    payment: "Оплата при получении / доставке.",
  },
} as const;

const BRAND_FONT =
  '"American Typewriter", "Courier New", Courier, monospace';

const texts = {
  tr: {
    home: "Ana Sayfa",
    title: "Günün Menüsü",
    subtitle:
      "Günlük hazırlanan mezeler, şarküteri ürünleri, sandviçler, sosisliler ve tostlar.",
    loading: "Menü yükleniyor...",
    error: "Menü şu anda yüklenemiyor.",
    emptyMenu: "Bugün için görüntülenecek ürün bulunmuyor.",
    emptyCategory: "Bu kategoride bugün ürün bulunmuyor.",
    productCount: "ürün",
    portion: "Porsiyon",
    calories: "Porsiyon kalorisi",
    calories100: "100 g kalori",
    allergens: "Alerjenler",
    dietary: "Beslenme",
    spicy: "Acılık",
    vegan: "Vegan",
    vegetarian: "Vejetaryen",
    noAllergen: "Belirtilen alerjen yok",
    spicyLevels: [
      "Acısız",
      "Hafif acılı",
      "Acılı",
      "Çok acılı",
    ],
    footer:
      "Çeşitler günlük üretim ve stok durumuna göre değişebilir.",
  },

  en: {
    home: "Homepage",
    title: "Today’s Menu",
    subtitle:
      "Fresh meze, delicatessen products, sandwiches, hot dogs and toasted sandwiches.",
    loading: "Loading menu...",
    error: "The menu is currently unavailable.",
    emptyMenu: "There are no products to display today.",
    emptyCategory:
      "No products are available in this category today.",
    productCount: "items",
    portion: "Portion",
    calories: "Calories per portion",
    calories100: "Calories per 100 g",
    allergens: "Allergens",
    dietary: "Dietary",
    spicy: "Spice level",
    vegan: "Vegan",
    vegetarian: "Vegetarian",
    noAllergen: "No allergens specified",
    spicyLevels: [
      "Not spicy",
      "Mildly spicy",
      "Spicy",
      "Very spicy",
    ],
    footer:
      "Selections may vary depending on daily production and availability.",
  },

  ru: {
    home: "Главная",
    title: "Меню на сегодня",
    subtitle:
      "Свежие мезе, деликатесы, сэндвичи, хот-доги и тосты.",
    loading: "Меню загружается...",
    error: "Меню временно недоступно.",
    emptyMenu: "Сегодня нет доступных позиций.",
    emptyCategory:
      "Сегодня в этой категории нет доступных блюд.",
    productCount: "позиций",
    portion: "Порция",
    calories: "Калории на порцию",
    calories100: "Калории на 100 г",
    allergens: "Аллергены",
    dietary: "Тип питания",
    spicy: "Острота",
    vegan: "Веган",
    vegetarian: "Вегетарианское",
    noAllergen: "Аллергены не указаны",
    spicyLevels: [
      "Не острое",
      "Слегка острое",
      "Острое",
      "Очень острое",
    ],
    footer:
      "Ассортимент может меняться в зависимости от ежедневного производства и наличия.",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

const allergenLabels: Record<
  Language,
  Record<string, string>
> = {
  tr: {
    milk: "Süt",
    dairy: "Süt ürünü",
    gluten: "Gluten",
    egg: "Yumurta",
    eggs: "Yumurta",
    nuts: "Kuruyemiş",
    peanut: "Yer fıstığı",
    peanuts: "Yer fıstığı",
    sesame: "Susam",
    celery: "Kereviz",
    soy: "Soya",
    mustard: "Hardal",
    fish: "Balık",
    shellfish: "Kabuklu deniz ürünü",
  },

  en: {
    milk: "Milk",
    dairy: "Dairy",
    gluten: "Gluten",
    egg: "Egg",
    eggs: "Egg",
    nuts: "Nuts",
    peanut: "Peanut",
    peanuts: "Peanut",
    sesame: "Sesame",
    celery: "Celery",
    soy: "Soy",
    mustard: "Mustard",
    fish: "Fish",
    shellfish: "Shellfish",
  },

  ru: {
    milk: "Молоко",
    dairy: "Молочные продукты",
    gluten: "Глютен",
    egg: "Яйцо",
    eggs: "Яйцо",
    nuts: "Орехи",
    peanut: "Арахис",
    peanuts: "Арахис",
    sesame: "Кунжут",
    celery: "Сельдерей",
    soy: "Соя",
    mustard: "Горчица",
    fish: "Рыба",
    shellfish: "Морепродукты",
  },
};

function getCategoryName(
  category: Category,
  language: Language
) {
  if (language === "en") {
    return category.name_en || category.name_tr;
  }

  if (language === "ru") {
    return category.name_ru || category.name_tr;
  }

  return category.name_tr;
}

function getProductName(
  item: MenuItem,
  language: Language
) {
  if (language === "en") {
    return (
      item.name_en ||
      item.name_tr ||
      item.name ||
      "Unnamed product"
    );
  }

  if (language === "ru") {
    return (
      item.name_ru ||
      item.name_tr ||
      item.name ||
      "Без названия"
    );
  }

  return item.name_tr || item.name || "İsimsiz ürün";
}

function getProductDescription(
  item: MenuItem,
  language: Language
) {
  if (language === "en") {
    return item.description_en || item.description_tr || "";
  }

  if (language === "ru") {
    return item.description_ru || item.description_tr || "";
  }

  return item.description_tr || "";
}

function getDietaryLabel(
  dietary: Dietary | null,
  language: Language
) {
  if (dietary === "vegan") {
    return texts[language].vegan as string;
  }

  if (dietary === "vegetarian") {
    return texts[language].vegetarian as string;
  }

  return null;
}

function getAllergenLabels(
  allergens: string[] | null,
  language: Language
) {
  return (allergens ?? []).map((allergen) => {
    const normalized = allergen.trim().toLowerCase();

    return (
      allergenLabels[language][normalized] ||
      allergen.trim()
    );
  });
}

function normalizeSpicyLevel(value: number | null) {
  return Math.max(0, Math.min(value ?? 0, 3));
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [language, setLanguage] =
    useState<Language>("tr");

  const [openCategoryId, setOpenCategoryId] =
    useState<number | null>(null);

  const [openProductId, setOpenProductId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);


  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [website, setWebsite] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    const [categoriesResult, itemsResult] =
      await Promise.all([
        supabase
          .from("categories")
          .select(
            "id, slug, name_tr, name_en, name_ru, sort_order, active"
          )
          .eq("active", true)
          .order("sort_order", { ascending: true }),

        supabase
          .from("menu_items")
          .select(
            `
              id,
              name,
              name_tr,
              name_en,
              name_ru,
              description_tr,
              description_en,
              description_ru,
              price,
              portion,
              category,
              category_id,
              calories_per_100g,
              calories_per_portion,
              allergens,
              dietary,
              spicy_level,
              image_url,
              active,
              sort_order
            `
          )
          .eq("active", true)
          .order("sort_order", { ascending: true }),
      ]);

    if (categoriesResult.error) {
      console.error(
        "CATEGORY ERROR:",
        categoriesResult.error
      );

      setError(categoriesResult.error.message);
      setLoading(false);
      return;
    }

    if (itemsResult.error) {
      console.error("MENU ERROR:", itemsResult.error);

      setError(itemsResult.error.message);
      setLoading(false);
      return;
    }

    setCategories(
      (categoriesResult.data ?? []) as Category[]
    );

    setItems((itemsResult.data ?? []) as MenuItem[]);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMenu();

    const menuChannel = supabase
      .channel("public-menu-items-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
        },
        () => {
          void loadMenu();
        }
      )
      .subscribe();

    const categoryChannel = supabase
      .channel("public-menu-categories-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
        },
        () => {
          void loadMenu();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(menuChannel);
      void supabase.removeChannel(categoryChannel);
    };
  }, [loadMenu]);

  const groupedCategories =
    useMemo<GroupedCategory[]>(() => {
      return categories.map((category) => {
  const categoryItems = items
    .filter((item) => {
      if (item.category_id !== null) {
        return item.category_id === category.id;
      }

      return item.category === category.slug;
    })
    .sort(
      (first, second) =>
        first.sort_order - second.sort_order
    );

  return {
    category,
    items: categoryItems,
  };
});
    }, [categories, items]);

  useEffect(() => {
    if (groupedCategories.length === 0) {
      setOpenCategoryId(null);
      return;
    }

    const currentCategoryStillExists =
      groupedCategories.some(
        (group) =>
          group.category.id === openCategoryId
      );

    if (!currentCategoryStillExists) {
      setOpenCategoryId(
        groupedCategories[0].category.id
      );
      setOpenProductId(null);
    }
  }, [groupedCategories, openCategoryId]);

  function toggleCategory(categoryId: number) {
    setOpenCategoryId((current) =>
      current === categoryId ? null : categoryId
    );

    setOpenProductId(null);
  }

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setOpenProductId(null);
  }

  const cartCount = cart.reduce((sum, row) => sum + row.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, row) => sum + Number(row.item.price || 0) * row.quantity,
    0
  );

  function addToCart(item: MenuItem) {
    if (!item.price || item.price <= 0) return;

    setCart((current) => {
      const existing = current.find((row) => row.item.id === item.id);
      if (existing) {
        return current.map((row) =>
          row.item.id === item.id
            ? { ...row, quantity: Math.min(20, row.quantity + 1) }
            : row
        );
      }
      return [...current, { item, quantity: 1 }];
    });
  }

  function changeCartQuantity(itemId: number, amount: number) {
    setCart((current) =>
      current
        .map((row) =>
          row.item.id === itemId
            ? { ...row, quantity: row.quantity + amount }
            : row
        )
        .filter((row) => row.quantity > 0)
    );
  }

  async function submitWebOrder() {
    setOrderError(null);

    if (!cart.length) {
      setOrderError(orderTexts[language].empty);
      return;
    }

    if (!customerName.trim() || phone.replace(/\D/g, "").length < 7) {
      setOrderError(
        language === "tr"
          ? "Ad soyad ve geçerli telefon numarası gerekli."
          : language === "ru"
            ? "Укажите имя и действующий номер телефона."
            : "Full name and a valid phone number are required."
      );
      return;
    }

    if (orderType === "delivery" && address.trim().length < 8) {
      setOrderError(
        language === "tr"
          ? "Paket servis için teslimat adresi gerekli."
          : language === "ru"
            ? "Для доставки укажите адрес."
            : "A delivery address is required."
      );
      return;
    }

    setSubmittingOrder(true);

    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          customerName,
          phone,
          address,
          note: orderNote,
          website,
          items: cart.map((row) => ({
            menuItemId: row.item.id,
            quantity: row.quantity,
          })),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        orderCode?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.orderCode) {
        throw new Error(data.error || "Sipariş oluşturulamadı.");
      }

      setOrderSuccess(data.orderCode);
      setCart([]);
      setCustomerName("");
      setPhone("");
      setAddress("");
      setOrderNote("");
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Sipariş oluşturulamadı."
      );
    } finally {
      setSubmittingOrder(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-5">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#6e1f12]/15 border-t-[#6e1f12]" />

          <p
            className="text-lg text-[#6e1f12]"
            style={{ fontFamily: BRAND_FONT }}
          >
            {texts[language].loading as string}
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-5">
        <p
          className="text-center text-lg text-[#6e1f12]"
          style={{ fontFamily: BRAND_FONT }}
        >
          {texts[language].error as string}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] text-[#292821]">
      <header className="sticky top-0 z-40 border-b border-[#6e1f12]/15 bg-[#f4efe5]/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <a
            href="/home"
            className="min-w-0"
            aria-label="Leman's Deli homepage"
          >
            <img
              src="/logo-horizontal.png"
              alt="Leman's Deli"
              className="h-12 w-auto max-w-[150px] object-contain object-left sm:h-14 sm:max-w-[240px]"
            />
          </a>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a
              href="/home"
              className="hidden rounded-full border border-[#6e1f12]/15 bg-white/60 px-4 py-2 text-xs font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white sm:inline-flex sm:text-sm"
              style={{ fontFamily: BRAND_FONT }}
            >
              {texts[language].home as string}
            </a>

            <div
              className="flex rounded-full border border-[#6e1f12]/15 bg-white/60 p-1"
              aria-label="Dil seçimi"
            >
              {(["tr", "en", "ru"] as Language[]).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      changeLanguage(option)
                    }
                    aria-pressed={language === option}
                    className={`rounded-full px-2.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                      language === option
                        ? "bg-[#6e1f12] text-white"
                        : "text-[#6e1f12] hover:bg-[#6e1f12]/5"
                    }`}
                  >
                    {option.toUpperCase()}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 flex justify-center sm:hidden">
          <a
            href="/home"
            className="inline-flex rounded-full border border-[#6e1f12]/15 bg-white/60 px-5 py-2.5 text-sm font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white"
            style={{ fontFamily: BRAND_FONT }}
          >
            {texts[language].home as string}
          </a>
        </div>

        <section className="mb-8 text-center md:mb-10">
          <h1
            className="text-3xl font-bold text-[#6e1f12] md:text-5xl"
            style={{ fontFamily: BRAND_FONT }}
          >
            {texts[language].title as string}
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#292821]/55 md:text-base">
            {texts[language].subtitle as string}
          </p>
        </section>

        {groupedCategories.length === 0 ? (
          <div className="rounded-2xl border border-[#6e1f12]/10 bg-white/60 px-6 py-12 text-center">
            <p className="text-sm text-[#292821]/55">
              {texts[language].emptyMenu as string}
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE: 2-column category grid + selected category products */}
            <div className="md:hidden">
              <div className="grid grid-cols-2 gap-2.5">
                {groupedCategories.map(({ category, items: categoryItems }) => {
                  const selected = openCategoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setOpenCategoryId(category.id);
                        setOpenProductId(null);
                      }}
                      aria-pressed={selected}
                      className={`min-h-[74px] rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                        selected
                          ? "border-[#6e1f12] bg-[#6e1f12] text-white shadow-sm"
                          : "border-[#6e1f12]/12 bg-white/65 text-[#6e1f12]"
                      }`}
                    >
                      <span
                        className="block text-[15px] font-bold leading-5"
                        style={{ fontFamily: BRAND_FONT }}
                      >
                        {getCategoryName(category, language)}
                      </span>

                      <span
                        className={`mt-1.5 block text-[11px] ${
                          selected ? "text-white/65" : "text-[#292821]/40"
                        }`}
                      >
                        {categoryItems.length} {texts[language].productCount as string}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(() => {
                const selectedGroup =
                  groupedCategories.find(
                    (group) => group.category.id === openCategoryId
                  ) ?? groupedCategories[0];

                if (!selectedGroup) return null;

                return (
                  <section className="mt-4 overflow-hidden rounded-3xl border border-[#6e1f12]/12 bg-white/65 shadow-[0_8px_30px_rgba(110,31,18,0.04)]">
                    <div className="border-b border-[#6e1f12]/10 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2
                          className="text-xl font-bold text-[#6e1f12]"
                          style={{ fontFamily: BRAND_FONT }}
                        >
                          {getCategoryName(selectedGroup.category, language)}
                        </h2>

                        <span className="shrink-0 rounded-full bg-[#6e1f12]/7 px-3 py-1 text-[11px] font-semibold text-[#6e1f12]/60">
                          {selectedGroup.items.length} {texts[language].productCount as string}
                        </span>
                      </div>
                    </div>

                    <CategoryProducts
                      items={selectedGroup.items}
                      language={language}
                      openProductId={openProductId}
                      setOpenProductId={setOpenProductId}
                      onAddToCart={addToCart}
                    />
                  </section>
                );
              })()}
            </div>

            {/* DESKTOP / TABLET: category selector + only selected category */}
            <div className="hidden md:block">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {groupedCategories.map(({ category, items: categoryItems }) => {
                  const selected = openCategoryId === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setOpenCategoryId(category.id);
                        setOpenProductId(null);
                      }}
                      aria-pressed={selected}
                      className={`rounded-2xl border px-5 py-4 text-left transition ${
                        selected
                          ? "border-[#6e1f12] bg-[#6e1f12] text-white shadow-sm"
                          : "border-[#6e1f12]/12 bg-white/65 text-[#6e1f12] hover:border-[#6e1f12]/30 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className="text-base font-bold"
                          style={{ fontFamily: BRAND_FONT }}
                        >
                          {getCategoryName(category, language)}
                        </span>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            selected
                              ? "bg-white/12 text-white/75"
                              : "bg-[#6e1f12]/7 text-[#6e1f12]/55"
                          }`}
                        >
                          {categoryItems.length}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {(() => {
                const selectedGroup =
                  groupedCategories.find(
                    (group) => group.category.id === openCategoryId
                  ) ?? groupedCategories[0];

                if (!selectedGroup) return null;

                return (
                  <section className="mt-5 overflow-hidden rounded-3xl border border-[#6e1f12]/12 bg-white/65 shadow-[0_8px_30px_rgba(110,31,18,0.04)]">
                    <div className="border-b border-[#6e1f12]/10 px-6 py-5">
                      <div className="flex items-center justify-between gap-4">
                        <h2
                          className="text-2xl font-bold text-[#6e1f12]"
                          style={{ fontFamily: BRAND_FONT }}
                        >
                          {getCategoryName(selectedGroup.category, language)}
                        </h2>

                        <span className="rounded-full bg-[#6e1f12]/7 px-3 py-1.5 text-xs font-semibold text-[#6e1f12]/60">
                          {selectedGroup.items.length}{" "}
                          {texts[language].productCount as string}
                        </span>
                      </div>
                    </div>

                    <CategoryProducts
                      items={selectedGroup.items}
                      language={language}
                      openProductId={openProductId}
                      setOpenProductId={setOpenProductId}
                      onAddToCart={addToCart}
                    />
                  </section>
                );
              })()}
            </div>
          </>
        )}

        {cartCount > 0 && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#6e1f12] px-5 py-3.5 text-sm font-bold text-white shadow-xl md:left-auto md:right-6 md:translate-x-0"
            style={{ fontFamily: BRAND_FONT }}
          >
            <span>{orderTexts[language].cart}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs">
              {cartCount}
            </span>
            <span>{cartTotal.toLocaleString("tr-TR")} ₺</span>
          </button>
        )}

        {(cartOpen || checkoutOpen) && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] md:items-center md:p-5">
            <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-[#f4efe5] p-5 shadow-2xl md:max-w-xl md:rounded-3xl md:p-7">
              <div className="flex items-center justify-between gap-4">
                <h2
                  className="text-2xl font-bold text-[#6e1f12]"
                  style={{ fontFamily: BRAND_FONT }}
                >
                  {checkoutOpen
                    ? orderTexts[language].orderInfo
                    : orderTexts[language].cart}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(false);
                    setOrderError(null);
                  }}
                  className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  ✕
                </button>
              </div>

              {!checkoutOpen ? (
                <>
                  <div className="mt-5 space-y-3">
                    {cart.length === 0 ? (
                      <p className="py-8 text-center opacity-50">
                        {orderTexts[language].empty}
                      </p>
                    ) : (
                      cart.map((row) => (
                        <div
                          key={row.item.id}
                          className="flex items-center gap-3 rounded-2xl border border-[#6e1f12]/10 bg-white p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#6e1f12]">
                              {getProductName(row.item, language)}
                            </p>
                            <p className="mt-1 text-xs opacity-50">
                              {row.item.portion || ""}
                              {row.item.portion ? " · " : ""}
                              {Number(row.item.price || 0).toLocaleString("tr-TR")} ₺
                            </p>
                          </div>

                          <div className="flex items-center rounded-full border border-black/10 bg-[#f4efe5]">
                            <button
                              type="button"
                              onClick={() => changeCartQuantity(row.item.id, -1)}
                              className="px-3 py-2 font-bold"
                            >
                              −
                            </button>
                            <span className="min-w-7 text-center text-sm font-bold">
                              {row.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => changeCartQuantity(row.item.id, 1)}
                              className="px-3 py-2 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[#6e1f12]/10 pt-5 text-lg font-bold">
                    <span>{orderTexts[language].total}</span>
                    <span>{cartTotal.toLocaleString("tr-TR")} ₺</span>
                  </div>

                  <button
                    type="button"
                    disabled={!cart.length}
                    onClick={() => {
                      setCheckoutOpen(true);
                      setCartOpen(false);
                    }}
                    className="mt-5 w-full rounded-2xl bg-[#6e1f12] px-5 py-4 font-bold text-white disabled:opacity-40"
                  >
                    {orderTexts[language].checkout}
                  </button>
                </>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {(["pickup", "delivery"] as OrderType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className={`rounded-2xl border px-4 py-3 font-bold ${
                          orderType === type
                            ? "border-[#6e1f12] bg-[#6e1f12] text-white"
                            : "border-[#6e1f12]/15 bg-white text-[#6e1f12]"
                        }`}
                      >
                        {type === "pickup"
                          ? orderTexts[language].pickup
                          : orderTexts[language].delivery}
                      </button>
                    ))}
                  </div>

                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder={orderTexts[language].name}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 outline-none focus:border-[#6e1f12]/50"
                  />

                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    placeholder={orderTexts[language].phone}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 outline-none focus:border-[#6e1f12]/50"
                  />

                  {orderType === "delivery" && (
                    <textarea
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder={orderTexts[language].address}
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3.5 outline-none focus:border-[#6e1f12]/50"
                    />
                  )}

                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    placeholder={`${orderTexts[language].note} · ${orderTexts[language].notePlaceholder}`}
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3.5 outline-none focus:border-[#6e1f12]/50"
                  />

                  <input
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />

                  <p className="text-xs leading-5 opacity-50">
                    {orderTexts[language].payment}
                  </p>

                  {orderError && (
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      {orderError}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-[#6e1f12]/10 pt-4 text-lg font-bold">
                    <span>{orderTexts[language].total}</span>
                    <span>{cartTotal.toLocaleString("tr-TR")} ₺</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void submitWebOrder()}
                    disabled={submittingOrder}
                    className="w-full rounded-2xl bg-[#6e1f12] px-5 py-4 font-bold text-white disabled:opacity-50"
                  >
                    {submittingOrder
                      ? orderTexts[language].sending
                      : orderTexts[language].submit}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutOpen(false);
                      setCartOpen(true);
                      setOrderError(null);
                    }}
                    className="w-full rounded-2xl border border-[#6e1f12]/15 bg-white px-5 py-3 text-sm font-bold text-[#6e1f12]"
                  >
                    {orderTexts[language].continue}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {orderSuccess && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-3xl bg-[#f4efe5] p-7 text-center shadow-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#6e1f12] text-2xl text-white">
                ✓
              </div>
              <h2
                className="mt-5 text-2xl font-bold text-[#6e1f12]"
                style={{ fontFamily: BRAND_FONT }}
              >
                {orderTexts[language].success}
              </h2>
              <p className="mt-3 text-sm opacity-60">
                {orderTexts[language].successDetail}
              </p>
              <p className="mt-1 text-xl font-bold text-[#6e1f12]">
                {orderSuccess}
              </p>
              <button
                type="button"
                onClick={() => setOrderSuccess(null)}
                className="mt-6 w-full rounded-2xl bg-[#6e1f12] px-5 py-3.5 font-bold text-white"
              >
                {orderTexts[language].close}
              </button>
            </div>
          </div>
        )}

        <footer className="mt-10 border-t border-[#6e1f12]/12 pt-6 text-center text-xs leading-5 text-[#292821]/45">
          {texts[language].footer as string}
        </footer>
      </div>
    </main>
  );
}

function CategoryProducts({
  items,
  language,
  openProductId,
  setOpenProductId,
  onAddToCart,
}: {
  items: MenuItem[];
  language: Language;
  openProductId: number | null;
  setOpenProductId: (id: number | null) => void;
  onAddToCart: (item: MenuItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-5 py-7 text-sm text-[#292821]/45 md:px-6">
        {texts[language].emptyCategory as string}
      </p>
    );
  }

  return (
    <>
      {items.map((item) => {
        const productOpen = openProductId === item.id;
        const name = getProductName(item, language);
        const description = getProductDescription(item, language);
        const dietaryLabel = getDietaryLabel(item.dietary, language);
        const spicyLevel = normalizeSpicyLevel(item.spicy_level);

        const details: { label: string; value: string }[] = [];

        if (item.portion) {
          details.push({
            label: texts[language].portion as string,
            value: item.portion,
          });
        }

        if (item.calories_per_portion !== null) {
          details.push({
            label: texts[language].calories as string,
            value: `${item.calories_per_portion} kcal`,
          });
        }

        if (item.calories_per_100g !== null) {
          details.push({
            label: texts[language].calories100 as string,
            value: `${item.calories_per_100g} kcal`,
          });
        }

        if (dietaryLabel) {
          details.push({
            label: texts[language].dietary as string,
            value: dietaryLabel,
          });
        }

        if (spicyLevel > 0) {
          const spicyLevels = texts[language].spicyLevels as string[];

          details.push({
            label: texts[language].spicy as string,
            value: spicyLevels[spicyLevel],
          });
        }

        return (
          <article
            key={item.id}
            className="border-b border-[#6e1f12]/10 last:border-b-0"
          >
            <ProductRow
              name={name}
              description={description}
              portion={item.portion}
              calories={item.calories_per_portion}
              dietaryLabel={dietaryLabel}
              price={item.price}
              open={productOpen}
              onToggle={() =>
                setOpenProductId(productOpen ? null : item.id)
              }
            />


            {item.price !== null && item.price > 0 && (
              <div className="px-4 pb-4 md:px-6">
                <button
                  type="button"
                  onClick={() => onAddToCart(item)}
                  className="w-full rounded-xl border border-[#6e1f12]/15 bg-[#6e1f12]/5 px-4 py-2.5 text-sm font-bold text-[#6e1f12] transition hover:bg-[#6e1f12] hover:text-white md:w-auto"
                >
                  + {orderTexts[language].add}
                </button>
              </div>
            )}

            {productOpen && (
              <ProductDetail
                name={name}
                imageUrl={item.image_url}
                description={description}
                details={details}
                allergens={getAllergenLabels(item.allergens, language)}
                allergensTitle={texts[language].allergens as string}
                noAllergenText={texts[language].noAllergen as string}
              />
            )}
          </article>
        );
      })}
    </>
  );
}
