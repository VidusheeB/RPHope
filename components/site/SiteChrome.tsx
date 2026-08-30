"use client";

// The public marketing chrome (nav header, footer, "Talk to Hope" voice
// launcher, medical disclaimer gate) must NOT render on the reviewer/admin
// portal — that tool has its own header (app/review/(dashboard)/layout.tsx)
// and isn't patient-facing. The root layout renders every page in the app
// though, including /review/*, so this client wrapper decides visibility:
//
//   - On rphopereview.vercel.app (NEXT_PUBLIC_REVIEW_APP_MODE=1), the ENTIRE
//     domain is the review app (middleware.ts rewrites every path to
//     /review/*), so the public chrome is always hidden there.
//   - On rp-hope.vercel.app, only /review/* paths hide it — usePathname()
//     reflects the real, un-rewritten path there since no rewrite happens
//     on that domain.
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import VoiceAssistant from "./voice-assistant/VoiceAssistant";
import MedicalDisclaimerGate from "./MedicalDisclaimerGate";
import { REVIEW_APP_MODE } from "@/lib/reviewer/paths";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReviewApp = REVIEW_APP_MODE || Boolean(pathname?.startsWith("/review"));

  if (isReviewApp) return <>{children}</>;

  return (
    <>
      <Header />
      {children}
      <Footer />
      <VoiceAssistant />
      <MedicalDisclaimerGate />
    </>
  );
}
