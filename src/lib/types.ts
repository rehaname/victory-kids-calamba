export type SessionStatus = "open" | "closed";
export type AgePool = "4-6" | "7-9" | "10-12" | "needs-review";

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
  birthday: string; // YYYY-MM-DD
  homeService: string;
  createdAt: string;
};

export type Session = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
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
    birthday: string;
    homeService: string;
  }>;
  checkInNow?: boolean;
};
