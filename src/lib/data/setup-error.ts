/** Thrown by resolveDataSource when Vercel is forced into memory mode. */
export const MEMORY_ON_VERCEL_ERROR =
  "KIDS_DATA_SOURCE=memory is not allowed on Vercel. Sessions will not survive refresh. Set KIDS_DATA_SOURCE=supabase and Supabase keys.";

/** Thrown by resolveDataSource when Vercel has no usable Supabase keys. */
export const NOT_CONFIGURED_ERROR =
  "Supabase is not configured on Vercel. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and KIDS_DATA_SOURCE=supabase.";

/** True only for the setup failures that should mention Project Settings. */
export function isEnvironmentSetupError(message: string | null | undefined): boolean {
  if (!message) return false;
  return message === MEMORY_ON_VERCEL_ERROR || message === NOT_CONFIGURED_ERROR;
}
