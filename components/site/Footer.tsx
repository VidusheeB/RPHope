import Link from "next/link";
import Image from "next/image";

const learn = [
  { href: "/genetic-insights", label: "Genetic Insights" },
  { href: "/newly-diagnosed", label: "Newly Diagnosed" },
  { href: "/clinical-trials", label: "Clinical Trials" },
  { href: "/newly-diagnosed", label: "Research Explained" },
  { href: "/genetic-insights", label: "Glossary" },
];

const connect = [
  { href: "/who-we-are", label: "Who We Are" },
  { href: "/events", label: "Events" },
  { href: "/stories", label: "Patient Stories" },
  { href: "/transparency", label: "Financial Transparency" },
  { href: "/who-we-are#contact", label: "Contact Us" },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white/85">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/home/logo.png"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
            />
            <span className="font-display text-xl font-medium tracking-tight text-white">
              RP Hope
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Helping patients and families understand retinitis pigmentosa
            research, genetic testing, and community resources.
          </p>
          <address className="mt-5 space-y-1 text-xs not-italic text-white/60">
            <p>P.O. Box 1163, Pleasanton, CA 94566</p>
            <p>
              <a href="mailto:information@rphope.org" className="hover:text-white">
                information@rphope.org
              </a>{" "}
              · 925.209.1440
            </p>
          </address>
          <p className="mt-3 font-mono text-xs text-white/50">
            EIN: 86-3745576 · 501(c)(3) Nonprofit
          </p>
        </div>

        <nav aria-label="Learn">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold">
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold">
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold">
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
              className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
            <button
              type="submit"
              aria-label="Subscribe"
              className="grid place-items-center rounded-md bg-forest px-3 py-2 text-white hover:bg-forest-dark"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
          <ul className="mt-5 flex gap-3" aria-label="Social media">
            {["Twitter", "Facebook", "Instagram", "Website"].map((s) => (
              <li key={s}>
                <a
                  href="#"
                  aria-label={s}
                  className="grid h-9 w-9 place-items-center rounded-md bg-white/10 hover:bg-white/20"
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
