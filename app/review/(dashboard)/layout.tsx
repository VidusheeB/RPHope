import { requireReviewer, sessionCapabilities } from "@/lib/reviewer/session";
import { getMyNotifications, getMyUnreadCount } from "@/lib/reviewer/notifications";
import AdminShell from "@/components/review/AdminShell";

// Shared authenticated shell for every /review/* route EXCEPT the public
// auth pages (login/set-password/reset-password, which live outside this
// route group so they're never wrapped in a layout that would redirect an
// unauthenticated visitor back to itself). AdminShell is the "RP Hope
// Admin" app shell — left sidebar + top bar — replacing the single-row nav
// every page used to render ad hoc.
export default async function ReviewDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Identity only — this grants nothing. Each page below re-checks the
  // capability it needs; the resolved set here just drives what the nav shows.
  const session = await requireReviewer();
  const capabilities = sessionCapabilities(session);
  const [notifications, unreadCount] = await Promise.all([getMyNotifications(), getMyUnreadCount()]);

  return (
    <AdminShell
      capabilities={capabilities}
      email={session.email}
      role={session.profile.role}
      initialNotifications={notifications}
      initialUnreadCount={unreadCount}
    >
      {children}
    </AdminShell>
  );
}
