import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryRepository } from "@/lib/data/memory";

type Store = {
  parents: unknown[];
  children: unknown[];
  sessions: unknown[];
  attendance: unknown[];
};

const g = globalThis as typeof globalThis & { __victoryKidsStore?: Store };

function resetStore() {
  g.__victoryKidsStore = {
    parents: [],
    children: [],
    sessions: [],
    attendance: [],
  };
}

test("memory startSession creates a new open session every time", async () => {
  resetStore();
  const first = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  const second = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Bayan",
  });
  const third = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });

  assert.equal(first.location, "Halang");
  assert.equal(second.location, "Bayan");
  assert.equal(third.location, "Halang");
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, third.id);
  assert.match(first.name, /^Halang_9am_Service_\d{4}-\d{2}-\d{2}_\d{6}$/);
  assert.match(second.name, /^Bayan_9am_Service_\d{4}-\d{2}-\d{2}_\d{6}$/);

  const open = await memoryRepository.listOpenSessions();
  assert.equal(open.length, 3);
});

test("memory startSession rejects missing location", async () => {
  resetStore();
  await assert.rejects(
    () => memoryRepository.startSession({ serviceTime: "9am", location: "  " }),
    /Enter a location/,
  );
});
