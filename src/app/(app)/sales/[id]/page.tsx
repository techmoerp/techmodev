import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManage, canManageUsers } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SaleStatusBadge, PaymentStatusBadge } from "@/components/sales/status-badges";
import { SaleActions } from "@/components/sales/sale-actions";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  cheque: "Cheque",
  other: "Other",
};

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const access = can(profile.role, "sales");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: sale, error: saleError }, { data: items }, { data: payments }, { data: returns }, { data: settings }] =
    await Promise.all([
      supabase
        .from("sales")
        // Explicitly disambiguate: there are two FK paths between sales and
        // quotations (sales.quotation_id -> quotations.id, and
        // quotations.converted_to_sale_id -> sales.id), so PostgREST can't
        // infer which one is meant without naming the constraint.
        .select("*, customers(*), quotations!sales_quotation_id_fkey(quotation_no)")
        .eq("id", id)
        .single(),
      supabase.from("sale_items").select("*").eq("sale_id", id).order("sort_order"),
      supabase.from("sale_payments").select("*").eq("sale_id", id).order("paid_on", { ascending: false }),
      supabase.from("sale_returns").select("*").eq("sale_id", id).order("created_at", { ascending: false }),
      supabase.from("company_settings").select("*").eq("id", 1).single(),
    ]);

  // A genuine database/query error (RLS, connection, malformed embed, etc.)
  // is a different problem from "this sale doesn't exist" and must not be
  // silently shown as a 404 — that masks the real cause.
  if (saleError && saleError.code !== "PGRST116") {
    throw new Error(`Failed to load sale: ${saleError.message}`);
  }
  if (!sale) notFound();

  const currency = settings?.currency ?? "LKR";
  const balanceDue = Math.max(sale.total - sale.total_returned - sale.amount_paid, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{sale.sale_no}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {sale.customers?.name} · Issued {formatDate(sale.issue_date)}
            {sale.quotations?.quotation_no && (
              <>
                {" "}
                · from{" "}
                <Link href={`/quotations/${sale.quotation_id}`} className="text-brand-600 hover:underline">
                  {sale.quotations.quotation_no}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaleStatusBadge status={sale.status} />
          {sale.status !== "cancelled" && <PaymentStatusBadge status={sale.payment_status} />}
        </div>
      </div>

      <SaleActions
        id={id}
        status={sale.status}
        balanceDue={balanceDue}
        hasPayments={sale.amount_paid > 0}
        canManage={canManage(profile.role, "sales")}
        canRecordPayment={
          profile.role === "super_admin" ||
          profile.role === "admin" ||
          profile.role === "sales" ||
          profile.role === "accounts"
        }
        canDelete={canManageUsers(profile.role)}
      />

      {/* Printable invoice */}
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
            <p className="text-lg font-bold text-slate-900">INVOICE</p>
            <p className="text-sm text-slate-500">{sale.sale_no}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
            <p className="font-medium text-slate-800">{sale.customers?.name}</p>
            {sale.customers?.address && <p className="text-slate-500">{sale.customers.address}</p>}
            {sale.customers?.email && <p className="text-slate-500">{sale.customers.email}</p>}
            {sale.customers?.phone && <p className="text-slate-500">{sale.customers.phone}</p>}
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Issue date</p>
            <p className="text-slate-700">{formatDate(sale.issue_date)}</p>
            {sale.due_date && (
              <>
                <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Due date</p>
                <p className="text-slate-700">{formatDate(sale.due_date)}</p>
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
              <th className="py-2 text-right">Price</th>
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
              <span className="text-slate-700">{formatCurrency(sale.subtotal, currency)}</span>
            </div>
            {sale.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="text-slate-700">− {formatCurrency(sale.discount_amount, currency)}</span>
              </div>
            )}
            {sale.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tax ({sale.tax_percent}%)</span>
                <span className="text-slate-700">{formatCurrency(sale.tax_amount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(sale.total, currency)}</span>
            </div>
            {sale.total_returned > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Returned</span>
                <span>− {formatCurrency(sale.total_returned, currency)}</span>
              </div>
            )}
            {sale.amount_paid > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Paid</span>
                <span>− {formatCurrency(sale.amount_paid, currency)}</span>
              </div>
            )}
            {sale.status !== "cancelled" && (
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
                <span>Balance due</span>
                <span>{formatCurrency(balanceDue, currency)}</span>
              </div>
            )}
          </div>
        </div>

        {(sale.notes || sale.terms) && (
          <div className="space-y-3 border-t border-slate-100 pt-6 text-sm">
            {sale.notes && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="text-slate-600">{sale.notes}</p>
              </div>
            )}
            {sale.terms && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms</p>
                <p className="text-slate-600">{sale.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {((payments && payments.length > 0) || (returns && returns.length > 0)) && (
        <div className="grid grid-cols-1 gap-4 print:hidden sm:grid-cols-2">
          {payments && payments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Payment history</h3>
              <div className="space-y-2 text-sm">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-slate-700">{formatDate(p.paid_on)}</p>
                      <p className="text-xs text-slate-400">
                        {METHOD_LABELS[p.method]}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                    </div>
                    <p className="font-medium text-emerald-600">{formatCurrency(p.amount, currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {returns && returns.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Returns</h3>
              <div className="space-y-2 text-sm">
                {returns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="text-slate-700">{formatDate(r.created_at)}</p>
                      {r.reason && <p className="text-xs text-slate-400">{r.reason}</p>}
                    </div>
                    <p className="font-medium text-rose-600">− {formatCurrency(r.amount, currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
