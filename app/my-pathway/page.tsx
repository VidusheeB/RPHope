import type { Metadata } from "next";
import MyPathway from "./MyPathway";

export const metadata: Metadata = {
  title: "My RP Pathway — RP Hope",
  description:
    "Answer a few questions and get a personalized guide to RP Hope's research, genetic testing resources, trials, stories, events, and updates. For education and navigation only — not medical advice.",
};

export default function MyPathwayPage() {
  return <MyPathway />;
}
