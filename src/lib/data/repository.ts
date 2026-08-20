import type {
  Attendance,
  AttendanceWithChild,
  Child,
  ChildWithParent,
  Parent,
  RegisterInput,
  Session,
  StartSessionInput,
} from "@/lib/types";

export interface KidsRepository {
  /** Most recently started open session. Several may be open at once. */
  getOpenSession(): Promise<Session | null>;
  listOpenSessions(): Promise<Session[]>;
  getSession(sessionId: string): Promise<Session | null>;
  listSessions(): Promise<Session[]>;
  startSession(input?: StartSessionInput): Promise<Session>;
  closeSession(sessionId: string): Promise<Session>;

  searchChildren(query: string): Promise<ChildWithParent[]>;
  /** Full registered roster, sorted by last name then first name. */
  listChildren(): Promise<ChildWithParent[]>;
  registerFamily(input: RegisterInput): Promise<{ parent: Parent; children: Child[] }>;

  listActiveAttendance(sessionId: string): Promise<AttendanceWithChild[]>;
  getAttendance(attendanceId: string): Promise<AttendanceWithChild | null>;
  checkIn(sessionId: string, childId: string): Promise<Attendance>;
  checkOut(
    attendanceId: string,
    claimantName: string,
  ): Promise<Attendance>;

  listAttendanceForSession(sessionId: string): Promise<AttendanceWithChild[]>;
}
