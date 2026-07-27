import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely —
 * only ever import this from Route Handlers or Server Actions that
 * themselves verify the caller is an admin first (e.g. the agent-invite
 * API route). Never import from a Client Component or expose the
 * service role key to the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
