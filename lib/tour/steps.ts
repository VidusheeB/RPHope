// Ordered "stops" for the guided demo tour. This is the whitelist of pages the
// tour walks a visitor through — the tour is constrained to these, in order.
// Pure data (no imports) so it is safe to use from client and server.

export type TourStep = {
  id: string;
  kind: "welcome" | "page" | "finish";
  title: string;
  /** Main explanation shown in the companion panel. */
  body: string;
  /** Real page this stop lives on (page steps only). */
  href?: string;
  /** Label for the button that moves to this stop. */
  cta?: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    kind: "welcome",
    title: "Welcome to RP Hope",
    body: "This is a short, self-guided tour of the site — about five minutes. We'll walk through what RP Hope is, the genes behind retinitis pigmentosa, clinical trials, and how to get help by voice. Take your time, and explore anything that catches your eye along the way.",
    href: "/",
  },
  {
    id: "home",
    kind: "page",
    title: "Welcome to RP Hope",
    body: "You're on the RP Hope home page — your starting point. From here you can explore the genes behind retinitis pigmentosa, find clinical trials, read real stories, and get help by voice. Let's take a look around together.",
    href: "/",
    cta: "the home page",
  },
  {
    id: "what-is-rp-hope",
    kind: "page",
    title: "What is RP Hope?",
    body: "RP Hope is a nonprofit for everyone touched by retinitis pigmentosa — patients, families, caregivers, researchers, and clinicians. We gather clear information and fund research toward treatments.",
    href: "/what-is-rp-hope",
    cta: "What is RP Hope?",
  },
  {
    id: "what-is-rp",
    kind: "page",
    title: "What is RP?",
    body: "Retinitis pigmentosa is a rare, inherited eye disease that slowly changes vision — usually starting with night vision. Here it is explained in clear, everyday language.",
    href: "/what-is-rp",
    cta: "What is RP?",
  },
  {
    id: "my-pathway",
    kind: "page",
    title: "Find your path",
    body: "Everyone comes to RP Hope for a different reason. 'My RP Pathway' asks a few quick questions and builds a personalized, ordered tour of the parts of the site most useful to you. Go ahead and try it now — answer the questions on this page and watch your own path appear.",
    href: "/my-pathway",
    cta: "Open My RP Pathway",
  },
  {
    id: "genetic-insights",
    kind: "page",
    title: "The gene library",
    body: "RP is linked to more than 80 genes, and the specific gene shapes everything. This searchable library is the heart of the site — one page per gene, in clear language.",
    href: "/genetic-insights",
    cta: "Open Genetic Insights",
  },
  {
    id: "gene-page",
    kind: "page",
    title: "A gene page up close",
    body: "Here's one gene, INPP5E, as an example. Notice the at-a-glance facts, the easy-to-read summary first with deeper science below, real research news, and a 'Face of RP' — here it's Cate, a real person living with this gene.",
    href: "/genetic-insights/inpp5e",
    cta: "Open an example gene",
  },
  {
    id: "what-is-a-clinical-trial",
    kind: "page",
    title: "What is a clinical trial?",
    body: "Before searching for trials, it helps to know how they work — the phases, what 'recruiting' versus 'active' means, and why we say a study 'may be relevant to review' rather than 'you qualify'.",
    href: "/what-is-a-clinical-trial",
    cta: "What is a clinical trial?",
  },
  {
    id: "clinical-trials",
    kind: "page",
    title: "Clinical Trials Finder",
    body: "This guided finder asks about your situation, then pulls live studies from ClinicalTrials.gov and explains why each one may be worth reviewing. It never tells you that you qualify — that's always the study team's call. Try it now — answer a few questions on this page to see real, current studies.",
    href: "/clinical-trials",
    cta: "Open the Trials Finder",
  },
  {
    id: "voice",
    kind: "page",
    title: "Talk to RP Hope",
    body: "For visitors who'd rather not read, RP Hope has a hands-free voice assistant. It knows the whole site and can answer questions, explain a gene, or take you to a page — all out loud. Try it now — tap the Talk to RP Hope button at the bottom right, press Start conversation, and ask a question out loud.",
    href: "/",
    cta: "Go to the homepage",
  },
  {
    id: "events",
    kind: "page",
    title: "Events & community",
    body: "RP Hope is also people. The Spring Fundraiser and Green Cane Day bring the community together, and the Stories section shares real experiences of living with RP.",
    href: "/events",
    cta: "See events",
  },
  {
    id: "donate",
    kind: "page",
    title: "Support the mission",
    body: "Every donation goes toward research seeking effective, affordable treatments for RP. It's the engine behind everything you've seen on this tour.",
    href: "/donate",
    cta: "See how to help",
  },
  {
    id: "finish",
    kind: "finish",
    title: "Thanks for taking the tour!",
    body: "That's RP Hope — a gene library, a research and trials finder, and a community, all built to be usable by everyone. We hope it helps you find your path forward.",
    href: "/",
  },
];
