"use client";

import { ChevronLeft } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  getSessionRosterAction,
  kioskCheckInAction,
  kioskRegisterAction,
  kioskStateAction,
  type KioskState,
} from "@/app/actions";
import { KioskCheckInPrompt } from "@/components/kiosk/kiosk-checkin-prompt";
import { KioskCheckInSearch } from "@/components/kiosk/kiosk-checkin-search";
import { KioskHome } from "@/components/kiosk/kiosk-home";
import { KioskReceiptStep } from "@/components/kiosk/kiosk-receipt-step";
import { KioskSettingsMenu } from "@/components/kiosk/kiosk-settings-menu";
import { KioskBanner, KioskShell } from "@/components/kiosk/kiosk-shell";
import {
  DEFAULT_HOME_SERVICE,
  emptyChild,
  RegisterFamilyForm,
  type ChildDraft,
} from "@/components/register-family-form";
import { Button } from "@/components/ui/button";
import {
  getServerSelectedSessionId,
  readSelectedSessionId,
  subscribeSelectedSessionId,
  writeSelectedSessionId,
} from "@/lib/kiosk-session";
import { sessionDisplayName } from "@/lib/session";
import type { Receipt } from "@/lib/types";

/** Steps that show a result and should time out back to the welcome screen. */
const IDLE_TIMEOUT_MS = 60_000;

type Step = "home" | "register" | "prompt" | "search" | "receipt";

type RegisteredChild = { id: string; firstName: string; nickname: string };

