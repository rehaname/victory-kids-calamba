"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import type { RegisterInput } from "@/lib/types";

function refresh() {
  revalidatePath("/");
}

export async function getDashboardData() {
  const repo = getRepository();
  const session = await repo.getOpenSession();
  const active = session ? await repo.listActiveAttendance(session.id) : [];
  const sessions = await repo.listSessions();
  return { session, active, sessions };
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
