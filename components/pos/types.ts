export type Category = {
  id: number;
  slug: string;
  name_tr: string;
  sort_order: number;
  active: boolean;
};

export type MenuItem = {
  id: number;
  name: string | null;
  name_tr: string | null;
  price: number | null;
  portion: string | null;
  category_id: number | null;
  category: string | null;
  active: boolean;
  sort_order: number;
};

export type PosTable = {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
};

export type PortionType = "full" | "half" | "unit" | "weight";
export type OrderType = "Masa" | "Paket" | "Gel-Al";
export type PaymentMethod = "cash" | "card" | "meal_card" | "mixed" | "internal";
export type DiscountType = "none" | "percent" | "amount";

export type CartItem = MenuItem & {
  lineId: string;
  quantity: number;
  portionType: PortionType;
  unitPrice: number;
  displayPortion: string | null;
  weightGrams: number | null;
};

export type OpenOrder = {
  id: number;
  table_id: number | null;
  total: number;
};
