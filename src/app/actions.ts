"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
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
import type { RegisterInput } from "@/lib/types";

function refreshPool() {
  revalidatePath("/");
}

function refreshHistory() {
  revalidatePath("/history");
}

export async function getDashboardData() {
  try {
    const repo = getRepository();
    const session = await repo.getOpenSession();
    const active = session ? await repo.listActiveAttendance(session.id) : [];
    const sessions = await repo.listSessions();
    return { session, active, sessions };
  } catch (err) {
    // Avoid opaque Server Components digest; surface an empty dashboard + log.
    console.error("getDashboardData failed:", errorMessage(err));
    return { session: null, active: [], sessions: [] };
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
  const repo = getRepository();
  await repo.startSession();
  refreshPool();
  refreshHistory();
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
  refreshPool();
  refreshHistory();
}

export async function searchChildrenAction(query: string) {
  return getRepository().searchChildren(query);
}

export async function registerFamilyAction(input: RegisterInput) {
  try {
    if (
      process.env.VERCEL &&
      process.env.KIDS_DATA_SOURCE !== "supabase"
    ) {
      return {
        ok: false as const,
        error:
          "Database not configured on Vercel. Set KIDS_DATA_SOURCE=supabase and Supabase keys in Project → Environment Variables.",
      };
    }

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
