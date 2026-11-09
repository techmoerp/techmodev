"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  saveAfterSaleRecord,
  setAfterSaleStatus,
  deleteAfterSaleRecord,
  type AfterSaleInput,
} from "@/lib/actions/after-sale";

type Record_ = {
  id: string;
  record_no: string;
  record_type: AfterSaleInput["record_type"];
  description: string;
  cost: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  customers: { id: string; name: string } | null;
  sale: { id: string; sale_no: string } | null;
  catalog_items: { id: string; name: string } | null;
};

type Option = { id: string; name: string };
type SaleOption = { id: string; sale_no: string; customer_id: string };

const TYPE_LABELS: Record<AfterSaleInput["record_type"], string> = {
  warranty_repair: "Warranty Repair",
  replacement: "Replacement",
  refund_adjustment: "Refund / Adjustment",
  other: "Other",
};

const STATUS_COLORS: Record<Record_["status"], "slate" | "brand" | "emerald" | "rose"> = {
  pending: "brand",
  in_progress: "slate",
  completed: "emerald",
  cancelled: "rose",
};

const STATUS_LABELS: Record<Record_["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const EMPTY_FORM: AfterSaleInput = {
  customer_id: "",
  sale_id: null,
  catalog_item_id: null,
  record_type: "warranty_repair",
  description: "",
  cost: 0,
};

export function AfterSaleTable({
  records,
  customers,
  sales,
  catalogItems,
  currency,
  canManage,
  canDelete,
}: {
  records: Record_[];
  customers: Option[];
  sales: SaleOption[];
  catalogItems: Option[];
  currency: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.record_no.toLowerCase().includes(q) ||
        r.customers?.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [records, query]);

  async function advanceStatus(r: Record_, status: Record_["status"]) {
    const res = await setAfterSaleStatus(r.id, status);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  async function handleDelete(r: Record_) {
    if (!confirm(`Delete record "${r.record_no}"? This cannot be undone.`)) return;
    const res = await deleteAfterSaleRecord(r.id);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus size={16} /> New record
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={records.length === 0 ? "No after-sale records yet" : "No matches"}
          description={
            records.length === 0
              ? "Log a warranty repair, replacement, or adjustment to get started."
              : "Try a different search term."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Record #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Item / Sale</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Logged</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.record_no}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.customers?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{TYPE_LABELS[r.record_type]}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.catalog_items?.name ?? "—"}
                    {r.sale && <span className="ml-1 text-xs text-slate-400">({r.sale.sale_no})</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(r.cost, currency)}</td>
                  <td className="px-4 py-3">
                    {canManage && r.status === "pending" && (
                      <div className="flex items-center gap-1.5">
                        <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                        <button
                          onClick={() => advanceStatus(r, "in_progress")}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Start
                        </button>
                      </div>
                    )}
                    {canManage && r.status === "in_progress" && (
                      <div className="flex items-center gap-1.5">
                        <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                        <button
                          onClick={() => advanceStatus(r, "completed")}
                          className="text-xs font-medium text-emerald-600 hover:underline"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => advanceStatus(r, "cancelled")}
                          className="text-xs font-medium text-rose-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {(!canManage || r.status === "completed" || r.status === "cancelled") && (
                      <Badge color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AfterSaleModal customers={customers} sales={sales} catalogItems={catalogItems} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function AfterSaleModal({
  customers,
  sales,
  catalogItems,
  onClose,
}: {
  customers: Option[];
  sales: SaleOption[];
  catalogItems: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AfterSaleInput>({ ...EMPTY_FORM, customer_id: customers[0]?.id ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof AfterSaleInput>(key: K, value: AfterSaleInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const relevantSales = sales.filter((s) => s.customer_id === form.customer_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await saveAfterSaleRecord(null, form);
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
          <h3 className="mb-4 text-base font-semibold text-slate-900">New after-sale record</h3>

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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Related sale</label>
                <select
                  value={form.sale_id ?? ""}
                  onChange={(e) => update("sale_id", e.target.value || null)}
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
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Product</label>
                <select
                  value={form.catalog_item_id ?? ""}
                  onChange={(e) => update("catalog_item_id", e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">None</option>
                  {catalogItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={form.record_type}
                  onChange={(e) => update("record_type", e.target.value as AfterSaleInput["record_type"])}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="warranty_repair">Warranty Repair</option>
                  <option value="replacement">Replacement</option>
                  <option value="refund_adjustment">Refund / Adjustment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => update("cost", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                required
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                placeholder="What happened and what was done…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
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
                {saving ? "Saving…" : "Create record"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
