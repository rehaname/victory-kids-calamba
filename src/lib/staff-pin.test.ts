import assert from "node:assert/strict";
import { test } from "node:test";
import { extractPinFromRemarks, isValidPinFormat, normalizePin } from "@/lib/staff-pin";

test("normalizePin keeps only 6 digits", () => {
  assert.equal(normalizePin("33-16-16"), "331616");
  assert.equal(normalizePin("abc331616xyz"), "331616");
});

test("isValidPinFormat requires exactly 6 digits", () => {
  assert.equal(isValidPinFormat("331616"), true);
  assert.equal(isValidPinFormat("12345"), false);
  assert.equal(isValidPinFormat("1234567"), false);
});

test("extractPinFromRemarks reads bare or labeled PIN", () => {
  assert.equal(extractPinFromRemarks("331616"), "331616");
  assert.equal(extractPinFromRemarks("PIN: 331616"), "331616");
  assert.equal(extractPinFromRemarks("kiosk pin 777777 for staff"), "777777");
  assert.equal(extractPinFromRemarks("call 09171234567"), null);
  assert.equal(extractPinFromRemarks(""), null);
});
