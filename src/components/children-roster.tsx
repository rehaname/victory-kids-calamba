"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  deleteChildAction,
  deleteChildrenAction,
  getChildrenDeletePreviewAction,
} from "@/app/actions";
import {
  downloadCsv,
  ROSTER_HEADERS,
  rosterCells,
} from "@/lib/csv";
import { childFullName, formatBirthdayMdY, getAge } from "@/lib/age";
import type { ChildWithParent } from "@/lib/types";
import {
  advanceKidDeleteStep,
  createDeleteRunGuard,
  hiddenSelectedCount,
  kidDeleteFinalBody,
  kidDeleteFinalTitle,
  kidDeleteSummaryTitle,
  runDeleteAtStep,
  selectedKidsForDelete,
  visitCountLabel,
  type ChildrenDeletePreview,
  type DeleteConfirmStep,
} from "@/lib/staff-delete-confirm";
import { DatabaseStatusBanner } from "@/components/database-status-banner";
import { KioskHeader } from "@/components/kiosk-header";
import { TwoStepConfirmDialog } from "@/components/two-step-confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  roster: ChildWithParent[];
  configError?: string | null;
  missingEnv?: string[];
  loadFailed?: boolean;
};

type KidDeleteTarget =
  | { mode: "bulk"; ids: string[] }
  | { mode: "single"; child: ChildWithParent };

