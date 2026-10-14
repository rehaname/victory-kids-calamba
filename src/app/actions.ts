"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { diagnoseDataSource, getRepository, resolveDataSource } from "@/lib/data";
import type { DataSourceDiagnostics } from "@/lib/data";
import { formatDuplicateBlockMessage } from "@/lib/child-duplicates";
import { errorMessage, logServerError } from "@/lib/errors";
import { toKioskChildHit } from "@/lib/kiosk-search";
import { grantStaffSession, requireStaff, StaffAuthError } from "@/lib/staff-session";
import {
  extractPinFromRemarks,
  isValidPinFormat,
  localDemoPin,
  normalizePin,
  staffPinConfigured,
} from "@/lib/staff-pin";
import { buildReceipt } from "@/lib/receipt";
import { requireLocation, requireServiceTime } from "@/lib/session";
import { createPublicAdminClient } from "@/lib/supabase/public-admin";
import { TENANT } from "@/lib/tenant";
import type {
  AttendanceWithChild,
  ChildWithParent,
  DuplicateChildMatch,
  KioskChildHit,
  Receipt,
  RegisterInput,
  Session,
} from "@/lib/types";

function refreshPool() {
  revalidatePath("/");
  revalidatePath("/kiosk");
}

function refreshHistory() {
  revalidatePath("/history");
}

function refreshChildren() {
  revalidatePath("/list");
  revalidatePath("/children");
}

function pinsMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function caughtConfigError(diagnostics: DataSourceDiagnostics, err: unknown) {
  if (err instanceof StaffAuthError) return errorMessage(err);
  if (diagnostics.mode === "error" && diagnostics.message) return diagnostics.message;
  return errorMessage(err);
}

export type DashboardData = {
  session: Session | null;
  openSessions: Session[];
  active: AttendanceWithChild[];
  sessions: Session[];
  dataSource: "supabase" | "memory" | "error";
  configError: string | null;
  missingEnv: string[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const diagnostics = diagnoseDataSource();

  try {
    await requireStaff();
    const dataSource = resolveDataSource();
    const repo = getRepository();
    const openSessions = await repo.listOpenSessions();
    const session = openSessions[0] ?? null;
    const active = session ? await repo.listActiveAttendance(session.id) : [];
    const sessions = await repo.listSessions();
    return {
      session,
      openSessions,
      active,
      sessions,
      dataSource,
      configError: diagnostics.message,
      missingEnv: diagnostics.missing,
    };
  } catch (err) {
    logServerError("getDashboardData failed", err);
    return {
      session: null,
      openSessions: [],
      active: [],
      sessions: [],
      dataSource: "error",
      configError: caughtConfigError(diagnostics, err),
      missingEnv: diagnostics.missing,
    };
  }
}

/**
 * Active victory_calamba admin PIN from profiles.remarks.
 * Does not consult the repo default or KIOSK_STAFF_PIN.
 */
async function readProfileStaffPin(): Promise<
  { ok: true; pin: string } | { ok: false; error: string }
> {
  try {
    const supabase = createPublicAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("remarks")
      .eq("tenant", TENANT)
      .eq("role", "admin")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { ok: false, error: "Could not verify PIN. Try again." };
    }

    const pin = extractPinFromRemarks(data?.remarks as string | null);
    if (!pin) {
      return {
        ok: false,
        error: "Staff PIN is not configured. Ask an admin to set profiles.remarks.",
      };
    }
    return { ok: true, pin };
  } catch (err) {
    logServerError("verifyStaffPinAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not verify PIN. Try again.") };
  }
}

/**
 * Verify the 6-digit staff PIN against public.profiles.remarks
 * for the victory_calamba admin profile. Church can update remarks anytime.
 * A match sets an httpOnly cookie. The PIN itself is not stored.
 */
