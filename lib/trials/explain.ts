// AI relevance classification + plain-English explanation, with a deterministic
// fallback so the page works with no API key and never dead-ends.
//
// GOVERNANCE: the model may classify how relevant a trial is to review and write
// "may be relevant" explanation copy, but it is grounded ONLY in the real trial
// fields we pass and is forbidden from saying anyone "qualifies" or "is eligible."
// Eligibility is always deferred to the study team. Categories are a fixed enum;
// anything off-enum is repaired or replaced with the deterministic classifier.

import Anthropic from "@anthropic-ai/sdk";
import type {
  MatchType,
  RelevanceCategory,
  TrialClassification,
  TrialFinderIntake,
  TrialRecord,
} from "./types";
import { canonGene } from "./geneUtil";

// Opus: this is low-volume, quality-critical, governed content (mirrors the
// research-pulling element's model choice). Site search uses Haiku; this doesn't.
const MODEL = "claude-opus-4-8";

// Cap how many trials go to the model per request; the rest get a deterministic
// (still safe, still "may be relevant") classification. Keeps latency/cost bounded.
const MAX_AI_TRIALS = 20;

const VALID_CATEGORIES: RelevanceCategory[] = [
  "strong_review_candidate",
  "possible_review_candidate",
  "broad_gene_agnostic_option",
  "registry_or_observational",
  "not_relevant",
  "needs_clarification",
];
const VALID_MATCH_TYPES: MatchType[] = [
  "gene_specific",
  "condition_specific",
  "gene_agnostic",
  "registry",
  "observational",
  "unclear",
];

function userGeneConfirmed(intake: TrialFinderIntake): string | undefined {
  return intake.gene_status === "known" ? intake.normalized_gene : undefined;
}

// ---- Deterministic fallback classifier ------------------------------------

export function deterministicClassify(
  trial: TrialRecord,
  intake: TrialFinderIntake,
): TrialClassification {
  const confirmed = userGeneConfirmed(intake);
  const mentionsGene =
    confirmed != null &&
    trial.genes.some((g) => canonGene(g) === canonGene(confirmed));

  let match_type: MatchType = "unclear";
  if (mentionsGene) match_type = "gene_specific";
  else if (trial.study_type === "registry") match_type = "registry";
  else if (trial.study_type === "observational") match_type = "observational";
  else if (trial.gene_scope === "gene_agnostic") match_type = "condition_specific";

  let relevance_category: RelevanceCategory = "possible_review_candidate";
  if (mentionsGene) relevance_category = "strong_review_candidate";
  else if (trial.study_type === "registry" || trial.study_type === "observational")
    relevance_category = "registry_or_observational";
  else if (trial.gene_scope === "gene_agnostic")
    relevance_category = "broad_gene_agnostic_option";

  const matched_factors: string[] = [];
  if (mentionsGene && confirmed) matched_factors.push(confirmed);
  if (intake.normalized_condition) matched_factors.push(intake.normalized_condition);
  if (trial.status.toUpperCase() === "RECRUITING") matched_factors.push("recruiting");

  const subject = mentionsGene && confirmed ? confirmed : "inherited retinal disease";
  return {
    trial_id: trial.id,
    relevance_category,
    match_type,
    matched_factors,
    missing_information: [
      "full eligibility criteria",
      "study team confirmation",
    ],
    confidence: mentionsGene ? "medium" : "low",
    plain_english_reason: `This may be relevant to review because it relates to ${subject}${
      trial.status.toUpperCase() === "RECRUITING" ? " and is currently recruiting" : ""
    }. Only the study team can confirm whether it fits a specific person.`,
    study_team_questions: [
      "What are the full eligibility criteria for this study?",
      "What records (genetic testing, eye exams, imaging) should I have ready before contacting the site?",
    ],
  };
}

// ---- AI classification -----------------------------------------------------

// Compact, allowed-fields-only view handed to the model.
function trialForPrompt(t: TrialRecord) {
  return {
    trial_id: t.id,
    title: t.title,
    status: t.status,
    study_type: t.study_type,
    phase: t.phase,
    conditions: t.conditions.slice(0, 6),
    genes_detected: t.genes,
    gene_scope: t.gene_scope,
    interventions: (t.intervention_names || []).slice(0, 6),
    age_min: t.age_min,
    age_max: t.age_max,
    countries: t.countries.slice(0, 12),
    brief_summary: (t.brief_summary || "").slice(0, 700),
  };
}

function profileForPrompt(intake: TrialFinderIntake) {
  return {
    searching_for: intake.search_for,
    condition: intake.normalized_condition || intake.condition_input,
    gene_status: intake.gene_status,
    confirmed_gene: userGeneConfirmed(intake) || null,
    age_group: intake.age_group || "prefer_not",
    country: intake.country,
    travel_scope: intake.travel_scope,
    opportunity_preference: intake.opportunity_type_preference,
    summary_preference: intake.summary_preference || "everyday_language",
    goal: intake.user_goal || null,
  };
}

