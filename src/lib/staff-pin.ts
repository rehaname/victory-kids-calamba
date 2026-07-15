import { TENANT } from "@/lib/tenant";

/** sessionStorage key — survives refresh, clears when the browser tab is closed. */
export const STAFF_UNLOCK_KEY = "victory_kids_calamba_unlocked";

/** Default PIN when Supabase is not configured (local memory mode). John 3:16. */
export const DEFAULT_STAFF_PIN = "331616";

export function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidPinFormat(value: string) {
  return /^\d{6}$/.test(value);
}

/**
 * Extract a 6-digit PIN from profiles.remarks.
 * Accepts bare "331616" or notes like "PIN: 331616 — change monthly".
 */
export function extractPinFromRemarks(remarks: string | null | undefined) {
  const raw = (remarks ?? "").trim();
  if (!raw) return null;
  if (/^\d{6}$/.test(raw)) return raw;
  const match = raw.match(/(?:pin[:\s-]*)?(\d{6})/i);
  return match?.[1] ?? null;
}

export function staffPinConfigured() {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    process.env.KIDS_DATA_SOURCE === "supabase"
  );
}

export { TENANT };
