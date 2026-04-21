import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * A hook that provides audio-reactive values (bass, mid, treble, energy)
 * for UI animations. Optimized to reduce re-renders.
 */
export function usePlayerAnimations() {
    const analyser = usePlayerStore((state) => state.analyser);
    const isPlaying = usePlayerStore((state) => state.isPlaying);
    
    // We only update state every ~32ms (approx 30fps) for UI reactivity
    // This is plenty for smooth visual animations while saving main thread work.
    const [stats, setStats] = useState({
        bass: 0,
        mid: 0,
        treble: 0,
        energy: 0,
    });
    
    const lastUpdateRef = useRef(0);
    const animationRef = useRef<number>();
    const dataArrayRef = useRef<Uint8Array | null>(null);

    useEffect(() => {
        if (!analyser || !isPlaying) {
            setStats({ bass: 0, mid: 0, treble: 0, energy: 0 });
            return;
        }

        const bufferLength = analyser.frequencyBinCount;
        if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
            dataArrayRef.current = new Uint8Array(bufferLength);
        }

        const update = (now: number) => {
            // Cap updates to ~30fps to prevent React re-render flooding
            if (now - lastUpdateRef.current < 32) {
                animationRef.current = requestAnimationFrame(update);
                return;
            }
            lastUpdateRef.current = now;

            analyser.getByteFrequencyData(dataArrayRef.current!);
            const data = dataArrayRef.current!;

            let bass = 0;
            let mid = 0;
            let treble = 0;
            let total = 0;

            const bassEnd = Math.floor(bufferLength * 0.1);
            const midEnd = Math.floor(bufferLength * 0.5);

            for (let i = 0; i < bufferLength; i++) {
                const val = data[i] / 255;
                total += val;
                if (i < bassEnd) bass += val;
                else if (i < midEnd) mid += val;
                else treble += val;
            }

            setStats({
                bass: bass / (bassEnd || 1),
                mid: mid / ((midEnd - bassEnd) || 1),
                treble: treble / ((bufferLength - midEnd) || 1),
                energy: total / (bufferLength || 1),
            });

            animationRef.current = requestAnimationFrame(update);
        };

        animationRef.current = requestAnimationFrame(update);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [analyser, isPlaying]);

    return stats;
}
