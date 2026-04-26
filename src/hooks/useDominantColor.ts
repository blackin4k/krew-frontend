import { useEffect, useState } from 'react';

export type RgbColor = { r: number; g: number; b: number };

type CoverArtworkColors = {
    dominant: RgbColor;
    palette: RgbColor[];
};

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
const colorCache = new Map<string, CoverArtworkColors | null>();
const colorPromiseCache = new Map<string, Promise<CoverArtworkColors | null>>();

async function loadArtworkColors(imageUrl: string, colorCount: number): Promise<CoverArtworkColors | null> {
    const cached = colorCache.get(imageUrl);
    if (cached !== undefined) {
        return cached;
    }

    const existingPromise = colorPromiseCache.get(imageUrl);
    if (existingPromise) {
        return existingPromise;
    }

    const promise = new Promise<CoverArtworkColors | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.decoding = "async";

        const finish = (value: CoverArtworkColors | null) => {
            colorCache.set(imageUrl, value);
            colorPromiseCache.delete(imageUrl);
            resolve(value);
        };

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const size = 32;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    finish(null);
                    return;
                }

                ctx.drawImage(img, 0, 0, size, size);
                const data = ctx.getImageData(0, 0, size, size).data;

                const buckets = new Map<number, number>();
                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a < 200) continue;

                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

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
                    ctx.clearRect(0, 0, size, size);
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                    picked.push({ r, g, b });
                }

                const dominant = picked[0];
                const harmonized = deriveHarmonizedPalette(dominant);

                if (picked[1]) {
                    harmonized[1] = picked[1];
                }

                if (luminance(harmonized[1]) < luminance(harmonized[2])) {
                    const tmp = harmonized[1];
                    harmonized[1] = harmonized[2];
                    harmonized[2] = tmp;
                }

                finish({
                    dominant,
                    palette: harmonized.slice(0, colorCount),
                });
            } catch {
                finish(null);
            }
        };

        img.onerror = () => finish(null);
        img.src = imageUrl;
    });

    colorPromiseCache.set(imageUrl, promise);
    return promise;
}

export function useCoverArtworkColors(imageUrl: string | null, colorCount: number = 3) {
    const [colors, setColors] = useState<CoverArtworkColors | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setColors(null);
            return;
        }

        // Fix: Don't retain the old album's colors while waiting for the new image to load!
        const cached = colorCache.get(imageUrl);
        if (cached !== undefined) {
            setColors(cached);
        } else {
            setColors(null);
        }

        let cancelled = false;
        loadArtworkColors(imageUrl, colorCount).then((nextColors) => {
            if (!cancelled) {
                setColors(nextColors);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [imageUrl, colorCount]);

    const paletteHex = colors?.palette?.map(rgbToHex) ?? null;
    return {
        dominant: colors?.dominant ?? null,
        palette: colors?.palette ?? null,
        paletteHex,
    };
}

export function useCoverPalette(imageUrl: string | null, colorCount: number = 3) {
    const { palette, paletteHex } = useCoverArtworkColors(imageUrl, colorCount);
    return { palette, paletteHex };
}

export function useDominantColor(imageUrl: string | null) {
    return useCoverArtworkColors(imageUrl, 3).dominant;
}
