import { useState, useEffect } from 'react';

export function useDominantColor(imageUrl: string | null) {
    const [color, setColor] = useState<{ r: number, g: number, b: number } | null>(null);

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
            } catch (e) {
                console.warn("Error extracting color", e);
                // Fallback or ignore (CORS or other issue)
            }
        };
    }, [imageUrl]);

    return color;
}
