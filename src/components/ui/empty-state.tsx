import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}
