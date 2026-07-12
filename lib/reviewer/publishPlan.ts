// Pure builder for the publish write-plan: given a gene's existing versions,
// produce (a) the version rows to ARCHIVE (the currently-published one) and
// (b) the new immutable PUBLISHED row to insert. No DB access — the server
// action executes this plan with the service-role client after re-authorizing.
// Kept pure so "publishing creates a new version" and "the previous published
// version becomes archived" are unit-tested without a database.

import { nextVersionNumber } from "./publishGate";
import type { GenePageDraft } from "../geneResearch/types";

export type ExistingVersion = {
  id: string;
  version_number: number;
  status: "published" | "archived";
};

export type NewVersionRow = {
  gene_slug: string;
  version_number: number;
  content: GenePageDraft;
  status: "published";
  source_draft_id: string;
  approved_by: string;
  approved_at: string;
  published_at: string;
};

export type PublishPlan = {
  /** IDs of currently-published versions to flip to 'archived' first. */
  archiveVersionIds: string[];
  newVersion: NewVersionRow;
};

export function buildPublishPlan(input: {
  geneSlug: string;
  draftId: string;
  content: GenePageDraft;
  approverId: string;
  existingVersions: ExistingVersion[];
  now?: string;
}): PublishPlan {
  const now = input.now ?? new Date().toISOString();
  return {
    archiveVersionIds: input.existingVersions
      .filter((v) => v.status === "published")
      .map((v) => v.id),
    newVersion: {
      gene_slug: input.geneSlug,
      version_number: nextVersionNumber(input.existingVersions),
      content: input.content,
      status: "published",
      source_draft_id: input.draftId,
      approved_by: input.approverId,
      approved_at: now,
      published_at: now,
    },
  };
}
