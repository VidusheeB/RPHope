// Thumbnail images for specific "In the News" articles, keyed by the article's
// canonical URL. These are the real figures/journal covers the original Wix
// gene pages showed next to each article, resized into /public/articles.
//
// Governance / accuracy: only add an entry when the image genuinely belongs to
// that article (a journal cover for a paper in that journal, or the paper's own
// figure). Articles with no entry fall back to the neutral document icon in
// GeneArticles — so a missing match never shows a wrong image.
//
// This is a curated starter set; extend it as more figures are matched. Match
// by the article `url` so it applies whether the article comes from the curated
// list (geneArticles.json) or a published research_items row with the same URL.

export type ArticleImage = { src: string; alt: string };

export const geneArticleImages: Record<string, ArticleImage> = {
  "https://www.rphope.org/post/mutations-in-agbl5-associated-with-retinitis-pigmentosa":
    {
      src: "/articles/agbl5-ophthalmic-genetics.jpg",
      alt: "Cover of the journal Ophthalmic Genetics, which published this AGBL5 study.",
    },
  "https://www.rphope.org/post/early-onset-retinal-dystrophy-mutations-lrat": {
    src: "/articles/lrat-mutation-diagram.jpg",
    alt: "Diagram of the LRAT gene showing the locations of mutations across its exons.",
  },
  "https://www.rphope.org/post/human-ipsc-derived-disease-model-of-mertk-associated-retinitis-pigmentosa":
    {
      src: "/articles/mertk-protein-structure.jpg",
      alt: "Diagram of the MERTK transmembrane protein domains with mutation sites labeled.",
    },
  "https://www.rphope.org/post/crx-retinopathy-project": {
    src: "/articles/crx-mutation-map.jpg",
    alt: "Map of mutations along the CRX protein, grouped by mutation class.",
  },
  "https://www.rphope.org/post/genetic-and-clinical-findings-in-an-ethnically-diverse-cohort-with-retinitis-pigmentosa-associated-w":
    {
      src: "/articles/cerkl-patient-imaging.jpg",
      alt: "Retinal fundus and OCT imaging from several patients in the CERKL cohort study.",
    },
  "https://www.rphope.org/post/dissecting-the-role-of-eys-in-retinal-degeneration-clinical-and-molecular-aspects-and-its-implicati":
    {
      src: "/articles/eys-therapies-overview.jpg",
      alt: "Graphic summarizing possible future therapeutic approaches for EYS-related retinopathy.",
    },
  "https://www.rphope.org/post/investigation-and-restoration-of-best1-activity-in-patient-derived-rpes-with-dominant-mutations":
    {
      src: "/articles/best1-immunostaining.jpg",
      alt: "Immunofluorescence staining of BEST1 protein in patient-derived retinal cells.",
    },
};
