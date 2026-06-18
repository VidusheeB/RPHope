import type { Metadata } from "next";
import SearchClient from "./SearchClient";

export const metadata: Metadata = {
  title: "Search — RP Hope",
  description: "Search RP Hope articles, papers, and events.",
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="border-y-4 border-double border-teal py-2 font-display text-4xl font-bold uppercase tracking-tight text-teal-dark">
        Search
      </h1>
      <SearchClient />
    </div>
  );
}
