import type { Metadata } from "next";
import SetPasswordForm from "@/components/review/SetPasswordForm";

export const metadata: Metadata = { title: "Set your password | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

// Reached from an invite link (first-time password) or a recovery link (reset).
export default function SetPasswordPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-16">
      <SetPasswordForm heading="Set your password" />
    </main>
  );
}
