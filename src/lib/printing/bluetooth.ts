/**
 * Web Bluetooth transport for ESC/POS thermal printers.
 *
 * Availability note: Safari on iOS/iPadOS does not implement Web Bluetooth, so
 * `isBluetoothSupported()` is false on a stock iPad and callers must fall back
 * to the system print dialog. Chrome on Android and desktop, and iPad browsers
 * that polyfill `navigator.bluetooth`, work unchanged.
 */

/**
 * GATT services exposed by common BLE receipt printers. The device chooser
 * accepts all devices, but a service must be listed here for the page to be
 * allowed to talk to it afterwards.
 */
const PRINTER_SERVICES: string[] = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Most generic Chinese thermal printers
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 style serial bridges
  "0000ff80-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip/ISSC transparent UART
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

/** Conservative default; raised to the negotiated MTU when one is reported. */
const CHUNK_SIZE = 180;

/** Thermal heads need a beat between chunks or they drop bytes mid-receipt. */
const CHUNK_DELAY_MS = 24;

export type PairedPrinter = {
  id: string;
  name: string;
};

type BluetoothLike = {
  requestDevice(options: unknown): Promise<BluetoothDeviceLike>;
  getDevices?: () => Promise<BluetoothDeviceLike[]>;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<GattServerLike>;
    disconnect(): void;
  };
  addEventListener?(type: string, listener: () => void): void;
};

type GattServerLike = {
  getPrimaryServices(): Promise<GattServiceLike[]>;
  getPrimaryService(uuid: string): Promise<GattServiceLike>;
};

type GattServiceLike = {
  uuid: string;
  getCharacteristics(): Promise<GattCharacteristicLike[]>;
};

type GattCharacteristicLike = {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValue?(value: BufferSource): Promise<void>;
};

function bluetooth(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth ?? null;
}

export function isBluetoothSupported(): boolean {
  return bluetooth() !== null;
}

/** True on a stock iPad/iPhone, where the fallback message should mention Safari. */
export function isAppleMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS reports itself as a Mac; touch points give it away.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

export class PrinterUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrinterUnavailableError";
  }
}

let connected: {
  device: BluetoothDeviceLike;
  characteristic: GattCharacteristicLike;
} | null = null;

/** Opens the browser's device chooser. Must be called from a user gesture. */
export async function requestPrinter(): Promise<PairedPrinter> {
  const bt = bluetooth();
  if (!bt) {
    throw new PrinterUnavailableError(
      "This browser cannot connect to Bluetooth printers.",
    );
  }

  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });

  // Connect straight away so pairing problems surface during setup, not at
  // the moment a parent is waiting for a slip.
  const characteristic = await connect(device);
  connected = { device, characteristic };

  return { id: device.id, name: device.name?.trim() || "Receipt printer" };
}

/**
 * Reconnects to a previously chosen printer without prompting. Only works when
 * the browser still holds the permission, which `getDevices()` reports.
 */
export async function reconnectPrinter(
  deviceId: string,
): Promise<PairedPrinter | null> {
  const bt = bluetooth();
  if (!bt?.getDevices) return null;

  try {
    const devices = await bt.getDevices();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return null;
    const characteristic = await connect(device);
    connected = { device, characteristic };
    return { id: device.id, name: device.name?.trim() || "Receipt printer" };
  } catch {
    return null;
  }
}

export function isPrinterConnected(deviceId?: string | null): boolean {
  if (!connected?.device.gatt?.connected) return false;
  return deviceId ? connected.device.id === deviceId : true;
}

export function disconnectPrinter(): void {
  connected?.device.gatt?.disconnect();
  connected = null;
}

/** Sends raw ESC/POS bytes, reconnecting first if the link has dropped. */
export async function printBytes(
  bytes: Uint8Array,
  deviceId?: string | null,
): Promise<void> {
  if (!isBluetoothSupported()) {
    throw new PrinterUnavailableError(
      "This browser cannot connect to Bluetooth printers.",
    );
  }

  if (!isPrinterConnected(deviceId)) {
    const reconnected = deviceId ? await reconnectPrinter(deviceId) : null;
    if (!reconnected) {
      throw new PrinterUnavailableError(
        "No printer connected. Open Settings and set up the Bluetooth printer.",
      );
    }
  }

  const characteristic = connected?.characteristic;
  if (!characteristic) {
    throw new PrinterUnavailableError("Printer connection was lost.");
  }

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    // Slice copies, which matters: some stacks reject views over a shared buffer.
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    await write(characteristic, chunk);
    if (offset + CHUNK_SIZE < bytes.length) await delay(CHUNK_DELAY_MS);
  }
}

async function connect(
  device: BluetoothDeviceLike,
): Promise<GattCharacteristicLike> {
  if (!device.gatt) {
    throw new PrinterUnavailableError("That device does not support GATT.");
  }

  device.addEventListener?.("gattserverdisconnected", () => {
    if (connected?.device.id === device.id) connected = null;
  });

  // connect() resolves to the server whether or not the link is already up.
  const server = await device.gatt.connect();

  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    throw new PrinterUnavailableError(
      "That device has no writable print channel. Pick your receipt printer from the list.",
    );
  }
  return characteristic;
}

/**
 * Prefers the known printer services, then falls back to scanning every
 * service, because no-name printers use whatever UUID the vendor felt like.
 */
async function findWritableCharacteristic(
  server: GattServerLike,
): Promise<GattCharacteristicLike | null> {
  for (const uuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const match = await pickWritable(service);
      if (match) return match;
    } catch {
      // Service not present on this printer; try the next one.
    }
  }

  try {
    for (const service of await server.getPrimaryServices()) {
      const match = await pickWritable(service);
      if (match) return match;
    }
  } catch {
    // Nothing enumerable; fall through to the caller's error.
  }

  return null;
}

async function pickWritable(
  service: GattServiceLike,
): Promise<GattCharacteristicLike | null> {
  const characteristics = await service.getCharacteristics();
  return (
    characteristics.find((c) => c.properties.writeWithoutResponse) ??
    characteristics.find((c) => c.properties.write) ??
    null
  );
}

async function write(
  characteristic: GattCharacteristicLike,
  chunk: Uint8Array,
): Promise<void> {
  const buffer = chunk.buffer.slice(
    chunk.byteOffset,
    chunk.byteOffset + chunk.byteLength,
  ) as ArrayBuffer;

  if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
    await characteristic.writeValueWithoutResponse(buffer);
    return;
  }
  if (characteristic.writeValueWithResponse) {
    await characteristic.writeValueWithResponse(buffer);
    return;
  }
  if (characteristic.writeValue) {
    await characteristic.writeValue(buffer);
    return;
  }
  throw new PrinterUnavailableError("Printer will not accept data.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
