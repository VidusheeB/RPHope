import type { Metadata } from "next";
import ResetRequestForm from "@/components/review/ResetRequestForm";

export const metadata: Metadata = { title: "Reset password | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-16">
      <ResetRequestForm />
    </main>
  );
}
