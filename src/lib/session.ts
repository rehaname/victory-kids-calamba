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

/** Manila-local wall clock as HHmmss (24h), for session name suffixes. */
export function manilaHHmmss(at: Date = new Date(), timeZone = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}${get("minute")}${get("second")}`;
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

/** Trimmed free-text location; empty after trim is rejected. */
export function requireLocation(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    throw new Error("Enter a location (e.g. Halang or Bayan).");
  }
  return trimmed;
}

/** Trim + collapse whitespace runs into single underscores for the session name. */
export function sanitizeLocationForName(location: string): string {
  return location.trim().replace(/\s+/g, "_");
}

export function formatServiceTime(serviceTime: string): string {
  const normalized = normalizeServiceTime(serviceTime);
  return normalized ? normalized.toUpperCase() : "";
}

/**
 * `{Location}_{serviceTime}_Service_{YYYY-MM-DD}_{HHmmss}` in Asia/Manila.
 * Example: Halang_9am_Service_2026-08-30_091530
 */
export function defaultSessionName(
  location: string,
  serviceTime: string,
  at: Date = new Date(),
): string {
  const site = sanitizeLocationForName(requireLocation(location));
  const time = requireServiceTime(serviceTime);
  return `${site}_${time}_Service_${manilaDate(at)}_${manilaHHmmss(at)}`;
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

/** "Halang_9am_Service_… · Sun, Aug 23, 2026" for pickers and receipts. */
export function sessionFullLabel(session: Session): string {
  return `${sessionDisplayName(session)} · ${formatSessionDate(session.sessionDate)}`;
}
