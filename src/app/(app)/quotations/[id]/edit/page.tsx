import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canManage } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { QuotationBuilder } from "@/components/quotations/quotation-builder";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  if (!canManage(profile.role, "quotations")) redirect(`/quotations/${id}`);

  const supabase = await createClient();
  const [
    { data: quotation, error: quotationError },
    { data: items },
    { data: customers },
    { data: catalogItems },
    { data: settings },
  ] = await Promise.all([
      supabase.from("quotations").select("*, customers(name)").eq("id", id).single(),
      supabase
        .from("quotation_items")
        .select("*, catalog_items(name, kind, unit, unit_price, sku)")
        .eq("quotation_id", id)
        .order("sort_order"),
      supabase.from("customers").select("id, name").eq("status", "active").order("name"),
      supabase
        .from("catalog_items")
        .select("id, name, kind, unit, unit_price, sku")
        .eq("status", "active")
        .order("name"),
      supabase.from("company_settings").select("currency").eq("id", 1).single(),
    ]);

  // A genuine database/query error is a different problem from "this
  // quotation doesn't exist" and must not be silently shown as a 404.
  if (quotationError && quotationError.code !== "PGRST116") {
    throw new Error(`Failed to load quotation: ${quotationError.message}`);
  }
  if (!quotation) notFound();
  if (quotation.status !== "draft" && quotation.status !== "sent") {
    redirect(`/quotations/${id}`);
  }

  // A customer or catalog item referenced by this quotation may since have
  // been deactivated — include it anyway so the dropdown still shows what's
  // actually on the document instead of silently appearing blank.
  const customerOptions = customers ?? [];
  const resolvedCustomers = customerOptions.some((c) => c.id === quotation.customer_id)
    ? customerOptions
    : [{ id: quotation.customer_id, name: quotation.customers?.name ?? "(inactive customer)" }, ...customerOptions];

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
        <h2 className="text-xl font-semibold text-slate-900">Edit {quotation.quotation_no}</h2>
        <p className="mt-1 text-sm text-slate-500">Changes recalculate the totals automatically.</p>
      </div>

      <QuotationBuilder
        quotationId={id}
        customers={resolvedCustomers}
        catalogItems={resolvedCatalogItems}
        currency={settings?.currency ?? "LKR"}
        canManageCustomers={canManage(profile.role, "customers")}
        canManageCatalog={canManage(profile.role, "catalog")}
        initial={{
          customer_id: quotation.customer_id,
          issue_date: quotation.issue_date,
          valid_until: quotation.valid_until,
          discount_type: quotation.discount_type,
          discount_value: quotation.discount_value,
          tax_percent: quotation.tax_percent,
          notes: quotation.notes ?? "",
          terms: quotation.terms ?? "",
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
