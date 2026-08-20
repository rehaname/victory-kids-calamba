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

export function readPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrinterSettings>;
    return {
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : null,
      deviceName: typeof parsed.deviceName === "string" ? parsed.deviceName : null,
      paperWidth: isPaperWidth(parsed.paperWidth)
        ? parsed.paperWidth
        : DEFAULT_PAPER_WIDTH,
    };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function writePrinterSettings(settings: PrinterSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a full quota: the kiosk still prints, it just forgets.
  }
}

export function clearPairedPrinter(): PrinterSettings {
  const next: PrinterSettings = { ...readPrinterSettings(), deviceId: null, deviceName: null };
  writePrinterSettings(next);
  return next;
}
