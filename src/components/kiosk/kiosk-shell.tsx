"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Long enough for the iOS keyboard slide-up to settle. */
const KEYBOARD_SETTLE_MS = 300;

type Props = {
  /** Rendered at the top right, beside the branding. */
  actions?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
};

/**
 * Full-height kiosk frame. The header stays put while the step scrolls, so the
 * submit button never ends up behind a tablet's on-screen keyboard.
 */
export function KioskShell({ actions, banner, children }: Props) {
  const scrollRef = useRef<HTMLElement | null>(null);
  useKeepFocusVisible(scrollRef);

  return (
    <div
      data-print-hidden
      className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black"
    >
      <header className="shrink-0 border-b border-black/10 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/victory-mark.svg"
              alt="Victory Calamba"
              width={44}
              height={44}
              className="size-9 shrink-0 sm:size-11"
            />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold tracking-[0.2em] text-[#003B8E] uppercase sm:text-xs">
                Victory Calamba
              </p>
              <h1 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:text-2xl">
                Kids Church
              </h1>
            </div>
          </div>
          {actions}
        </div>
      </header>

      {banner}

      <main
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-5 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * A tablet keyboard covers the lower half of the screen without resizing the
 * layout, so a field near the bottom of a form ends up hidden behind it. This
 * scrolls whatever the parent just tapped into back into view.
 */
function useKeepFocusVisible(scrollRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let timer = 0;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches("input, select, textarea")) return;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, KEYBOARD_SETTLE_MS);
    };

    container.addEventListener("focusin", onFocusIn);
    return () => {
      window.clearTimeout(timer);
      container.removeEventListener("focusin", onFocusIn);
    };
  }, [scrollRef]);
}

export function KioskBanner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "shrink-0 px-4 py-2 text-center text-sm font-medium sm:px-6",
        tone === "warning"
          ? "bg-amber-100 text-amber-900"
          : "bg-[#003B8E]/10 text-[#003B8E]",
      )}
    >
      {children}
    </div>
  );
}
