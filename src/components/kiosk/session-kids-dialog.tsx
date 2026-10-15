"use client";

import { Printer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getReceiptAction, getSessionRosterAction } from "@/app/actions";
import { ReceiptSlip } from "@/components/kiosk/receipt-slip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AGE_POOL_LABELS, childFullName, formatTime } from "@/lib/age";
import { printReceipt } from "@/lib/printing/print-receipt";
import { usePrinterSettings } from "@/lib/printing/use-printer-settings";
import { sessionDisplayName } from "@/lib/session";
import type { AttendanceWithChild, Receipt, Session } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
};

export function SessionKidsDialog({ open, onOpenChange, session }: Props) {
  /** Bumped by Refresh and each time the dialog opens, so a previous error cannot stick. */
  const [reloadToken, setReloadToken] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  const [roster, setRoster] = useState<{
    key: string;
    rows: AttendanceWithChild[];
    error: string | null;
  } | null>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReloadToken((token) => token + 1);
  }
  const [printingId, setPrintingId] = useState<string | null>(null);
  /** Held only while the print dialog needs an element to capture. */
  const [pendingSlip, setPendingSlip] = useState<Receipt | null>(null);
  const { paperWidth } = usePrinterSettings();

  const sessionId = session?.id ?? null;
  const requestKey = open && sessionId ? `${sessionId}:${reloadToken}` : "";
  const activeRoster = roster?.key === requestKey ? roster : null;
  const rows = activeRoster?.rows ?? null;
  const loadError = activeRoster?.error ?? null;
  const loading = Boolean(requestKey) && !activeRoster;

  useEffect(() => {
    if (!requestKey || !sessionId) return;
    let cancelled = false;
    getSessionRosterAction(sessionId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setRoster({ key: requestKey, rows: [], error: result.error });
        return;
      }
      setRoster({ key: requestKey, rows: result.rows, error: null });
    }).catch((err: unknown) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : "Could not load who is checked in.";
      setRoster({ key: requestKey, rows: [], error: message });
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey, sessionId]);

  function reload() {
    setReloadToken((token) => token + 1);
  }

  async function reprint(attendanceId: string) {
    setPrintingId(attendanceId);
    try {
      const result = await getReceiptAction(attendanceId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const receipt = result.receipt;
      setPendingSlip(receipt);
      const outcome = await printReceipt(receipt, { reprint: true });
      if (outcome.via === "system") {
        toast.info("Opened the system print dialog", { description: outcome.reason });
      } else {
        toast.success(`Reprinted ${receipt.displayName}'s slip`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print");
    } finally {
      setPendingSlip(null);
      setPrintingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kids in session</DialogTitle>
          <DialogDescription>
            {session
              ? `${sessionDisplayName(session)} · ${rows?.length ?? 0} checked in`
              : "No session is open."}
          </DialogDescription>
        </DialogHeader>

        {session && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={reload}
            className="w-fit"
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        )}

        <div className="space-y-2">
          {session && loading && (
            <p className="py-6 text-center text-sm text-black/45">Loading…</p>
          )}

          {session && loadError && (
            <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-8 text-center text-sm text-amber-950">
              {loadError}
            </p>
          )}

          {session && !loadError && rows?.length === 0 && (
            <p className="rounded-xl border border-dashed border-black/15 px-4 py-8 text-center text-sm text-black/50">
              No kids are checked in yet.
            </p>
          )}

          {rows?.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {childFullName(row.child.firstName, row.child.lastName)}
                  {row.child.nickname && (
                    <span className="font-normal text-black/45"> ({row.child.nickname})</span>
                  )}
                </p>
                <p className="truncate text-xs text-black/50">
                  {AGE_POOL_LABELS[row.agePool]} · In {formatTime(row.timeIn)} ·{" "}
                  {row.child.parent.fullName}
                </p>
              </div>
              <Button
                variant="outline"
                size="lg"
                disabled={printingId !== null}
                onClick={() => void reprint(row.id)}
                className="h-11 shrink-0 px-4"
              >
                <Printer className="size-4" />
                {printingId === row.id ? "Printing…" : "Print"}
              </Button>
            </div>
          ))}
        </div>

        {/*
          The system print fallback captures whatever carries data-print-target,
          so the slip must exist in the DOM while the dialog is open. It sits
          off-screen rather than hidden, since display:none would not print.
        */}
        {pendingSlip && (
          <div
            data-print-target
            className="pointer-events-none fixed -left-[9999px] top-0"
            aria-hidden
          >
            <ReceiptSlip receipt={pendingSlip} paperWidth={paperWidth} reprint />
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
