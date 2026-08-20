"use client";

import { Check, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { ReceiptSlip } from "@/components/kiosk/receipt-slip";
import { Button } from "@/components/ui/button";
import { printReceipt } from "@/lib/printing/print-receipt";
import { usePrinterSettings } from "@/lib/printing/use-printer-settings";
import type { Receipt } from "@/lib/types";

type Props = {
  receipts: Receipt[];
  onDone: () => void;
};

export function KioskReceiptStep({ receipts, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState<string[]>([]);
  const { paperWidth } = usePrinterSettings();

  const receipt = receipts[Math.min(index, receipts.length - 1)];
  const many = receipts.length > 1;

  async function send(target: Receipt) {
    const outcome = await printReceipt(target);
    setPrinted((prev) => (prev.includes(target.attendanceId) ? prev : [...prev, target.attendanceId]));
    if (outcome.via === "system") {
      toast.info("Opened the system print dialog", {
        description: outcome.reason,
      });
    } else {
      toast.success(`Printed ${target.displayName}'s slip`);
    }
  }

  async function printCurrent() {
    if (!receipt) return;
    setPrinting(true);
    try {
      await send(receipt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print");
    } finally {
      setPrinting(false);
    }
  }

  async function printAll() {
    setPrinting(true);
    try {
      for (let i = 0; i < receipts.length; i += 1) {
        // The system-print fallback captures the on-screen slip, so the DOM
        // must actually show receipts[i] before we call print().
        flushSync(() => setIndex(i));
        await send(receipts[i]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print");
    } finally {
      setPrinting(false);
    }
  }

  if (!receipt) return null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-800">
          <Check className="size-4" strokeWidth={3} />
          Successful check in
        </span>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          {many ? `${receipts.length} kids checked in` : `${receipt.displayName} is checked in`}
        </h2>
        <p className="mt-1 text-base text-black/60">
          Print the slip and keep it for pickup.
        </p>
      </div>

      <div className="flex justify-center">
        {/* The active slip is what the system print dialog captures. */}
        <div data-print-target>
          <ReceiptSlip
            receipt={receipt}
            paperWidth={paperWidth}
            className="rounded-lg shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
          />
        </div>
      </div>

      {many && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Previous slip"
            disabled={index === 0 || printing}
            onClick={() => setIndex((i) => i - 1)}
          >
            <ChevronLeft />
          </Button>
          <p className="text-sm font-medium text-black/60">
            Slip {index + 1} of {receipts.length}
            {printed.includes(receipt.attendanceId) && " · printed"}
          </p>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Next slip"
            disabled={index === receipts.length - 1 || printing}
            onClick={() => setIndex((i) => i + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}

      <div className="mt-auto grid gap-3 pt-2 sm:grid-cols-2">
        <Button
          size="xl"
          variant="outline"
          disabled={printing}
          onClick={onDone}
          className="h-16 rounded-2xl border-2 text-lg font-semibold"
        >
          Done
        </Button>
        <Button
          size="xl"
          disabled={printing}
          onClick={() => (many ? printAll() : printCurrent())}
          className="h-16 rounded-2xl bg-[#003B8E] text-lg font-semibold text-white hover:bg-[#002c6b]"
        >
          <Printer className="size-5" />
          {printing ? "Printing…" : many ? "Print all slips" : "Print receipt"}
        </Button>
      </div>
    </div>
  );
}
