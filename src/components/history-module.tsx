"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteSessionAction, getSessionHistoryAction } from "@/app/actions";
import {
  formatBirthdayMdY,
  formatTime,
  getAge,
} from "@/lib/age";
import {
  downloadCsv,
  SESSION_EXPORT_HEADERS,
  sessionExportCells,
} from "@/lib/csv";
import { sessionDisplayName } from "@/lib/session";
import type { AttendanceWithChild, Session } from "@/lib/types";
import { DatabaseStatusBanner } from "@/components/database-status-banner";
import { KioskHeader } from "@/components/kiosk-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  sessions: Session[];
  configError?: string | null;
  missingEnv?: string[];
  dataSource?: "supabase" | "memory" | "error";
};

function buildSessionDeleteConfirm(
  session: Session,
  historyRows: AttendanceWithChild[],
): string {
  const lines: string[] = [`Delete ${sessionDisplayName(session)}?`];
  const n = historyRows.length;
  if (n === 0) {
    lines.push("This session has no check-ins.");
  } else {
    lines.push(
      `${n} check-in(s) will be hidden from History. Kids stay on the roster.`,
    );
    if (n <= 8) {
      for (const row of historyRows) {
        lines.push(`• ${row.child.firstName} ${row.child.lastName}`);
      }
    }
    if (historyRows.some((row) => row.timeOut === null)) {
      lines.push("Kids still checked in must be checked out first.");
    }
  }
  return lines.join("\n");
}

export function HistoryModule({
  sessions,
  configError = null,
  missingEnv = [],
  dataSource = "supabase",
}: Props) {
  const router = useRouter();
  const [historySessionId, setHistorySessionId] = useState(sessions[0]?.id ?? "");
  const [deletingSession, setDeletingSession] = useState(false);
  const deleteLock = useRef(false);
  /** Tagged with the session it belongs to, so a switch never shows stale rows. */
  const [loaded, setLoaded] = useState<{
    sessionId: string;
    rows: AttendanceWithChild[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeSessionId =
    historySessionId && sessions.some((s) => s.id === historySessionId)
      ? historySessionId
      : (sessions[0]?.id ?? "");

  const historyRows = loaded?.sessionId === activeSessionId ? loaded.rows : [];
  const pending = Boolean(activeSessionId) && loaded?.sessionId !== activeSessionId;
  const selectedSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const controlsDisabled = deletingSession || pending;

  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    getSessionHistoryAction(activeSessionId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.error);
          setLoaded({ sessionId: activeSessionId, rows: [] });
          return;
        }
        setLoadError(null);
        setLoaded({ sessionId: activeSessionId, rows: result.rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load history";
        setLoadError(message);
        setLoaded({ sessionId: activeSessionId, rows: [] });
        toast.error(message);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  function exportSession() {
    const selected = sessions.find((s) => s.id === activeSessionId);
    const stamp = selected
      ? sessionDisplayName(selected).replace(/[^a-zA-Z0-9]+/g, "-")
      : activeSessionId;
    downloadCsv(
      `kids-church-session-${stamp}.csv`,
      SESSION_EXPORT_HEADERS,
      historyRows.map(sessionExportCells),
    );
  }

  async function handleDeleteSession() {
    if (deleteLock.current || !activeSessionId || !selectedSession) return;
    deleteLock.current = true;

    const confirmed = window.confirm(
      buildSessionDeleteConfirm(selectedSession, historyRows),
    );
    if (!confirmed) {
      deleteLock.current = false;
      return;
    }

    setDeletingSession(true);
    const removedId = activeSessionId;
    try {
      const result = await deleteSessionAction(removedId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const remaining = sessions.filter((s) => s.id !== removedId);
      setHistorySessionId(remaining[0]?.id ?? "");
      setLoaded(null);
      setLoadError(null);
      toast.success("Session removed from History");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove session.");
    } finally {
      deleteLock.current = false;
      setDeletingSession(false);
    }
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
        <DatabaseStatusBanner
          configError={configError}
          missingEnv={missingEnv}
          dataSource={dataSource}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="xl" asChild>
            <Link href="/">← Back to Kids Church pool</Link>
          </Button>
          {historyRows.length > 0 && (
            <Button
              size="xl"
              className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
              disabled={controlsDisabled}
              onClick={exportSession}
            >
              Extract session CSV
            </Button>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <Label className="mb-2 block">Session</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className="h-14 w-full flex-1 rounded-md border border-black/15 bg-white px-3 text-base"
              value={activeSessionId}
              disabled={controlsDisabled}
              onChange={(e) => setHistorySessionId(e.target.value)}
            >
              {sessions.length === 0 && (
                <option value="">
                  {dataSource === "error" ? "Could not load sessions" : "No sessions yet"}
                </option>
              )}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionDisplayName(s)} · {s.status}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              size="xl"
              disabled={!activeSessionId || controlsDisabled}
              className="shrink-0 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => void handleDeleteSession()}
            >
              {deletingSession ? "Deleting…" : "Delete session"}
            </Button>
          </div>
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
                    {pending
                      ? "Loading…"
                      : loadError
                        ? loadError
                        : "Select a session to view attendance."}
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
