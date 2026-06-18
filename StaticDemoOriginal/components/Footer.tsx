import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 bg-teal text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            Contact Us
          </h2>
          <address className="mt-3 not-italic text-sm leading-relaxed text-white/85">
            <a className="underline" href="mailto:information@rphope.org">
              information@rphope.org
            </a>
            <br />
            925.209.1440
            <br />
            <br />
            RP Hope 501(c)(3)
            <br />
            EIN: 86-3745576
            <br />
            <br />
            P.O. Box 1163
            <br />
            Pleasanton, CA 94566
          </address>
        </div>

        <nav aria-label="Footer">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            Site Navigation
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-white/85">
            <li>
              <Link className="underline" href="/">
                Home
              </Link>
            </li>
            <li>
              <Link className="underline" href="/genetic-insights">
                Genetic Insights
              </Link>
            </li>
            <li>
              <Link className="underline" href="/events">
                Events
              </Link>
            </li>
            <li>
              <Link className="underline" href="/donate">
                Donate
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            Stay Informed
          </h2>
          <form className="mt-3">
            <label htmlFor="mailing" className="block text-sm text-white/85">
              Join our mailing list
            </label>
            <input
              id="mailing"
              type="email"
              placeholder="Enter your email here*"
              className="mt-2 w-full rounded border border-white/30 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
            />
            <button
              type="submit"
              className="mt-2 rounded bg-white px-4 py-2 text-sm font-semibold text-teal hover:bg-cream"
            >
              Submit
            </button>
          </form>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            Follow Us
          </h2>
          <ul className="mt-3 flex gap-3">
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home/ig.png" alt="Instagram" className="h-6 w-6" />
            </li>
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home/li.png" alt="LinkedIn" className="h-6 w-6" />
            </li>
            <li>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home/bsky.png" alt="Bluesky" className="h-6 w-6" />
            </li>
          </ul>
          <p className="mt-4 text-xs text-white/70">
            Terms of Use | Privacy Policy
          </p>
        </div>
      </div>
      <div className="border-t border-white/15 py-4 text-center text-xs text-white/70">
        © {new Date().getFullYear()} RP Hope · Demo rebuild
      </div>
    </footer>
  );
}
