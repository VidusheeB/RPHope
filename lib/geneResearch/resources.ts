// RP Hope-approved general resources — a small, hand-curated set the generation
// prompt may cite for caregiver guidance, genetic testing, and the Clinical
// Trials Finder. Deliberately not gene-specific and deliberately small: this is
// reference material a human has vetted, not a scraped list. Edit this file to
// add or update what Opus may cite as an "approved general resource."

import type { ApprovedResource } from "./types";

export const APPROVED_GENERAL_RESOURCES: ApprovedResource[] = [
  {
    sourceId: "rphope-resource:genetic-testing",
    title: "RP Hope — Genetic Testing (Newly Diagnosed)",
    url: "/newly-diagnosed",
    note: "Why genetic testing matters, what it involves, and questions to ask a genetic counselor.",
  },
  {
    sourceId: "rphope-resource:clinical-trials-finder",
    title: "RP Hope — Clinical Trials Finder",
    url: "/clinical-trials",
    note: "Guided, personalized trial discovery tool. The gene page must direct visitors here for eligibility screening rather than determining it itself.",
  },
  {
    sourceId: "rphope-resource:my-pathway",
    title: "RP Hope — My RP Pathway",
    url: "/my-pathway",
    note: "A guided tour of RP Hope's resources for patients and families at any stage.",
  },
  {
    sourceId: "rphope-resource:stories",
    title: "RP Hope — Patient and Family Stories",
    url: "/stories",
    note: "First-person accounts of navigating an RP diagnosis, for emotional/community support context.",
  },
];
