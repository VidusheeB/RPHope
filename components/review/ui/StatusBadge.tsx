// The portal's single status badge.
//
// One component for every workflow state across genes, generation, stories,
// tickets and team, so "In Review" looks identical wherever it appears and a
// new state is added in one place.
//
// Accessibility: the label is always rendered as text, and each badge also
// carries a small shape marker. Colour is never the only signal — the spec
// requires that, and our audience makes it non-negotiable.

export type StatusTone =
  | "neutral"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "attention"
  | "danger"
  | "purple";

/** Every status the portal can show, mapped to its tone. Kept as one table so
 *  the vocabulary is visible at a glance and two areas can't drift into
 *  showing the same concept differently. */
export const STATUS_TONES = {
  // Generation
  Queued: "neutral",
  Running: "progress",
  Complete: "success",
  Failed: "danger",
  // Gene workflow
  Draft: "neutral",
  "Needs Generation": "neutral",
  Unassigned: "warning",
  Assigned: "info",
  "In Review": "info",
  "Changes Requested": "attention",
  "Awaiting Publication": "purple",
  Published: "success",
  Unpublished: "neutral",
  Archived: "neutral",
  // Accounts
  Invited: "info",
  Active: "success",
  Inactive: "neutral",
  // Tickets
  Open: "info",
  "In Progress": "progress",
  "Waiting on Reviewer": "attention",
  Resolved: "success",
} as const satisfies Record<string, StatusTone>;

export type StatusLabel = keyof typeof STATUS_TONES;

const TONE_CLASSES: Record<StatusTone, string> = {
  // Full-strength ink, not a tint. At 12px a status chip is small, bold and
  // load-bearing, and ink/70 measured only 5.55:1 — passing AA on paper while
  // reading as washed out next to the darker chips beside it. Full ink is
  // 14.25:1. Our audience has vision loss; a status should never be the
  // faintest thing on the row.
  neutral: "bg-ink/[0.09] text-ink ring-ink/15",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  progress: "bg-blue-50 text-blue-800 ring-blue-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  attention: "bg-orange-50 text-orange-900 ring-orange-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  purple: "bg-violet-50 text-violet-800 ring-violet-200",
};

/** A small filled dot for most states; a ring for in-flight ones so "Running"
 *  is distinguishable from "Complete" without relying on hue. */
const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-ink/40",
  info: "bg-sky-500",
  progress: "bg-blue-500 animate-pulse motion-reduce:animate-none",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  attention: "bg-orange-500",
  danger: "bg-red-500",
  purple: "bg-violet-500",
};

export default function StatusBadge({
  status,
  tone,
  className = "",
}: {
  status: StatusLabel | string;
  /** Override for a status not in the table (falls back to neutral). */
  tone?: StatusTone;
  className?: string;
}) {
  const resolved: StatusTone =
    tone ?? (STATUS_TONES as Record<string, StatusTone>)[status] ?? "neutral";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[resolved]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[resolved]}`} aria-hidden="true" />
      {status}
    </span>
  );
}