export async function verifyStaffPinAction(pinInput: string) {
  const pin = normalizePin(pinInput);
  if (!isValidPinFormat(pin)) {
    return { ok: false as const, error: "Enter the 6-digit staff PIN." };
  }

  // Keys present: the profile row is the only accepted PIN. The repo default is local-only.
  const expected = staffPinConfigured()
    ? await readProfileStaffPin()
    : { ok: true as const, pin: localDemoPin() };

  if (!expected.ok) return expected;

  if (!isValidPinFormat(expected.pin)) {
    return {
      ok: false as const,
      error: "Staff PIN is not configured. Ask an admin to set profiles.remarks.",
    };
  }

  if (!pinsMatch(pin, expected.pin)) {
    return { ok: false as const, error: "Incorrect PIN." };
  }

  try {
    await grantStaffSession();
  } catch (err) {
    logServerError("grantStaffSession failed", err);
    return { ok: false as const, error: "Could not start the staff session. Try again." };
  }

  return { ok: true as const };
}

export async function startSessionAction(serviceTime: string, location: string) {
  try {
    await requireStaff();
    requireServiceTime(serviceTime);
    requireLocation(location);
    const repo = getRepository();
    const session = await repo.startSession({ serviceTime, location });
    refreshPool();
    refreshHistory();
    return { ok: true as const, session };
  } catch (err) {
    logServerError("startSessionAction failed", err);
    return { ok: false as const, error: errorMessage(err, "Could not start session.") };
  }
}

export async function listOpenSessionsAction(): Promise<Session[]> {
  await requireStaff();
  return getRepository().listOpenSessions();
}

export async function closeSessionAction(sessionId: string) {
  try {
    await requireStaff();
    const repo = getRepository();
    const active = await repo.listActiveAttendance(sessionId);
    if (active.length > 0) {
      return {
        ok: false as const,
        error: `${active.length} child(ren) still checked in. Check them out before closing.`,
      };
    }
    await repo.closeSession(sessionId);
    refreshPool();
    refreshHistory();
    return { ok: true as const };
  } catch (err) {
    logServerError("closeSessionAction failed", err);
    return { ok: false as const, error: errorMessage(err, "Could not close session.") };
  }
}

export async function searchChildrenAction(
  query: string,
): Promise<{ ok: true; children: ChildWithParent[] } | { ok: false; error: string }> {
  try {
    await requireStaff();
    return { ok: true, children: await getRepository().searchChildren(query) };
  } catch (err) {
    logServerError("searchChildrenAction failed", err);
    return { ok: false, error: errorMessage(err, "Search failed.") };
  }
}

export type KioskSearchResult =
  | { ok: true; hits: KioskChildHit[] }
  | { ok: false; error: string };

/**
 * Public kiosk search. Same matching as the staff search, but the payload is
 * stripped to first name + last initial so a walk-up tablet cannot dump the roster.
 */
export async function kioskSearchChildrenAction(query: string): Promise<KioskSearchResult> {
  const q = query.trim();
  if (q.length < 3) return { ok: true, hits: [] };
  try {
    const rows = await getRepository().searchChildren(q);
    return { ok: true, hits: rows.map(toKioskChildHit) };
  } catch (err) {
    logServerError("kioskSearchChildrenAction failed", err);
    return { ok: false, error: errorMessage(err, "Search is unavailable. Try again.") };
  }
}

export type ListChildrenResult =
  | { ok: true; children: ChildWithParent[] }
  | { ok: false; error: string };

export async function listChildrenAction(): Promise<ListChildrenResult> {
  try {
    await requireStaff();
    return { ok: true, children: await getRepository().listChildren() };
  } catch (err) {
    logServerError("listChildrenAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not load the roster.") };
  }
}

/**
 * Soft-delete a child from the roster. Blocks if they are currently checked in.
 * Does not delete attendance history or parent rows.
 */
export async function deleteChildAction(childId: string) {
  try {
    await requireStaff();
    resolveDataSource();
    if (!childId.trim()) {
      return { ok: false as const, error: "Missing child id." };
    }
    await getRepository().softDeleteChild(childId);
    refreshChildren();
    refreshPool();
    refreshHistory();
    return { ok: true as const };
  } catch (err) {
    logServerError("deleteChildAction failed", err);
    return {
      ok: false as const,
      error: errorMessage(err, "Could not remove child from roster."),
    };
  }
}

