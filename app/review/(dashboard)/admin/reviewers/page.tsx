import type { Metadata } from "next";
import { requireCapability } from "@/lib/reviewer/session";
import { getTeamMembers } from "@/lib/reviewer/team";
import TeamTable from "@/components/review/TeamTable";

export const metadata: Metadata = { title: "My Team | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyTeamPage() {
  const session = await requireCapability("team.manage");
  const members = await getTeamMembers();
  return <TeamTable members={members} viewerId={session.userId} />;
}
