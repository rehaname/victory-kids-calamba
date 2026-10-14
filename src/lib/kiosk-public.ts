/**
 * Public kiosk duplicate response. The stored family (name, birthday, parent)
 * stays on the server. Staff registration still gets the detailed message.
 */
export const KIOSK_DUPLICATE_ERROR =
  "A child with this name and birthday is already registered. Search to check in, or ask a volunteer.";

export function kioskDuplicateResult(): { ok: false; error: string } {
  return { ok: false, error: KIOSK_DUPLICATE_ERROR };
}
