import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManageUsers } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TicketsList } from "@/components/tickets/tickets-list";

export default async function TicketsPage() {
  const profile = await requireProfile();
  const access = can(profile.role, "tickets");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: tickets }, { data: customers }, { data: staff }, { data: sales }] = await Promise.all([
    supabase
      .from("tickets")
      .select("*, customers(id, name), assignee:profiles!tickets_assigned_to_fkey(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("status", "active").order("name"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
    supabase.from("sales").select("id, sale_no, customer_id").order("issue_date", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Tickets</h2>
        <p className="mt-1 text-sm text-slate-500">Support requests from customers, from open to closed.</p>
      </div>

      <TicketsList
        tickets={tickets ?? []}
        customers={customers ?? []}
        staff={staff ?? []}
        sales={sales ?? []}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
      />
    </div>
  );
}
