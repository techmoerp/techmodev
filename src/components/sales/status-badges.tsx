import { Badge } from "@/components/ui/badge";

export type SaleStatus = "draft" | "confirmed" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid";

const STATUS_CONFIG: Record<SaleStatus, { label: string; color: "slate" | "brand" | "rose" }> = {
  draft: { label: "Draft", color: "slate" },
  confirmed: { label: "Confirmed", color: "brand" },
  cancelled: { label: "Cancelled", color: "rose" },
};

const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; color: "slate" | "amber" | "emerald" }> = {
  unpaid: { label: "Unpaid", color: "slate" },
  partial: { label: "Partially Paid", color: "amber" },
  paid: { label: "Paid", color: "emerald" },
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = PAYMENT_CONFIG[status];
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}
