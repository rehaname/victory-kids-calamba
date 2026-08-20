import type { RasterImage } from "@/lib/printing/escpos";

const LOGO_SRC = "/brand/victory-mark.svg";

/** Keep the mark to a third of the paper so it does not dominate the slip. */
const LOGO_DOT_RATIO = 1 / 3;

let cache: { key: string; image: RasterImage } | null = null;

/**
 * Draws the Victory mark to a canvas and packs it into the 1-bit, row-major
 * format GS v 0 expects. Returns null when rasterizing is not possible (no
 * canvas, blocked image load) so printing degrades to a text-only slip.
 */
export async function loadLogoRaster(
  paperDots: number,
): Promise<RasterImage | null> {
  if (typeof document === "undefined") return null;

  // ESC/POS raster rows are byte-aligned, so snap the width to a multiple of 8.
  const width = Math.max(8, Math.floor((paperDots * LOGO_DOT_RATIO) / 8) * 8);
  const key = `${width}`;
  if (cache?.key === key) return cache.image;

  try {
    const bitmap = await loadImage(LOGO_SRC);
    const height = width;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    // Thermal paper is white; unpainted pixels must read as white, not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);
    const widthBytes = width / 8;
    const packed = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const alpha = data[i + 3] / 255;
        // Composite onto white, then threshold to ink.
        const luma =
          (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * alpha +
          255 * (1 - alpha);
        if (luma < 128) {
          packed[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }

    const image: RasterImage = { data: packed, widthBytes, height };
    cache = { key, image };
    return image;
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}
