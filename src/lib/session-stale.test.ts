import assert from "node:assert/strict";
import { test } from "node:test";
import { staleSessionWarning } from "@/lib/session";
import type { Session } from "@/lib/types";

function session(sessionDate: string): Session {
  return {
    id: "session-1",
    startedAt: "2026-09-27T02:38:56.000Z",
    endedAt: null,
    status: "open",
    name: "Halang_11am_Service_2026-09-27_103855",
    location: "Halang",
    serviceTime: "11am",
    sessionDate,
  };
}

test("stale session warning names the date and the still-open count", () => {
  const now = new Date("2026-10-14T04:00:00.000Z");
  const warning = staleSessionWarning(session("2026-09-27"), 19, now);
  assert.ok(warning);
  assert.match(warning, /2026/);
  assert.match(warning, /not today/);
  assert.match(warning, /19 children are still checked in/);
  assert.equal(staleSessionWarning(session("2026-10-14"), 0, now), null);
});
