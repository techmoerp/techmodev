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
    throw new Error("Only an admin can delete a sale.");
  }
  return supabase;
}

export type SaleItemInput = {
  catalog_item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

export type SaleInput = {
  customer_id: string;
  issue_date: string;
  due_date: string | null;
  discount_type: "none" | "percentage" | "fixed";
  discount_value: number;
  tax_percent: number;
  notes: string;
  terms: string;
  items: SaleItemInput[];
};

export async function saveSale(id: string | null, input: SaleInput) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_sale", {
      p_id: id,
      p_customer_id: input.customer_id,
      p_issue_date: input.issue_date,
      p_due_date: input.due_date,
      p_discount_type: input.discount_type,
      p_discount_value: input.discount_value,
      p_tax_percent: input.tax_percent,
      p_notes: input.notes,
      p_terms: input.terms,
      p_items: input.items,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/sales");
    revalidatePath(`/sales/${data}`);
    return { success: true, id: data as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function setSaleStatus(id: string, status: "confirmed" | "cancelled") {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_sale_status", { p_id: id, p_status: status });
    if (error) return { success: false, error: error.message };

    revalidatePath("/sales");
    revalidatePath(`/sales/${id}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteSale(id: string) {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/sales");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function convertQuotationToSale(quotationId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("convert_quotation_to_sale", {
      p_quotation_id: quotationId,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/quotations");
    revalidatePath(`/quotations/${quotationId}`);
    revalidatePath("/sales");
    return { success: true, saleId: data as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function addSalePayment(input: {
  sale_id: string;
  amount: number;
  method: "cash" | "bank_transfer" | "card" | "cheque" | "other";
  paid_on: string;
  reference: string;
}) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_sale_payment", {
      p_sale_id: input.sale_id,
      p_amount: input.amount,
      p_method: input.method,
      p_paid_on: input.paid_on,
      p_reference: input.reference || null,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath(`/sales/${input.sale_id}`);
    revalidatePath("/sales");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function addSaleReturn(input: { sale_id: string; amount: number; reason: string }) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_sale_return", {
      p_sale_id: input.sale_id,
      p_amount: input.amount,
      p_reason: input.reason || null,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath(`/sales/${input.sale_id}`);
    revalidatePath("/sales");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
