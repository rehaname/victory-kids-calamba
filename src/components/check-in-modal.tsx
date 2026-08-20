"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { checkInAction, registerFamilyAction, searchChildrenAction } from "@/app/actions";
import {
  AGE_POOL_LABELS,
  childFullName,
  getAge,
  getAgePool,
} from "@/lib/age";
import type { AttendanceWithChild, ChildWithParent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_HOME_SERVICE,
  emptyChild,
  RegisterFamilyForm,
} from "@/components/register-family-form";

type Mode = "search" | "register";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  active: AttendanceWithChild[];
  onRegistered?: () => void;
};

export function CheckInModal({
  open,
  onOpenChange,
  sessionId,
  active,
  onRegistered,
}: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChildWithParent[]>([]);
  const [pending, startTransition] = useTransition();

  const [parentName, setParentName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [kids, setKids] = useState([emptyChild()]);
  const [checkInNow, setCheckInNow] = useState(true);

  function resetForm() {
    setMode("search");
    setQuery("");
    setResults([]);
    setParentName("");
    setAddress("");
    setContact("");
    setKids([emptyChild()]);
    setCheckInNow(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "search" ? "Check in your child" : "Register new child"}
          </DialogTitle>
          <DialogDescription>
            {mode === "search"
              ? "Search for a child already registered, or register if this is your first visit."
              : "Fill in parent and child details. They will be checked in after saving."}
          </DialogDescription>
        </DialogHeader>

        {mode === "search" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-search">Child or parent name</Label>
              <Input
                id="checkin-search"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Start typing a name…"
                className="h-14 text-lg"
                autoFocus
              />
            </div>

            {query && (
              <div className="space-y-2">
                {results.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/50">
                    No matches found. Register as a new family below.
                  </p>
                ) : (
                  results.map((child) => {
                    const alreadyIn = active.some((a) => a.childId === child.id);
                    const pool = getAgePool(child.birthday);
                    const age = getAge(child.birthday);
                    return (
                      <div
                        key={child.id}
                        className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-lg font-semibold">
                            {childFullName(child.firstName, child.lastName)}
                            {child.nickname ? (
                              <span className="font-normal text-black/45">
                                {" "}
                                ({child.nickname})
                              </span>
                            ) : null}
                          </p>
                          <p className="text-base text-black/55">
                            Parent: {child.parent.fullName}
                          </p>
                          <p className="text-sm text-black/40">
                            {pool ? AGE_POOL_LABELS[pool] : `Age ${age} · outside 4–12 range`}
                          </p>
                        </div>
                        <Button
                          size="xl"
                          disabled={alreadyIn || pending || !pool}
                          className="w-full bg-[#003B8E] text-white hover:bg-[#002c6b] sm:w-auto"
                          onClick={() =>
                            run(async () => {
                              await checkInAction(child.id, sessionId);
                              handleOpenChange(false);
                              onRegistered?.();
                            }, `${child.firstName} checked in`)
                          }
                        >
                          {alreadyIn ? "Already in" : pool ? "Time In" : "Not eligible"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="border-t border-black/10 pt-4">
              <p className="mb-3 text-base text-black/55">First time at Kids Church?</p>
              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full"
                onClick={() => setMode("register")}
              >
                Register new child
              </Button>
            </div>
          </div>
        ) : (
          <RegisterFamilyForm
            parentName={parentName}
            address={address}
            contact={contact}
            kids={kids}
            checkInNow={checkInNow}
            pending={pending}
            onParentNameChange={setParentName}
            onAddressChange={setAddress}
            onContactChange={setContact}
            onKidsChange={setKids}
            onCheckInNowChange={setCheckInNow}
            onCancel={() => setMode("search")}
            onSubmit={() =>
              run(async () => {
                const result = await registerFamilyAction({
                  parent: {
                    fullName: parentName,
                    address,
                    contactNumber: contact,
                  },
                  children: kids.map((kid) => ({
                    ...kid,
                    homeService: kid.homeService || DEFAULT_HOME_SERVICE,
                  })),
                  checkInNow,
                  sessionId,
                });
                if (!result.ok) {
                  throw new Error(result.error);
                }
                handleOpenChange(false);
                onRegistered?.();
              }, "Family registered")
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
