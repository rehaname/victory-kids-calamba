"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteChildAction } from "@/app/actions";
import {
  downloadCsv,
  ROSTER_HEADERS,
  rosterCells,
} from "@/lib/csv";
import { formatBirthdayMdY, getAge } from "@/lib/age";
import type { ChildWithParent } from "@/lib/types";
import { KioskHeader } from "@/components/kiosk-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  roster: ChildWithParent[];
};

export function ChildrenRoster({ roster }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());

  const visibleRoster = useMemo(
    () => roster.filter((child) => !removedIds.has(child.id)),
    [roster, removedIds],
  );

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

  function exportRoster() {
    downloadCsv(
      `registered-children-${new Date().toISOString().slice(0, 10)}.csv`,
      ROSTER_HEADERS,
      rows.map(rosterCells),
    );
  }

  async function handleDelete(child: ChildWithParent) {
    if (deletingId) return;

    const confirmed = window.confirm(
      `Remove ${child.firstName} ${child.lastName} from the roster? Past check-ins stay in history.`,
    );
    if (!confirmed) return;

    setDeletingId(child.id);
    try {
      const result = await deleteChildAction(child.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(child.id));
      toast.success(`${child.firstName} ${child.lastName} removed from roster`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove child.");
    } finally {
      setDeletingId(null);
    }
  }

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
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="xl" asChild>
            <Link href="/">← Back to Kids Church pool</Link>
          </Button>
          <Button
            size="xl"
            className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
            disabled={rows.length === 0}
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
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full min-w-[66rem] text-left text-sm">
            <thead className="bg-[#2e7d32] text-white">
              <tr>
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
                    colSpan={ROSTER_HEADERS.length + 1}
                    className="px-4 py-10 text-center text-black/45"
                  >
                    {visibleRoster.length === 0
                      ? "No children registered yet. Use Register to add families."
                      : "No matches for that search."}
                  </td>
                </tr>
              ) : (
                rows.map((child) => {
                  const busy = deletingId === child.id;
                  return (
                    <tr key={child.id} className="border-t border-black/5">
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
                          disabled={Boolean(deletingId)}
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
