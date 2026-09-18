// Read access for published, first-party stories.
//
// Reads the `public_stories` VIEW, never the story_submissions table. The anon
// key has no privilege on that table at all (see 0024_story_public_view.sql) —
// which is the point: this file selecting a narrow column list used to be the
// ONLY thing keeping submitter PII off the public REST API, and a caller-side
// convention is not an access control. The view does the narrowing in the
// database, so a direct REST call gets the same safe projection this does.
//
// The view also resolves display_contact into a single `contact_value`, so the
// contact method the submitter did NOT choose to publish is not fetched here
// at all (previously both email and phone were pulled back and one discarded
// in application code).
//
// Falls back to an empty list when Supabase isn't configured, so the curated
// external-link stories in app/stories/page.tsx still render on localhost
// before Supabase is set up.

import { getSupabase } from "./supabase";
import { getServiceSupabase } from "./supabaseAdmin";
import type { DisplayContact, PublishedStory } from "./stories/types";

const PUBLIC_VIEW = "public_stories";
const PUBLIC_COLUMNS =
  "id, display_name, display_contact, contact_value, gene_slug, story_text, video_path, audio_path, published_at";

type Row = {
  id: string;
  display_name: string;
  display_contact: DisplayContact;
  contact_value: string | null;
  gene_slug: string | null;
  story_text: string;
  video_path: string | null;
  audio_path: string | null;
  published_at: string;
};

// The story-videos bucket has no public/anon read policy (see
// 0004_story_submissions.sql / 0005_story_audio.sql), so a playable URL has
// to be minted with the service-role client. Safe to do here because it's
// only ever called on a row the anon+RLS query above already confirmed is
// `published` — this doesn't widen what's readable, it just signs a URL for
// a path we already know is meant to be public.
async function signStoryMediaUrl(path: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const service = getServiceSupabase();
  if (!service) return undefined;
  const { data } = await service.storage.from("story-videos").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl;
}

async function toPublishedStory(r: Row): Promise<PublishedStory> {
  const displayContact = r.display_contact;
  const [videoUrl, audioUrl] = await Promise.all([
    signStoryMediaUrl(r.video_path),
    signStoryMediaUrl(r.audio_path),
  ]);
  return {
    id: r.id,
    displayName: r.display_name,
    displayContact,
    // Already resolved by the view according to display_contact.
    contactValue: r.contact_value ?? undefined,
    geneSlug: r.gene_slug ?? undefined,
    storyText: r.story_text,
    videoUrl,
    audioUrl,
    publishedAt: r.published_at,
  };
}

export async function getPublishedStories(): Promise<PublishedStory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(PUBLIC_VIEW)
    .select(PUBLIC_COLUMNS)
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return Promise.all((data as unknown as Row[]).map(toPublishedStory));
}

export async function getPublishedStoryById(id: string): Promise<PublishedStory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(PUBLIC_VIEW)
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toPublishedStory(data as unknown as Row);
}
