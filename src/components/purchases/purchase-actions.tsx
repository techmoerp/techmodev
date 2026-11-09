"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Pencil, Trash2, PackageCheck, Send, Ban } from "lucide-react";
import { setPurchaseOrderStatus, deletePurchaseOrder } from "@/lib/actions/purchases";
import type { PurchaseOrderStatus } from "@/components/purchases/status-badge";

export function PurchaseActions({
  id,
  status,
  canManage,
  canDelete,
}: {
  id: string;
  status: PurchaseOrderStatus;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function transition(next: "ordered" | "received" | "cancelled", label: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setLoading(label);
    const res = await setPurchaseOrderStatus(id, next);
    setLoading(null);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this draft purchase order? This cannot be undone.")) return;
    const res = await deletePurchaseOrder(id);
    if (!res.success) {
      alert(res.error);
      return;
    }
    router.push("/purchases");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {canManage && status === "draft" && (
        <button
          onClick={() => transition("ordered", "ordered")}
          disabled={loading === "ordered"}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          <Send size={15} /> {loading === "ordered" ? "…" : "Mark as Ordered"}
        </button>
      )}

      {canManage && status === "ordered" && (
        <button
          onClick={() =>
            transition(
              "received",
              "received",
              "Mark as received? This will add the ordered quantities to stock and cannot be undone."
            )
          }
          disabled={loading === "received"}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          <PackageCheck size={15} /> {loading === "received" ? "…" : "Mark as Received"}
        </button>
      )}

      {canManage && (status === "draft" || status === "ordered") && (
        <button
          onClick={() => transition("cancelled", "cancelled", "Cancel this purchase order?")}
          disabled={loading === "cancelled"}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          <Ban size={15} /> Cancel
        </button>
      )}

      {canManage && status === "draft" && (
        <Link
          href={`/purchases/${id}/edit`}
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
