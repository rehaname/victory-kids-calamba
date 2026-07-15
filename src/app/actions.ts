"use server";

import { revalidatePath } from "next/cache";
import { diagnoseDataSource, getRepository, resolveDataSource } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import {
  DEFAULT_STAFF_PIN,
  extractPinFromRemarks,
  isValidPinFormat,
  normalizePin,
  staffPinConfigured,
} from "@/lib/staff-pin";
import { createPublicAdminClient } from "@/lib/supabase/public-admin";
import { TENANT } from "@/lib/tenant";
import type { AttendanceWithChild, RegisterInput, Session } from "@/lib/types";

function refreshPool() {
  revalidatePath("/");
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
    const session = await repo.getOpenSession();
    const active = session ? await repo.listActiveAttendance(session.id) : [];
    const sessions = await repo.listSessions();
    return {
      session,
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

export async function startSessionAction() {
  try {
    const repo = getRepository();
    await repo.startSession();
    refreshPool();
    refreshHistory();
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: errorMessage(err, "Could not start session.") };
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

export async function listChildrenAction() {
  try {
    return await getRepository().listChildren();
  } catch (err) {
    console.error("listChildrenAction failed:", errorMessage(err));
    return [];
  }
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

    const repo = getRepository();
    const result = await repo.registerFamily(input);
    if (input.checkInNow) {
      const session = await repo.getOpenSession();
      if (!session) {
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

export async function checkInAction(childId: string) {
  const repo = getRepository();
  const session = await repo.getOpenSession();
  if (!session) throw new Error("Start a session before checking in");
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
