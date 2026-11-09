import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
};

export function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: keyof typeof COLORS;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLORS[color]
      )}
    >
      {children}
    </span>
  );
}
