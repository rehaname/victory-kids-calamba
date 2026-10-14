"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import {
  checkOutAction,
  closeSessionAction,
  getSessionRosterAction,
  startSessionAction,
  type SessionRosterResult,
} from "@/app/actions";
import {
  AGE_POOL_LABELS,
  childFullName,
  formatBirthday,
  formatTime,
  getAge,
  getAgePool,
  sortByAgeThenName,
} from "@/lib/age";
import {
  getServerSelectedSessionId,
  readSelectedSessionId,
  subscribeSelectedSessionId,
  writeSelectedSessionId,
} from "@/lib/kiosk-session";
import { sessionDisplayName, staleSessionWarning } from "@/lib/session";
import { useSubmitLock } from "@/lib/use-submit-lock";
import type { AgePool, AttendanceWithChild, Session } from "@/lib/types";
import { CheckInModal } from "@/components/check-in-modal";
import { DatabaseStatusBanner } from "@/components/database-status-banner";
import { KioskHeader } from "@/components/kiosk-header";
import { StartSessionDialog } from "@/components/start-session-dialog";
import { DEFAULT_HOME_SERVICE } from "@/components/register-family-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  session: Session | null;
  openSessions: Session[];
  active: AttendanceWithChild[];
  configError?: string | null;
  dataSource?: "supabase" | "memory" | "error";
  missingEnv?: string[];
};

