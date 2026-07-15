import { differenceInYears, parseISO } from "date-fns";
import type { AgePool } from "@/lib/types";

export function getAge(birthday: string, onDate: Date = new Date()): number {
  return differenceInYears(onDate, parseISO(birthday));
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
