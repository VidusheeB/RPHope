import type { Metadata } from "next";
import LoginForm from "@/components/review/LoginForm";

export const metadata: Metadata = { title: "Reviewer sign in | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ReviewLoginPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-16">
      <LoginForm />
    </main>
  );
}
