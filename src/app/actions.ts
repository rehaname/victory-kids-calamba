"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import {
  DEFAULT_STAFF_PIN,
  extractPinFromRemarks,
  isValidPinFormat,
  normalizePin,
  staffPinConfigured,
} from "@/lib/staff-pin";
import { createPublicAdminClient } from "@/lib/supabase/public-admin";
import { TENANT } from "@/lib/tenant";
import type { RegisterInput } from "@/lib/types";

function refresh() {
  revalidatePath("/");
  revalidatePath("/history");
}

export async function getDashboardData() {
  const repo = getRepository();
  const session = await repo.getOpenSession();
  const active = session ? await repo.listActiveAttendance(session.id) : [];
  const sessions = await repo.listSessions();
  return { session, active, sessions };
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
  const repo = getRepository();
  await repo.startSession();
  refresh();
}

export async function closeSessionAction(sessionId: string) {
  const repo = getRepository();
  const active = await repo.listActiveAttendance(sessionId);
  if (active.length > 0) {
    throw new Error(
      `${active.length} child(ren) still checked in. Check them out before closing.`,
    );
  }
  await repo.closeSession(sessionId);
  refresh();
}

export async function searchChildrenAction(query: string) {
  return getRepository().searchChildren(query);
}

export async function registerFamilyAction(input: RegisterInput) {
  const repo = getRepository();
  const result = await repo.registerFamily(input);
  if (input.checkInNow) {
    const session = await repo.getOpenSession();
    if (!session) throw new Error("Start a session before checking in");
    for (const child of result.children) {
      await repo.checkIn(session.id, child.id);
    }
  }
  refresh();
  return result;
}

export async function checkInAction(childId: string) {
  const repo = getRepository();
  const session = await repo.getOpenSession();
  if (!session) throw new Error("Start a session before checking in");
  await repo.checkIn(session.id, childId);
  refresh();
}

export async function checkOutAction(attendanceId: string, claimantName: string) {
  await getRepository().checkOut(attendanceId, claimantName);
  refresh();
}

export async function getSessionHistoryAction(sessionId: string) {
  return getRepository().listAttendanceForSession(sessionId);
}
