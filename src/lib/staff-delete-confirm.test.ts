import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChildWithParent } from "@/lib/types";
import {
  addPreviewAttendance,
  advanceKidDeleteStep,
  chunkIds,
  collectPreviewPages,
  createDeleteRunGuard,
  DELETE_PREVIEW_ID_CHUNK,
  DELETE_PREVIEW_MAX_IDS,
  kidContinueDisabled,
  kidDeleteFinalBody,
  kidDeleteSummaryTitle,
  parseDeleteChildIds,
  runDeleteAtStep,
  selectedKidsForDelete,
  shouldInvokeDelete,
  visitCountLabel,
} from "@/lib/staff-delete-confirm";

test("step 1 never invokes delete", () => {
  assert.equal(shouldInvokeDelete(1), false);
  assert.equal(shouldInvokeDelete(2), true);
});

test("advanceKidDeleteStep stays on step 1 when blocked", () => {
  assert.equal(advanceKidDeleteStep(1, true), 1);
  assert.equal(advanceKidDeleteStep(1, false), 2);
  assert.equal(advanceKidDeleteStep(2, false), 2);
});

test("kid delete titles", () => {
  assert.equal(kidDeleteSummaryTitle(1), "Delete kid?");
  assert.equal(kidDeleteSummaryTitle(3), "Delete 3 kids?");
  assert.match(kidDeleteFinalBody(2), /2 kids will be removed/);
});

test("visit count labels", () => {
  assert.equal(visitCountLabel(0), "No past visits in history");
  assert.equal(visitCountLabel(1), "1 past visit stays in history");
  assert.equal(visitCountLabel(4), "4 past visits stay in history");
});

test("selectedKidsForDelete sorts by name", () => {
  const a: ChildWithParent = {
    id: "a",
    parentId: "p",
    firstName: "Zoe",
    lastName: "Adams",
    nickname: "",
    birthday: "2018-01-01",
    homeService: "",
    createdAt: "",
    deletedAt: null,
    parent: {
      id: "p",
      fullName: "Parent",
      address: "",
      contactNumber: "",
      createdAt: "",
    },
  };
  const b: ChildWithParent = {
    ...a,
    id: "b",
    firstName: "Amy",
    lastName: "Baker",
  };
  const map = new Map([
    [a.id, a],
    [b.id, b],
  ]);
  const ordered = selectedKidsForDelete(new Set([a.id, b.id]), map);
  assert.equal(ordered[0]?.lastName, "Adams");
  assert.equal(ordered[1]?.lastName, "Baker");
});

test("delete run guard allows only one in-flight delete", () => {
  const guard = createDeleteRunGuard();
  assert.equal(guard.tryBegin(), true);
  assert.equal(guard.tryBegin(), false);
  guard.end();
  assert.equal(guard.tryBegin(), true);
});

const SAMPLE_UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";

test("kid continue is disabled while preview is loading, failed, or a kid is checked in", () => {
  assert.equal(
    kidContinueDisabled({ previewLoading: true, previewReady: false, checkedInCount: 0 }),
    true,
  );
  assert.equal(
    kidContinueDisabled({ previewLoading: false, previewReady: false, checkedInCount: 0 }),
    true,
  );
  assert.equal(
    kidContinueDisabled({ previewLoading: false, previewReady: true, checkedInCount: 1 }),
    true,
  );
  assert.equal(
    kidContinueDisabled({ previewLoading: false, previewReady: true, checkedInCount: 0 }),
    false,
  );
});

test("parseDeleteChildIds bounds size and does not echo invalid input", () => {
  assert.deepEqual(parseDeleteChildIds([`  ${SAMPLE_UUID}  `, SAMPLE_UUID]), {
    ok: true,
    ids: [SAMPLE_UUID],
  });

  const leaked = parseDeleteChildIds(["Maria Santos"]);
  assert.equal(leaked.ok, false);
  if (!leaked.ok) assert.equal(leaked.error.includes("Santos"), false);

  assert.equal(parseDeleteChildIds([123]).ok, false);
  assert.equal(parseDeleteChildIds([]).ok, false);
  assert.equal(parseDeleteChildIds("nope").ok, false);

  const tooMany = Array.from({ length: DELETE_PREVIEW_MAX_IDS + 1 }, () => SAMPLE_UUID);
  const capped = parseDeleteChildIds(tooMany);
  assert.equal(capped.ok, false);
  if (!capped.ok) assert.match(capped.error, /fewer children/);

  const mixed = parseDeleteChildIds([SAMPLE_UUID, OTHER_UUID, "not-a-uuid"]);
  assert.equal(mixed.ok, false);
});

test("preview chunks stay well under one query per child", () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
  const chunks = chunkIds(ids, DELETE_PREVIEW_ID_CHUNK);
  assert.equal(chunks.length, 4);
  assert.ok(chunks.every((chunk) => chunk.length <= DELETE_PREVIEW_ID_CHUNK));
  assert.equal(chunks.flat().length, 250);
});

test("addPreviewAttendance counts visits and open check-ins", () => {
  const visitCounts: Record<string, number> = { a: 0, b: 0 };
  const checkedIn = new Set<string>();
  addPreviewAttendance(visitCounts, checkedIn, [
    { childId: "a", timeOut: "2026-01-01T00:00:00Z" },
    { childId: "a", timeOut: null },
    { childId: "b", timeOut: "2026-01-02T00:00:00Z" },
  ]);
  assert.equal(visitCounts.a, 2);
  assert.equal(visitCounts.b, 1);
  assert.deepEqual([...checkedIn], ["a"]);
});

test("collectPreviewPages reads past the first page and refuses a truncated scan", async () => {
  const byFrom = new Map<number, { childId: string; timeOut: string | null }[]>([
    [
      0,
      [
        { childId: "a", timeOut: null },
        { childId: "a", timeOut: "2026-01-01T00:00:00Z" },
      ],
    ],
    [2, [{ childId: "b", timeOut: "2026-01-02T00:00:00Z" }]],
  ]);
  const seen: number[] = [];
  const rows = await collectPreviewPages(
    async (from) => {
      seen.push(from);
      return byFrom.get(from) ?? [];
    },
    2,
    5,
  );
  assert.deepEqual(seen, [0, 2]);
  assert.equal(rows.length, 3);

  await assert.rejects(
    () =>
      collectPreviewPages(
        async () => [
          { childId: "a", timeOut: null },
          { childId: "a", timeOut: "2026-01-01T00:00:00Z" },
        ],
        2,
        2,
      ),
    /Could not load visit history/,
  );
});

test("runDeleteAtStep only fires on step 2 and once per double-click", async () => {
  const guard = createDeleteRunGuard();
  let calls = 0;
  const fn = async () => {
    calls += 1;
  };

  assert.equal(await runDeleteAtStep(1, guard, fn), "skipped-step");
  assert.equal(calls, 0);

  assert.equal(await runDeleteAtStep(2, guard, fn), "ran");
  assert.equal(calls, 1);

  const slowFn = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
  };
  const parallel = await Promise.all([
    runDeleteAtStep(2, guard, slowFn),
    runDeleteAtStep(2, guard, slowFn),
  ]);
  assert.deepEqual(parallel.sort(), ["ran", "skipped-guard"]);
  assert.equal(calls, 2);
});
