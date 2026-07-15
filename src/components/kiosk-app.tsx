"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  checkInAction,
  checkOutAction,
  closeSessionAction,
  getSessionHistoryAction,
  registerFamilyAction,
  searchChildrenAction,
  startSessionAction,
} from "@/app/actions";
import { AGE_POOL_LABELS, childFullName, formatSessionLabel, formatTime, getAgePool } from "@/lib/age";
import type {
  AgePool,
  AttendanceWithChild,
  ChildWithParent,
  Session,
} from "@/lib/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  session: Session | null;
  active: AttendanceWithChild[];
  sessions: Session[];
};

type ChildDraft = {
  firstName: string;
  lastName: string;
  birthday: string;
  homeService: string;
};

const emptyChild = (): ChildDraft => ({
  firstName: "",
  lastName: "",
  birthday: "",
  homeService: "",
});

export function KioskApp({ session, active, sessions }: Props) {
  const [tab, setTab] = useState("pool");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChildWithParent[]>([]);
  const [pending, startTransition] = useTransition();

  const [checkoutTarget, setCheckoutTarget] = useState<AttendanceWithChild | null>(null);
  const [claimantName, setClaimantName] = useState("");

  const [parentName, setParentName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [kids, setKids] = useState<ChildDraft[]>([emptyChild()]);
  const [checkInNow, setCheckInNow] = useState(true);

  const [historySessionId, setHistorySessionId] = useState(sessions[0]?.id ?? "");
  const [historyRows, setHistoryRows] = useState<AttendanceWithChild[]>([]);

  const pools = useMemo(() => {
    const grouped: Record<AgePool, AttendanceWithChild[]> = {
      "4-6": [],
      "7-9": [],
      "10-12": [],
      "needs-review": [],
    };
    for (const row of active) {
      grouped[row.agePool].push(row);
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

  function onSearch(value: string) {
    setQuery(value);
    startTransition(async () => {
      try {
        const rows = await searchChildrenAction(value);
        setResults(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
      }
    });
  }

  function loadHistory(sessionId: string) {
    setHistorySessionId(sessionId);
    startTransition(async () => {
      try {
        const rows = await getSessionHistoryAction(sessionId);
        setHistoryRows(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load history");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8f0ff_0%,_#ffffff_45%,_#f4f6f8_100%)] text-black">
      <header className="border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/victory-mark.svg"
              alt="Victory Calamba"
              width={48}
              height={48}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#003B8E]">
                Victory Calamba
              </p>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
                Kids Church Check-In
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {session ? (
              <>
                <Badge className="bg-[#003B8E] px-3 py-1 text-sm text-white hover:bg-[#003B8E]">
                  Session open · {formatSessionLabel(session.startedAt)}
                </Badge>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      async () => closeSessionAction(session.id),
                      "Session closed",
                    )
                  }
                >
                  Close session
                </Button>
              </>
            ) : (
              <>
                <Badge variant="secondary" className="px-3 py-1 text-sm">
                  No open session
                </Badge>
                <Button
                  className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
                  disabled={pending}
                  onClick={() => run(async () => startSessionAction(), "Session started")}
                >
                  Start session
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-1 bg-white p-1 shadow-sm">
            <TabsTrigger value="pool" className="py-3 text-base">
              Current Pool
            </TabsTrigger>
            <TabsTrigger value="register" className="py-3 text-base">
              Register
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="py-3 text-base"
              onClick={() => {
                if (sessions[0]) loadHistory(sessions[0].id);
              }}
            >
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pool" className="space-y-6">
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <Label htmlFor="search" className="mb-2 block text-sm text-black/60">
                Search child or parent
              </Label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="search"
                  value={query}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Type a child or parent name"
                  className="h-12 text-base"
                />
              </div>

              {query && (
                <div className="mt-4 space-y-2">
                  {results.length === 0 ? (
                    <p className="text-sm text-black/50">No matches. Register them first.</p>
                  ) : (
                    results.map((child) => {
                      const alreadyIn = active.some((a) => a.childId === child.id);
                      return (
                        <div
                          key={child.id}
                          className="flex flex-col gap-3 rounded-xl border border-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-lg font-semibold">
                              {childFullName(child.firstName, child.lastName)}
                            </p>
                            <p className="text-sm text-black/55">
                              Parent: {child.parent.fullName}
                            </p>
                            <p className="text-xs text-black/40">
                              {AGE_POOL_LABELS[getAgePool(child.birthday)]}
                            </p>
                          </div>
                          <Button
                            disabled={!session || alreadyIn || pending}
                            className="bg-[#003B8E] text-white hover:bg-[#002c6b]"
                            onClick={() =>
                              run(
                                async () => checkInAction(child.id),
                                `${child.firstName} checked in`,
                              )
                            }
                          >
                            {alreadyIn ? "Already in" : "Time In"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </section>

            {!session ? (
              <EmptyState title="Start a session to begin check-in" />
            ) : active.length === 0 ? (
              <EmptyState title="No kids checked in yet" />
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {(["4-6", "7-9", "10-12"] as AgePool[]).map((pool) => (
                  <PoolColumn
                    key={pool}
                    title={AGE_POOL_LABELS[pool]}
                    rows={pools[pool]}
                    onCheckout={setCheckoutTarget}
                  />
                ))}
              </div>
            )}

            {pools["needs-review"].length > 0 && (
              <PoolColumn
                title={AGE_POOL_LABELS["needs-review"]}
                rows={pools["needs-review"]}
                onCheckout={setCheckoutTarget}
              />
            )}
          </TabsContent>

          <TabsContent value="register">
            <form
              className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await registerFamilyAction({
                    parent: {
                      fullName: parentName,
                      address,
                      contactNumber: contact,
                    },
                    children: kids,
                    checkInNow,
                  });
                  setParentName("");
                  setAddress("");
                  setContact("");
                  setKids([emptyChild()]);
                  setTab("pool");
                }, "Family registered");
              }}
            >
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  Register parent & child
                </h2>
                <p className="text-sm text-black/55">
                  First visit only. One parent can register multiple children.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Parent's Name" value={parentName} onChange={setParentName} required />
                <Field label="Contact Number" value={contact} onChange={setContact} required />
                <div className="sm:col-span-2">
                  <Field label="Address" value={address} onChange={setAddress} required />
                </div>
              </div>

              <div className="space-y-4">
                {kids.map((kid, index) => (
                  <div key={index} className="rounded-xl border border-black/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-medium">Child {index + 1}</p>
                      {kids.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setKids((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="First Name"
                        value={kid.firstName}
                        onChange={(v) =>
                          setKids((prev) =>
                            prev.map((k, i) => (i === index ? { ...k, firstName: v } : k)),
                          )
                        }
                        required
                      />
                      <Field
                        label="Last Name"
                        value={kid.lastName}
                        onChange={(v) =>
                          setKids((prev) =>
                            prev.map((k, i) => (i === index ? { ...k, lastName: v } : k)),
                          )
                        }
                        required
                      />
                      <div className="space-y-2">
                        <Label>Birthday</Label>
                        <Input
                          type="date"
                          className="h-12"
                          required
                          value={kid.birthday}
                          onChange={(e) =>
                            setKids((prev) =>
                              prev.map((k, i) =>
                                i === index ? { ...k, birthday: e.target.value } : k,
                              ),
                            )
                          }
                        />
                      </div>
                      <Field
                        label="Home Service"
                        value={kid.homeService}
                        onChange={(v) =>
                          setKids((prev) =>
                            prev.map((k, i) => (i === index ? { ...k, homeService: v } : k)),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setKids((p) => [...p, emptyChild()])}>
                  Add another child
                </Button>
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checkInNow}
                  onChange={(e) => setCheckInNow(e.target.checked)}
                  className="size-4"
                />
                Time in now after saving
              </label>

              <Button
                type="submit"
                disabled={pending || (checkInNow && !session)}
                className="h-12 w-full bg-[#003B8E] text-base text-white hover:bg-[#002c6b] sm:w-auto"
              >
                Save registration
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <Label className="mb-2 block">Session</Label>
              <select
                className="h-12 w-full rounded-md border border-black/15 bg-white px-3 text-base"
                value={historySessionId}
                onChange={(e) => loadHistory(e.target.value)}
              >
                {sessions.length === 0 && <option value="">No sessions yet</option>}
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSessionLabel(s.startedAt)} · {s.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#003B8E] text-white">
                  <tr>
                    <th className="px-4 py-3 font-medium">Child</th>
                    <th className="px-4 py-3 font-medium">Parent</th>
                    <th className="px-4 py-3 font-medium">In</th>
                    <th className="px-4 py-3 font-medium">Out</th>
                    <th className="px-4 py-3 font-medium">Claimed by</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-black/45">
                        No attendance for this session.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((row) => (
                      <tr key={row.id} className="border-t border-black/5">
                        <td className="px-4 py-3 font-medium">
                          {childFullName(row.child.firstName, row.child.lastName)}
                        </td>
                        <td className="px-4 py-3 text-black/65">{row.child.parent.fullName}</td>
                        <td className="px-4 py-3">{formatTime(row.timeIn)}</td>
                        <td className="px-4 py-3">{formatTime(row.timeOut)}</td>
                        <td className="px-4 py-3">{row.claimantName ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {historyRows.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const csv = [
                    ["Child", "Parent", "Time In", "Time Out", "Claimed By"].join(","),
                    ...historyRows.map((row) =>
                      [
                        `"${childFullName(row.child.firstName, row.child.lastName)}"`,
                        `"${row.child.parent.fullName}"`,
                        row.timeIn,
                        row.timeOut ?? "",
                        `"${row.claimantName ?? ""}"`,
                      ].join(","),
                    ),
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `kids-church-${historySessionId}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export CSV
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </main>

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

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        className="h-12 text-base"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PoolColumn({
  title,
  rows,
  onCheckout,
}: {
  title: string;
  rows: AttendanceWithChild[];
  onCheckout: (row: AttendanceWithChild) => void;
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
              onClick={() => onCheckout(row)}
              className="w-full rounded-xl border border-black/10 bg-[#f7f9fc] p-3 text-left transition hover:border-[#003B8E]/40 hover:bg-[#eef4ff]"
            >
              <p className="text-base font-semibold">
                {childFullName(row.child.firstName, row.child.lastName)}
              </p>
              <p className="text-sm text-black/55">Parent: {row.child.parent.fullName}</p>
              <p className="mt-1 text-xs text-black/40">In {formatTime(row.timeIn)} · tap to Time Out</p>
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
