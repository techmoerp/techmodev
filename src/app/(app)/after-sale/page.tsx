import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AfterSaleTable } from "@/components/after-sale/after-sale-table";

export default async function AfterSalePage() {
  const profile = await requireProfile();
  const access = can(profile.role, "tickets");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: records }, { data: customers }, { data: sales }, { data: catalogItems }, { data: settings }] =
    await Promise.all([
      supabase
        .from("after_sale_records")
        .select("*, customers(id, name), sale:sales(id, sale_no), catalog_items(id, name)")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").eq("status", "active").order("name"),
      supabase.from("sales").select("id, sale_no, customer_id").order("issue_date", { ascending: false }),
      supabase.from("catalog_items").select("id, name").eq("status", "active").order("name"),
      supabase.from("company_settings").select("currency").eq("id", 1).single(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">After-Sale Records</h2>
        <p className="mt-1 text-sm text-slate-500">
          Warranty repairs, replacements, and other adjustments logged after a sale.
        </p>
      </div>

      <AfterSaleTable
        records={records ?? []}
        customers={customers ?? []}
        sales={sales ?? []}
        catalogItems={catalogItems ?? []}
        currency={settings?.currency ?? "LKR"}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
      />
    </div>
  );
}
