import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const profile = await requireProfile();

  if (!canManageUsers(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Company Settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          This information appears on quotations, invoices, and other documents.
        </p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
