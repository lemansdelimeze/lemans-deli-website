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

  tags: string[] | null;

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

const DAILY_REFERENCE_KCAL = 2000;

const categories: {
  value: Category;
  label: string;
}[] = [
  {
    value: "meze",
    label: "Mezeler",
  },
  {
    value: "zeytinyagli",
    label: "Zeytinyağlılar",
  },
  {
    value: "sandvic",
    label: "Sandviçler",
  },
  {
    value: "sarkuteri",
    label: "Şarküteri",
  },
  {
    value: "peynir",
    label: "Peynirler",
  },
  {
    value: "icecek",
    label: "İçecekler",
  },
];

const allergenOptions = [
  {
    value: "milk",
    label: "Süt",
  },
  {
    value: "gluten",
    label: "Gluten",
  },
  {
    value: "egg",
    label: "Yumurta",
  },
  {
    value: "nuts",
    label: "Kuruyemiş",
  },
  {
    value: "peanut",
    label: "Yer fıstığı",
  },
  {
    value: "sesame",
    label: "Susam",
  },
  {
    value: "celery",
    label: "Kereviz",
  },
  {
    value: "soy",
    label: "Soya",
  },
  {
    value: "mustard",
    label: "Hardal",
  },
  {
    value: "fish",
    label: "Balık",
  },
  {
    value: "shellfish",
    label: "Kabuklu deniz ürünü",
  },
];

const dietaryOptions = [
  {
    value: "none",
    label: "Yok",
  },
  {
    value: "vegan",
    label: "Vegan",
  },
  {
    value: "vegetarian",
    label: "Vejetaryen",
  },
];

const spicyOptions = [
  {
    value: 0,
    label: "Acısız",
  },
  {
    value: 1,
    label: "Hafif acılı",
  },
  {
    value: 2,
    label: "Acılı",
  },
  {
    value: 3,
    label: "Çok acılı",
  },
];

function defaultPortion(category: Category) {
  if (
    category === "meze" ||
    category === "zeytinyagli"
  ) {
    return "200 gr";
  }

  return "";
}

function emptyDraft(
  category: Category = "meze"
): DraftItem {
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

function itemToDraft(
  item: MenuItem
): DraftItem {
  return {
    name_tr:
      item.name_tr ??
      item.name ??
      "",

    name_en:
      item.name_en ??
      "",

    name_ru:
      item.name_ru ??
      "",

    description_tr:
      item.description_tr ??
      "",

    description_en:
      item.description_en ??
      "",

    description_ru:
      item.description_ru ??
      "",

    price:
      item.price !== null
        ? String(item.price)
        : "",

    category:
      item.category,

    portion:
      item.portion ??
      "",

    calories_per_100g:
      item.calories_per_100g !== null
        ? String(item.calories_per_100g)
        : "",

    calories_per_portion:
      item.calories_per_portion !== null
        ? String(item.calories_per_portion)
        : "",

    allergens:
      item.allergens ??
      [],

    dietary:
      item.dietary ??
      "none",

    spicy_level:
      item.spicy_level ??
      0,

    image_url:
      item.image_url ??
      "",

    sort_order:
      String(
        item.sort_order ??
          0
      ),

    active:
      item.active,
  };
}

function dailyReferencePercent(
  calories: string
) {
  const kcal =
    Number(calories);

  if (
    !kcal ||
    kcal <= 0
  ) {
    return null;
  }

  return Math.round(
    (kcal /
      DAILY_REFERENCE_KCAL) *
      100
  );
}

function sanitizeFilename(
  filename: string
) {
  const dotIndex =
    filename.lastIndexOf(".");

  const extension =
    dotIndex >= 0
      ? filename
          .slice(dotIndex + 1)
          .toLowerCase()
      : "jpg";

  const base =
    dotIndex >= 0
      ? filename.slice(
          0,
          dotIndex
        )
      : filename;

  const safeBase =
    base
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9-_]/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      )
      .toLowerCase() ||
    "menu-image";

  return `${safeBase}.${extension}`;
}

async function uploadMenuImage(
  file: File
) {
  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    throw new Error(
      "Lütfen bir görsel dosyası seçin."
    );
  }

  const maxSize =
    8 * 1024 * 1024;

  if (
    file.size >
    maxSize
  ) {
    throw new Error(
      "Görsel en fazla 8 MB olabilir."
    );
  }

  const filename =
    `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(
      file.name
    )}`;

  const { error } =
    await supabase.storage
      .from(
        "menu-images"
      )
      .upload(
        filename,
        file,
        {
          cacheControl:
            "3600",
          upsert: false,
        }
      );

  if (error) {
    throw error;
  }

  const {
    data:
      publicUrlData,
  } =
    supabase.storage
      .from(
        "menu-images"
      )
      .getPublicUrl(
        filename
      );

  return (
    publicUrlData.publicUrl
  );
}

function getStoragePathFromPublicUrl(
  url: string
) {
  const marker =
    "/storage/v1/object/public/menu-images/";

  const index =
    url.indexOf(marker);

  if (
    index === -1
  ) {
    return null;
  }

  return decodeURIComponent(
    url.slice(
      index +
        marker.length
    )
  );
}

