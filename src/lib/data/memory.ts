import { getAgePool } from "@/lib/age";
import type { KidsRepository } from "@/lib/data/repository";
import type {
  Attendance,
  AttendanceWithChild,
  Child,
  ChildWithParent,
  Parent,
  RegisterInput,
  Session,
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

function withChild(row: Attendance): AttendanceWithChild {
  const child = store().children.find((c) => c.id === row.childId);
  if (!child) throw new Error("Child not found");
  const enriched = withParent(child);
  return {
    ...row,
    child: enriched,
    agePool: getAgePool(enriched.birthday),
  };
}

export const memoryRepository: KidsRepository = {
  async getOpenSession() {
    return store().sessions.find((s) => s.status === "open") ?? null;
  },

  async listSessions() {
    return [...store().sessions].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  },

  async startSession() {
    if (store().sessions.some((s) => s.status === "open")) {
      throw new Error("A session is already open");
    }
    const session: Session = {
      id: id(),
      startedAt: now(),
      endedAt: null,
      status: "open",
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
    if (!q) {
      return store()
        .children.map(withParent)
        .sort((a, b) =>
          `${a.lastName}${a.firstName}`.localeCompare(
            `${b.lastName}${b.firstName}`,
          ),
        );
    }
    return store()
      .children.map(withParent)
      .filter((c) => {
        const hay = `${c.firstName} ${c.lastName} ${c.parent.fullName}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        `${a.lastName}${a.firstName}`.localeCompare(
          `${b.lastName}${b.firstName}`,
        ),
      );
  },

  async registerFamily(input: RegisterInput) {
    if (!input.parent.fullName.trim()) throw new Error("Parent name is required");
    if (!input.children.length) throw new Error("Add at least one child");

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
      birthday: c.birthday,
      homeService: c.homeService.trim(),
      createdAt: now(),
    }));
    store().children.push(...children);
    return { parent, children };
  },

  async listActiveAttendance(sessionId) {
    return store()
      .attendance.filter((a) => a.sessionId === sessionId && !a.timeOut)
      .map(withChild)
      .sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  },

  async checkIn(sessionId, childId) {
    const session = store().sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "open") {
      throw new Error("No open session");
    }
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
      .sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  },
};
