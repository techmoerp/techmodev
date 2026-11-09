"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { savePurchaseOrder, type PurchaseOrderInput, type PurchaseItemInput } from "@/lib/actions/purchases";
import {
  QuickAddSupplierModal,
  QuickAddCatalogItemModal,
  type QuickAddCatalogItem,
} from "@/components/shared/quick-add-modals";

type Supplier = { id: string; name: string };
type CatalogItem = { id: string; name: string; unit: string; unit_price: number; cost_price: number | null; sku: string | null };

const ADD_NEW = "__add_new__";

type LineItem = PurchaseItemInput & { key: string };

function newLine(): LineItem {
  return { key: crypto.randomUUID(), catalog_item_id: null, description: "", unit: "pcs", quantity: 1, unit_price: 0 };
}

export function PurchaseBuilder({
  purchaseOrderId,
  suppliers,
  catalogItems,
  currency,
  canManageSuppliers = false,
  canManageCatalog = false,
  initial,
}: {
  purchaseOrderId: string | null;
  suppliers: Supplier[];
  catalogItems: CatalogItem[];
  currency: string;
  canManageSuppliers?: boolean;
  canManageCatalog?: boolean;
  initial?: {
    supplier_id: string;
    order_date: string;
    expected_date: string | null;
    discount_type: "none" | "percentage" | "fixed";
    discount_value: number;
    tax_percent: number;
    notes: string;
    terms: string;
    items: { catalog_item_id: string | null; description: string; unit: string; quantity: number; unit_price: number }[];
  };
}) {
  const router = useRouter();
  const [supplierList, setSupplierList] = useState<Supplier[]>(suppliers);
  const [catalogList, setCatalogList] = useState<CatalogItem[]>(catalogItems);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [addItemForKey, setAddItemForKey] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [orderDate, setOrderDate] = useState(initial?.order_date ?? new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState(initial?.expected_date ?? "");
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">(initial?.discount_type ?? "none");
  const [discountValue, setDiscountValue] = useState(initial?.discount_value ?? 0);
  const [taxPercent, setTaxPercent] = useState(initial?.tax_percent ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [items, setItems] = useState<LineItem[]>(
    initial?.items?.length ? initial.items.map((i) => ({ ...i, key: crypto.randomUUID() })) : [newLine()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      unit_price: found.cost_price ?? found.unit_price,
    });
  }

  function handleCatalogItemCreated(item: QuickAddCatalogItem) {
    setCatalogList((prev) => [...prev, item]);
    if (addItemForKey) {
      updateItem(addItemForKey, {
        catalog_item_id: item.id,
        description: item.name,
        unit: item.unit,
        unit_price: item.cost_price ?? item.unit_price,
      });
    }
    setAddItemForKey(null);
  }

  function handleSupplierCreated(supplier: Supplier) {
    setSupplierList((prev) => [...prev, supplier]);
    setSupplierId(supplier.id);
    setAddSupplierOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      setError("Every line needs a description.");
      return;
    }

    setSaving(true);
    const input: PurchaseOrderInput = {
      supplier_id: supplierId,
      order_date: orderDate,
      expected_date: expectedDate || null,
      discount_type: discountType,
      discount_value: discountValue,
      tax_percent: taxPercent,
      notes,
      terms,
      items: items.map(({ key, ...rest }) => rest),
    };

    const res = await savePurchaseOrder(purchaseOrderId, input);
    setSaving(false);

    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    router.push(`/purchases/${res.id}`);
    router.refresh();
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
            <select
              required
              value={supplierId}
              onChange={(e) => {
                if (e.target.value === ADD_NEW) {
                  setAddSupplierOpen(true);
                  return;
                }
                setSupplierId(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="" disabled>
                Select a supplier…
              </option>
              {supplierList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {canManageSuppliers && <option value={ADD_NEW}>+ Add new supplier…</option>}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Order date</label>
            <input
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Expected date</label>
            <input
              type="date"
              value={expectedDate ?? ""}
              onChange={(e) => setExpectedDate(e.target.value)}
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
                  {catalogList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku ? `${p.sku} — ` : ""}
                      {p.name}
                    </option>
                  ))}
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
                  placeholder="Unit cost"
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
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
          {saving ? "Saving…" : purchaseOrderId ? "Save changes" : "Create purchase order"}
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

    {addSupplierOpen && (
      <QuickAddSupplierModal onClose={() => setAddSupplierOpen(false)} onCreated={handleSupplierCreated} />
    )}
    {addItemForKey && (
      <QuickAddCatalogItemModal
        onClose={() => setAddItemForKey(null)}
        onCreated={handleCatalogItemCreated}
        fixedKind="product"
      />
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
