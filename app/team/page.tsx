import type { Metadata } from "next";
import Image from "next/image";
import Eyebrow from "@/components/site/Eyebrow";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Meet the Team — RP Hope",
  description:
    "The volunteers and board members behind RP Hope — the people who gather RP research, run events, and support newly diagnosed families.",
};

type Member = {
  name: string;
  /** Job title or board role. Leave "" until it's confirmed. */
  role: string;
  /**
   * Short bio, 2-4 sentences. Leave "" and the card shows an honest
   * "Bio coming soon" line instead of inventing one.
   */
  bio: string;
  /**
   * Optional square headshot in /public/team (e.g. "/team/lyndon-elam.jpg"),
   * rendered at 96x96. Leave undefined and the card shows an initials placeholder.
   */
  photo?: string;
};

// ---------------------------------------------------------------------------
// THE ROSTER — this is the only thing you edit to update this page.
//
// Names are the four directors already listed on /who-we-are. Roles, bios and
// photos are deliberately blank: nothing here is invented, and per the site's
// content-governance rule a human writes the copy before it goes live. Fill in
// `role` / `bio`, drop a headshot in /public/team, and set `photo`.
// ---------------------------------------------------------------------------
const board: Member[] = [
  { name: "Lyndon Elam", role: "", bio: "" },
  { name: "Tim Geistlinger", role: "", bio: "" },
  { name: "Kevin Unger", role: "", bio: "" },
  { name: "Eric Elam", role: "", bio: "" },
];

/** First letters of a name, for the photo placeholder. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function MemberCard({ member }: { member: Member }) {
  return (
    <li className="flex flex-col rounded-lg border border-ink/12 bg-white p-6">
      {member.photo ? (
        <Image
          src={member.photo}
          alt={`Portrait of ${member.name}`}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-24 w-24 place-items-center rounded-full bg-cream-card font-display text-2xl font-medium text-forest"
        >
          {initials(member.name)}
        </span>
      )}

      <h3 className="mt-5 font-display text-xl font-medium tracking-tight text-ink">
        {member.name}
      </h3>

      {member.role ? (
        <p className="mt-1 text-sm font-bold uppercase tracking-widest text-forest">
          {member.role}
        </p>
      ) : null}

      <p className="mt-3 flex-1 leading-relaxed text-ink/75">
        {member.bio || (
          <span className="italic text-ink/60">Bio coming soon.</span>
        )}
      </p>
    </li>
  );
}

export default function TeamPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <Eyebrow>About RP Hope</Eyebrow>
        <h1 className="mt-5 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Meet the <span className="italic font-medium text-gold">team</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/75">
          RP Hope is a volunteer-led nonprofit. The people below gather and
          organize RP research gene by gene, run our events, and help newly
          diagnosed families find their footing.
        </p>

        <section className="mt-12" aria-labelledby="board-of-directors">
          <h2
            id="board-of-directors"
            className="font-display text-2xl font-medium tracking-tight text-ink"
          >
            Board of Directors
          </h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {board.map((member) => (
              <MemberCard key={member.name} member={member} />
            ))}
          </ul>
        </section>

        <section className="mt-14 rounded-lg border border-ink/10 bg-cream-header p-8">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Want to help?
          </h2>
          <p className="mt-3 max-w-2xl text-ink/75">
            RP Hope runs on volunteers. If you would like to get involved — with
            events, research summaries, or community support — we would love to
            hear from you.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <CTAButton href="/contact" variant="primary" arrow>
              Get in touch
            </CTAButton>
            <CTAButton href="/who-we-are" variant="secondary" arrow>
              Our mission
            </CTAButton>
          </div>
        </section>
      </div>
    </div>
  );
}
