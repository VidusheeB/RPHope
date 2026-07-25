// Pure logic for sentence-level verification — no network, unit-testable in
// isolation, same reasoning as publishGate.ts.

export type SentenceVerificationStatus =
  | "unreviewed"
  | "verified_as_written"
  | "edited_and_verified"
  | "removed"
  | "not_applicable";

export type SentenceReviewRow = {
  sectionKey: string;
  sentenceIndex: number;
  originalText: string;
  finalText: string;
  originalSourceIds: string[];
  finalSourceIds: string[];
  status: SentenceVerificationStatus;
  reviewerNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

const VERIFIED_STATUSES: SentenceVerificationStatus[] = ["verified_as_written", "edited_and_verified"];

/** Editing a verified sentence's text OR its citations resets it to
 *  unreviewed — per spec, verification only means something if it's still
 *  attached to the exact text/sources it was verified against. */
export function resolveStatusOnEdit(input: {
  currentStatus: SentenceVerificationStatus;
  textChanged: boolean;
  sourceIdsChanged: boolean;
}): SentenceVerificationStatus {
  if ((input.textChanged || input.sourceIdsChanged) && VERIFIED_STATUSES.includes(input.currentStatus)) {
    return "unreviewed";
  }
  return input.currentStatus;
}

export function sameSourceIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/** A sentence "counts" toward required verification only if it actually
 *  makes a claim (has source IDs) — a transition sentence with none isn't
 *  something a reviewer can meaningfully verify against a source. */
export function requiresVerification(sourceIds: string[]): boolean {
  return sourceIds.length > 0;
}

export function verificationProgress(
  rows: { sourceIds: string[]; status: SentenceVerificationStatus }[]
): { total: number; verified: number } {
  const requiring = rows.filter((r) => requiresVerification(r.sourceIds));
  const verified = requiring.filter((r) => r.status !== "unreviewed").length;
  return { total: requiring.length, verified };
}

/** True once every citation-bearing sentence has a non-"unreviewed" outcome —
 *  used by the submission gate. */
export function allSentencesVerified(
  rows: { sourceIds: string[]; status: SentenceVerificationStatus }[]
): boolean {
  const { total, verified } = verificationProgress(rows);
  return verified === total;
}
