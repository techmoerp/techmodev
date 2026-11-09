"use server";

import { createClient } from "@/lib/supabase/server";
import { canManage, canManageUsers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type CustomerInput = {
  name: string;
  customer_type: "individual" | "business";
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  notes: string;
};

async function requireManageAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !canManage(profile.role, "customers")) {
    throw new Error("You don't have permission to manage customers.");
  }
  return { supabase, userId: user.id, role: profile.role };
}

export async function createCustomer(input: CustomerInput) {
  try {
    const { supabase, userId } = await requireManageAccess();
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...input, created_by: userId })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/customers");
    return { success: true, customer: data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateCustomer(id: string, input: CustomerInput) {
  try {
    const { supabase } = await requireManageAccess();
    const { error } = await supabase.from("customers").update(input).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function toggleCustomerStatus(id: string, status: "active" | "inactive") {
  try {
    const { supabase } = await requireManageAccess();
    const { error } = await supabase.from("customers").update({ status }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteCustomer(id: string) {
  try {
    const { supabase, role } = await requireManageAccess();
    if (!canManageUsers(role)) {
      return { success: false, error: "Only an admin can delete a customer." };
    }
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
