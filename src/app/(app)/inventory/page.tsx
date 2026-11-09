import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManage } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { InventoryList } from "@/components/inventory/inventory-list";

export default async function InventoryPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "inventory");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: items }, { data: settings }] = await Promise.all([
    supabase
      .from("catalog_items")
      .select("*, catalog_categories(id, name), stock_levels(quantity_on_hand)")
      .eq("kind", "product")
      .eq("track_inventory", true)
      .order("name"),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Inventory</h2>
        <p className="mt-1 text-sm text-slate-500">
          Stock on hand for every catalog product marked as tracked.
        </p>
      </div>

      <InventoryList items={items ?? []} canAdjust={canManage(profile.role, "inventory")} currency={settings?.currency ?? "LKR"} />
    </div>
  );
}
