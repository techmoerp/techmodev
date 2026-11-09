import { Badge } from "@/components/ui/badge";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

const CONFIG: Record<QuotationStatus, { label: string; color: "slate" | "brand" | "emerald" | "amber" | "rose" }> = {
  draft: { label: "Draft", color: "slate" },
  sent: { label: "Sent", color: "brand" },
  accepted: { label: "Accepted", color: "emerald" },
  rejected: { label: "Rejected", color: "rose" },
  expired: { label: "Expired", color: "amber" },
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const cfg = CONFIG[status];
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}
