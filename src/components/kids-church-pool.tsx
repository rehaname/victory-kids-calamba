"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  checkOutAction,
  closeSessionAction,
  startSessionAction,
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
import type { AgePool, AttendanceWithChild, Session } from "@/lib/types";
import { CheckInModal } from "@/components/check-in-modal";
import { KioskHeader } from "@/components/kiosk-header";
import { HOME_SERVICE } from "@/components/register-family-form";
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
  active: AttendanceWithChild[];
};

export function KidsChurchPool({ session, active }: Props) {
  const [pending, startTransition] = useTransition();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<AttendanceWithChild | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<AttendanceWithChild | null>(null);
  const [claimantName, setClaimantName] = useState("");

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

  function run(action: () => Promise<void>, success?: string) {
    startTransition(async () => {
      try {
        await action();
        if (success) toast.success(success);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function beginCheckout(row: AttendanceWithChild) {
    setSelectedChild(null);
    setCheckoutTarget(row);
    setClaimantName("");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black">
      <KioskHeader
        title="Kids Church"
        subtitle="Check-in pool · ages 4–12"
        session={session}
        showSessionControls
        pending={pending}
        onStartSession={() =>
          run(async () => {
            await startSessionAction();
            setCheckInOpen(true);
          }, "Kids Church session started")
        }
        onCloseSession={() =>
          session &&
          run(async () => closeSessionAction(session.id), "Session closed")
        }
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {session ? (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                    Kids Church is open
                  </h2>
                  <p className="text-sm text-black/55">
                    Parents can check in an existing child or register a new one.
                  </p>
                </div>
                <Button
                  className="h-12 bg-[#003B8E] px-6 text-base text-white hover:bg-[#002c6b]"
                  onClick={() => setCheckInOpen(true)}
                >
                  Check in a child
                </Button>
              </div>
            </section>

            {active.length === 0 ? (
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
        ) : (
          <EmptyState title="Start a Kids Church session to open check-in" />
        )}
      </main>

      <CheckInModal
        open={checkInOpen && Boolean(session)}
        onOpenChange={setCheckInOpen}
        active={active}
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
                <DetailRow label="Parent" value={selectedChild.child.parent.fullName} />
                <DetailRow label="Birthday" value={formatBirthday(selectedChild.child.birthday)} />
                <DetailRow
                  label="Home Service"
                  value={selectedChild.child.homeService || HOME_SERVICE}
                />
                <DetailRow label="Contact" value={selectedChild.child.parent.contactNumber} />
                {selectedChild.child.parent.address ? (
                  <DetailRow label="Address" value={selectedChild.child.parent.address} />
                ) : null}
                <DetailRow label="Time In" value={formatTime(selectedChild.timeIn)} />
              </dl>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setSelectedChild(null)}>
                  Close
                </Button>
                <Button
                  className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
                  onClick={() => beginCheckout(selectedChild)}
                >
                  Out
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
            <DialogTitle>Time out</DialogTitle>
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
              className="h-12 text-base"
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
              className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
              disabled={pending || !claimantName.trim()}
              onClick={() => {
                if (!checkoutTarget) return;
                run(async () => {
                  await checkOutAction(checkoutTarget.id, claimantName);
                  setCheckoutTarget(null);
                  setClaimantName("");
                }, "Checked out");
              }}
            >
              Confirm Time Out
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
              className="w-full rounded-xl border border-black/10 bg-[#f7f9fc] p-3 text-left transition hover:border-[#003B8E]/40 hover:bg-[#eef4ff] active:scale-[0.99]"
            >
              <p className="text-base font-semibold">
                {childFullName(row.child.firstName, row.child.lastName)}
              </p>
              <p className="text-sm text-black/55">Parent: {row.child.parent.fullName}</p>
              <p className="mt-1 text-xs text-black/40">
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
