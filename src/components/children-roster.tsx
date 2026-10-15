"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteChildAction, deleteChildrenAction } from "@/app/actions";
import {
  downloadCsv,
  ROSTER_HEADERS,
  rosterCells,
} from "@/lib/csv";
import { formatBirthdayMdY, getAge } from "@/lib/age";
import type { ChildWithParent } from "@/lib/types";
import { DatabaseStatusBanner } from "@/components/database-status-banner";
import { KioskHeader } from "@/components/kiosk-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  roster: ChildWithParent[];
  configError?: string | null;
  missingEnv?: string[];
  loadFailed?: boolean;
};

function rosterSort(a: ChildWithParent, b: ChildWithParent) {
  return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
}

function buildBulkDeleteConfirm(
  selectedIds: Set<string>,
  rows: ChildWithParent[],
  rosterById: Map<string, ChildWithParent>,
): string {
  const n = selectedIds.size;
  const rowIdSet = new Set(rows.map((c) => c.id));
  const hiddenCount = [...selectedIds].filter((id) => !rowIdSet.has(id)).length;

  const selectedChildren = [...selectedIds]
    .map((id) => rosterById.get(id))
    .filter((c): c is ChildWithParent => Boolean(c))
    .sort(rosterSort);

  const lines: string[] = [];

  if (n === 1 && selectedChildren[0]) {
    const child = selectedChildren[0];
    lines.push(`Remove ${child.firstName} ${child.lastName} from the roster?`);
  } else if (n >= 2 && n <= 8) {
    lines.push(`Remove ${n} children from the roster?`);
    for (const child of selectedChildren) {
      lines.push(`• ${child.firstName} ${child.lastName}`);
    }
  } else {
    lines.push(`Remove ${n} children from the roster?`);
  }

  if (hiddenCount > 0) {
    lines.push(`Includes ${hiddenCount} not shown in the current search.`);
  }
  lines.push("Past check-ins stay in history.");
  return lines.join("\n");
}

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
  const deleteLock = useRef(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());

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

  const controlsDisabled = bulkDeleting || Boolean(deletingId);

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

  async function handleBulkDelete() {
    if (deleteLock.current || selectedIds.size === 0) return;
    deleteLock.current = true;

    const confirmed = window.confirm(
      buildBulkDeleteConfirm(selectedIds, rows, rosterById),
    );
    if (!confirmed) {
      deleteLock.current = false;
      return;
    }

    setBulkDeleting(true);
    const ids = [...selectedIds];
    try {
      const result = await deleteChildrenAction(ids);
      if (!result.ok) {
        toast.error(result.error);
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
      if (ids.length === 1) {
        const child = rosterById.get(ids[0]!);
        toast.success(
          child
            ? `${child.firstName} ${child.lastName} removed from roster`
            : "1 removed from roster",
        );
      } else {
        toast.success(`${ids.length} removed from roster`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove children.");
    } finally {
      deleteLock.current = false;
      setBulkDeleting(false);
    }
  }

  async function handleDelete(child: ChildWithParent) {
    if (deleteLock.current) return;
    deleteLock.current = true;

    const confirmed = window.confirm(
      `Remove ${child.firstName} ${child.lastName} from the roster? Past check-ins stay in history.`,
    );
    if (!confirmed) {
      deleteLock.current = false;
      return;
    }

    setDeletingId(child.id);
    try {
      const result = await deleteChildAction(child.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(child.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(child.id);
        return next;
      });
      toast.success(`${child.firstName} ${child.lastName} removed from roster`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove child.");
    } finally {
      deleteLock.current = false;
      setDeletingId(null);
    }
  }

  const selectedCount = selectedIds.size;

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
            onClick={() => void handleBulkDelete()}
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
            value={query}
            disabled={controlsDisabled}
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
                          onClick={() => void handleDelete(child)}
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
    </div>
  );
}
