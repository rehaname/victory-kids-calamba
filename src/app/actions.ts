"use server";

import { revalidatePath } from "next/cache";
import { diagnoseDataSource, getRepository, resolveDataSource } from "@/lib/data";
import { formatDuplicateBlockMessage } from "@/lib/child-duplicates";
import { errorMessage } from "@/lib/errors";
import { toKioskChildHit } from "@/lib/kiosk-search";
import {
  DEFAULT_STAFF_PIN,
  extractPinFromRemarks,
  isValidPinFormat,
  normalizePin,
  staffPinConfigured,
} from "@/lib/staff-pin";
import { buildReceipt } from "@/lib/receipt";
import { requireLocation, requireServiceTime } from "@/lib/session";
import { createPublicAdminClient } from "@/lib/supabase/public-admin";
import { TENANT } from "@/lib/tenant";
import type {
  AttendanceWithChild,
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
    const message = errorMessage(err);
    console.error("getDashboardData failed:", message);
    return {
      session: null,
      openSessions: [],
      active: [],
      sessions: [],
      dataSource: "error",
      configError: diagnostics.message || message,
      missingEnv: diagnostics.missing,
    };
  }
}

/**
 * Verify the 6-digit staff PIN against public.profiles.remarks
 * for the victory_calamba admin profile. Church can update remarks anytime.
 */
export async function verifyStaffPinAction(pinInput: string) {
  const pin = normalizePin(pinInput);
  if (!isValidPinFormat(pin)) {
    return { ok: false as const, error: "Enter the 6-digit staff PIN." };
  }

  let expected: string | null = null;

  if (staffPinConfigured()) {
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
        return { ok: false as const, error: "Could not verify PIN. Try again." };
      }

      expected = extractPinFromRemarks(data?.remarks as string | null);
    } catch (err) {
      console.error("verifyStaffPinAction failed:", errorMessage(err));
      return { ok: false as const, error: "Could not verify PIN. Try again." };
    }
  } else {
    expected = process.env.KIOSK_STAFF_PIN?.trim() || DEFAULT_STAFF_PIN;
  }

  if (!expected || !isValidPinFormat(expected)) {
    return {
      ok: false as const,
      error: "Staff PIN is not configured. Ask an admin to set profiles.remarks.",
    };
  }

  if (pin !== expected) {
    return { ok: false as const, error: "Incorrect PIN." };
  }

  return { ok: true as const };
}

export async function startSessionAction(serviceTime: string, location: string) {
  try {
    requireServiceTime(serviceTime);
    requireLocation(location);
    const repo = getRepository();
    const session = await repo.startSession({ serviceTime, location });
    refreshPool();
    refreshHistory();
    return { ok: true as const, session };
  } catch (err) {
    return { ok: false as const, error: errorMessage(err, "Could not start session.") };
  }
}

export async function listOpenSessionsAction(): Promise<Session[]> {
  try {
    return await getRepository().listOpenSessions();
  } catch (err) {
    console.error("listOpenSessionsAction failed:", errorMessage(err));
    return [];
  }
}

export async function closeSessionAction(sessionId: string) {
  try {
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
    return { ok: false as const, error: errorMessage(err, "Could not close session.") };
  }
}

export async function searchChildrenAction(query: string) {
  return getRepository().searchChildren(query);
}

/**
 * Public kiosk search. Same matching as the staff search, but the payload is
 * stripped to first name + last initial so a walk-up tablet cannot dump the roster.
 */
export async function kioskSearchChildrenAction(query: string): Promise<KioskChildHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const rows = await getRepository().searchChildren(q);
    return rows.map(toKioskChildHit);
  } catch (err) {
    console.error("kioskSearchChildrenAction failed:", errorMessage(err));
    return [];
  }
}

export async function listChildrenAction() {
  try {
    return await getRepository().listChildren();
  } catch (err) {
    console.error("listChildrenAction failed:", errorMessage(err));
    return [];
  }
}

/**
 * Soft-delete a child from the roster. Blocks if they are currently checked in.
 * Does not delete attendance history or parent rows.
 */
export async function deleteChildAction(childId: string) {
  try {
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
    console.error("deleteChildAction failed:", errorMessage(err));
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
    console.error("registerFamilyAction failed:", errorMessage(err));
    return { ok: false as const, error: errorMessage(err, "Could not save registration.") };
  }
}

export async function checkInAction(childId: string, sessionId?: string) {
  const repo = getRepository();
  const session = sessionId
    ? await repo.getSession(sessionId)
    : await repo.getOpenSession();
  if (!session) throw new Error("Start a session before checking in");
  if (session.status !== "open") throw new Error("That session is already closed");
  await repo.checkIn(session.id, childId);
  refreshPool();
}

export async function checkOutAction(attendanceId: string, claimantName: string) {
  await getRepository().checkOut(attendanceId, claimantName);
  refreshPool();
}

export async function getSessionHistoryAction(sessionId: string) {
  return getRepository().listAttendanceForSession(sessionId);
}

/* ---------------------------------------------------------------- kiosk --- */

export type KioskState = {
  /** Open sessions, newest first. Empty until staff starts one. */
  openSessions: Session[];
  /** The session the kiosk should check kids into, or null when none is open. */
  activeSession: Session | null;
  configError: string | null;
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
    const openSessions = await getRepository().listOpenSessions();
    const preferred = preferredSessionId
      ? openSessions.find((s) => s.id === preferredSessionId)
      : undefined;
    return {
      openSessions,
      activeSession: preferred ?? openSessions[0] ?? null,
      configError: diagnostics.message,
    };
  } catch (err) {
    const message = errorMessage(err);
    console.error("kioskStateAction failed:", message);
    return {
      openSessions: [],
      activeSession: null,
      configError: diagnostics.message || message,
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
    console.error("kioskRegisterAction failed:", errorMessage(err));
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
    console.error("kioskCheckInAction failed:", errorMessage(err));
    return { ok: false, error: errorMessage(err, "Could not check in.") };
  }
}

/** Currently checked-in kids for the settings roster, newest arrival last. */
export async function getSessionRosterAction(
  sessionId: string,
): Promise<AttendanceWithChild[]> {
  try {
    return await getRepository().listActiveAttendance(sessionId);
  } catch (err) {
    console.error("getSessionRosterAction failed:", errorMessage(err));
    return [];
  }
}

/** Rebuilds a slip for reprinting from the settings roster. */
export async function getReceiptAction(
  attendanceId: string,
): Promise<Receipt | null> {
  try {
    const repo = getRepository();
    const attendance = await repo.getAttendance(attendanceId);
    if (!attendance) return null;
    const session = await repo.getSession(attendance.sessionId);
    if (!session) return null;
    return buildReceipt(attendance, session);
  } catch (err) {
    console.error("getReceiptAction failed:", errorMessage(err));
    return null;
  }
}
