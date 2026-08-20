"use client";

import { useEffect, useState, useTransition } from "react";
import { verifyStaffPinAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizePin } from "@/lib/staff-pin";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: () => void;
};

/**
 * Keypad the kiosk shows before opening staff settings. The kiosk page itself
 * stays public, so this is the only PIN prompt a parent can trip over.
 */
export function StaffPinDialog({ open, onOpenChange, onUnlocked }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (pin.length !== 6 || pending) return;

    startTransition(async () => {
      const result = await verifyStaffPinAction(pin);
      setPin("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError("");
      onUnlocked();
    });
    // Submitting is driven purely by the sixth digit landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Clear on close so a half-typed PIN is not waiting on the next open.
        if (!next) {
          setPin("");
          setError("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Staff PIN</DialogTitle>
          <DialogDescription>Enter the 6-digit PIN to open settings.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2.5" aria-label="PIN digits">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`size-3 rounded-full transition ${
                i < pin.length ? "bg-[#003B8E]" : "bg-black/15"
              }`}
            />
          ))}
        </div>

        <p
          className={`text-center text-sm ${error ? "text-red-600" : "text-black/40"}`}
          role={error ? "alert" : undefined}
        >
          {error || (pending ? "Checking…" : "Enter 6-digit PIN")}
        </p>

        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <Keypad key={digit} disabled={pending} onClick={() => setPin((p) => normalizePin(p + digit))}>
              {digit}
            </Keypad>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="h-14 text-sm text-black/55"
            onClick={() => {
              setPin("");
              setError("");
            }}
          >
            Clear
          </Button>
          <Keypad disabled={pending} onClick={() => setPin((p) => normalizePin(p + "0"))}>
            0
          </Keypad>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="h-14 text-sm text-black/55"
            onClick={() => setPin((p) => p.slice(0, -1))}
          >
            Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Keypad({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className="h-14 text-xl font-semibold"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
