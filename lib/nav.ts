// The site's primary navigation, in one place.
//
// Header, the two desktop dropdowns and the mobile menu all read from here, so
// adding a page cannot leave the mobile menu silently out of date — the kind of
// drift that already bit the guided tour when a button was renamed.

export type NavItem = { href: string; label: string };

/** Top-level links, in the order they appear. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/genetic-insights", label: "Genetic Insights" },
  { href: "/my-pathway", label: "My RP Pathway" },
  { href: "/clinical-trials", label: "Clinical Trials" },
  { href: "/events", label: "Events" },
  { href: "/stories", label: "Stories" },
];

/** "About" sub-pages. */
export const ABOUT_ITEMS: NavItem[] = [
  { href: "/who-we-are", label: "Who We Are" },
  { href: "/contact", label: "Contact Us" },
];

/** "Learn More" sub-pages. */
export const LEARN_MORE_ITEMS: NavItem[] = [
  { href: "/what-is-rp", label: "Understanding RP" },
  { href: "/future-therapies", label: "Future Therapies" },
  { href: "/what-is-a-clinical-trial", label: "What is a Clinical Trial" },
];
