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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !canManageUsers(profile.role)) {
    throw new Error("You don't have permission to change company settings.");
  }
}

export type CompanySettingsInput = {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  currency: string;
  tax_id: string;
  quotation_prefix: string;
  invoice_prefix: string;
  purchase_prefix: string;
  logo_url?: string;
};

export async function updateCompanySettings(input: CompanySettingsInput) {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("company_settings")
      .update(input)
      .eq("id", 1);

    if (error) return { success: false, error: error.message };

    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function uploadCompanyLogo(formData: FormData) {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file provided." };

    const ext = file.name.split(".").pop();
    const path = `logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("public-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) return { success: false, error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from("public-assets").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("company_settings")
      .update({ logo_url: publicUrl })
      .eq("id", 1);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/settings");
    return { success: true, url: publicUrl };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
