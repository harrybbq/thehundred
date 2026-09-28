// The punishment wheel (canvas) — ported from v1. The server decides where it
// lands; this component just animates to a given segment with a realistic
// ease-out and ticking sound. Jester graffiti segments are drawn as spray paint.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { WheelSeg } from '../lib/types';
import { Sound } from '../fx/sound';
import { rand } from '../lib/util';
import { restartAnim } from '../fx/effects';

export interface WheelHandle { spinTo(idx: number, ms?: number): Promise<void> }

const COLORS = ['#ff2d95', '#22e6ff', '#ffb627', '#b04dff', '#39ff88', '#ff6b3b'];
const TAU = Math.PI * 2;
const S = 1400;

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(Math.min(255, Math.max(0, v + v * f)))).join(',')})`;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = []; let cur = '';
  for (const w of text.split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}
function draw(cv: HTMLCanvasElement, segs: WheelSeg[]) {
  const ctx = cv.getContext('2d')!, C = S / 2, n = Math.max(1, segs.length), a = TAU / n, rim = S * 0.035, R = C - rim;
  const body = getComputedStyle(document.body).getPropertyValue('--body') || 'sans-serif';
  ctx.clearRect(0, 0, S, S);
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, TAU); ctx.fillStyle = '#1a0f2e'; ctx.fill();
  ctx.save(); ctx.translate(C, C);
  segs.forEach((seg, i) => {
    const start = -Math.PI / 2 + i * a;
    let col = COLORS[i % COLORS.length];
    if (i === n - 1 && n % COLORS.length === 1) col = COLORS[2];
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, start, start + a); ctx.closePath();
    if (seg.graffiti) {
      ctx.fillStyle = '#0d0d0d'; ctx.fill();
      ctx.save(); ctx.clip();                       // spray speckle
      for (let k = 0; k < 260; k++) { const rr = rand(R * 0.2, R), th = start + rand(0, a); ctx.fillStyle = `rgba(57,255,136,${rand(0.05, 0.25)})`; ctx.fillRect(Math.cos(th) * rr, Math.sin(th) * rr, 3, 3); }
      ctx.restore();
      ctx.setLineDash([18, 10]); ctx.lineWidth = 6; ctx.strokeStyle = '#39ff88'; ctx.stroke(); ctx.setLineDash([]);
    } else {
      const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
      g.addColorStop(0, col); g.addColorStop(1, shade(col, -0.25));
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,20,.8)'; ctx.stroke();
    }
    // text along the radius
    ctx.save(); ctx.rotate(start + a / 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = seg.graffiti ? '#39ff88' : '#12061f';
    const font = seg.graffiti ? "'Permanent Marker', cursive" : body;
    const text = seg.graffiti ? seg.text : seg.text.toUpperCase();
    const outer = R * 0.93, maxW = R * 0.68;
    let fs = R * 0.1, lines: string[] = [];
    for (; fs > R * 0.028; fs -= 2) {
      ctx.font = `${seg.graffiti ? 400 : 800} ${fs}px ${font}`;
      lines = wrap(ctx, text, maxW);
      const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
      const room = 2 * Math.max(outer - widest, R * 0.2) * Math.sin(a / 2) * 0.9;
      if (lines.length <= 3 && widest <= maxW && lines.length * fs * 1.02 <= room) break;
    }
    if (seg.graffiti) { ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 14; }
    lines.forEach((ln, j) => ctx.fillText(ln, outer, (j - (lines.length - 1) / 2) * fs * 1.02));
    ctx.restore();
  });
  const bulbs = n * 3;
  for (let i = 0; i < bulbs; i++) {
    const t = (i / bulbs) * TAU;
    ctx.beginPath(); ctx.arc(Math.cos(t) * (R + rim / 2), Math.sin(t) * (R + rim / 2), rim * 0.26, 0, TAU);
    ctx.fillStyle = i % 2 ? '#fff4c2' : '#ffb627'; ctx.shadowColor = '#ffb627'; ctx.shadowBlur = 16; ctx.fill();
  }
  ctx.restore();
}

export const Wheel = forwardRef<WheelHandle, { segments: WheelSeg[]; dim?: boolean }>(function Wheel({ segments, dim }, ref) {
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
      <div className="wheel-hub">🍺</div>
    </div>
  );
});
