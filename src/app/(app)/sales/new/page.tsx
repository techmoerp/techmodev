import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SaleBuilder } from "@/components/sales/sale-builder";

export default async function NewSalePage() {
  const profile = await requireProfile();
  if (!canManage(profile.role, "sales")) redirect("/sales");

  const supabase = await createClient();
  const [{ data: customers }, { data: catalogItems }, { data: settings }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("status", "active").order("name"),
    supabase
      .from("catalog_items")
      .select("id, name, kind, unit, unit_price, sku")
      .eq("status", "active")
      .order("name"),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">New Sale</h2>
        <p className="mt-1 text-sm text-slate-500">A standalone invoice, not linked to a quotation.</p>
      </div>

      <SaleBuilder
        saleId={null}
        customers={customers ?? []}
        catalogItems={catalogItems ?? []}
        currency={settings?.currency ?? "LKR"}
        canManageCustomers={canManage(profile.role, "customers")}
        canManageCatalog={canManage(profile.role, "catalog")}
      />
    </div>
  );
}
