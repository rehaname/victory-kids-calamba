"use client";

import { useSyncExternalStore } from "react";
import {
  getServerPrinterSettings,
  readPrinterSettings,
  subscribePrinterSettings,
  type PrinterSettings,
} from "@/lib/printing/printer-settings";

/**
 * Printer settings live in localStorage, which the server cannot see. Reading
 * them through useSyncExternalStore keeps the first client render matching the
 * server output and re-renders every screen when the settings change.
 */
export function usePrinterSettings(): PrinterSettings {
  return useSyncExternalStore(
    subscribePrinterSettings,
    readPrinterSettings,
    getServerPrinterSettings,
  );
}
