"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AfterSaleInput = {
  customer_id: string;
  sale_id: string | null;
  catalog_item_id: string | null;
  record_type: "warranty_repair" | "replacement" | "refund_adjustment" | "other";
  description: string;
  cost: number;
};

export async function saveAfterSaleRecord(id: string | null, input: AfterSaleInput) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_after_sale_record", {
      p_id: id,
      p_customer_id: input.customer_id,
      p_sale_id: input.sale_id,
      p_catalog_item_id: input.catalog_item_id,
      p_record_type: input.record_type,
      p_description: input.description,
      p_cost: input.cost,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath("/after-sale");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function setAfterSaleStatus(id: string, status: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_after_sale_status", { p_id: id, p_status: status });
    if (error) return { success: false, error: error.message };
    revalidatePath("/after-sale");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteAfterSaleRecord(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_after_sale_record", { p_id: id });
    if (error) return { success: false, error: error.message };
    revalidatePath("/after-sale");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
