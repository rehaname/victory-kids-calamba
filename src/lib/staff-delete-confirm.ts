import type { ChildWithParent } from "@/lib/types";

export type DeleteConfirmStep = 1 | 2;

export type ChildrenDeletePreview = {
  visitCounts: Record<string, number>;
  checkedInChildIds: string[];
};

/** Step 1 never calls delete; only step 2 may. */
export function shouldInvokeDelete(step: DeleteConfirmStep): boolean {
  return step === 2;
}

export function advanceKidDeleteStep(
  step: DeleteConfirmStep,
  blockContinue: boolean,
): DeleteConfirmStep {
  if (step !== 1 || blockContinue) return step;
  return 2;
}

export function kidDeleteSummaryTitle(count: number): string {
  return count === 1 ? "Delete kid?" : `Delete ${count} kids?`;
}

export function kidDeleteFinalTitle(count: number): string {
  return count === 1 ? "Are you sure?" : `Delete ${count} kids?`;
}

export function kidDeleteFinalBody(count: number): string {
  if (count === 1) {
    return "This kid will be removed from the roster. You can't undo this from the app.";
  }
  return `${count} kids will be removed from the roster. You can't undo this from the app.`;
}

export function sessionDeleteSummaryTitle(): string {
  return "Delete session?";
}

export function sessionDeleteFinalTitle(): string {
  return "Are you sure?";
}

export function sessionDeleteFinalBody(checkInCount: number): string {
  const noun = checkInCount === 1 ? "check-in" : "check-ins";
  if (checkInCount === 0) {
    return "This session will be hidden from History. You can't undo this from the app.";
  }
  return `This session and ${checkInCount} ${noun} will be hidden from reports and CSV. You can't undo this from the app.`;
}

export function visitCountLabel(count: number): string {
  if (count === 0) return "No past visits in history";
  if (count === 1) return "1 past visit stays in history";
  return `${count} past visits stay in history`;
}

export function rosterSort(a: ChildWithParent, b: ChildWithParent) {
  return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
}

export function selectedKidsForDelete(
  selectedIds: Set<string> | string[],
  rosterById: Map<string, ChildWithParent>,
): ChildWithParent[] {
  const ids = selectedIds instanceof Set ? [...selectedIds] : selectedIds;
  return ids
    .map((id) => rosterById.get(id))
    .filter((c): c is ChildWithParent => Boolean(c))
    .sort(rosterSort);
}

export function hiddenSelectedCount(
  selectedIds: Set<string>,
  visibleRowIds: Set<string>,
): number {
  return [...selectedIds].filter((id) => !visibleRowIds.has(id)).length;
}

export function sessionHasCheckedInKids(
  rows: { timeOut: string | null }[],
): boolean {
  return rows.some((row) => row.timeOut === null);
}

/** Handler-level double-submit guard for delete actions. */
export function createDeleteRunGuard() {
  let inFlight = false;
  return {
    tryBegin(): boolean {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    end() {
      inFlight = false;
    },
    isInFlight() {
      return inFlight;
    },
  };
}

export type DeleteRunOutcome = "skipped-step" | "skipped-guard" | "ran";

/** Only step 2 runs deleteFn; guard prevents double submit. */
export async function runDeleteAtStep(
  step: DeleteConfirmStep,
  guard: ReturnType<typeof createDeleteRunGuard>,
  deleteFn: () => Promise<void>,
): Promise<DeleteRunOutcome> {
  if (!shouldInvokeDelete(step)) return "skipped-step";
  if (!guard.tryBegin()) return "skipped-guard";
  try {
    await deleteFn();
    return "ran";
  } finally {
    guard.end();
  }
}
