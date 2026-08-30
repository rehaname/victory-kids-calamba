import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sessionDisplayName } from "@/lib/session";
import type { Session } from "@/lib/types";

type Props = {
  title?: string;
  subtitle?: string;
  session?: Session | null;
  openSessions?: Session[];
  pending?: boolean;
  showSessionControls?: boolean;
  onStartSession?: () => void;
  onCloseSession?: () => void;
  onSelectSession?: (sessionId: string) => void;
  showHistoryLink?: boolean;
  showRegisterLink?: boolean;
  showListLink?: boolean;
  showPoolLink?: boolean;
  showKioskLink?: boolean;
};

export function KioskHeader({
  title = "Kids Church",
  subtitle = "Check-In Pool",
  session = null,
  openSessions = [],
  pending = false,
  showSessionControls = false,
  onStartSession,
  onCloseSession,
  onSelectSession,
  showHistoryLink = true,
  showRegisterLink = true,
  showListLink = true,
  showPoolLink = false,
  showKioskLink = true,
}: Props) {
  const extraOpen = Math.max(0, openSessions.length - (session ? 1 : 0));

  return (
    <header className="border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/victory-mark.svg"
            alt="Victory Calamba"
            width={48}
            height={48}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#003B8E]">
              Victory Calamba
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-black/55">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showPoolLink && (
            <Button variant="ghost" size="xl" asChild className="text-[#003B8E]">
              <Link href="/">Kids Church</Link>
            </Button>
          )}
          {showKioskLink && (
            <Button variant="ghost" size="xl" asChild className="text-[#003B8E]">
              <Link href="/kiosk">Kiosk</Link>
            </Button>
          )}
          {showRegisterLink && (
            <Button variant="ghost" size="xl" asChild className="text-[#003B8E]">
              <Link href="/register">Register</Link>
            </Button>
          )}
          {showListLink && (
            <Button variant="ghost" size="xl" asChild className="text-[#003B8E]">
              <Link href="/list">List</Link>
            </Button>
          )}
          {showHistoryLink && (
            <Button variant="ghost" size="xl" asChild className="text-[#003B8E]">
              <Link href="/history">History</Link>
            </Button>
          )}

          {showSessionControls && (
            session ? (
              <>
                {openSessions.length > 1 && onSelectSession ? (
                  <select
                    aria-label="Live session"
                    className="h-14 max-w-[min(100%,20rem)] rounded-xl border border-black/15 bg-white px-3 text-sm font-medium"
                    value={session.id}
                    disabled={pending}
                    onChange={(e) => onSelectSession(e.target.value)}
                    title={sessionDisplayName(session)}
                  >
                    {openSessions.map((open) => (
                      <option key={open.id} value={open.id}>
                        {sessionDisplayName(open)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge
                    className="max-w-[min(100%,20rem)] truncate bg-[#003B8E] px-3 py-1.5 text-sm text-white hover:bg-[#003B8E]"
                    title={sessionDisplayName(session)}
                  >
                    {sessionDisplayName(session)}
                    {extraOpen > 0 ? ` · +${extraOpen} more` : " · open"}
                  </Badge>
                )}
                <Button size="xl" variant="outline" disabled={pending} onClick={onStartSession}>
                  Start another
                </Button>
                <Button size="xl" variant="outline" disabled={pending} onClick={onCloseSession}>
                  Close session
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                  No open session
                </Badge>
                <Button
                  size="xl"
                  className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
                  disabled={pending}
                  onClick={onStartSession}
                >
                  Start Kids Church session
                </Button>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
