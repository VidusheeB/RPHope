import type { Metadata } from "next";
import ShareYourStoryFlow from "./ShareYourStoryFlow";

export const metadata: Metadata = {
  title: "Share Your Story — RP Hope",
  description:
    "Share your retinitis pigmentosa story with the RP Hope community — type it, dictate it, or upload a short video. Reviewed with you before it goes live.",
};

export default function ShareYourStoryPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <ShareYourStoryFlow />
      </div>
    </div>
  );
}
