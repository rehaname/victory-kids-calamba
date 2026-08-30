"use client";

import { Check, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startSessionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSessionDate, formatServiceTime, sessionDisplayName } from "@/lib/session";
import { SERVICE_TIMES, type Session } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openSessions: Session[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  /** Refetches kiosk state after a session is started. */
  onChanged: () => Promise<void> | void;
};

export function SessionSelectDialog({
  open,
  onOpenChange,
  openSessions,
  activeSessionId,
  onSelect,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setLocation("");
    onOpenChange(next);
  }

  const trimmed = location.trim();

  async function start(serviceTime: string) {
    if (!trimmed) {
      toast.error("Enter a location (e.g. Halang or Bayan).");
      return;
    }
    setBusy(true);
    try {
      const result = await startSessionAction(serviceTime, trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSelect(result.session.id);
      setLocation("");
      await onChanged();
      toast.success(`${sessionDisplayName(result.session)} started`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select session</DialogTitle>
          <DialogDescription>
            Join a live session on this tablet, or start a new one with a location
            and service hour.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-black/45 uppercase">
            Live now
          </p>
          {openSessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/50">
              No session is open yet. Start one below.
            </p>
          ) : (
            openSessions.map((session) => {
              const selected = session.id === activeSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onSelect(session.id);
                    onOpenChange(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                    selected
                      ? "border-[#003B8E] bg-[#003B8E]/5"
                      : "border-black/10 bg-white hover:bg-black/[0.02]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {sessionDisplayName(session)}
                    </span>
                    <span className="block truncate text-xs text-black/50">
                      {session.location
                        ? `${session.location} · ${formatSessionDate(session.sessionDate)}`
                        : formatSessionDate(session.sessionDate)}
                    </span>
                  </span>
                  {selected && (
                    <Check className="size-5 shrink-0 text-[#003B8E]" strokeWidth={3} />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-3 border-t border-black/10 pt-4">
          <p className="text-xs font-semibold tracking-wide text-black/45 uppercase">
            Start a new session
          </p>
          <div className="space-y-2">
            <Label htmlFor="kiosk-session-location">Location</Label>
            <Input
              id="kiosk-session-location"
              className="h-12 text-base"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Halang or Bayan"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_TIMES.map((serviceTime) => (
              <Button
                key={serviceTime}
                variant="outline"
                size="xl"
                disabled={busy || !trimmed}
                onClick={() => void start(serviceTime)}
                className="h-14 text-base"
              >
                <Play className="size-4" />
                {formatServiceTime(serviceTime)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-black/45">
            Every Start creates a new session. Multiple locations (or tablets at
            the same site) can run the same service hour. Sessions are saved
            online and survive a refresh.
          </p>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
