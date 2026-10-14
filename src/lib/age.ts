import { parseISO } from "date-fns";
import { APP_TIMEZONE } from "@/lib/tenant";
import type { AgePool } from "@/lib/types";

/** Calendar year/month/day in Asia/Manila, independent of the server's UTC clock. */
function manilaCalendar(onDate: Date, timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(onDate);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/**
 * Age in whole years from the Manila calendar date, compared to a YYYY-MM-DD birthday.
 * A birthday that is "today" in Manila is already that age, including 01:00 Asia/Manila.
 */
export function getAge(birthday: string, onDate: Date = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!match) return Number.NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const today = manilaCalendar(onDate);
  let age = today.year - year;
  if (today.month < month || (today.month === month && today.day < day)) age -= 1;
  return age;
}

export function getAgePool(
  birthday: string,
  onDate: Date = new Date(),
): AgePool | null {
  const age = getAge(birthday, onDate);
  if (age >= 4 && age <= 6) return "4-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  return null;
}

export function assertEligibleAge(birthday: string, onDate: Date = new Date()) {
  const age = getAge(birthday, onDate);
  if (getAgePool(birthday, onDate)) return age;
  throw new Error(
    `${age}-year-olds are outside the Kids Church age range (4–12).`,
  );
}

export const AGE_POOL_LABELS: Record<AgePool, string> = {
  "4-6": "Ages 4–6",
  "7-9": "Ages 7–9",
  "10-12": "Ages 10–12",
};

export function childFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

export function formatBirthday(birthday: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseISO(birthday));
}

/** Spreadsheet-style birthday: MM/DD/YYYY */
export function formatBirthdayMdY(birthday: string) {
  const [yyyy, mm, dd] = birthday.split("-");
  if (!yyyy || !mm || !dd) return birthday;
  return `${mm}/${dd}/${yyyy}`;
}

export function formatSessionLabel(startedAt: string, timeZone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startedAt));
}

export function formatTime(iso: string | null, timeZone = "Asia/Manila") {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function sortByAgeThenName<T extends { child: { firstName: string; lastName: string; birthday: string } }>(
  rows: T[],
) {
  return [...rows].sort((a, b) => {
    const ageDiff = getAge(a.child.birthday) - getAge(b.child.birthday);
    if (ageDiff !== 0) return ageDiff;
    return childFullName(a.child.firstName, a.child.lastName).localeCompare(
      childFullName(b.child.firstName, b.child.lastName),
    );
  });
}
