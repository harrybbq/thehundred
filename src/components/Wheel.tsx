// The punishment wheel (canvas) — ported from v1. The server decides where it
// lands; this component just animates to a given segment with a realistic
// ease-out and ticking sound. Jester graffiti segments are scrawled in marker.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { WheelSeg } from '../lib/types';
import { Sound } from '../fx/sound';
import { rand } from '../lib/util';
import { restartAnim } from '../fx/effects';

export interface WheelHandle { spinTo(idx: number, ms?: number): Promise<void> }

// Inks from the design: worn enamel panels, dark or bone lettering.
const PANELS: [string, string][] = [['#c9861f', '#0d0b09'], ['#1d4d52', '#f1e8d4'], ['#8e2a1a', '#f1e8d4'], ['#3a4a50', '#f1e8d4'], ['#b3601a', '#0d0b09'], ['#d8ccb0', '#0d0b09']];
const TAU = Math.PI * 2;
const S = 1400;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []; let cur = '';
  for (const w of text.split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}
function panel(seg: WheelSeg, i: number, n: number): [string, string] {
  const t = seg.text.toUpperCase();
  if (seg.graffiti) return ['#141a1d', '#ffd84a'];
  if (/^SAFE|SKIP|NOTHING/.test(t)) return ['#d8ccb0', '#0d0b09'];
  if (/SPIN AGAIN/.test(t)) return ['#b3601a', '#0d0b09'];
  let k = i % 5;
  if (i === n - 1 && n % 5 === 1) k = 2;
  return PANELS[k];
}
function draw(cv: HTMLCanvasElement, segs: WheelSeg[]) {
  const ctx = cv.getContext('2d')!, C = S / 2, n = Math.max(1, segs.length), a = TAU / n;
  const k = C / 512, R = 446 * k;                 // design units → canvas
  ctx.clearRect(0, 0, S, S);
  ctx.save(); ctx.translate(C, C);
  // gunmetal rim + rivets
  const rg = ctx.createRadialGradient(0, 0, R, 0, 0, 510 * k);
  rg.addColorStop(0, '#0b0e10'); rg.addColorStop(0.35, '#3a464c'); rg.addColorStop(0.7, '#1a2226'); rg.addColorStop(1, '#0b0e10');
  ctx.beginPath(); ctx.arc(0, 0, 510 * k, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const t = (i * 9 + 4.5) * Math.PI / 180;
    ctx.beginPath(); ctx.arc(Math.cos(t) * 496 * k, Math.sin(t) * 496 * k, 5 * k, 0, TAU);
    ctx.fillStyle = '#6b7a80'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
  }
  segs.forEach((seg, i) => {
    const start = -Math.PI / 2 + i * a;
    const [fill, ink] = panel(seg, i, n);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, start, start + a); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.save(); ctx.clip();                        // wear: vignette + scuffs
    const g = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    for (let q = 0; q < 90; q++) { const rr = rand(R * 0.2, R), th = start + rand(0, a); ctx.fillStyle = seg.graffiti ? `rgba(255,216,74,${rand(0.04, 0.2)})` : `rgba(0,0,0,${rand(0.04, 0.14)})`; ctx.fillRect(Math.cos(th) * rr, Math.sin(th) * rr, rand(2, 6), 2); }
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = '#07090b'; ctx.stroke();
    // text along the radius
    ctx.save(); ctx.rotate(start + a / 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
    const font = seg.graffiti ? "'Permanent Marker', cursive" : "'Big Shoulders Display', Impact, sans-serif";
    const text = seg.graffiti ? seg.text : seg.text.toUpperCase();
    const outer = R * 0.93, maxW = R * 0.66;
    let fs = R * 0.105, lines: string[] = [];
    for (; fs > R * 0.028; fs -= 2) {
      ctx.font = `${seg.graffiti ? 400 : 900} ${fs}px ${font}`;
      lines = wrap(ctx, text, maxW);
      const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
      const room = 2 * Math.max(outer - widest, R * 0.2) * Math.sin(a / 2) * 0.9;
      if (lines.length <= 3 && widest <= maxW && lines.length * fs * 1.0 <= room) break;
    }
    if (seg.graffiti) { ctx.rotate(-0.05); ctx.shadowColor = 'rgba(255,216,74,.6)'; ctx.shadowBlur = 12; }
    lines.forEach((ln, j) => ctx.fillText(ln, outer, (j - (lines.length - 1) / 2) * fs * 1.0));
    ctx.restore();
  });
  ctx.restore();
}

/** Marquee bulbs live in their own layer so they can chase while spinning. */
function Bulbs({ mode }: { mode: 'on' | 'off' | 'chase' }) {
  return (
    <svg className={'wheel-bulbs ' + mode} viewBox="-512 -512 1024 1024">
      {Array.from({ length: 30 }, (_, i) => {
        const t = i * 12 * Math.PI / 180, dead = i % 7 === 3;
        return <circle key={i} className={dead ? 'dead' : i % 3 === 0 ? 'b0' : i % 2 ? 'b1' : 'b2'} cx={Math.cos(t) * 476} cy={Math.sin(t) * 476} r={9} />;
      })}
    </svg>
  );
}

export const Wheel = forwardRef<WheelHandle, { segments: WheelSeg[]; dim?: boolean; bulbs?: 'on' | 'off' | 'chase' }>(function Wheel({ segments, dim, bulbs = 'on' }, ref) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const ptrRef = useRef<HTMLDivElement>(null);
  const rot = useRef(0);
  const segKey = JSON.stringify(segments);

  useEffect(() => {
    const cv = cvRef.current!;
    draw(cv, segments);
    document.fonts?.ready.then(() => draw(cv, segments));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey]);

  useImperativeHandle(ref, () => ({
    spinTo(idx, ms = rand(5600, 6800)) {
      const n = segments.length, a = TAU / n, cv = cvRef.current!;
      const start = rot.current, cur = ((-start % TAU) + TAU) % TAU, T = (idx + rand(0.18, 0.82)) * a;
      const delta = ((((cur - T) % TAU) + TAU) % TAU) + TAU * Math.floor(rand(5, 8));
      const segAt = (r: number) => Math.floor(((((-r) % TAU) + TAU) % TAU) / a) % n;
      let last = segAt(start), lastTick = 0;
      Sound.unlock();
      return new Promise<void>(resolve => {
        const t0 = performance.now();
        const frame = (now: number) => {
          const t = Math.min(1, (now - t0) / ms);
          rot.current = start + delta * (1 - Math.pow(1 - t, 4));   // ease-out quart
          cv.style.transform = `rotate(${rot.current}rad)`;
          const i = segAt(rot.current);
          if (i !== last) { last = i; if (now - lastTick > 28) { lastTick = now; Sound.tick(); restartAnim(ptrRef.current, 'flick'); } }
          if (t < 1) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
    },
  }), [segments]);

  return (
    <div className={'wheel-stage' + (dim ? ' dim' : '')}>
      <div className="wheel-pointer" ref={ptrRef} />
      <canvas ref={cvRef} width={S} height={S} className="wheel-canvas" style={{ transform: `rotate(${rot.current}rad)` }} />
      <Bulbs mode={bulbs} />
      <div className="wheel-hub" />
    </div>
  );
});
