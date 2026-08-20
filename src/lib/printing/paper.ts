/** Thermal paper widths the church is likely to own. */
export const PAPER_WIDTHS = [58, 80] as const;
export type PaperWidth = (typeof PAPER_WIDTHS)[number];

export const DEFAULT_PAPER_WIDTH: PaperWidth = 58;

/** Printable characters per line in ESC/POS Font A at each paper width. */
export const PAPER_COLUMNS: Record<PaperWidth, number> = {
  58: 32,
  80: 48,
};

/** Printable dots per line, used to size the rasterized logo. */
export const PAPER_DOTS: Record<PaperWidth, number> = {
  58: 384,
  80: 576,
};

export function isPaperWidth(value: unknown): value is PaperWidth {
  return (PAPER_WIDTHS as readonly unknown[]).includes(value);
}
