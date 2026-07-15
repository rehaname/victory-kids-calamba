import { createBrowserClient } from "@supabase/ssr";
import { TENANT_SCHEMA } from "@/lib/tenant";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createBrowserClient(url, key, {
    db: { schema: TENANT_SCHEMA },
  });
}
