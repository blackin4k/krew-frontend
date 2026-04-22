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

/** Boost dim palette colours so they pop on dark backgrounds */
function boost(r:number,g:number,b:number,factor=1.35):[number,number,number]{
    return [Math.min(255,r*factor)|0, Math.min(255,g*factor)|0, Math.min(255,b*factor)|0];
}

const rc = (r:number,g:number,b:number,a:number) =>
    `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;

// ── simulated fallback ────────────────────────────────────────────────────────

function simData(len: number, E: number): Uint8Array {
    const d = new Uint8Array(len);
    const t = Date.now() / 1000;
    for (let i = 0; i < len; i++) {
        const n = i / len;
        const bass = Math.max(0, 1 - n * 3) * (0.5 + 0.5 * Math.abs(Math.sin(t * 1.1)));
        const v = 0.38
            + Math.sin(t * 2.0 + i * 0.13) * 0.28
            + Math.sin(t * 3.8 + i * 0.07) * 0.18
            + Math.sin(t * 1.2 + i * 0.20) * 0.12
            + bass * 0.4;
        d[i] = Math.floor(Math.max(0, Math.min(1, v)) * 255 * E);
    }
    return d;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Visualizer({
    className = 'absolute bottom-0 left-0 w-full h-[400px] pointer-events-none z-0',
    colors = ['rgba(180,100,255,1)', 'rgba(80,150,255,1)', 'rgba(255,80,180,1)'],
    height,
    mode = 'wave',
}: VisualizerProps) {
    const canvasRef        = useRef<HTMLCanvasElement>(null);
    const analyser         = usePlayerStore(s => s.analyser);
    const isPlaying        = usePlayerStore(s => s.isPlaying);
    const performanceMode  = usePlayerStore(s => s.performanceMode);
    const attachVisualizer = usePlayerStore(s => s.attachVisualizer);
    const detachVisualizer = usePlayerStore(s => s.detachVisualizer);

    const animRef      = useRef<number>();
    const energyRef    = useRef(0);
    const silentRef    = useRef(0);
    const rawRef       = useRef<Uint8Array|null>(null);
    const smRef        = useRef<Float32Array|null>(null);
    // separate fast (attack) and slow (release) smoothed buffers for snappy reactivity
    const smFastRef    = useRef<Float32Array|null>(null);
    const frameRef     = useRef(0);
    const visRef       = useRef(true);
    const ringsRef     = useRef<{r:number;a:number;spd:number}[]>([]);
    const lastBassRef  = useRef(0);
    // peak hold for bar mode
    const peaksRef     = useRef<Float32Array|null>(null);
    const peakHoldRef  = useRef<Float32Array|null>(null);

    useEffect(() => {
        attachVisualizer();
        return () => detachVisualizer();
    }, [attachVisualizer, detachVisualizer]);

    useEffect(() => {
        const lite   = performanceMode === 'lite';
        const mob    = lite || (typeof window!=='undefined' && window.matchMedia('(max-width:767px)').matches);
        const budget = lite ? 50 : mob ? 33 : 16;
        const dprCap = mob ? 1 : 1.5;
        let dead     = false;

        // Boost colours so they're vivid on dark backgrounds
        const [r0,g0,b0] = boost(...parseRGB(colors[0] ?? 'rgba(180,100,255,1)'));
        const [r1,g1,b1] = boost(...parseRGB(colors[1] ?? 'rgba(80,150,255,1)'));
        const [r2,g2,b2] = boost(...parseRGB(colors[2] ?? 'rgba(255,80,180,1)'));

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

                const dpr = Math.min(window.devicePixelRatio||1, dprCap);
                const pw  = Math.max(1, Math.floor(cw*dpr));
                const ph  = Math.max(1, Math.floor(ch*dpr));
                if (canvas.width!==pw || canvas.height!==ph) { canvas.width=pw; canvas.height=ph; }
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                const W = cw, H = ch;
                const bufLen = analyser ? analyser.frequencyBinCount : 128;

                // ── energy envelope ──────────────────────────────────────────
                energyRef.current += ((isPlaying?1:0) - energyRef.current) * (isPlaying?0.28:0.04);
                const E = energyRef.current;
                if (E < 0.001 && !isPlaying) { ctx.clearRect(0,0,W,H); go(); return; }

                // ── frequency data ───────────────────────────────────────────
                let data: Uint8Array;
                if (analyser) {
                    if (!rawRef.current || rawRef.current.length!==bufLen)
                        rawRef.current = new Uint8Array(bufLen);
                    analyser.getByteFrequencyData(rawRef.current as Uint8Array<ArrayBuffer>);
                    const peak = rawRef.current.reduce((m,v)=>v>m?v:m,0);
                    if (peak>5) { silentRef.current=0; data=rawRef.current; }
                    else { silentRef.current++; data=silentRef.current<=5?rawRef.current:simData(bufLen,E); }
                } else { data=simData(bufLen,E); }

                // ── dual-rate smoothing (snappy attack, smooth release) ───────
                if (!smRef.current || smRef.current.length!==bufLen) {
                    smRef.current     = new Float32Array(bufLen);
                    smFastRef.current = new Float32Array(bufLen);
                }
                const sm     = smRef.current!;
                const smFast = smFastRef.current!;

                let bassSum=0, midSum=0, highSum=0;
                const bassEnd = Math.floor(bufLen*0.08);
                const midEnd  = Math.floor(bufLen*0.4);

                for (let i=0; i<bufLen; i++) {
                    const v = data[i];
                    // fast buffer for attack (0.4), slow for release (0.12)
                    const lerpRate = v > smFast[i] ? 0.4 : 0.12;
                    smFast[i] += (v - smFast[i]) * lerpRate;
                    // slower global smooth for wave shapes
                    sm[i]     += (v - sm[i]) * 0.18;
                    if (i < bassEnd)       bassSum  += smFast[i];
                    else if (i < midEnd)   midSum   += smFast[i];
                    else                   highSum  += smFast[i];
                }
                const bass  = (bassSum / bassEnd) / 255;
                const mid   = (midSum  / (midEnd-bassEnd)) / 255;
                const bassE = bass * E;
                const midE  = mid  * E;

                ctx.clearRect(0, 0, W, H);

                // ════════════════════════════════════════════════════════════
                //  WAVE MODE
                // ════════════════════════════════════════════════════════════
                if (mode !== 'bar' && mode !== 'circle') {

                    ctx.globalCompositeOperation = 'lighter';

                    /** Build a smooth wave path and return the lowest Y reached */
                    const drawWave = (
                        cr:number,cg:number,cb:number,
                        yFrac:number, speed:number, amp:number,
                        alpha:number, blur:number,
                        strokeTop:boolean
                    ) => {
                        const baseY  = H * (1 - yFrac);
                        const T      = now * speed;
                        const stepPx = Math.max(1, mob ? Math.ceil(W/40) : Math.ceil(W/70));
                        const pts:[number,number][] = [];

                        for (let x=-stepPx; x<=W+stepPx; x+=stepPx) {
                            const fi   = Math.max(0, Math.min(bufLen-1, Math.floor((x/W)*(bufLen*0.55))));
                            const freq = sm[fi] / 255;
                            const y    = baseY
                                - Math.sin(x*0.0048 + T)          * amp * (0.5 + E*0.5)
                                - Math.sin(x*0.0110 - T*0.65)     * amp * 0.28 * E
                                - Math.sin(x*0.0022 + T*0.3)      * amp * 0.18 * midE
                                - freq * amp * 1.8 * E
                                - bassE * amp * 1.1;
                            pts.push([x, y]);
                        }

                        // ── filled body ──
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
                        grad.addColorStop(0,   rc(cr,cg,cb, 0));
                        grad.addColorStop(0.2, rc(cr,cg,cb, alpha*0.35*E));
                        grad.addColorStop(1,   rc(cr,cg,cb, alpha*E));
                        ctx.fillStyle = grad;
                        if (!mob && blur>0) { ctx.shadowBlur=blur*(1+bassE); ctx.shadowColor=rc(cr,cg,cb,0.9); }
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // ── bright crest line (desktop only) ──
                        if (strokeTop && !mob && E > 0.15) {
                            ctx.beginPath();
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            for (let i=0; i<pts.length-1; i++) {
                                const mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
                                ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
                            }
                            const sg = ctx.createLinearGradient(0,0,W,0);
                            sg.addColorStop(0,   rc(cr,cg,cb,0));
                            sg.addColorStop(0.3, rc(cr,cg,cb,0.8*E));
                            sg.addColorStop(0.5, rc(255,255,255,0.9*E));
                            sg.addColorStop(0.7, rc(cr,cg,cb,0.8*E));
                            sg.addColorStop(1,   rc(cr,cg,cb,0));
                            ctx.strokeStyle   = sg;
                            ctx.lineWidth     = 1.5;
                            ctx.shadowBlur    = 18 + bassE*20;
                            ctx.shadowColor   = rc(cr,cg,cb,1);
                            ctx.stroke();
                            ctx.shadowBlur    = 0;
                        }
                    };

                    if (mob) {
                        drawWave(r0,g0,b0,  0.32, 0.00050, 30+bassE*28,  0.60, 0,  false);
                        drawWave(r1,g1,b1,  0.20, 0.00105, 24+bassE*22,  0.70, 0,  false);
                        drawWave(r2,g2,b2,  0.11, 0.00200, 18+bassE*16,  0.80, 0,  true);
                    } else {
                        drawWave(r0,g0,b0,  0.44, 0.00028, 52+bassE*55,  0.42, 14, false);
                        drawWave(r1,g1,b1,  0.34, 0.00058, 44+bassE*46,  0.52, 18, false);
                        drawWave(r0,g0,b0,  0.25, 0.00092, 36+bassE*38,  0.58, 14, false);
                        drawWave(r2,g2,b2,  0.17, 0.00148, 28+bassE*30,  0.68, 22, false);
                        drawWave(r1,g1,b1,  0.09, 0.00238, 20+bassE*22,  0.78, 18, true);
                    }

                    // ── pulse rings on bass transients ──
                    if (!mob) {
                        if (bassE > 0.42 && bass > lastBassRef.current + 0.10)
                            ringsRef.current.push({ r:0, a:0.55*E, spd:1.5+bass*2.2 });
                        lastBassRef.current = bass;
                        for (let i=ringsRef.current.length-1; i>=0; i--) {
                            const ring = ringsRef.current[i];
                            ring.r  += ring.spd * 3;
                            ring.a  -= 0.013;
                            if (ring.a<=0) { ringsRef.current.splice(i,1); continue; }
                            const cx=W/2, cy=H*0.78;
                            ctx.beginPath();
                            ctx.ellipse(cx, cy, ring.r*2.4, ring.r*0.5, 0, 0, Math.PI*2);
                            ctx.strokeStyle = rc(r1,g1,b1, ring.a);
                            ctx.lineWidth   = 1.5;
                            ctx.shadowBlur  = 14;
                            ctx.shadowColor = rc(r1,g1,b1, ring.a*0.7);
                            ctx.stroke();
                            ctx.shadowBlur  = 0;
                        }
                    }

                    ctx.globalCompositeOperation = 'source-over';

                    // ── fade mask: long gradient, full-canvas rect ──
                    const mask = ctx.createLinearGradient(0, H*0.38, 0, H);
                    mask.addColorStop(0,    'rgba(0,0,0,0)');
                    mask.addColorStop(0.55, 'rgba(0,0,0,0.04)');
                    mask.addColorStop(1,    'rgba(0,0,0,1)');
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = mask;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';

                // ════════════════════════════════════════════════════════════
                //  BAR MODE
                // ════════════════════════════════════════════════════════════
                } else if (mode === 'bar') {
                    const bars  = Math.min(bufLen, mob ? 48 : 80);
                    const gap   = 2;
                    const barW  = Math.max(2, (W - gap*bars) / bars);

                    // init peak holders
                    if (!peaksRef.current || peaksRef.current.length!==bars) {
                        peaksRef.current    = new Float32Array(bars);
                        peakHoldRef.current = new Float32Array(bars); // hold timer
                    }

                    ctx.globalCompositeOperation = 'lighter';

                    for (let i=0; i<bars; i++) {
                        const idx  = Math.floor((i/bars)*bufLen);
                        const val  = smFast[idx] / 255 * E;
                        const barH = val * H * 0.82;
                        const x    = i * (barW+gap);
                        const t    = i / bars;
                        const cr   = Math.round(r0+(r2-r0)*t);
                        const cg   = Math.round(g0+(g2-g0)*t);
                        const cb   = Math.round(b0+(b2-b0)*t);

                        if (barH < 1) { peakHoldRef.current![i] = 0; peaksRef.current![i] *= 0.94; }
                        else {
                            if (barH >= peaksRef.current![i]) {
                                peaksRef.current![i]    = barH;
                                peakHoldRef.current![i] = 18; // hold N frames
                            } else {
                                if (peakHoldRef.current![i] > 0) peakHoldRef.current![i]--;
                                else peaksRef.current![i] = Math.max(0, peaksRef.current![i] - 2.5);
                            }
                        }

                        if (barH < 1) continue;

                        // bar fill
                        const grad = ctx.createLinearGradient(0, H-barH, 0, H);
                        grad.addColorStop(0, rc(cr,cg,cb, 0.95));
                        grad.addColorStop(1, rc(cr,cg,cb, 0.18));
                        ctx.fillStyle = grad;
                        if (!mob) { ctx.shadowBlur=8+val*18; ctx.shadowColor=rc(cr,cg,cb,0.9); }
                        ctx.beginPath();
                        const rx = Math.min(barW/2, 3);
                        ctx.roundRect(x, H-barH, barW, barH, [rx,rx,0,0]);
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // peak dot
                        const pk = peaksRef.current![i];
                        if (pk > 2) {
                            ctx.fillStyle = rc(255,255,255, 0.75*E);
                            if (!mob) { ctx.shadowBlur=6; ctx.shadowColor=rc(cr,cg,cb,1); }
                            ctx.fillRect(x, H-pk-2, barW, 2);
                            ctx.shadowBlur = 0;
                        }
                    }

                    ctx.shadowBlur = 0;
                    ctx.globalCompositeOperation = 'source-over';

                    const fade = ctx.createLinearGradient(0, H*0.5, 0, H);
                    fade.addColorStop(0,   'rgba(0,0,0,0)');
                    fade.addColorStop(0.7, 'rgba(0,0,0,0.06)');
                    fade.addColorStop(1,   'rgba(0,0,0,1)');
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = fade;
                    ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';

                // ════════════════════════════════════════════════════════════
                //  CIRCLE MODE
                // ════════════════════════════════════════════════════════════
                } else {
                    const cx     = W/2, cy = H/2;
                    const radius = Math.min(W,H) / 3.2;
                    const bars   = mob ? 48 : 96;
                    const step   = (Math.PI*2) / bars;

                    ctx.globalCompositeOperation = 'lighter';

                    // ── pulsing inner circle ──
                    const pulseR = radius * (0.55 + bassE * 0.28) * E;
                    const rg = ctx.createRadialGradient(cx,cy,0,cx,cy,pulseR);
                    rg.addColorStop(0,   rc(r0,g0,b0, 0.22*E));
                    rg.addColorStop(0.6, rc(r1,g1,b1, 0.10*E));
                    rg.addColorStop(1,   rc(r0,g0,b0, 0));
                    ctx.fillStyle = rg;
                    ctx.beginPath();
                    ctx.arc(cx, cy, pulseR, 0, Math.PI*2);
                    ctx.fill();

                    // ── base ring ──
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI*2);
                    ctx.strokeStyle = rc(r1,g1,b1, 0.25*E);
                    ctx.lineWidth   = 1;
                    if (!mob) { ctx.shadowBlur=12; ctx.shadowColor=rc(r1,g1,b1,0.7); }
                    ctx.stroke();
                    ctx.shadowBlur = 0;

                    // ── bars outward + inward mirror ──
                    for (let i=0; i<bars; i++) {
                        const idx   = Math.floor((i/bars)*bufLen);
                        const val   = smFast[idx]/255;
                        const barH  = val * radius * 0.9 * E;
                        if (barH < 1) continue;

                        const angle = i*step - Math.PI/2;
                        const t     = i/bars;
                        const cr    = Math.round(r0+(r2-r0)*t);
                        const cg    = Math.round(g0+(g2-g0)*t);
                        const cb_   = Math.round(b0+(b2-b0)*t);

                        // outer bar
                        const x1=cx+Math.cos(angle)*radius,     y1=cy+Math.sin(angle)*radius;
                        const x2=cx+Math.cos(angle)*(radius+barH), y2=cy+Math.sin(angle)*(radius+barH);
                        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
                        ctx.strokeStyle = rc(cr,cg,cb_,0.9*E);
                        ctx.lineWidth   = mob ? 2.5 : 2;
                        if (!mob) { ctx.shadowBlur=6+val*14; ctx.shadowColor=rc(cr,cg,cb_,0.8); }
                        ctx.stroke();

                        // inner mirror (half height)
                        const innerH = barH * 0.45;
                        const x3=cx+Math.cos(angle)*(radius-innerH), y3=cy+Math.sin(angle)*(radius-innerH);
                        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x3,y3);
                        ctx.strokeStyle = rc(cr,cg,cb_, 0.35*E);
                        ctx.lineWidth   = mob ? 1.5 : 1;
                        ctx.stroke();
                        ctx.shadowBlur  = 0;
                    }

                    ctx.shadowBlur = 0;
                    ctx.globalCompositeOperation = 'source-over';
                }

                go();
            } catch(e) {
                console.warn('[Visualizer]', e);
                go();
            }
        };

        const onVis = () => {
            if (!alive()) { if(animRef.current){cancelAnimationFrame(animRef.current);animRef.current=undefined;} return; }
            if (!animRef.current) { frameRef.current=0; animRef.current=requestAnimationFrame(tick); }
        };

        const obs = typeof IntersectionObserver!=='undefined' && canvasRef.current
            ? new IntersectionObserver(([e])=>{ visRef.current=!!e?.isIntersecting; onVis(); },{threshold:0.05})
            : null;

        if (canvasRef.current && obs) obs.observe(canvasRef.current);
        if (typeof document!=='undefined') {
            onVis();
            document.addEventListener('visibilitychange', onVis);
        } else { tick(); }

        return () => {
            dead = true;
            obs?.disconnect();
            if (typeof document!=='undefined') document.removeEventListener('visibilitychange', onVis);
            if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current=undefined; }
            rawRef.current=null; smRef.current=null; smFastRef.current=null;
            peaksRef.current=null; peakHoldRef.current=null; ringsRef.current=[];
        };
    }, [analyser, isPlaying, colors, mode, performanceMode]);

    return <canvas ref={canvasRef} className={className} style={height?{height}:undefined} />;
}
