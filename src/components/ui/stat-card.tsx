import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tint = "brand",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  tint?: "brand" | "emerald" | "amber" | "rose";
}) {
  const tints: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tints[tint])}>
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
      {trend && (
        <p
          className={cn(
            "mt-3 text-xs font-medium",
            trend.positive ? "text-emerald-600" : "text-rose-600"
          )}
        >
          {trend.positive ? "▲" : "▼"} {trend.value}
        </p>
      )}
    </div>
  );
}
