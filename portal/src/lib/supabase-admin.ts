// portal/src/lib/supabase-admin.ts
// Server-side only. NEVER import from a "use client" module.
import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

/**
 * Service-role Supabase client for server-side operations (Route Handlers).
 * Has elevated privileges — only use for trusted server-originated requests,
 * and only after authenticating the user via their access token.
 */
export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Given a user access token (from the Authorization header or cookie),
 * verify it and return the user id. Throws if invalid.
 */
export async function requireUserId(accessToken: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }
  return data.user.id;
}
