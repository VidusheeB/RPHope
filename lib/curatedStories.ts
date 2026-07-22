// Curated external stories — real, previously-published accounts RP Hope
// links to (not hosted here). `source` is the publishing site, shown on the
// card so visitors know before they click that it leaves rphope.org —
// content governance: we host the link, not a paraphrase. Shared between
// app/stories/page.tsx (the grid) and app/share-your-story's "how this
// works" example, so the example uses a real story rather than a fabricated
// mockup.
export type CuratedStory = {
  name: string;
  blurb: string;
  tag: string;
  href: string;
  source: string;
};

export const curatedStories: CuratedStory[] = [
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
