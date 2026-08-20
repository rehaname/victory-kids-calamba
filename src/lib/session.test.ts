import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeServiceTime, requireServiceTime } from "@/lib/session";

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
