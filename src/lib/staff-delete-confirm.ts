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

/** Continue stays disabled until a successful preview, and while anyone is checked in. */
export function kidContinueDisabled(options: {
  previewLoading: boolean;
  previewReady: boolean;
  checkedInCount: number;
}): boolean {
  return (
    options.previewLoading ||
    !options.previewReady ||
    options.checkedInCount > 0
  );
}

/** Raw request cap. Unique ids are capped again after trimming. */
export const DELETE_PREVIEW_MAX_IDS = 1000;

/**
 * PostgREST `.in()` filters travel in the URL, and the API caps each response
 * (often 1000 rows). Chunk ids and page within each chunk so a large selection
 * is a handful of queries, not one query per child and not a silent truncate.
 */
export const DELETE_PREVIEW_ID_CHUNK = 80;
export const DELETE_PREVIEW_PAGE_SIZE = 1000;
export const DELETE_PREVIEW_MAX_PAGES = 40;

const ROSTER_CHILD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDeleteChildIds(
  childIds: unknown,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(childIds) || childIds.length === 0) {
    return { ok: false, error: "Select at least one child." };
  }
  if (childIds.length > DELETE_PREVIEW_MAX_IDS) {
    return { ok: false, error: "Select fewer children and try again." };
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of childIds) {
    if (typeof value !== "string" || value.length > 64) {
      return { ok: false, error: "Select at least one child." };
    }
    const id = value.trim();
    if (!id) continue;
    if (!ROSTER_CHILD_UUID_RE.test(id)) {
      return { ok: false, error: "Select at least one child." };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (ids.length === 0) {
    return { ok: false, error: "Select at least one child." };
  }
  return { ok: true, ids };
}

export function chunkIds<T>(ids: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("Chunk size must be at least 1.");
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export type PreviewAttendanceRow = {
  childId: string;
  timeOut: string | null;
};

export function addPreviewAttendance(
  visitCounts: Record<string, number>,
  checkedIn: Set<string>,
  rows: readonly PreviewAttendanceRow[],
) {
  for (const row of rows) {
    visitCounts[row.childId] = (visitCounts[row.childId] ?? 0) + 1;
    if (row.timeOut === null) checkedIn.add(row.childId);
  }
}

/**
 * Pages until a short page. Throws instead of returning a partial count so a
 * checked-in child past the row cap cannot be treated as safe to delete.
 */
export async function collectPreviewPages(
  fetchPage: (from: number, to: number) => Promise<readonly PreviewAttendanceRow[]>,
  pageSize: number,
  maxPages: number,
): Promise<PreviewAttendanceRow[]> {
  const all: PreviewAttendanceRow[] = [];
  let page = 0;
  while (true) {
    if (page >= maxPages) {
      throw new Error("Could not load visit history");
    }
    const from = page * pageSize;
    const rows = await fetchPage(from, from + pageSize - 1);
    all.push(...rows);
    if (rows.length < pageSize) return all;
    page += 1;
  }
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
