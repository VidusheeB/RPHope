import { redirect } from "next/navigation";

// Consolidated into /policies so there is exactly one copy of the legal text.
// Kept as a redirect for existing links and bookmarks.
export default function Page() {
  redirect("/policies#disclaimer");
}
