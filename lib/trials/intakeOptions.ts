// Option data for the Clinical Trials Finder intake form.
// Country names are spelled to match ClinicalTrials.gov location values so the
// deterministic country ranking in match.ts lines up.

export const COUNTRIES: string[] = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Australia",
  "New Zealand",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Portugal",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czechia",
  "Hungary",
  "Greece",
  "Turkey",
  "Israel",
  "Saudi Arabia",
  "United Arab Emirates",
  "Egypt",
  "South Africa",
  "India",
  "Pakistan",
  "China",
  "Japan",
  "South Korea",
  "Taiwan",
  "Hong Kong",
  "Singapore",
  "Malaysia",
  "Thailand",
  "Indonesia",
  "Philippines",
  "Vietnam",
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "Mexico",
  "Russian Federation",
  "Ukraine",
  "Romania",
  "Other",
];

export type IntakeOption = { value: string; label: string; helper?: string };

export const SEARCH_FOR: IntakeOption[] = [
  { value: "myself", label: "Myself" },
  { value: "child", label: "My child or dependent" },
  { value: "family", label: "A family member" },
  { value: "care_for", label: "Someone I care for" },
  { value: "browsing", label: "I'm browsing or researching" },
];

export const CONDITIONS: IntakeOption[] = [
  { value: "retinitis pigmentosa", label: "Retinitis pigmentosa" },
  { value: "usher syndrome", label: "Usher syndrome" },
  { value: "leber congenital amaurosis", label: "Leber congenital amaurosis" },
  { value: "stargardt disease", label: "Stargardt disease" },
  { value: "cone-rod dystrophy", label: "Cone-rod dystrophy" },
  { value: "inherited retinal disease", label: "Other inherited retinal disease" },
  { value: "__not_sure__", label: "Not sure" },
];

export const GENE_STATUS: IntakeOption[] = [
  { value: "known", label: "Yes" },
  { value: "unknown", label: "No" },
  { value: "in_progress", label: "Genetic testing is in progress" },
  { value: "vus_uncertain", label: "The result was uncertain / VUS" },
  { value: "not_sure", label: "I'm not sure" },
];

export const AGE_GROUPS: IntakeOption[] = [
  { value: "under_6", label: "Under 6" },
  { value: "6_11", label: "6–11" },
  { value: "12_17", label: "12–17" },
  { value: "18_64", label: "18–64" },
  { value: "65_plus", label: "65+" },
  { value: "prefer_not", label: "Prefer not to say" },
];

export const TRAVEL_SCOPE: IntakeOption[] = [
  { value: "near_me", label: "Near me" },
  { value: "state_region", label: "Anywhere in my state / province / region" },
  { value: "country", label: "Anywhere in my country" },
  { value: "international", label: "International options are okay" },
  { value: "remote_only", label: "Remote / online only" },
  { value: "not_sure", label: "Not sure" },
];

export const TRAVEL_RADIUS: IntakeOption[] = [
  { value: "40", label: "Within 25 miles / 40 km" },
  { value: "80", label: "Within 50 miles / 80 km" },
  { value: "160", label: "Within 100 miles / 160 km" },
  { value: "400", label: "Within 250 miles / 400 km" },
];

export const OPPORTUNITY_TYPE: IntakeOption[] = [
  { value: "treatment", label: "Treatment or intervention trial" },
  { value: "observational", label: "Observational or natural history study" },
  { value: "registry", label: "Patient registry" },
  { value: "screening", label: "Genetic testing or screening study" },
  { value: "any", label: "Any of the above" },
  { value: "not_sure", label: "Not sure" },
];

export const RECRUITING: IntakeOption[] = [
  { value: "recruiting_only", label: "Yes, recruiting only" },
  { value: "recruiting_or_not_yet", label: "Recruiting or not-yet-recruiting" },
  { value: "active_and_past", label: "Show active and past studies" },
  { value: "not_sure", label: "Not sure" },
];

export const HAS_REPORT: IntakeOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "in_progress", label: "Testing is in progress" },
  { value: "uncertain", label: "The result was uncertain" },
  { value: "not_sure", label: "Not sure" },
];

export const EYE_EXAM: IntakeOption[] = [
  { value: "within_year", label: "Yes, within the last year" },
  { value: "over_year", label: "Yes, but more than a year ago" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
];

export const USER_GOAL: IntakeOption[] = [
  { value: "find_trials", label: "Find possible trials to review" },
  { value: "understand_research", label: "Understand what research exists" },
  { value: "prepare_questions", label: "Prepare questions for my doctor" },
  { value: "gene_specific", label: "Find gene-specific research" },
  { value: "registry", label: "Join a registry or stay updated" },
  { value: "exploring", label: "I'm just exploring" },
];

export const SUMMARY_PREFERENCE: IntakeOption[] = [
  { value: "everyday", label: "Easy-to-read summary" },
  { value: "scientific", label: "More scientific detail" },
  { value: "ask_team", label: "What to ask the study team" },
  { value: "eligibility_points", label: "Key eligibility points" },
  { value: "location_contact", label: "Location / contact info first" },
];
