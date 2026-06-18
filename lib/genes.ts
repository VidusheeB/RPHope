// Hardcoded gene data for the demo.
// Content mirrors the live site (rphope.org) — field labels and values match how
// Carin maintains them (e.g. "Disease Category"). Structured as typed data so it
// can move to Supabase later with minimal changes.
//
// NOTE (content governance): summaries are paraphrases pulled from the live site and
// should be treated as pending medical review before publishing.

export type ClinicalTrials = {
  label: string;
  url?: string;
};

export type FaceOfRP = {
  name: string;
  location?: string;
};

export type Gene = {
  slug: string;
  gene: string;
  fullName?: string;
  diseaseCategory: string; // as labeled on the live site (holds inheritance pattern)
  patientPopulation?: string;
  clinicalTrials?: ClinicalTrials;
  treatmentOptions?: string;
  eyeHealthStrategies?: string;
  institutions?: string[];
  faceOfRP?: FaceOfRP;
  summary: string; // plain-English summary, shown first
};

export const genes: Gene[] = [
  {
    slug: "inpp5e",
    gene: "INPP5E",
    fullName: "Inositol polyphosphate-5-phosphatase E",
    diseaseCategory: "autosomal recessive",
    patientPopulation: "Rare",
    clinicalTrials: {
      label: "Search ClinicalTrials.gov",
      url: "https://www.clinicaltrials.gov/search?cond=retinitis%20pigmentosa&term=INPP5E",
    },
    treatmentOptions: "No gene-specific treatment yet; supportive care.",
    eyeHealthStrategies:
      "Low-vision aids, rehabilitation programs; vitamins/supplements have been suggested but efficacy is debated.",
    institutions: [],
    faceOfRP: { name: "—" },
    summary:
      "Mutations in INPP5E (a cilia-enriched phosphoinositide modulator) contribute to a range of retinal ciliopathies, including Joubert Syndrome, retinitis pigmentosa, and MORM syndrome — reflecting the gene's critical role in keeping photoreceptors healthy. Symptoms of RP include difficulty adapting between bright and dim light and a gradual narrowing of vision. There is no cure, but low-vision aids and rehabilitation can help. Most people with RP retain some vision but may be considered legally blind due to limited peripheral vision.",
  },
  {
    slug: "ush2a",
    gene: "USH2A",
    fullName: "Usherin",
    diseaseCategory: "autosomal recessive",
    patientPopulation: "One of the most common causes of RP and Usher syndrome",
    clinicalTrials: {
      label: "3 Recruiting on ClinicalTrials.gov",
      url: "https://www.clinicaltrials.gov/ct2/results?term=USH2A",
    },
    treatmentOptions: "Cochlear implants (for associated hearing loss).",
    eyeHealthStrategies: "Lutein.",
    institutions: [
      "ProQR",
      "Retina Foundation Southwest",
      "Univ. Wisconsin",
      "Moorfields Eye Hospital, London",
    ],
    faceOfRP: { name: "Stephanie" },
    summary:
      "USH2A is one of the most common genes linked to retinitis pigmentosa, and is also the leading cause of Usher syndrome, in which RP occurs alongside hearing loss. Vision loss is gradual, typically beginning with night blindness and loss of peripheral vision. Research and clinical trials targeting USH2A are actively underway.",
  },
  {
    slug: "pde6b",
    gene: "PDE6B",
    fullName: "Phosphodiesterase 6B",
    diseaseCategory: "autosomal recessive",
    patientPopulation: "Unknown",
    clinicalTrials: { label: "None currently active" },
    treatmentOptions: "—",
    eyeHealthStrategies: "Lutein.",
    institutions: [
      "Jules Stein Eye Institute",
      "UPMC Scheie Eye Institute",
      "Clinique Ophtalmologique",
      "Quinze-Vingts (XV-XX) National Ophthalmology Hospital",
    ],
    faceOfRP: { name: "Lemay-Pelletier kids", location: "Quebec, Canada" },
    summary:
      "The PDE6B gene carries instructions for making part of a protein complex called cGMP-PDE, found in the light-sensing tissue at the back of the eye. PDE6B is part of the phototransduction cascade that converts light into the visual signals sent to the brain, which is especially important for low-light vision. Mutations disrupt this process and lead to progressive retinal degeneration.",
  },
  {
    slug: "rho",
    gene: "RHO",
    fullName: "Rhodopsin",
    diseaseCategory: "autosomal dominant",
    patientPopulation: "Unknown",
    clinicalTrials: {
      label: "3 Recruiting on ClinicalTrials.gov",
      url: "https://www.clinicaltrials.gov/ct2/results?term=RHO+retinitis+pigmentosa",
    },
    treatmentOptions: "None known.",
    eyeHealthStrategies: "None known.",
    institutions: [
      "University of Michigan",
      "UPMC Eye Center, Pittsburgh",
      "UCSD",
      "Anschutz-Rogers Eye Center, University of Colorado",
      "Duke Eye Center",
    ],
    faceOfRP: { name: "Michael", location: "Naugatuck, CT" },
    summary:
      "RHO encodes rhodopsin, the light-sensitive pigment in the rod photoreceptors responsible for vision in dim light. It was the first gene linked to retinitis pigmentosa and is a common cause of the autosomal dominant form. Mutations cause rods to degenerate, leading to night blindness followed by progressive loss of peripheral vision.",
  },
  {
    slug: "rpgr",
    gene: "RPGR",
    fullName: "Retinitis pigmentosa GTPase regulator",
    diseaseCategory: "x-linked",
    patientPopulation: "A leading cause of X-linked RP",
    clinicalTrials: {
      label: "7 Recruiting on ClinicalTrials.gov",
      url: "https://www.clinicaltrials.gov/ct2/results?term=RPGR",
    },
    treatmentOptions: "Clinical trials underway (gene therapy).",
    eyeHealthStrategies:
      "Protection from UV exposure; vitamin supplements in some cases.",
    institutions: [
      "Children's Hospital L.A.",
      "Emory Eye Center",
      "Univ. of Florida",
      "Boston Children's Hospital",
      "Mass Eye & Ear",
      "Casey Eye Center",
      "Kellogg Eye Center",
    ],
    faceOfRP: { name: "Steve", location: "United Kingdom" },
    summary:
      "RPGR is the most common cause of X-linked retinitis pigmentosa, a form that primarily affects males and often progresses faster than other types. The gene is essential for the health of the photoreceptor cilium. RPGR is one of the most active areas of gene-therapy research, with several recruiting clinical trials.",
  },
  {
    slug: "lrat",
    gene: "LRAT",
    fullName: "Lecithin retinol acyltransferase",
    diseaseCategory: "autosomal recessive",
    patientPopulation: "Fewer than 100 known",
    clinicalTrials: {
      label: "3 completed studies",
      url: "https://www.clinicaltrials.gov/ct2/results?term=LRAT",
    },
    treatmentOptions: "Clinical trial of drug intervention.",
    eyeHealthStrategies: "—",
    institutions: [
      "Wilmer Eye Institute",
      "Casey Eye Institute",
      "Hospital for Sick Children",
      "Montreal Children's Hospital",
      "Scheie Eye Institute",
    ],
    faceOfRP: { name: "Chad E. Foster" },
    summary:
      "Mutations in LRAT can cause juvenile retinitis pigmentosa and other early-onset retinal dystrophies. LRAT is an enzyme central to the retinoid (visual) cycle that regenerates the light-sensing chromophore in the eye. When LRAT function is impaired, the eye cannot produce enough functional chromophore, leading to retinal degeneration. Because the pathway is well understood, LRAT has been a target for drug and gene therapies.",
  },
  {
    slug: "crb1",
    gene: "CRB1",
    fullName: "Crumbs homolog 1",
    diseaseCategory: "autosomal recessive",
    patientPopulation: "Unknown",
    clinicalTrials: {
      label: "Search ClinicalTrials.gov",
      url: "https://www.clinicaltrials.gov/search?term=CRB1",
    },
    treatmentOptions: "No cure; medications can help treat complications.",
    eyeHealthStrategies: "—",
    institutions: [],
    faceOfRP: { name: "—" },
    summary:
      "CRB1 mutations cause a severe, early-onset form of retinitis pigmentosa known as RP12, typically marked by significant vision loss before age 20. The CRB1 protein is important for cell-to-cell contact and the proper structure of photoreceptors. CRB1 mutations can also cause Leber Congenital Amaurosis (LCA), the most severe early-onset retinal degeneration.",
  },
  {
    slug: "prpf31",
    gene: "PRPF31",
    fullName: "Pre-mRNA processing factor 31",
    diseaseCategory: "autosomal dominant",
    patientPopulation: "Unknown",
    clinicalTrials: {
      label: "Natural-history study (ClinicalTrials.gov)",
      url: "https://www.clinicaltrials.gov/search?term=PRPF31",
    },
    treatmentOptions: "No current treatment; complications can be managed.",
    eyeHealthStrategies: "—",
    institutions: [],
    faceOfRP: { name: "—" },
    summary:
      "PRPF31 is part of the spliceosome, the cellular machinery that processes mRNA. It is a common cause of autosomal dominant RP and is notable for 'incomplete penetrance' — some people who carry a disease-causing mutation never develop symptoms, which is why symptom-free carriers are often found within affected families.",
  },
];

export function getGene(slug: string): Gene | undefined {
  return genes.find((g) => g.slug === slug);
}

// Distinct disease-category values for the landing-page filter.
export const diseaseCategories: string[] = Array.from(
  new Set(genes.map((g) => g.diseaseCategory))
).sort();
