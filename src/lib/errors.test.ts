import assert from "node:assert/strict";
import { test } from "node:test";
import { errorMessage, isFetchFailure, SUPABASE_UNREACHABLE } from "@/lib/errors";

test("fetch failures become the unreachable sentence without the cause chain", () => {
  const err = new Error("fetch failed");
  err.cause = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
  assert.equal(isFetchFailure(err), true);
  assert.equal(errorMessage(err), SUPABASE_UNREACHABLE);
  assert.equal(SUPABASE_UNREACHABLE.includes("Project Settings"), false);
  assert.equal(SUPABASE_UNREACHABLE.includes("add the Supabase keys"), false);
  assert.equal(errorMessage(err).includes("ENOTFOUND"), false);
});

test("ordinary errors keep their message", () => {
  assert.equal(errorMessage(new Error("Parent name is required.")), "Parent name is required.");
});
