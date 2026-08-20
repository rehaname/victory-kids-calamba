import { formatTime } from "@/lib/age";
import { formatSessionDate } from "@/lib/session";
import {
  DEFAULT_PAPER_WIDTH,
  PAPER_COLUMNS,
  type PaperWidth,
} from "@/lib/printing/paper";
import type { Receipt } from "@/lib/types";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** 1-bit image ready for the GS v 0 raster command. */
export type RasterImage = {
  /** Row-major packed bits, 1 = black. Length is bytesPerRow * height. */
  data: Uint8Array;
  widthBytes: number;
  height: number;
};

class Builder {
  private chunks: number[] = [];

  raw(...bytes: number[]) {
    this.chunks.push(...bytes);
    return this;
  }

  bytes(source: Uint8Array) {
    for (const byte of source) this.chunks.push(byte);
    return this;
  }

  /**
   * ESC/POS printers speak single-byte code pages, so anything outside ASCII
   * is transliterated rather than sent raw.
   */
  text(value: string) {
    for (const char of asciiFold(value)) {
      this.chunks.push(char.charCodeAt(0) & 0xff);
    }
    return this;
  }

  line(value = "") {
    return this.text(value).raw(LF);
  }

  feed(lines: number) {
    if (lines > 0) this.raw(ESC, 0x64, lines);
    return this;
  }

  init() {
    return this.raw(ESC, 0x40);
  }

  align(mode: "left" | "center" | "right") {
    const code = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    return this.raw(ESC, 0x61, code);
  }

  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** width/height are 1-8 multipliers via GS ! nibbles. */
  size(width: number, height: number) {
    const w = Math.min(Math.max(width, 1), 8) - 1;
    const h = Math.min(Math.max(height, 1), 8) - 1;
    return this.raw(GS, 0x21, (w << 4) | h);
  }

  image(image: RasterImage) {
    const { data, widthBytes, height } = image;
    if (!widthBytes || !height) return this;
    return this.raw(
      GS,
      0x76,
      0x30,
      0,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
    ).bytes(data);
  }

  /** Full cut with feed. Printers without a cutter ignore this. */
  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  build() {
    return new Uint8Array(this.chunks);
  }
}

const ASCII_FOLD: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2022": "*",
  "\u00B7": "-",
  "\u2026": "...",
  "\u00A0": " ",
};

function asciiFold(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2022\u00B7\u2026\u00A0]/g, (c) => ASCII_FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\n]/g, "");
}

function center(value: string, columns: number): string {
  const text = asciiFold(value).slice(0, columns);
  const pad = Math.max(0, Math.floor((columns - text.length) / 2));
  return " ".repeat(pad) + text;
}

/** "Parent      Maria Santos", clipped to the paper width. */
function labelled(label: string, value: string, columns: number): string {
  const labelWidth = Math.min(10, columns);
  const head = asciiFold(label).slice(0, labelWidth).padEnd(labelWidth, " ");
  return (head + asciiFold(value)).slice(0, columns);
}

function rule(columns: number): string {
  return "-".repeat(columns);
}

/**
 * Wraps on whole words so a long name never gets chopped mid-word.
 * Words longer than a line are hard-split.
 */
function wrap(value: string, columns: number): string[] {
  const words = asciiFold(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > columns) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += columns) {
        lines.push(word.slice(i, i + columns));
      }
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > columns) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export type ReceiptPrintOptions = {
  paperWidth?: PaperWidth;
  logo?: RasterImage | null;
  /** Set on reprints so staff can tell a duplicate slip from the original. */
  reprint?: boolean;
};

export function buildReceiptBytes(
  receipt: Receipt,
  options: ReceiptPrintOptions = {},
): Uint8Array {
  const paperWidth = options.paperWidth ?? DEFAULT_PAPER_WIDTH;
  const columns = PAPER_COLUMNS[paperWidth];
  const b = new Builder().init();

  if (options.logo) {
    b.align("center").image(options.logo).raw(LF);
  }

  b.align("center").bold(true);
  for (const line of wrap("VICTORY CALAMBA KIDS CHURCH", columns)) {
    b.line(line);
  }
  b.bold(false).line(rule(columns)).raw(LF);

  // Double-width so the name is readable across the room; halve the column
  // budget to match, and drop to single width if it still will not fit.
  const displayName = asciiFold(receipt.displayName).toUpperCase();
  if (displayName.length <= Math.floor(columns / 2)) {
    b.size(2, 2).bold(true).line(displayName).bold(false).size(1, 1);
  } else {
    b.bold(true);
    for (const line of wrap(displayName, columns)) b.line(line);
    b.bold(false);
  }

  for (const line of wrap(receipt.fullName, columns)) b.line(line);
  b.raw(LF).align("left");

  b.line(labelled("Parent", receipt.parentName, columns));
  b.line(labelled("Age", `${receipt.age}  (${receipt.agePoolLabel})`, columns));
  b.line(labelled("Time In", formatTime(receipt.timeIn), columns));
  b.line(labelled("Session", receipt.sessionName, columns));
  b.line(labelled("Date", formatSessionDate(receipt.sessionDate), columns));

  b.align("center").line(rule(columns));
  b.bold(true).line(center(`CLAIM  ${receipt.claimCode}`, columns)).bold(false);
  b.line(center("Please keep this slip", columns));
  if (options.reprint) {
    b.line(center("** REPRINT **", columns));
  }

  return b.feed(3).cut().build();
}

/** A short slip used by the printer setup screen to confirm the pairing. */
export function buildTestPrintBytes(
  paperWidth: PaperWidth = DEFAULT_PAPER_WIDTH,
  logo?: RasterImage | null,
): Uint8Array {
  const columns = PAPER_COLUMNS[paperWidth];
  const b = new Builder().init().align("center");
  if (logo) b.image(logo).raw(LF);
  b.bold(true).line(center("VICTORY CALAMBA KIDS CHURCH", columns)).bold(false);
  b.line(rule(columns));
  b.line(center("Printer test successful", columns));
  b.line(center(`${paperWidth}mm - ${columns} columns`, columns));
  b.line(center(formatTime(new Date().toISOString()), columns));
  return b.feed(3).cut().build();
}

export const __testing = { asciiFold, wrap, labelled, center };
