import { getAge, getAgePool } from "@/lib/age";
import type { ChildWithParent, KioskChildHit } from "@/lib/types";

/** First letter of the last word, so "Dela Cruz" becomes "C." */
export function lastInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const letter = last.charAt(0);
  return letter ? `${letter.toUpperCase()}.` : "";
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? "";
}

/** Strips fields a public kiosk must never send to the browser. */
export function toKioskChildHit(child: ChildWithParent): KioskChildHit {
  return {
    id: child.id,
    firstName: child.firstName.trim(),
    lastInitial: lastInitial(child.lastName),
    nickname: child.nickname.trim(),
    parentFirstName: firstNameOf(child.parent.fullName),
    parentLastInitial: lastInitial(child.parent.fullName),
    age: getAge(child.birthday),
    agePool: getAgePool(child.birthday),
  };
}
