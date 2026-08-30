import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultSessionName,
  manilaDate,
  manilaHHmmss,
  normalizeServiceTime,
  requireLocation,
  requireServiceTime,
  sanitizeLocationForName,
} from "@/lib/session";

test("normalizeServiceTime accepts mixed case and whitespace", () => {
  assert.equal(normalizeServiceTime(" 9AM "), "9am");
  assert.equal(normalizeServiceTime("11am"), "11am");
  assert.equal(normalizeServiceTime("midnight"), "");
});

test("requireServiceTime rejects unnamed sessions", () => {
  assert.equal(requireServiceTime("2pm"), "2pm");
  assert.throws(() => requireServiceTime(""), /Pick a service time/);
  assert.throws(() => requireServiceTime(undefined), /Pick a service time/);
});

test("requireLocation trims and rejects blank", () => {
  assert.equal(requireLocation("  Halang  "), "Halang");
  assert.throws(() => requireLocation("   "), /Enter a location/);
  assert.throws(() => requireLocation(undefined), /Enter a location/);
});

test("sanitizeLocationForName collapses spaces to underscores", () => {
  assert.equal(sanitizeLocationForName("  Halang  "), "Halang");
  assert.equal(sanitizeLocationForName("Bayan Proper"), "Bayan_Proper");
  assert.equal(sanitizeLocationForName("North  Gate"), "North_Gate");
});

test("defaultSessionName uses location, service time, Manila date and HHmmss", () => {
  // 2026-08-30 09:15:30 Asia/Manila = 2026-08-30 01:15:30 UTC
  const at = new Date("2026-08-30T01:15:30.000Z");
  assert.equal(manilaDate(at), "2026-08-30");
  assert.equal(manilaHHmmss(at), "091530");
  assert.equal(
    defaultSessionName("Halang", "9AM", at),
    "Halang_9am_Service_2026-08-30_091530",
  );
  assert.equal(
    defaultSessionName("Bayan Proper", "11am", at),
    "Bayan_Proper_11am_Service_2026-08-30_091530",
  );
});

test("defaultSessionName requires location and service time", () => {
  assert.throws(() => defaultSessionName("", "9am"), /Enter a location/);
  assert.throws(() => defaultSessionName("Halang", "midnight"), /Pick a service time/);
});
