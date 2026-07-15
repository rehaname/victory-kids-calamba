"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getSessionHistoryAction } from "@/app/actions";
import { childFullName, formatSessionLabel, formatTime } from "@/lib/age";
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
        <Button variant="outline" asChild>
          <Link href="/">← Back to Kids Church pool</Link>
        </Button>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <Label className="mb-2 block">Session</Label>
          <select
            className="h-12 w-full rounded-md border border-black/15 bg-white px-3 text-base"
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

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#003B8E] text-white">
              <tr>
                <th className="px-4 py-3 font-medium">Child</th>
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">In</th>
                <th className="px-4 py-3 font-medium">Out</th>
                <th className="px-4 py-3 font-medium">Claimed by</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-black/45">
                    {pending ? "Loading…" : "Select a session to view attendance."}
                  </td>
                </tr>
              ) : (
                historyRows.map((row) => (
                  <tr key={row.id} className="border-t border-black/5">
                    <td className="px-4 py-3 font-medium">
                      {childFullName(row.child.firstName, row.child.lastName)}
                    </td>
                    <td className="px-4 py-3 text-black/65">{row.child.parent.fullName}</td>
                    <td className="px-4 py-3">{formatTime(row.timeIn)}</td>
                    <td className="px-4 py-3">{formatTime(row.timeOut)}</td>
                    <td className="px-4 py-3">{row.claimantName ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {historyRows.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              const csv = [
                ["Child", "Parent", "Time In", "Time Out", "Claimed By"].join(","),
                ...historyRows.map((row) =>
                  [
                    `"${childFullName(row.child.firstName, row.child.lastName)}"`,
                    `"${row.child.parent.fullName}"`,
                    row.timeIn,
                    row.timeOut ?? "",
                    `"${row.claimantName ?? ""}"`,
                  ].join(","),
                ),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `kids-church-${historySessionId}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
        )}
      </main>
    </div>
  );
}
