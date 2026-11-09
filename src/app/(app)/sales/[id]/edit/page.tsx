import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { SaleBuilder } from "@/components/sales/sale-builder";

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  if (!canManage(profile.role, "sales")) redirect(`/sales/${id}`);

  const supabase = await createClient();
  const [
    { data: sale, error: saleError },
    { data: items },
    { data: customers },
    { data: catalogItems },
    { data: settings },
  ] = await Promise.all([
      supabase.from("sales").select("*, customers(name)").eq("id", id).single(),
      supabase
        .from("sale_items")
        .select("*, catalog_items(name, kind, unit, unit_price, sku)")
        .eq("sale_id", id)
        .order("sort_order"),
      supabase.from("customers").select("id, name").eq("status", "active").order("name"),
      supabase
        .from("catalog_items")
        .select("id, name, kind, unit, unit_price, sku")
        .eq("status", "active")
        .order("name"),
      supabase.from("company_settings").select("currency").eq("id", 1).single(),
    ]);

  // A genuine database/query error is a different problem from "this sale
  // doesn't exist" and must not be silently shown as a 404.
  if (saleError && saleError.code !== "PGRST116") {
    throw new Error(`Failed to load sale: ${saleError.message}`);
  }
  if (!sale) notFound();
  if (sale.status !== "draft") {
    redirect(`/sales/${id}`);
  }

  // A customer or catalog item referenced by this sale may since have been
  // deactivated — include it anyway so the dropdown still shows what's
  // actually on the document instead of silently appearing blank.
  const customerOptions = customers ?? [];
  const resolvedCustomers = customerOptions.some((c) => c.id === sale.customer_id)
    ? customerOptions
    : [{ id: sale.customer_id, name: sale.customers?.name ?? "(inactive customer)" }, ...customerOptions];

  const catalogOptions = catalogItems ?? [];
  const extraCatalogItems = (items ?? [])
    .filter((i) => i.catalog_item_id && !catalogOptions.some((c) => c.id === i.catalog_item_id))
    .map((i) => ({
      id: i.catalog_item_id as string,
      name: i.catalog_items?.name ?? i.description,
      kind: (i.catalog_items?.kind as "product" | "service") ?? "product",
      unit: i.catalog_items?.unit ?? i.unit,
      unit_price: i.catalog_items?.unit_price ?? i.unit_price,
      sku: i.catalog_items?.sku ?? null,
    }));
  const resolvedCatalogItems = [...catalogOptions, ...extraCatalogItems];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Edit {sale.sale_no}</h2>
        <p className="mt-1 text-sm text-slate-500">Changes recalculate the totals automatically.</p>
      </div>

      <SaleBuilder
        saleId={id}
        customers={resolvedCustomers}
        catalogItems={resolvedCatalogItems}
        currency={settings?.currency ?? "LKR"}
        canManageCustomers={canManage(profile.role, "customers")}
        canManageCatalog={canManage(profile.role, "catalog")}
        initial={{
          customer_id: sale.customer_id,
          issue_date: sale.issue_date,
          due_date: sale.due_date,
          discount_type: sale.discount_type,
          discount_value: sale.discount_value,
          tax_percent: sale.tax_percent,
          notes: sale.notes ?? "",
          terms: sale.terms ?? "",
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
