"use server";

import { createClient } from "@/lib/supabase/server";
import { canManage, canManageUsers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type CatalogItemInput = {
  name: string;
  kind: "product" | "service";
  category_id: string | null;
  unit: string;
  unit_price: number;
  cost_price: number | null;
  track_inventory: boolean;
  reorder_level: number;
  description: string;
};

async function requireManageAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !canManage(profile.role, "catalog")) {
    throw new Error("You don't have permission to manage the catalog.");
  }
  return { supabase, userId: user.id, role: profile.role };
}

export async function createCatalogItem(input: CatalogItemInput) {
  try {
    const { supabase, userId } = await requireManageAccess();
    const payload = {
      ...input,
      track_inventory: input.kind === "product" ? input.track_inventory : false,
      created_by: userId,
    };
    const { data, error } = await supabase.from("catalog_items").insert(payload).select().single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/catalog");
    return { success: true, item: data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateCatalogItem(id: string, input: CatalogItemInput) {
  try {
    const { supabase } = await requireManageAccess();
    const payload = {
      ...input,
      track_inventory: input.kind === "product" ? input.track_inventory : false,
    };
    const { error } = await supabase.from("catalog_items").update(payload).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/catalog");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function toggleCatalogItemStatus(id: string, status: "active" | "inactive") {
  try {
    const { supabase } = await requireManageAccess();
    const { error } = await supabase.from("catalog_items").update({ status }).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/catalog");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteCatalogItem(id: string) {
  try {
    const { supabase, role } = await requireManageAccess();
    if (!canManageUsers(role)) {
      return { success: false, error: "Only an admin can delete a catalog item." };
    }
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/catalog");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function createCategory(name: string, kind: "product" | "service") {
  try {
    const { supabase } = await requireManageAccess();
    const { data, error } = await supabase
      .from("catalog_categories")
      .insert({ name, kind })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    revalidatePath("/catalog");
    return { success: true, category: data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
