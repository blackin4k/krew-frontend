import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

interface VisualizerProps {
    className?: string;
    colors?: string[];
    height?: string;
    mode?: 'wave' | 'bar' | 'circle';
}

/**
 * Generate simulated frequency data when a real AnalyserNode isn't available.
 * Uses layered sine waves at different speeds/phases to create organic-looking
 * audio-reactive visuals. The energy parameter (0→1) controls amplitude so
 * we can smoothly fade in/out when play state changes.
 */
function generateSimulatedData(bufferLength: number, energy: number): Uint8Array {
    const data = new Uint8Array(bufferLength);
    const t = Date.now() / 1000; // seconds

    for (let i = 0; i < bufferLength; i++) {
        const norm = i / bufferLength; // 0..1

        // Bass emphasis: more energy in low bins
        const bassBoost = Math.max(0, 1 - norm * 2.5);

        // Layered sine waves at different frequencies for organic movement
        const wave1 = Math.sin(t * 2.3 + i * 0.15) * 0.35;
        const wave2 = Math.sin(t * 3.7 + i * 0.08) * 0.25;
        const wave3 = Math.sin(t * 1.1 + i * 0.22) * 0.15;
        const wave4 = Math.sin(t * 5.3 + i * 0.04) * 0.12;
        const pulse = Math.sin(t * 0.8) * 0.13; // slow pulse

        const combined = 0.45 + wave1 + wave2 + wave3 + wave4 + pulse + bassBoost * 0.3;
        const clamped = Math.max(0, Math.min(1, combined));

        data[i] = Math.floor(clamped * 255 * energy);
    }
    return data;
}

