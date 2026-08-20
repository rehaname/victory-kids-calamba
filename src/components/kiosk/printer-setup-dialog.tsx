"use client";

import { Bluetooth, BluetoothConnected, CircleAlert, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  disconnectPrinter,
  isAppleMobileBrowser,
  isBluetoothSupported,
  isPrinterConnected,
  reconnectPrinter,
  requestPrinter,
} from "@/lib/printing/bluetooth";
import { PAPER_WIDTHS } from "@/lib/printing/paper";
import { printTestSlip } from "@/lib/printing/print-receipt";
import {
  clearPairedPrinter,
  writePrinterSettings,
  type PrinterSettings,
} from "@/lib/printing/printer-settings";
import { usePrinterSettings } from "@/lib/printing/use-printer-settings";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Status = "idle" | "scanning" | "connected" | "saved-offline";

export function PrinterSetupDialog({ open, onOpenChange }: Props) {
  const settings = usePrinterSettings();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  // Rendered on the server too, where neither API exists; both read false
  // there, and the notice only matters once the dialog is actually on screen.
  const supported = isBluetoothSupported();
  const apple = isAppleMobileBrowser();

  const deviceId = settings.deviceId;

  // Reopening the dialog re-checks the link, which may have dropped since the
  // last time staff looked at it.
  useEffect(() => {
    if (!open || !deviceId) return;
    if (isPrinterConnected(deviceId)) return;
    let cancelled = false;
    // Silent reconnect only succeeds while the browser still holds permission.
    reconnectPrinter(deviceId).then((printer) => {
      if (!cancelled) setStatus(printer ? "connected" : "saved-offline");
    });
    return () => {
      cancelled = true;
    };
  }, [open, deviceId]);

  const resolvedStatus: Status =
    status ??
    (!deviceId ? "idle" : isPrinterConnected(deviceId) ? "connected" : "saved-offline");

  function persist(next: PrinterSettings) {
    writePrinterSettings(next);
  }

  async function pair() {
    setStatus("scanning");
    setBusy(true);
    try {
      const printer = await requestPrinter();
      persist({ ...settings, deviceId: printer.id, deviceName: printer.name });
      setStatus("connected");
      toast.success(`Connected to ${printer.name}`);
    } catch (err) {
      setStatus(deviceId ? "saved-offline" : "idle");
      // The chooser throwing NotFoundError just means the staffer cancelled.
      if (err instanceof DOMException && err.name === "NotFoundError") return;
      toast.error(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await printTestSlip();
      toast.success("Test slip sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test print failed");
    } finally {
      setBusy(false);
    }
  }

  function forget() {
    disconnectPrinter();
    clearPairedPrinter();
    setStatus("idle");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bluetooth printer</DialogTitle>
          <DialogDescription>
            Pair the receipt printer this tablet should print check-in slips to.
          </DialogDescription>
        </DialogHeader>

        {!supported ? (
          <UnsupportedNotice apple={apple} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3">
              {resolvedStatus === "connected" ? (
                <BluetoothConnected className="size-5 shrink-0 text-green-600" />
              ) : (
                <Bluetooth className="size-5 shrink-0 text-black/40" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {settings.deviceName ?? "No printer paired"}
                </p>
                <p className="text-xs text-black/50">{statusLabel(resolvedStatus)}</p>
              </div>
            </div>

            <Button
              size="xl"
              disabled={busy}
              onClick={pair}
              className="h-14 w-full bg-[#003B8E] text-base font-semibold text-white hover:bg-[#002c6b]"
            >
              <Bluetooth className="size-5" />
              {deviceId ? "Pair a different printer" : "Detect printers"}
            </Button>

            <div className="space-y-2">
              <Label className="text-sm">Paper width</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAPER_WIDTHS.map((width) => (
                  <Button
                    key={width}
                    type="button"
                    variant={settings.paperWidth === width ? "default" : "outline"}
                    size="xl"
                    onClick={() => persist({ ...settings, paperWidth: width })}
                    className={
                      settings.paperWidth === width
                        ? "h-14 bg-[#003B8E] text-base text-white hover:bg-[#002c6b]"
                        : "h-14 text-base"
                    }
                  >
                    {width} mm
                  </Button>
                ))}
              </div>
              <p className="text-xs text-black/45">
                58 mm is the common handheld size; 80 mm is a desktop till roll.
              </p>
            </div>

            {deviceId && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  size="xl"
                  disabled={busy}
                  onClick={test}
                  className="h-12 text-sm"
                >
                  <Printer className="size-4" />
                  Test print
                </Button>
                <Button
                  variant="outline"
                  size="xl"
                  disabled={busy}
                  onClick={forget}
                  className="h-12 text-sm"
                >
                  Forget printer
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function UnsupportedNotice({ apple }: { apple: boolean }) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="flex items-start gap-2 font-semibold">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        This browser cannot reach Bluetooth printers
      </p>
      {apple ? (
        <p>
          Safari on iPad and iPhone does not support Web Bluetooth, so the kiosk
          cannot talk to a thermal printer directly.
        </p>
      ) : (
        <p>
          Web Bluetooth is only available in Chromium browsers such as Chrome and
          Edge.
        </p>
      )}
      <div>
        <p className="font-semibold">Your options:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Run the kiosk on an Android tablet in Chrome.</li>
          <li>
            {apple
              ? "Open the kiosk in a Web Bluetooth browser such as Bluefy on this iPad."
              : "Switch to Chrome or Edge."}
          </li>
          <li>
            Keep using Print — it opens the system print dialog, which works with
            any printer this device can already reach.
          </li>
        </ul>
      </div>
    </div>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case "connected":
      return "Connected and ready";
    case "scanning":
      return "Looking for printers…";
    case "saved-offline":
      return "Saved, but not connected right now";
    default:
      return "Tap Detect printers to pair one";
  }
}
