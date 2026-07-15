import { formatBirthdayMdY, getAge } from "@/lib/age";
import type { AttendanceWithChild, ChildWithParent } from "@/lib/types";

/** Spreadsheet-style roster columns (Victory Kids registration list). */
export const ROSTER_HEADERS = [
  "Last Name",
  "First Name",
  "Age",
  "Birthday",
  "Home Service",
  "Parent's Name",
  "Address",
  "Contact Number",
] as const;

export const SESSION_EXPORT_HEADERS = [
  ...ROSTER_HEADERS,
  "Time In",
  "Time Out",
  "Claimed By",
] as const;

function csvEscape(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rosterCells(child: ChildWithParent): string[] {
  return [
    child.lastName,
    child.firstName,
    String(getAge(child.birthday)),
    formatBirthdayMdY(child.birthday),
    child.homeService || "",
    child.parent.fullName,
    child.parent.address || "",
    child.parent.contactNumber || "",
  ];
}

export function sessionExportCells(row: AttendanceWithChild): string[] {
  return [
    ...rosterCells(row.child),
    row.timeIn,
    row.timeOut ?? "",
    row.claimantName ?? "",
  ];
}

export function toCsv(headers: readonly string[], rows: string[][]) {
  return [headers, ...rows]
    .map((cols) => cols.map(csvEscape).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, headers: readonly string[], rows: string[][]) {
  const blob = new Blob([toCsv(headers, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
