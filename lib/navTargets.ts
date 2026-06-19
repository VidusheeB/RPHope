// The bounded action space for the AI navigation assistant.
// The assistant may ONLY point visitors to pages in this list — it physically
// cannot invent a route (the API route validates every suggestion against this).

import { geneGrid } from "./geneGrid";
import articles from "./articlesIndex.json";

export type NavTarget = { label: string; href: string; about: string };
export type Article = { title: string; url: string };

export const researchArticles = articles as Article[];

export const sections: NavTarget[] = [
  {
    label: "Newly Diagnosed — Start Here",
    href: "/newly-diagnosed",
    about:
      "orientation to RP: what it is, how it progresses, why genetic testing matters, what to ask your doctor. Best destination when someone describes symptoms or says they're newly diagnosed.",
  },
  {
    label: "Genetic Insights (gene library)",
    href: "/genetic-insights",
    about:
      "searchable library of 80+ RP-linked genes with plain-English summaries, inheritance, and research status.",
  },
  {
    label: "Clinical Trials",
    href: "/clinical-trials",
    about: "RP trials recruiting now, framed by gene, location, and age.",
  },
  {
    label: "Stories",
    href: "/stories",
    about: "real patient and family stories navigating RP.",
  },
  {
    label: "Events & Community",
    href: "/events",
    about: "live Q&As, fundraisers, and the community forum.",
  },
  {
    label: "My RP Pathway",
    href: "/my-pathway",
    about: "a personalized 60-second guided tour of the site.",
  },
  {
    label: "Explore RP Hope",
    href: "/explore",
    about: "quick links to every part of the site.",
  },
  {
    label: "Donate / Fundraise",
    href: "/donate",
    about: "support RP Hope financially.",
  },
];

export function geneTargets(): NavTarget[] {
  return geneGrid.map((g) => ({
    label: g.display,
    href: `/genetic-insights/${g.slug}`,
    about: `${g.display} gene page (${g.label})`,
  }));
}

export function allowedHrefs(): Set<string> {
  return new Set([
    ...sections.map((s) => s.href),
    ...geneTargets().map((g) => g.href),
    ...researchArticles.map((a) => a.url),
  ]);
}
