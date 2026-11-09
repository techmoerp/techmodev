"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Pencil, Trash2, Check, Ban, Wallet, Undo2 } from "lucide-react";
import { setSaleStatus, deleteSale } from "@/lib/actions/sales";
import type { SaleStatus } from "@/components/sales/status-badges";
import { PaymentModal } from "@/components/sales/payment-modal";
import { ReturnModal } from "@/components/sales/return-modal";

export function SaleActions({
  id,
  status,
  balanceDue,
  hasPayments,
  canManage,
  canRecordPayment,
  canDelete,
}: {
  id: string;
  status: SaleStatus;
  balanceDue: number;
  hasPayments: boolean;
  canManage: boolean;
  canRecordPayment: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const res = await setSaleStatus(id, "confirmed");
    setLoading(false);
    if (!res.success) return alert(res.error);
    router.refresh();
  }

  async function handleCancel() {
    if (!confirm("Cancel this sale? This can't be undone.")) return;
    setLoading(true);
    const res = await setSaleStatus(id, "cancelled");
    setLoading(false);
    if (!res.success) return alert(res.error);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this draft sale? This cannot be undone.")) return;
    const res = await deleteSale(id);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.push("/sales");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {canManage && status === "draft" && (
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            <Check size={15} /> Confirm sale
          </button>
        )}

        {canRecordPayment && status === "confirmed" && balanceDue > 0 && (
          <button
            onClick={() => setPaymentOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Wallet size={15} /> Record payment
          </button>
        )}

        {canRecordPayment && status === "confirmed" && (
          <button
            onClick={() => setReturnOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Undo2 size={15} /> Record return
          </button>
        )}

        {canManage && status === "draft" && (
          <Link
            href={`/sales/${id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil size={15} /> Edit
          </Link>
        )}

        {canManage && status !== "cancelled" && !hasPayments && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          >
            <Ban size={15} /> Cancel sale
          </button>
        )}

        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Printer size={15} /> Print
        </button>

        {canDelete && status === "draft" && (
          <button
            onClick={handleDelete}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>

      {paymentOpen && (
        <PaymentModal saleId={id} maxAmount={balanceDue} onClose={() => setPaymentOpen(false)} />
      )}
      {returnOpen && <ReturnModal saleId={id} onClose={() => setReturnOpen(false)} />}
    </>
  );
}
