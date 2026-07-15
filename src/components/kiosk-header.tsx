import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSessionLabel } from "@/lib/age";
import type { Session } from "@/lib/types";

type Props = {
  title?: string;
  subtitle?: string;
  session?: Session | null;
  showSessionControls?: boolean;
  pending?: boolean;
  onStartSession?: () => void;
  onCloseSession?: () => void;
  showHistoryLink?: boolean;
  showRegisterLink?: boolean;
  showPoolLink?: boolean;
};

export function KioskHeader({
  title = "Kids Church",
  subtitle = "Check-In Pool",
  session = null,
  showSessionControls = false,
  pending = false,
  onStartSession,
  onCloseSession,
  showHistoryLink = true,
  showRegisterLink = true,
  showPoolLink = false,
}: Props) {
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
          {showRegisterLink && (
            <Button variant="ghost" size="xl" asChild className="text-[#003B8E]">
              <Link href="/register">Register</Link>
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
                <Badge className="bg-[#003B8E] px-3 py-1.5 text-sm text-white hover:bg-[#003B8E]">
                  Session open · {formatSessionLabel(session.startedAt)}
                </Badge>
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
