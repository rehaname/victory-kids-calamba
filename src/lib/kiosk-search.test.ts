import assert from "node:assert/strict";
import { test } from "node:test";
import { toKioskChildHit } from "@/lib/kiosk-search";
import type { ChildWithParent } from "@/lib/types";

const child: ChildWithParent = {
  id: "child-1",
  parentId: "parent-1",
  firstName: "Noah",
  lastName: "Santos",
  nickname: "Noey",
  birthday: "2018-03-01",
  homeService: "9am",
  createdAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  parent: {
    id: "parent-1",
    fullName: "Maria Dela Cruz",
    address: "123 Secret Street",
    contactNumber: "09171234567",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

test("toKioskChildHit keeps only public fields", () => {
  const hit = toKioskChildHit(child);
  assert.equal(hit.id, "child-1");
  assert.equal(hit.firstName, "Noah");
  assert.equal(hit.lastInitial, "S.");
  assert.equal(hit.nickname, "Noey");
  assert.equal(hit.parentFirstName, "Maria");
  assert.equal(hit.parentLastInitial, "C.");
  assert.ok(hit.agePool);

  const serialized = JSON.stringify(hit);
  assert.equal(serialized.includes("Santos"), false);
  assert.equal(serialized.includes("123 Secret"), false);
  assert.equal(serialized.includes("0917"), false);
  assert.equal(serialized.includes("2018-03-01"), false);
});
