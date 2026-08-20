import {
  DEFAULT_PAPER_WIDTH,
  isPaperWidth,
  type PaperWidth,
} from "@/lib/printing/paper";

const STORAGE_KEY = "victory_kids_calamba_printer";

export type PrinterSettings = {
  /** Web Bluetooth device id, used to re-acquire the device silently. */
  deviceId: string | null;
  deviceName: string | null;
  paperWidth: PaperWidth;
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  deviceId: null,
  deviceName: null,
  paperWidth: DEFAULT_PAPER_WIDTH,
};

/**
 * Cached so useSyncExternalStore gets a stable object identity between reads;
 * returning a fresh object every time would loop the render.
 */
let snapshot: PrinterSettings | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): PrinterSettings {
  if (!raw) return DEFAULT_PRINTER_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<PrinterSettings>;
    return {
      deviceId: typeof value.deviceId === "string" ? value.deviceId : null,
      deviceName: typeof value.deviceName === "string" ? value.deviceName : null,
      paperWidth: isPaperWidth(value.paperWidth)
        ? value.paperWidth
        : DEFAULT_PAPER_WIDTH,
    };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function readPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS;
  if (snapshot) return snapshot;
  try {
    snapshot = parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    snapshot = DEFAULT_PRINTER_SETTINGS;
  }
  return snapshot;
}

export function writePrinterSettings(settings: PrinterSettings): void {
  snapshot = settings;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing or a full quota: the kiosk still prints, it just forgets.
    }
  }
  for (const listener of listeners) listener();
}

export function subscribePrinterSettings(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab on the same kiosk may repoint the printer.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = parse(event.newValue);
    for (const l of listeners) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getServerPrinterSettings(): PrinterSettings {
  return DEFAULT_PRINTER_SETTINGS;
}

export function clearPairedPrinter(): PrinterSettings {
  const next: PrinterSettings = { ...readPrinterSettings(), deviceId: null, deviceName: null };
  writePrinterSettings(next);
  return next;
}
