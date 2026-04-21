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
    const analyser = usePlayerStore((state) => state.analyser);
    const isPlaying = usePlayerStore((state) => state.isPlaying);
    const performanceMode = usePlayerStore((state) => state.performanceMode);
    const attachVisualizer = usePlayerStore((state) => state.attachVisualizer);
    const detachVisualizer = usePlayerStore((state) => state.detachVisualizer);
    const animationRef = useRef<number>();
    const energyRef = useRef(0); // smooth energy for simulated mode
    const silentFramesRef = useRef(0);
    const analyserDataRef = useRef<Uint8Array | null>(null);
    const smoothedDataRef = useRef<Float32Array | null>(null);
    const lastFrameTimeRef = useRef(0);
    const isCanvasVisibleRef = useRef(true);
    const gradientCacheRef = useRef<{
        key: string;
        bar: CanvasGradient | null;
        fade: CanvasGradient | null;
    }>({ key: '', bar: null, fade: null });

    useEffect(() => {
        attachVisualizer();
        return () => detachVisualizer();
    }, [attachVisualizer, detachVisualizer]);

    useEffect(() => {
        const isMobile = performanceMode === 'lite'
            || (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
        
        // 20fps for lite mode, 30fps for mobile, 60fps for desktop
        const frameBudget = performanceMode === 'lite' ? 48 : isMobile ? 32 : 16;
        const dprCap = isMobile ? 1 : 1.5;
        const waveStep = isMobile ? 48 : 32;
        let isDisposed = false;

        const canRender = () => {
            const documentVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
            return !isDisposed && isCanvasVisibleRef.current && documentVisible;
        };

        const scheduleNextFrame = () => {
            if (!canRender()) {
                animationRef.current = undefined;
                return;
            }
            animationRef.current = requestAnimationFrame(renderFrame);
        };

        const renderFrame = () => {
            if (!canRender()) {
                animationRef.current = undefined;
                return;
            }

            const canvas = canvasRef.current;
            if (!canvas) {
                scheduleNextFrame();
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                scheduleNextFrame();
                return;
            }

            try {
                const now = performance.now();
                if (now - lastFrameTimeRef.current < frameBudget) {
                    scheduleNextFrame();
                    return;
                }
                lastFrameTimeRef.current = now;

                const cssWidth = canvas.offsetWidth || canvas.clientWidth;
                const cssHeight = canvas.offsetHeight || canvas.clientHeight;

                if (!cssWidth || !cssHeight) {
                    scheduleNextFrame();
                    return;
                }

                const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
                const scaledWidth = Math.max(1, Math.floor(cssWidth * dpr));
                const scaledHeight = Math.max(1, Math.floor(cssHeight * dpr));

                if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
                    canvas.width = scaledWidth;
                    canvas.height = scaledHeight;
                }

                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const bufferLength = analyser ? analyser.frequencyBinCount : 128;

                // Handle energy state for smooth fading
                const targetEnergy = isPlaying ? 1 : 0;
                // Faster attack when playing, slower decay when pausing
                const lerpFactor = isPlaying ? 0.15 : 0.05;
                energyRef.current += (targetEnergy - energyRef.current) * lerpFactor;

                // If completely silent and no energy, clear and wait
                if (energyRef.current < 0.001 && !isPlaying) {
                    ctx.clearRect(0, 0, cssWidth, cssHeight);
                    scheduleNextFrame();
                    return;
                }

                let dataArray: Uint8Array;
                if (analyser) {
                    if (!analyserDataRef.current || analyserDataRef.current.length !== bufferLength) {
                        analyserDataRef.current = new Uint8Array(bufferLength);
                    }

                    analyser.getByteFrequencyData(analyserDataRef.current as any);

                    let peak = 0;
                    for (let i = 0; i < analyserDataRef.current.length; i++) {
                        if (analyserDataRef.current[i] > peak) peak = analyserDataRef.current[i];
                    }

                    if (peak > 5) { // Small threshold to avoid floor noise
                        silentFramesRef.current = 0;
                        dataArray = analyserDataRef.current;
                    } else {
                        silentFramesRef.current += 1;
                        if (silentFramesRef.current <= 30) {
                            dataArray = analyserDataRef.current;
                        } else {
                            dataArray = generateSimulatedData(bufferLength, energyRef.current);
                        }
                    }
                } else {
                    dataArray = generateSimulatedData(bufferLength, energyRef.current);
                }

                const width = cssWidth;
                const height = cssHeight;
                const cacheKey = `${width}x${height}:${colors.join('|')}`;
                if (gradientCacheRef.current.key !== cacheKey) {
                    const barGradient = ctx.createLinearGradient(0, 0, 0, height);
                    barGradient.addColorStop(0, colors[1] || 'rgba(255,255,255,0.8)');
                    barGradient.addColorStop(1, colors[0] || 'rgba(255,255,255,0.1)');

                    const fadeGradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
                    fadeGradient.addColorStop(0, 'rgba(0,0,0,0)');
                    fadeGradient.addColorStop(1, 'rgba(0,0,0,1)');

                    gradientCacheRef.current = {
                        key: cacheKey,
                        bar: barGradient,
                        fade: fadeGradient,
                    };
                }

                ctx.clearRect(0, 0, width, height);

                if (mode === 'bar') {
                    const barWidth = (width / bufferLength) * 2.5;
                    let x = 0;
                    ctx.fillStyle = gradientCacheRef.current.bar || colors[0];

                    for (let i = 0; i < bufferLength; i++) {
                        const barHeight = (dataArray[i] / 255) * height * 0.8 * energyRef.current;
                        if (barHeight > 0.5) {
                            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                        }
                        x += barWidth + 1;
                    }
                } else if (mode === 'circle') {
                    // Circular visualizer
                    const centerX = width / 2;
                    const centerY = height / 2;
                    const radius = Math.min(width, height) / 2.5;

                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.strokeStyle = colors[0] || 'rgba(255,255,255,0.1)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    const bars = isMobile ? 40 : 80;
                    const step = (Math.PI * 2) / bars;

                    for (let i = 0; i < bars; i++) {
                        const idx = Math.floor((i / bars) * bufferLength);
                        const val = dataArray[idx] || 0;
                        const barH = (val / 255) * (radius * 0.5) * energyRef.current;
                        if (barH < 1) continue;

                        const angle = i * step;
                        const x1 = centerX + Math.cos(angle) * (radius + 2);
                        const y1 = centerY + Math.sin(angle) * (radius + 2);
                        const x2 = centerX + Math.cos(angle) * (radius + 2 + barH);
                        const y2 = centerY + Math.sin(angle) * (radius + 2 + barH);

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = colors[1] || 'white';
                        ctx.lineWidth = isMobile ? 3 : 2;
                        ctx.stroke();
                    }
                } else {
                    // WAVE MODE (Default)
                    if (!smoothedDataRef.current || smoothedDataRef.current.length !== dataArray.length) {
                        smoothedDataRef.current = new Float32Array(dataArray.length);
                    }
                    const smoothedData = smoothedDataRef.current;

                    let bassTotal = 0;
                    let intensityTotal = 0;
                    const sampleCount = Math.min(dataArray.length, 32);
                    for (let i = 0; i < dataArray.length; i++) {
                        const nextValue = smoothedData[i] + (dataArray[i] - smoothedData[i]) * 0.25;
                        smoothedData[i] = nextValue;
                        intensityTotal += nextValue;
                        if (i < 10) bassTotal += nextValue;
                    }

                    const bass = bassTotal / 10;
                    const scale = (bass / 255) * energyRef.current;
                    const intensity = (intensityTotal / dataArray.length) / 255;

                    // Reactive zoom + alpha pulse
                    ctx.globalAlpha = (0.4 + intensity * 0.6) * energyRef.current;
                    ctx.save();
                    ctx.translate(width / 2, height / 2);
                    const zoom = 1 + scale * 0.05;
                    ctx.scale(zoom, zoom);
                    ctx.translate(-width / 2, -height / 2);

                    const drawWave = (colorStr: string, offset: number, speed: number, amplitude: number) => {
                        ctx.save();
                        
                        // ONLY use shadowBlur on Desktop - it's a mobile performance killer
                        if (!isMobile) {
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = colorStr;
                        }

                        ctx.beginPath();
                        ctx.moveTo(0, height);

                        const points: { x: number, y: number }[] = [];
                        const time = now * speed;

                        for (let i = 0; i <= width + waveStep; i += waveStep) {
                            const freqIdx = Math.floor((i / width) * (bufferLength / 2.5));
                            const smoothValue = smoothedData[freqIdx] || 0;

                            const waveY = height * (1 - offset)
                                - Math.sin(i * 0.004 + time) * amplitude * (0.5 + energyRef.current * 0.5)
                                - (smoothValue * 0.5 * scale * (height / 200));

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

                        ctx.lineTo(width, height + 100);
                        ctx.lineTo(0, height + 100);
                        ctx.closePath();

                        const gradient = ctx.createLinearGradient(0, height * (1 - offset - 0.3), 0, height);
                        if (colorStr.startsWith('rgba')) {
                            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
                            if (match) {
                                const [_, r, g, b, a] = match;
                                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.0)`);
                                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${Number(a) * energyRef.current})`);
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

                    const waveLayers = isMobile
                        ? [
                            [colors[0], 0.25, 0.0006, 20 + scale * 30],
                            [colors[1], 0.15, 0.0012, 15 + scale * 25],
                            [colors[2], 0.08, 0.0020, 10 + scale * 20],
                        ]
                        : [
                            [colors[0], 0.35, 0.0003, 40 + scale * 40],
                            [colors[0], 0.25, 0.0007, 30 + scale * 30],
                            [colors[1], 0.18, 0.0012, 25 + scale * 25],
                            [colors[2], 0.12, 0.0022, 15 + scale * 30],
                        ];

                    for (const [color, offset, speed, amplitude] of waveLayers) {
                        drawWave(color as string, offset as number, speed as number, amplitude as number);
                    }

                    ctx.restore();
                    ctx.globalAlpha = 1;
                }

                // Fade bottom edge
                ctx.fillStyle = gradientCacheRef.current.fade || 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, height * 0.7, width, height * 0.3);
                
                scheduleNextFrame();
            } catch (e) {
                console.warn("Visualizer Render Error:", e);
                scheduleNextFrame();
            }
        };

        const handleVisibilityChange = () => {
            if (!canRender()) {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                    animationRef.current = undefined;
                }
                return;
            }

            if (!animationRef.current) {
                lastFrameTimeRef.current = 0;
                animationRef.current = requestAnimationFrame(renderFrame);
            }
        };

        const observer = typeof IntersectionObserver !== 'undefined' && canvasRef.current
            ? new IntersectionObserver(([entry]) => {
                isCanvasVisibleRef.current = !!entry?.isIntersecting;
                handleVisibilityChange();
            }, { threshold: 0.05 })
            : null;

        if (canvasRef.current && observer) {
            observer.observe(canvasRef.current);
        }

        if (typeof document !== 'undefined') {
            handleVisibilityChange();
            document.addEventListener('visibilitychange', handleVisibilityChange);
        } else {
            renderFrame();
        }

        return () => {
            isDisposed = true;
            observer?.disconnect();
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = undefined;
            }
            analyserDataRef.current = null;
            smoothedDataRef.current = null;
        };
    }, [analyser, isPlaying, colors, mode, performanceMode]);

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
