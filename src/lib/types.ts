export type SessionStatus = "open" | "closed";
export type AgePool = "4-6" | "7-9" | "10-12";

export type Parent = {
  id: string;
  fullName: string;
  address: string;
  contactNumber: string;
  createdAt: string;
};

export type Child = {
  id: string;
  parentId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  birthday: string; // YYYY-MM-DD
  homeService: string;
  createdAt: string;
};

/** Church service times a Kids Church session can be attached to. */
export const SERVICE_TIMES = ["9am", "11am", "2pm", "4pm"] as const;
export type ServiceTime = (typeof SERVICE_TIMES)[number];

export type Session = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  /** Readable label shown on receipts and in the session picker. */
  name: string;
  /** One of SERVICE_TIMES, or "" for sessions started before service times existed. */
  serviceTime: string;
  /** Manila-local date the session belongs to (YYYY-MM-DD). */
  sessionDate: string;
};

export type StartSessionInput = {
  serviceTime: string;
  name?: string;
};

export type Attendance = {
  id: string;
  sessionId: string;
  childId: string;
  timeIn: string;
  timeOut: string | null;
  claimantName: string | null;
  rfidTagId: string | null;
};

export type ChildWithParent = Child & {
  parent: Parent;
};

export type AttendanceWithChild = Attendance & {
  child: ChildWithParent;
  agePool: AgePool;
};

export type RegisterInput = {
  parent: {
    fullName: string;
    address: string;
    contactNumber: string;
  };
  children: Array<{
    firstName: string;
    lastName: string;
    nickname?: string;
    birthday: string;
    homeService: string;
  }>;
  checkInNow?: boolean;
};

/**
 * Everything the printed check-in slip needs, resolved server-side so the
 * kiosk never has to stitch a receipt together from separate queries.
 */
export type Receipt = {
  attendanceId: string;
  /** Short human-readable code staff can call out at pickup. */
  claimCode: string;
  /** Nickname when set, otherwise first name. Printed large. */
  displayName: string;
  fullName: string;
  parentName: string;
  age: number;
  agePool: AgePool;
  agePoolLabel: string;
  /** ISO timestamp; formatted for display at render time. */
  timeIn: string;
  sessionName: string;
  sessionDate: string;
};
