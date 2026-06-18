// My RP Pathway — quiz definition + recommendation engine.
//
// This is a front-end prototype: answers map to curated sections via a simple,
// transparent scoring function. The shape is intentionally data-driven so the
// recommend() logic can later be swapped for AI-assisted curation over RP Hope's
// reviewed content library WITHOUT changing the UI components.

export type Option = { value: string; label: string };

export type Question = {
  id: "role" | "gene" | "goals" | "updates";
  prompt: string;
  helper?: string;
  multi?: boolean;
  optional?: boolean;
  options: Option[];
};

export const questions: Question[] = [
  {
    id: "role",
    prompt: "What best describes you?",
    options: [
      { value: "patient", label: "I have RP" },
      { value: "family", label: "I'm a parent or family member" },
      { value: "caregiver", label: "I'm a caregiver" },
      { value: "supporter", label: "I'm a supporter or donor" },
      { value: "clinician", label: "I'm a researcher or clinician" },
      { value: "learning", label: "I'm just learning" },
    ],
  },
  {
    id: "gene",
    prompt: "Do you know the gene mutation?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Not sure" },
      { value: "na", label: "Not relevant to me" },
    ],
  },
  {
    id: "goals",
    prompt: "What are you looking for?",
    helper: "Choose all that apply.",
    multi: true,
    options: [
      { value: "understand", label: "Understand RP" },
      { value: "testing", label: "Learn about genetic testing" },
      { value: "research", label: "Follow research" },
      { value: "trials", label: "Find clinical trials" },
      { value: "community", label: "Connect with community" },
      { value: "support", label: "Support RP Hope" },
    ],
  },
  {
    id: "updates",
    prompt: "Would you like monthly curated updates?",
    helper: "Optional — no more than twice a month, unsubscribe anytime.",
    optional: true,
    options: [
      { value: "yes", label: "Yes, send me updates" },
      { value: "no", label: "Not right now" },
    ],
  },
];

export type Answers = {
  role?: string;
  gene?: string;
  goals?: string[];
  updates?: string;
};

export type Section = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
};

// The full set of curated sections (always available; recommend() orders them).
export const sections: Record<string, Section> = {
  start: {
    id: "start",
    title: "Start Here",
    description:
      "A plain-English orientation to RP — what it is, how it progresses, and what your next steps can be.",
    href: "/newly-diagnosed",
    icon: "🧭",
  },
  genetics: {
    id: "genetics",
    title: "Genetic Insights",
    description:
      "Search 80+ RP-linked genes for plain-English summaries, inheritance, and where research stands.",
    href: "/genetic-insights",
    icon: "🧬",
  },
  trials: {
    id: "trials",
    title: "Clinical Trials",
    description:
      "Find trials recruiting now, with eligibility framed in language families can act on.",
    href: "/clinical-trials",
    icon: "🧪",
  },
  research: {
    id: "research",
    title: "Research Updates",
    description:
      "Curated, plain-English summaries of new RP studies and what they mean for patients today.",
    href: "/clinical-trials",
    icon: "📚",
  },
  family: {
    id: "family",
    title: "Family & Caregiver Resources",
    description:
      "Practical guidance for parents, partners, and caregivers supporting someone with RP.",
    href: "/newly-diagnosed",
    icon: "🤝",
  },
  stories: {
    id: "stories",
    title: "Stories Like Yours",
    description:
      "Real accounts from people navigating RP — diagnosis, genetic testing, trials, and daily life.",
    href: "/stories",
    icon: "💬",
  },
  events: {
    id: "events",
    title: "Events & Community",
    description:
      "Live Q&As, support gatherings, and a community forum to connect with others on this path.",
    href: "/events",
    icon: "📅",
  },
  updates: {
    id: "updates",
    title: "Monthly Updates",
    description:
      "Get curated RP research and event announcements in plain English — twice a month at most.",
    href: "/explore",
    icon: "✉️",
  },
};

// Transparent scoring: each answer nudges certain sections up. Returns an ordered
// list with a `recommended` flag for the strongest matches.
export function recommend(answers: Answers): (Section & { recommended: boolean; reason?: string })[] {
  const score: Record<string, number> = {};
  const reason: Record<string, string> = {};
  const bump = (id: string, n: number, why?: string) => {
    score[id] = (score[id] || 0) + n;
    if (why && !reason[id]) reason[id] = why;
  };

  // baseline so every section has a sensible default order
  Object.keys(sections).forEach((id) => (score[id] = 0));

  switch (answers.role) {
    case "patient":
      bump("genetics", 3, "you have RP");
      bump("trials", 3, "you have RP");
      bump("stories", 2, "you have RP");
      bump("family", 1);
      break;
    case "family":
      bump("family", 3, "you're a parent or family member");
      bump("genetics", 2, "you're a parent or family member");
      bump("stories", 2);
      bump("start", 2);
      break;
    case "caregiver":
      bump("family", 3, "you're a caregiver");
      bump("start", 2, "you're a caregiver");
      bump("events", 1);
      break;
    case "supporter":
      bump("updates", 3, "you're a supporter");
      bump("research", 2, "you're a supporter");
      bump("events", 2);
      break;
    case "clinician":
      bump("research", 3, "you're a researcher or clinician");
      bump("trials", 3, "you're a researcher or clinician");
      bump("genetics", 2);
      break;
    case "learning":
      bump("start", 3, "you're just learning");
      bump("genetics", 2, "you're just learning");
      bump("research", 1);
      break;
  }

  if (answers.gene === "yes") {
    bump("genetics", 2, "you know your gene");
    bump("trials", 1, "you know your gene");
  } else if (answers.gene === "no" || answers.gene === "unsure") {
    bump("start", 2, "you don't have your gene yet");
    bump("genetics", 1);
  }

  const goalMap: Record<string, string> = {
    understand: "start",
    testing: "genetics",
    research: "research",
    trials: "trials",
    community: "events",
    support: "updates",
  };
  (answers.goals || []).forEach((g) => {
    const id = goalMap[g];
    if (id) bump(id, 3, "you told us what you're looking for");
    if (g === "testing") bump("start", 1);
    if (g === "community") bump("stories", 1);
  });

  if (answers.updates === "yes") bump("updates", 4, "you asked for monthly updates");

  const ordered = Object.values(sections)
    .map((s) => ({ ...s, _score: score[s.id] || 0, reason: reason[s.id] }))
    .sort((a, b) => b._score - a._score);

  const topScore = ordered[0]?._score ?? 0;
  return ordered.map((s) => ({
    ...s,
    recommended: s._score > 0 && s._score >= Math.max(2, topScore - 1),
  }));
}
