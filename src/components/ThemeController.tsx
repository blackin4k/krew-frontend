import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { useDominantColor } from '@/hooks/useDominantColor';
import { API_URL } from '@/lib/api';

export default function ThemeController() {
    const currentSong = usePlayerStore((state) => state.currentSong);

    // Reconstruct cover URL (logic matched from Player.tsx)
    const coverUrl = currentSong?.cover
        ? currentSong.cover.startsWith("http")
            ? currentSong.cover
            : `${API_URL}/covers/${currentSong.cover}`
        : null;

    const domColor = useDominantColor(coverUrl);

    useEffect(() => {
        const root = document.documentElement;

        if (domColor) {
            // Convert RGB to HSL for clean CSS variables
            // Simple conversion or just set variable as "r g b" and usage is rgb(var(--primary))? 
            // Tailwind uses <alpha-value> placeholder usually combined with numbers.
            // krew's index.css uses HSL values: --primary: 219 79% 66%;

            const { r, g, b } = domColor;

            // RGB to HSL conversion
            const r_ = r / 255;
            const g_ = g / 255;
            const b_ = b / 255;
            const max = Math.max(r_, g_, b_);
            const min = Math.min(r_, g_, b_);
            let h = 0, s = 0, l = (max + min) / 2;

            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r_: h = (g_ - b_) / d + (g_ < b_ ? 6 : 0); break;
                    case g_: h = (b_ - r_) / d + 2; break;
                    case b_: h = (r_ - g_) / d + 4; break;
                }
                h /= 6;
            }

            const hDeg = Math.round(h * 360);
            const sPct = Math.round(s * 100);
            const lPct = Math.round(Math.max(l * 100, 40)); // Ensure it's not too dark for primary

            const hslString = `${hDeg} ${sPct}% ${lPct}%`;

            root.style.setProperty('--primary', hslString);
            root.style.setProperty('--glow', hslString);
            root.style.setProperty('--sidebar-primary', hslString);
            root.style.setProperty('--ring', hslString);

        } else {
            // Revert to default Krew Blue
            const defaultHSL = '219 79% 66%';
            root.style.setProperty('--primary', defaultHSL);
            root.style.setProperty('--glow', defaultHSL);
            root.style.setProperty('--sidebar-primary', defaultHSL);
            root.style.setProperty('--ring', defaultHSL);
        }

    }, [domColor]);

    // Global background ambient glow
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-1000">
            {/* Dynamic Background Mesh */}
            <div
                className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[120px] opacity-10 transition-colors duration-[2000ms] ease-in-out"
                style={{ background: `hsl(var(--primary))` }}
            />
            <div
                className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] opacity-10 transition-colors duration-[2000ms] ease-in-out"
                style={{ background: `hsl(var(--primary))` }}
            />
        </div>
    );
}
