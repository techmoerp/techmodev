"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Send } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { saveTicket, setTicketStatus, addTicketComment, deleteTicket, type TicketInput } from "@/lib/actions/tickets";
import { TICKET_STATUSES, TICKET_STATUS_LABELS, type TicketStatus } from "@/components/tickets/status-badge";

type Option = { id: string; name?: string; full_name?: string };
type SaleOption = { id: string; sale_no: string; customer_id: string };

type Comment = {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author: { id: string; full_name: string } | null;
};

type Ticket = {
  id: string;
  customer_id: string;
  subject: string;
  description: string | null;
  category: "hardware" | "software" | "billing" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: TicketStatus;
  assigned_to: string | null;
  related_sale_id: string | null;
  customers: { id: string; name: string; email: string | null; phone: string | null } | null;
  assignee: { id: string; full_name: string } | null;
  related_sale: { id: string; sale_no: string } | null;
};

const CATEGORY_LABELS: Record<Ticket["category"], string> = {
  hardware: "Hardware",
  software: "Software",
  billing: "Billing",
  other: "Other",
};

export function TicketDetail({
  ticket,
  comments,
  customers,
  staff,
  sales,
  canManage,
  canDelete,
}: {
  ticket: Ticket;
  comments: Comment[];
  customers: Option[];
  staff: Option[];
  sales: SaleOption[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [posting, setPosting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  async function handleStatusChange(status: TicketStatus) {
    if (status === ticket.status) return;
    setChangingStatus(true);
    const res = await setTicketStatus(ticket.id, status);
    setChangingStatus(false);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    const res = await addTicketComment(ticket.id, commentBody.trim(), isInternal);
    setPosting(false);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setCommentBody("");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete ticket "${ticket.subject}"? This cannot be undone.`)) return;
    const res = await deleteTicket(ticket.id);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.push("/tickets");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">Ticket details</h3>
          {canManage && ticket.status !== "closed" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={13} /> Edit
              </button>
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Row label="Category" value={CATEGORY_LABELS[ticket.category]} />
          <Row label="Assigned to" value={ticket.assignee?.full_name ?? "Unassigned"} />
          <Row label="Customer" value={ticket.customers?.name ?? "—"} />
          <Row label="Related sale" value={ticket.related_sale?.sale_no ?? "—"} />
          <Row label="Contact" value={ticket.customers?.email || ticket.customers?.phone || "—"} />
        </div>
        {ticket.description && (
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {ticket.description}
          </p>
        )}

        {canManage && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-medium text-slate-500">Change status</p>
            <div className="flex flex-wrap gap-1.5">
              {TICKET_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={changingStatus || s === ticket.status}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed",
                    s === ticket.status
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {TICKET_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800">Activity &amp; updates</h3>
        </div>
        {comments.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No updates yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {comments.map((c) => (
              <div key={c.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{c.author?.full_name ?? "Staff"}</p>
                  <p className="text-xs text-slate-400">{formatDate(c.created_at)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{c.body}</p>
                {c.is_internal && (
                  <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Internal note
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && ticket.status !== "closed" && (
          <form onSubmit={handleComment} className="border-t border-slate-100 p-5">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              placeholder="Add an update or internal note…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Internal note (not visible to customer)
              </label>
              <button
                type="submit"
                disabled={posting || !commentBody.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Send size={14} /> {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        )}
      </div>

      {editOpen && (
        <EditTicketModal ticket={ticket} customers={customers} staff={staff} sales={sales} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function EditTicketModal({
  ticket,
  customers,
  staff,
  sales,
  onClose,
}: {
  ticket: Ticket;
  customers: Option[];
  staff: Option[];
  sales: SaleOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<TicketInput>({
    customer_id: ticket.customer_id,
    subject: ticket.subject,
    description: ticket.description ?? "",
    category: ticket.category,
    priority: ticket.priority,
    assigned_to: ticket.assigned_to,
    related_sale_id: ticket.related_sale_id,
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
    const res = await saveTicket(ticket.id, form);
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <form onSubmit={handleSubmit}>
          <h3 className="mb-4 text-base font-semibold text-slate-900">Edit ticket</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
              <select
                required
                value={form.customer_id}
                onChange={(e) => update("customer_id", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
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
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
