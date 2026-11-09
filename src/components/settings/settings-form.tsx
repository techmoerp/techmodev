"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Upload, Check } from "lucide-react";
import { updateCompanySettings, uploadCompanyLogo, type CompanySettingsInput } from "@/lib/actions/settings";

type Settings = CompanySettingsInput & { logo_url: string | null };

export function SettingsForm({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CompanySettingsInput>({
    company_name: settings?.company_name ?? "Techmo Software Solutions",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    website: settings?.website ?? "",
    currency: settings?.currency ?? "LKR",
    tax_id: settings?.tax_id ?? "",
    quotation_prefix: settings?.quotation_prefix ?? "QT-",
    invoice_prefix: settings?.invoice_prefix ?? "INV-",
    purchase_prefix: settings?.purchase_prefix ?? "PO-",
  });

  function update<K extends keyof CompanySettingsInput>(key: K, value: CompanySettingsInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError("That image is too large (max 8MB). Try a smaller file.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadCompanyLogo(fd);

      if (!res.success) {
        setError(res.error || "Upload failed.");
        return;
      }
      setLogoUrl(res.url ?? null);
      router.refresh();
    } catch {
      // A thrown error here (e.g. the request was rejected before reaching
      // the server action) must never leave the button stuck on "Uploading…".
      setError("Upload failed — the file may be too large or the connection dropped. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await updateCompanySettings(form);
    setSaving(false);

    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Logo</h3>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {logoUrl ? (
              <Image src={logoUrl} alt="Company logo" width={64} height={64} className="h-full w-full object-contain" />
            ) : (
              <Building2 size={26} className="text-slate-300" />
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload logo"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            <p className="mt-1.5 text-xs text-slate-400">PNG or SVG, square works best.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Company Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name" value={form.company_name} onChange={(v) => update("company_name", v)} className="sm:col-span-2" />
          <Field label="Address" value={form.address} onChange={(v) => update("address", v)} className="sm:col-span-2" />
          <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
          <Field label="Email" value={form.email} onChange={(v) => update("email", v)} type="email" />
          <Field label="Website" value={form.website} onChange={(v) => update("website", v)} />
          <Field label="Tax / VAT ID" value={form.tax_id} onChange={(v) => update("tax_id", v)} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Documents &amp; Currency</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field
            label="Currency code"
            value={form.currency}
            onChange={(v) => update("currency", v.toUpperCase())}
            maxLength={3}
          />
          <Field label="Quotation prefix" value={form.quotation_prefix} onChange={(v) => update("quotation_prefix", v)} />
          <Field label="Invoice prefix" value={form.invoice_prefix} onChange={(v) => update("invoice_prefix", v)} />
          <Field label="Purchase Order prefix" value={form.purchase_prefix} onChange={(v) => update("purchase_prefix", v)} />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <Check size={16} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  maxLength?: number;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
