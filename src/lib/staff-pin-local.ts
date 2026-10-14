/** Local memory-mode PIN only. Not the church PIN. Production reads profiles.remarks. */
export const DEFAULT_STAFF_PIN = "331616";

/**
 * Local memory-mode PIN only. Never use this when staffPinConfigured() is true.
 * Production compares the typed PIN to profiles.remarks.
 */
export function localDemoPin() {
  return process.env.KIOSK_STAFF_PIN?.trim() || DEFAULT_STAFF_PIN;
}
