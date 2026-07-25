// Pure types/labels/derivations for the review ticket system ("Report an
// issue"). No network/React here — same reasoning as publishGate.ts and
// dashboardStatus.ts: keep the rules unit-testable and reusable client- and
// server-side.

export type TicketType =
  | "scientific_accuracy"
  | "missing_or_incorrect_source"
  | "ai_content_problem"
  | "page_structure"
  | "technical_problem"
  | "access_or_permissions"
  | "other";

export type TicketSeverity = "low" | "normal" | "high" | "critical";

export type TicketStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "waiting_for_reviewer"
  | "resolved"
  | "closed";

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  scientific_accuracy: "Scientific accuracy concern",
  missing_or_incorrect_source: "Missing or incorrect source",
  ai_content_problem: "AI-generated content problem",
  page_structure: "Page structure issue",
  technical_problem: "Technical problem",
  access_or_permissions: "Access or permissions issue",
  other: "Other",
};

export const TICKET_SEVERITY_LABELS: Record<TicketSeverity, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  waiting_for_reviewer: "Waiting for reviewer",
  resolved: "Resolved",
  closed: "Closed",
};

/** A ticket still needs admin attention (feeds the "open ticket count" on
 *  the report-issue launcher and the admin inbox default filter). */
export function isOpenTicketStatus(status: TicketStatus): boolean {
  return status !== "resolved" && status !== "closed";
}

/** Ticket is both blocking AND still open — the only kind that gates
 *  Submit review / Approve & Publish. */
export function isBlockingOpenTicket(t: { blocking: boolean; status: TicketStatus }): boolean {
  return t.blocking && isOpenTicketStatus(t.status);
}

export function countBlockingOpenTickets(tickets: { blocking: boolean; status: TicketStatus }[]): number {
  return tickets.filter(isBlockingOpenTicket).length;
}

export function countOpenTickets(tickets: { status: TicketStatus }[]): number {
  return tickets.filter((t) => isOpenTicketStatus(t.status)).length;
}
