import type { Metadata } from "next";
import { requireReviewer } from "@/lib/reviewer/session";
import SettingsPanel from "@/components/review/SettingsPanel";

export const metadata: Metadata = { title: "Settings | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

// Your own account. Requires only a signed-in session — managing your own
// password is not a privilege, so there is no capability gate here. Every
// action on this page is self-scoped server-side.
export default async function SettingsPage() {
  const session = await requireReviewer();
  return (
    <SettingsPanel
      email={session.email}
      displayName={session.profile.display_name}
      role={session.profile.role}
      canPublish={session.profile.can_publish}
    />
  );
}
