import Link from "next/link";

const nav = [
  { href: "/genetic-insights", label: "Genetic Insights" },
  { href: "/my-pathway", label: "My RP Pathway" },
  { href: "/clinical-trials", label: "Clinical Trials" },
  { href: "/events", label: "Events" },
  { href: "/stories", label: "Stories" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream-header/95 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"
      >
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-9 w-9 rounded-full bg-forest"
          />
          <span className="font-display text-2xl font-semibold text-forest">
            RP Hope
          </span>
        </Link>

        <ul className="hidden items-center gap-8 text-[0.95rem] font-semibold text-ink/80 md:flex">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="hover:text-forest">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/donate"
          className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-forest-dark"
        >
          <span aria-hidden="true">♡</span> Donate
        </Link>
      </nav>
    </header>
  );
}
