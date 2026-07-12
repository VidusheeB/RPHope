// Post-generation validation and rejection. Per the pipeline spec, the whole
// draft is rejected if:
//   - it includes an unknown source ID (not in the supplied evidence bundle);
//   - required retrieval failed — enforced upstream, before generation even
//     runs (see pipeline.ts); this module only re-checks source IDs and
//     schema validity, which can only be known after generation;
//   - the human gene was not verified — same, enforced upstream;
//   - the structured result fails validation (checked here with Ajv, as a
//     defense-in-depth check beyond trusting the API's Structured Outputs
//     guarantee).

import Ajv from "ajv";
import { GENE_PAGE_SCHEMA } from "./schema";
import { allValidSourceIds } from "./types";
import type { GenePageDraft, GeneSourceBundle, RejectReason, ValidationResult } from "./types";

const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(GENE_PAGE_SCHEMA);

/** Schema-only validation (no evidence bundle needed) — used by the reviewer
 *  publish gate, which validates a draft's structure independently of any
 *  original retrieval bundle. */
export function validateDraftSchemaOnly(
  draft: unknown
): { ok: true } | { ok: false; error: string } {
  if (validateSchema(draft)) return { ok: true };
  return { ok: false, error: ajv.errorsText(validateSchema.errors, { separator: "; " }) };
}

/** Source IDs cited in the draft's PROSE and research cards only (excludes the
 *  `sources` registry array itself). */
function proseCitedSourceIds(draft: GenePageDraft): string[] {
  const ids: string[] = [];
  const sourcedFields: (keyof GenePageDraft)[] = [
    "summaryCard",
    "whatThisGeneMeans",
    "howItMayAffectVision",
    "whatIsKnown",
    "whatIsUncertain",
    "whatYouCanDoNext",
    "forFamilyAndCaregivers",
    "treatmentAndResearch",
    "clinicalTrialSummary",
  ];
  for (const field of sourcedFields) {
    const value = draft[field] as { sourceIds?: string[] } | undefined;
    if (value?.sourceIds) ids.push(...value.sourceIds);
  }
  for (const card of draft.researchCards ?? []) ids.push(...(card.sourceIds ?? []));
  return Array.from(new Set(ids));
}

/** Every source ID cited in the draft's prose/cards must appear in its own
 *  `sources` registry. Reused by the publish gate ("all source IDs valid"). */
export function allCitedSourcesPresent(
  draft: GenePageDraft
): { ok: true } | { ok: false; missing: string[] } {
  const declared = new Set((draft.sources ?? []).map((s) => s.id));
  const missing = proseCitedSourceIds(draft).filter((id) => !declared.has(id));
  return missing.length ? { ok: false, missing } : { ok: true };
}

/** Collect every source ID referenced anywhere in the draft. */
export function citedSourceIds(draft: GenePageDraft): string[] {
  const ids: string[] = [];
  const sourcedFields: (keyof GenePageDraft)[] = [
    "summaryCard",
    "whatThisGeneMeans",
    "howItMayAffectVision",
    "whatIsKnown",
    "whatIsUncertain",
    "whatYouCanDoNext",
    "forFamilyAndCaregivers",
    "treatmentAndResearch",
    "clinicalTrialSummary",
  ];
  for (const field of sourcedFields) {
    const value = draft[field] as { sourceIds?: string[] } | undefined;
    if (value?.sourceIds) ids.push(...value.sourceIds);
  }
  for (const card of draft.researchCards ?? []) {
    ids.push(...(card.sourceIds ?? []));
  }
  for (const source of draft.sources ?? []) {
    if (source.id) ids.push(source.id);
  }
  return ids;
}

export function validateDraft(
  draft: GenePageDraft,
  bundle: GeneSourceBundle
): ValidationResult {
  const reasons: RejectReason[] = [];

  // 1. Schema validation (defense in depth beyond the API's own guarantee).
  if (!validateSchema(draft)) {
    const detail = ajv.errorsText(validateSchema.errors, { separator: "; " });
    reasons.push({ code: "schema_validation_failed", detail });
  }

  // 2. Unknown source ID check.
  const valid = allValidSourceIds(bundle);
  const cited = citedSourceIds(draft);
  const unknown = Array.from(new Set(cited.filter((id) => !valid.has(id))));
  if (unknown.length > 0) {
    reasons.push({
      code: "unknown_source_id",
      detail: `Cited source ID(s) not in the supplied evidence bundle: ${unknown.join(", ")}`,
    });
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