async function blockIfDuplicateChildren(input: RegisterInput) {
  const duplicates = await getRepository().findLikelyDuplicates(input.children);
  if (duplicates.length === 0) return null;
  return {
    ok: false as const,
    error: formatDuplicateBlockMessage(
      duplicates.map((d) => ({
        childFirstName: d.firstName,
        childLastName: d.lastName,
        birthday: d.birthday,
        parentName: d.parentName,
      })),
    ),
    duplicates,
  };
}

export async function registerFamilyAction(input: RegisterInput) {
  try {
    await requireStaff();
    resolveDataSource();

    if (!input.parent.fullName.trim()) {
      return { ok: false as const, error: "Parent name is required." };
    }
    if (!input.children.length) {
      return { ok: false as const, error: "Add at least one child." };
    }
    for (const child of input.children) {
      if (!child.firstName.trim() || !child.lastName.trim()) {
        return { ok: false as const, error: "Each child needs a first and last name." };
      }
      if (!child.birthday) {
        return { ok: false as const, error: "Each child needs a birthday." };
      }
    }

    const dup = await blockIfDuplicateChildren(input);
    if (dup) return dup;

    const repo = getRepository();
    const result = await repo.registerFamily(input);
    if (input.checkInNow) {
      const session = input.sessionId
        ? await repo.getSession(input.sessionId)
        : await repo.getOpenSession();
      if (!session || session.status !== "open") {
        return {
          ok: false as const,
          error: "Family saved, but no open session — start Kids Church to check in.",
        };
      }
      for (const child of result.children) {
        await repo.checkIn(session.id, child.id);
      }
      refreshPool();
    }
    refreshHistory();
    refreshChildren();
    return { ok: true as const };
  } catch (err) {
    logServerError("registerFamilyAction failed", err);
    return { ok: false as const, error: errorMessage(err, "Could not save registration.") };
  }
}

export async function checkInAction(childId: string, sessionId?: string) {
  try {
    await requireStaff();
    const repo = getRepository();
    const session = sessionId
      ? await repo.getSession(sessionId)
      : await repo.getOpenSession();
    if (!session) throw new Error("Start a session before checking in");
    if (session.status !== "open") throw new Error("That session is already closed");
    await repo.checkIn(session.id, childId);
    refreshPool();
    return { ok: true as const };
  } catch (err) {
    logServerError("checkInAction failed", err);
    return { ok: false as const, error: errorMessage(err, "Could not check in.") };
  }
}

export async function checkOutAction(attendanceId: string, claimantName: string) {
  try {
    await requireStaff();
    await getRepository().checkOut(attendanceId, claimantName);
    refreshPool();
    return { ok: true as const };
  } catch (err) {
    logServerError("checkOutAction failed", err);
    return { ok: false as const, error: errorMessage(err, "Could not check out.") };
  }
}

export type SessionHistoryResult =
  | { ok: true; rows: AttendanceWithChild[] }
  | { ok: false; error: string };

export async function getSessionHistoryAction(sessionId: string): Promise<SessionHistoryResult> {
  try {
    await requireStaff();
    return { ok: true, rows: await getRepository().listAttendanceForSession(sessionId) };
  } catch (err) {
    logServerError("getSessionHistoryAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not load history.") };
  }
}

/* ---------------------------------------------------------------- kiosk --- */

export type KioskState = {
  /** Open sessions, newest first. Empty until staff starts one. */
  openSessions: Session[];
  /** The session the kiosk should check kids into, or null when none is open. */
  activeSession: Session | null;
  configError: string | null;
  /** Open check-in counts only. Child rows stay on the server. */
  checkedInCounts: Record<string, number>;
};

/**
 * The kiosk asks for its own state on load and after every settings change.
 * `preferredSessionId` is the session this device last selected; it is honoured
 * only while that session is still open.
 */
