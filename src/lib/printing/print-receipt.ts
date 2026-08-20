import {
  isBluetoothSupported,
  printBytes,
  PrinterUnavailableError,
} from "@/lib/printing/bluetooth";
import { buildReceiptBytes, buildTestPrintBytes } from "@/lib/printing/escpos";
import { loadLogoRaster } from "@/lib/printing/logo";
import { PAPER_DOTS } from "@/lib/printing/paper";
import { readPrinterSettings } from "@/lib/printing/printer-settings";
import type { Receipt } from "@/lib/types";

export type PrintOutcome =
  | { via: "bluetooth" }
  | { via: "system"; reason: string };

/**
 * Prints over Bluetooth when a printer is paired and reachable, otherwise hands
 * off to the browser's print dialog so the slip still comes out somewhere.
 * The caller renders the on-screen receipt that the dialog will pick up.
 */
export async function printReceipt(
  receipt: Receipt,
  options: { reprint?: boolean } = {},
): Promise<PrintOutcome> {
  const settings = readPrinterSettings();

  if (!isBluetoothSupported()) {
    await systemPrint();
    return { via: "system", reason: "This browser cannot reach Bluetooth printers." };
  }
  if (!settings.deviceId) {
    await systemPrint();
    return { via: "system", reason: "No Bluetooth printer is set up yet." };
  }

  try {
    const logo = await loadLogoRaster(PAPER_DOTS[settings.paperWidth]);
    const bytes = buildReceiptBytes(receipt, {
      paperWidth: settings.paperWidth,
      logo,
      reprint: options.reprint,
    });
    await printBytes(bytes, settings.deviceId);
    return { via: "bluetooth" };
  } catch (err) {
    await systemPrint();
    return {
      via: "system",
      reason:
        err instanceof PrinterUnavailableError
          ? err.message
          : "The Bluetooth printer did not respond.",
    };
  }
}

/** Setup-screen test slip. Bluetooth only — a failure here should be loud. */
export async function printTestSlip(): Promise<void> {
  const settings = readPrinterSettings();
  if (!settings.deviceId) {
    throw new PrinterUnavailableError("Pair a printer first.");
  }
  const logo = await loadLogoRaster(PAPER_DOTS[settings.paperWidth]);
  await printBytes(
    buildTestPrintBytes(settings.paperWidth, logo),
    settings.deviceId,
  );
}

/**
 * Awaits a paint before opening the dialog, so a slip that was only just added
 * to the DOM is actually on screen for the browser to capture. Resolves once
 * the dialog has been dismissed, which keeps callers from tearing the slip down
 * too early.
 */
export async function systemPrint(): Promise<void> {
  if (typeof window === "undefined") return;
  await nextPaint();
  window.print();
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    // Two frames: the first runs before the pending paint, the second after it.
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => resolve()),
    );
  });
}
