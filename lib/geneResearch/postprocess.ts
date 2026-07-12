// Post-generation enforcement of limits the JSON schema can't express.
// Anthropic's Structured Outputs rejects `maxItems` on array schemas, so the
// "max 5 research cards" / "max 6 clinician questions" limits from the spec
// are prompt instructions, not schema guarantees. This is the belt-and-
// suspenders backstop: if Opus overshoots anyway, we trim rather than publish
// (never possible, since everything is `unreviewed`) or silently accept an
// over-long draft — and we flag it so a reviewer knows a trim happened.

import type { GenePageDraft } from "./types";

const MAX_RESEARCH_CARDS = 5;
const MAX_CLINICIAN_QUESTIONS = 6;

export function enforceLimits(draft: GenePageDraft): GenePageDraft {
  const flags: string[] = [...draft.reviewFlags];

  let researchCards = draft.researchCards;
  if (researchCards.length > MAX_RESEARCH_CARDS) {
    flags.push(
      `Model returned ${researchCards.length} research cards; truncated to ${MAX_RESEARCH_CARDS}.`
    );
    researchCards = researchCards.slice(0, MAX_RESEARCH_CARDS);
  }

  let questionsForClinician = draft.questionsForClinician;
  if (questionsForClinician.length > MAX_CLINICIAN_QUESTIONS) {
    flags.push(
      `Model returned ${questionsForClinician.length} clinician questions; truncated to ${MAX_CLINICIAN_QUESTIONS}.`
    );
    questionsForClinician = questionsForClinician.slice(0, MAX_CLINICIAN_QUESTIONS);
  }

  return { ...draft, researchCards, questionsForClinician, reviewFlags: flags };
}
