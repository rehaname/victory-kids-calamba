"use client";

import { ClipboardCheck, UserPlus } from "lucide-react";
import { sessionDisplayName } from "@/lib/session";
import type { Session } from "@/lib/types";

type Props = {
  session: Session | null;
  onRegister: () => void;
  onCheckIn: () => void;
};

export function KioskHome({ session, onRegister, onCheckIn }: Props) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-4">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome to Kids Church
        </h2>
        <p className="mt-2 text-base text-black/60 sm:text-lg">
          {session
            ? `${sessionDisplayName(session)} is open. Tap a button to begin.`
            : "Ages 4 to 12. Tap a button to begin."}
        </p>
      </div>

      <div className="grid gap-4 landscape:grid-cols-2 sm:gap-6">
        <KioskChoice
          icon={<UserPlus className="size-9" strokeWidth={2.2} />}
          label="Register Kid"
          hint="First time here"
          onClick={onRegister}
          className="border-2 border-[#003B8E] bg-white text-[#003B8E] active:bg-[#003B8E]/5"
        />
        <KioskChoice
          icon={<ClipboardCheck className="size-9" strokeWidth={2.2} />}
          label="Check In Kid"
          hint="Already registered"
          onClick={onCheckIn}
          className="border-2 border-[#003B8E] bg-[#003B8E] text-white active:bg-[#002c6b]"
        />
      </div>
    </div>
  );
}

function KioskChoice({
  icon,
  label,
  hint,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl px-6 py-8 shadow-sm transition-transform outline-none select-none focus-visible:ring-4 focus-visible:ring-[#003B8E]/40 active:scale-[0.98] sm:min-h-56 ${className}`}
    >
      {icon}
      <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
        {label}
      </span>
      <span className="text-sm opacity-75">{hint}</span>
    </button>
  );
}
