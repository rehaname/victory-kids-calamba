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

  const liveServiceTimes = new Set(
    openSessions.map((s) => s.serviceTime).filter(Boolean),
  );

  async function start(serviceTime: string) {
    setBusy(true);
    try {
      const result = await startSessionAction(serviceTime);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSelect(result.session.id);
      await onChanged();
      toast.success(`${sessionDisplayName(result.session)} started`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select session</DialogTitle>
          <DialogDescription>
            Choose which live service this tablet checks kids into.
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
                      {formatSessionDate(session.sessionDate)}
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

        <div className="space-y-2 border-t border-black/10 pt-4">
          <p className="text-xs font-semibold tracking-wide text-black/45 uppercase">
            Start a service
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_TIMES.map((serviceTime) => {
              const live = liveServiceTimes.has(serviceTime);
              return (
                <Button
                  key={serviceTime}
                  variant="outline"
                  size="xl"
                  disabled={busy || live}
                  onClick={() => void start(serviceTime)}
                  className="h-14 text-base"
                >
                  <Play className="size-4" />
                  {formatServiceTime(serviceTime)}
                  {live && <span className="text-xs text-black/45">live</span>}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-black/45">
            Each service can have one open session per day. Sessions are saved
            online, so they survive a refresh and are shared across tablets.
          </p>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
