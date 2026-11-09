"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Pencil, Trash2, Send, Check, X as XIcon, RotateCcw, Clock, ArrowRightCircle } from "lucide-react";
import { setQuotationStatus, deleteQuotation } from "@/lib/actions/quotations";
import { convertQuotationToSale } from "@/lib/actions/sales";
import type { QuotationStatus } from "@/components/quotations/status-badge";

export function QuotationActions({
  id,
  status,
  canManage,
  canDelete,
  canConvertToSale,
  convertedToSaleId,
}: {
  id: string;
  status: QuotationStatus;
  canManage: boolean;
  canDelete: boolean;
  canConvertToSale: boolean;
  convertedToSaleId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function transition(next: QuotationStatus, label: string) {
    setLoading(label);
    const res = await setQuotationStatus(id, next);
    setLoading(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleConvert() {
    setLoading("convert");
    const res = await convertQuotationToSale(id);
    setLoading(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.push(`/sales/${res.saleId}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this quotation? This cannot be undone.")) return;
    const res = await deleteQuotation(id);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.push("/quotations");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canManage && status === "draft" && (
        <ActionButton onClick={() => transition("sent", "sent")} loading={loading === "sent"} icon={Send} primary>
          Mark as Sent
        </ActionButton>
      )}
      {canManage && status === "sent" && (
        <>
          <ActionButton onClick={() => transition("accepted", "accepted")} loading={loading === "accepted"} icon={Check} primary>
            Mark Accepted
          </ActionButton>
          <ActionButton onClick={() => transition("rejected", "rejected")} loading={loading === "rejected"} icon={XIcon}>
            Mark Rejected
          </ActionButton>
          <ActionButton onClick={() => transition("expired", "expired")} loading={loading === "expired"} icon={Clock}>
            Mark Expired
          </ActionButton>
        </>
      )}
      {canManage && (status === "rejected" || status === "expired") && (
        <ActionButton onClick={() => transition("draft", "draft")} loading={loading === "draft"} icon={RotateCcw}>
          Reopen as Draft
        </ActionButton>
      )}

      {status === "accepted" && canConvertToSale && !convertedToSaleId && (
        <ActionButton onClick={handleConvert} loading={loading === "convert"} icon={ArrowRightCircle} primary>
          Convert to Sale
        </ActionButton>
      )}
      {convertedToSaleId && (
        <Link
          href={`/sales/${convertedToSaleId}`}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <ArrowRightCircle size={15} /> View Sale
        </Link>
      )}

      {canManage && (status === "draft" || status === "sent") && (
        <Link
          href={`/quotations/${id}/edit`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Pencil size={15} /> Edit
        </Link>
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
  );
}

function ActionButton({
  onClick,
  loading,
  icon: Icon,
  primary,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  icon: React.ElementType;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={
        primary
          ? "flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          : "flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      }
    >
      <Icon size={15} /> {loading ? "…" : children}
    </button>
  );
}
