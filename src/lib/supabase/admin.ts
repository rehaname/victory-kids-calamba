import { createClient } from "@supabase/supabase-js";
import { TENANT_SCHEMA } from "@/lib/tenant";

/**
 * Server-only service-role client for the Kids kiosk.
 * Bypasses RLS; isolation is enforced by hardcoding TENANT_SCHEMA.
 * Never import this into client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: TENANT_SCHEMA },
  });
}
