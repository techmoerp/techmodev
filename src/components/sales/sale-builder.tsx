"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { saveSale, type SaleInput, type SaleItemInput } from "@/lib/actions/sales";
import {
  QuickAddCustomerModal,
  QuickAddCatalogItemModal,
  type QuickAddCatalogItem,
} from "@/components/shared/quick-add-modals";

type Customer = { id: string; name: string };
type CatalogItem = {
  id: string;
  name: string;
  kind: "product" | "service";
  unit: string;
  unit_price: number;
  sku: string | null;
};

const ADD_NEW = "__add_new__";

type LineItem = SaleItemInput & { key: string };

function newLine(): LineItem {
  return {
    key: crypto.randomUUID(),
    catalog_item_id: null,
    description: "",
    unit: "pcs",
    quantity: 1,
    unit_price: 0,
  };
}

export function SaleBuilder({
  saleId,
  customers,
  catalogItems,
  currency,
  canManageCustomers = false,
  canManageCatalog = false,
  initial,
}: {
  saleId: string | null;
  customers: Customer[];
  catalogItems: CatalogItem[];
  currency: string;
  canManageCustomers?: boolean;
  canManageCatalog?: boolean;
  initial?: {
    customer_id: string;
    issue_date: string;
    due_date: string | null;
    discount_type: "none" | "percentage" | "fixed";
    discount_value: number;
    tax_percent: number;
    notes: string;
    terms: string;
    items: { catalog_item_id: string | null; description: string; unit: string; quantity: number; unit_price: number }[];
  };
}) {
  const router = useRouter();
  const [customerList, setCustomerList] = useState<Customer[]>(customers);
  const [catalogList, setCatalogList] = useState<CatalogItem[]>(catalogItems);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addItemForKey, setAddItemForKey] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">(initial?.discount_type ?? "none");
  const [discountValue, setDiscountValue] = useState(initial?.discount_value ?? 0);
  const [taxPercent, setTaxPercent] = useState(initial?.tax_percent ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "Payment due within the stated terms.");
  const [items, setItems] = useState<LineItem[]>(
    initial?.items?.length ? initial.items.map((i) => ({ ...i, key: crypto.randomUUID() })) : [newLine()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = catalogList.filter((c) => c.kind === "product");
  const services = catalogList.filter((c) => c.kind === "service");

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const discountAmount =
    discountType === "percentage"
      ? round2((subtotal * discountValue) / 100)
      : discountType === "fixed"
      ? Math.min(discountValue, subtotal)
      : 0;
  const taxable = subtotal - discountAmount;
  const taxAmount = round2((taxable * taxPercent) / 100);
  const total = taxable + taxAmount;

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function pickCatalogItem(key: string, catalogId: string) {
    if (catalogId === ADD_NEW) {
      setAddItemForKey(key);
      return;
    }
    const found = catalogList.find((c) => c.id === catalogId);
    if (!found) {
      updateItem(key, { catalog_item_id: null });
      return;
    }
    updateItem(key, {
      catalog_item_id: found.id,
      description: found.name,
      unit: found.unit,
      unit_price: found.unit_price,
    });
  }

  function handleCatalogItemCreated(item: QuickAddCatalogItem) {
    setCatalogList((prev) => [...prev, item]);
    if (addItemForKey) {
      updateItem(addItemForKey, {
        catalog_item_id: item.id,
        description: item.name,
        unit: item.unit,
        unit_price: item.unit_price,
      });
    }
    setAddItemForKey(null);
  }

  function handleCustomerCreated(customer: Customer) {
    setCustomerList((prev) => [...prev, customer]);
    setCustomerId(customer.id);
    setAddCustomerOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError("Select a customer.");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      setError("Every line needs a description.");
      return;
    }

    setSaving(true);
    const input: SaleInput = {
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate || null,
      discount_type: discountType,
      discount_value: discountValue,
      tax_percent: taxPercent,
      notes,
      terms,
      items: items.map(({ key, ...rest }) => rest),
    };

    const res = await saveSale(saleId, input);
    setSaving(false);

    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    router.push(`/sales/${res.id}`);
    router.refresh();
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Customer</label>
            <select
              required
              value={customerId}
              onChange={(e) => {
                if (e.target.value === ADD_NEW) {
                  setAddCustomerOpen(true);
                  return;
                }
                setCustomerId(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                Select a customer…
              </option>
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {canManageCustomers && <option value={ADD_NEW}>+ Add new customer…</option>}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Issue date</label>
            <input
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Due date</label>
            <input
              type="date"
              value={dueDate ?? ""}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Line items</h3>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newLine()])}
            className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <Plus size={15} /> Add line
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-100 p-3">
              <div className="mb-2 flex items-center gap-2">
                <select
                  value={item.catalog_item_id ?? ""}
                  onChange={(e) => pickCatalogItem(item.key, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-brand-500"
                >
                  <option value="">Custom line (not from catalog)</option>
                  {products.length > 0 && (
                    <optgroup label="Products">
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku ? `${p.sku} — ` : ""}
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {services.length > 0 && (
                    <optgroup label="Services">
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {canManageCatalog && <option value={ADD_NEW}>+ Add new catalog item…</option>}
                </select>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <input
                  required
                  value={item.description}
                  onChange={(e) => updateItem(item.key, { description: e.target.value })}
                  placeholder="Description"
                  className="col-span-12 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-brand-500 sm:col-span-5"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, { quantity: parseFloat(e.target.value) || 0 })}
                  placeholder="Qty"
                  className="col-span-4 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-brand-500 sm:col-span-2"
                />
                <input
                  value={item.unit}
                  onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                  placeholder="Unit"
                  className="col-span-4 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-brand-500 sm:col-span-2"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.key, { unit_price: parseFloat(e.target.value) || 0 })}
                  placeholder="Unit price"
                  className="col-span-4 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-brand-500 sm:col-span-2"
                />
                <div className="col-span-12 flex items-center justify-end rounded-lg bg-slate-50 px-2.5 py-2 text-sm font-medium text-slate-700 sm:col-span-1">
                  {formatCurrency(item.quantity * item.unit_price, currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes to customer</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <label className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">Terms</label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Totals</h3>
          <div className="space-y-3 text-sm">
            <Row label="Subtotal" value={formatCurrency(subtotal, currency)} />

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Discount</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "none" | "percentage" | "fixed")}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                >
                  <option value="none">None</option>
                  <option value="percentage">%</option>
                  <option value="fixed">Fixed</option>
                </select>
                {discountType !== "none" && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                  />
                )}
              </div>
            </div>
            {discountAmount > 0 && <Row label="Discount amount" value={`− ${formatCurrency(discountAmount, currency)}`} />}

            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Tax %</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={taxPercent}
                onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
              />
            </div>
            {taxAmount > 0 && <Row label="Tax amount" value={formatCurrency(taxAmount, currency)} />}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : saleId ? "Save changes" : "Create sale"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <X size={15} /> Cancel
        </button>
      </div>
    </form>

    {addCustomerOpen && (
      <QuickAddCustomerModal onClose={() => setAddCustomerOpen(false)} onCreated={handleCustomerCreated} />
    )}
    {addItemForKey && (
      <QuickAddCatalogItemModal onClose={() => setAddItemForKey(null)} onCreated={handleCatalogItemCreated} />
    )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
