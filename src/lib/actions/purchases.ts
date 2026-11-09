"use server";

import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !canManageUsers(profile.role)) {
    throw new Error("Only an admin can delete a purchase order.");
  }
  return supabase;
}

export type PurchaseItemInput = {
  catalog_item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

export type PurchaseOrderInput = {
  supplier_id: string;
  order_date: string;
  expected_date: string | null;
  discount_type: "none" | "percentage" | "fixed";
  discount_value: number;
  tax_percent: number;
  notes: string;
  terms: string;
  items: PurchaseItemInput[];
};

export async function savePurchaseOrder(id: string | null, input: PurchaseOrderInput) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_purchase_order", {
      p_id: id,
      p_supplier_id: input.supplier_id,
      p_order_date: input.order_date,
      p_expected_date: input.expected_date,
      p_discount_type: input.discount_type,
      p_discount_value: input.discount_value,
      p_tax_percent: input.tax_percent,
      p_notes: input.notes,
      p_terms: input.terms,
      p_items: input.items,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/purchases");
    revalidatePath(`/purchases/${data}`);
    return { success: true, id: data as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function setPurchaseOrderStatus(id: string, status: "ordered" | "received" | "cancelled") {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_purchase_order_status", { p_id: id, p_status: status });
    if (error) return { success: false, error: error.message };

    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/inventory");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deletePurchaseOrder(id: string) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/purchases");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
