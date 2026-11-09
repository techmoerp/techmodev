"use server";

import { createClient } from "@/lib/supabase/server";
import { canManage, canManageUsers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type SupplierInput = {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  payment_terms: string;
  notes: string;
};

async function requireManageAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !canManage(profile.role, "suppliers")) {
    throw new Error("You don't have permission to manage suppliers.");
  }
  return { supabase, userId: user.id, role: profile.role };
}

export async function createSupplier(input: SupplierInput) {
  try {
    const { supabase, userId } = await requireManageAccess();
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ ...input, created_by: userId })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/suppliers");
    return { success: true, supplier: data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateSupplier(id: string, input: SupplierInput) {
  try {
    const { supabase } = await requireManageAccess();
    const { error } = await supabase.from("suppliers").update(input).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/suppliers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function toggleSupplierStatus(id: string, status: "active" | "inactive") {
  try {
    const { supabase } = await requireManageAccess();
    const { error } = await supabase.from("suppliers").update({ status }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/suppliers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteSupplier(id: string) {
  try {
    const { supabase, role } = await requireManageAccess();
    if (!canManageUsers(role)) {
      return { success: false, error: "Only an admin can delete a supplier." };
    }
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/suppliers");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
