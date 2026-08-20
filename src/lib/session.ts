import { formatSessionLabel } from "@/lib/age";
import { APP_TIMEZONE } from "@/lib/tenant";
import { SERVICE_TIMES, type Session } from "@/lib/types";

/** Manila-local calendar date as YYYY-MM-DD. en-CA formats in that order. */
export function manilaDate(at: Date = new Date(), timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Accepts "9AM", " 9am ", etc. Returns "" for anything not a known service time. */
export function normalizeServiceTime(value: string | null | undefined): string {
  const candidate = (value ?? "").trim().toLowerCase();
  return (SERVICE_TIMES as readonly string[]).includes(candidate) ? candidate : "";
}

export function requireServiceTime(value: string | null | undefined): string {
  const normalized = normalizeServiceTime(value);
  if (!normalized) {
    throw new Error("Pick a service time (9AM, 11AM, 2PM, or 4PM).");
  }
  return normalized;
}

export function formatServiceTime(serviceTime: string): string {
  const normalized = normalizeServiceTime(serviceTime);
  return normalized ? normalized.toUpperCase() : "";
}

/** "9AM Service" — the label staff and parents recognise. */
export function defaultSessionName(serviceTime: string, at: Date = new Date()): string {
  const label = formatServiceTime(serviceTime);
  return label ? `${label} Service` : formatSessionLabel(at.toISOString());
}

/** Falls back to the start timestamp for sessions created before names existed. */
export function sessionDisplayName(session: Session): string {
  return session.name.trim() || formatSessionLabel(session.startedAt);
}

/**
 * sessionDate is already a Manila-local calendar date, so it is parsed and
 * formatted as UTC midnight to keep the day from shifting.
 */
export function formatSessionDate(sessionDate: string): string {
  const parsed = new Date(`${sessionDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return sessionDate;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

/** "9AM Service · Sun, Aug 23, 2026" for pickers and receipts. */
export function sessionFullLabel(session: Session): string {
  return `${sessionDisplayName(session)} · ${formatSessionDate(session.sessionDate)}`;
}
