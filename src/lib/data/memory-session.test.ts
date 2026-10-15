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

async function registerTwoChildren() {
  return memoryRepository.registerFamily({
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
      {
        firstName: "Ben",
        lastName: "Reyes",
        birthday: "2017-03-10",
        homeService: "9am",
      },
    ],
  });
}

test("memory softDeleteChildren removes all ids and keeps history", async () => {
  resetStore();
  const { children } = await registerTwoChildren();
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.checkIn(session.id, children[0]!.id);
  await memoryRepository.checkOut(
    (await memoryRepository.listActiveAttendance(session.id))[0]!.id,
    "Parent One",
  );

  await memoryRepository.softDeleteChildren(children.map((c) => c.id));

  assert.equal((await memoryRepository.listChildren()).length, 0);
  const history = await memoryRepository.listAttendanceForSession(session.id);
  assert.equal(history.length, 1);
  assert.ok(history[0]?.child.deletedAt);
});

test("memory softDeleteChildren is all-or-nothing when one is checked in", async () => {
  resetStore();
  const { children } = await registerTwoChildren();
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.checkIn(session.id, children[0]!.id);

  await assert.rejects(
    () => memoryRepository.softDeleteChildren(children.map((c) => c.id)),
    /Nothing was removed/,
  );

  assert.equal((await memoryRepository.listChildren()).length, 2);
  assert.equal(
    (await memoryRepository.listActiveAttendance(session.id)).length,
    1,
  );
});

test("memory softDeleteChildren rejects unknown or deleted ids without partial delete", async () => {
  resetStore();
  const { children } = await registerTwoChildren();
  const goodId = children[0]!.id;
  const badId = "00000000-0000-4000-8000-000000000001";

  await assert.rejects(
    () => memoryRepository.softDeleteChildren([goodId, badId]),
    /Nothing was removed/,
  );
  assert.equal((await memoryRepository.listChildren()).length, 2);

  await memoryRepository.softDeleteChild(goodId);
  await assert.rejects(
    () => memoryRepository.softDeleteChildren([goodId, children[1]!.id]),
    /Nothing was removed/,
  );
  assert.equal((await memoryRepository.listChildren()).length, 1);
});

test("memory softDeleteSession hides closed session but keeps attendance", async () => {
  resetStore();
  const { children } = await registerTwoChildren();
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.checkIn(session.id, children[0]!.id);
  await memoryRepository.checkOut(
    (await memoryRepository.listActiveAttendance(session.id))[0]!.id,
    "Parent One",
  );
  await memoryRepository.closeSession(session.id);

  await memoryRepository.softDeleteSession(session.id);

  assert.equal((await memoryRepository.listSessions()).length, 0);
  assert.equal((await memoryRepository.listOpenSessions()).length, 0);
  assert.equal(await memoryRepository.getSession(session.id), null);
  assert.equal(
    (await memoryRepository.listAttendanceForSession(session.id)).length,
    1,
  );
});

test("memory softDeleteSession blocks open session with checked-in kids", async () => {
  resetStore();
  const { children } = await registerTwoChildren();
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.checkIn(session.id, children[0]!.id);

  await assert.rejects(
    () => memoryRepository.softDeleteSession(session.id),
    /still checked in/,
  );

  const stored = g.__victoryKidsStore!.sessions.find((s) => (s as { id: string }).id === session.id) as {
    status: string;
    deletedAt: string | null;
  };
  assert.equal(stored.status, "open");
  assert.equal(stored.deletedAt, null);
});

test("memory softDeleteSession closes empty open session", async () => {
  resetStore();
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });

  await memoryRepository.softDeleteSession(session.id);

  assert.equal((await memoryRepository.listOpenSessions()).length, 0);
  const stored = g.__victoryKidsStore!.sessions.find((s) => (s as { id: string }).id === session.id) as {
    status: string;
    deletedAt: string | null;
    endedAt: string | null;
  };
  assert.ok(stored.deletedAt);
  assert.equal(stored.status, "closed");
  assert.ok(stored.endedAt);
});

test("memory softDeleteSession rejects already removed session", async () => {
  resetStore();
  const session = await memoryRepository.startSession({
    serviceTime: "9am",
    location: "Halang",
  });
  await memoryRepository.softDeleteSession(session.id);

  await assert.rejects(
    () => memoryRepository.softDeleteSession(session.id),
    /already removed/,
  );
});
