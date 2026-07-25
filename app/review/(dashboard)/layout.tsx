import Link from "next/link";
import { requireReviewer } from "@/lib/reviewer/session";
import { getMyNotifications, getMyUnreadCount } from "@/lib/reviewer/notifications";
import SignOutButton from "@/components/review/SignOutButton";
import NotificationBell from "@/components/review/NotificationBell";

// Shared authenticated shell for every /review/* route EXCEPT the public
// auth pages (login/set-password/reset-password, which live outside this
// route group so they're never wrapped in a layout that would redirect an
// unauthenticated visitor back to itself). Every page under here used to
// render its own ad-hoc header — this replaces all of that with one
// consistent header: branding, nav, admin-only nav, identity, sign out.
export default async function ReviewDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireReviewer();
  const isAdmin = session.profile.role === "admin";
  const [notifications, unreadCount] = await Promise.all([getMyNotifications(), getMyUnreadCount()]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-6">
            <Link href="/review" className="font-display text-lg font-bold text-forest">
              RP Hope Review
            </Link>
            <nav className="flex items-center gap-4 text-sm font-semibold text-ink/70">
              <Link href="/review" className="hover:text-forest">
                Dashboard
              </Link>
              <Link href="/review/stories" className="hover:text-forest">
                Stories
              </Link>
              {isAdmin && (
                <Link href="/review/admin" className="hover:text-forest">
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/genetic-insights" className="font-semibold text-ink/60 hover:text-forest">
              Genetic Insights
            </Link>
            <Link href="/" className="font-semibold text-ink/60 hover:text-forest">
              Public site
            </Link>
            <NotificationBell initialNotifications={notifications} initialUnreadCount={unreadCount} />
            <span className="hidden text-ink/50 sm:inline">
              {session.email}
              <span className="ml-1 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold uppercase text-ink/60">
                {session.profile.role}
              </span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
