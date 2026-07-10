import Eyebrow from "./Eyebrow";

const cards = [
  {
    label: "Summaries",
    tone: "bg-mint",
    title: "Clear, Jargon-Free Summaries",
    body: "Complex research translated into language families can actually use — no PhD required. We break down what each study means for patients today.",
  },
  {
    label: "Trials",
    tone: "bg-butter",
    title: "Clinical Trial Updates",
    body: "Find trials recruiting now, filtered by gene, location, and age. We track eligibility windows so families don't miss opportunities.",
  },
  {
    label: "Community",
    tone: "bg-lilac",
    title: "Patient and Family Stories",
    body: "Real accounts from people navigating RP — genetic testing, diagnosis, trials, and daily life. You are not alone in this journey.",
  },
];

export default function ResearchUnderstandable() {
  return (
    <section className="bg-cream py-20" aria-labelledby="research-understandable">
      <div className="mx-auto max-w-7xl px-5">
        <Eyebrow>What we do</Eyebrow>
        <h2
          id="research-understandable"
          className="mt-5 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
        >
          Research made understandable
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink/70">
          We do the work of translating complex science so you can focus on what
          matters.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <article key={c.title} className={`rounded-lg ${c.tone} p-8`}>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink/55">
                {c.label}
              </p>
              <h3 className="mt-2 font-display text-2xl font-medium text-ink">
                {c.title}
              </h3>
              <div className="mt-4 h-px bg-ink/10" />
              <p className="mt-4 leading-relaxed text-ink/75">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
