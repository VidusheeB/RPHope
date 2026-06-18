import type { Metadata } from "next";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Newly Diagnosed — RP Hope",
  description:
    "A plain-English starting point for understanding retinitis pigmentosa, genetic testing, and your next steps.",
};

export default function NewlyDiagnosedPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          Start Here
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
          Newly diagnosed?{" "}
          <span className="italic font-medium text-gold">You&rsquo;re not alone.</span>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink/75">
          Retinitis pigmentosa (RP) is a group of rare genetic eye conditions that
          cause gradual vision loss. A diagnosis can feel overwhelming — this page
          is a plain-English place to begin: what RP is, why genetic testing
          matters, and what to ask your doctor.
        </p>

        <div className="mt-10 space-y-4">
          {[
            ["What is RP?", "How the condition progresses and what to expect."],
            [
              "Why genetic testing matters",
              "Knowing your gene shapes which research and trials apply to you.",
            ],
            [
              "Questions to ask your doctor",
              "Make the most of appointments with a prepared list.",
            ],
          ].map(([t, d]) => (
            <div
              key={t}
              className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
            >
              <h2 className="font-display text-xl font-bold text-ink">{t}</h2>
              <p className="mt-2 text-ink/70">{d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <CTAButton href="/my-pathway" variant="primary" arrow>
            Build my pathway
          </CTAButton>
          <CTAButton href="/genetic-insights" variant="secondary" arrow>
            Explore genes
          </CTAButton>
        </div>

        <p className="mt-8 text-sm text-ink/50">
          For education and navigation only — not medical advice.
        </p>
      </div>
    </div>
  );
}
