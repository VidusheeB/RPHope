// Site-wide jargon glossary. Each entry becomes a dotted-underline term
// (components/site/GlossaryTerm.tsx) wherever lib/glossaryLinkify.tsx runs
// over prose text. Kept short and curated — every entry should be a genuine
// "a reader might not know this word" term, not everyday vocabulary, so the
// site doesn't end up glossing half of every sentence.
export type GlossaryEntry = {
  term: string;
  definition: string;
  /** Alternate ways the term appears in text (abbreviations, etc.) — matched
   *  the same as `term`, but the popover always shows the canonical `term`. */
  aliases?: string[];
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "ciliopathy",
    definition:
      "A disease caused by a problem with cilia — tiny hair-like structures on cells, including the light-sensing cells in the retina, that the cell needs to work properly.",
  },
  {
    term: "photoreceptor",
    definition:
      "A light-sensing cell in the retina. Rods (used for night and peripheral vision) and cones (used for color and detail) are the two types.",
  },
  {
    term: "rod cell",
    definition:
      "A type of photoreceptor used for vision in low light and peripheral (side) vision. RP usually affects rod cells first.",
  },
  {
    term: "cone cell",
    definition:
      "A type of photoreceptor used for color vision and fine detail, mostly in central and daytime vision.",
  },
  {
    term: "electroretinogram",
    definition:
      "A test (often abbreviated ERG) that measures the retina's electrical response to light, used to check how well photoreceptors are working.",
    aliases: ["ERG"],
  },
  {
    term: "optical coherence tomography",
    definition:
      "An imaging test (often abbreviated OCT) that creates a detailed, layer-by-layer picture of the retina without touching the eye.",
    aliases: ["OCT"],
  },
  {
    term: "fundus autofluorescence",
    definition:
      "An imaging technique that shows natural glow patterns in the retina, which can reveal areas of change or stress in retinal cells.",
  },
  {
    term: "genetic variant",
    definition:
      "A change in a gene's DNA sequence. A variant can be harmless, or it can disrupt how the gene works and cause disease.",
  },
  {
    term: "autosomal dominant",
    definition:
      "An inheritance pattern where a single altered copy of a gene, from just one parent, is enough to cause the condition.",
  },
  {
    term: "autosomal recessive",
    definition:
      "An inheritance pattern where a person needs an altered copy of a gene from both parents to be affected. Parents with only one copy are usually unaffected carriers.",
  },
  {
    term: "X-linked",
    definition:
      "An inheritance pattern where the altered gene is on the X chromosome. These conditions often affect males more severely, though some female carriers have symptoms too.",
  },
  {
    term: "phenotype",
    definition:
      "The observable traits or symptoms a condition actually produces in a person — as opposed to the genotype, the underlying genetic cause.",
  },
  {
    term: "genotype",
    definition:
      "A person's specific genetic makeup — which gene and which variant is causing their condition — as opposed to the phenotype, the symptoms it produces.",
  },
  {
    term: "rhodopsin",
    definition:
      "A light-sensitive protein in rod photoreceptors, produced by the RHO gene, that's essential for seeing in dim light.",
  },
  {
    term: "Usher syndrome",
    definition:
      "A genetic condition that causes both retinitis pigmentosa and hearing loss, sometimes with balance problems.",
  },
  {
    term: "optogenetics",
    definition:
      "An experimental approach that adds a light-sensitive protein to retinal cells that don't normally respond to light, giving them a new way to detect it.",
  },
  {
    term: "CRISPR",
    definition:
      "A gene-editing technology that can find and change a specific, targeted spot in a cell's DNA.",
  },
  {
    term: "retinal organoid",
    definition:
      "A small, lab-grown model of retinal tissue, made from stem cells, used to study a disease or test treatments without involving a person.",
  },
  {
    term: "neuroprotective",
    definition:
      "Describes a treatment designed to protect cells — here, retinal cells — from damage and help them survive longer, rather than replacing or repairing them.",
  },
  {
    term: "informed consent",
    definition:
      "The process of a study team explaining a trial's purpose, risks, and requirements so a participant can decide, with full understanding, whether to take part.",
  },
  {
    term: "Institutional Review Board",
    definition:
      "An independent group (often abbreviated IRB) that reviews a clinical trial's design and protections for participants before and during the study.",
    aliases: ["IRB"],
  },
  {
    term: "placebo",
    definition:
      "An inactive treatment made to look like the real one, used in some trials so researchers can tell whether the actual treatment is responsible for any effect.",
  },
  {
    term: "sham procedure",
    definition:
      "A procedure that mimics the steps of a real treatment, such as an injection, without delivering the experimental therapy — used for comparison in some trials.",
  },
  {
    term: "preclinical",
    definition:
      "Research done in cells or animals, before a treatment is considered ready to be studied in people.",
  },
  {
    term: "natural history study",
    definition:
      "A study that follows people with a condition over time without giving a new treatment, to understand how the condition normally progresses.",
  },
  {
    term: "gene therapy",
    definition:
      "A treatment that delivers a working copy of a gene into cells to take over for a copy that isn't functioning properly.",
  },
];
