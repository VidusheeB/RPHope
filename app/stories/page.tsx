import type { Metadata } from "next";
import CTAButton from "@/components/site/CTAButton";
import StoryCard, { excerptOf } from "@/components/site/StoryCard";
import { curatedStories } from "@/lib/curatedStories";
import { getPublishedStories } from "@/lib/storySubmissionsRepo";

export const metadata: Metadata = {
  title: "Stories — RP Hope",
  description:
    "Real accounts from people and families navigating retinitis pigmentosa.",
};

export default async function StoriesPage() {
  const published = await getPublishedStories();

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              Stories
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
              Stories like yours
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/75">
              RP looks different for everyone. These are real accounts from
              people navigating diagnosis, vision loss, and everyday life
              with retinitis pigmentosa — some curated from elsewhere online,
              others shared directly with RP Hope.
            </p>
          </div>
          <CTAButton
            href="/share-your-story"
            variant="primary"
            arrow
            className="shrink-0"
          >
            Share your story
          </CTAButton>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {published.map((s) => (
            <StoryCard
              key={s.id}
              name={s.displayName}
              excerpt={excerptOf(s.storyText)}
              tag={s.videoUrl ? "🎥 Video story" : s.audioUrl ? "🎙 Audio story" : "Community story"}
              href={`/stories/${s.id}`}
            />
          ))}
          {curatedStories.map((s) => (
            <StoryCard
              key={s.name}
              name={s.name}
              excerpt={s.blurb}
              tag={s.tag}
              externalHref={s.href}
              source={s.source}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
