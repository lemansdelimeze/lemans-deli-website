import { supabase } from "../supabase";

type ApplyRecipeStockResult = {
  ok: boolean;
  already_processed: boolean;
  movement_count: number;
};

export async function applyOrderRecipeStock(
  orderId: number
): Promise<ApplyRecipeStockResult> {
  const { data, error } = await supabase.rpc(
    "apply_order_recipe_stock",
    { p_order_id: orderId }
  );

  if (error) {
    throw new Error(
      `Reçete stokları düşürülemedi: ${error.message}`
    );
  }

  return data as ApplyRecipeStockResult;
}