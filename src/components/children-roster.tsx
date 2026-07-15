"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((child) => {
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
  }, [roster, query]);

  function exportRoster() {
    downloadCsv(
      `registered-children-${new Date().toISOString().slice(0, 10)}.csv`,
      ROSTER_HEADERS,
      rows.map(rosterCells),
    );
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
            {rows.length} of {roster.length} children
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
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="bg-[#2e7d32] text-white">
              <tr>
                {ROSTER_HEADERS.map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={ROSTER_HEADERS.length}
                    className="px-4 py-10 text-center text-black/45"
                  >
                    {roster.length === 0
                      ? "No children registered yet. Use Register to add families."
                      : "No matches for that search."}
                  </td>
                </tr>
              ) : (
                rows.map((child) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
