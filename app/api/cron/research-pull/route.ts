// Weekly research-pull cron endpoint.
//
// Vercel Cron hits this on a schedule (see vercel.json). It is protected by
// CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically
// when that env var is set, so unauthenticated callers get 401.
//
// Manual / single-gene runs (no dev server needed) use `npm run research:pull`
// instead; both share lib/research/pull.ts.

import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { runResearchPull } from "@/lib/research/pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // generous: many genes × source fetches + Opus drafts

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run unprotected
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 500 }
    );
  }

  const url = new URL(req.url);
  const gene = url.searchParams.get("gene"); // optional: run one gene
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const summary = await runResearchPull(supabase, {
    slugs: gene ? [gene.toLowerCase()] : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return NextResponse.json({ ok: true, ...summary });
}

// Vercel Cron uses GET; allow POST too for manual curl convenience.
export const GET = handle;
export const POST = handle;
