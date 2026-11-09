"use client";

import { useState } from "react";
import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { AdjustStockModal } from "@/components/inventory/adjust-stock-modal";

type Movement = {
  id: string;
  change_qty: number;
  reason: string;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  purchase_receipt: "Purchase received",
  sale: "Sale",
  sale_cancelled_restock: "Sale cancelled (restocked)",
  adjustment: "Manual adjustment",
};

export function InventoryItemDetail({
  catalogItemId,
  currentQty,
  unit,
  canAdjust,
  movements,
}: {
  catalogItemId: string;
  currentQty: number;
  unit: string;
  canAdjust: boolean;
  movements: Movement[];
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);

  return (
    <div className="space-y-6">
      {canAdjust && (
        <div>
          <button
            onClick={() => setAdjustOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Boxes size={16} /> Adjust stock
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800">Movement history</h3>
        </div>
        {movements.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No stock movements recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="text-slate-700">{REASON_LABELS[m.reason] ?? m.reason}</p>
                  <p className="text-xs text-slate-400">{formatDate(m.created_at)}</p>
                  {m.notes && <p className="text-xs text-slate-400">{m.notes}</p>}
                </div>
                <Badge color={m.change_qty > 0 ? "emerald" : "rose"}>
                  {m.change_qty > 0 ? "+" : ""}
                  {m.change_qty} {unit}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {adjustOpen && (
        <AdjustStockModal
          catalogItemId={catalogItemId}
          currentQty={currentQty}
          unit={unit}
          onClose={() => setAdjustOpen(false)}
        />
      )}
    </div>
  );
}
