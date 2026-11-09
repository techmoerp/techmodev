"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createStockAdjustment(input: {
  catalog_item_id: string;
  change_qty: number;
  reason: string;
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_stock_adjustment", {
      p_catalog_item_id: input.catalog_item_id,
      p_change_qty: input.change_qty,
      p_reason: input.reason || null,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${input.catalog_item_id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
