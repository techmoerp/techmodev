import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { CustomersTable } from "@/components/customers/customers-table";

export default async function CustomersPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "customers");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Customers</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everyone who buys products or services from Techmo.
        </p>
      </div>

      <CustomersTable
        customers={customers ?? []}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
      />
    </div>
  );
}
