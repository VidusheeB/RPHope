const cards = [
  {
    icon: "📖",
    tone: "bg-mint",
    iconTone: "text-forest",
    title: "Clear, Jargon-Free Summaries",
    body: "Complex research translated into language families can actually use — no PhD required. We break down what each study means for patients today.",
  },
  {
    icon: "🧪",
    tone: "bg-butter",
    iconTone: "text-[#8a6d1f]",
    title: "Clinical Trial Updates",
    body: "Find trials recruiting now, filtered by gene, location, and age. We track eligibility windows so families don't miss opportunities.",
  },
  {
    icon: "👥",
    tone: "bg-lilac",
    iconTone: "text-[#5b51a3]",
    title: "Patient and Family Stories",
    body: "Real accounts from people navigating RP — genetic testing, diagnosis, trials, and daily life. You are not alone in this journey.",
  },
];

export default function ResearchUnderstandable() {
  return (
    <section className="bg-cream py-20" aria-labelledby="research-understandable">
      <div className="mx-auto max-w-7xl px-5 text-center">
        <h2
          id="research-understandable"
          className="font-display text-4xl font-bold text-ink sm:text-5xl"
        >
          Research made understandable
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/70">
          We do the work of translating complex science so you can focus on what
          matters.
        </p>

        <div className="mt-12 grid gap-6 text-left md:grid-cols-3">
          {cards.map((c) => (
            <article
              key={c.title}
              className={`rounded-2xl ${c.tone} p-8`}
            >
              <span
                aria-hidden="true"
                className={`grid h-12 w-12 place-items-center rounded-xl bg-white text-xl ${c.iconTone}`}
              >
                {c.icon}
              </span>
              <h3 className="mt-6 font-display text-2xl font-bold text-ink">
                {c.title}
              </h3>
              <p className="mt-3 leading-relaxed text-ink/75">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
