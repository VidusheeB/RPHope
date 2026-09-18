"use client";

// The portal's app shell — one left sidebar + top bar for every signed-in
// account, whatever their clearance. There is no separate reviewer site and no
// separate admin site: everyone lands on the same routes, and what appears is
// derived from CAPABILITIES (see lib/reviewer/permissions.ts).
//
// Each nav item declares the capability needed to reach it, and items the
// viewer doesn't hold are not rendered at all — they don't see doors they
// can't open. This is presentation only: every page behind these links calls
// requireCapability() server-side, so hiding a link is a courtesy and the
// server check is the actual boundary. Never add an item that relies on being
// hidden for its protection.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { reviewHref, publicHref } from "@/lib/reviewer/paths";
import type { Capability } from "@/lib/reviewer/permissions";
import SignOutButton from "./SignOutButton";
import NotificationBell from "./NotificationBell";
import type { NotificationRow } from "@/lib/reviewer/notifications";

type NavItem = {
  label: string;
  href: string;
  /** Shown only to a viewer holding at least ONE of these. Omitted means
   *  every signed-in account sees it. */
  requires?: readonly Capability[];
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: reviewHref("/admin"), requires: ["genes.review.all"] },
  // The gene operations console — catalogue + generation + assignment +
  // publication queue. Supersedes the old draft-only "Gene Reviews" list.
  { label: "Genes", href: reviewHref("/genes"), requires: ["genes.review.all"] },
  { label: "My Genes", href: reviewHref(""), requires: ["genes.review.assigned"] },
  { label: "Reviewers", href: reviewHref("/admin/reviewers"), requires: ["reviewers.manage"] },
  { label: "Tickets", href: reviewHref("/admin/tickets"), requires: ["tickets.manage"] },
  { label: "Stories", href: reviewHref("/stories"), requires: ["stories.review"] },
  { label: "Activity", href: reviewHref("/admin/activity"), requires: ["activity.view"] },
  { label: "Analytics", href: "", disabled: true, requires: ["activity.view"] },
];

function isCurrent(pathname: string, href: string): boolean {
  if (!href) return false;
  if (href === reviewHref("")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({
  capabilities,
  email,
  role,
  pageTitle,
  initialNotifications,
  initialUnreadCount,
  children,
}: {
  /** The viewer's effective capabilities, resolved server-side in the
   *  dashboard layout. Passing the resolved set (rather than the role) keeps
   *  the clearance table in one place and stops this component from ever
   *  re-deriving permissions from a role name. */
  capabilities: readonly Capability[];
  email: string | null;
  role: string;
  /** Optional override — falls back to the matched sidebar item's label,
   *  which covers every top-level page. Detail pages (e.g. a single
   *  reviewer or gene) pass their own title/breadcrumb explicitly. */
  pageTitle?: string;
  initialNotifications: NotificationRow[];
  initialUnreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const held = new Set(capabilities);
  const items = NAV_ITEMS.filter((i) => !i.requires || i.requires.some((c) => held.has(c)));
  const currentItem = items.find((i) => isCurrent(pathname ?? "", i.href));
  const resolvedTitle = pageTitle ?? currentItem?.label ?? "RP Hope Admin";

  const sidebarContent = (
    <nav aria-label="Admin" className="flex h-full flex-col justify-between">
      <div>
        <Link
          // The wordmark goes to whatever "home" means for this clearance —
          // the first nav item they can actually reach, so it's never a link
          // into a page that would bounce them.
          href={items[0]?.href || reviewHref("")}
          className="block px-5 py-6 font-display text-xl font-bold text-forest"
        >
          RP Hope <span className="font-normal text-ink/60">Admin</span>
        </Link>
        <ul className="space-y-1 px-3">
          {items.map((item) => {
            if (item.disabled) {
              return (
                <li key={item.label}>
                  <span className="flex cursor-not-allowed items-center rounded-md px-3 py-2 text-sm text-ink/30">
                    {item.label}
                    <span className="ml-auto rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      Soon
                    </span>
                  </span>
                </li>
              );
            }
            const current = isCurrent(pathname ?? "", item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm font-semibold transition ${
                    current ? "bg-forest text-white" : "text-ink/70 hover:bg-mint/40 hover:text-forest"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-ink/10 p-4 text-xs text-ink/50">
        <p className="truncate">{email}</p>
        <p className="mt-0.5 font-semibold uppercase tracking-wide text-ink/40">{role}</p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-cream md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-ink/10 bg-white md:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="presentation">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 rounded p-1 text-ink/60"
            >
              ✕
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="rounded p-1.5 text-ink/70 hover:bg-ink/5 md:hidden"
              >
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="font-display text-lg font-medium text-ink">{resolvedTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={publicHref("/")}
                className="hidden text-sm font-semibold text-ink/60 hover:text-forest sm:inline"
              >
                View public site
              </a>
              <NotificationBell initialNotifications={initialNotifications} initialUnreadCount={initialUnreadCount} />
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
