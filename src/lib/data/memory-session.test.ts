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

test("memory softDeleteChild hides from roster but keeps history name", async () => {
  resetStore();
  const { children } = await memoryRepository.registerFamily({
    parent: {
      fullName: "Parent One",
      address: "",
      contactNumber: "0917",
    },
    children: [
      {
        firstName: "Ana",
        lastName: "Reyes",
        nickname: "",
        birthday: "2018-06-15",
        homeService: "9am",
      },
    ],
  });
  const childId = children[0]!.id;
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.checkIn(session.id, childId);
  await memoryRepository.checkOut(
    (await memoryRepository.listActiveAttendance(session.id))[0]!.id,
    "Parent One",
  );

  await memoryRepository.softDeleteChild(childId);

  const roster = await memoryRepository.listChildren();
  assert.equal(roster.length, 0);

  const history = await memoryRepository.listAttendanceForSession(session.id);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.child.firstName, "Ana");
  assert.ok(history[0]?.child.deletedAt);
});

test("memory softDeleteChild blocks while checked in", async () => {
  resetStore();
  const { children } = await memoryRepository.registerFamily({
    parent: {
      fullName: "Parent One",
      address: "",
      contactNumber: "0917",
    },
    children: [
      {
        firstName: "Ana",
        lastName: "Reyes",
        birthday: "2018-06-15",
        homeService: "9am",
      },
    ],
  });
  const childId = children[0]!.id;
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.checkIn(session.id, childId);

  await assert.rejects(
    () => memoryRepository.softDeleteChild(childId),
    /Check out first/,
  );
});

test("memory findLikelyDuplicates matches same name and birthday", async () => {
  resetStore();
  await memoryRepository.registerFamily({
    parent: {
      fullName: "Maria Reyes",
      address: "",
      contactNumber: "0917",
    },
    children: [
      {
        firstName: "Ana",
        lastName: "Reyes",
        birthday: "2018-06-15",
        homeService: "9am",
      },
    ],
  });

  const hits = await memoryRepository.findLikelyDuplicates([
    {
      firstName: "ana",
      lastName: "reyes",
      birthday: "2018-06-15",
    },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.parentName, "Maria Reyes");
});
