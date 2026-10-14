import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const STAFF_COOKIE_NAME = "victory_kids_staff";
export const STAFF_COOKIE_MAX_AGE_SEC = 60 * 60 * 12;

const LOCAL_DEV_SECRET = "victory-kids-local-staff-session";

export class StaffAuthError extends Error {
  constructor() {
    super("Staff sign-in required.");
    this.name = "StaffAuthError";
  }
}

/** Service role, or KIDS_STAFF_COOKIE_SECRET when Melvs adds one. Never the PIN. */
export function staffCookieSecret(): string {
  const dedicated = process.env.KIDS_STAFF_COOKIE_SECRET?.trim();
  if (dedicated) return dedicated;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole) return serviceRole;
  if (process.env.VERCEL) {
    throw new Error("Staff session secret is not configured.");
  }
  return LOCAL_DEV_SECRET;
}

/** Signed expiry only. The PIN is never stored in the cookie. */
export function signStaffCookie(nowMs = Date.now(), secret = staffCookieSecret()): string {
  const exp = Math.floor(nowMs / 1000) + STAFF_COOKIE_MAX_AGE_SEC;
  const payload = `v1.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyStaffCookie(
  value: string | undefined | null,
  nowMs = Date.now(),
  secret = staffCookieSecret(),
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [version, expText, sig] = parts;
  if (version !== "v1" || !expText || !sig) return false;
  if (!/^\d+$/.test(expText)) return false;
  const exp = Number(expText);
  if (exp * 1000 <= nowMs) return false;

  const payload = `${version}.${expText}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
}

export async function hasStaffSession(): Promise<boolean> {
  const jar = await cookies();
  return verifyStaffCookie(jar.get(STAFF_COOKIE_NAME)?.value);
}

export async function requireStaff(): Promise<void> {
  if (!(await hasStaffSession())) throw new StaffAuthError();
}

export async function grantStaffSession(): Promise<void> {
  const jar = await cookies();
  jar.set(STAFF_COOKIE_NAME, signStaffCookie(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: STAFF_COOKIE_MAX_AGE_SEC,
  });
}
