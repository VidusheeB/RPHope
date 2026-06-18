import Link from "next/link";

const links = [
  { href: "/who-we-are", label: "About" },
  { href: "/learn-more", label: "Learn More" },
  { href: "/genetic-insights", label: "Genetic Insights" },
  { href: "/events", label: "Events" },
  { href: "/search", label: "Search" },
];

export default function Nav() {
  return (
    <header className="border-b border-teal/15 bg-white">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3"
      >
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/home/logo.png"
            alt="RP Hope home"
            className="h-12 w-12 rounded-full"
          />
          <span className="sr-only">RP Hope home</span>
        </Link>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold uppercase tracking-wide text-teal">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-link hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/donate"
              className="rounded bg-maroon px-4 py-2 text-white hover:bg-maroon-dark"
            >
              Donate
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
