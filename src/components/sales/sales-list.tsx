"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SaleStatusBadge, PaymentStatusBadge, type SaleStatus, type PaymentStatus } from "@/components/sales/status-badges";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type Sale = {
  id: string;
  sale_no: string;
  status: SaleStatus;
  payment_status: PaymentStatus;
  issue_date: string;
  total: number;
  amount_paid: number;
  total_returned: number;
  customers: { id: string; name: string } | null;
};

const TABS: { key: "all" | SaleStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
];

export function SalesList({
  sales,
  canCreate,
  currency,
}: {
  sales: Sale[];
  canCreate: boolean;
  currency: string;
}) {
  const [tab, setTab] = useState<"all" | SaleStatus>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (tab !== "all" && s.status !== tab) return false;
      if (!q) return true;
      return s.sale_no.toLowerCase().includes(q) || s.customers?.name.toLowerCase().includes(q);
    });
  }, [sales, tab, query]);

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
            placeholder="Search invoice # or customer…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canCreate && (
          <Link
            href="/sales/new"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={16} /> New sale
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={sales.length === 0 ? "No sales yet" : "No matches"}
          description={
            sales.length === 0
              ? "Create a standalone sale, or convert an accepted quotation."
              : "Try a different search or tab."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Balance due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const balance = s.total - s.total_returned - s.amount_paid;
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-brand-700">
                      <Link href={`/sales/${s.id}`}>{s.sale_no}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.customers?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(s.issue_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{formatCurrency(s.total, currency)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.status === "cancelled" ? "—" : formatCurrency(Math.max(balance, 0), currency)}
                    </td>
                    <td className="px-4 py-3">
                      <SaleStatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      {s.status !== "cancelled" && <PaymentStatusBadge status={s.payment_status} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
