import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { CatalogTable } from "@/components/catalog/catalog-table";

export default async function CatalogPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "catalog");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: items }, { data: categories }, { data: settings }] = await Promise.all([
    supabase.from("catalog_items").select("*, catalog_categories(id, name)").order("created_at", { ascending: false }),
    supabase.from("catalog_categories").select("*").order("name"),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Product &amp; Service Catalog</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everything Techmo sells — hardware products and service offerings — in one price list.
        </p>
      </div>

      <CatalogTable
        items={items ?? []}
        categories={categories ?? []}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
        currency={settings?.currency ?? "LKR"}
      />
    </div>
  );
}
