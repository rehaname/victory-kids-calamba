const STORAGE_KEY = "victory_kids_calamba_kiosk_session";

let snapshot: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/**
 * Which session this particular kiosk device checks kids into. Device-local on
 * purpose: two tablets can serve two concurrent services. The value is only
 * honoured while that session is still open.
 */
export function readSelectedSessionId(): string | null {
  if (typeof window === "undefined") return null;
  if (!loaded) {
    try {
      snapshot = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      snapshot = null;
    }
    loaded = true;
  }
  return snapshot;
}

export function writeSelectedSessionId(sessionId: string | null): void {
  snapshot = sessionId;
  loaded = true;
  if (typeof window !== "undefined") {
    try {
      if (sessionId) {
        window.localStorage.setItem(STORAGE_KEY, sessionId);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage unavailable: the kiosk falls back to the newest open session.
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeSelectedSessionId(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = event.newValue;
    loaded = true;
    for (const l of listeners) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getServerSelectedSessionId(): null {
  return null;
}
