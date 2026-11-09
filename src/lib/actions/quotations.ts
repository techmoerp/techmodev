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
    throw new Error("Only an admin can delete a quotation.");
  }
  return supabase;
}

export type QuotationItemInput = {
  catalog_item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

export type QuotationInput = {
  customer_id: string;
  issue_date: string;
  valid_until: string | null;
  discount_type: "none" | "percentage" | "fixed";
  discount_value: number;
  tax_percent: number;
  notes: string;
  terms: string;
  items: QuotationItemInput[];
};

export async function saveQuotation(id: string | null, input: QuotationInput) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_quotation", {
      p_id: id,
      p_customer_id: input.customer_id,
      p_issue_date: input.issue_date,
      p_valid_until: input.valid_until,
      p_discount_type: input.discount_type,
      p_discount_value: input.discount_value,
      p_tax_percent: input.tax_percent,
      p_notes: input.notes,
      p_terms: input.terms,
      p_items: input.items,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${data}`);
    return { success: true, id: data as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function setQuotationStatus(
  id: string,
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_quotation_status", { p_id: id, p_status: status });
    if (error) return { success: false, error: error.message };

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteQuotation(id: string) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("quotations").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/quotations");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
