import { useState, useEffect } from 'react';

export type RgbColor = { r: number; g: number; b: number };

function clampByte(n: number) {
    return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }: RgbColor) {
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(clampByte(r))}${toHex(clampByte(g))}${toHex(clampByte(b))}`;
}

function mix(a: RgbColor, b: RgbColor, t: number): RgbColor {
    return {
        r: clampByte(a.r + (b.r - a.r) * t),
        g: clampByte(a.g + (b.g - a.g) * t),
        b: clampByte(a.b + (b.b - a.b) * t),
    };
}

function luminance(c: RgbColor) {
    // Perceived brightness (0..255-ish)
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
}

function deriveHarmonizedPalette(primary: RgbColor): RgbColor[] {
    // Primary, lighter accent, darker secondary (keeps album vibe but improves contrast)
    const light = mix(primary, { r: 255, g: 255, b: 255 }, 0.35);
    const dark = mix(primary, { r: 0, g: 0, b: 0 }, 0.35);
    return [primary, light, dark];
}

/**
 * Extract 2–3 representative colors from an image.
 * Uses a small downscaled canvas + coarse quantization histogram (fast, dependency-free).
 */
export function useCoverPalette(imageUrl: string | null, colorCount: number = 3) {
    const [palette, setPalette] = useState<RgbColor[] | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setPalette(null);
            return;
        }

        let cancelled = false;
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const size = 32; // small but enough for palette
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return;

                ctx.drawImage(img, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;

                // Quantize into 5-bit per channel buckets (32 levels) for a compact histogram.
                const buckets = new Map<number, number>();
                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a < 200) continue; // skip mostly transparent

                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Skip near-black and near-white pixels (often borders/backgrounds).
                    const l = (r * 299 + g * 587 + b * 114) / 1000;
                    if (l < 18 || l > 242) continue;

                    const rq = r >> 3;
                    const gq = g >> 3;
                    const bq = b >> 3;
                    const key = (rq << 10) | (gq << 5) | bq;
                    buckets.set(key, (buckets.get(key) || 0) + 1);
                }

                const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
                const picked: RgbColor[] = [];

                // Pick distinct-ish colors (avoid near duplicates)
                const minDist = 40;
                const dist = (c1: RgbColor, c2: RgbColor) =>
                    Math.hypot(c1.r - c2.r, c1.g - c2.g, c1.b - c2.b);

                for (const [key] of sorted) {
                    const rq = (key >> 10) & 31;
                    const gq = (key >> 5) & 31;
                    const bq = key & 31;
                    const c = { r: rq << 3, g: gq << 3, b: bq << 3 };
                    if (picked.every(p => dist(p, c) >= minDist)) {
                        picked.push(c);
                    }
                    if (picked.length >= colorCount) break;
                }

                if (!picked.length) {
                    // Fallback: single-pixel dominant
                    ctx.clearRect(0, 0, size, size);
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                    picked.push({ r, g, b });
                }

                // Ensure a cohesive 3-stop palette: dominant + lighter + darker
                const dominant = picked[0];
                const harmonized = deriveHarmonizedPalette(dominant);

                // If we found a distinct 2nd color, use it as accent instead of derived light.
                if (picked[1]) {
                    harmonized[1] = picked[1];
                }

                // Make sure the "accent" is the brighter one for nicer glow.
                if (luminance(harmonized[1]) < luminance(harmonized[2])) {
                    const tmp = harmonized[1];
                    harmonized[1] = harmonized[2];
                    harmonized[2] = tmp;
                }

                if (!cancelled) setPalette(harmonized.slice(0, colorCount));
            } catch {
                if (!cancelled) setPalette(null);
            }
        };

        img.onerror = () => {
            if (!cancelled) setPalette(null);
        };

        return () => {
            cancelled = true;
        };
    }, [imageUrl, colorCount]);

    const paletteHex = palette?.map(rgbToHex) ?? null;
    return { palette, paletteHex };
}

export function useDominantColor(imageUrl: string | null) {
    const [color, setColor] = useState<RgbColor | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setColor(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.drawImage(img, 0, 0, 1, 1);
                const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                setColor({ r, g, b });
            } catch {
                setColor(null);
            }
        };
    }, [imageUrl]);

    return color;
}
