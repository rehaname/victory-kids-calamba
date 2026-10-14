/**
 * Wrong 6-digit guesses allowed per client address inside the window.
 * High enough that a few mistypes, or a child tapping the kiosk keypad,
 * does not lock the shared church network. A script still stops at this cap.
 */
export const PIN_FAILURE_LIMIT = 20;
export const PIN_FAILURE_WINDOW_MS = 10 * 60 * 1000;

const failuresByKey = new Map<string, number[]>();

export function resetPinThrottleForTests() {
  failuresByKey.clear();
}

/**
 * Prefer the platform client IP. A caller-supplied forwarded list is not the key:
 * when x-real-ip is missing, the last hop (closest to the server) is used.
 */
export function clientAddress(realIp: string | null, forwardedFor: string | null): string {
  const real = realIp?.trim();
  if (real) return real;
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return hops[hops.length - 1] ?? "unknown";
}

function recentFailures(key: string, now: number): number[] {
  const existing = failuresByKey.get(key);
  if (!existing) return [];
  const recent = existing.filter((at) => now - at < PIN_FAILURE_WINDOW_MS);
  if (recent.length === 0) failuresByKey.delete(key);
  else failuresByKey.set(key, recent);
  return recent;
}

export function pinThrottleDecision(
  key: string,
  now = Date.now(),
): { ok: true } | { ok: false } {
  if (recentFailures(key, now).length >= PIN_FAILURE_LIMIT) return { ok: false };
  return { ok: true };
}

export function recordPinFailure(key: string, now = Date.now()) {
  const recent = recentFailures(key, now);
  recent.push(now);
  failuresByKey.set(key, recent);
}

export function clearPinFailures(key: string) {
  failuresByKey.delete(key);
}