export async function kioskStateAction(
  preferredSessionId?: string | null,
): Promise<KioskState> {
  const diagnostics = diagnoseDataSource();
  try {
    resolveDataSource();
    const repo = getRepository();
    const openSessions = await repo.listOpenSessions();
    const checkedInCounts: Record<string, number> = {};
    for (const session of openSessions) {
      const rows = await repo.listActiveAttendance(session.id);
      checkedInCounts[session.id] = rows.length;
    }
    const preferred = preferredSessionId
      ? openSessions.find((s) => s.id === preferredSessionId)
      : undefined;
    return {
      openSessions,
      activeSession: preferred ?? openSessions[0] ?? null,
      configError: diagnostics.message,
      checkedInCounts,
    };
  } catch (err) {
    logServerError("kioskStateAction failed", err);
    return {
      openSessions: [],
      activeSession: null,
      configError: caughtConfigError(diagnostics, err),
      checkedInCounts: {},
    };
  }
}

export type KioskRegisterResult =
  | { ok: true; children: Array<{ id: string; firstName: string; nickname: string }> }
  | { ok: false; error: string; duplicates?: DuplicateChildMatch[] };

/**
 * Saves the family and hands back the new child ids so the kiosk can offer to
 * check them in without a second lookup. Never checks in on its own — the
 * kiosk asks the parent first.
 */
export async function kioskRegisterAction(
  input: RegisterInput,
): Promise<KioskRegisterResult> {
  try {
    resolveDataSource();

    if (!input.parent.fullName.trim()) {
      return { ok: false, error: "Parent name is required." };
    }
    if (!input.children.length) {
      return { ok: false, error: "Add at least one child." };
    }
    for (const child of input.children) {
      if (!child.firstName.trim() || !child.lastName.trim()) {
        return { ok: false, error: "Each child needs a first and last name." };
      }
      if (!child.birthday) {
        return { ok: false, error: "Each child needs a birthday." };
      }
    }

    const dup = await blockIfDuplicateChildren(input);
    if (dup) return dup;

    const { children } = await getRepository().registerFamily({
      ...input,
      checkInNow: false,
    });
    refreshChildren();
    return {
      ok: true,
      children: children.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        nickname: c.nickname,
      })),
    };
  } catch (err) {
    logServerError("kioskRegisterAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not save registration.") };
  }
}

export type KioskCheckInResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; error: string };

/** Checks a child in and returns the slip to print, in one round trip. */
export async function kioskCheckInAction(
  sessionId: string,
  childId: string,
): Promise<KioskCheckInResult> {
  try {
    const repo = getRepository();
    const session = await repo.getSession(sessionId);
    if (!session) {
      return { ok: false, error: "That session no longer exists." };
    }
    if (session.status !== "open") {
      return { ok: false, error: "That session has been closed. Ask a volunteer." };
    }

    const attendance = await repo.checkIn(sessionId, childId);
    const hydrated = await repo.getAttendance(attendance.id);
    if (!hydrated) {
      return { ok: false, error: "Checked in, but the receipt could not be built." };
    }

    refreshPool();
    refreshHistory();
    return { ok: true, receipt: buildReceipt(hydrated, session) };
  } catch (err) {
    logServerError("kioskCheckInAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not check in.") };
  }
}

export type SessionRosterResult =
  | { ok: true; rows: AttendanceWithChild[] }
  | { ok: false; error: string };

/** Currently checked-in kids for staff screens. Not available without the staff cookie. */
export async function getSessionRosterAction(sessionId: string): Promise<SessionRosterResult> {
  try {
    await requireStaff();
    return { ok: true, rows: await getRepository().listActiveAttendance(sessionId) };
  } catch (err) {
    logServerError("getSessionRosterAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not load who is checked in.") };
  }
}

export type ReceiptResult = { ok: true; receipt: Receipt } | { ok: false; error: string };

/** Rebuilds a slip for reprinting from the settings roster. */
export async function getReceiptAction(attendanceId: string): Promise<ReceiptResult> {
  try {
    await requireStaff();
    const repo = getRepository();
    const attendance = await repo.getAttendance(attendanceId);
    if (!attendance) return { ok: false, error: "That check-in no longer exists." };
    const session = await repo.getSession(attendance.sessionId);
    if (!session) return { ok: false, error: "That session no longer exists." };
    return { ok: true, receipt: buildReceipt(attendance, session) };
  } catch (err) {
    logServerError("getReceiptAction failed", err);
    return { ok: false, error: errorMessage(err, "Could not rebuild that slip.") };
  }
}
