import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

interface VisualizerProps {
    className?: string;
    colors?: string[];
    height?: string;
    mode?: 'wave' | 'bar' | 'circle';
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseRGB(c: string): [number, number, number] {
    const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    const h = c.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (h) return [parseInt(h[1],16), parseInt(h[2],16), parseInt(h[3],16)];
    return [200, 140, 255];
}

/** Boost colors to ensure they remain vibrant on dark backgrounds */
function boost(r:number,g:number,b:number,factor=1.2):[number,number,number]{
    return [Math.min(255,r*factor)|0, Math.min(255,g*factor)|0, Math.min(255,b*factor)|0];
}

const rc = (r:number,g:number,b:number,a:number) =>
    `rgba(${r|0},${g|0},${b|0},${Math.max(0,Math.min(1,a))})`;

/** Total RGB channel delta above which we snap colors instantly (new song) */
const SNAP_THRESHOLD = 300;

/** Beat detection: bass must jump this much above rolling average to trigger */
const BEAT_THRESHOLD = 0.18;
/** Minimum ms between detected beats to avoid retriggering */
const BEAT_COOLDOWN_MS = 120;

// ── component ─────────────────────────────────────────────────────────────────

export default function Visualizer({
    className = 'absolute bottom-0 left-0 w-full h-[400px] pointer-events-none z-0',
    colors = ['rgba(60,120,200,0.8)', 'rgba(100,180,240,0.9)', 'rgba(40,80,160,1)'],
    height,
    mode = 'wave',
}: VisualizerProps) {
    const canvasRef        = useRef<HTMLCanvasElement>(null);
    const analyser         = usePlayerStore(s => s.analyser);
    const currentSongId    = usePlayerStore(s => s.currentSong?.id ?? null);
    const isPlaying        = usePlayerStore(s => s.isPlaying);
    const performanceMode  = usePlayerStore(s => s.performanceMode);
    const attachVisualizer = usePlayerStore(s => s.attachVisualizer);
    const detachVisualizer = usePlayerStore(s => s.detachVisualizer);

    const animRef      = useRef<number>();
    const analyserRef  = useRef<AnalyserNode|null>(analyser);
    const energyRef    = useRef(0);
    const rawRef       = useRef<Uint8Array|null>(null);
    const smRef        = useRef<Float32Array|null>(null);
    const frameRef     = useRef(0);
    const visRef       = useRef(true);
    
    // For bar mode peaks
    const peaksRef     = useRef<Float32Array|null>(null);

    // Beat detection state (lives in refs to avoid React re-renders)
    const prevBassRef  = useRef(0);       // previous frame's bass level
    const beatRef      = useRef(0);       // current beat intensity (0..1), fast attack / slow decay
    const lastBeatRef  = useRef(0);       // timestamp of last detected beat
    const flashRef     = useRef(0);       // brightness flash intensity (0..1)

    // Refs for dynamic props to avoid restarting the animation loop
    const isPlayingRef = useRef(isPlaying);
    const targetColorsRef = useRef<number[][]>([
        boost(...parseRGB('rgba(60,120,200,0.8)')),
        boost(...parseRGB('rgba(100,180,240,0.9)')),
        boost(...parseRGB('rgba(40,80,160,1)'))
    ]);
    const currentColorsRef = useRef<number[][]>([...targetColorsRef.current.map(c => [...c])]);

    useEffect(() => {
        attachVisualizer();
        return () => detachVisualizer();
    }, [attachVisualizer, detachVisualizer]);

    // Update dynamic refs without triggering full re-renders of the canvas loop
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    // Always update colors when React fires this effect (deps: colors or songId changed)
    useEffect(() => {
        if (!colors || colors.length === 0) return;

        const next = [
            boost(...parseRGB(colors[0] ?? 'rgba(60,120,200,0.8)')),
            boost(...parseRGB(colors[1] ?? 'rgba(100,180,240,0.9)')),
            boost(...parseRGB(colors[2] ?? 'rgba(40,80,160,1)'))
        ];

        const cur = currentColorsRef.current;

        let totalDelta = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                totalDelta += Math.abs(next[i][j] - cur[i][j]);
            }
        }

        targetColorsRef.current = next;

        // snap if big change (new song)
        if (totalDelta > SNAP_THRESHOLD) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    cur[i][j] += (next[i][j] - cur[i][j]) * 0.8;
                }
            }
        }
    }, [colors, currentSongId]);
    useEffect(() => {
        analyserRef.current = analyser;

        const nextBufferLength = analyser?.frequencyBinCount ?? 0;
        rawRef.current = nextBufferLength ? new Uint8Array(nextBufferLength) : null;
        smRef.current = nextBufferLength ? new Float32Array(nextBufferLength) : null;
        peaksRef.current = null;
        energyRef.current = 0;
        frameRef.current = 0;
        // Reset beat state for new song
        prevBassRef.current = 0;
        beatRef.current = 0;
        lastBeatRef.current = 0;
        flashRef.current = 0;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [analyser, currentSongId]);

    useEffect(() => {
        const lite   = performanceMode === 'lite';
        const mob    = lite || (typeof window!=='undefined' && window.matchMedia('(max-width:767px)').matches);
        const budget = lite ? 50 : mob ? 33 : 16;
        const dprCap = mob ? 1 : 1.5;
        let dead     = false;

        const alive = () => !dead && visRef.current
            && (typeof document==='undefined' || document.visibilityState==='visible');

        const go = () => { if (alive()) animRef.current = requestAnimationFrame(tick); };

        const tick = () => {
            if (!alive()) { animRef.current = undefined; return; }
            const canvas = canvasRef.current;
            if (!canvas) { go(); return; }
            const ctx = canvas.getContext('2d');
            if (!ctx)   { go(); return; }

            try {
                const now = performance.now();
                if (now - frameRef.current < budget) { go(); return; }
                frameRef.current = now;

                const cw = canvas.offsetWidth  || canvas.clientWidth;
                const ch = canvas.offsetHeight || canvas.clientHeight;
                if (!cw || !ch) { go(); return; }

                // Manage High-DPI displays while capping on mobile for performance
                const dpr = Math.min(window.devicePixelRatio||1, dprCap);
                const pw  = Math.max(1, Math.floor(cw*dpr));
                const ph  = Math.max(1, Math.floor(ch*dpr));
                if (canvas.width!==pw || canvas.height!==ph) { canvas.width=pw; canvas.height=ph; }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const W = cw, H = ch;
                const liveAnalyser = analyserRef.current;
                const bufLen = liveAnalyser ? liveAnalyser.frequencyBinCount : 128;

                // ── dynamic color interpolation ──────────────────────────────
                const targetColors = targetColorsRef.current;
                const currentColors = currentColorsRef.current;
                for (let i = 0; i < 3; i++) {
                    for (let j = 0; j < 3; j++) {
                        // Smoothly lerp towards target album colors (0.12 = ~20 frames to 90%)
                        currentColors[i][j] += (targetColors[i][j] - currentColors[i][j]) * 0.12;
                    }
                }
                const [r0, g0, b0] = currentColors[0];
                const [r1, g1, b1] = currentColors[1];
                const [r2, g2, b2] = currentColors[2];

                // ── energy envelope ──────────────────────────────────────────
                // Smooth transition in and out of play state
                const currentlyPlaying = isPlayingRef.current;
                energyRef.current += ((currentlyPlaying?1:0) - energyRef.current) * (currentlyPlaying?0.28:0.04);
                const E = energyRef.current;
                
                // Clear and stop rendering if effectively idle
                if (E < 0.001 && !currentlyPlaying) { ctx.clearRect(0,0,W,H); go(); return; }

                // ── frequency data ───────────────────────────────────────────
                let data: Uint8Array;
                if (liveAnalyser) {
                    let raw = rawRef.current;
                    if (!raw || raw.length!==bufLen) {
                        raw = new Uint8Array(bufLen);
                        rawRef.current = raw;
                    }
                    liveAnalyser.getByteFrequencyData(raw as any);
                    data = raw;
                } else {
                    // Graceful fallback if analyser is unavailable
                    data = new Uint8Array(bufLen);
                }

                // ── responsive smoothing ──────────────────────────────────────
                // Single smoothing layer for fast attack and controlled decay
                if (!smRef.current || smRef.current.length!==bufLen) {
                    smRef.current = new Float32Array(bufLen);
                }
                const sm = smRef.current;

                let bassSum=0;
                const bassEnd = Math.floor(bufLen*0.08);

                for (let i=0; i<bufLen; i++) {
                    const v = data[i];
                    // Sharper attack (0.9) to catch transients/kicks instantly, controlled decay
                    const lerpRate = v > sm[i] ? 0.9 : 0.13;
                    sm[i] += (v - sm[i]) * lerpRate;
                    if (i < bassEnd) bassSum += sm[i];
                }
                const bass = (bassSum / bassEnd) / 255;
                // Exaggerate bass for visual punch
                const bassE = bass * bass * E * 1.5;

                // ── beat detection ───────────────────────────────────────────
                const bassDelta = bass - prevBassRef.current;
                prevBassRef.current = bass;

                if (bassDelta > BEAT_THRESHOLD && (now - lastBeatRef.current) > BEAT_COOLDOWN_MS) {
                    // Beat detected! Spike the beat intensity
                    beatRef.current = Math.min(1, beatRef.current + 0.6 + bassDelta * 2);
                    flashRef.current = Math.min(1, 0.5 + bassDelta * 3);
                    lastBeatRef.current = now;
                }
                // Decay beat intensity (fast decay for snappy feel)
                beatRef.current *= 0.88;
                flashRef.current *= 0.82;
                if (beatRef.current < 0.005) beatRef.current = 0;
                if (flashRef.current < 0.005) flashRef.current = 0;

                const beat = beatRef.current;
                const flash = flashRef.current;

                ctx.clearRect(0, 0, W, H);

                // ════════════════════════════════════════════════════════════
                //  WAVE MODE
                // ════════════════════════════════════════════════════════════
                if (mode !== 'bar' && mode !== 'circle') {
                    ctx.globalCompositeOperation = 'lighter';

                    const drawWave = (
                        cr:number,cg:number,cb:number,
                        yFrac:number, speed:number, amp:number,
                        alpha:number, strokeTop:boolean
                    ) => {
                        // Beat-boosted amplitude
                        const beatAmp = amp * (1 + beat * 0.6);
                        const baseY  = H * (1 - yFrac);
                        const T      = now * speed;
                        // Coarser steps on mobile for performance
                        const stepPx = Math.max(1, mob ? Math.ceil(W/40) : Math.ceil(W/80));
                        const pts:[number,number][] = [];

                        for (let x=-stepPx; x<=W+stepPx; x+=stepPx) {
                            // Focus on lower 60% of frequency spectrum where most energy lives
                            const fi = Math.max(0, Math.min(bufLen-1, Math.floor((x/W)*(bufLen*0.60))));
                            const freq = sm[fi] / 255;
                            
                            const y = baseY
                                // Organic sine sway for background movement
                                - Math.sin(x*0.005 + T) * beatAmp * (0.3 + E*0.2)
                                // Audio-reactive displacement (boosted by beat)
                                - freq * beatAmp * 1.5 * E
                                // Bass bump + beat kick
                                - bassE * beatAmp * 1.2
                                // Beat pulse: sharp downward kick
                                - beat * amp * 0.4;
                            
                            pts.push([x, y]);
                        }

                        // Draw filled path
                        ctx.beginPath();
                        ctx.moveTo(pts[0][0], pts[0][1]);
                        for (let i=0; i<pts.length-1; i++) {
                            const mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
                            ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
                        }
                        ctx.lineTo(W+stepPx, H+60);
                        ctx.lineTo(-stepPx,  H+60);
                        ctx.closePath();

                        const topY = pts.reduce((m,p)=>p[1]<m?p[1]:m, H);
                        const grad = ctx.createLinearGradient(0, topY, 0, H+60);
                        // Flash: blend toward white on beats for brightness spike
                        const fr = Math.min(255, cr + flash * (255 - cr));
                        const fg = Math.min(255, cg + flash * (255 - cg));
                        const fb = Math.min(255, cb + flash * (255 - cb));
                        grad.addColorStop(0,   rc(fr,fg,fb, 0));
                        grad.addColorStop(0.3, rc(fr,fg,fb, alpha*0.4*E * (1 + flash*0.5)));
                        grad.addColorStop(1,   rc(fr,fg,fb, alpha*E));
                        
                        ctx.fillStyle = grad;
                        if (!mob) { ctx.shadowBlur = 10 * (1 + bassE + beat*8); ctx.shadowColor = rc(fr,fg,fb,0.8); }
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // Vibrant top stroke for desktop
                        if (strokeTop && !mob && E > 0.1) {
                            ctx.beginPath();
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            for (let i=0; i<pts.length-1; i++) {
                                const mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
                                ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
                            }
                            
                            const sg = ctx.createLinearGradient(0,0,W,0);
                            sg.addColorStop(0,   rc(cr,cg,cb,0));
                            sg.addColorStop(0.5, rc(255,255,255,0.9*E));
                            sg.addColorStop(1,   rc(cr,cg,cb,0));
                            
                            ctx.strokeStyle = sg;
                            ctx.lineWidth = 2;
                            ctx.shadowBlur = 20 + bassE * 20;
                            ctx.shadowColor = rc(cr,cg,cb,1);
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        }
                    };

                    // Reduced layers for cleaner look and better performance
                    if (mob) {
                        drawWave(r0,g0,b0, 0.25, 0.0006, 20+bassE*15, 0.6, false);
                        drawWave(r2,g2,b2, 0.15, 0.0012, 15+bassE*10, 0.8, true);
                    } else {
                        drawWave(r0,g0,b0, 0.35, 0.0004, 30+bassE*25, 0.4, false);
                        drawWave(r1,g1,b1, 0.22, 0.0008, 22+bassE*20, 0.6, false);
                        drawWave(r2,g2,b2, 0.12, 0.0015, 15+bassE*15, 0.8, true);
                    }

                    ctx.globalCompositeOperation = 'source-over';

                    // Bottom fade mask to blend seamlessly
                    const mask = ctx.createLinearGradient(0, H*0.4, 0, H);
                    mask.addColorStop(0, 'rgba(0,0,0,0)');
                    mask.addColorStop(0.5, 'rgba(0,0,0,0.1)');
                    mask.addColorStop(1, 'rgba(0,0,0,1)');
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = mask;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';

                // ════════════════════════════════════════════════════════════
                //  BAR MODE
                // ════════════════════════════════════════════════════════════
                } else if (mode === 'bar') {
                    const bars  = Math.min(bufLen, mob ? 40 : 80);
                    const gap   = mob ? 2 : 3;
                    const barW  = Math.max(2, (W - gap*bars) / bars);

                    if (!peaksRef.current || peaksRef.current.length!==bars) {
                        peaksRef.current = new Float32Array(bars);
                    }

                    ctx.globalCompositeOperation = 'lighter';

                    for (let i=0; i<bars; i++) {
                        const idx  = Math.floor((i/bars)*bufLen);
                        const val  = sm[idx] / 255 * E;
                        // Beat boost: bars punch taller on kicks
                        const barH = val * H * 0.8 * (1 + beat * 0.4);
                        const x    = i * (barW+gap);
                        
                        // Color interpolation across the bars
                        const t  = i / bars;
                        const cr = Math.round(r0+(r2-r0)*t);
                        const cg = Math.round(g0+(g2-g0)*t);
                        const cb = Math.round(b0+(b2-b0)*t);

                        // Peak tracking for smooth dots
                        if (barH >= peaksRef.current[i]) {
                            peaksRef.current[i] = barH;
                        } else {
                            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 1.5);
                        }

                        if (barH < 1 && peaksRef.current[i] < 1) continue;

                        // Draw main bar
                        if (barH >= 1) {
                            const grad = ctx.createLinearGradient(0, H-barH, 0, H);
                            // Flash: brighten bars on beat
                            const br = Math.min(255, cr + flash * (255-cr) * 0.6);
                            const bg_ = Math.min(255, cg + flash * (255-cg) * 0.6);
                            const bb = Math.min(255, cb + flash * (255-cb) * 0.6);
                            grad.addColorStop(0, rc(br,bg_,bb, 0.9 + flash*0.1));
                            grad.addColorStop(1, rc(br,bg_,bb, 0.2));
                            ctx.fillStyle = grad;
                            
                            if (!mob) { ctx.shadowBlur = 10 + val*20; ctx.shadowColor = rc(cr,cg,cb,0.8); }
                            ctx.beginPath();
                            const rx = Math.min(barW/2, 4);
                            ctx.roundRect(x, H-barH, barW, barH, [rx,rx,0,0]);
                            ctx.fill();
                            ctx.shadowBlur = 0;
                        }

                        // Draw peak dot
                        const pk = peaksRef.current[i];
                        if (pk > 2) {
                            ctx.fillStyle = rc(255,255,255, 0.8*E);
                            if (!mob) { ctx.shadowBlur = 8; ctx.shadowColor = rc(cr,cg,cb,1); }
                            ctx.fillRect(x, H-pk-3, barW, 2);
                            ctx.shadowBlur = 0;
                        }
                    }

                    ctx.globalCompositeOperation = 'source-over';
                    
                    // Fade bottom
                    const fade = ctx.createLinearGradient(0, H*0.6, 0, H);
                    fade.addColorStop(0, 'rgba(0,0,0,0)');
                    fade.addColorStop(1, 'rgba(0,0,0,1)');
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = fade;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';

                // ════════════════════════════════════════════════════════════
                //  CIRCLE MODE
                // ════════════════════════════════════════════════════════════
                } else {
                    const cx     = W/2, cy = H/2;
                    const radius = Math.min(W,H) / 3.5;
                    const bars   = mob ? 60 : 100;
                    const step   = (Math.PI*2) / bars;

                    ctx.globalCompositeOperation = 'lighter';

                    // Pulsing core
                    // Beat-reactive pulse: core breathes with kicks
                    const pulseR = radius * (0.6 + bassE * 0.3 + beat * 0.2) * E;
                    const rg = ctx.createRadialGradient(cx,cy,0,cx,cy,pulseR);
                    rg.addColorStop(0,   rc(r0,g0,b0, 0.3*E));
                    rg.addColorStop(0.5, rc(r1,g1,b1, 0.1*E));
                    rg.addColorStop(1,   rc(r0,g0,b0, 0));
                    ctx.fillStyle = rg;
                    ctx.beginPath();
                    ctx.arc(cx, cy, pulseR, 0, Math.PI*2);
                    ctx.fill();

                    // Crisp inner ring
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI*2);
                    ctx.strokeStyle = rc(r1,g1,b1, 0.4*E);
                    ctx.lineWidth = 1.5;
                    if (!mob) { ctx.shadowBlur = 15; ctx.shadowColor = rc(r1,g1,b1,0.8); }
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // Outward reactive bars
                    for (let i=0; i<bars; i++) {
                        const idx   = Math.floor((i/bars)*bufLen);
                        const val   = sm[idx]/255;
                        // Beat kick: bars extend further on detected beats
                        const barH  = val * radius * 1.2 * E * (1 + beat * 0.5);
                        if (barH < 1) continue;

                        const angle = i*step - Math.PI/2;
                        const t     = i/bars;
                        const cr    = Math.round(r0+(r2-r0)*t);
                        const cg    = Math.round(g0+(g2-g0)*t);
                        const cb_   = Math.round(b0+(b2-b0)*t);

                        const x1 = cx+Math.cos(angle)*radius, y1 = cy+Math.sin(angle)*radius;
                        const x2 = cx+Math.cos(angle)*(radius+barH), y2 = cy+Math.sin(angle)*(radius+barH);
                        
                        ctx.beginPath(); 
                        ctx.moveTo(x1,y1); 
                        ctx.lineTo(x2,y2);
                        
                        ctx.strokeStyle = rc(cr,cg,cb_,0.8*E);
                        ctx.lineWidth = mob ? 2 : 2.5;
                        if (!mob) { ctx.shadowBlur = 8 + val*12; ctx.shadowColor = rc(cr,cg,cb_,0.9); }
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                        
                        // Subtle inner mirrored bar
                        const innerH = barH * 0.3;
                        const x3 = cx+Math.cos(angle)*(radius-innerH), y3 = cy+Math.sin(angle)*(radius-innerH);
                        ctx.beginPath(); 
                        ctx.moveTo(x1,y1); 
                        ctx.lineTo(x3,y3);
                        ctx.strokeStyle = rc(cr,cg,cb_, 0.4*E);
                        ctx.lineWidth = mob ? 1 : 1.5;
                        ctx.stroke();
                    }

                    ctx.globalCompositeOperation = 'source-over';
                }

                go();
            } catch(e) {
                console.warn('[Visualizer] Render error:', e);
                go();
            }
        };

        const onVis = () => {
            if (!alive()) { 
                if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current=undefined; }
                return; 
            }
            if (!animRef.current) { 
                frameRef.current = 0; 
                animRef.current = requestAnimationFrame(tick); 
            }
        };

        const obs = typeof IntersectionObserver!=='undefined' && canvasRef.current
            ? new IntersectionObserver(([e])=>{ visRef.current=!!e?.isIntersecting; onVis(); },{threshold:0.05})
            : null;

        if (canvasRef.current && obs) obs.observe(canvasRef.current);
        if (typeof document!=='undefined') {
            onVis();
            document.addEventListener('visibilitychange', onVis);
        } else { 
            tick(); 
        }

        return () => {
            dead = true;
            obs?.disconnect();
            if (typeof document!=='undefined') document.removeEventListener('visibilitychange', onVis);
            if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current=undefined; }
            analyserRef.current = null;
            rawRef.current = null; 
            smRef.current = null;
            peaksRef.current = null;
        };
    // Analyser changes are handled via analyserRef to avoid stale closures in the RAF loop.
    }, [mode, performanceMode]);

    return <canvas ref={canvasRef} className={className} style={height?{height}:undefined} />;
}
