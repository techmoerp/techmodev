import { Badge } from "@/components/ui/badge";

export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_customer: "Waiting on Customer",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<TicketStatus, "slate" | "brand" | "amber" | "emerald" | "rose"> = {
  open: "brand",
  in_progress: "amber",
  waiting_customer: "amber",
  resolved: "emerald",
  closed: "slate",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_COLORS: Record<TicketPriority, "slate" | "brand" | "amber" | "rose"> = {
  low: "slate",
  medium: "brand",
  high: "amber",
  urgent: "rose",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge color={PRIORITY_COLORS[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
export { STATUS_LABELS as TICKET_STATUS_LABELS };
