// Read access for published, first-party stories. Mirrors lib/researchRepo.ts:
// reads PUBLISHED story_submissions from Supabase (RLS already restricts the
// anon client to published rows) and only ever selects the PUBLIC columns —
// full_name/email/phone/consent/edit_permission are never requested here.
// Falls back to an empty list when Supabase isn't configured, so the curated
// external-link stories in app/stories/page.tsx still render on localhost
// before Supabase is set up.

import { getSupabase } from "./supabase";
import { getServiceSupabase } from "./supabaseAdmin";
import type { DisplayContact, PublishedStory } from "./stories/types";

const PUBLIC_COLUMNS =
  "id, display_name, display_contact, email, phone, gene_slug, story_text, video_path, published_at";

type Row = {
  id: string;
  display_name: string;
  display_contact: DisplayContact;
  email: string | null;
  phone: string | null;
  gene_slug: string | null;
  story_text: string;
  video_path: string | null;
  published_at: string;
};

// The story-videos bucket has no public/anon read policy (see
// 0004_story_submissions.sql), so a playable URL has to be minted with the
// service-role client. Safe to do here because it's only ever called on a
// row the anon+RLS query above already confirmed is `published` — this
// doesn't widen what's readable, it just signs a URL for a path we already
// know is meant to be public.
async function signVideoUrl(path: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const service = getServiceSupabase();
  if (!service) return undefined;
  const { data } = await service.storage.from("story-videos").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl;
}

async function toPublishedStory(r: Row): Promise<PublishedStory> {
  const displayContact = r.display_contact;
  return {
    id: r.id,
    displayName: r.display_name,
    displayContact,
    contactValue:
      displayContact === "email"
        ? r.email ?? undefined
        : displayContact === "phone"
          ? r.phone ?? undefined
          : undefined,
    geneSlug: r.gene_slug ?? undefined,
    storyText: r.story_text,
    videoUrl: await signVideoUrl(r.video_path),
    publishedAt: r.published_at,
  };
}

export async function getPublishedStories(): Promise<PublishedStory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("story_submissions")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return Promise.all((data as unknown as Row[]).map(toPublishedStory));
}

export async function getPublishedStoryById(id: string): Promise<PublishedStory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("story_submissions")
    .select(PUBLIC_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return toPublishedStory(data as unknown as Row);
}
