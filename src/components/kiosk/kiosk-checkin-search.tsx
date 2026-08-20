"use client";

import { Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { searchChildrenAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_POOL_LABELS, getAge, getAgePool } from "@/lib/age";
import type { ChildWithParent } from "@/lib/types";

/** Below this the result list would be most of the roster on a public screen. */
const MIN_QUERY_LENGTH = 3;

const DEBOUNCE_MS = 250;

type Props = {
  /** Child ids already checked into the active session. */
  checkedInChildIds: string[];
  pendingChildId: string | null;
  onSelect: (child: ChildWithParent) => void;
  onRegisterInstead: () => void;
};

export function KioskCheckInSearch({
  checkedInChildIds,
  pendingChildId,
  onSelect,
  onRegisterInstead,
}: Props) {
  const [query, setQuery] = useState("");
  /** Tagged with the query it answers, so stale results never render. */
  const [answer, setAnswer] = useState<{ query: string; rows: ChildWithParent[] } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;
  const searched = answer?.query === trimmed;
  const results = searched ? answer.rows : [];

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          setAnswer({ query: trimmed, rows: await searchChildrenAction(trimmed) });
        } catch {
          setAnswer({ query: trimmed, rows: [] });
        }
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          Find your child
        </h2>
        <p className="mt-1 text-base text-black/60">
          Type the child&rsquo;s first name or the parent&rsquo;s name.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kiosk-search" className="text-base">
          Child or parent name
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-black/35" />
          <Input
            id="kiosk-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a name…"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="search"
            className="h-16 pl-12 text-lg"
            autoFocus
          />
        </div>
        {tooShort && (
          <p className="text-sm text-black/45">
            Keep typing — at least {MIN_QUERY_LENGTH} letters.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {pending && !results.length && (
          <p className="py-6 text-center text-base text-black/45">Searching…</p>
        )}

        {searched && !pending && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/15 px-4 py-8 text-center">
            <p className="text-base text-black/55">No match for &ldquo;{trimmed}&rdquo;.</p>
            <Button
              size="xl"
              variant="outline"
              className="mt-4 h-14 border-2 border-[#003B8E] text-base font-semibold text-[#003B8E]"
              onClick={onRegisterInstead}
            >
              Register instead
            </Button>
          </div>
        )}

        {results.map((child) => (
          <ResultRow
            key={child.id}
            child={child}
            alreadyIn={checkedInChildIds.includes(child.id)}
            pending={pendingChildId === child.id}
            disabled={pendingChildId !== null}
            onSelect={() => onSelect(child)}
          />
        ))}
      </div>
    </div>
  );
}

function ResultRow({
  child,
  alreadyIn,
  pending,
  disabled,
  onSelect,
}: {
  child: ChildWithParent;
  alreadyIn: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const pool = getAgePool(child.birthday);
  const age = getAge(child.birthday);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-xl font-semibold">
          {child.firstName} {initial(child.lastName)}
          {child.nickname && (
            <span className="font-normal text-black/45"> ({child.nickname})</span>
          )}
        </p>
        <p className="truncate text-base text-black/55">
          Parent: {child.parent.fullName.split(/\s+/)[0]} {initial(lastWord(child.parent.fullName))}
        </p>
        <p className="text-sm text-black/40">
          {pool ? AGE_POOL_LABELS[pool] : `Age ${age} · outside the 4–12 range`}
        </p>
      </div>
      <Button
        size="xl"
        disabled={alreadyIn || !pool || disabled}
        onClick={onSelect}
        className="h-14 w-full bg-[#003B8E] text-base font-semibold text-white hover:bg-[#002c6b] sm:w-40"
      >
        {alreadyIn
          ? "Already in"
          : !pool
            ? "Not eligible"
            : pending
              ? "Checking in…"
              : "Check In"}
      </Button>
    </div>
  );
}

/** Public screen: show "Santos" as "S." so the kiosk is not a roster dump. */
function initial(name: string): string {
  const first = name.trim().charAt(0);
  return first ? `${first.toUpperCase()}.` : "";
}

function lastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}
