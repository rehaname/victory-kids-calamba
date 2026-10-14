import assert from "node:assert/strict";
import { test } from "node:test";
import { assertEligibleAge, getAge, getAgePool } from "@/lib/age";

test("age pools map correctly", () => {
  const on = new Date("2026-07-15");
  assert.equal(getAgePool("2022-01-01", on), "4-6");
  assert.equal(getAgePool("2018-01-01", on), "7-9");
  assert.equal(getAgePool("2015-01-01", on), "10-12");
  assert.equal(getAgePool("2010-01-01", on), null);
  assert.equal(getAgePool("2024-01-01", on), null);
});

test("a birthday that is today in Manila at 01:00 is already that age", () => {
  // 2026-10-15 01:00 Asia/Manila = 2026-10-14 17:00 UTC.
  const on = new Date("2026-10-14T17:00:00.000Z");
  assert.equal(getAge("2022-10-15", on), 4);
  assert.equal(getAgePool("2022-10-15", on), "4-6");
  assert.equal(assertEligibleAge("2022-10-15", on), 4);
  assert.equal(getAge("2022-10-16", on), 3);
});

test("assertEligibleAge rejects out-of-range birthdays", () => {
  assert.throws(
    () => assertEligibleAge("2024-01-01", new Date("2026-07-15")),
    /outside the Kids Church age range/,
  );
});