export default function TvMenuAdminPage() {
  const [
    items,
    setItems,
  ] = useState<
    MenuItem[]
  >([]);

  const [
    drafts,
    setDrafts,
  ] = useState<
    Record<
      number,
      DraftItem
    >
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sessionLoading,
    setSessionLoading,
  ] = useState(true);

  const [
    loggedIn,
    setLoggedIn,
  ] = useState(false);

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loginError,
    setLoginError,
  ] = useState<
    string | null
  >(null);

  const [
    savingId,
    setSavingId,
  ] = useState<
    number | null
  >(null);

  const [
    uploadingId,
    setUploadingId,
  ] = useState<
    number | null
  >(null);

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    newItem,
    setNewItem,
  ] = useState<DraftItem>(
    emptyDraft()
  );

  const [
    newImageFile,
    setNewImageFile,
  ] = useState<
    File | null
  >(null);

  const [
    newImagePreview,
    setNewImagePreview,
  ] = useState("");

  async function loadItems() {
    setLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from(
        "menu_items"
      )
      .select("*")
      .order(
        "category",
        {
          ascending: true,
        }
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      );

    if (error) {
      console.error(
        "LOAD ERROR:",
        error
      );

      alert(
        `Ürünler yüklenemedi: ${error.message}`
      );

      setLoading(false);
      return;
    }

    const loadedItems =
      (data ??
        []) as MenuItem[];

    setItems(
      loadedItems
    );

    const loadedDrafts:
      Record<
        number,
        DraftItem
      > = {};

    loadedItems.forEach(
      (item) => {
        loadedDrafts[
          item.id
        ] =
          itemToDraft(
            item
          );
      }
    );

    setDrafts(
      loadedDrafts
    );

    setLoading(false);
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      setLoggedIn(
        Boolean(
          session
        )
      );

      setSessionLoading(
        false
      );

      if (
        session
      ) {
        await loadItems();
      }
    }

    checkSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          session
        ) => {
          setLoggedIn(
            Boolean(
              session
            )
          );

          if (
            session
          ) {
            loadItems();
          } else {
            setItems([]);
            setDrafts(
              {}
            );
          }
        }
      );

    return () =>
      subscription.unsubscribe();
  }, []);

  const groupedItems =
    useMemo(() => {
      return categories.map(
        (
          category
        ) => ({
          ...category,

          items:
            items
              .filter(
                (
                  item
                ) =>
                  item.category ===
                  category.value
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  a.sort_order -
                  b.sort_order
              ),
        })
      );
    }, [items]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoginError(
      null
    );

    const {
      error,
    } =
      await supabase.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

    if (error) {
      setLoginError(
        "E-posta veya şifre hatalı."
      );
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function updateDraft(
    id: number,
    changes: Partial<DraftItem>
  ) {
    setDrafts(
      (
        current
      ) => ({
        ...current,

        [id]: {
          ...current[
            id
          ],
          ...changes,
        },
      })
    );
  }

  function toggleDraftAllergen(
    id: number,
    allergen: string
  ) {
    const current =
      drafts[id];

    if (
      !current
    ) {
      return;
    }

    updateDraft(
      id,
      {
        allergens:
          current.allergens.includes(
            allergen
          )
            ? current.allergens.filter(
                (
                  item
                ) =>
                  item !==
                  allergen
              )
            : [
                ...current.allergens,
                allergen,
              ],
      }
    );
  }

  function toggleNewAllergen(
    allergen: string
  ) {
    setNewItem(
      (
        current
      ) => ({
        ...current,

        allergens:
          current.allergens.includes(
            allergen
          )
            ? current.allergens.filter(
                (
                  item
                ) =>
                  item !==
                  allergen
              )
            : [
                ...current.allergens,
                allergen,
              ],
      })
    );
  }

  async function saveItem(
    id: number
  ) {
    const draft =
      drafts[id];

    if (
      !draft
    ) {
      return;
    }

    if (
      !draft.name_tr.trim()
    ) {
      alert(
        "Türkçe ürün adı boş olamaz."
      );

      return;
    }

    setSavingId(id);

    const changes = {
      name:
        draft.name_tr.trim(),

      name_tr:
        draft.name_tr.trim(),

      name_en:
        draft.name_en.trim() ||
        null,

      name_ru:
        draft.name_ru.trim() ||
        null,

      description_tr:
        draft.description_tr.trim() ||
        null,

      description_en:
        draft.description_en.trim() ||
        null,

      description_ru:
        draft.description_ru.trim() ||
        null,

      price:
        draft.price
          ? Number(
              draft.price
            )
          : null,

      category:
        draft.category,

      portion:
        draft.portion.trim() ||
        null,

      calories_per_100g:
        draft.calories_per_100g
          ? Number(
              draft.calories_per_100g
            )
          : null,

      calories_per_portion:
        draft.calories_per_portion
          ? Number(
              draft.calories_per_portion
            )
          : null,

      allergens:
        draft.allergens,

      dietary:
        draft.dietary,

      spicy_level:
        draft.spicy_level,

      image_url:
        draft.image_url ||
        null,

      active:
        draft.active,

      sort_order:
        Number(
          draft.sort_order
        ) ||
        0,

      updated_at:
        new Date().toISOString(),
    };

    const {
      error,
    } =
      await supabase
        .from(
          "menu_items"
        )
        .update(
          changes
        )
        .eq(
          "id",
          id
        );

    if (
      error
    ) {
      console.error(
        "UPDATE ERROR:",
        error
      );

      alert(
        `Ürün güncellenemedi: ${error.message}`
      );

      setSavingId(
        null
      );

      return;
    }

    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            id
              ? {
                  ...item,
                  ...changes,
                }
              : item
        )
    );

    setSavingId(
      null
    );
  }

  async function quickToggle(
    item: MenuItem
  ) {
    const newActive =
      !item.active;

    setSavingId(
      item.id
    );

    const {
      error,
    } =
      await supabase
        .from(
          "menu_items"
        )
        .update({
          active:
            newActive,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          item.id
        );

    if (
      error
    ) {
      console.error(
        "TOGGLE ERROR:",
        error
      );

      alert(
        `Durum değiştirilemedi: ${error.message}`
      );

      setSavingId(
        null
      );

      return;
    }

    setItems(
      (
        current
      ) =>
        current.map(
          (
            currentItem
          ) =>
            currentItem.id ===
            item.id
              ? {
                  ...currentItem,
                  active:
                    newActive,
                }
              : currentItem
        )
    );

    updateDraft(
      item.id,
      {
        active:
          newActive,
      }
    );

    setSavingId(
      null
    );
  }

  async function handleExistingImageUpload(
    id: number,
    file: File
  ) {
    try {
      setUploadingId(
        id
      );

      const draft =
        drafts[id];

      if (
        !draft
      ) {
        throw new Error(
          "Ürün bulunamadı."
        );
      }

      const oldUrl =
        draft.image_url;

      const newUrl =
        await uploadMenuImage(
          file
        );

      const {
        error,
      } =
        await supabase
          .from(
            "menu_items"
          )
          .update({
            image_url:
              newUrl,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            id
          );

      if (
        error
      ) {
        const newPath =
          getStoragePathFromPublicUrl(
            newUrl
          );

        if (
          newPath
        ) {
          await supabase.storage
            .from(
              "menu-images"
            )
            .remove([
              newPath,
            ]);
        }

        throw error;
      }

      updateDraft(
        id,
        {
          image_url:
            newUrl,
        }
      );

      setItems(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              id
                ? {
                    ...item,
                    image_url:
                      newUrl,
                  }
                : item
          )
      );

      if (
        oldUrl
      ) {
        const oldPath =
          getStoragePathFromPublicUrl(
            oldUrl
          );

        if (
          oldPath
        ) {
          const {
            error:
              removeError,
          } =
            await supabase.storage
              .from(
                "menu-images"
              )
              .remove([
                oldPath,
              ]);

          if (
            removeError
          ) {
            console.warn(
              "Eski görsel silinemedi:",
              removeError
            );
          }
        }
      }
    } catch (
      error
    ) {
      console.error(
        "IMAGE UPLOAD ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Görsel yüklenemedi."
      );
    } finally {
      setUploadingId(
        null
      );
    }
  }

  async function removeExistingImage(
    id: number
  ) {
    const draft =
      drafts[id];

    if (
      !draft ||
      !draft.image_url
    ) {
      return;
    }

    if (
      !window.confirm(
        "Bu ürünün görseli kaldırılsın mı?"
      )
    ) {
      return;
    }

    try {
      setUploadingId(
        id
      );

      const oldUrl =
        draft.image_url;

      const {
        error,
      } =
        await supabase
          .from(
            "menu_items"
          )
          .update({
            image_url:
              null,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            id
          );

      if (
        error
      ) {
        throw error;
      }

      updateDraft(
        id,
        {
          image_url:
            "",
        }
      );

      setItems(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              id
                ? {
                    ...item,
                    image_url:
                      null,
                  }
                : item
          )
      );

      const path =
        getStoragePathFromPublicUrl(
          oldUrl
        );

      if (
        path
      ) {
        const {
          error:
            storageError,
        } =
          await supabase.storage
            .from(
              "menu-images"
            )
            .remove([
              path,
            ]);

        if (
          storageError
        ) {
          console.warn(
            "Storage görsel silme uyarısı:",
            storageError
          );
        }
      }
    } catch (
      error
    ) {
      console.error(
        "REMOVE IMAGE ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Görsel kaldırılamadı."
      );
    } finally {
      setUploadingId(
        null
      );
    }
  }

  function handleNewImageSelect(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (
      !file
    ) {
      return;
    }

    if (
      newImagePreview
    ) {
      URL.revokeObjectURL(
        newImagePreview
      );
    }

    setNewImageFile(
      file
    );

    setNewImagePreview(
      URL.createObjectURL(
        file
      )
    );
  }

  function clearNewImage() {
    if (
      newImagePreview
    ) {
      URL.revokeObjectURL(
        newImagePreview
      );
    }

    setNewImageFile(
      null
    );

    setNewImagePreview(
      ""
    );
  }

  async function deleteItem(
    item: MenuItem
  ) {
    const displayName =
      item.name_tr ||
      item.name ||
      "Bu ürün";

    if (
      !window.confirm(
        `${displayName} silinsin mi?`
      )
    ) {
      return;
    }

    setSavingId(
      item.id
    );

    const imageUrl =
      item.image_url;

    const {
      error,
    } =
      await supabase
        .from(
          "menu_items"
        )
        .delete()
        .eq(
          "id",
          item.id
        );

    if (
      error
    ) {
      console.error(
        "DELETE ERROR:",
        error
      );

      alert(
        `Ürün silinemedi: ${error.message}`
      );

      setSavingId(
        null
      );

      return;
    }

    setItems(
      (
        current
      ) =>
        current.filter(
          (
            currentItem
          ) =>
            currentItem.id !==
            item.id
        )
    );

    setDrafts(
      (
        current
      ) => {
        const next = {
          ...current,
        };

        delete next[
          item.id
        ];

        return next;
      }
    );

    if (
      imageUrl
    ) {
      const path =
        getStoragePathFromPublicUrl(
          imageUrl
        );

      if (
        path
      ) {
        await supabase.storage
          .from(
            "menu-images"
          )
          .remove([
            path,
          ]);
      }
    }

    setSavingId(
      null
    );
  }

  async function addItem(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !newItem.name_tr.trim()
    ) {
      alert(
        "Türkçe ürün adı zorunlu."
      );

      return;
    }

    setAdding(true);

    let uploadedUrl:
      string | null =
      null;

    try {
      if (
        newImageFile
      ) {
        uploadedUrl =
          await uploadMenuImage(
            newImageFile
          );
      }

      const payload = {
        name:
          newItem.name_tr.trim(),

        name_tr:
          newItem.name_tr.trim(),

        name_en:
          newItem.name_en.trim() ||
          null,

        name_ru:
          newItem.name_ru.trim() ||
          null,

        description_tr:
          newItem.description_tr.trim() ||
          null,

        description_en:
          newItem.description_en.trim() ||
          null,

        description_ru:
          newItem.description_ru.trim() ||
          null,

        price:
          newItem.price
            ? Number(
                newItem.price
              )
            : null,

        category:
          newItem.category,

        portion:
          newItem.portion.trim() ||
          null,

        calories_per_100g:
          newItem.calories_per_100g
            ? Number(
                newItem.calories_per_100g
              )
            : null,

        calories_per_portion:
          newItem.calories_per_portion
            ? Number(
                newItem.calories_per_portion
              )
            : null,

        allergens:
          newItem.allergens,

        dietary:
          newItem.dietary,

        spicy_level:
          newItem.spicy_level,

        image_url:
          uploadedUrl,

        active:
          newItem.active,

        sort_order:
          Number(
            newItem.sort_order
          ) ||
          0,
      };

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "menu_items"
          )
          .insert(
            payload
          )
          .select()
          .single();

      if (
        error
      ) {
        if (
          uploadedUrl
        ) {
          const path =
            getStoragePathFromPublicUrl(
              uploadedUrl
            );

          if (
            path
          ) {
            await supabase.storage
              .from(
                "menu-images"
              )
              .remove([
                path,
              ]);
          }
        }

        throw error;
      }

      const created =
        data as MenuItem;

      setItems(
        (
          current
        ) => [
          ...current,
          created,
        ]
      );

      setDrafts(
        (
          current
        ) => ({
          ...current,

          [created.id]:
            itemToDraft(
              created
            ),
        })
      );

      setNewItem(
        emptyDraft(
          newItem.category
        )
      );

      clearNewImage();
    } catch (
      error
    ) {
      console.error(
        "INSERT ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? `Ürün eklenemedi: ${error.message}`
          : "Ürün eklenemedi."
      );
    } finally {
      setAdding(
        false
      );
    }
  }

  if (
    sessionLoading
  ) {
    return (
      <main className="min-h-screen bg-[#f4efe5] flex items-center justify-center">
        <p>
          Yükleniyor...
        </p>
      </main>
    );
  }

  if (
    !loggedIn
  ) {
    return (
      <main className="min-h-screen bg-[#f4efe5] text-[#242820] flex items-center justify-center px-6">
        <form
          onSubmit={
            handleLogin
          }
          className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm border border-black/10"
        >
          <p className="text-sm uppercase tracking-[0.2em] opacity-50 mb-2">
            Leman&apos;s Deli
          </p>

          <h1 className="text-3xl font-semibold mb-2">
            Menü Yönetimi
          </h1>

          <p className="mb-8 opacity-60">
            TV, web ve QR menü ürünlerini yönetin.
          </p>

          <Field label="E-posta">
            <input
              type="email"
              value={
                email
              }
              onChange={(
                event
              ) =>
                setEmail(
                  event.target.value
                )
              }
              required
              className={
                inputClass
              }
            />
          </Field>

          <div className="mt-5">
            <Field label="Şifre">
              <input
                type="password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target.value
                  )
                }
                required
                className={
                  inputClass
                }
              />
            </Field>
          </div>

          {loginError && (
            <p className="mt-4 text-sm text-red-700">
              {
                loginError
              }
            </p>
          )}

          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-[#6e1f12] text-white py-3 font-medium"
          >
            Giriş Yap
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe5] text-[#242820] px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-7xl mx-auto">

        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#6e1f12] mb-2">
              Leman&apos;s Deli
            </p>

            <h1 className="text-3xl md:text-5xl font-semibold">
              Menü Yönetimi
            </h1>

            <p className="mt-2 opacity-60 max-w-3xl">
              Ürün, görsel, gramaj, kalori, içerik, alerjen ve dil bilgilerini tek yerden yönetin.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/tv-menu"
              target="_blank"
              className="rounded-xl border border-black/15 bg-white px-4 py-2"
            >
              TV Menüsü
            </a>

            <a
              href="/tv-menu/print"
              target="_blank"
              className="rounded-xl border border-black/15 bg-white px-4 py-2"
            >
              Printable
            </a>

            <button
              onClick={
                handleLogout
              }
              className="rounded-xl border border-black/15 bg-white px-4 py-2"
            >
              Çıkış
            </button>
          </div>
        </header>

        <section className="bg-white border border-black/10 rounded-3xl p-5 md:p-7 mb-10 shadow-sm">

          <h2 className="text-2xl font-semibold mb-6">
            Yeni Ürün Ekle
          </h2>

          <form
            onSubmit={
              addItem
            }
            className="space-y-7"
          >
            <NewImageField
              preview={
                newImagePreview
              }
              onSelect={
                handleNewImageSelect
              }
              onClear={
                clearNewImage
              }
            />

            <LanguageFields
              value={
                newItem
              }
              onChange={(
                changes
              ) =>
                setNewItem(
                  (
                    current
                  ) => ({
                    ...current,
                    ...changes,
                  })
                )
              }
            />

            <MainFields
              value={
                newItem
              }
              onChange={(
                changes
              ) =>
                setNewItem(
                  (
                    current
                  ) => ({
                    ...current,
                    ...changes,
                  })
                )
              }
            />

            <NutritionFields
              value={
                newItem
              }
              onChange={(
                changes
              ) =>
                setNewItem(
                  (
                    current
                  ) => ({
                    ...current,
                    ...changes,
                  })
                )
              }
            />

            <AllergenSelector
              selected={
                newItem.allergens
              }
              onToggle={
                toggleNewAllergen
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChoiceGroup
                title="Beslenme"
                options={
                  dietaryOptions
                }
                value={
                  newItem.dietary
                }
                onChange={(
                  value
                ) =>
                  setNewItem(
                    (
                      current
                    ) => ({
                      ...current,
                      dietary:
                        value as Dietary,
                    })
                  )
                }
              />

              <ChoiceGroup
                title="Acılık"
                options={
                  spicyOptions
                }
                value={
                  newItem.spicy_level
                }
                onChange={(
                  value
                ) =>
                  setNewItem(
                    (
                      current
                    ) => ({
                      ...current,
                      spicy_level:
                        Number(
                          value
                        ),
                    })
                  )
                }
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  newItem.active
                }
                onChange={(
                  event
                ) =>
                  setNewItem(
                    (
                      current
                    ) => ({
                      ...current,
                      active:
                        event.target.checked,
                    })
                  )
                }
                className="h-5 w-5"
              />

              <span className="font-medium">
                Ürün aktif olarak yayınlansın
              </span>
            </label>

            <button
              type="submit"
              disabled={
                adding
              }
              className="rounded-xl bg-[#6e1f12] text-white px-7 py-3 font-medium disabled:opacity-50"
            >
              {adding
                ? "Ekleniyor..."
                : "Ürünü Ekle"}
            </button>
          </form>
        </section>

        {loading ? (
          <p>
            Ürünler yükleniyor...
          </p>
        ) : (
          <div className="space-y-12">
            {groupedItems.map(
              (
                group
              ) => (
                <section
                  key={
                    group.value
                  }
                >
                  <div className="flex items-end justify-between mb-4">
                    <h2 className="text-2xl md:text-3xl font-semibold">
                      {
                        group.label
                      }
                    </h2>

                    <span className="text-sm opacity-50">
                      {
                        group.items.length
                      }{" "}
                      ürün
                    </span>
                  </div>

                  {group.items.length ===
                  0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-5 opacity-55">
                      Bu kategoride ürün yok.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {group.items.map(
                        (
                          item
                        ) => {
                          const draft =
                            drafts[
                              item.id
                            ];

                          if (
                            !draft
                          ) {
                            return null;
                          }

                          return (
                            <ProductCard
                              key={
                                item.id
                              }
                              item={
                                item
                              }
                              draft={
                                draft
                              }
                              saving={
                                savingId ===
                                item.id
                              }
                              uploading={
                                uploadingId ===
                                item.id
                              }
                              onDraftChange={(
                                changes
                              ) =>
                                updateDraft(
                                  item.id,
                                  changes
                                )
                              }
                              onToggleAllergen={(
                                allergen
                              ) =>
                                toggleDraftAllergen(
                                  item.id,
                                  allergen
                                )
                              }
                              onSave={() =>
                                saveItem(
                                  item.id
                                )
                              }
                              onQuickToggle={() =>
                                quickToggle(
                                  item
                                )
                              }
                              onImageUpload={(
                                file
                              ) =>
                                handleExistingImageUpload(
                                  item.id,
                                  file
                                )
                              }
                              onRemoveImage={() =>
                                removeExistingImage(
                                  item.id
                                )
                              }
                              onDelete={() =>
                                deleteItem(
                                  item
                                )
                              }
                            />
                          );
                        }
                      )}
                    </div>
                  )}
                </section>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ProductCard({
  item,
  draft,
  saving,
  uploading,
  onDraftChange,
  onToggleAllergen,
  onSave,
  onQuickToggle,
  onImageUpload,
  onRemoveImage,
  onDelete,
}: {
  item: MenuItem;
  draft: DraftItem;

  saving: boolean;
  uploading: boolean;

  onDraftChange: (
    changes: Partial<DraftItem>
  ) => void;

  onToggleAllergen: (
    allergen: string
  ) => void;

  onSave: () => void;
  onQuickToggle: () => void;

  onImageUpload: (
    file: File
  ) => void;

  onRemoveImage: () => void;
  onDelete: () => void;
}) {
  const percentage =
    dailyReferencePercent(
      draft.calories_per_portion
    );

  return (
    <article className="bg-white border border-black/10 rounded-3xl p-5 md:p-6 shadow-sm">

      <div className="flex justify-between gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-semibold text-[#6e1f12]">
            {draft.name_tr ||
              item.name ||
              "İsimsiz ürün"}
          </h3>

          <p className="text-sm opacity-50 mt-1">
            {draft.portion ||
              "Gramaj yok"}

            {draft.price
              ? ` · ${draft.price} ₺`
              : ""}
          </p>

          {draft.calories_per_portion && (
            <p className="text-sm text-[#6e1f12]/75 mt-1">
              {
                draft.calories_per_portion
              }{" "}
              kcal

              {percentage !==
                null &&
                ` · %${percentage} referans`}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={
            saving ||
            uploading
          }
          onClick={
            onQuickToggle
          }
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
            draft.active
              ? "bg-green-700 text-white"
              : "bg-black/10"
          }`}
        >
          {draft.active
            ? "AÇIK"
            : "KAPALI"}
        </button>
      </div>

      <div className="space-y-7">

        <ExistingImageField
          imageUrl={
            draft.image_url
          }
          uploading={
            uploading
          }
          onUpload={
            onImageUpload
          }
          onRemove={
            onRemoveImage
          }
        />

        <LanguageFields
          value={
            draft
          }
          onChange={
            onDraftChange
          }
        />

        <MainFields
          value={
            draft
          }
          onChange={
            onDraftChange
          }
        />

        <NutritionFields
          value={
            draft
          }
          onChange={
            onDraftChange
          }
        />

        <AllergenSelector
          selected={
            draft.allergens
          }
          onToggle={
            onToggleAllergen
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChoiceGroup
            title="Beslenme"
            options={
              dietaryOptions
            }
            value={
              draft.dietary
            }
            onChange={(
              value
            ) =>
              onDraftChange({
                dietary:
                  value as Dietary,
              })
            }
          />

          <ChoiceGroup
            title="Acılık"
            options={
              spicyOptions
            }
            value={
              draft.spicy_level
            }
            onChange={(
              value
            ) =>
              onDraftChange({
                spicy_level:
                  Number(
                    value
                  ),
              })
            }
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={
              saving ||
              uploading
            }
            onClick={
              onSave
            }
            className="flex-1 rounded-xl bg-[#6e1f12] text-white px-5 py-3 font-medium disabled:opacity-50"
          >
            {saving
              ? "Kaydediliyor..."
              : "Değişiklikleri Kaydet"}
          </button>

          <button
            type="button"
            disabled={
              saving ||
              uploading
            }
            onClick={
              onDelete
            }
            className="rounded-xl border border-red-900/20 text-red-800 px-5 py-3 disabled:opacity-50"
          >
            Sil
          </button>
        </div>
      </div>
    </article>
  );
}

function ExistingImageField({
  imageUrl,
  uploading,
  onUpload,
  onRemove,
}: {
  imageUrl: string;
  uploading: boolean;

  onUpload: (
    file: File
  ) => void;

  onRemove: () => void;
}) {
  function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (
      !file
    ) {
      return;
    }

    onUpload(
      file
    );

    event.target.value =
      "";
  }

  return (
    <div>
      <h4 className="font-semibold mb-3">
        Ürün Görseli
      </h4>

      {imageUrl ? (
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 items-start">

          <div className="aspect-square overflow-hidden rounded-2xl bg-[#f4efe5] border border-black/10">
            <img
              src={
                imageUrl
              }
              alt=""
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm opacity-55">
              Bu görsel günlük web menüsünde ve ileride seçilen diğer menü yüzeylerinde kullanılabilir.
            </p>

            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-medium">
              {uploading
                ? "Yükleniyor..."
                : "Görseli Değiştir"}

              <input
                type="file"
                accept="image/*"
                disabled={
                  uploading
                }
                onChange={
                  handleFile
                }
                className="hidden"
              />
            </label>

            <button
              type="button"
              disabled={
                uploading
              }
              onClick={
                onRemove
              }
              className="rounded-xl border border-red-900/20 px-4 py-3 text-sm text-red-800 disabled:opacity-50"
            >
              Görseli Kaldır
            </button>
          </div>

        </div>
      ) : (
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-[#faf7f1] px-5 py-6 text-center">
          <span className="font-medium">
            {uploading
              ? "Görsel yükleniyor..."
              : "Ürün görseli yükle"}
          </span>

          <span className="mt-1 text-sm opacity-50">
            JPG, PNG veya WebP · en fazla 8 MB
          </span>

          <input
            type="file"
            accept="image/*"
            disabled={
              uploading
            }
            onChange={
              handleFile
            }
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function NewImageField({
  preview,
  onSelect,
  onClear,
}: {
  preview: string;

  onSelect: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;

  onClear: () => void;
}) {
  return (
    <div>
      <h4 className="font-semibold mb-3">
        Ürün Görseli
      </h4>

      {preview ? (
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 items-start">
          <div className="aspect-square overflow-hidden rounded-2xl border border-black/10 bg-[#f4efe5]">
            <img
              src={
                preview
              }
              alt="Yeni ürün görseli önizleme"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm opacity-55">
              Ürün kaydedildiğinde bu görsel Supabase Storage&apos;a yüklenecek.
            </p>

            <label className="cursor-pointer rounded-xl border border-black/15 px-4 py-3 text-center text-sm font-medium">
              Başka Görsel Seç

              <input
                type="file"
                accept="image/*"
                onChange={
                  onSelect
                }
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={
                onClear
              }
              className="rounded-xl border border-red-900/20 px-4 py-3 text-sm text-red-800"
            >
              Seçimi Kaldır
            </button>
          </div>
        </div>
      ) : (
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-[#faf7f1] px-5 py-6 text-center">
          <span className="font-medium">
            Görsel Seç
          </span>

          <span className="mt-1 text-sm opacity-50">
            JPG, PNG veya WebP · en fazla 8 MB
          </span>

          <input
            type="file"
            accept="image/*"
            onChange={
              onSelect
            }
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function MainFields({
  value,
  onChange,
}: {
  value: DraftItem;

  onChange: (
    changes: Partial<DraftItem>
  ) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      <Field label="Kategori">
        <select
          value={
            value.category
          }
          onChange={(
            event
          ) => {
            const category =
              event.target.value as Category;

            onChange({
              category,

              portion:
                value.portion ||
                defaultPortion(
                  category
                ),
            });
          }}
          className={
            inputClass
          }
        >
          {categories.map(
            (
              category
            ) => (
              <option
                key={
                  category.value
                }
                value={
                  category.value
                }
              >
                {
                  category.label
                }
              </option>
            )
          )}
        </select>
      </Field>

      <Field label="Gramaj / Porsiyon">
        <input
          value={
            value.portion
          }
          onChange={(
            event
          ) =>
            onChange({
              portion:
                event.target.value,
            })
          }
          placeholder="200 gr, 330 ml, adet..."
          className={
            inputClass
          }
        />
      </Field>

      <Field label="Fiyat">
        <input
          type="number"
          step="0.01"
          value={
            value.price
          }
          onChange={(
            event
          ) =>
            onChange({
              price:
                event.target.value,
            })
          }
          className={
            inputClass
          }
        />
      </Field>

      <Field label="Menü Sırası">
        <input
          type="number"
          value={
            value.sort_order
          }
          onChange={(
            event
          ) =>
            onChange({
              sort_order:
                event.target.value,
            })
          }
          className={
            inputClass
          }
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

  onChange: (
    changes: Partial<DraftItem>
  ) => void;
}) {
  const percentage =
    dailyReferencePercent(
      value.calories_per_portion
    );

  return (
    <div className="rounded-2xl border border-[#6e1f12]/10 bg-[#faf7f1] p-4">

      <h4 className="font-semibold mb-1">
        Besin Bilgisi
      </h4>

      <p className="text-sm opacity-55 mb-4">
        Günlük referans enerji alımı 2.000 kcal üzerinden hesaplanır.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <Field label="100 g / 100 ml Kalori">
          <div className="relative">
            <input
              type="number"
              min="0"
              value={
                value.calories_per_100g
              }
              onChange={(
                event
              ) =>
                onChange({
                  calories_per_100g:
                    event.target.value,
                })
              }
              placeholder="Örn. 210"
              className={`${inputClass} pr-14`}
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-45">
              kcal
            </span>
          </div>
        </Field>

        <Field label="Porsiyon Kalorisi">
          <div className="relative">
            <input
              type="number"
              min="0"
              value={
                value.calories_per_portion
              }
              onChange={(
                event
              ) =>
                onChange({
                  calories_per_portion:
                    event.target.value,
                })
              }
              placeholder="Örn. 420"
              className={`${inputClass} pr-14`}
            />

            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-45">
              kcal
            </span>
          </div>
        </Field>

      </div>

      {percentage !==
        null && (
        <div className="mt-4 rounded-xl border border-black/5 bg-white px-4 py-3 text-sm">
          <strong>
            {
              value.calories_per_portion
            }{" "}
            kcal
          </strong>

          {" · "}

          2.000 kcal günlük referans alımın yaklaşık{" "}

          <strong>
            %{percentage}
          </strong>

          &apos;ine karşılık gelir.
        </div>
      )}

    </div>
  );
}

function LanguageFields({
  value,
  onChange,
}: {
  value: DraftItem;

  onChange: (
    changes: Partial<DraftItem>
  ) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      <LanguageBox
        title="🇹🇷 Türkçe"
        nameLabel="Ürün adı"
        nameValue={
          value.name_tr
        }
        descriptionLabel="Muhteviyat / Açıklama"
        descriptionValue={
          value.description_tr
        }
        onNameChange={(
          text
        ) =>
          onChange({
            name_tr:
              text,
          })
        }
        onDescriptionChange={(
          text
        ) =>
          onChange({
            description_tr:
              text,
          })
        }
      />

      <LanguageBox
        title="🇬🇧 English"
        nameLabel="Product name"
        nameValue={
          value.name_en
        }
        descriptionLabel="Ingredients / Description"
        descriptionValue={
          value.description_en
        }
        onNameChange={(
          text
        ) =>
          onChange({
            name_en:
              text,
          })
        }
        onDescriptionChange={(
          text
        ) =>
          onChange({
            description_en:
              text,
          })
        }
      />

      <LanguageBox
        title="🇷🇺 Русский"
        nameLabel="Название"
        nameValue={
          value.name_ru
        }
        descriptionLabel="Состав / Описание"
        descriptionValue={
          value.description_ru
        }
        onNameChange={(
          text
        ) =>
          onChange({
            name_ru:
              text,
          })
        }
        onDescriptionChange={(
          text
        ) =>
          onChange({
            description_ru:
              text,
          })
        }
      />

    </div>
  );
}

function LanguageBox({
  title,
  nameLabel,
  nameValue,
  descriptionLabel,
  descriptionValue,
  onNameChange,
  onDescriptionChange,
}: {
  title: string;

  nameLabel: string;
  nameValue: string;

  descriptionLabel: string;
  descriptionValue: string;

  onNameChange: (
    value: string
  ) => void;

  onDescriptionChange: (
    value: string
  ) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#f7f3eb] border border-black/5 p-4">

      <h4 className="font-semibold mb-4">
        {title}
      </h4>

      <div className="space-y-4">

        <Field
          label={
            nameLabel
          }
        >
          <input
            value={
              nameValue
            }
            onChange={(
              event
            ) =>
              onNameChange(
                event.target.value
              )
            }
            className={
              inputClass
            }
          />
        </Field>

        <Field
          label={
            descriptionLabel
          }
        >
          <textarea
            rows={4}
            value={
              descriptionValue
            }
            onChange={(
              event
            ) =>
              onDescriptionChange(
                event.target.value
              )
            }
            className={`${inputClass} resize-y min-h-28`}
          />
        </Field>

      </div>
    </div>
  );
}

function AllergenSelector({
  selected,
  onToggle,
}: {
  selected: string[];

  onToggle: (
    value: string
  ) => void;
}) {
  return (
    <div>

      <h4 className="font-semibold mb-3">
        Alerjenler
      </h4>

      <div className="flex flex-wrap gap-2">

        {allergenOptions.map(
          (
            allergen
          ) => {
            const active =
              selected.includes(
                allergen.value
              );

            return (
              <button
                key={
                  allergen.value
                }
                type="button"
                onClick={() =>
                  onToggle(
                    allergen.value
                  )
                }
                className={`rounded-full border px-3 py-2 text-sm ${
                  active
                    ? "bg-[#6e1f12] text-white border-[#6e1f12]"
                    : "bg-white border-black/15"
                }`}
              >
                {active
                  ? "✓ "
                  : ""}

                {
                  allergen.label
                }
              </button>
            );
          }
        )}

      </div>

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
    value:
      | string
      | number;

    label: string;
  }[];

  value:
    | string
    | number;

  onChange: (
    value:
      | string
      | number
  ) => void;
}) {
  return (
    <div>

      <h4 className="font-semibold mb-3">
        {title}
      </h4>

      <div className="flex flex-wrap gap-2">

        {options.map(
          (
            option
          ) => {
            const active =
              String(
                value
              ) ===
              String(
                option.value
              );

            return (
              <button
                key={
                  option.value
                }
                type="button"
                onClick={() =>
                  onChange(
                    option.value
                  )
                }
                className={`rounded-full border px-4 py-2 text-sm ${
                  active
                    ? "bg-[#242820] text-white border-[#242820]"
                    : "bg-white border-black/15"
                }`}
              >
                {
                  option.label
                }
              </button>
            );
          }
        )}

      </div>

    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;

  children:
    ReactNode;
}) {
  return (
    <label className="block">

      <span className="block text-sm font-medium mb-2">
        {label}
      </span>

      {children}

    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-black/15 bg-white px-3 py-3 outline-none focus:border-black/40";