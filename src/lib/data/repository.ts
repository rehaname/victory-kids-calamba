import type { ChildIdentity } from "@/lib/child-duplicates";
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

  /**
   * Soft-delete a child from the roster. Fails if they are currently checked in
   * (any attendance with time_out null). Does not delete attendance or parents.
   */
  softDeleteChild(childId: string): Promise<void>;

  /**
   * Find active (non-deleted) children that look like duplicates of the
   * incoming registration drafts.
   */
  findLikelyDuplicates(children: ChildIdentity[]): Promise<DuplicateChildMatch[]>;

  listActiveAttendance(sessionId: string): Promise<AttendanceWithChild[]>;
  getAttendance(attendanceId: string): Promise<AttendanceWithChild | null>;
  checkIn(sessionId: string, childId: string): Promise<Attendance>;
  checkOut(
    attendanceId: string,
    claimantName: string,
  ): Promise<Attendance>;

  listAttendanceForSession(sessionId: string): Promise<AttendanceWithChild[]>;
}
