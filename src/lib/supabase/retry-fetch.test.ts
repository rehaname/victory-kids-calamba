import assert from "node:assert/strict";
import { test } from "node:test";
import { createRetryFetch } from "@/lib/supabase/retry-fetch";

test("retries a thrown fetch twice, then succeeds", async () => {
  let calls = 0;
  const base = (async () => {
    calls += 1;
    if (calls < 3) throw new Error("fetch failed");
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  const retry = createRetryFetch(base, [0, 0]);
  const response = await retry("https://example.test");
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test("does not retry an HTTP error response", async () => {
  let calls = 0;
  const base = (async () => {
    calls += 1;
    return new Response("nope", { status: 500 });
  }) as typeof fetch;

  const retry = createRetryFetch(base, [0, 0]);
  const response = await retry("https://example.test");
  assert.equal(response.status, 500);
  assert.equal(calls, 1);
});

test("gives up after the original attempt and two retries", async () => {
  let calls = 0;
  const base = (async () => {
    calls += 1;
    throw new Error("fetch failed");
  }) as typeof fetch;

  const retry = createRetryFetch(base, [0, 0]);
  await assert.rejects(() => retry("https://example.test"), /fetch failed/);
  assert.equal(calls, 3);
});
