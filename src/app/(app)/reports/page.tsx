import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { formatCurrency, cn } from "@/lib/utils";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { Badge } from "@/components/ui/badge";

type Period = "30d" | "90d" | "year" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  year: "This year",
  all: "All time",
};

function startDateFor(period: Period): string | null {
  const now = new Date();
  if (period === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  if (period === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }
  if (period === "year") {
    return `${now.getFullYear()}-01-01`;
  }
  return null;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period: Period = (["30d", "90d", "year", "all"] as const).includes(periodParam as Period)
    ? (periodParam as Period)
    : "year";

  const profile = await requireProfile();
  const access = can(profile.role, "reports");
  if (access === false) redirect("/dashboard");

  const supabase = await createClient();
  const start = startDateFor(period);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  const trailingStart = twelveMonthsAgo.toISOString().slice(0, 10);

  let salesQuery = supabase
    .from("sales")
    .select("id, total, total_returned, amount_paid, issue_date, customer_id, customers(name)")
    .eq("status", "confirmed");
  if (start) salesQuery = salesQuery.gte("issue_date", start);

  let saleItemsQuery = supabase
    .from("sale_items")
    .select("line_total, description, catalog_item_id, catalog_items(name), sales!inner(status, issue_date)")
    .eq("sales.status", "confirmed");
  if (start) saleItemsQuery = saleItemsQuery.gte("sales.issue_date", start);

  let poQuery = supabase
    .from("purchase_orders")
    .select("id, total, status, order_date, supplier_id, suppliers(name)")
    .neq("status", "cancelled");
  if (start) poQuery = poQuery.gte("order_date", start);

  let quotationsQuery = supabase.from("quotations").select("status, total, issue_date");
  if (start) quotationsQuery = quotationsQuery.gte("issue_date", start);

  const [
    { data: periodSales },
    { data: periodSaleItems },
    { data: outstandingSales },
    { data: periodPOs },
    { data: trackedItems },
    { data: tickets },
    { data: periodQuotations },
    { data: trailingSales },
    { data: settings },
  ] = await Promise.all([
    salesQuery,
    saleItemsQuery,
    supabase
      .from("sales")
      .select("total, total_returned, amount_paid")
      .eq("status", "confirmed")
      .in("payment_status", ["unpaid", "partial"]),
    poQuery,
    supabase
      .from("catalog_items")
      .select("unit_price, stock_levels(quantity_on_hand)")
      .eq("kind", "product")
      .eq("track_inventory", true),
    supabase.from("tickets").select("status"),
    quotationsQuery,
    supabase
      .from("sales")
      .select("total, total_returned, issue_date")
      .eq("status", "confirmed")
      .gte("issue_date", trailingStart),
    supabase.from("company_settings").select("currency").eq("id", 1).single(),
  ]);

  const currency = settings?.currency ?? "LKR";

  // --- Revenue & receivables ---
  const totalRevenue = (periodSales ?? []).reduce((sum, s) => sum + (s.total - s.total_returned), 0);
  const outstandingReceivables = (outstandingSales ?? []).reduce(
    (sum, s) => sum + (s.total - s.total_returned - s.amount_paid),
    0
  );

  // --- Top customers ---
  const customerTotals = new Map<string, { name: string; total: number }>();
  for (const s of periodSales ?? []) {
    const name = (s.customers as unknown as { name: string } | null)?.name ?? "Unknown";
    const key = s.customer_id;
    const existing = customerTotals.get(key);
    const amount = s.total - s.total_returned;
    if (existing) existing.total += amount;
    else customerTotals.set(key, { name, total: amount });
  }
  const topCustomers = [...customerTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  // --- Top products/services ---
  const productTotals = new Map<string, { name: string; total: number }>();
  for (const item of periodSaleItems ?? []) {
    const name = (item.catalog_items as unknown as { name: string } | null)?.name ?? item.description;
    const key = item.catalog_item_id ?? item.description;
    const existing = productTotals.get(key);
    if (existing) existing.total += item.line_total;
    else productTotals.set(key, { name, total: item.line_total });
  }
  const topProducts = [...productTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  // --- Purchases & top suppliers ---
  const totalPurchases = (periodPOs ?? []).reduce((sum, p) => sum + p.total, 0);
  const supplierTotals = new Map<string, { name: string; total: number }>();
  for (const p of periodPOs ?? []) {
    const name = (p.suppliers as unknown as { name: string } | null)?.name ?? "Unknown";
    const existing = supplierTotals.get(p.supplier_id);
    if (existing) existing.total += p.total;
    else supplierTotals.set(p.supplier_id, { name, total: p.total });
  }
  const topSuppliers = [...supplierTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  // --- Inventory value ---
  const inventoryValue = (trackedItems ?? []).reduce((sum, i) => {
    const levels = i.stock_levels as { quantity_on_hand: number }[] | { quantity_on_hand: number } | null;
    const qty = Array.isArray(levels) ? levels[0]?.quantity_on_hand ?? 0 : levels?.quantity_on_hand ?? 0;
    return sum + qty * i.unit_price;
  }, 0);

  // --- Tickets by status ---
  const ticketStatuses = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
  const ticketCounts = Object.fromEntries(ticketStatuses.map((s) => [s, 0])) as Record<string, number>;
  for (const t of tickets ?? []) ticketCounts[t.status] = (ticketCounts[t.status] ?? 0) + 1;
  const totalTickets = tickets?.length ?? 0;

  // --- Quotation conversion ---
  const totalQuotations = periodQuotations?.length ?? 0;
  const acceptedQuotations = (periodQuotations ?? []).filter((q) => q.status === "accepted");
  const conversionRate = totalQuotations > 0 ? (acceptedQuotations.length / totalQuotations) * 100 : 0;
  const acceptedValue = acceptedQuotations.reduce((sum, q) => sum + q.total, 0);

  // --- Trailing 12-month revenue chart ---
  const monthBuckets = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    monthBuckets.set(monthLabel(d), 0);
  }
  for (const s of trailingSales ?? []) {
    const d = new Date(s.issue_date);
    const label = monthLabel(d);
    if (monthBuckets.has(label)) {
      monthBuckets.set(label, (monthBuckets.get(label) ?? 0) + (s.total - s.total_returned));
    }
  }
  const chartData = [...monthBuckets.entries()].map(([month, total]) => ({ month, total }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Reports &amp; Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">A snapshot of how the business is doing.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Link
              key={p}
              href={`/reports?period=${p}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                p === period ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatCurrency(totalRevenue, currency)} sub={PERIOD_LABELS[period]} />
        <StatCard label="Outstanding Receivables" value={formatCurrency(outstandingReceivables, currency)} sub="All time" />
        <StatCard label="Purchases" value={formatCurrency(totalPurchases, currency)} sub={PERIOD_LABELS[period]} />
        <StatCard label="Inventory Value" value={formatCurrency(inventoryValue, currency)} sub="Current stock, at sale price" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Revenue — last 12 months</h3>
        <div className="h-64">
          <RevenueChart data={chartData} currency={currency} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard title="Top customers" items={topCustomers} currency={currency} empty="No confirmed sales in this period." />
        <ListCard title="Top products & services" items={topProducts} currency={currency} empty="No sale line items in this period." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCard title="Top suppliers" items={topSuppliers} currency={currency} empty="No purchase orders in this period." />

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Quotations</h3>
          <div className="space-y-3 text-sm">
            <Row label="Sent in period" value={String(totalQuotations)} />
            <Row label="Accepted" value={String(acceptedQuotations.length)} />
            <Row label="Conversion rate" value={`${conversionRate.toFixed(1)}%`} />
            <Row label="Accepted value" value={formatCurrency(acceptedValue, currency)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Tickets by status</h3>
        {totalTickets === 0 ? (
          <p className="text-sm text-slate-400">No tickets logged yet.</p>
        ) : (
          <div className="space-y-2.5">
            {ticketStatuses.map((s) => {
              const count = ticketCounts[s];
              const pct = totalTickets > 0 ? (count / totalTickets) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-xs font-medium capitalize text-slate-600">
                    {s.replace("_", " ")}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                  <Badge color="slate">{count}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function ListCard({
  title,
  items,
  currency,
  empty,
}: {
  title: string;
  items: { name: string; total: number }[];
  currency: string;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.name + i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-700">{item.name}</span>
              </div>
              <span className="font-medium text-slate-600">{formatCurrency(item.total, currency)}</span>
            </div>
          ))}
        </div>
      )}
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
