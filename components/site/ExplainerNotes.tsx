// Shared building blocks for the two educational explainer pages (What is RP,
// What is a clinical trial). These pages summarize medical/scientific facts
// from outside sources, so per RP Hope's content governance they carry an
// educational disclaimer, a last-reviewed line, and visible source citations.

export type Source = { label: string; href: string };

export function SourcesList({ sources }: { sources: Source[] }) {
  return (
    <section className="mt-12 rounded-lg border border-ink/10 bg-white p-6">
      <h2 className="font-display text-lg font-bold text-ink">Sources</h2>
      <ul className="mt-3 space-y-2 text-sm text-ink/75">
        {sources.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-forest underline"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EducationalDisclaimer() {
  return (
    <aside
      role="note"
      className="mt-8 rounded-lg border border-gold/40 bg-butter p-5 text-sm leading-relaxed text-ink/80"
    >
      <p>
        <strong className="font-bold text-ink">
          This page is for general education, not medical advice.
        </strong>{" "}
        Retinitis pigmentosa affects each person differently. Always talk with a
        qualified eye doctor or genetic counselor about your own situation.
      </p>
    </aside>
  );
}
