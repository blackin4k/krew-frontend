import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

interface VisualizerProps {
    className?: string;
    colors?: string[];
    height?: string;
    mode?: 'wave' | 'bar' | 'circle';
}

// ─── Colour helpers ──────────────────────────────────────────────────────────

/** Parse any rgba/rgb/hex string → [r,g,b] (0-255). Falls back to white. */
function parseRGB(c: string): [number, number, number] {
    const rgba = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (rgba) return [+rgba[1], +rgba[2], +rgba[3]];
    const hex = c.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
    return [255, 255, 255];
}

function rgba(r: number, g: number, b: number, a: number) {
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

// ─── Simulated frequency data ────────────────────────────────────────────────

function generateSimulatedData(bufferLength: number, energy: number): Uint8Array {
    const data = new Uint8Array(bufferLength);
    const t = Date.now() / 1000;
    for (let i = 0; i < bufferLength; i++) {
        const norm = i / bufferLength;
        const bassBoost = Math.max(0, 1 - norm * 2.8);
        const w1 = Math.sin(t * 2.1 + i * 0.14) * 0.38;
        const w2 = Math.sin(t * 3.9 + i * 0.07) * 0.26;
        const w3 = Math.sin(t * 1.3 + i * 0.21) * 0.16;
        const w4 = Math.sin(t * 5.7 + i * 0.035) * 0.11;
        const pulse = Math.sin(t * 0.7) * 0.14;
        const combined = 0.42 + w1 + w2 + w3 + w4 + pulse + bassBoost * 0.35;
        data[i] = Math.floor(Math.max(0, Math.min(1, combined)) * 255 * energy);
    }
    return data;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Visualizer({
    className = 'absolute bottom-0 left-0 w-full h-[400px] pointer-events-none z-0',
    colors = ['rgba(180,120,255,0.6)', 'rgba(100,160,255,0.8)', 'rgba(255,100,200,1)'],
    height,
    mode = 'wave',
}: VisualizerProps) {
    const canvasRef            = useRef<HTMLCanvasElement>(null);
    const analyser             = usePlayerStore(s => s.analyser);
    const isPlaying            = usePlayerStore(s => s.isPlaying);
    const performanceMode      = usePlayerStore(s => s.performanceMode);
    const attachVisualizer     = usePlayerStore(s => s.attachVisualizer);
    const detachVisualizer     = usePlayerStore(s => s.detachVisualizer);

    const animRef              = useRef<number>();
    const energyRef            = useRef(0);
    const silentRef            = useRef(0);
    const rawDataRef           = useRef<Uint8Array | null>(null);
    const smoothRef            = useRef<Float32Array | null>(null);
    const lastFrameRef         = useRef(0);
    const visibleRef           = useRef(true);
    // pulse ring state
    const ringsRef             = useRef<{ r: number; a: number; speed: number }[]>([]);
    const lastBassRef          = useRef(0);

    // Register this visualizer so the store wires the AnalyserNode
    useEffect(() => {
        attachVisualizer();
        return () => detachVisualizer();
    }, [attachVisualizer, detachVisualizer]);

    useEffect(() => {
        const isMobile   = performanceMode === 'lite'
            || (typeof window !== 'undefined' && window.matchMedia('(max-width:767px)').matches);
        const frameBudget = performanceMode === 'lite' ? 50 : isMobile ? 33 : 16; // ~20 / 30 / 60 fps
        const dprCap      = isMobile ? 1 : 1.5;
        const waveStep    = isMobile ? 6 : 4;   // % of width between wave samples
        let disposed      = false;

        // Parsed RGB triples for the three colour slots
        const [r0, g0, b0] = parseRGB(colors[0] ?? 'rgba(180,120,255,1)');
        const [r1, g1, b1] = parseRGB(colors[1] ?? 'rgba(100,160,255,1)');
        const [r2, g2, b2] = parseRGB(colors[2] ?? 'rgba(255,100,200,1)');

        const canRender = () => {
            const docVis = typeof document === 'undefined' || document.visibilityState === 'visible';
            return !disposed && visibleRef.current && docVis;
        };

        const schedule = () => {
            if (canRender()) animRef.current = requestAnimationFrame(frame);
            else animRef.current = undefined;
        };

        // ── Main render frame ───────────────────────────────────────────────
        const frame = () => {
            if (!canRender()) { animRef.current = undefined; return; }

            const canvas = canvasRef.current;
            if (!canvas) { schedule(); return; }
            const ctx = canvas.getContext('2d');
            if (!ctx) { schedule(); return; }

            try {
                // Frame-rate cap
                const now = performance.now();
                if (now - lastFrameRef.current < frameBudget) { schedule(); return; }
                lastFrameRef.current = now;

                // Canvas sizing
                const cw = canvas.offsetWidth  || canvas.clientWidth;
                const ch = canvas.offsetHeight || canvas.clientHeight;
                if (!cw || !ch) { schedule(); return; }

                const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
                const pw  = Math.max(1, Math.floor(cw * dpr));
                const ph  = Math.max(1, Math.floor(ch * dpr));
                if (canvas.width !== pw || canvas.height !== ph) {
                    canvas.width  = pw;
                    canvas.height = ph;
                }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const W = cw, H = ch;
                const bufLen = analyser ? analyser.frequencyBinCount : 128;

                // ── Energy envelope ─────────────────────────────────────────
                const targetE  = isPlaying ? 1 : 0;
                const lerpE    = isPlaying ? 0.3 : 0.04;
                energyRef.current += (targetE - energyRef.current) * lerpE;
                const E = energyRef.current;

                if (E < 0.001 && !isPlaying) {
                    ctx.clearRect(0, 0, W, H);
                    schedule();
                    return;
                }

                // ── Get frequency data ──────────────────────────────────────
                let data: Uint8Array;
                if (analyser) {
                    if (!rawDataRef.current || rawDataRef.current.length !== bufLen)
                        rawDataRef.current = new Uint8Array(bufLen);
                    analyser.getByteFrequencyData(rawDataRef.current);
                    const peak = rawDataRef.current.reduce((m, v) => v > m ? v : m, 0);
                    if (peak > 5) { silentRef.current = 0; data = rawDataRef.current; }
                    else {
                        silentRef.current++;
                        data = silentRef.current <= 5
                            ? rawDataRef.current
                            : generateSimulatedData(bufLen, E);
                    }
                } else {
                    data = generateSimulatedData(bufLen, E);
                }

                // ── Smooth frequency data ───────────────────────────────────
                if (!smoothRef.current || smoothRef.current.length !== bufLen)
                    smoothRef.current = new Float32Array(bufLen);
                const sm = smoothRef.current;
                let bassSum = 0, totalSum = 0;
                for (let i = 0; i < bufLen; i++) {
                    sm[i] += (data[i] - sm[i]) * 0.22;
                    totalSum += sm[i];
                    if (i < 8) bassSum += sm[i];
                }
                const bass      = (bassSum / 8) / 255;           // 0-1
                const intensity = (totalSum / bufLen) / 255;      // 0-1
                const bassE     = bass * E;                       // energy-gated bass

                // ── Clear ────────────────────────────────────────────────────
                ctx.clearRect(0, 0, W, H);

                // ════════════════════════════════════════════════════════════
                // WAVE MODE
                // ════════════════════════════════════════════════════════════
                if (mode !== 'bar' && mode !== 'circle') {

                    // Use additive blending for neon glow stacking
                    ctx.globalCompositeOperation = 'lighter';

                    // ── Draw one wave layer ─────────────────────────────────
                    const drawWave = (
                        cr: number, cg: number, cb: number,  // colour
                        yFrac: number,                        // vertical position 0-1 from bottom
                        speed: number,                        // horizontal scroll speed
                        amp: number,                          // amplitude px
                        fillAlpha: number,                    // fill opacity
                        glowAlpha: number,                    // glow/stroke opacity
                        glowSize: number,                     // shadow blur
                    ) => {
                        const baseY = H * (1 - yFrac);
                        const t = now * speed;

                        // Build wave points
                        const pts: [number, number][] = [];
                        const stepPx = Math.max(1, Math.floor(W * waveStep / 100));
                        for (let x = -stepPx; x <= W + stepPx; x += stepPx) {
                            const fi   = Math.floor((x / W) * (bufLen * 0.6));
                            const freq = sm[Math.max(0, Math.min(bufLen - 1, fi))] / 255;
                            const y    = baseY
                                - Math.sin(x * 0.005 + t) * amp * (0.5 + E * 0.5)
                                - Math.sin(x * 0.011 - t * 0.7) * amp * 0.3 * E
                                - freq * amp * 1.6 * E
                                - bassE * amp * 0.9;
                            pts.push([x, y]);
                        }

                        // Smooth catmull-rom path
                        ctx.beginPath();
                        ctx.moveTo(pts[0][0], pts[0][1]);
                        for (let i = 0; i < pts.length - 1; i++) {
                            const mx = (pts[i][0] + pts[i + 1][0]) / 2;
                            const my = (pts[i][1] + pts[i + 1][1]) / 2;
                            ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
                        }
                        // Close path BELOW the canvas — eliminates any hard bottom edge
                        ctx.lineTo(W + stepPx, H + 40);
                        ctx.lineTo(-stepPx, H + 40);
                        ctx.closePath();

                        // Vertical gradient fill: transparent at wave crest → colour at bottom
                        const grad = ctx.createLinearGradient(0, baseY - amp * 2, 0, H + 40);
                        grad.addColorStop(0,   rgba(cr, cg, cb, 0));
                        grad.addColorStop(0.35, rgba(cr, cg, cb, fillAlpha * 0.4 * E));
                        grad.addColorStop(1,   rgba(cr, cg, cb, fillAlpha * E));
                        ctx.fillStyle = grad;

                        // Glow on the stroke edge
                        if (!isMobile && glowSize > 0) {
                            ctx.shadowBlur  = glowSize * (1 + bassE * 1.5);
                            ctx.shadowColor = rgba(cr, cg, cb, glowAlpha);
                        }
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    };

                    if (isMobile) {
                        // 3 layers for mobile — keeps GPU load low
                        drawWave(r0, g0, b0,  0.30, 0.00055, 28 + bassE * 22,  0.55, 0.9,  0);
                        drawWave(r1, g1, b1,  0.20, 0.00110, 22 + bassE * 18,  0.65, 1.0,  0);
                        drawWave(r2, g2, b2,  0.12, 0.00200, 16 + bassE * 14,  0.75, 1.0,  0);
                    } else {
                        // 5 layers for desktop — rich depth
                        drawWave(r0, g0, b0,  0.42, 0.00030, 48 + bassE * 50,  0.40, 0.7, 18);
                        drawWave(r1, g1, b1,  0.32, 0.00060, 40 + bassE * 42,  0.50, 0.9, 22);
                        drawWave(r0, g0, b0,  0.24, 0.00095, 32 + bassE * 34,  0.55, 0.8, 16);
                        drawWave(r2, g2, b2,  0.16, 0.00150, 24 + bassE * 26,  0.65, 1.0, 24);
                        drawWave(r1, g1, b1,  0.09, 0.00240, 16 + bassE * 18,  0.75, 1.0, 20);
                    }

                    // ── Bass-reactive pulse rings ─────────────────────────────
                    if (!isMobile) {
                        // Spawn a new ring on each bass transient
                        if (bassE > 0.45 && bass > lastBassRef.current + 0.12) {
                            ringsRef.current.push({ r: 0, a: 0.5 * E, speed: 1.4 + bass * 2 });
                        }
                        lastBassRef.current = bass;

                        const rings = ringsRef.current;
                        for (let i = rings.length - 1; i >= 0; i--) {
                            const ring = rings[i];
                            ring.r += ring.speed * 2.5;
                            ring.a -= 0.012;
                            if (ring.a <= 0) { rings.splice(i, 1); continue; }

                            const cx = W / 2, cy = H * 0.75;
                            ctx.beginPath();
                            ctx.ellipse(cx, cy, ring.r * 2.2, ring.r * 0.55, 0, 0, Math.PI * 2);
                            ctx.strokeStyle = rgba(r1, g1, b1, ring.a);
                            ctx.lineWidth   = 1.5;
                            ctx.shadowBlur  = 12;
                            ctx.shadowColor = rgba(r1, g1, b1, ring.a * 0.8);
                            ctx.stroke();
                            ctx.shadowBlur  = 0;
                        }
                    }

                    ctx.globalCompositeOperation = 'source-over';

                    // ── Feathered bottom mask ───────────────────────────────
                    // Start the fade from 45% height so the transition is long
                    // and imperceptible — no sharp seam at the gradient origin.
                    // fillRect covers the FULL canvas (0→H) so the transparent
                    // top of the gradient doesn't create a visible cutoff line.
                    const mask = ctx.createLinearGradient(0, H * 0.45, 0, H);
                    mask.addColorStop(0,   'rgba(0,0,0,0)');
                    mask.addColorStop(0.6, 'rgba(0,0,0,0.05)');
                    mask.addColorStop(1,   'rgba(0,0,0,1)');
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = mask;
                    ctx.fillRect(0, 0, W, H);   // full canvas — no seam
                    ctx.globalCompositeOperation = 'source-over';

                    // ── Subtle horizontal shimmer line at wave crest ─────────
                    if (!isMobile && E > 0.3) {
                        const shimmerY = H * (1 - 0.28) - bassE * 40;
                        const sg = ctx.createLinearGradient(0, 0, W, 0);
                        sg.addColorStop(0,    rgba(r2, g2, b2, 0));
                        sg.addColorStop(0.35, rgba(r2, g2, b2, 0.35 * E));
                        sg.addColorStop(0.5,  rgba(r1, g1, b1, 0.65 * E));
                        sg.addColorStop(0.65, rgba(r2, g2, b2, 0.35 * E));
                        sg.addColorStop(1,    rgba(r2, g2, b2, 0));
                        ctx.strokeStyle = sg;
                        ctx.lineWidth   = 1;
                        ctx.shadowBlur  = 10 + bassE * 20;
                        ctx.shadowColor = rgba(r1, g1, b1, 0.8);
                        ctx.beginPath();
                        ctx.moveTo(0, shimmerY);
                        ctx.lineTo(W, shimmerY);
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }

                // ════════════════════════════════════════════════════════════
                // BAR MODE
                // ════════════════════════════════════════════════════════════
                } else if (mode === 'bar') {
                    const bars    = Math.min(bufLen, isMobile ? 48 : 80);
                    const gap     = 2;
                    const barW    = Math.max(2, (W - gap * bars) / bars);
                    ctx.globalCompositeOperation = 'lighter';

                    for (let i = 0; i < bars; i++) {
                        const idx  = Math.floor((i / bars) * bufLen);
                        const val  = sm[idx] / 255;
                        const barH = val * H * 0.85 * E;
                        if (barH < 1) continue;

                        const x = i * (barW + gap);
                        const t = i / bars; // 0→1 across width
                        const cr = Math.round(r0 + (r2 - r0) * t);
                        const cg = Math.round(g0 + (g2 - g0) * t);
                        const cb = Math.round(b0 + (b2 - b0) * t);

                        const grad = ctx.createLinearGradient(0, H - barH, 0, H);
                        grad.addColorStop(0, rgba(cr, cg, cb, 0.9 * E));
                        grad.addColorStop(1, rgba(cr, cg, cb, 0.2 * E));
                        ctx.fillStyle = grad;

                        if (!isMobile) {
                            ctx.shadowBlur  = 8 + val * 14;
                            ctx.shadowColor = rgba(cr, cg, cb, 0.8);
                        }

                        const rx = Math.min(barW / 2, 3);
                        ctx.beginPath();
                        ctx.roundRect(x, H - barH, barW, barH, [rx, rx, 0, 0]);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                    ctx.globalCompositeOperation = 'source-over';

                    // Bottom fade — long gradient, full-canvas fillRect
                    const fade = ctx.createLinearGradient(0, H * 0.55, 0, H);
                    fade.addColorStop(0,   'rgba(0,0,0,0)');
                    fade.addColorStop(0.65, 'rgba(0,0,0,0.05)');
                    fade.addColorStop(1,   'rgba(0,0,0,1)');
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = fade;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';

                // ════════════════════════════════════════════════════════════
                // CIRCLE MODE
                // ════════════════════════════════════════════════════════════
                } else {
                    const cx     = W / 2;
                    const cy     = H / 2;
                    const radius = Math.min(W, H) / 3;
                    const bars   = isMobile ? 48 : 96;
                    const step   = (Math.PI * 2) / bars;

                    ctx.globalCompositeOperation = 'lighter';

                    // Outer glow ring
                    const ringGrad = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.1);
                    ringGrad.addColorStop(0, rgba(r1, g1, b1, 0.0));
                    ringGrad.addColorStop(0.5, rgba(r1, g1, b1, 0.18 * E));
                    ringGrad.addColorStop(1, rgba(r1, g1, b1, 0.0));
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = rgba(r1, g1, b1, 0.2 * E);
                    ctx.lineWidth   = 1;
                    ctx.shadowBlur  = 16;
                    ctx.shadowColor = rgba(r1, g1, b1, 0.6);
                    ctx.stroke();
                    ctx.shadowBlur  = 0;

                    for (let i = 0; i < bars; i++) {
                        const idx  = Math.floor((i / bars) * bufLen);
                        const val  = sm[idx] / 255;
                        const barH = val * radius * 0.85 * E;
                        if (barH < 1) continue;

                        const angle = i * step - Math.PI / 2;
                        const t     = i / bars;
                        const cr    = Math.round(r0 + (r2 - r0) * t);
                        const cg    = Math.round(g0 + (g2 - g0) * t);
                        const cb_   = Math.round(b0 + (b2 - b0) * t);

                        const x1 = cx + Math.cos(angle) * radius;
                        const y1 = cy + Math.sin(angle) * radius;
                        const x2 = cx + Math.cos(angle) * (radius + barH);
                        const y2 = cy + Math.sin(angle) * (radius + barH);

                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.strokeStyle = rgba(cr, cg, cb_, 0.9 * E);
                        ctx.lineWidth   = isMobile ? 2.5 : 2;
                        if (!isMobile) {
                            ctx.shadowBlur  = 6 + val * 12;
                            ctx.shadowColor = rgba(cr, cg, cb_, 0.7);
                        }
                        ctx.stroke();
                    }
                    ctx.shadowBlur = 0;
                    ctx.globalCompositeOperation = 'source-over';
                }

                schedule();
            } catch (e) {
                console.warn('[Visualizer] render error:', e);
                schedule();
            }
        };

        // ── Visibility / intersection ────────────────────────────────────────
        const onVisChange = () => {
            if (!canRender()) {
                if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = undefined; }
                return;
            }
            if (!animRef.current) { lastFrameRef.current = 0; animRef.current = requestAnimationFrame(frame); }
        };

        const observer = typeof IntersectionObserver !== 'undefined' && canvasRef.current
            ? new IntersectionObserver(([e]) => { visibleRef.current = !!e?.isIntersecting; onVisChange(); }, { threshold: 0.05 })
            : null;

        if (canvasRef.current && observer) observer.observe(canvasRef.current);
        if (typeof document !== 'undefined') {
            onVisChange();
            document.addEventListener('visibilitychange', onVisChange);
        } else {
            frame();
        }

        return () => {
            disposed = true;
            observer?.disconnect();
            if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisChange);
            if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = undefined; }
            rawDataRef.current   = null;
            smoothRef.current    = null;
            ringsRef.current     = [];
        };
    }, [analyser, isPlaying, colors, mode, performanceMode]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={height ? { height } : undefined}
        />
    );
}
