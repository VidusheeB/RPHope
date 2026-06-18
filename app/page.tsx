import Hero from "@/components/site/Hero";
import ChoosePath from "@/components/site/ChoosePath";
import GeneInsightsPreview from "@/components/site/GeneInsightsPreview";
import ResearchUnderstandable from "@/components/site/ResearchUnderstandable";
import EventsCommunity from "@/components/site/EventsCommunity";
import DonationSupport from "@/components/site/DonationSupport";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ChoosePath />
      <GeneInsightsPreview />
      <ResearchUnderstandable />
      <EventsCommunity />
      <DonationSupport />
    </>
  );
}
