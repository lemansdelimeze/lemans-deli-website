import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireIntegrationUser } from "../../../../../lib/integrations/requireUser";

export const runtime = "nodejs";

type MenuRow = {
  id: number;
  name: string | null;
  name_tr: string | null;
  name_en: string | null;
  description_tr: string | null;
  description_en: string | null;
  price: number | null;
  active: boolean;
  category: string | null;
  image_url: string | null;
};

type CatalogItem = Record<string, unknown>;

let accessTokenCache: { token: string; expiresAt: number } | null = null;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ortam değişkeni eksik.`);
  return value;
}

async function middlewareAccessToken() {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 30_000) {
    return accessTokenCache.token;
  }

  const baseUrl = requiredEnv("YEMEKSEPETI_MIDDLEWARE_BASE_URL").replace(/\/$/, "");
  const body = new URLSearchParams({
    username: requiredEnv("YEMEKSEPETI_MIDDLEWARE_USERNAME"),
    password: requiredEnv("YEMEKSEPETI_MIDDLEWARE_PASSWORD"),
    grant_type: "client_credentials",
  });
  const response = await fetch(`${baseUrl}/v2/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Yemeksepeti token alınamadı: HTTP ${response.status}`);
  const data = JSON.parse(raw) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Yemeksepeti erişim tokenı dönmedi.");
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 300)) * 1000,
  };
  return accessTokenCache.token;
}

function idFor(prefix: string, id: number) {
  return `${prefix}-${id}`;
}

function title(defaultTitle: string, enTitle?: string | null) {
  return {
    default: defaultTitle,
    ...(enTitle ? { en: enTitle } : {}),
  };
}

async function loadCatalog() {
  const chainCode = requiredEnv("YEMEKSEPETI_CHAIN_CODE");
  const vendorId = requiredEnv("YEMEKSEPETI_REMOTE_ID");
  const { data, error } = await supabaseAdmin
    .from("menu_items")
    .select("id,name,name_tr,name_en,description_tr,description_en,price,active,category,image_url")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as MenuRow[];
  if (!rows.length) throw new Error("Yemeksepeti kataloğu boş; menü gönderilmedi.");

  const items: Record<string, CatalogItem> = {};
  const grouped = new Map<string, MenuRow[]>();
  for (const row of rows) {
    const key = (row.category || "diger").trim().toLocaleLowerCase("tr-TR");
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const productRefs: Record<string, CatalogItem> = {};
  let order = 1;
  for (const row of rows) {
    const productId = idFor("lemans-menu", row.id);
    const name = row.name_tr || row.name || `Ürün ${row.id}`;
    const product: CatalogItem = {
      id: productId,
      type: "Product",
      title: title(name, row.name_en),
      active: Boolean(row.active),
      isExpressItem: false,
      isPrepackedItem: false,
      excludeDishInformation: false,
      price: Number(row.price || 0).toFixed(2),
      images: {},
      variants: {},
      toppings: {},
      ...(row.description_tr || row.description_en
        ? { description: title(row.description_tr || "", row.description_en) }
        : {}),
    };
    if (row.image_url) {
      const imageId = idFor("lemans-image", row.id);
      product.images = { [imageId]: { id: imageId, type: "Image" } };
      items[imageId] = {
        id: imageId,
        type: "Image",
        url: row.image_url,
        alt: title(name, row.name_en),
      };
    }
    items[productId] = product;
    productRefs[productId] = { id: productId, type: "Product", order: order++ };
  }

  for (const [category, products] of grouped) {
    const categoryId = `lemans-category-${encodeURIComponent(category)}`;
    const refs: Record<string, CatalogItem> = {};
    for (const row of products) {
      const productId = idFor("lemans-menu", row.id);
      refs[productId] = { id: productId, type: "Product" };
    }
    const label = products[0]?.category || "Diğer";
    items[categoryId] = {
      id: categoryId,
      type: "Category",
      title: title(label),
      products: refs,
    };
  }

  const menuId = "lemans-delivery-menu";
  items[menuId] = {
    id: menuId,
    type: "Menu",
    menuType: "DELIVERY",
    title: title("Leman's Deli Menü", "Leman's Deli Menu"),
    products: productRefs,
  };

  return {
    chainCode,
    vendorId,
    rows,
    catalog: { items },
  };
}

export async function GET(request: NextRequest) {
  if (!(await requireIntegrationUser(request))) {
    return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
  }
  try {
    const { chainCode, vendorId, rows, catalog } = await loadCatalog();
    return NextResponse.json({
      ok: true,
      dryRun: true,
      chainCode,
      vendorId,
      productCount: rows.length,
      activeCount: rows.filter((row) => row.active).length,
      categoryCount: Object.values(catalog.items).filter((item) => item.type === "Category").length,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireIntegrationUser(request))) {
    return NextResponse.json({ ok: false, error: "Personel oturumu bulunamadı." }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json({ ok: false, error: 'Tam katalog gönderimi için {"confirm":true} gereklidir.' }, { status: 400 });
    }
    const { chainCode, vendorId, rows, catalog } = await loadCatalog();
    const baseUrl = requiredEnv("YEMEKSEPETI_MIDDLEWARE_BASE_URL").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v2/chains/${encodeURIComponent(chainCode)}/catalog`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await middlewareAccessToken()}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vendors: [vendorId], catalog }),
      cache: "no-store",
    });
    const raw = await response.text();
    let result: unknown = raw;
    try { result = raw ? JSON.parse(raw) : null; } catch { /* preserve provider text */ }
    if (!response.ok) {
      return NextResponse.json({ ok: false, status: response.status, error: result }, { status: 502 });
    }

    const catalogImportId =
      result && typeof result === "object" && "catalogImportId" in result
        ? String((result as { catalogImportId?: unknown }).catalogImportId || "")
        : null;
    await supabaseAdmin.from("integration_events").insert({
      channel: "yemeksepeti",
      event_type: "catalog.submitted",
      external_order_id: catalogImportId,
      direction: "outbound",
      status: "submitted",
      payload: { vendorId, productCount: rows.length, response: result },
      processed_at: new Date().toISOString(),
    });

    const mappingWarnings: string[] = [];
    for (const row of rows) {
      const externalProductId = idFor("lemans-menu", row.id);
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from("integration_product_mappings")
        .select("id")
        .eq("channel", "yemeksepeti")
        .eq("external_product_id", externalProductId)
        .maybeSingle();
      if (lookupError) {
        mappingWarnings.push(`${externalProductId}: ${lookupError.message}`);
        continue;
      }
      const values = {
        menu_item_id: row.id,
        external_name: row.name_tr || row.name || `Ürün ${row.id}`,
        active: true,
        updated_at: new Date().toISOString(),
      };
      const mappingResult = existing
        ? await supabaseAdmin
            .from("integration_product_mappings")
            .update(values)
            .eq("id", existing.id)
        : await supabaseAdmin.from("integration_product_mappings").insert({
            channel: "yemeksepeti",
            external_product_id: externalProductId,
            external_variant_id: null,
            ...values,
          });
      if (mappingResult.error) mappingWarnings.push(`${externalProductId}: ${mappingResult.error.message}`);
    }

    return NextResponse.json({ ok: true, status: response.status, catalogImportId, productCount: rows.length, mappingWarnings, response: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
