import type {
  Attendance,
  AttendanceWithChild,
  Child,
  ChildWithParent,
  Parent,
  RegisterInput,
  Session,
} from "@/lib/types";

export interface KidsRepository {
  getOpenSession(): Promise<Session | null>;
  listSessions(): Promise<Session[]>;
  startSession(): Promise<Session>;
  closeSession(sessionId: string): Promise<Session>;

  searchChildren(query: string): Promise<ChildWithParent[]>;
  /** Full registered roster, sorted by last name then first name. */
  listChildren(): Promise<ChildWithParent[]>;
  registerFamily(input: RegisterInput): Promise<{ parent: Parent; children: Child[] }>;

  listActiveAttendance(sessionId: string): Promise<AttendanceWithChild[]>;
  checkIn(sessionId: string, childId: string): Promise<Attendance>;
  checkOut(
    attendanceId: string,
    claimantName: string,
  ): Promise<Attendance>;

  listAttendanceForSession(sessionId: string): Promise<AttendanceWithChild[]>;
}
