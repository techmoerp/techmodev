"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { canManageUsers, isSuperAdmin, type AppRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

async function requireManager() {
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

  if (!profile || !canManageUsers(profile.role as AppRole)) {
    throw new Error("You don't have permission to manage users.");
  }
  return profile.role as AppRole;
}

export async function inviteUser(input: {
  fullName: string;
  email: string;
  role: AppRole;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const managerRole = await requireManager();

    // Only a Super Admin may create another admin/super_admin account.
    if ((input.role === "admin" || input.role === "super_admin") && managerRole !== "super_admin") {
      return { success: false, error: "Only a Super Admin can assign admin-level roles." };
    }

    const admin = createServiceRoleClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: `${appUrl}/auth/callback?next=/auth/set-password`,
      data: {
        full_name: input.fullName,
        role: input.role,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateUserRole(userId: string, role: AppRole) {
  try {
    const managerRole = await requireManager();

    if ((role === "admin" || role === "super_admin") && managerRole !== "super_admin") {
      return { success: false, error: "Only a Super Admin can assign admin-level roles." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function updateUserStatus(userId: string, status: "active" | "inactive") {
  try {
    await requireManager();

    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteUser(userId: string) {
  try {
    const managerRole = await requireManager();
    if (!isSuperAdmin(managerRole)) {
      return { success: false, error: "Only a Super Admin can remove a user." };
    }

    const admin = createServiceRoleClient();
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
