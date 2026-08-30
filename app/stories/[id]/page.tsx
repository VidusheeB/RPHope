import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedStoryById } from "@/lib/storySubmissionsRepo";
import { geneGrid } from "@/lib/geneGrid";
import ListenButton from "@/components/site/ListenButton";

// Same reason as the listing: a story taken down must stop rendering at once.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const story = await getPublishedStoryById(params.id);
  return {
    title: story ? `${story.displayName}'s story — RP Hope` : "Story — RP Hope",
    description: story ? story.storyText.slice(0, 160) : undefined,
  };
}

export default async function StoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const story = await getPublishedStoryById(params.id);
  if (!story) notFound();

  const gene = story.geneSlug ? geneGrid.find((g) => g.slug === story.geneSlug) : undefined;

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <Link href="/stories" className="text-sm font-semibold text-forest underline">
          ← Back to Stories
        </Link>

        <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink">
          {story.displayName}
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          Shared {new Date(story.publishedAt).toLocaleDateString()}
          {gene && (
            <>
              {" · "}
              <Link href={`/genetic-insights/${gene.slug}`} className="font-semibold text-forest underline">
                {gene.display}
              </Link>
            </>
          )}
        </p>

        {story.videoUrl ? (
          <>
            <video
              controls
              src={story.videoUrl}
              className="mt-6 w-full rounded-lg border border-ink/10"
              aria-label={`${story.displayName}'s story, on video`}
            />
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-forest">
                Read the transcript
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-ink/80">{story.storyText}</p>
            </details>
          </>
        ) : story.audioUrl ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              controls
              src={story.audioUrl}
              className="mt-6 w-full"
              aria-label={`${story.displayName}'s story, as audio`}
            />
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-forest">
                Read the transcript
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-ink/80">{story.storyText}</p>
            </details>
          </>
        ) : (
          <>
            <div className="mt-4">
              <ListenButton text={story.storyText} />
            </div>
            <p className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-ink/80">
              {story.storyText}
            </p>
          </>
        )}

        {story.displayContact !== "none" && story.contactValue && (
          <p className="mt-8 text-ink/70">
            {story.displayName} can be reached at{" "}
            <span className="font-semibold text-ink">{story.contactValue}</span>.
          </p>
        )}

        <p className="mt-10 rounded-lg border border-gold/40 bg-butter/60 p-4 text-sm text-ink/70">
          This is one person&rsquo;s personal account, not medical advice. Everyone&rsquo;s
          experience with RP is different.
        </p>
      </div>
    </div>
  );
}