export function KidsChurchPool({
  session: initialSession,
  openSessions: initialOpenSessions,
  active: initialActive,
  configError = null,
  dataSource = "supabase",
  missingEnv = [],
}: Props) {
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"start" | "close" | "checkout" | null>(null);
  const lockSubmit = useSubmitLock();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const pickedId = useSyncExternalStore(
    subscribeSelectedSessionId,
    readSelectedSessionId,
    getServerSelectedSessionId,
  );
  const [rowsBySession, setRowsBySession] = useState<Record<string, AttendanceWithChild[]>>(
    () => (initialSession ? { [initialSession.id]: initialActive } : {}),
  );
  const [selectedChild, setSelectedChild] = useState<AttendanceWithChild | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<AttendanceWithChild | null>(null);
  const [claimantName, setClaimantName] = useState("");
  /** Failed roster read for one session. A failure does not replace loaded rows. */
  const [rosterNotice, setRosterNotice] = useState<{
    sessionId: string;
    error: string;
  } | null>(null);

  const selected =
    initialOpenSessions.find((s) => s.id === pickedId) ??
    initialOpenSessions.find((s) => s.id === initialSession?.id) ??
    initialOpenSessions[0] ??
    null;

  const selectedId = selected?.id ?? null;

  function applyRoster(sessionId: string, result: SessionRosterResult) {
    if (!result.ok) {
      setRosterNotice({ sessionId, error: result.error });
      return;
    }
    setRosterNotice((current) => (current?.sessionId === sessionId ? null : current));
    setRowsBySession((prev) => ({ ...prev, [sessionId]: result.rows }));
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getSessionRosterAction(selectedId)
      .then((result) => {
        if (!cancelled) applyRoster(selectedId, result);
      })
      .catch(() => {
        if (cancelled) return;
        setRosterNotice({
          sessionId: selectedId,
          error: "Could not load who is checked in.",
        });
      });
    return () => {
      cancelled = true;
    };
    // applyRoster is recreated each render and only writes state for this id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const active = useMemo(() => {
    if (selectedId == null) return [];
    return (
      rowsBySession[selectedId] ??
      (selectedId === initialSession?.id ? initialActive : [])
    );
  }, [selectedId, rowsBySession, initialSession?.id, initialActive]);

  const rosterError = rosterNotice?.sessionId === selectedId ? rosterNotice.error : null;
  const rosterKnown =
    selectedId != null && Object.prototype.hasOwnProperty.call(rowsBySession, selectedId);

  const pools = useMemo(() => {
    const grouped: Record<AgePool, AttendanceWithChild[]> = {
      "4-6": [],
      "7-9": [],
      "10-12": [],
    };
    for (const row of active) {
      const pool = getAgePool(row.child.birthday);
      if (pool) grouped[pool].push(row);
    }
    for (const pool of Object.keys(grouped) as AgePool[]) {
      grouped[pool] = sortByAgeThenName(grouped[pool]);
    }
    return grouped;
  }, [active]);

  function run(
    action: () => Promise<void>,
    success?: string,
    kind?: "start" | "close" | "checkout",
  ) {
    const release = lockSubmit();
    if (!release) return;
    if (kind) setBusyAction(kind);
    startTransition(async () => {
      try {
        await action();
        if (success) toast.success(success);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusyAction(null);
        release();
      }
    });
  }

  function beginCheckout(row: AttendanceWithChild) {
    setSelectedChild(null);
    setCheckoutTarget(row);
    setClaimantName("");
  }

  function startSession(serviceTime: string, location: string) {
    run(async () => {
      const result = await startSessionAction(serviceTime, location);
      if (!result.ok) throw new Error(result.error);
      writeSelectedSessionId(result.session.id);
      setStartOpen(false);
      setCheckInOpen(true);
      toast.success(`${sessionDisplayName(result.session)} started`);
    }, undefined, "start");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black">
      <KioskHeader
        title="Kids Church"
        subtitle="Check-in pool · ages 4–12"
        session={selected}
        openSessions={initialOpenSessions}
        showSessionControls
        pending={pending}
        pendingAction={busyAction === "checkout" ? null : busyAction}
        onSelectSession={writeSelectedSessionId}
        onStartSession={() => setStartOpen(true)}
        onCloseSession={() =>
          selected &&
          run(async () => {
            const result = await closeSessionAction(selected.id);
            if (!result.ok) throw new Error(result.error);
            if (pickedId === selected.id) writeSelectedSessionId(null);
          }, "Session closed", "close")
        }
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <DatabaseStatusBanner
          configError={configError}
          missingEnv={missingEnv}
          dataSource={dataSource}
        />
        {selected ? (
          <>
            {staleSessionWarning(selected, active.length) && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                {staleSessionWarning(selected, active.length)}
              </div>
            )}

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                    Kids Church is open
                  </h2>
                  <p className="text-sm text-black/55">
                    {selected
                      ? `${sessionDisplayName(selected)} · parents can check in an existing child or register a new one.`
                      : "Parents can check in an existing child or register a new one."}
                  </p>
                </div>
                <Button
                  size="xl"
                  className="w-full bg-[#003B8E] text-white hover:bg-[#002c6b] sm:w-auto"
                  onClick={() => setCheckInOpen(true)}
                >
                  Check in a child
                </Button>
              </div>
            </section>

            {rosterError && rosterKnown ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                {rosterError} The list already on screen was kept.
              </div>
            ) : null}

            {active.length === 0 && rosterError && !rosterKnown ? (
              <EmptyState title={rosterError} />
            ) : active.length === 0 && !rosterKnown ? (
              <EmptyState title="Loading…" />
            ) : active.length === 0 ? (
              <EmptyState title="No kids in the pool yet — tap Check in a child to start" />
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {(["4-6", "7-9", "10-12"] as AgePool[]).map((pool) => (
                  <PoolColumn
                    key={pool}
                    title={AGE_POOL_LABELS[pool]}
                    rows={pools[pool]}
                    onSelect={setSelectedChild}
                  />
                ))}
              </div>
            )}
          </>
        ) : dataSource === "error" ? (
          <EmptyState title="Kids Church could not be loaded. Wait a minute and refresh." />
        ) : (
          <EmptyState title="Start a Kids Church session to open check-in" />
        )}
      </main>

      <CheckInModal
        open={checkInOpen && Boolean(selected)}
        onOpenChange={setCheckInOpen}
        sessionId={selected?.id ?? ""}
        active={active}
        onRegistered={() => {
          if (selectedId) {
            getSessionRosterAction(selectedId)
              .then((result) => applyRoster(selectedId, result))
              .catch(() => {
                setRosterNotice({
                  sessionId: selectedId,
                  error: "Could not load who is checked in.",
                });
              });
          }
        }}
      />

      <StartSessionDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        pending={busyAction === "start"}
        onStart={startSession}
      />

      <Dialog open={Boolean(selectedChild)} onOpenChange={(open) => !open && setSelectedChild(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedChild && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {childFullName(selectedChild.child.firstName, selectedChild.child.lastName)}
                </DialogTitle>
                <DialogDescription>
                  {AGE_POOL_LABELS[selectedChild.agePool]} · age{" "}
                  {getAge(selectedChild.child.birthday)}
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-3 text-sm">
                {selectedChild.child.nickname ? (
                  <DetailRow label="Nickname" value={selectedChild.child.nickname} />
                ) : null}
                <DetailRow label="Parent" value={selectedChild.child.parent.fullName} />
                <DetailRow label="Birthday" value={formatBirthday(selectedChild.child.birthday)} />
                <DetailRow
                  label="Home Service"
                  value={selectedChild.child.homeService || DEFAULT_HOME_SERVICE}
                />
                <DetailRow label="Contact" value={selectedChild.child.parent.contactNumber} />
                {selectedChild.child.parent.address ? (
                  <DetailRow label="Address" value={selectedChild.child.parent.address} />
                ) : null}
                <DetailRow label="Time In" value={formatTime(selectedChild.timeIn)} />
              </dl>
              <DialogFooter className="flex-col gap-3 sm:flex-col">
                <Button
                  size="xl"
                  className="w-full bg-[#003B8E] text-white hover:bg-[#002c6b]"
                  onClick={() => beginCheckout(selectedChild)}
                >
                  Checkout
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedChild(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(checkoutTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCheckoutTarget(null);
            setClaimantName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              {checkoutTarget
                ? `Claiming ${childFullName(checkoutTarget.child.firstName, checkoutTarget.child.lastName)}. Type the full name of the person picking up.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="claimant">Claimant full name</Label>
            <Input
              id="claimant"
              className="h-14 text-lg"
              value={claimantName}
              onChange={(e) => setClaimantName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              autoFocus
            />
            {checkoutTarget && (
              <p className="text-sm text-black/50">
                Registered parent: {checkoutTarget.child.parent.fullName}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              size="xl"
              className="w-full bg-[#003B8E] text-white hover:bg-[#002c6b]"
              disabled={pending || busyAction === "checkout" || !claimantName.trim()}
              onClick={() => {
                if (!checkoutTarget) return;
                run(async () => {
                  const result = await checkOutAction(checkoutTarget.id, claimantName);
                  if (!result.ok) throw new Error(result.error);
                  setCheckoutTarget(null);
                  setClaimantName("");
                  if (selectedId) {
                    const roster = await getSessionRosterAction(selectedId);
                    if (roster.ok) {
                      setRowsBySession((prev) => ({ ...prev, [selectedId]: roster.rows }));
                    }
                  }
                }, "Checked out", "checkout");
              }}
            >
              {busyAction === "checkout" ? "Checking out…" : "Confirm Checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-3 last:border-0 last:pb-0">
      <dt className="text-black/50">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function PoolColumn({
  title,
  rows,
  onSelect,
}: {
  title: string;
  rows: AttendanceWithChild[];
  onSelect: (row: AttendanceWithChild) => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">{title}</h3>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-black/40">Empty</p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className="w-full rounded-xl border border-black/10 bg-[#f7f9fc] p-4 text-left transition hover:border-[#003B8E]/40 hover:bg-[#eef4ff] active:scale-[0.99]"
            >
              <p className="text-lg font-semibold">
                {childFullName(row.child.firstName, row.child.lastName)}
              </p>
              <p className="text-base text-black/55">Parent: {row.child.parent.fullName}</p>
              <p className="mt-1 text-sm text-black/40">
                Age {getAge(row.child.birthday)} · In {formatTime(row.timeIn)}
              </p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white/70 px-6 py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-xl text-black/55">{title}</p>
    </div>
  );
}
