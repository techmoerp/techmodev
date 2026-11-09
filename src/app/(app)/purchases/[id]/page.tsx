import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManage, canManageUsers } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PurchaseOrderStatusBadge } from "@/components/purchases/status-badge";
import { PurchaseActions } from "@/components/purchases/purchase-actions";

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const access = can(profile.role, "purchases");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: order, error: orderError }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from("purchase_orders").select("*, suppliers(*)").eq("id", id).single(),
    supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id).order("sort_order"),
    supabase.from("company_settings").select("*").eq("id", 1).single(),
  ]);

  // A genuine database/query error is a different problem from "this
  // purchase order doesn't exist" and must not be silently shown as a 404.
  if (orderError && orderError.code !== "PGRST116") {
    throw new Error(`Failed to load purchase order: ${orderError.message}`);
  }
  if (!order) notFound();

  const currency = settings?.currency ?? "LKR";

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{order.po_no}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {order.suppliers?.name} · Ordered {formatDate(order.order_date)}
          </p>
        </div>
        <PurchaseOrderStatusBadge status={order.status} />
      </div>

      <PurchaseActions
        id={id}
        status={order.status}
        canManage={canManage(profile.role, "purchases")}
        canDelete={canManageUsers(profile.role)}
      />

      {/* Printable document */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-100 pb-6 print:border-slate-300">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              <Image src={settings.logo_url} alt="" width={48} height={48} className="h-12 w-12 object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
                T
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">{settings?.company_name ?? "Techmo Software Solutions"}</p>
              {settings?.address && <p className="text-xs text-slate-500">{settings.address}</p>}
              <p className="text-xs text-slate-500">
                {[settings?.phone, settings?.email, settings?.website].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">PURCHASE ORDER</p>
            <p className="text-sm text-slate-500">{order.po_no}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Supplier</p>
            <p className="font-medium text-slate-800">{order.suppliers?.name}</p>
            {order.suppliers?.address && <p className="text-slate-500">{order.suppliers.address}</p>}
            {order.suppliers?.email && <p className="text-slate-500">{order.suppliers.email}</p>}
            {order.suppliers?.phone && <p className="text-slate-500">{order.suppliers.phone}</p>}
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Order date</p>
            <p className="text-slate-700">{formatDate(order.order_date)}</p>
            {order.expected_date && (
              <>
                <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Expected</p>
                <p className="text-slate-700">{formatDate(order.expected_date)}</p>
              </>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Cost</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2.5 text-slate-700">{item.description}</td>
                <td className="py-2.5 text-right text-slate-600">{item.quantity}</td>
                <td className="py-2.5 text-right text-slate-500">{item.unit}</td>
                <td className="py-2.5 text-right text-slate-600">{formatCurrency(item.unit_price, currency)}</td>
                <td className="py-2.5 text-right font-medium text-slate-800">
                  {formatCurrency(item.line_total, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end py-6">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-700">{formatCurrency(order.subtotal, currency)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="text-slate-700">− {formatCurrency(order.discount_amount, currency)}</span>
              </div>
            )}
            {order.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tax ({order.tax_percent}%)</span>
                <span className="text-slate-700">{formatCurrency(order.tax_amount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(order.total, currency)}</span>
            </div>
          </div>
        </div>

        {(order.notes || order.terms) && (
          <div className="space-y-3 border-t border-slate-100 pt-6 text-sm">
            {order.notes && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="text-slate-600">{order.notes}</p>
              </div>
            )}
            {order.terms && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms</p>
                <p className="text-slate-600">{order.terms}</p>
              </div>
            )}
          </div>
        )}

        {order.status === "received" && order.received_at && (
          <p className="border-t border-slate-100 pt-4 text-xs text-slate-400">
            Received on {formatDate(order.received_at)} — stock levels were updated automatically.
          </p>
        )}
      </div>
    </div>
  );
}
