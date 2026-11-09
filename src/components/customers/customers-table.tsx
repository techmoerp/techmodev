"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import {
  createCustomer,
  updateCustomer,
  toggleCustomerStatus,
  deleteCustomer,
  type CustomerInput,
} from "@/lib/actions/customers";

type Customer = CustomerInput & {
  id: string;
  status: "active" | "inactive";
  created_at: string;
};

const EMPTY_FORM: CustomerInput = {
  name: "",
  customer_type: "business",
  email: "",
  phone: "",
  address: "",
  tax_id: "",
  notes: "",
};

export function CustomersTable({
  customers,
  canManage,
  canDelete,
}: {
  customers: Customer[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customers, query]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setModalOpen(true);
  }

  async function handleToggleStatus(c: Customer) {
    await toggleCustomerStatus(c.id, c.status === "active" ? "inactive" : "active");
    router.refresh();
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    const res = await deleteCustomer(c.id);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <UserPlus size={16} /> Add customer
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={customers.length === 0 ? "No customers yet" : "No matches"}
          description={
            customers.length === 0
              ? "Add your first customer to get started."
              : "Try a different search term."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.address && <p className="truncate text-xs text-slate-400">{c.address}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={c.customer_type === "business" ? "brand" : "slate"}>
                      {c.customer_type === "business" ? "Business" : "Individual"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} /> {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Phone size={13} /> {c.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => canManage && handleToggleStatus(c)} disabled={!canManage}>
                      <Badge color={c.status === "active" ? "emerald" : "slate"}>
                        {c.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CustomerModal customer={editing} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function CustomerModal({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerInput>(
    customer
      ? {
          name: customer.name,
          customer_type: customer.customer_type,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          tax_id: customer.tax_id,
          notes: customer.notes,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = customer ? await updateCustomer(customer.id, form) : await createCustomer(form);

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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <form onSubmit={handleSubmit}>
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            {customer ? "Edit customer" : "Add customer"}
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
                <select
                  value={form.customer_type}
                  onChange={(e) => update("customer_type", e.target.value as "individual" | "business")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="business">Business</option>
                  <option value="individual">Individual</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
              <input
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Tax / VAT ID</label>
              <input
                value={form.tax_id}
                onChange={(e) => update("tax_id", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={2}
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
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : customer ? "Save changes" : "Add customer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
