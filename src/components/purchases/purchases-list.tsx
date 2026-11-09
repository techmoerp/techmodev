"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PurchaseOrderStatusBadge, type PurchaseOrderStatus } from "@/components/purchases/status-badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type PurchaseOrder = {
  id: string;
  po_no: string;
  status: PurchaseOrderStatus;
  order_date: string;
  expected_date: string | null;
  total: number;
  suppliers: { id: string; name: string } | null;
};

const TABS: { key: "all" | PurchaseOrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "ordered", label: "Ordered" },
  { key: "received", label: "Received" },
  { key: "cancelled", label: "Cancelled" },
];

export function PurchasesList({
  orders,
  canCreate,
  currency,
}: {
  orders: PurchaseOrder[];
  canCreate: boolean;
  currency: string;
}) {
  const [tab, setTab] = useState<"all" | PurchaseOrderStatus>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== "all" && o.status !== tab) return false;
      if (!q) return true;
      return o.po_no.toLowerCase().includes(q) || o.suppliers?.name.toLowerCase().includes(q);
    });
  }, [orders, tab, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              tab === t.key
                ? "bg-brand-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PO # or supplier…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canCreate && (
          <Link
            href="/purchases/new"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={16} /> New purchase order
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={orders.length === 0 ? "No purchase orders yet" : "No matches"}
          description={
            orders.length === 0
              ? "Create a purchase order to restock from a supplier."
              : "Try a different search or tab."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">PO #</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Order date</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-brand-700">
                    <Link href={`/purchases/${o.id}`}>{o.po_no}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{o.suppliers?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(o.order_date)}</td>
                  <td className="px-4 py-3 text-slate-500">{o.expected_date ? formatDate(o.expected_date) : "—"}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{formatCurrency(o.total, currency)}</td>
                  <td className="px-4 py-3">
                    <PurchaseOrderStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