export function ChildrenRoster({
  roster,
  configError = null,
  missingEnv = [],
  loadFailed = false,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());

  const [deleteTarget, setDeleteTarget] = useState<KidDeleteTarget | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteConfirmStep>(1);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<ChildrenDeletePreview | null>(null);
  const deleteGuard = useRef(createDeleteRunGuard());

  const visibleRoster = useMemo(
    () => roster.filter((child) => !removedIds.has(child.id)),
    [roster, removedIds],
  );

  const rosterById = useMemo(() => {
    const map = new Map<string, ChildWithParent>();
    for (const child of visibleRoster) map.set(child.id, child);
    return map;
  }, [visibleRoster]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleRoster;
    return visibleRoster.filter((child) => {
      const hay = [
        child.lastName,
        child.firstName,
        child.nickname,
        child.parent.fullName,
        child.parent.address,
        child.parent.contactNumber,
        child.homeService,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [visibleRoster, query]);

  const shownIds = useMemo(() => rows.map((c) => c.id), [rows]);
  const allShownSelected =
    shownIds.length > 0 && shownIds.every((id) => selectedIds.has(id));
  const someShownSelected =
    shownIds.some((id) => selectedIds.has(id)) && !allShownSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someShownSelected;
  }, [someShownSelected]);

  const controlsDisabled =
    bulkDeleting || Boolean(deletingId) || Boolean(deleteTarget);

  const deleteIds = useMemo(() => {
    if (!deleteTarget) return [];
    if (deleteTarget.mode === "single") return [deleteTarget.child.id];
    return deleteTarget.ids;
  }, [deleteTarget]);

  const deleteKids = useMemo(
    () => selectedKidsForDelete(deleteIds, rosterById),
    [deleteIds, rosterById],
  );

  const checkedInSet = useMemo(
    () => new Set(preview?.checkedInChildIds ?? []),
    [preview],
  );

  const blockContinue = checkedInSet.size > 0;

  async function loadDeletePreview(ids: string[]) {
    setPreviewLoading(true);
    setPreview(null);
    setDeleteError(null);
    try {
      const result = await getChildrenDeletePreviewAction(ids);
      if (!result.ok) {
        setDeleteError(result.error);
        setPreview({ visitCounts: {}, checkedInChildIds: [] });
        return;
      }
      setPreview({
        visitCounts: result.visitCounts,
        checkedInChildIds: result.checkedInChildIds,
      });
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not load delete summary.",
      );
      setPreview({ visitCounts: {}, checkedInChildIds: [] });
    } finally {
      setPreviewLoading(false);
    }
  }

  function exportRoster() {
    downloadCsv(
      `registered-children-${new Date().toISOString().slice(0, 10)}.csv`,
      ROSTER_HEADERS,
      rows.map(rosterCells),
    );
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllShown() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allShownSelected) {
        for (const id of shownIds) next.delete(id);
      } else {
        for (const id of shownIds) next.add(id);
      }
      return next;
    });
  }

  function openBulkDeleteDialog() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setDeleteStep(1);
    setDeleteError(null);
    setDeleteTarget({ mode: "bulk", ids });
    void loadDeletePreview(ids);
  }

  function openSingleDeleteDialog(child: ChildWithParent) {
    setDeleteStep(1);
    setDeleteError(null);
    setDeleteTarget({ mode: "single", child });
    void loadDeletePreview([child.id]);
  }

  function closeDeleteDialog() {
    if (bulkDeleting || deletingId) return;
    setDeleteTarget(null);
    setDeleteStep(1);
    setDeleteError(null);
    setPreview(null);
  }

  function handleContinueDelete() {
    setDeleteError(null);
    setDeleteStep((step) => advanceKidDeleteStep(step, blockContinue));
  }

  async function performKidDelete() {
    const outcome = await runDeleteAtStep(deleteStep, deleteGuard.current, async () => {
      const ids = deleteIds;
      if (ids.length === 0) return;

      if (ids.length === 1) {
        setDeletingId(ids[0]!);
        const result = await deleteChildAction(ids[0]!);
        if (!result.ok) {
          setDeleteError(result.error);
          return;
        }
        setRemovedIds((prev) => new Set(prev).add(ids[0]!));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(ids[0]!);
          return next;
        });
        const child = rosterById.get(ids[0]!);
        toast.success(
          child
            ? `${child.firstName} ${child.lastName} removed from roster`
            : "Removed from roster",
        );
      } else {
        setBulkDeleting(true);
        const result = await deleteChildrenAction(ids);
        if (!result.ok) {
          setDeleteError(result.error);
          return;
        }
        setRemovedIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        toast.success(`${ids.length} removed from roster`);
      }
      router.refresh();
      closeDeleteDialog();
    });

    if (outcome === "skipped-step" || outcome === "skipped-guard") return;

    setDeletingId(null);
    setBulkDeleting(false);
  }

  const selectedCount = selectedIds.size;
  const deleteCount = deleteIds.length;
  const hiddenCount =
    deleteTarget?.mode === "bulk"
      ? hiddenSelectedCount(new Set(deleteTarget.ids), new Set(shownIds))
      : 0;

  const summaryBody = (
    <div className="space-y-3 text-sm">
      <p className="text-black/70">
        {deleteCount === 1
          ? "This removes the child from the roster. Past check-ins stay in history."
          : `This removes ${deleteCount} children from the roster. Past check-ins stay in history.`}
      </p>
      {hiddenCount > 0 ? (
        <p className="text-black/55">
          Includes {hiddenCount} not shown in the current search.
        </p>
      ) : null}
      {previewLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading delete summary">
          {Array.from({ length: Math.min(deleteCount, 4) }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-black/5" />
          ))}
        </div>
      ) : (
        <ul className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-black/10 p-2">
          {deleteKids.map((child) => {
            const visits = preview?.visitCounts[child.id] ?? 0;
            const checkedIn = checkedInSet.has(child.id);
            return (
              <li
                key={child.id}
                className={`rounded-md px-2 py-2 ${checkedIn ? "bg-amber-50 ring-1 ring-amber-200" : "bg-black/[0.02]"}`}
              >
                <p className="font-medium">
                  {childFullName(child.firstName, child.lastName)}
                </p>
                <p className="text-black/60">
                  Age {getAge(child.birthday)} · {formatBirthdayMdY(child.birthday)}
                  {child.parent.fullName ? ` · ${child.parent.fullName}` : ""}
                </p>
                <p className="text-black/50">{visitCountLabel(visits)}</p>
                {checkedIn ? (
                  <p className="mt-1 font-medium text-amber-900">
                    Currently checked in — check out before deleting.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {blockContinue && !previewLoading ? (
        <Alert variant="destructive">
          <AlertTitle>Check out first</AlertTitle>
          <AlertDescription>
            One or more selected kids are still checked in. Delete is blocked until
            they are checked out.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black">
      <KioskHeader
        title="List"
        subtitle="Registered kids roster"
        showSessionControls={false}
        showListLink={false}
        showPoolLink
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <DatabaseStatusBanner configError={configError} missingEnv={missingEnv} dataSource={loadFailed ? "error" : "supabase"} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="xl" asChild>
            <Link href="/">← Back to Kids Church pool</Link>
          </Button>
          <Button
            size="xl"
            variant="outline"
            disabled={selectedCount === 0 || controlsDisabled}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            onClick={openBulkDeleteDialog}
          >
            {bulkDeleting
              ? "Deleting…"
              : selectedCount > 0
                ? `Delete selected (${selectedCount})`
                : "Delete selected"}
          </Button>
          <Button
            size="xl"
            className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
            disabled={rows.length === 0 || controlsDisabled}
            onClick={exportRoster}
          >
            Extract CSV
          </Button>
          <p className="text-sm text-black/55">
            {rows.length} of {visibleRoster.length} children
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <Label htmlFor="roster-search" className="mb-2 block">
            Search
          </Label>
          <Input
            id="roster-search"
            className="h-14 text-base"
            placeholder="Name, nickname, parent, address, or contact…"
            disabled={controlsDisabled}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full min-w-[66rem] text-left text-sm">
            <thead className="bg-[#2e7d32] text-white">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-medium">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="size-5"
                    aria-label="Select all shown children"
                    checked={allShownSelected}
                    disabled={controlsDisabled || rows.length === 0}
                    onChange={toggleSelectAllShown}
                  />
                </th>
                {ROSTER_HEADERS.map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-3 font-medium">
                    {header}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={ROSTER_HEADERS.length + 2}
                    className="px-4 py-10 text-center text-black/45"
                  >
                    {loadFailed
                      ? "The roster could not be loaded."
                      : visibleRoster.length === 0
                        ? "No children registered yet. Use Register to add families."
                        : "No matches for that search."}
                  </td>
                </tr>
              ) : (
                rows.map((child) => {
                  const busy = deletingId === child.id;
                  return (
                    <tr key={child.id} className="border-t border-black/5">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="size-5"
                          aria-label={`Select ${child.firstName} ${child.lastName}`}
                          checked={selectedIds.has(child.id)}
                          disabled={controlsDisabled}
                          onChange={(e) => toggleRow(child.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium">{child.lastName}</td>
                      <td className="px-3 py-2.5">{child.firstName}</td>
                      <td className="px-3 py-2.5">{child.nickname || "—"}</td>
                      <td className="px-3 py-2.5">{getAge(child.birthday)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {formatBirthdayMdY(child.birthday)}
                      </td>
                      <td className="px-3 py-2.5">{child.homeService || "—"}</td>
                      <td className="px-3 py-2.5">{child.parent.fullName}</td>
                      <td className="px-3 py-2.5 text-black/70">
                        {child.parent.address || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {child.parent.contactNumber || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={controlsDisabled}
                          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => openSingleDeleteDialog(child)}
                        >
                          {busy ? "Deleting…" : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      <TwoStepConfirmDialog
        open={Boolean(deleteTarget)}
        step={deleteStep}
        deleting={bulkDeleting || Boolean(deletingId)}
        error={deleteError}
        summaryTitle={kidDeleteSummaryTitle(deleteCount)}
        summaryBody={summaryBody}
        finalTitle={kidDeleteFinalTitle(deleteCount)}
        finalDescription={kidDeleteFinalBody(deleteCount)}
        continueDisabled={blockContinue || previewLoading}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        onContinue={handleContinueDelete}
        onBack={() => {
          setDeleteError(null);
          setDeleteStep(1);
        }}
        onConfirmDelete={() => void performKidDelete()}
      />
    </div>
  );
}
