type Rgb = { r: number; g: number; b: number };

export type DynamicTheme = {
  accentA: string;
  accentB: string;
  accentC: string;
  glow: string;
};

const DEFAULT_THEME: DynamicTheme = {
  accentA: "#2f3b72",
  accentB: "#4e3f78",
  accentC: "#273457",
  glow: "#3b4370"
};

const DARK_REFERENCE: Rgb = { r: 16, g: 20, b: 34 };

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorDistance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luminance(color: Rgb): number {
  return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
}

function normalizeAccentColor(color: Rgb): Rgb {
  // Keep colors cinematic: avoid clipping to very bright values.
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    r: clamp(Math.round(color.r * 0.68), 24, 126),
    g: clamp(Math.round(color.g * 0.68), 24, 122),
    b: clamp(Math.round(color.b * 0.74), 34, 142)
  };
}

function blendWithDark(color: Rgb, darkWeight = 0.4): Rgb {
  const mix = (base: number, target: number) => Math.round(base * (1 - darkWeight) + target * darkWeight);
  return {
    r: mix(color.r, DARK_REFERENCE.r),
    g: mix(color.g, DARK_REFERENCE.g),
    b: mix(color.b, DARK_REFERENCE.b)
  };
}

function ensureReadableAccent(color: Rgb): Rgb {
  const normalized = normalizeAccentColor(color);
  const toned = blendWithDark(normalized, 0.38);
  // Keep accents in a readable range against dark backgrounds.
  const targetLuminance = Math.min(0.44, Math.max(0.18, luminance(toned)));
  const scale = targetLuminance / Math.max(0.001, luminance(toned));
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    r: clamp(Math.round(toned.r * scale), 22, 136),
    g: clamp(Math.round(toned.g * scale), 22, 132),
    b: clamp(Math.round(toned.b * scale), 30, 148)
  };
}

function rankColor(color: Rgb): number {
  const brightness = (color.r + color.g + color.b) / 3;
  const saturation = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
  return saturation * 0.7 + (168 - Math.abs(brightness - 88)) * 0.3;
}

function pickPrimaryAccent(colors: Rgb[]): Rgb | null {
  if (!colors.length) return null;
  const sorted = colors
    .slice()
    .sort((a, b) => rankColor(b) - rankColor(a))
    .map((color) => ensureReadableAccent(color));
  return sorted[0] ?? null;
}

function pickSecondaryAccent(colors: Rgb[], primary: Rgb): Rgb {
  const fallback = blendWithDark(
    {
      r: primary.b,
      g: primary.r,
      b: primary.g
    },
    0.45
  );

  const candidates = colors
    .slice()
    .sort((a, b) => rankColor(b) - rankColor(a))
    .map((color) => ensureReadableAccent(color))
    .filter((color) => colorDistance(color, primary) > 24);

  return candidates[0] ?? fallback;
}

async function extractPaletteColors(url: string): Promise<Rgb[]> {
  if (typeof window === "undefined") return [];

  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          resolve([]);
          return;
        }

        const sampleWidth = 28;
        const sampleHeight = 28;
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

        const data = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 160) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          if (brightness < 20 || brightness > 235) continue;
          const key = `${Math.floor(r / 24)}-${Math.floor(g / 24)}-${Math.floor(b / 24)}`;
          const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          bucket.count += 1;
          buckets.set(key, bucket);
        }

        if (!buckets.size) {
          resolve([]);
          return;
        }

        const palette = Array.from(buckets.values())
          .filter((bucket) => bucket.count >= 2)
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
          .map((bucket) => ({
            r: Math.round(bucket.r / bucket.count),
            g: Math.round(bucket.g / bucket.count),
            b: Math.round(bucket.b / bucket.count)
          }));

        resolve(palette);
      } catch {
        resolve([]);
      }
    };

    image.onerror = () => resolve([]);
    image.src = url;
  });
}

export async function buildDynamicTheme(imageUrls: string[]): Promise<DynamicTheme> {
  try {
    const palettes = await Promise.all(imageUrls.map((url) => extractPaletteColors(url)));
    const colors = palettes.flat();
    if (!colors.length) return DEFAULT_THEME;

    const accentA = pickPrimaryAccent(colors);
    if (!accentA) return DEFAULT_THEME;
    const accentB = pickSecondaryAccent(colors, accentA);
    const accentC = blendWithDark({
      r: Math.round((accentA.r + accentB.r) / 2),
      g: Math.round((accentA.g + accentB.g) / 2),
      b: Math.round((accentA.b + accentB.b) / 2)
    }, 0.54);

    return {
      accentA: rgbToHex(blendWithDark(accentA, 0.38)),
      accentB: rgbToHex(blendWithDark(accentB, 0.4)),
      accentC: rgbToHex(accentC),
      glow: rgbToHex(blendWithDark(ensureReadableAccent(accentA), 0.46))
    };
  } catch {
    return DEFAULT_THEME;
  }
}
