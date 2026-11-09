import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { PurchasesList } from "@/components/purchases/purchases-list";

export default async function PurchasesPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "purchases");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: orders }, { data: settings }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("*, suppliers(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Purchases</h2>
          <p className="mt-1 text-sm text-slate-500">
            Purchase orders to your suppliers. Receiving one adds stock automatically.
          </p>
        </div>
      </div>

      <PurchasesList orders={orders ?? []} canCreate={access === true} currency={settings?.currency ?? "LKR"} />
    </div>
  );
}
