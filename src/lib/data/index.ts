import { memoryRepository } from "@/lib/data/memory";
import type { KidsRepository } from "@/lib/data/repository";

export type DataSourceMode = "supabase" | "memory";

export type DataSourceDiagnostics = {
  mode: DataSourceMode | "error";
  onVercel: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  kidsDataSource: string | null;
  missing: string[];
  message: string | null;
};

/**
 * Supabase is used whenever project keys are present, unless explicitly forced
 * to memory for local UI demos (`KIDS_DATA_SOURCE=memory`).
 *
 * On Vercel, memory mode is unsafe (serverless instances do not share RAM),
 * so we refuse it when keys are missing.
 */
export function diagnoseDataSource(): DataSourceDiagnostics {
  const onVercel = Boolean(process.env.VERCEL);
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const kidsDataSource = process.env.KIDS_DATA_SOURCE?.trim() || null;
  const forced = kidsDataSource?.toLowerCase() ?? null;

  const missing: string[] = [];
  if (!hasUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!hasAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!hasServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const mode = resolveDataSource();
    return {
      mode,
      onVercel,
      hasUrl,
      hasAnonKey,
      hasServiceRoleKey,
      kidsDataSource,
      missing,
      message:
        mode === "memory"
          ? "Running in demo memory mode. Sessions will not survive refresh."
          : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database not configured";
    return {
      mode: "error",
      onVercel,
      hasUrl,
      hasAnonKey,
      hasServiceRoleKey,
      kidsDataSource,
      missing,
      message,
    };
  }
}

export function resolveDataSource(): DataSourceMode {
  const hasKeys =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const forced = process.env.KIDS_DATA_SOURCE?.trim().toLowerCase();

  if (forced === "memory") {
    if (process.env.VERCEL) {
      throw new Error(
        "KIDS_DATA_SOURCE=memory is not allowed on Vercel. Sessions will not survive refresh. Set KIDS_DATA_SOURCE=supabase and Supabase keys.",
      );
    }
    return "memory";
  }

  if (hasKeys && (forced === "supabase" || !forced)) {
    return "supabase";
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Supabase is not configured on Vercel. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and KIDS_DATA_SOURCE=supabase.",
    );
  }

  return "memory";
}

/**
 * Prefer Supabase when env is configured; otherwise use in-memory store
 * so local UI development can continue without secrets.
 */
export function getRepository(): KidsRepository {
  if (resolveDataSource() === "supabase") {
    // Lazy import keeps memory path working without Supabase env.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabaseRepository } = require("@/lib/data/supabase") as {
      supabaseRepository: KidsRepository;
    };
    return supabaseRepository;
  }

  return memoryRepository;
}
