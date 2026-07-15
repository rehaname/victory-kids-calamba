"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { verifyStaffPinAction } from "@/app/actions";
import { normalizePin, STAFF_UNLOCK_KEY } from "@/lib/staff-pin";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

export function StaffPinGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(STAFF_UNLOCK_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
    setReady(true);
  }, []);

  function press(digit: string) {
    setError("");
    setPin((prev) => normalizePin(prev + digit));
  }

  function clear() {
    setPin("");
    setError("");
  }

  function submit(nextPin = pin) {
    const value = normalizePin(nextPin);
    if (value.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }

    startTransition(async () => {
      const result = await verifyStaffPinAction(value);
      if (!result.ok) {
        setError(result.error);
        setPin("");
        return;
      }
      try {
        sessionStorage.setItem(STAFF_UNLOCK_KEY, "1");
      } catch {
        // Private mode may block sessionStorage; still unlock this render.
      }
      setUnlocked(true);
      toast.success("Welcome — Kids Church unlocked");
    });
  }

  useEffect(() => {
    if (pin.length === 6 && !pending) {
      submit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_50%,_#f4f6f8_100%)]">
        <p className="text-sm text-black/45">Loading…</p>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_#dce8ff_0%,_#ffffff_42%,_#f3f6fa_100%)] px-4 py-10 text-black">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-[0_20px_60px_rgba(0,59,142,0.12)] ring-1 ring-[#003B8E]/10">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/victory-mark.svg"
            alt="Victory Calamba"
            width={64}
            height={64}
            className="mb-3"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#003B8E]">
            Victory Calamba
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            Kids Church
          </h1>
          <p className="mt-2 text-sm text-black/55">
            Staff PIN to open the kiosk
          </p>
        </div>

        <div className="mb-5 flex justify-center gap-2.5" aria-label="PIN digits">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={`flex size-3 items-center justify-center rounded-full transition ${
                i < pin.length ? "bg-[#003B8E]" : "bg-black/15"
              }`}
            />
          ))}
        </div>

        {error ? (
          <p className="mb-4 text-center text-sm text-red-600">{error}</p>
        ) : (
          <p className="mb-4 text-center text-sm text-black/40">
            {pending ? "Checking…" : "Enter 6-digit PIN"}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button
              key={d}
              type="button"
              variant="outline"
              disabled={pending}
              className="h-14 text-xl font-semibold"
              onClick={() => press(d)}
            >
              {d}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="h-14 text-sm text-black/55"
            onClick={clear}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-14 text-xl font-semibold"
            onClick={() => press("0")}
          >
            0
          </Button>
          <Button
            type="button"
            disabled={pending || pin.length !== 6}
            className="h-14 bg-[#003B8E] text-sm text-white hover:bg-[#002c6b]"
            onClick={() => submit()}
          >
            Unlock
          </Button>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-black/40">
          Refresh keeps you unlocked. Closing the tab asks for the PIN again.
          <br />
          Kids Church sessions stay open until staff closes them.
        </p>
      </div>
    </div>
  );
}
