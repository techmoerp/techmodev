"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addSalePayment } from "@/lib/actions/sales";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;

export function PaymentModal({
  saleId,
  maxAmount,
  onClose,
}: {
  saleId: string;
  maxAmount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(maxAmount);
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amount <= 0 || amount > maxAmount) {
      setError(`Amount must be between 0 and the outstanding balance.`);
      return;
    }

    setSaving(true);
    const res = await addSalePayment({ sale_id: saleId, amount, method, paid_on: paidOn, reference });
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
          <h3 className="mb-4 text-base font-semibold text-slate-900">Record payment</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Amount</label>
              <input
                type="number"
                min="0.01"
                max={maxAmount}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <p className="mt-1 text-xs text-slate-400">Outstanding balance: {maxAmount.toFixed(2)}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                required
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Reference <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Cheque no., transaction ID…"
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
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Recording…" : "Record payment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
