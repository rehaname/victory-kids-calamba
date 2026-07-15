"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getSessionHistoryAction } from "@/app/actions";
import {
  formatBirthdayMdY,
  formatSessionLabel,
  formatTime,
  getAge,
} from "@/lib/age";
import {
  downloadCsv,
  SESSION_EXPORT_HEADERS,
  sessionExportCells,
} from "@/lib/csv";
import type { AttendanceWithChild, Session } from "@/lib/types";
import { KioskHeader } from "@/components/kiosk-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  sessions: Session[];
};

export function HistoryModule({ sessions }: Props) {
  const [historySessionId, setHistorySessionId] = useState(sessions[0]?.id ?? "");
  const [historyRows, setHistoryRows] = useState<AttendanceWithChild[]>([]);
  const [pending, startTransition] = useTransition();

  function loadHistory(sessionId: string) {
    setHistorySessionId(sessionId);
    startTransition(async () => {
      try {
        const rows = await getSessionHistoryAction(sessionId);
        setHistoryRows(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load history");
      }
    });
  }

  useEffect(() => {
    if (sessions[0]) loadHistory(sessions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions[0]?.id]);

  function exportSession() {
    const selected = sessions.find((s) => s.id === historySessionId);
    const stamp = selected
      ? formatSessionLabel(selected.startedAt).replace(/[^a-zA-Z0-9]+/g, "-")
      : historySessionId;
    downloadCsv(
      `kids-church-session-${stamp}.csv`,
      SESSION_EXPORT_HEADERS,
      historyRows.map(sessionExportCells),
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black">
      <KioskHeader
        title="History"
        subtitle="Past Kids Church sessions"
        showSessionControls={false}
        showHistoryLink={false}
        showPoolLink
      />

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="xl" asChild>
            <Link href="/">← Back to Kids Church pool</Link>
          </Button>
          {historyRows.length > 0 && (
            <Button
              size="xl"
              className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
              onClick={exportSession}
            >
              Extract session CSV
            </Button>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <Label className="mb-2 block">Session</Label>
          <select
            className="h-14 w-full rounded-md border border-black/15 bg-white px-3 text-base"
            value={historySessionId}
            disabled={pending}
            onChange={(e) => loadHistory(e.target.value)}
          >
            {sessions.length === 0 && <option value="">No sessions yet</option>}
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSessionLabel(s.startedAt)} · {s.status}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="bg-[#003B8E] text-white">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Last Name</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">First Name</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Nickname</th>
                <th className="px-3 py-3 font-medium">Age</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Birthday</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Home Service</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Parent&apos;s Name</th>
                <th className="px-3 py-3 font-medium">Address</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Contact</th>
                <th className="px-3 py-3 font-medium">In</th>
                <th className="px-3 py-3 font-medium">Out</th>
                <th className="whitespace-nowrap px-3 py-3 font-medium">Claimed by</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-black/45">
                    {pending ? "Loading…" : "Select a session to view attendance."}
                  </td>
                </tr>
              ) : (
                historyRows.map((row) => (
                  <tr key={row.id} className="border-t border-black/5">
                    <td className="px-3 py-2.5 font-medium">{row.child.lastName}</td>
                    <td className="px-3 py-2.5">{row.child.firstName}</td>
                    <td className="px-3 py-2.5">{row.child.nickname || "—"}</td>
                    <td className="px-3 py-2.5">{getAge(row.child.birthday)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {formatBirthdayMdY(row.child.birthday)}
                    </td>
                    <td className="px-3 py-2.5">{row.child.homeService || "—"}</td>
                    <td className="px-3 py-2.5">{row.child.parent.fullName}</td>
                    <td className="px-3 py-2.5 text-black/70">
                      {row.child.parent.address || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.child.parent.contactNumber || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatTime(row.timeIn)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatTime(row.timeOut)}</td>
                    <td className="px-3 py-2.5">{row.claimantName ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {historyRows.length > 0 && (
          <p className="text-sm text-black/50">
            {historyRows.length} check-in{historyRows.length === 1 ? "" : "s"} in
            this session — use Extract session CSV to download the full sheet.
          </p>
        )}
      </main>
    </div>
  );
}
