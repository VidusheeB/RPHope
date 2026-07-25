import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isOpenTicketStatus,
  isBlockingOpenTicket,
  countBlockingOpenTickets,
  countOpenTickets,
} from "@/lib/reviewer/tickets";
import { evaluateSubmissionReadiness, evaluateAdminPublishReadiness } from "@/lib/reviewer/publishGate";
import type { GenePageDraft, SentencedText } from "@/lib/geneResearch/types";

function sourced(text = "Some real content.", sourceIds = ["pubmed:1"]): SentencedText {
  return { sentences: [{ text, sourceIds }] };
}

function completeDraft(): GenePageDraft {
  return {
    gene: "LCA5",
    summaryCard: sourced(),
    whatThisGeneMeans: sourced(),
    howItMayAffectVision: sourced(),
    whatIsKnown: sourced(),
    whatIsUncertain: sourced(),
    whatYouCanDoNext: sourced("Next steps.", ["rphope-resource:x"]),
    questionsForClinician: ["q1"],
    forFamilyAndCaregivers: sourced("Caregiver guidance.", ["rphope-resource:x"]),
    treatmentAndResearch: sourced(),
    clinicalTrialSummary: sourced(),
    researchCards: [],
    sources: [
      { id: "pubmed:1", type: "pubmed", title: "x", url: "https://pubmed.ncbi.nlm.nih.gov/1/" },
      { id: "rphope-resource:x", type: "rphope-resource", title: "x", url: "/x" },
    ],
    reviewFlags: [],
    reviewStatus: "unreviewed",
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("ticket status helpers", () => {
  it("resolved and closed are the only non-open statuses", () => {
    expect(isOpenTicketStatus("open")).toBe(true);
    expect(isOpenTicketStatus("waiting_for_reviewer")).toBe(true);
    expect(isOpenTicketStatus("resolved")).toBe(false);
    expect(isOpenTicketStatus("closed")).toBe(false);
  });

  it("a ticket only gates the workflow when it is BOTH blocking and open", () => {
    expect(isBlockingOpenTicket({ blocking: true, status: "open" })).toBe(true);
    expect(isBlockingOpenTicket({ blocking: false, status: "open" })).toBe(false);
    expect(isBlockingOpenTicket({ blocking: true, status: "resolved" })).toBe(false);
  });

  it("counts only blocking+open tickets, ignoring non-blocking or closed ones", () => {
    const tickets = [
      { blocking: true, status: "open" as const },
      { blocking: true, status: "resolved" as const },
      { blocking: false, status: "open" as const },
      { blocking: true, status: "waiting_for_reviewer" as const },
    ];
    expect(countBlockingOpenTickets(tickets)).toBe(2);
    expect(countOpenTickets(tickets)).toBe(3);
  });
});

describe("a blocking open ticket gates both submission and publication", () => {
  const base = {
    draft: completeDraft(),
    flagCount: 0,
    resolutions: [],
    confirmationChecked: true,
  };

  it("blocks reviewer submission with a clear, specific message", () => {
    const r = evaluateSubmissionReadiness({
      ...base,
      isAssignedReviewer: true,
      openBlockingTicketCount: 1,
    });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/blocking ticket/i);
  });

  it("blocks admin publication the same way", () => {
    const r = evaluateAdminPublishReadiness({
      ...base,
      isAdmin: true,
      adminCanPublish: true,
      reviewStatus: "submitted_for_approval",
      openBlockingTicketCount: 2,
    });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/2 blocking tickets/i);
  });

  it("does NOT block when the only open tickets are non-blocking", () => {
    const r = evaluateSubmissionReadiness({
      ...base,
      isAssignedReviewer: true,
      openBlockingTicketCount: 0,
    });
    expect(r.canProceed).toBe(true);
  });
});

describe("review_tickets / ticket_replies — RLS guarantees (static)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0010_review_tickets.sql"), "utf8");

  it("a reviewer can only see tickets they filed; admins see all", () => {
    expect(sql).toMatch(/rt_select[\s\S]*created_by = auth\.uid\(\) or auth_is_admin\(\)/);
  });

  it("only an admin can update ticket status/severity/blocking/assignment", () => {
    expect(sql).toMatch(/rt_update[\s\S]*for update using \(auth_is_admin\(\)\)/);
  });

  it("internal_note replies are excluded from the non-admin read policy", () => {
    expect(sql).toMatch(/trep_select[\s\S]*not internal_note/);
  });

  it("a reviewer can only insert non-internal replies on their own tickets", () => {
    expect(sql).toMatch(/trep_insert[\s\S]*not internal_note/);
  });
});
