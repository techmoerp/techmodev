import { Badge } from "@/components/ui/badge";

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

const CONFIG: Record<PurchaseOrderStatus, { label: string; color: "slate" | "brand" | "emerald" | "rose" }> = {
  draft: { label: "Draft", color: "slate" },
  ordered: { label: "Ordered", color: "brand" },
  received: { label: "Received", color: "emerald" },
  cancelled: { label: "Cancelled", color: "rose" },
};

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const cfg = CONFIG[status];
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}
