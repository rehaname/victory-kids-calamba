import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBirthdayMdY } from "@/lib/age";
import {
  ROSTER_HEADERS,
  SESSION_EXPORT_HEADERS,
  rosterCells,
  sessionExportCells,
  toCsv,
} from "@/lib/csv";
import type { AttendanceWithChild, ChildWithParent } from "@/lib/types";

const sampleChild: ChildWithParent = {
  id: "c1",
  parentId: "p1",
  firstName: "Golden",
  lastName: "Estrellado",
  nickname: "Gold",
  birthday: "2021-01-01",
  homeService: "9am",
  createdAt: "2026-01-01T00:00:00.000Z",
  parent: {
    id: "p1",
    fullName: "Estrellado, Denden",
    address: "Parian, Calamba City",
    contactNumber: "0994-171-8789",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

test("formatBirthdayMdY matches spreadsheet style", () => {
  assert.equal(formatBirthdayMdY("2021-01-01"), "01/01/2021");
  assert.equal(formatBirthdayMdY("2016-12-17"), "12/17/2016");
});

test("roster CSV columns match registration sheet", () => {
  assert.deepEqual([...ROSTER_HEADERS], [
    "Last Name",
    "First Name",
    "Nickname",
    "Age",
    "Birthday",
    "Home Service",
    "Parent's Name",
    "Address",
    "Contact Number",
  ]);

  const cells = rosterCells(sampleChild);
  assert.equal(cells[0], "Estrellado");
  assert.equal(cells[1], "Golden");
  assert.equal(cells[2], "Gold");
  assert.equal(cells[4], "01/01/2021");
  assert.equal(cells[6], "Estrellado, Denden");
  assert.equal(cells[8], "0994-171-8789");

  const csv = toCsv(ROSTER_HEADERS, [cells]);
  assert.match(csv, /^Last Name,First Name,Nickname,Age,/);
  assert.match(csv, /Estrellado,Golden,Gold,/);
});

test("session export includes roster fields plus attendance", () => {
  const row: AttendanceWithChild = {
    id: "a1",
    sessionId: "s1",
    childId: "c1",
    timeIn: "2026-07-15T01:00:00.000Z",
    timeOut: "2026-07-15T03:00:00.000Z",
    claimantName: "Estrellado, Denden",
    rfidTagId: null,
    child: sampleChild,
    agePool: "4-6",
  };

  assert.equal(SESSION_EXPORT_HEADERS.length, ROSTER_HEADERS.length + 3);
  const cells = sessionExportCells(row);
  assert.equal(cells[0], "Estrellado");
  assert.equal(cells.at(-1), "Estrellado, Denden");
  assert.equal(cells.at(-3), row.timeIn);
});
