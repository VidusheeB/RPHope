import Link from "next/link";

const learn = [
  { href: "/genetic-insights", label: "Genetic Insights" },
  { href: "/newly-diagnosed", label: "Newly Diagnosed" },
  { href: "/clinical-trials", label: "Clinical Trials" },
  { href: "/newly-diagnosed", label: "Research Explained" },
  { href: "/genetic-insights", label: "Glossary" },
];

const connect = [
  { href: "/events", label: "Events" },
  { href: "/explore", label: "Community Forum" },
  { href: "/stories", label: "Patient Stories" },
  { href: "/explore", label: "Volunteer" },
  { href: "/explore", label: "Contact Us" },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white/85">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-8 w-8 rounded-full bg-forest" />
            <span className="font-display text-xl font-semibold text-white">
              RP Hope
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Helping patients and families understand retinitis pigmentosa
            research, genetic testing, and community resources.
          </p>
          <p className="mt-5 font-mono text-xs text-white/50">
            EIN: 83-0000000 · 501(c)(3) Nonprofit
          </p>
        </div>

        <nav aria-label="Learn">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">
            Learn
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {learn.map((l, i) => (
              <li key={i}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Connect">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">
            Connect
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            {connect.map((l, i) => (
              <li key={i}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">
            Stay Informed
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Receive easy-to-read RP research updates and event announcements —
            no more than twice a month.
          </p>
          <form className="mt-4 flex gap-2">
            <label htmlFor="footer-email" className="sr-only">
              Email address
            </label>
            <input
              id="footer-email"
              type="email"
              placeholder="your@email.com"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <button
              type="submit"
              aria-label="Subscribe"
              className="rounded-lg bg-forest px-3 py-2 text-white hover:bg-forest-dark"
            >
              ✉
            </button>
          </form>
          <ul className="mt-5 flex gap-3" aria-label="Social media">
            {["Twitter", "Facebook", "Instagram", "Website"].map((s) => (
              <li key={s}>
                <a
                  href="#"
                  aria-label={s}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <span aria-hidden="true" className="text-xs">
                    {s[0]}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 RP Hope. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms-of-use" className="hover:text-white">
              Terms of Use
            </Link>
            <Link href="/explore" className="hover:text-white">
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
