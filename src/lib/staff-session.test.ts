import assert from "node:assert/strict";
import { test } from "node:test";
import {
  signStaffCookie,
  STAFF_COOKIE_MAX_AGE_SEC,
  verifyStaffCookie,
} from "@/lib/staff-session";

const secret = "test-staff-cookie-secret";

test("staff cookie round-trips and does not contain a PIN", () => {
  const now = Date.parse("2026-10-14T08:00:00.000Z");
  const value = signStaffCookie(now, secret);
  assert.equal(verifyStaffCookie(value, now + 1000, secret), true);
  assert.equal(value.startsWith("v1."), true);
  assert.equal(value.split(".").length, 3);
});

test("tampered, expired, and wrong-secret cookies fail", () => {
  const now = Date.parse("2026-10-14T08:00:00.000Z");
  const value = signStaffCookie(now, secret);
  assert.equal(verifyStaffCookie(`${value}x`, now, secret), false);
  assert.equal(verifyStaffCookie(value, now, "other-secret"), false);
  const [version, expText, sig] = value.split(".");
  const forgedExp = `${version}.${Number(expText) + 60}.${sig}`;
  assert.equal(verifyStaffCookie(forgedExp, now, secret), false);
  const expiredAt = now + (STAFF_COOKIE_MAX_AGE_SEC + 5) * 1000;
  assert.equal(verifyStaffCookie(value, expiredAt, secret), false);
  assert.equal(verifyStaffCookie(undefined, now, secret), false);
});
