import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManageUsers } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { TicketStatusBadge, TicketPriorityBadge } from "@/components/tickets/status-badge";
import { TicketDetail } from "@/components/tickets/ticket-detail";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const access = can(profile.role, "tickets");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: ticket, error: ticketError }, { data: comments }, { data: customers }, { data: staff }, { data: sales }] =
    await Promise.all([
      supabase
        .from("tickets")
        .select("*, customers(id, name, email, phone), assignee:profiles!tickets_assigned_to_fkey(id, full_name), related_sale:sales(id, sale_no)")
        .eq("id", id)
        .single(),
      supabase
        .from("ticket_comments")
        .select("*, author:profiles(id, full_name)")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("customers").select("id, name").eq("status", "active").order("name"),
      supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
      supabase.from("sales").select("id, sale_no, customer_id").order("issue_date", { ascending: false }),
    ]);

  // A genuine database/query error is a different problem from "this
  // ticket doesn't exist" and must not be silently shown as a 404.
  if (ticketError && ticketError.code !== "PGRST116") {
    throw new Error(`Failed to load ticket: ${ticketError.message}`);
  }
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{ticket.ticket_no}</p>
          <h2 className="text-xl font-semibold text-slate-900">{ticket.subject}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {ticket.customers?.name} · Opened {formatDate(ticket.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <TicketDetail
        ticket={ticket}
        comments={comments ?? []}
        customers={customers ?? []}
        staff={staff ?? []}
        sales={sales ?? []}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
      />
    </div>
  );
}
