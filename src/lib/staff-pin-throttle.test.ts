import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearPinFailures,
  clientAddress,
  PIN_FAILURE_LIMIT,
  PIN_FAILURE_WINDOW_MS,
  pinThrottleDecision,
  recordPinFailure,
  resetPinThrottleForTests,
} from "@/lib/staff-pin-throttle";

test("client address prefers the platform IP over a spoofed forwarded list", () => {
  assert.equal(clientAddress("203.0.113.5", "1.1.1.1, 198.51.100.9"), "203.0.113.5");
  assert.equal(clientAddress(null, "1.1.1.1, 198.51.100.9"), "198.51.100.9");
  assert.equal(clientAddress("  ", null), "unknown");
});

test("too many wrong PINs from one address block the next guess", () => {
  resetPinThrottleForTests();
  const now = 1_000_000;
  for (let i = 0; i < PIN_FAILURE_LIMIT; i++) recordPinFailure("203.0.113.5", now + i);
  assert.equal(pinThrottleDecision("203.0.113.5", now + PIN_FAILURE_LIMIT).ok, false);
  assert.equal(pinThrottleDecision("198.51.100.9", now + PIN_FAILURE_LIMIT).ok, true);
});

test("a correct PIN clears the counter and old failures age out", () => {
  resetPinThrottleForTests();
  const now = 1_000_000;
  recordPinFailure("203.0.113.5", now);
  clearPinFailures("203.0.113.5");
  assert.equal(pinThrottleDecision("203.0.113.5", now).ok, true);

  for (let i = 0; i < PIN_FAILURE_LIMIT; i++) recordPinFailure("203.0.113.5", now);
  assert.equal(pinThrottleDecision("203.0.113.5", now + PIN_FAILURE_WINDOW_MS).ok, true);
});
