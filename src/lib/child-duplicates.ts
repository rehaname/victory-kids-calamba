/**
 * Detect likely duplicate child registrations.
 * Match: same birthday AND (first+last OR nickname+last), case-insensitive, trimmed.
 */

export type ChildIdentity = {
  firstName: string;
  lastName: string;
  nickname?: string;
  birthday: string; // YYYY-MM-DD
};

export type DuplicateHit<T extends ChildIdentity = ChildIdentity> = {
  /** Index into the incoming children array that matched. */
  inputIndex: number;
  existing: T;
};

export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function nameKeys(child: ChildIdentity): Set<string> {
  const last = normalizePersonName(child.lastName);
  const first = normalizePersonName(child.firstName);
  const nickname = normalizePersonName(child.nickname ?? "");
  const keys = new Set<string>();
  if (first && last) keys.add(`${first}\0${last}`);
  if (nickname && last) keys.add(`${nickname}\0${last}`);
  return keys;
}

/** True when birthday matches and first+last or nickname+last overlaps. */
export function isLikelyDuplicateChild(
  candidate: ChildIdentity,
  existing: ChildIdentity,
): boolean {
  if (candidate.birthday !== existing.birthday) return false;
  const left = nameKeys(candidate);
  const right = nameKeys(existing);
  for (const key of left) {
    if (right.has(key)) return true;
  }
  return false;
}

export function findLikelyDuplicates<T extends ChildIdentity>(
  incoming: ChildIdentity[],
  existing: T[],
): DuplicateHit<T>[] {
  const hits: DuplicateHit<T>[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const candidate = incoming[i]!;
    for (const row of existing) {
      if (isLikelyDuplicateChild(candidate, row)) {
        hits.push({ inputIndex: i, existing: row });
      }
    }
  }
  return hits;
}

export function formatDuplicateBlockMessage(
  hits: Array<{
    childFirstName: string;
    childLastName: string;
    birthday: string;
    parentName: string;
  }>,
): string {
  if (hits.length === 0) {
    return "A similar child is already registered. Check the List before registering again.";
  }

  const lines = hits.map((hit) => {
    const name = `${hit.childFirstName} ${hit.childLastName}`.trim();
    return `${name} (birthday ${hit.birthday}), parent ${hit.parentName}`;
  });

  const unique = [...new Set(lines)];
  if (unique.length === 1) {
    return `Already registered: ${unique[0]}. Remove the duplicate on List, or correct the details.`;
  }
  return `Already registered:\n• ${unique.join("\n• ")}\nRemove duplicates on List, or correct the details.`;
}
