import assert from "node:assert/strict";
import { test } from "node:test";
import { getAgePool } from "@/lib/age";

test("age pools map correctly", () => {
  const on = new Date("2026-07-15");
  assert.equal(getAgePool("2022-01-01", on), "4-6");
  assert.equal(getAgePool("2018-01-01", on), "7-9");
  assert.equal(getAgePool("2015-01-01", on), "10-12");
  assert.equal(getAgePool("2010-01-01", on), "needs-review");
  assert.equal(getAgePool("2024-01-01", on), "needs-review");
});
