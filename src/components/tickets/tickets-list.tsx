"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Ticket as TicketIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, cn } from "@/lib/utils";
import { saveTicket, type TicketInput } from "@/lib/actions/tickets";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type TicketStatus,
} from "@/components/tickets/status-badge";

type Ticket = {
  id: string;
  ticket_no: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: TicketStatus;
  created_at: string;
  customers: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

type Option = { id: string; name?: string; full_name?: string };
type SaleOption = { id: string; sale_no: string; customer_id: string };

const TABS: ("all" | TicketStatus)[] = ["all", ...TICKET_STATUSES];

export function TicketsList({
  tickets,
  customers,
  staff,
  sales,
  canManage,
  canDelete,
}: {
  tickets: Ticket[];
  customers: Option[];
  staff: Option[];
  sales: SaleOption[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const [tab, setTab] = useState<"all" | TicketStatus>("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = tickets;
    if (tab !== "all") list = list.filter((t) => t.status === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.ticket_no.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.customers?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, tab, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              tab === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {s === "all" ? "All" : TICKET_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ticket #, subject, customer…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus size={16} /> New ticket
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={tickets.length === 0 ? "No tickets yet" : "No matches"}
          description={
            tickets.length === 0 ? "Log your first support ticket to get started." : "Try a different filter or search term."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">
                      {t.ticket_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="font-medium text-slate-800 hover:underline">
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.customers?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <TicketPriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.assignee?.full_name ?? "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <TicketModal customers={customers} staff={staff} sales={sales} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function TicketModal({
  customers,
  staff,
  sales,
  onClose,
}: {
  customers: Option[];
  staff: Option[];
  sales: SaleOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<TicketInput>({
    customer_id: customers[0]?.id ?? "",
    subject: "",
    description: "",
    category: "other",
    priority: "medium",
    assigned_to: null,
    related_sale_id: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TicketInput>(key: K, value: TicketInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const relevantSales = sales.filter((s) => s.customer_id === form.customer_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await saveTicket(null, form);
    setSaving(false);

    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    router.refresh();
    if (res.id) router.push(`/tickets/${res.id}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <form onSubmit={handleSubmit}>
          <h3 className="mb-4 text-base font-semibold text-slate-900">New ticket</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
              <select
                required
                value={form.customer_id}
                onChange={(e) => update("customer_id", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="" disabled>
                  Select a customer…
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject</label>
              <input
                required
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => update("category", e.target.value as TicketInput["category"])}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="billing">Billing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => update("priority", e.target.value as TicketInput["priority"])}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Assign to</label>
                <select
                  value={form.assigned_to ?? ""}
                  onChange={(e) => update("assigned_to", e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Related sale</label>
                <select
                  value={form.related_sale_id ?? ""}
                  onChange={(e) => update("related_sale_id", e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">None</option>
                  {relevantSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sale_no}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create ticket"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
