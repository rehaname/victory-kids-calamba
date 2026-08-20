"use client";

import { Button } from "@/components/ui/button";

type Props = {
  /** Display names of the children just registered. */
  names: string[];
  pending?: boolean;
  onYes: () => void;
  onNo: () => void;
};

export function KioskCheckInPrompt({ names, pending, onYes, onNo }: Props) {
  const plural = names.length > 1;
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-4 text-center">
      <div>
        <p className="text-sm font-semibold tracking-[0.18em] text-[#003B8E] uppercase">
          Registration saved
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Check in {plural ? "your children" : "your child"}?
        </h2>
        <p className="mt-3 text-lg font-medium text-black/70">
          {names.join(", ")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Button
          size="xl"
          variant="outline"
          disabled={pending}
          onClick={onNo}
          className="h-24 rounded-2xl border-2 border-black/15 text-xl font-semibold"
        >
          No, not now
        </Button>
        <Button
          size="xl"
          disabled={pending}
          onClick={onYes}
          className="h-24 rounded-2xl bg-[#003B8E] text-xl font-semibold text-white hover:bg-[#002c6b]"
        >
          {pending ? "Checking in…" : "Yes, check in"}
        </Button>
      </div>
    </div>
  );
}
