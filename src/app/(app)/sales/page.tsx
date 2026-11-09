import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SalesList } from "@/components/sales/sales-list";

export default async function SalesPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "sales");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: sales }, { data: settings }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, customers(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Sales &amp; Invoicing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Invoices for products and services, with payments tracked against each one.
          </p>
        </div>
      </div>

      <SalesList sales={sales ?? []} canCreate={access === true} currency={settings?.currency ?? "LKR"} />
    </div>
  );
}
