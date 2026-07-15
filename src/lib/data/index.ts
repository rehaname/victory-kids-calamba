import { memoryRepository } from "@/lib/data/memory";
import type { KidsRepository } from "@/lib/data/repository";

/**
 * Prefer Supabase when env is configured; otherwise use in-memory store
 * so UI development can continue before tenant provisioning completes.
 */
export function getRepository(): KidsRepository {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    process.env.KIDS_DATA_SOURCE === "supabase";

  if (configured) {
    // Lazy import keeps memory path working without Supabase env.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabaseRepository } = require("@/lib/data/supabase") as {
      supabaseRepository: KidsRepository;
    };
    return supabaseRepository;
  }

  return memoryRepository;
}
