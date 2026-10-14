import { TENANT } from "@/lib/tenant";

/** sessionStorage key — survives refresh, clears when the browser tab is closed. */
export const STAFF_UNLOCK_KEY = "victory_kids_calamba_unlocked";

/** Local memory-mode PIN only. Not the church PIN. Production reads profiles.remarks. */
export const DEFAULT_STAFF_PIN = "331616";

export function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function isValidPinFormat(value: string) {
  return /^\d{6}$/.test(value);
}

/**
 * Extract a 6-digit PIN from profiles.remarks.
 * Accepts a bare 6-digit value or a note such as "PIN: 123456".
 * The church PIN is whatever is stored on the profile row. This helper does not
 * know that value.
 */
export function extractPinFromRemarks(remarks: string | null | undefined) {
  const raw = (remarks ?? "").trim();
  if (!raw) return null;
  if (/^\d{6}$/.test(raw)) return raw;
  const labeled = raw.match(/pin[:\s-]*(\d{6})/i);
  if (labeled?.[1]) return labeled[1];
  return null;
}

export function hasSupabaseKeys() {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

/** True when PIN must be read from profiles.remarks (Supabase keys present). */
export function staffPinConfigured() {
  return hasSupabaseKeys();
}

/**
 * Local memory-mode PIN only. Never use this when staffPinConfigured() is true.
 * Production compares the typed PIN to profiles.remarks.
 */
export function localDemoPin() {
  return process.env.KIOSK_STAFF_PIN?.trim() || DEFAULT_STAFF_PIN;
}

export { TENANT };
