import { assertEligibleAge, getAgePool } from "@/lib/age";
import {
  findLikelyDuplicates,
  type ChildIdentity,
} from "@/lib/child-duplicates";
import type { KidsRepository } from "@/lib/data/repository";
import {
  defaultSessionName,
  manilaDate,
  requireLocation,
  requireServiceTime,
} from "@/lib/session";
import type {
  Attendance,
  AttendanceWithChild,
  Child,
  ChildWithParent,
  DuplicateChildMatch,
  Parent,
  RegisterInput,
  Session,
  StartSessionInput,
} from "@/lib/types";

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

const g = globalThis as typeof globalThis & {
  __victoryKidsStore?: {
    parents: Parent[];
    children: Child[];
    sessions: Session[];
    attendance: Attendance[];
  };
};

function store() {
  if (!g.__victoryKidsStore) {
    g.__victoryKidsStore = {
      parents: [],
      children: [],
      sessions: [],
      attendance: [],
    };
  }
  return g.__victoryKidsStore;
}

function withParent(child: Child): ChildWithParent {
  const parent = store().parents.find((p) => p.id === child.parentId);
  if (!parent) throw new Error("Parent not found");
  return { ...child, parent };
}

function withChild(row: Attendance): AttendanceWithChild | null {
  const child = store().children.find((c) => c.id === row.childId);
  if (!child) throw new Error("Child not found");
  // History still shows soft-deleted children by name.
  const enriched = withParent(child);
  const agePool = getAgePool(enriched.birthday);
  if (!agePool) return null;
  return {
    ...row,
    child: enriched,
    agePool,
  };
}

function activeChildren(): Child[] {
  return store().children.filter((c) => !c.deletedAt);
}

export const memoryRepository: KidsRepository = {
  async getOpenSession() {
    const [newest] = await this.listOpenSessions();
    return newest ?? null;
  },

  async listOpenSessions() {
    return store()
      .sessions.filter((s) => s.status === "open")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  async getSession(sessionId) {
    return store().sessions.find((s) => s.id === sessionId) ?? null;
  },

  async listSessions() {
    return [...store().sessions].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  },

  async startSession(input?: StartSessionInput) {
    const startedAt = new Date();
    const serviceTime = requireServiceTime(input?.serviceTime);
    const location = requireLocation(input?.location);
    const sessionDate = manilaDate(startedAt);

    // Always create a new open session — multiple tablets / locations can run
    // the same service hour (and even consecutive Starts at one site).
    const session: Session = {
      id: id(),
      startedAt: startedAt.toISOString(),
      endedAt: null,
      status: "open",
      name:
        input?.name?.trim() ||
        defaultSessionName(location, serviceTime, startedAt),
      location,
      serviceTime,
      sessionDate,
    };
    store().sessions.unshift(session);
    return session;
  },

  async closeSession(sessionId) {
    const session = store().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "open") throw new Error("Session already closed");
    session.status = "closed";
    session.endedAt = now();
    return session;
  },

  async searchChildren(query) {
    const q = query.trim().toLowerCase();
    const roster = activeChildren().map(withParent);
    if (!q) {
      return roster.sort((a, b) =>
        `${a.lastName}${a.firstName}`.localeCompare(
          `${b.lastName}${b.firstName}`,
        ),
      );
    }
    return roster
      .filter((c) => {
        const hay = `${c.firstName} ${c.lastName} ${c.nickname} ${c.parent.fullName}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        `${a.lastName}${a.firstName}`.localeCompare(
          `${b.lastName}${b.firstName}`,
        ),
      );
  },

  async listChildren() {
    return this.searchChildren("");
  },

  async softDeleteChild(childId) {
    const child = store().children.find((c) => c.id === childId);
    if (!child) throw new Error("Child not found");
    if (child.deletedAt) {
      throw new Error("That child is already removed from the roster.");
    }

    const active = store().attendance.find(
      (a) => a.childId === childId && !a.timeOut,
    );
    if (active) {
      throw new Error("Check out first before removing this child from the roster.");
    }

    child.deletedAt = now();
  },

  async findLikelyDuplicates(children: ChildIdentity[]) {
    if (!children.length) return [];
    const existing = activeChildren().map(withParent);
    const hits = findLikelyDuplicates(children, existing);
    const seen = new Set<string>();
    const matches: DuplicateChildMatch[] = [];
    for (const hit of hits) {
      if (seen.has(hit.existing.id)) continue;
      seen.add(hit.existing.id);
      matches.push({
        id: hit.existing.id,
        firstName: hit.existing.firstName,
        lastName: hit.existing.lastName,
        nickname: hit.existing.nickname,
        birthday: hit.existing.birthday,
        parentName: hit.existing.parent.fullName,
      });
    }
    return matches;
  },

  async registerFamily(input: RegisterInput) {
    if (!input.parent.fullName.trim()) throw new Error("Parent name is required");
    if (!input.children.length) throw new Error("Add at least one child");

    for (const child of input.children) {
      assertEligibleAge(child.birthday);
    }

    const parent: Parent = {
      id: id(),
      fullName: input.parent.fullName.trim(),
      address: input.parent.address.trim(),
      contactNumber: input.parent.contactNumber.trim(),
      createdAt: now(),
    };
    store().parents.push(parent);

    const children: Child[] = input.children.map((c) => ({
      id: id(),
      parentId: parent.id,
      firstName: c.firstName.trim(),
      lastName: c.lastName.trim(),
      nickname: (c.nickname ?? "").trim(),
      birthday: c.birthday,
      homeService: c.homeService.trim() || "9am",
      createdAt: now(),
      deletedAt: null,
    }));
    store().children.push(...children);
    return { parent, children };
  },

  async listActiveAttendance(sessionId) {
    return store()
      .attendance.filter((a) => a.sessionId === sessionId && !a.timeOut)
      .map(withChild)
      .filter((row): row is AttendanceWithChild => row !== null)
      .sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  },

  async getAttendance(attendanceId) {
    const row = store().attendance.find((a) => a.id === attendanceId);
    return row ? withChild(row) : null;
  },

  async checkIn(sessionId, childId) {
    const session = store().sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "open") {
      throw new Error("No open session");
    }
    const child = store().children.find((c) => c.id === childId);
    if (!child) throw new Error("Child not found");
    if (child.deletedAt) {
      throw new Error("That child was removed from the roster.");
    }
    assertEligibleAge(child.birthday);

    const duplicate = store().attendance.find(
      (a) => a.sessionId === sessionId && a.childId === childId && !a.timeOut,
    );
    if (duplicate) throw new Error("Child is already checked in");

    const row: Attendance = {
      id: id(),
      sessionId,
      childId,
      timeIn: now(),
      timeOut: null,
      claimantName: null,
      rfidTagId: null,
    };
    store().attendance.push(row);
    return row;
  },

  async checkOut(attendanceId, claimantName) {
    const name = claimantName.trim();
    if (!name) throw new Error("Claimant name is required");
    const row = store().attendance.find((a) => a.id === attendanceId);
    if (!row) throw new Error("Attendance not found");
    if (row.timeOut) throw new Error("Child already checked out");
    row.timeOut = now();
    row.claimantName = name;
    return row;
  },

  async listAttendanceForSession(sessionId) {
    return store()
      .attendance.filter((a) => a.sessionId === sessionId)
      .map(withChild)
      .filter((row): row is AttendanceWithChild => row !== null)
      .sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  },
};
