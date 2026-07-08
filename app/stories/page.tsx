import type { Metadata } from "next";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Stories — RP Hope",
  description:
    "Real accounts from people and families navigating retinitis pigmentosa.",
};

// Each story links out to its real source. `source` is the publishing site,
// shown on the card so visitors know before they click that it leaves
// rphope.org — content governance: we host the link, not a paraphrase.
const stories = [
  {
    name: "Rosie",
    blurb:
      "CIRM-funded research helped preserve vision for Rosie Barrero, who was diagnosed with RP as a child and faced losing her sight as a new mother.",
    tag: "Patient story",
    href: "https://youtu.be/BjcnCD4kkBo",
    source: "University of California Television",
  },
  {
    name: "Victoria Nolan",
    blurb:
      "A Canadian adaptive rower with retinitis pigmentosa who made the national team and won seven medals, including gold at the World Rowing Championships.",
    tag: "Patient story",
    href: "http://broadeye.org/victoria-nolan/",
    source: "broadeye.org",
  },
  {
    name: "Tammy Hawkins",
    blurb:
      "A 27-year-old mother with retinitis pigmentosa channels her diagnosis into advocacy, sharing her story at a Foundation Fighting Blindness “Dining in the Dark” fundraiser.",
    tag: "Patient story",
    href: "http://eyesteve.com/dining-in-the-dark-retinitis-pigmentosa/",
    source: "eyesteve.com",
  },
  {
    name: "Jill",
    blurb:
      "Diagnosed with retinitis pigmentosa at 26, Jill writes about finding strength through family and friends while navigating progressive vision loss.",
    tag: "Patient story",
    href: "https://www.fightlikeagirlclub.com/jills-story-degenerative-eye-disease-called-retinitis-pigmentosa-rp/",
    source: "Fight Like a Girl Club",
  },
  {
    name: "Molly Burke",
    blurb:
      "Blind since her teens from retinitis pigmentosa, Molly Burke turned being bullied into a platform as a motivational speaker and disability activist.",
    tag: "Patient story",
    href: "https://www.chatelaine.com/living/real-life-stories/blind-and-bullied-teenage-activist-molly-burke-shares-her-inspirational-story/",
    source: "Chatelaine",
  },
  {
    name: "Vicky Warren",
    blurb:
      "Known as “the Blind Zumba Lady,” Vicky teaches Zumba and advocates for people who are visually impaired while living with retinitis pigmentosa.",
    tag: "Patient story",
    href: "https://web.archive.org/web/20190201092955/http://www.livingthediagnosis.com/2015/12/the-blind-zumba-lady-a-retinitis-pigmentosa-story/",
    source: "Living the Diagnosis (archived)",
  },
  {
    name: "Love My Cane",
    blurb:
      "A vision-loss charity's #LoveMyCane campaign gathers stories from people who moved past embarrassment to embrace their white cane as a tool for independence.",
    tag: "Community story",
    href: "https://www.look-uk.org/love-my-cane-reflecting-on-stories-of-cane-acceptance/",
    source: "LOOK UK",
  },
];

export default function StoriesPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          Stories
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
          Stories like yours
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/75">
          RP looks different for everyone. These are real accounts from people
          navigating diagnosis, vision loss, and everyday life with retinitis
          pigmentosa. Each one links to its original source and opens in a new
          tab.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {stories.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:border-forest/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              <span className="self-start rounded-full bg-lilac px-3 py-1 text-xs font-bold text-[#5b51a3]">
                {s.tag}
              </span>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">
                {s.name}
              </h2>
              <p className="mt-2 flex-1 text-ink/70">{s.blurb}</p>
              <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/40">
                {s.source}
              </span>
              <span className="mt-2 text-sm font-bold text-forest">
                Read story <span aria-hidden="true">→</span>
                <span className="sr-only"> (opens {s.source} in a new tab)</span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10">
          <CTAButton href="/explore" variant="secondary" arrow>
            Share your story
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