export function KioskApp({ initialState }: { initialState: KioskState }) {
  const [state, setState] = useState<KioskState>(initialState);
  const [step, setStep] = useState<Step>("home");
  const [pending, startTransition] = useTransition();

  const [parentName, setParentName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [kids, setKids] = useState<ChildDraft[]>([emptyChild()]);
  const [registered, setRegistered] = useState<RegisteredChild[]>([]);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [checkingInChildId, setCheckingInChildId] = useState<string | null>(null);
  /** Tagged with the session it came from so a session switch discards it. */
  const [roster, setRoster] = useState<{ sessionId: string; childIds: string[] } | null>(
    null,
  );

  // The server cannot read this device's localStorage, so the preferred session
  // is resolved on the client against the open sessions the server did send.
  const selectedSessionId = useSyncExternalStore(
    subscribeSelectedSessionId,
    readSelectedSessionId,
    getServerSelectedSessionId,
  );
  const activeSession =
    state.openSessions.find((s) => s.id === selectedSessionId) ?? state.activeSession;

  const activeSessionId = activeSession?.id ?? null;
  const checkedInChildIds =
    roster && roster.sessionId === activeSessionId ? roster.childIds : [];

  const refresh = useCallback(async () => {
    setState(await kioskStateAction(readSelectedSessionId()));
  }, []);

  // Who is already in, so the search screen can grey out duplicate check-ins.
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    getSessionRosterAction(activeSessionId).then((rows) => {
      if (cancelled) return;
      setRoster({ sessionId: activeSessionId, childIds: rows.map((r) => r.childId) });
    });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, step]);

  const resetToHome = useCallback(() => {
    setStep("home");
    setParentName("");
    setAddress("");
    setContact("");
    setKids([emptyChild()]);
    setRegistered([]);
    setReceipts([]);
    setCheckingInChildId(null);
  }, []);

  useIdleReset(step !== "home", resetToHome);

  function requireSession(): boolean {
    if (activeSession) return true;
    toast.error("No session is open", {
      description: "Ask a volunteer to start the Kids Church session.",
    });
    return false;
  }

  function submitRegistration() {
    startTransition(async () => {
      const result = await kioskRegisterAction({
        parent: { fullName: parentName, address, contactNumber: contact },
        children: kids.map((kid) => ({
          ...kid,
          homeService: kid.homeService || DEFAULT_HOME_SERVICE,
        })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRegistered(result.children);
      setStep("prompt");
    });
  }

  function checkInRegistered() {
    if (!requireSession()) return;
    const sessionId = activeSession!.id;

    startTransition(async () => {
      const slips: Receipt[] = [];
      for (const child of registered) {
        const result = await kioskCheckInAction(sessionId, child.id);
        if (result.ok) {
          slips.push(result.receipt);
        } else {
          toast.error(`${child.firstName}: ${result.error}`);
        }
      }
      if (!slips.length) return;
      setReceipts(slips);
      setStep("receipt");
    });
  }

  function checkInExisting(childId: string, firstName: string) {
    if (!requireSession()) return;
    const sessionId = activeSession!.id;
    setCheckingInChildId(childId);

    startTransition(async () => {
      try {
        const result = await kioskCheckInAction(sessionId, childId);
        if (!result.ok) {
          toast.error(`${firstName}: ${result.error}`);
          return;
        }
        setReceipts([result.receipt]);
        setStep("receipt");
      } finally {
        setCheckingInChildId(null);
      }
    });
  }

  return (
    <KioskShell
      banner={
        state.configError ? (
          <KioskBanner tone="warning">{state.configError}</KioskBanner>
        ) : !activeSession ? (
          <KioskBanner tone="warning">
            No session is open. Staff can start one from Settings.
          </KioskBanner>
        ) : (
          <KioskBanner>{sessionDisplayName(activeSession)} · now open</KioskBanner>
        )
      }
      actions={
        <div className="flex shrink-0 items-center gap-1">
          {step !== "home" && step !== "receipt" && (
            <Button
              variant="ghost"
              size="xl"
              onClick={resetToHome}
              className="h-11 px-3 text-[#003B8E]"
            >
              <ChevronLeft className="size-5" />
              Back
            </Button>
          )}
          <KioskSettingsMenu
            openSessions={state.openSessions}
            activeSession={activeSession}
            onSelectSession={(sessionId) => {
              writeSelectedSessionId(sessionId);
              void refresh();
            }}
            onSessionsChanged={refresh}
          />
        </div>
      }
    >
      {step === "home" && (
        <KioskHome
          session={activeSession}
          onRegister={() => setStep("register")}
          onCheckIn={() => setStep("search")}
        />
      )}

      {step === "register" && (
        <RegisterFamilyForm
          parentName={parentName}
          address={address}
          contact={contact}
          kids={kids}
          checkInNow={false}
          pending={pending}
          submitLabel={pending ? "Saving…" : "Save registration"}
          description="First visit only. Ages 4–12. We will ask about check-in next."
          showCheckInOption={false}
          onParentNameChange={setParentName}
          onAddressChange={setAddress}
          onContactChange={setContact}
          onKidsChange={setKids}
          onCheckInNowChange={() => {}}
          onCancel={resetToHome}
          onSubmit={submitRegistration}
        />
      )}

      {step === "prompt" && (
        <KioskCheckInPrompt
          names={registered.map((child) => child.nickname || child.firstName)}
          pending={pending}
          onYes={checkInRegistered}
          onNo={resetToHome}
        />
      )}

      {step === "search" && (
        <KioskCheckInSearch
          checkedInChildIds={checkedInChildIds}
          pendingChildId={checkingInChildId}
          onSelect={(child) => checkInExisting(child.id, child.firstName)}
          onRegisterInstead={() => setStep("register")}
        />
      )}

      {step === "receipt" && (
        <KioskReceiptStep receipts={receipts} onDone={resetToHome} />
      )}
    </KioskShell>
  );
}

/**
 * Sends the kiosk back to the welcome screen after a period of no touches, so
 * one family's receipt is not left on screen for the next family.
 * `onIdle` must be stable, otherwise the timer restarts on every render.
 */
function useIdleReset(enabled: boolean, onIdle: () => void) {
  useEffect(() => {
    if (!enabled) return;

    let timer = window.setTimeout(onIdle, IDLE_TIMEOUT_MS);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, IDLE_TIMEOUT_MS);
    };

    const events = ["pointerdown", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, restart));

    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, restart));
    };
  }, [enabled, onIdle]);
}
