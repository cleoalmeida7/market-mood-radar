// Supabase client factory. Used by the backfill script and (later) route handlers.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url !== "your_supabase_url" &&
      key !== "your_supabase_anon_key",
  );
}

/** Create a Supabase client from env. Throws if not configured. */
export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
