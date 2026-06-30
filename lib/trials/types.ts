// Clinical Trials Finder — shared types.
//
// GOVERNANCE: This tool surfaces clinical trials and research opportunities that
// "may be relevant to review." It does NOT determine eligibility or give medical
// advice. AI may classify relevance and write plain-English explanation copy, but
// every medical/scientific claim stays bounded to a real trial record's fields and
// is framed as "may be relevant" / "ask the study team" — never "you qualify."

// ---- Structured trial record (the source-grounded data) -------------------

export type TrialRecord = {
  id: string; // e.g. NCT id
  source: "clinicaltrials_gov" | "manual" | "other";
  source_url: string;
  title: string;
  brief_summary?: string;
  official_summary?: string;
  status: string; // raw registry status, e.g. "RECRUITING"
  conditions: string[];
  genes: string[];
  gene_scope: "gene_specific" | "gene_agnostic" | "unknown_or_mixed";
  study_type?: "interventional" | "observational" | "registry" | "screening" | "unknown";
  intervention_names?: string[];
  phase?: string;
  age_min?: number; // years
  age_max?: number; // years
  accepts_healthy_volunteers?: boolean;
  countries: string[];
  locations: {
    facility?: string;
    city?: string;
    region?: string;
    country: string;
    lat?: number;
    lng?: number;
  }[];
  eligibility_text?: string;
  contacts?: {
    name?: string;
    email?: string;
    phone?: string;
  }[];
  last_synced_at: string;
  // mirrors the site's content-governance status field. Live CT.gov records are
  // an official registry source, so they are treated as "published" by default;
  // any manually-authored record should default to "pending_review".
  status_review: "draft" | "pending_review" | "published";
};

// ---- User intake ----------------------------------------------------------

export type GeneStatus = "known" | "unknown" | "in_progress" | "vus_uncertain" | "not_sure";
export type AgeGroup =
  | "under_6"
  | "6_11"
  | "12_17"
  | "18_64"
  | "65_plus"
  | "prefer_not";
export type TravelScope =
  | "near_me"
  | "state_region"
  | "country"
  | "international"
  | "remote_only"
  | "not_sure";
export type OpportunityType =
  | "treatment"
  | "observational"
  | "registry"
  | "screening"
  | "any"
  | "not_sure";
export type RecruitingPreference =
  | "recruiting_only"
  | "recruiting_or_not_yet"
  | "active_and_past"
  | "not_sure";

export type TrialFinderIntake = {
  search_for: string;
  condition_input: string;
  normalized_condition?: string;
  condition_confidence?: "high" | "medium" | "low";
  gene_status: GeneStatus;
  raw_gene_input?: string;
  normalized_gene?: string;
  gene_confidence?: "high" | "medium" | "low";
  gene_match_source?: string;
  age_group?: AgeGroup;
  country: string;
  city?: string;
  postal_code?: string;
  location_precision?: "country" | "city" | "postal_code" | "none";
  travel_scope: TravelScope;
  travel_radius_km?: 40 | 80 | 160 | 400;
  opportunity_type_preference: OpportunityType;
  recruiting_preference: RecruitingPreference;
  has_genetic_report?: "yes" | "no" | "in_progress" | "uncertain" | "not_sure";
  recent_eye_exam_status?: "within_year" | "over_year" | "no" | "not_sure";
  user_goal?: string;
  summary_preference?: string;
};

// ---- AI relevance classification (per trial) ------------------------------

export type RelevanceCategory =
  | "strong_review_candidate"
  | "possible_review_candidate"
  | "broad_gene_agnostic_option"
  | "registry_or_observational"
  | "not_relevant"
  | "needs_clarification";

export type MatchType =
  | "gene_specific"
  | "condition_specific"
  | "gene_agnostic"
  | "registry"
  | "observational"
  | "unclear";

export type TrialClassification = {
  trial_id: string;
  relevance_category: RelevanceCategory;
  match_type: MatchType;
  matched_factors: string[];
  missing_information: string[];
  confidence: "high" | "medium" | "low";
  plain_english_reason: string;
  study_team_questions: string[];
};

// A trial paired with its classification, ready to render as a card.
export type ScoredTrial = {
  trial: TrialRecord;
  classification: TrialClassification;
  rankScore: number;
};

// Result sections, in display order.
export type TrialResultSections = {
  bestMatches: ScoredTrial[];
  broaderOptions: ScoredTrial[];
  registriesObservational: ScoredTrial[];
  otherStudies: ScoredTrial[];
};

export type TrialMatchResponse = {
  sections: TrialResultSections;
  totalConsidered: number;
  totalShown: number;
  geneKnown: boolean;
  normalizedGene?: string;
  normalizedCondition?: string;
  // a top-of-results explanation line tailored to known/unknown gene
  contextNote: string;
  noResults: boolean;
};

// ---- Display labels (single source of truth for card chips) ---------------

export const RELEVANCE_LABELS: Record<RelevanceCategory, string> = {
  strong_review_candidate: "Strong review candidate",
  possible_review_candidate: "Possible review candidate",
  broad_gene_agnostic_option: "Broader RP/IRD option",
  registry_or_observational: "Registry or observational study",
  not_relevant: "Not relevant",
  needs_clarification: "Needs more information",
};

export const DISCLAIMER =
  "RP Hope helps surface clinical trials and research opportunities that may be relevant to review. This tool does not determine eligibility, provide medical advice, or recommend treatment. Only the study team or a qualified clinician can confirm whether a study is appropriate for a specific person.";
