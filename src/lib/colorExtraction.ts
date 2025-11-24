/**
 * Color extraction utility for getting dominant colors from images
 * Uses histogram analysis with HSL color space for intelligent color selection
 */

export interface ExtractedColors {
  primary: string; // rgb(r, g, b)
  secondary: string; // rgb(r, g, b)
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
}

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

/**
 * Convert HSL to RGB color space
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Generate fallback colors when extraction fails
 */
function fallbackFromIndex(idx: number): [number, number, number][] {
  const h = (idx * 37) % 360;
  const s = 0.65;
  const c1 = hslToRgb(h, s, 0.52);
  const c2 = hslToRgb(h, s, 0.72);
  return [c1, c2];
}

/**
 * Extract dominant colors from an image using histogram analysis
 * Returns primary (darker/saturated) and secondary (lighter) colors
 */
export async function extractColorsFromImage(
  imageUrl: string,
  idx: number = 0,
): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const colors = extractColorsFromCanvas(img, idx);
        resolve(colors);
      } catch {
        const [c1, c2] = fallbackFromIndex(idx);
        resolve({
          primary: `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`,
          secondary: `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`,
          primaryRgb: c1,
          secondaryRgb: c2,
        });
      }
    };

    img.onerror = () => {
      const [c1, c2] = fallbackFromIndex(idx);
      resolve({
        primary: `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`,
        secondary: `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`,
        primaryRgb: c1,
        secondaryRgb: c2,
      });
    };

    img.src = imageUrl;
  });
}

/**
 * Extract colors from a canvas element
 */
function extractColorsFromCanvas(
  img: HTMLImageElement,
  idx: number,
): ExtractedColors {
  const MAX = 48;
  const ratio =
    img.naturalWidth && img.naturalHeight
      ? img.naturalWidth / img.naturalHeight
      : 1;
  const tw = ratio >= 1 ? MAX : Math.max(16, Math.round(MAX * ratio));
  const th = ratio >= 1 ? Math.max(16, Math.round(MAX / ratio)) : MAX;

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(img, 0, 0, tw, th);
  const imageData = ctx.getImageData(0, 0, tw, th);
  const data = imageData.data;

  // Create 2D histogram bins (hue × saturation)
  const H_BINS = 36;
  const S_BINS = 5;
  const SIZE = H_BINS * S_BINS;
  const wSum = new Float32Array(SIZE);
  const rSum = new Float32Array(SIZE);
  const gSum = new Float32Array(SIZE);
  const bSum = new Float32Array(SIZE);

  // Analyze each pixel
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.05) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);

    // Skip near-white, near-black, and desaturated colors
    if (l < 0.1 || l > 0.92 || s < 0.08) continue;

    // Weight by saturation and mid-tone preference
    const w = a * (s * s) * (1 - Math.abs(l - 0.5) * 0.6);

    const hi = Math.max(0, Math.min(H_BINS - 1, Math.floor((h / 360) * H_BINS)));
    const si = Math.max(0, Math.min(S_BINS - 1, Math.floor(s * S_BINS)));
    const bidx = hi * S_BINS + si;

    wSum[bidx] += w;
    rSum[bidx] += r * w;
    gSum[bidx] += g * w;
    bSum[bidx] += b * w;
  }

  // Find primary color (bin with highest weight)
  let pIdx = -1;
  let pW = 0;
  for (let i = 0; i < SIZE; i++) {
    if (wSum[i] > pW) {
      pW = wSum[i];
      pIdx = i;
    }
  }

  if (pIdx < 0 || pW <= 0) {
    const [c1, c2] = fallbackFromIndex(idx);
    return {
      primary: `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`,
      secondary: `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`,
      primaryRgb: c1,
      secondaryRgb: c2,
    };
  }

  const pHue = Math.floor(pIdx / S_BINS) * (360 / H_BINS);

  // Find secondary color (sufficiently different hue)
  let sIdx = -1;
  let sW = 0;
  for (let i = 0; i < SIZE; i++) {
    const w = wSum[i];
    if (w <= 0) continue;
    const h = Math.floor(i / S_BINS) * (360 / H_BINS);
    let dh = Math.abs(h - pHue);
    dh = Math.min(dh, 360 - dh);
    if (dh >= 25 && w > sW) {
      sW = w;
      sIdx = i;
    }
  }

  // Calculate weighted average RGB for a bin
  const avgRGB = (idx: number): [number, number, number] => {
    const w = wSum[idx] || 1e-6;
    return [
      Math.round(rSum[idx] / w),
      Math.round(gSum[idx] / w),
      Math.round(bSum[idx] / w),
    ];
  };

  // Build primary color
  const [pr, pg, pb] = avgRGB(pIdx);
  let [h1, s1] = rgbToHsl(pr, pg, pb);
  s1 = Math.max(0.45, Math.min(1, s1 * 1.15));
  const c1 = hslToRgb(h1, s1, 0.5);

  // Build secondary color
  let c2: [number, number, number];
  if (sIdx >= 0 && sW >= pW * 0.6) {
    const [sr, sg, sb] = avgRGB(sIdx);
    let [h2, s2] = rgbToHsl(sr, sg, sb);
    s2 = Math.max(0.45, Math.min(1, s2 * 1.05));
    c2 = hslToRgb(h2, s2, 0.72);
  } else {
    c2 = hslToRgb(h1, s1, 0.72);
  }

  return {
    primary: `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`,
    secondary: `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`,
    primaryRgb: c1,
    secondaryRgb: c2,
  };
}
