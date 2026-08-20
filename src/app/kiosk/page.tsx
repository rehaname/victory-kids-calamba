import type { Metadata, Viewport } from "next";
import { kioskStateAction } from "@/app/actions";
import { KioskApp } from "@/components/kiosk/kiosk-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kids Church Kiosk · Victory Calamba",
  description: "Register or check in a child for Victory Calamba Kids Church.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Stops iOS zooming the page when a parent taps into a text field.
  maximumScale: 1,
  themeColor: "#003B8E",
};

/**
 * Public, unattended kiosk. Unlike the staff pages this is deliberately not
 * behind StaffPinGate — the PIN only guards the settings menu.
 */
export default async function KioskPage() {
  const initialState = await kioskStateAction();
  return <KioskApp initialState={initialState} />;
}