export default function Visualizer({
    className = "absolute bottom-0 left-0 w-full h-[400px] pointer-events-none z-0 opacity-90",
    colors = [
        'rgba(255,255,255,0.25)',
        'rgba(255,255,255,0.5)',
        'rgba(255,255,255,0.8)'
    ],
    height,
    mode = 'wave'
}: VisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { analyser, isPlaying } = usePlayerStore();
    const animationRef = useRef<number>();
    const energyRef = useRef(0); // smooth energy for simulated mode
    const silentFramesRef = useRef(0);
    const analyserDataRef = useRef<Uint8Array | null>(null);

    useEffect(() => {
        if (!analyser && !isPlaying) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');

            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            return;
        }

        const renderFrame = () => {
            const canvas = canvasRef.current;
            if (!canvas) {
                animationRef.current = requestAnimationFrame(renderFrame);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                animationRef.current = requestAnimationFrame(renderFrame);
                return;
            }

            try {
                const cssWidth = canvas.offsetWidth || canvas.clientWidth;
                const cssHeight = canvas.offsetHeight || canvas.clientHeight;

                if (!cssWidth || !cssHeight) {
                    animationRef.current = requestAnimationFrame(renderFrame);
                    return;
                }

                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const scaledWidth = Math.max(1, Math.floor(cssWidth * dpr));
                const scaledHeight = Math.max(1, Math.floor(cssHeight * dpr));

                if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
                    canvas.width = scaledWidth;
                    canvas.height = scaledHeight;
                }

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const bufferLength = analyser ? analyser.frequencyBinCount : 128;

                // Prefer the real analyser on Android too. Only fall back to
                // simulated data when the analyser is missing or stays flat.
                let dataArray: Uint8Array;
                if (analyser) {
                    if (!analyserDataRef.current || analyserDataRef.current.length !== bufferLength) {
                        analyserDataRef.current = new Uint8Array(bufferLength);
                    }

                    analyser.getByteFrequencyData(analyserDataRef.current as any);

                    let peak = 0;
                    for (let i = 0; i < analyserDataRef.current.length; i++) {
                        if (analyserDataRef.current[i] > peak) {
                            peak = analyserDataRef.current[i];
                        }
                    }

                    if (peak > 0 || !isPlaying) {
                        silentFramesRef.current = 0;
                        dataArray = analyserDataRef.current;
                    } else {
                        silentFramesRef.current += 1;
                        if (silentFramesRef.current <= 20) {
                            dataArray = analyserDataRef.current;
                        } else {
                            const targetEnergy = isPlaying ? 1 : 0;
                            energyRef.current += (targetEnergy - energyRef.current) * 0.05;
                            dataArray = generateSimulatedData(bufferLength, energyRef.current);
                        }
                    }
                } else {
                    silentFramesRef.current = 0;
                    const targetEnergy = isPlaying ? 1 : 0;
                    energyRef.current += (targetEnergy - energyRef.current) * 0.05;
                    dataArray = generateSimulatedData(bufferLength, energyRef.current);
                }

                const width = cssWidth;
                const height = cssHeight;

                ctx.clearRect(0, 0, width, height);

                if (mode === 'bar') {
                    const barWidth = (width / bufferLength) * 2.5;
                    let barHeight;
                    let x = 0;

                    for (let i = 0; i < bufferLength; i++) {
                        barHeight = (dataArray[i] / 255) * height * 0.8;

                        const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
                        if (colors[2]) {
                            gradient.addColorStop(0, colors[1]); // Top color (lighter)
                            gradient.addColorStop(1, colors[0]); // Bottom color (darker)
                        } else {
                            gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
                            gradient.addColorStop(1, 'rgba(255,255,255,0.1)');
                        }

                        ctx.fillStyle = gradient;
                        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

                        x += barWidth + 1;
                    }
                } else if (mode === 'circle') {
                    // Simple circular visualizer
                    const centerX = width / 2;
                    const centerY = height / 2;
                    const radius = Math.min(width, height) / 2.2;

                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.strokeStyle = colors[0] || 'rgba(255,255,255,0.1)';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Bars around circle
                    const bars = 80; // More bars
                    const step = (Math.PI * 2) / bars;

                    for (let i = 0; i < bars; i++) {
                        const val = dataArray[i * 2] || 0;
                        const barH = (val / 255) * 80; // Taller bars
                        const angle = i * step;

                        const x1 = centerX + Math.cos(angle) * (radius + 5);
                        const y1 = centerY + Math.sin(angle) * (radius + 5);
                        const x2 = centerX + Math.cos(angle) * (radius + 5 + barH);
                        const y2 = centerY + Math.sin(angle) * (radius + 5 + barH);

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = colors[1] || 'white';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }

                } else {
                    // WAVE MODE (Default)
                    const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
                    const scale = bass / 255;

                    // Smooth interpolation (reduce jitter)
                    for (let i = 1; i < dataArray.length; i++) {
                        dataArray[i] = (dataArray[i] + dataArray[i - 1]) / 2;
                    }

                    // Color reacts to intensity
                    const intensity = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    ctx.filter = `brightness(${1 + intensity / 200})`;

                    // Bass reactive zoom + alpha pulse
                    ctx.globalAlpha = 0.6 + scale * 0.6;
                    ctx.save();
                    ctx.translate(width / 2, height / 2);
                    const zoom = 1 + scale * 0.03;
                    ctx.scale(zoom, zoom);
                    ctx.translate(-width / 2, -height / 2);

                    const drawWave = (colorStr: string, offset: number, speed: number, amplitude: number) => {
                        ctx.save();
                        ctx.shadowBlur = 30;
                        ctx.shadowColor = colorStr;

                        ctx.beginPath();
                        ctx.moveTo(0, height);

                        const points: { x: number, y: number }[] = [];

                        for (let i = 0; i <= width + 10; i += 20) {
                            const freqIdx = Math.floor((i / width) * (bufferLength / 2));
                            const smoothData =
                                (dataArray[freqIdx] * 0.6 +
                                    (dataArray[freqIdx - 1] || 0) * 0.2 +
                                    (dataArray[freqIdx + 1] || 0) * 0.2);

                            const waveY = height * (1 - offset)
                                - Math.sin(i * 0.005 + Date.now() * speed) * amplitude
                                - (smoothData * 0.6 * scale * 1.5);

                            points.push({ x: i, y: waveY });
                        }

                        ctx.moveTo(points[0].x, points[0].y);
                        for (let i = 0; i < points.length - 1; i++) {
                            const p0 = points[i];
                            const p1 = points[i + 1];
                            const midX = (p0.x + p1.x) / 2;
                            const midY = (p0.y + p1.y) / 2;
                            ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
                        }

                        ctx.lineTo(width, height + 200);
                        ctx.lineTo(0, height + 200);
                        ctx.closePath();

                        const gradient = ctx.createLinearGradient(0, height * (1 - offset - 0.5), 0, height);
                        if (colorStr.startsWith('rgba')) {
                            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                            if (match) {
                                const [_, r, g, b, a] = match;
                                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.0)`);
                                gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${Number(a) * 0.6})`);
                                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${Number(a)})`);
                            } else {
                                gradient.addColorStop(0, "transparent");
                                gradient.addColorStop(1, colorStr);
                            }
                        } else {
                            gradient.addColorStop(0, "transparent");
                            gradient.addColorStop(1, colorStr);
                        }

                        ctx.fillStyle = gradient;
                        ctx.fill();
                        ctx.restore();
                    };

                    // Motion depth (parallax): add a background wave behind everything
                    drawWave(colors[0], 0.35, 0.0004, 40 + scale * 40);
                    drawWave(colors[0], 0.25, 0.0008, 30 + scale * 30);
                    drawWave(colors[1], 0.18, 0.0015, 25 + scale * 25);
                    drawWave(colors[2], 0.12, 0.0025, 15 + scale * 30);

                    ctx.restore(); // zoom transform
                    ctx.filter = 'none';
                    ctx.globalAlpha = 1;
                }

                // Fade bottom to remove hard edge
                const fade = ctx.createLinearGradient(0, height * 0.5, 0, height);
                fade.addColorStop(0, 'rgba(0,0,0,0)');
                fade.addColorStop(1, 'rgba(0,0,0,1)');

                ctx.fillStyle = fade;
                ctx.fillRect(0, 0, width, height);
                animationRef.current = requestAnimationFrame(renderFrame);
            } catch (e) {
                // Prevent crash if canvas drawing fails due to NaN/Infinity
                console.warn("Visualizer Render Error:", e);
                animationRef.current = requestAnimationFrame(renderFrame);
            }
        };

        renderFrame();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [analyser, isPlaying, colors, mode]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                ...(height ? { height } : {}),
                filter: `drop-shadow(0 0 20px ${colors[2] ? colors[2].replace(/[\d.]+\)$/, '0.3)') : 'rgba(255,255,255,0.3)'})`
            }}
        />
    );
}
