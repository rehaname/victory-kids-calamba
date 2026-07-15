import { differenceInYears, parseISO } from "date-fns";
import type { AgePool } from "@/lib/types";

export function getAge(birthday: string, onDate: Date = new Date()): number {
  return differenceInYears(onDate, parseISO(birthday));
}

export function getAgePool(birthday: string, onDate: Date = new Date()): AgePool {
  const age = getAge(birthday, onDate);
  if (age >= 4 && age <= 6) return "4-6";
  if (age >= 7 && age <= 9) return "7-9";
  if (age >= 10 && age <= 12) return "10-12";
  return "needs-review";
}

export const AGE_POOL_LABELS: Record<AgePool, string> = {
  "4-6": "Ages 4–6",
  "7-9": "Ages 7–9",
  "10-12": "Ages 10–12",
  "needs-review": "Needs Review",
};

export function childFullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
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
