import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChildWithParent } from "@/lib/types";
import {
  advanceKidDeleteStep,
  createDeleteRunGuard,
  kidDeleteFinalBody,
  kidDeleteSummaryTitle,
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
