import { AGE_POOL_LABELS, childFullName, getAge } from "@/lib/age";
import { sessionDisplayName } from "@/lib/session";
import type { AttendanceWithChild, Receipt, Session } from "@/lib/types";

/**
 * Last four hex digits of the attendance id, grouped so staff can read it out
 * loud at pickup: "A1-4F". Unique enough within a single session.
 */
export function claimCode(attendanceId: string): string {
  const hex = attendanceId.replace(/[^0-9a-f]/gi, "").toUpperCase();
  const tail = hex.slice(-4).padStart(4, "0");
  return `${tail.slice(0, 2)}-${tail.slice(2)}`;
}

export function buildReceipt(
  attendance: AttendanceWithChild,
  session: Session,
): Receipt {
  const { child } = attendance;
  return {
    attendanceId: attendance.id,
    claimCode: claimCode(attendance.id),
    displayName: child.nickname.trim() || child.firstName.trim(),
    fullName: childFullName(child.firstName, child.lastName),
    parentName: child.parent.fullName,
    age: getAge(child.birthday),
    agePool: attendance.agePool,
    agePoolLabel: AGE_POOL_LABELS[attendance.agePool],
    timeIn: attendance.timeIn,
    sessionName: sessionDisplayName(session),
    sessionDate: session.sessionDate,
  };
}
