import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { PurchaseBuilder } from "@/components/purchases/purchase-builder";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  if (!canManage(profile.role, "purchases")) redirect(`/purchases/${id}`);

  const supabase = await createClient();
  const [
    { data: order, error: orderError },
    { data: items },
    { data: suppliers },
    { data: catalogItems },
    { data: settings },
  ] = await Promise.all([
      supabase.from("purchase_orders").select("*, suppliers(name)").eq("id", id).single(),
      supabase
        .from("purchase_order_items")
        .select("*, catalog_items(name, unit, unit_price, cost_price, sku)")
        .eq("purchase_order_id", id)
        .order("sort_order"),
      supabase.from("suppliers").select("id, name").eq("status", "active").order("name"),
      supabase
        .from("catalog_items")
        .select("id, name, unit, unit_price, cost_price, sku")
        .eq("status", "active")
        .eq("kind", "product")
        .order("name"),
      supabase.from("company_settings").select("currency").eq("id", 1).single(),
    ]);

  // A genuine database/query error is a different problem from "this
  // purchase order doesn't exist" and must not be silently shown as a 404.
  if (orderError && orderError.code !== "PGRST116") {
    throw new Error(`Failed to load purchase order: ${orderError.message}`);
  }
  if (!order) notFound();
  if (order.status !== "draft") {
    redirect(`/purchases/${id}`);
  }

  // A supplier or catalog item referenced by this purchase order may since
  // have been deactivated — include it anyway so the dropdown still shows
  // what's actually on the document instead of silently appearing blank.
  const supplierOptions = suppliers ?? [];
  const resolvedSuppliers = supplierOptions.some((s) => s.id === order.supplier_id)
    ? supplierOptions
    : [{ id: order.supplier_id, name: order.suppliers?.name ?? "(inactive supplier)" }, ...supplierOptions];

  const catalogOptions = catalogItems ?? [];
  const extraCatalogItems = (items ?? [])
    .filter((i) => i.catalog_item_id && !catalogOptions.some((c) => c.id === i.catalog_item_id))
    .map((i) => ({
      id: i.catalog_item_id as string,
      name: i.catalog_items?.name ?? i.description,
      unit: i.catalog_items?.unit ?? i.unit,
      unit_price: i.catalog_items?.unit_price ?? i.unit_price,
      cost_price: i.catalog_items?.cost_price ?? null,
      sku: i.catalog_items?.sku ?? null,
    }));
  const resolvedCatalogItems = [...catalogOptions, ...extraCatalogItems];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Edit {order.po_no}</h2>
        <p className="mt-1 text-sm text-slate-500">Changes recalculate the totals automatically.</p>
      </div>

      <PurchaseBuilder
        purchaseOrderId={id}
        suppliers={resolvedSuppliers}
        catalogItems={resolvedCatalogItems}
        currency={settings?.currency ?? "LKR"}
        canManageSuppliers={canManage(profile.role, "suppliers")}
        canManageCatalog={canManage(profile.role, "catalog")}
        initial={{
          supplier_id: order.supplier_id,
          order_date: order.order_date,
          expected_date: order.expected_date,
          discount_type: order.discount_type,
          discount_value: order.discount_value,
          tax_percent: order.tax_percent,
          notes: order.notes ?? "",
          terms: order.terms ?? "",
          items: (items ?? []).map((i) => ({
            catalog_item_id: i.catalog_item_id,
            description: i.description,
            unit: i.unit,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }}
      />
    </div>
  );
}
