import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManage } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { InventoryItemDetail } from "@/components/inventory/item-detail";

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const access = can(profile.role, "inventory");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: item, error: itemError }, { data: stockLevel }, { data: movements }, { data: settings }] =
    await Promise.all([
      supabase.from("catalog_items").select("*, catalog_categories(id, name)").eq("id", id).single(),
      supabase.from("stock_levels").select("quantity_on_hand").eq("catalog_item_id", id).maybeSingle(),
      supabase.from("stock_movements").select("*").eq("catalog_item_id", id).order("created_at", { ascending: false }),
      supabase.from("company_settings").select("currency").eq("id", 1).single(),
    ]);

  // A genuine database/query error is a different problem from "this item
  // doesn't exist" and must not be silently shown as a 404.
  if (itemError && itemError.code !== "PGRST116") {
    throw new Error(`Failed to load catalog item: ${itemError.message}`);
  }
  if (!item) notFound();

  const currency = settings?.currency ?? "LKR";
  const qty = stockLevel?.quantity_on_hand ?? 0;
  const status = qty <= 0 ? "out" : qty <= item.reorder_level ? "low" : "ok";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-xs text-slate-400">{item.sku}</p>
        <h2 className="text-xl font-semibold text-slate-900">{item.name}</h2>
        <p className="mt-1 text-sm text-slate-500">{item.catalog_categories?.name ?? "Uncategorized"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="On hand" value={`${qty} ${item.unit}`} />
        <StatBlock label="Reorder level" value={`${item.reorder_level} ${item.unit}`} />
        <StatBlock label="Unit price" value={formatCurrency(item.unit_price, currency)} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Status</p>
          <div className="mt-1.5">
            {status === "out" && <Badge color="rose">Out of stock</Badge>}
            {status === "low" && <Badge color="amber">Low stock</Badge>}
            {status === "ok" && <Badge color="emerald">In stock</Badge>}
          </div>
        </div>
      </div>

      <InventoryItemDetail
        catalogItemId={id}
        currentQty={qty}
        unit={item.unit}
        canAdjust={canManage(profile.role, "inventory")}
        movements={movements ?? []}
      />
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
