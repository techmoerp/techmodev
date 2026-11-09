import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, canManage, canManageUsers } from "@/lib/permissions";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuotationStatusBadge } from "@/components/quotations/status-badge";
import { QuotationActions } from "@/components/quotations/quotation-actions";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const access = can(profile.role, "quotations");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: quotation, error: quotationError }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from("quotations").select("*, customers(*)").eq("id", id).single(),
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("sort_order"),
    supabase.from("company_settings").select("*").eq("id", 1).single(),
  ]);

  // A genuine database/query error is a different problem from "this
  // quotation doesn't exist" and must not be silently shown as a 404.
  if (quotationError && quotationError.code !== "PGRST116") {
    throw new Error(`Failed to load quotation: ${quotationError.message}`);
  }
  if (!quotation) notFound();

  const currency = settings?.currency ?? "LKR";

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{quotation.quotation_no}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {quotation.customers?.name} · Issued {formatDate(quotation.issue_date)}
          </p>
        </div>
        <QuotationStatusBadge status={quotation.status} />
      </div>

      <QuotationActions
        id={id}
        status={quotation.status}
        canManage={access === true}
        canDelete={canManageUsers(profile.role)}
        canConvertToSale={canManage(profile.role, "sales")}
        convertedToSaleId={quotation.converted_to_sale_id}
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
            <p className="text-lg font-bold text-slate-900">QUOTATION</p>
            <p className="text-sm text-slate-500">{quotation.quotation_no}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Prepared for</p>
            <p className="font-medium text-slate-800">{quotation.customers?.name}</p>
            {quotation.customers?.address && <p className="text-slate-500">{quotation.customers.address}</p>}
            {quotation.customers?.email && <p className="text-slate-500">{quotation.customers.email}</p>}
            {quotation.customers?.phone && <p className="text-slate-500">{quotation.customers.phone}</p>}
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Issue date</p>
            <p className="text-slate-700">{formatDate(quotation.issue_date)}</p>
            {quotation.valid_until && (
              <>
                <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Valid until</p>
                <p className="text-slate-700">{formatDate(quotation.valid_until)}</p>
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
              <span className="text-slate-700">{formatCurrency(quotation.subtotal, currency)}</span>
            </div>
            {quotation.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="text-slate-700">− {formatCurrency(quotation.discount_amount, currency)}</span>
              </div>
            )}
            {quotation.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tax ({quotation.tax_percent}%)</span>
                <span className="text-slate-700">{formatCurrency(quotation.tax_amount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(quotation.total, currency)}</span>
            </div>
          </div>
        </div>

        {(quotation.notes || quotation.terms) && (
          <div className="space-y-3 border-t border-slate-100 pt-6 text-sm">
            {quotation.notes && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="text-slate-600">{quotation.notes}</p>
              </div>
            )}
            {quotation.terms && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Terms</p>
                <p className="text-slate-600">{quotation.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
