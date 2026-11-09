import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { QuotationsList } from "@/components/quotations/quotations-list";

export default async function QuotationsPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "quotations");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: quotations }, { data: settings }] = await Promise.all([
    supabase
      .from("quotations")
      .select("*, customers(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Quotations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Build quotations from your catalog and track them through to acceptance.
          </p>
        </div>
      </div>

      <QuotationsList
        quotations={quotations ?? []}
        canCreate={access === true}
        currency={settings?.currency ?? "LKR"}
      />
    </div>
  );
}
