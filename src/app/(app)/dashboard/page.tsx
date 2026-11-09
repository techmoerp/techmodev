import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import {
  Receipt,
  ShoppingCart,
  Package,
  Ticket,
  ArrowUpRight,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { RevenueChart } from "@/components/reports/revenue-chart";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const supabase = await createClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const trailingStart = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { count: openQuotations },
    { data: monthSales },
    { data: settings },
    { data: trackedItems },
    { count: openTickets },
    { data: trailingSales },
  ] = await Promise.all([
    supabase.from("quotations").select("*", { count: "exact", head: true }).in("status", ["draft", "sent"]),
    supabase.from("sales").select("total").eq("status", "confirmed").gte("issue_date", startOfMonth),
    supabase.from("company_settings").select("currency, company_name").eq("id", 1).single(),
    supabase
      .from("catalog_items")
      .select("reorder_level, stock_levels(quantity_on_hand)")
      .eq("kind", "product")
      .eq("track_inventory", true),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "waiting_customer"]),
    supabase
      .from("sales")
      .select("total, total_returned, issue_date")
      .eq("status", "confirmed")
      .gte("issue_date", trailingStart),
  ]);

  const salesThisMonth = (monthSales ?? []).reduce((sum, s) => sum + s.total, 0);

  function monthLabel(d: Date) {
    return d.toLocaleDateString("en-US", { month: "short" });
  }
  const monthBuckets = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(d.getMonth() + i);
    monthBuckets.set(monthLabel(d), 0);
  }
  for (const s of trailingSales ?? []) {
    const label = monthLabel(new Date(s.issue_date));
    if (monthBuckets.has(label)) {
      monthBuckets.set(label, (monthBuckets.get(label) ?? 0) + (s.total - s.total_returned));
    }
  }
  const revenueChartData = [...monthBuckets.entries()].map(([month, total]) => ({ month, total }));

  const lowStockCount = (trackedItems ?? []).filter((i) => {
    const levels = i.stock_levels as { quantity_on_hand: number }[] | { quantity_on_hand: number } | null;
    const qty = Array.isArray(levels) ? levels[0]?.quantity_on_hand ?? 0 : levels?.quantity_on_hand ?? 0;
    return qty <= i.reorder_level;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {greeting}, {firstName} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s what&apos;s happening at {settings?.company_name ?? "Techmo"} today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Quotations" value={String(openQuotations ?? 0)} icon={Receipt} tint="brand" />
        <StatCard
          label="Sales This Month"
          value={formatCurrency(salesThisMonth, settings?.currency ?? "LKR")}
          icon={ShoppingCart}
          tint="emerald"
        />
        <StatCard label="Low Stock Items" value={String(lowStockCount)} icon={Package} tint="amber" />
        <StatCard label="Open Tickets" value={String(openTickets ?? 0)} icon={Ticket} tint="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Revenue Overview</h3>
            <a href="/reports" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Full reports →
            </a>
          </div>
          <div className="h-56">
            <RevenueChart data={revenueChartData} currency={settings?.currency ?? "LKR"} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Your Access</h3>
          <div className="space-y-3 text-sm">
            <Row label="Role" value={ROLE_LABELS[profile.role]} />
            <Row label="Status" value={profile.status === "active" ? "Active" : "Inactive"} />
            <Row label="Email" value={profile.email} />
          </div>
          <a
            href="/settings"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Company settings <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Quick links</h3>
        <p className="mb-4 text-sm text-slate-500">Jump straight into the modules you use most.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {[
            ["/quotations", "Quotations"],
            ["/sales", "Sales & Invoicing"],
            ["/purchases", "Purchases"],
            ["/inventory", "Inventory"],
            ["/tickets", "Tickets"],
            ["/after-sale", "After-Sale"],
            ["/reports", "Reports"],
            ["/catalog", "Catalog"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