function buildSystemPrompt(): string {
  return `You classify how relevant clinical trials and research studies MAY BE for a person affected by retinitis pigmentosa or another inherited retinal disease (IRD), so they can decide what is worth reviewing.

You are NOT determining eligibility and NOT giving medical advice. You may say a study "may be relevant to review," "is worth asking the study team about," or "appears related to" — you must NEVER say a person "qualifies," "is eligible," "should enroll," or that a study is "recommended" or "the best option."

You are given a USER PROFILE and a list of TRIALS (already pre-filtered for RP/IRD relevance and safety). For EACH trial, classify it using ONLY the fields provided — never invent facts, gene names, locations, or criteria not present in the trial data.

relevance_category (choose exactly one):
- "strong_review_candidate": clearly matches the user's confirmed gene/condition AND is an active opportunity worth reviewing first.
- "possible_review_candidate": plausibly relevant but with notable uncertainty (e.g. gene not confirmed by user, partial condition match).
- "broad_gene_agnostic_option": a broad RP/IRD study not limited to one specific gene.
- "registry_or_observational": a registry, natural-history, or observational study.
- "needs_clarification": relevance can't be judged from the available fields.
- "not_relevant": not meaningfully related to RP/IRD (use sparingly; these are dropped).

IMPORTANT: If the user has NOT confirmed a gene (gene_status is not "known"), do NOT mark any gene-specific study as "strong_review_candidate" — at most "possible_review_candidate" — and lean toward broad studies, registries, and observational studies.

match_type: one of "gene_specific", "condition_specific", "gene_agnostic", "registry", "observational", "unclear".
confidence: one of "high", "medium", "low". If low, prefer a lower category and clear uncertainty.

For each trial also produce:
- matched_factors: short strings naming what lined up (e.g. "RPGR", "retinitis pigmentosa", "recruiting"). Only things actually present in the trial fields.
- missing_information: what the user/study team would still need (always include study-team confirmation of eligibility).
- plain_english_reason: ONE warm, clear sentence on why it may be relevant to review. Match the user's summary_preference in tone. Never claim eligibility.
- study_team_questions: 2 concrete questions the user could ask the study team.

Respond with ONLY a JSON array (no markdown fences, no prose) where each element is:
{"trial_id": string, "relevance_category": string, "match_type": string, "matched_factors": string[], "missing_information": string[], "confidence": "high"|"medium"|"low", "plain_english_reason": string, "study_team_questions": string[]}`;
}

function coerce(
  raw: unknown,
  trial: TrialRecord,
  intake: TrialFinderIntake,
): TrialClassification {
  const fallback = deterministicClassify(trial, intake);
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const category = VALID_CATEGORIES.includes(r.relevance_category as RelevanceCategory)
    ? (r.relevance_category as RelevanceCategory)
    : fallback.relevance_category;
  const matchType = VALID_MATCH_TYPES.includes(r.match_type as MatchType)
    ? (r.match_type as MatchType)
    : fallback.match_type;
  const conf = ["high", "medium", "low"].includes(r.confidence as string)
    ? (r.confidence as "high" | "medium" | "low")
    : fallback.confidence;
  const strArr = (v: unknown, fb: string[]) =>
    Array.isArray(v) && v.every((x) => typeof x === "string") && v.length
      ? (v as string[]).slice(0, 5)
      : fb;
  return {
    trial_id: trial.id,
    relevance_category: category,
    match_type: matchType,
    matched_factors: strArr(r.matched_factors, fallback.matched_factors),
    missing_information: strArr(r.missing_information, fallback.missing_information),
    confidence: conf,
    plain_english_reason:
      typeof r.plain_english_reason === "string" && r.plain_english_reason.trim()
        ? r.plain_english_reason.trim()
        : fallback.plain_english_reason,
    study_team_questions: strArr(r.study_team_questions, fallback.study_team_questions),
  };
}

export async function classifyTrials(
  trials: TrialRecord[],
  intake: TrialFinderIntake,
): Promise<TrialClassification[]> {
  if (trials.length === 0) return [];

  const aiTrials = trials.slice(0, MAX_AI_TRIALS);
  const overflow = trials.slice(MAX_AI_TRIALS);
  const overflowCls = overflow.map((t) => deterministicClassify(t, intake));

  if (!process.env.ANTHROPIC_API_KEY) {
    return [...aiTrials.map((t) => deterministicClassify(t, intake)), ...overflowCls];
  }

  try {
    const client = new Anthropic();
    const payload = {
      user_profile: profileForPrompt(intake),
      trials: aiTrials.map(trialForPrompt),
    };
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" }, // stable prompt → cache across requests
        },
      ],
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```json\s*|\s*```$/g, "");

    const parsed = JSON.parse(text) as unknown[];
    const byId = new Map<string, unknown>();
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const tid = (item as Record<string, unknown>)?.trial_id;
        if (typeof tid === "string") byId.set(tid, item);
      }
    }
    const aiCls = aiTrials.map((t) => coerce(byId.get(t.id), t, intake));
    return [...aiCls, ...overflowCls];
  } catch {
    // any model/parse/network failure → deterministic, never a dead end
    return [...aiTrials.map((t) => deterministicClassify(t, intake)), ...overflowCls];
  }
}
