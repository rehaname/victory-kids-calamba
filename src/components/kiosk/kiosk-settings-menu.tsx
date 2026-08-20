"use client";

import { CalendarClock, Printer, Settings, Users } from "lucide-react";
import { useState } from "react";
import { PrinterSetupDialog } from "@/components/kiosk/printer-setup-dialog";
import { SessionKidsDialog } from "@/components/kiosk/session-kids-dialog";
import { SessionSelectDialog } from "@/components/kiosk/session-select-dialog";
import { StaffPinDialog } from "@/components/kiosk/staff-pin-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAFF_UNLOCK_KEY } from "@/lib/staff-pin";
import type { Session } from "@/lib/types";

type Panel = "printer" | "kids" | "session";

type Props = {
  openSessions: Session[];
  activeSession: Session | null;
  onSelectSession: (sessionId: string) => void;
  onSessionsChanged: () => Promise<void> | void;
};

export function KioskSettingsMenu({
  openSessions,
  activeSession,
  onSelectSession,
  onSessionsChanged,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);

  function openMenu() {
    if (isUnlocked()) {
      setMenuOpen(true);
      return;
    }
    setPinOpen(true);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Settings"
            className="size-11 shrink-0 rounded-xl text-[#003B8E]"
            onPointerDown={(event) => {
              // The PIN gate must run before the menu opens, so the trigger's
              // own toggle is suppressed until this device is unlocked.
              if (!isUnlocked()) {
                event.preventDefault();
                openMenu();
              }
            }}
          >
            <Settings className="size-6" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-[16rem]">
          <DropdownMenuLabel>Staff settings</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setPanel("printer")}>
            <Printer />
            Setup Bluetooth printer
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPanel("kids")}>
            <Users />
            Show session kids
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPanel("session")}>
            <CalendarClock />
            Select session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StaffPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onUnlocked={() => {
          markUnlocked();
          setPinOpen(false);
          setMenuOpen(true);
        }}
      />

      <PrinterSetupDialog
        open={panel === "printer"}
        onOpenChange={(open) => setPanel(open ? "printer" : null)}
      />

      <SessionKidsDialog
        open={panel === "kids"}
        onOpenChange={(open) => setPanel(open ? "kids" : null)}
        session={activeSession}
      />

      <SessionSelectDialog
        open={panel === "session"}
        onOpenChange={(open) => setPanel(open ? "session" : null)}
        openSessions={openSessions}
        activeSessionId={activeSession?.id ?? null}
        onSelect={onSelectSession}
        onChanged={onSessionsChanged}
      />
    </>
  );
}

/** Shared with the staff pages, so unlocking once covers the whole tab. */
function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STAFF_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function markUnlocked(): void {
  try {
    window.sessionStorage.setItem(STAFF_UNLOCK_KEY, "1");
  } catch {
    // Private mode: the menu still opens for this interaction.
  }
}
