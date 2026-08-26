// GENE_PAGE_SCHEMA — the JSON schema Structured Outputs enforces on Opus's
// response (output_config.format.schema). Field names and shape match
// lib/geneResearch/types.ts GenePageDraft exactly.
//
// reviewStatus and generatedAt are included per the generation spec, but the
// PIPELINE (lib/geneResearch/generate.ts) overwrites both after parsing —
// never trusting the model's self-reported governance status or timestamp is
// a deliberate defense-in-depth measure, not a schema gap.
//
// NOTE: the nine `sentencedText` sections are declared ONCE in `$defs` and
// referenced with `$ref`, rather than inlined nine times. This is required, not
// cosmetic: Structured Outputs compiles the schema into a decoding grammar, and
// nine inline copies of a nested array-of-objects-with-arrays expanded past the
// compiler's ceiling — every request failed with 400 "The compiled grammar is
// too large". Sharing one rule fixes it (and halves the schema, 4.2KB -> 2.2KB).
// Keep new repeated sub-objects in `$defs` for the same reason.
//
// NOTE: Anthropic's Structured Outputs rejects `maxItems` on array schemas
// (confirmed against the live API: "For 'array' type, property 'maxItems' is
// not supported" — a real API constraint, not a guess). The "max 5 research
// cards" / "max 6 clinician questions" limits are therefore enforced by the
// PROMPT (generation_requirements in prompts.ts) plus a defensive truncation
// in generate.ts that trims overshoots and adds a reviewFlag — belt and
// suspenders, since a prompt instruction alone isn't a hard guarantee.

// A section's prose broken into individually-cited sentences — each
// sentence carries only the source ID(s) that specifically support it, not
// the whole section's citation list. This is the sentence-to-source mapping
// the review workspace needs; everything else about the pipeline (which
// evidence gets retrieved, ranked, and supplied) is unchanged.
const citedSentence = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" },
    sourceIds: { type: "array", items: { type: "string" } },
  },
  required: ["text", "sourceIds"],
};

const sentencedText = {
  type: "object",
  additionalProperties: false,
  properties: {
    sentences: { type: "array", items: { $ref: "#/$defs/citedSentence" } },
  },
  required: ["sentences"],
};

/** Every section that is prose broken into individually-cited sentences.
 *  Referenced, never inlined — see the grammar-size note above. */
const sentencedTextRef = { $ref: "#/$defs/sentencedText" };

const researchCard = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    whatWasStudied: { type: "string" },
    whatWasFound: { type: "string" },
    whyItMatters: { type: "string" },
    evidenceType: { type: "string" },
    limitation: { type: "string" },
    sourceIds: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "whatWasStudied",
    "whatWasFound",
    "whyItMatters",
    "evidenceType",
    "limitation",
    "sourceIds",
  ],
};

const sourceCitation = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: {
      type: "string",
      enum: ["pubmed", "europepmc", "clinicaltrials", "ncbi-gene", "rphope-resource", "web"],
    },
    title: { type: "string" },
    url: { type: "string" },
  },
  required: ["id", "type", "title", "url"],
};

export const GENE_PAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  $defs: { citedSentence, sentencedText },
  properties: {
    gene: { type: "string" },
    summaryCard: sentencedTextRef,
    whatThisGeneMeans: sentencedTextRef,
    howItMayAffectVision: sentencedTextRef,
    whatIsKnown: sentencedTextRef,
    whatIsUncertain: sentencedTextRef,
    whatYouCanDoNext: sentencedTextRef,
    questionsForClinician: { type: "array", items: { type: "string" } },
    forFamilyAndCaregivers: sentencedTextRef,
    treatmentAndResearch: sentencedTextRef,
    clinicalTrialSummary: sentencedTextRef,
    researchCards: { type: "array", items: researchCard },
    sources: { type: "array", items: sourceCitation },
    reviewFlags: { type: "array", items: { type: "string" } },
    reviewStatus: { type: "string", enum: ["unreviewed"] },
    generatedAt: { type: "string" },
  },
  required: [
    "gene",
    "summaryCard",
    "whatThisGeneMeans",
    "howItMayAffectVision",
    "whatIsKnown",
    "whatIsUncertain",
    "whatYouCanDoNext",
    "questionsForClinician",
    "forFamilyAndCaregivers",
    "treatmentAndResearch",
    "clinicalTrialSummary",
    "researchCards",
    "sources",
    "reviewFlags",
    "reviewStatus",
    "generatedAt",
  ],
} as const;

/** The top-level keys the spec requires, used by a test to guard against drift. */
export const GENE_PAGE_TOP_LEVEL_FIELDS = [
  "gene",
  "summaryCard",
  "whatThisGeneMeans",
  "howItMayAffectVision",
  "whatIsKnown",
  "whatIsUncertain",
  "whatYouCanDoNext",
  "questionsForClinician",
  "forFamilyAndCaregivers",
  "treatmentAndResearch",
  "clinicalTrialSummary",
  "researchCards",
  "sources",
  "reviewFlags",
  "reviewStatus",
  "generatedAt",
] as const;
