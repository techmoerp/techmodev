"use client";

import { useState } from "react";
import { createCustomer } from "@/lib/actions/customers";
import { createSupplier } from "@/lib/actions/suppliers";
import { createCatalogItem } from "@/lib/actions/catalog";

/**
 * Lightweight "quick add" modals used inside document builders (quotations,
 * sales, purchase orders) so a missing customer / supplier / catalog item
 * doesn't force the user to abandon what they're building. Each modal only
 * asks for the handful of fields actually needed to proceed; everything else
 * can be filled in later from the full Customers / Suppliers / Catalog pages.
 */

function ModalShell({
  title,
  onClose,
  onSubmit,
  saving,
  error,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <form onSubmit={onSubmit}>
          <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>
          <div className="space-y-4">
            {children}
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
                {saving ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

export function QuickAddCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (customer: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a customer name.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createCustomer({
      name: name.trim(),
      customer_type: "business",
      email,
      phone,
      address: "",
      tax_id: "",
      notes: "",
    });
    setSaving(false);
    if (!res.success || !res.customer) {
      setError(res.error || "Something went wrong.");
      return;
    }
    onCreated({ id: res.customer.id, name: res.customer.name });
    onClose();
  }

  return (
    <ModalShell title="Add customer" onClose={onClose} onSubmit={handleSubmit} saving={saving} error={error}>
      <Field label="Name" value={name} onChange={setName} required />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="Email" value={email} onChange={setEmail} type="email" />
      <p className="text-xs text-slate-400">You can fill in the rest of their details later from Customers.</p>
    </ModalShell>
  );
}

export function QuickAddSupplierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (supplier: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a supplier name.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createSupplier({
      name: name.trim(),
      contact_person: contactPerson,
      email: "",
      phone,
      address: "",
      tax_id: "",
      payment_terms: "",
      notes: "",
    });
    setSaving(false);
    if (!res.success || !res.supplier) {
      setError(res.error || "Something went wrong.");
      return;
    }
    onCreated({ id: res.supplier.id, name: res.supplier.name });
    onClose();
  }

  return (
    <ModalShell title="Add supplier" onClose={onClose} onSubmit={handleSubmit} saving={saving} error={error}>
      <Field label="Name" value={name} onChange={setName} required />
      <Field label="Contact person" value={contactPerson} onChange={setContactPerson} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <p className="text-xs text-slate-400">You can fill in the rest of their details later from Suppliers.</p>
    </ModalShell>
  );
}

export type QuickAddCatalogItem = {
  id: string;
  name: string;
  kind: "product" | "service";
  unit: string;
  unit_price: number;
  cost_price: number | null;
  sku: string | null;
};

export function QuickAddCatalogItemModal({
  onClose,
  onCreated,
  fixedKind,
}: {
  onClose: () => void;
  onCreated: (item: QuickAddCatalogItem) => void;
  /** When set, the Kind selector is hidden and this kind is always used (e.g. purchase orders are always products). */
  fixedKind?: "product" | "service";
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"product" | "service">(fixedKind ?? "product");
  const [unit, setUnit] = useState("pcs");
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter an item name.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createCatalogItem({
      name: name.trim(),
      kind,
      category_id: null,
      unit: unit.trim() || "pcs",
      unit_price: unitPrice,
      cost_price: kind === "product" ? costPrice || null : null,
      track_inventory: false,
      reorder_level: 0,
      description: "",
    });
    setSaving(false);
    if (!res.success || !res.item) {
      setError(res.error || "Something went wrong.");
      return;
    }
    onCreated({
      id: res.item.id,
      name: res.item.name,
      kind: res.item.kind,
      unit: res.item.unit,
      unit_price: res.item.unit_price,
      cost_price: res.item.cost_price,
      sku: res.item.sku,
    });
    onClose();
  }

  return (
    <ModalShell title="Add catalog item" onClose={onClose} onSubmit={handleSubmit} saving={saving} error={error}>
      <Field label="Name" value={name} onChange={setName} required />
      {!fixedKind && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "product" | "service")}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" value={unit} onChange={setUnit} />
        <Field
          label="Unit price"
          value={unitPrice}
          onChange={(v) => setUnitPrice(parseFloat(v) || 0)}
          type="number"
        />
      </div>
      {kind === "product" && (
        <Field
          label="Cost price (optional)"
          value={costPrice}
          onChange={(v) => setCostPrice(parseFloat(v) || 0)}
          type="number"
        />
      )}
      <p className="text-xs text-slate-400">You can fill in the rest of its details later from the Catalog.</p>
    </ModalShell>
  );
}
