"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Plus, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { QuotationStatusBadge, type QuotationStatus } from "@/components/quotations/status-badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type Quotation = {
  id: string;
  quotation_no: string;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string | null;
  total: number;
  customers: { id: string; name: string } | null;
};

const TABS: { key: "all" | QuotationStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "expired", label: "Expired" },
];

export function QuotationsList({
  quotations,
  canCreate,
  currency,
}: {
  quotations: Quotation[];
  canCreate: boolean;
  currency: string;
}) {
  const [tab, setTab] = useState<"all" | QuotationStatus>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotations.filter((quo) => {
      if (tab !== "all" && quo.status !== tab) return false;
      if (!q) return true;
      return (
        quo.quotation_no.toLowerCase().includes(q) ||
        quo.customers?.name.toLowerCase().includes(q)
      );
    });
  }, [quotations, tab, query]);

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
            placeholder="Search quotation # or customer…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canCreate && (
          <Link
            href="/quotations/new"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={16} /> New quotation
          </Link>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={quotations.length === 0 ? "No quotations yet" : "No matches"}
          description={
            quotations.length === 0
              ? "Create your first quotation from the catalog."
              : "Try a different search or tab."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Quotation #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issue date</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quo) => (
                <tr key={quo.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-brand-700">
                    <Link href={`/quotations/${quo.id}`} className="hover:underline">
                      {quo.quotation_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{quo.customers?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(quo.issue_date)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {quo.valid_until ? formatDate(quo.valid_until) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {formatCurrency(quo.total, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <QuotationStatusBadge status={quo.status} />
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
