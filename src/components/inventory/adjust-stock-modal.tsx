"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStockAdjustment } from "@/lib/actions/inventory";

export function AdjustStockModal({
  catalogItemId,
  currentQty,
  unit,
  onClose,
}: {
  catalogItemId: string;
  currentQty: number;
  unit: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultingQty = direction === "add" ? currentQty + amount : currentQty - amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (direction === "remove" && amount > currentQty) {
      setError("Can't remove more than what's on hand.");
      return;
    }

    setSaving(true);
    const res = await createStockAdjustment({
      catalog_item_id: catalogItemId,
      change_qty: direction === "add" ? amount : -amount,
      reason,
    });
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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <form onSubmit={handleSubmit}>
          <h3 className="mb-4 text-base font-semibold text-slate-900">Adjust stock</h3>

          <div className="space-y-4">
            <div className="flex gap-2">
              {(["add", "remove"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={
                    direction === d
                      ? "flex-1 rounded-lg border border-brand-500 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
                      : "flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  }
                >
                  {d === "add" ? "Add stock" : "Remove stock"}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Amount ({unit})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <p className="mt-1 text-xs text-slate-400">
                On hand now: {currentQty} → after adjustment: {resultingQty}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Stock count correction, damaged goods…"
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
                {saving ? "Saving…" : "Save adjustment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
