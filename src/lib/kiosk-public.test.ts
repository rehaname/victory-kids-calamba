import assert from "node:assert/strict";
import { test } from "node:test";
import { kioskDuplicateResult } from "@/lib/kiosk-public";

test("public kiosk duplicate result does not echo a stored family", () => {
  const result = kioskDuplicateResult();
  const body = JSON.stringify(result);
  assert.equal("duplicates" in result, false);
  assert.equal(body.includes("parent"), false);
  assert.equal(body.includes("contact"), false);
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(body), false);
  assert.match(result.error, /already registered/i);
});
