// My RP Pathway — a guided, personalized JOURNEY through the RP Hope website.
//
// This is a navigation tool, NOT medical advice and NOT a recommendation engine.
// buildPathway() maps a visitor's answers to an ordered "website tour": a first
// stop, a logical sequence of next stops, and optional deeper stops — always
// routing to existing, reviewed RP Hope pages. Logic is deterministic (rules, no
// AI) so it is predictable and safe to review for medical-adjacent content.

import { geneGrid } from "@/lib/geneGrid";

// ---- Quiz definition -------------------------------------------------------

export type Option = { value: string; label: string };

export type Question = {
  id: keyof PathwayAnswers;
  prompt: string;
  helper?: string;
  options: Option[];
  // Only show this question when the predicate passes (progressive disclosure).
  showIf?: (a: PathwayAnswers) => boolean;
  // Special render: a searchable gene selector instead of option buttons.
  geneSelector?: boolean;
};

export type PathwayAnswers = {
  role?: string;
  startingPoint?: string;
  geneStatus?: string;
  selectedGene?: string;
  mainGoal?: string;
  researchInterest?: string;
  navigationPreference?: string;
};

export const questions: Question[] = [
  {
    id: "role",
    prompt: "Which best describes you?",
    options: [
      { value: "living_with_rp", label: "I am living with RP" },
      { value: "caregiver", label: "I am a parent or caregiver" },
      { value: "newly", label: "I am newly diagnosed" },
      { value: "gene_info", label: "I am looking for gene-specific information" },
      { value: "research", label: "I am interested in research or clinical trials" },
      { value: "clinician", label: "I am a clinician, researcher, or advocate" },
      { value: "unsure", label: "I am not sure yet" },
    ],
  },
  {
    id: "startingPoint",
    prompt: "Where would you like to start?",
    options: [
      { value: "understand", label: "I want to understand what RP is" },
      { value: "help_begin", label: "I want help figuring out where to begin" },
      { value: "know_basics", label: "I already know the basics" },
      { value: "gene", label: "I want to go straight to gene information" },
      { value: "research", label: "I want to learn about research or clinical trials" },
      { value: "community", label: "I want to find community stories or support" },
    ],
  },
  {
    id: "geneStatus",
    prompt: "Do you know the gene connected to your or your family member's RP?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Not sure" },
      { value: "waiting", label: "Waiting for genetic testing results" },
    ],
  },
  {
    id: "selectedGene",
    prompt: "Which gene are you looking for?",
    helper: "Start typing to search RP Hope's gene library.",
    geneSelector: true,
    showIf: (a) => a.geneStatus === "yes",
    options: [],
  },
  {
    id: "mainGoal",
    prompt: "What are you mainly looking for today?",
    options: [
      { value: "easy_read", label: "An easy-to-read explanation" },
      { value: "technical", label: "Technical or scientific detail" },
      { value: "trials", label: "Clinical trial information" },
      { value: "research", label: "Research updates" },
      { value: "stories", label: "Stories from other families" },
      { value: "events", label: "Events or community support" },
      { value: "support", label: "Ways to support RP Hope" },
    ],
  },
  {
    id: "researchInterest",
    prompt: "Are you interested in research or clinical trials?",
    options: [
      { value: "trials", label: "Yes, clinical trials" },
      { value: "research", label: "Yes, research updates" },
      { value: "both", label: "Both" },
      { value: "not_now", label: "Not right now" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: "navigationPreference",
    prompt: "What would make the site easier to use?",
    options: [
      { value: "step_by_step", label: "Simple step-by-step guidance" },
      { value: "read_aloud", label: "Read-aloud support" },
      { value: "voice", label: "Voice navigation" },
      { value: "search_filters", label: "Search and filters" },
      { value: "none", label: "No preference" },
    ],
  },
];

// ---- Journey result types --------------------------------------------------

export type PathwayStop = {
  id: string;
  order: number;
  title: string;
  description: string;
  href: string;
  cta: string;
  label?: string;
  optional?: boolean;
};

export type PathwayResult = {
  title: string;
  subtitle: string;
  primaryPath: PathwayStop[];
  optionalStops: PathwayStop[];
  notes?: string[];
};

// ---- Stop templates (ids double as dedupe keys alongside href) -------------

type StopSeed = Omit<PathwayStop, "order">;

const STOP = {
  explore: {
    id: "explore",
    href: "/explore",
    title: "Explore RP Hope",
    cta: "Open Explore",
    description:
      "A quick map of everything on the site, so you can see where to begin.",
  },
  basics: {
    id: "basics",
    href: "/newly-diagnosed",
    title: "Start with RP Basics",
    cta: "Open RP Basics",
    description:
      "A clear, jargon-free overview of what RP is, why genetic testing matters, and your next steps.",
  },
  geneticInsights: {
    id: "genetic-insights",
    href: "/genetic-insights",
    title: "Explore Genetic Insights",
    cta: "Open Genetic Insights",
    description:
      "Browse RP Hope's gene library to see how gene information is organized and what research exists.",
  },
  clinicalTrials: {
    id: "clinical-trials",
    href: "/clinical-trials",
    title: "Explore Clinical Trials",
    cta: "Open Clinical Trials",
    description:
      "See how the Clinical Trials Finder can surface studies and registries that may be worth reviewing.",
  },
  stories: {
    id: "stories",
    href: "/stories",
    title: "Read Stories from Families",
    cta: "Open Stories",
    description:
      "Connect the information to real people navigating RP — diagnosis, testing, and daily life.",
  },
  events: {
    id: "events",
    href: "/events",
    title: "Find Community Events",
    cta: "Open Events",
    description: "See ways to stay connected with the RP Hope community.",
  },
  donate: {
    id: "donate",
    href: "/donate",
    title: "Support RP Hope",
    cta: "Open Support",
    description: "Learn about the ways you can help sustain RP Hope's work.",
  },
} satisfies Record<string, StopSeed>;

// ---- Helpers ---------------------------------------------------------------

export function getGeneHref(selectedGene?: string): {
  href: string;
  found: boolean;
  slug?: string;
} {
  const q = (selectedGene || "").trim().toLowerCase();
  if (!q) return { href: "/genetic-insights", found: false };
  const match =
    geneGrid.find((g) => g.display.toLowerCase() === q) ||
    geneGrid.find((g) => g.slug === q);
  return match
    ? { href: `/genetic-insights/${match.slug}`, found: true, slug: match.slug }
    : { href: "/genetic-insights", found: false };
}

export function knowsGene(a: PathwayAnswers): boolean {
  return a.geneStatus === "yes" && getGeneHref(a.selectedGene).found;
}

export function wantsResearch(a: PathwayAnswers): boolean {
  return (
    a.role === "research" ||
    a.startingPoint === "research" ||
    a.mainGoal === "trials" ||
    a.mainGoal === "research" ||
    a.researchInterest === "trials" ||
    a.researchInterest === "research" ||
    a.researchInterest === "both"
  );
}

export function wantsCommunity(a: PathwayAnswers): boolean {
  return (
    a.role === "caregiver" ||
    a.mainGoal === "stories" ||
    a.mainGoal === "events" ||
    a.startingPoint === "community"
  );
}

export function wantsSupport(a: PathwayAnswers): boolean {
  return a.mainGoal === "support";
}

// Add a stop only if neither its id nor its href is already present.
function addStopOnce(stops: PathwayStop[], seed: StopSeed, extra?: Partial<PathwayStop>) {
  if (stops.some((s) => s.id === seed.id || s.href === seed.href)) return;
  stops.push({ ...seed, order: stops.length + 1, ...extra });
}

// A gene-specific first stop when the visitor's gene has a real page.
function geneSeed(href: string): StopSeed {
  return {
    id: "gene",
    href,
    title: "Start with Your Gene Page",
    cta: "Open your gene page",
    description:
      "Begin with the gene most relevant to you — start with the overview, then read where treatment and research stand.",
  };
}

// ---- The journey builder ---------------------------------------------------

export function buildPathway(answers: PathwayAnswers): PathwayResult {
  const primaryPath: PathwayStop[] = [];
  const notes: string[] = [];
  const gene = getGeneHref(answers.selectedGene);
  const geneKnown = knowsGene(answers);

  // 1. First stop — the visitor's "Start here."
  if (answers.role === "newly" || answers.startingPoint === "understand") {
    addStopOnce(primaryPath, STOP.basics);
  } else if (answers.role === "caregiver") {
    addStopOnce(primaryPath, STOP.basics);
  } else if (geneKnown) {
    addStopOnce(primaryPath, geneSeed(gene.href));
  } else if (wantsResearch(answers)) {
    addStopOnce(primaryPath, STOP.geneticInsights);
  } else if (answers.role === "unsure" || answers.startingPoint === "help_begin") {
    addStopOnce(primaryPath, STOP.explore);
  } else if (
    answers.startingPoint === "gene" ||
    answers.role === "gene_info" ||
    answers.startingPoint === "know_basics"
  ) {
    addStopOnce(primaryPath, STOP.geneticInsights);
  } else if (answers.startingPoint === "community") {
    addStopOnce(primaryPath, STOP.stories);
  } else {
    addStopOnce(primaryPath, STOP.explore);
  }
  if (primaryPath[0]) primaryPath[0].label = "Start here";

  // 2. Context / basics for anyone orienting themselves.
  if (
    answers.role === "newly" ||
    answers.role === "caregiver" ||
    answers.startingPoint === "understand"
  ) {
    addStopOnce(primaryPath, STOP.basics);
  }

  // 3. The gene path — the heart of the journey.
  if (geneKnown) {
    addStopOnce(primaryPath, geneSeed(gene.href));
    // A second gene-context stop: browse related genes / where research stands.
    addStopOnce(primaryPath, STOP.geneticInsights, {
      title: "See Related Genes and Research",
      description:
        "Return to the gene library to compare related genes and see where research stands.",
    });
  } else {
    addStopOnce(primaryPath, STOP.geneticInsights);
    if (answers.geneStatus === "yes" && answers.selectedGene?.trim() && !gene.found) {
      notes.push(
        "We couldn't find a dedicated page for that gene yet — not every gene page is complete. We've pointed you to the full Genetic Insights library instead.",
      );
    } else if (
      answers.geneStatus === "no" ||
      answers.geneStatus === "unsure" ||
      answers.geneStatus === "waiting"
    ) {
      notes.push(
        "Because the gene isn't confirmed yet, we've started you in the Genetic Insights library and genetic-testing context. Once you have a result, that gene's page becomes the best place to begin.",
      );
    }
  }

  // 4. Research / trials.
  if (wantsResearch(answers)) {
    addStopOnce(primaryPath, STOP.clinicalTrials);
  }

  // 5. Stories / community.
  if (
    wantsCommunity(answers) ||
    answers.role === "living_with_rp" ||
    answers.role === "caregiver"
  ) {
    addStopOnce(primaryPath, STOP.stories);
  }

  // Ensure it always feels like a journey (never a single stop).
  if (primaryPath.length < 2) addStopOnce(primaryPath, STOP.stories);
  if (primaryPath.length < 2) addStopOnce(primaryPath, STOP.explore);

  // Keep the tour digestible.
  const trimmedPrimary = primaryPath.slice(0, 5).map((s, i) => ({ ...s, order: i + 1 }));
  const primaryHrefs = new Set(trimmedPrimary.map((s) => s.href));

  // ---- Optional next stops (answer-driven, never in the primary path) ----
  const optionalStops: PathwayStop[] = [];
  const addOptional = (seed: StopSeed, when: boolean, extra?: Partial<PathwayStop>) => {
    if (!when) return;
    if (primaryHrefs.has(seed.href)) return;
    if (optionalStops.some((s) => s.id === seed.id || s.href === seed.href)) return;
    optionalStops.push({
      ...seed,
      order: optionalStops.length + 1,
      optional: true,
      label: "Optional",
      ...extra,
    });
  };

  addOptional(
    STOP.stories,
    answers.role === "living_with_rp" ||
      answers.role === "caregiver" ||
      answers.role === "newly" ||
      wantsCommunity(answers) ||
      answers.mainGoal === "stories",
  );
  addOptional(STOP.clinicalTrials, wantsResearch(answers));
  addOptional(
    STOP.events,
    wantsCommunity(answers) ||
      answers.mainGoal === "events" ||
      answers.startingPoint === "community",
  );
  addOptional(STOP.donate, wantsSupport(answers) || answers.role === "clinician");

  // ---- Navigation-preference notes (point to real accessibility features) ----
  if (answers.navigationPreference === "read_aloud") {
    notes.push(
      "Tip: gene pages have a “Listen to this page” button that reads the content aloud.",
    );
  } else if (answers.navigationPreference === "voice") {
    notes.push(
      "Tip: the “Click to use mic” button in the corner lets you navigate and ask about the site by voice.",
    );
  } else if (answers.navigationPreference === "search_filters") {
    notes.push(
      "Tip: Genetic Insights has search and inheritance filters to narrow the gene library quickly.",
    );
  }

  return {
    title: "Your RP Hope Journey",
    subtitle:
      "Here is a step-by-step path through the site based on your answers. You can follow it in order or jump to any stop.",
    primaryPath: trimmedPrimary,
    optionalStops,
    notes: notes.length ? notes : undefined,
  };
}
