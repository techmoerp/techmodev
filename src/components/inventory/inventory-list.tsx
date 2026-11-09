"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Package, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type InventoryItem = {
  id: string;
  sku: string | null;
  name: string;
  reorder_level: number;
  unit: string;
  unit_price: number;
  catalog_categories: { id: string; name: string } | null;
  stock_levels: { quantity_on_hand: number }[] | { quantity_on_hand: number } | null;
};

function qtyOf(item: InventoryItem): number {
  if (!item.stock_levels) return 0;
  if (Array.isArray(item.stock_levels)) return item.stock_levels[0]?.quantity_on_hand ?? 0;
  return item.stock_levels.quantity_on_hand ?? 0;
}

export function InventoryList({
  items,
  canAdjust,
  currency,
}: {
  items: InventoryItem[];
  canAdjust: boolean;
  currency: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
  }, [items, query]);

  const lowStockCount = items.filter((i) => qtyOf(i) <= i.reorder_level).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
            <AlertTriangle size={15} /> {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} at or below reorder level
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={items.length === 0 ? "No tracked products yet" : "No matches"}
          description={
            items.length === 0
              ? "Mark a product as “track inventory” in the Catalog to see it here."
              : "Try a different search term."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Reorder level</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Unit price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const qty = qtyOf(item);
                const status = qty <= 0 ? "out" : qty <= item.reorder_level ? "low" : "ok";
                return (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku}</td>
                    <td className="px-4 py-3">
                      <Link href={`/inventory/${item.id}`} className="font-medium text-brand-700 hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.catalog_categories?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {qty} <span className="font-normal text-slate-400">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.reorder_level}</td>
                    <td className="px-4 py-3">
                      {status === "out" && <Badge color="rose">Out of stock</Badge>}
                      {status === "low" && <Badge color="amber">Low stock</Badge>}
                      {status === "ok" && <Badge color="emerald">In stock</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatCurrency(item.unit_price, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canAdjust && (
        <p className="text-xs text-slate-400">Open a product to adjust its stock or view its movement history.</p>
      )}
    </div>
  );
}
