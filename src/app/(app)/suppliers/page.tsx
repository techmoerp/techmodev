import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";

export default async function SuppliersPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "suppliers");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Suppliers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Vendors Techmo buys hardware and stock from.
        </p>
      </div>

      <SuppliersTable
        suppliers={suppliers ?? []}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
      />
    </div>
  );
}
