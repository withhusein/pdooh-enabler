import { createClient } from "@supabase/supabase-js";

/** Service-role client. SERVER ONLY (bypasses RLS). Used by player, log and report APIs. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
