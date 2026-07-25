"use server";

import { getServerSupabase } from "@/lib/supabaseServer";
import type { ActionResult } from "./actions";

/** Mark one notification read. RLS enforces it must be the caller's own. */
export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
