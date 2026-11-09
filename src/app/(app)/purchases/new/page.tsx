import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { PurchaseBuilder } from "@/components/purchases/purchase-builder";

export default async function NewPurchaseOrderPage() {
  const profile = await requireProfile();
  if (!canManage(profile.role, "purchases")) redirect("/purchases");

  const supabase = await createClient();
  const [{ data: suppliers }, { data: catalogItems }, { data: settings }] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("status", "active").order("name"),
    supabase
      .from("catalog_items")
      .select("id, name, unit, unit_price, cost_price, sku")
      .eq("status", "active")
      .eq("kind", "product")
      .order("name"),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">New Purchase Order</h2>
        <p className="mt-1 text-sm text-slate-500">Receiving this later will add the quantities to stock.</p>
      </div>

      <PurchaseBuilder
        purchaseOrderId={null}
        suppliers={suppliers ?? []}
        catalogItems={catalogItems ?? []}
        currency={settings?.currency ?? "LKR"}
        canManageSuppliers={canManage(profile.role, "suppliers")}
        canManageCatalog={canManage(profile.role, "catalog")}
      />
    </div>
  );
}
