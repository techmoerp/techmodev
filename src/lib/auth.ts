import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/permissions";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: AppRole;
  avatar_url: string | null;
  status: "active" | "inactive";
  created_at: string;
};

// Call at the top of any protected server component / layout.
// Returns the signed-in user's profile, or redirects to /login.
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return profile as Profile;
}
