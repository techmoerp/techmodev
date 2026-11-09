"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Pencil, Trash2, Tags, Package, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import {
  createCatalogItem,
  updateCatalogItem,
  toggleCatalogItemStatus,
  deleteCatalogItem,
  createCategory,
  type CatalogItemInput,
} from "@/lib/actions/catalog";

type Category = { id: string; name: string; kind: "product" | "service" };

type CatalogItem = {
  id: string;
  sku: string | null;
  name: string;
  kind: "product" | "service";
  category_id: string | null;
  catalog_categories: { id: string; name: string } | null;
  unit: string;
  unit_price: number;
  cost_price: number | null;
  track_inventory: boolean;
  reorder_level: number;
  description: string | null;
  status: "active" | "inactive";
  created_at: string;
};

const EMPTY_FORM: CatalogItemInput = {
  name: "",
  kind: "product",
  category_id: null,
  unit: "pcs",
  unit_price: 0,
  cost_price: null,
  track_inventory: true,
  reorder_level: 5,
  description: "",
};

export function CatalogTable({
  items,
  categories,
  canManage,
  canDelete,
  currency,
}: {
  items: CatalogItem[];
  categories: Category[];
  canManage: boolean;
  canDelete: boolean;
  currency: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"product" | "service">("product");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (i.kind !== tab) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q);
    });
  }, [items, tab, query]);

  const productCount = items.filter((i) => i.kind === "product").length;
  const serviceCount = items.filter((i) => i.kind === "service").length;

  async function handleToggleStatus(item: CatalogItem) {
    await toggleCatalogItemStatus(item.id, item.status === "active" ? "inactive" : "active");
    router.refresh();
  }

  async function handleDelete(item: CatalogItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    const res = await deleteCatalogItem(item.id);
    if (!res.success) alert(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === "product"} onClick={() => setTab("product")} icon={Package}>
          Products <span className="text-slate-400">({productCount})</span>
        </TabButton>
        <TabButton active={tab === "service"} onClick={() => setTab("service")} icon={Wrench}>
          Services <span className="text-slate-400">({serviceCount})</span>
        </TabButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab === "product" ? "products" : "services"}…`}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={16} /> Add {tab === "product" ? "product" : "service"}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`No ${tab === "product" ? "products" : "services"} yet`}
          description={
            canManage
              ? `Add your first ${tab} to the catalog.`
              : "Nothing here yet."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                {tab === "product" && <th className="px-4 py-3">SKU</th>}
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                {tab === "product" && <th className="px-4 py-3">Tracking</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  {tab === "product" && (
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.sku}</td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{item.name}</p>
                    {item.description && (
                      <p className="max-w-xs truncate text-xs text-slate-400">{item.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.catalog_categories?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{formatCurrency(item.unit_price, currency)}</p>
                    <p className="text-xs text-slate-400">per {item.unit}</p>
                  </td>
                  {tab === "product" && (
                    <td className="px-4 py-3">
                      {item.track_inventory ? (
                        <Badge color="brand">Tracked · reorder at {item.reorder_level}</Badge>
                      ) : (
                        <Badge color="slate">Not tracked</Badge>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <button onClick={() => canManage && handleToggleStatus(item)} disabled={!canManage}>
                      <Badge color={item.status === "active" ? "emerald" : "slate"}>
                        {item.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <button
                          onClick={() => {
                            setEditing(item);
                            setModalOpen(true);
                          }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item)}
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
        <CatalogModal
          item={editing}
          categories={categories}
          defaultKind={tab}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition",
        active ? "bg-brand-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
      )}
    >
      <Icon size={15} /> {children}
    </button>
  );
}

function CatalogModal({
  item,
  categories,
  defaultKind,
  onClose,
}: {
  item: CatalogItem | null;
  categories: Category[];
  defaultKind: "product" | "service";
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CatalogItemInput>(
    item
      ? {
          name: item.name,
          kind: item.kind,
          category_id: item.category_id,
          unit: item.unit,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          track_inventory: item.track_inventory,
          reorder_level: item.reorder_level,
          description: item.description ?? "",
        }
      : { ...EMPTY_FORM, kind: defaultKind, unit: defaultKind === "service" ? "hour" : "pcs" }
  );
  const [categoryList, setCategoryList] = useState(categories);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const relevantCategories = categoryList.filter((c) => c.kind === form.kind);

  function update<K extends keyof CatalogItemInput>(key: K, value: CatalogItemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    const res = await createCategory(newCategory.trim(), form.kind);
    if (res.success && res.category) {
      setCategoryList((prev) => [...prev, res.category]);
      update("category_id", res.category.id);
      setNewCategory("");
      setAddingCategory(false);
    } else {
      alert(res.error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = item ? await updateCatalogItem(item.id, form) : await createCatalogItem(form);

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
            {item ? "Edit" : "Add"} {form.kind === "product" ? "product" : "service"}
          </h3>

          <div className="space-y-4">
            {!item && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
                <div className="flex gap-2">
                  {(["product", "service"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => update("kind", k)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                        form.kind === k
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {k === "product" ? "Product" : "Service"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
              {addingCategory ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={form.category_id ?? ""}
                    onChange={(e) => update("category_id", e.target.value || null)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">No category</option>
                    {relevantCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(true)}
                    className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    + New
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {form.kind === "product" ? "Unit price" : "Rate"}
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_price}
                  onChange={(e) => update("unit_price", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit</label>
                <select
                  value={form.unit}
                  onChange={(e) => update("unit", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {form.kind === "product" ? (
                    <>
                      <option value="pcs">pcs</option>
                      <option value="set">set</option>
                      <option value="box">box</option>
                    </>
                  ) : (
                    <>
                      <option value="hour">hour</option>
                      <option value="project">project</option>
                      <option value="month">month (retainer)</option>
                      <option value="session">session</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {form.kind === "product" && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Cost price <span className="font-normal text-slate-400">(optional, for margin)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost_price ?? ""}
                    onChange={(e) => update("cost_price", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Track inventory</p>
                    <p className="text-xs text-slate-400">Shows stock on hand in Inventory and deducts on sale</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.track_inventory}
                    onChange={(e) => update("track_inventory", e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </div>

                {form.track_inventory && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Reorder level</label>
                    <input
                      type="number"
                      min="0"
                      value={form.reorder_level}
                      onChange={(e) => update("reorder_level", parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
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
                {saving ? "Saving…" : item ? "Save changes" : "Add item"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
