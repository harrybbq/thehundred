// DODGE on the TV, ported from the approved mockup (design/mockups/Main.dc.html). moment = live | hit | dodged.
//   live    the alley in the rain; the target's polaroid under the lamp. Nothing hints at the throw: all three
//           directions are sprayed on the wall and the TV never names the thrower or their role.
//   hit     freeze → two-tone flash → red speed ribbons from the throw side → a faceted shuriken in the cracked
//           polaroid, shards → TO THE WHEEL. Then one loop only (the lamp breathing).
//   dodged  the polaroid snaps away, a cold afterimage, the shuriken bites the brick with a spark, MISSED.
// The throw-side effects are drawn once in a "thrown from the LEFT" frame and mirrored (right) or turned 90° (high).
// No SVG filters, no blend modes: the hit's black-and-white is a baked grey wall (brick-bw.png) faded in by opacity.
// Everything that moves, moves by transform or opacity; reduced motion shows the settled frame.
import { useEffect, useMemo, useRef } from 'react';
import { initials } from '../lib/util';

export type DodgeTarget = { id: string; name: string; photo: string | null };
export type DodgeResult = { dir?: string | null; guess?: string | null; dodged?: boolean; no_show?: boolean };

const TEX = '/textures/';
const rnd = (i: number) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
const f1 = (v: number) => +v.toFixed(1);
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const abs = { position: 'absolute' } as const;
const FULL = { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 } as const;

// the impact point (the hit) and the polaroid's resting place
const IX = 921, IY = 493, PX = 780, PY = 310;
// the throw-side frame: thrown from the left is the drawing; right mirrors it, high turns it 90°
const throwFrame = (dir: string | null | undefined, cx: number, cy: number) =>
  // (a CSS transform turns about the element's centre by default, so the mirror is pinned to the frame's corner)
  dir === 'right' ? { transform: `matrix(-1,0,0,1,${2 * cx},0)`, transformOrigin: '0 0' } : dir === 'high' ? { transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` } : {};

// ---- baked-once geometry
const STREAKS = Array.from({ length: 16 }, (_, i) => ({ x: Math.round(rnd(i + 40) * 1900), y: Math.round(rnd(i + 60) * 60), w: 6 + Math.round(rnd(i + 80) * 18), h: 260 + Math.round(rnd(i + 100) * 560), o: +(.3 + rnd(i + 120) * .4).toFixed(2) })).filter(s => s.x + s.w < 1266 || s.x > 1474);
const SPRAYS = [
  { text: '← LEFT', x: 196, y: 520, r: -6, o: .9 },
  { text: 'HIGH ↑', x: 772, y: 150, r: 2, o: .86 },
  { text: 'RIGHT →', x: 1488, y: 520, r: -3, o: .9 },
];
const DRIPS = [[220, 590, 46], [268, 594, 88], [336, 586, 30], [404, 590, 64], [810, 222, 52], [878, 226, 34], [970, 220, 70], [1516, 590, 58], [1606, 594, 34], [1706, 586, 90], [1781, 590, 40]]
  .map(([x, y, h], i) => ({ x, y, h, c: 'rgba(239,230,210,.7)', o: 1 - (i % 3) * .15 }));
const MISSED_DRIPS = [[1540, 206, 70], [1610, 202, 40], [1680, 194, 96], [1760, 186, 52], [1820, 180, 30]].map(([x, y, h]) => ({ x, y, h, c: 'rgba(143,220,245,.85)', o: 1 }));
const FAR_LINES = [70, 190, 310, 430, 550, 670, 790].flatMap(y => { const ye = f1(y + (580 - y) * .38); return [`M1270 ${y} L1308 ${ye}`, `M1470 ${y} L1432 ${ye}`]; });
function ribbon(x0: number, x1: number, yc: number, h: number, n: number, s: number, spike: number) {
  const top: number[][] = [], bot: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, half = h / 2 * Math.pow(1 - t, .75), y = yc + (IY - yc) * t;
    top.push([x, y - half]); bot.push([x, y + half]);
    if (i < n) {
      const sx = x + (x1 - x0) / n * .55, sp = spike * (1 - t) * (.4 + rnd(s + i) * .9), back = 70 + rnd(s + i + 50) * 90;
      top.push([sx - back, y - half - sp]); top.push([sx, y - half * .92]);
      const sp2 = spike * (1 - t) * (.4 + rnd(s + i + 99) * .9);
      bot.push([sx - back * .8, y + half + sp2]); bot.push([sx, y + half * .92]);
    }
  }
  return 'M' + top.concat(bot.reverse()).map(p => f1(p[0]) + ' ' + f1(p[1])).join(' L') + 'Z';
}
const RIBBONS = [
  { d: ribbon(-80, IX + 30, 470, 640, 9, 600, 110), c: '#6e110c', o: 1, flash: 1, fc: '#07090b' },
  { d: ribbon(-80, IX + 10, 486, 470, 11, 640, 90), c: '#c2371f', o: 1, flash: 1, fc: '#07090b' },
  { d: ribbon(-80, IX - 20, 474, 250, 12, 680, 60), c: '#e8674a', o: 1, flash: 0, fc: '#07090b' },
  { d: ribbon(-80, IX - 40, 480, 120, 12, 720, 34), c: '#fbe0d2', o: .95, flash: 1, fc: '#f1e8d4' },
  { d: `M-40 330 L${IX - 80} ${IY - 18} L${IX - 80} ${IY - 12} L-40 358Z`, c: '#fbe0d2', o: .8, flash: 1, fc: '#f1e8d4' },
  { d: `M-40 640 L${IX - 70} ${IY + 20} L${IX - 70} ${IY + 26} L-40 668Z`, c: '#fbe0d2', o: .7, flash: 1, fc: '#f1e8d4' },
  { d: `M-40 230 L${IX - 140} ${IY - 60} L${IX - 140} ${IY - 55} L-40 252Z`, c: '#e8674a', o: .8, flash: 1, fc: '#f1e8d4' },
  { d: `M-40 760 L${IX - 150} ${IY + 60} L${IX - 150} ${IY + 66} L-40 786Z`, c: '#e8674a', o: .8, flash: 1, fc: '#f1e8d4' },
];
const PHOTO_CRACKS = Array.from({ length: 9 }, (_, k) => {
  let a = k / 9 * Math.PI * 2 + rnd(k + 800) * .5, x = 190, y = 140, d = 'M ' + x + ' ' + y;
  const len = 90 + rnd(k + 820) * 190;
  for (let s = 0; s < 5; s++) { a += (rnd(k * 7 + s + 840) - .5) * .7; x += Math.cos(a) * len / 5; y += Math.sin(a) * len / 5; d += ' L ' + f1(x) + ' ' + f1(y); }
  return { d, w: 4 - k % 3 };
});
const SHARD_SHAPES = ['-14,-30 24,-18 18,20 -22,12', '-10,-34 26,-4 4,30 -24,6', '-20,-16 22,-26 12,24', '-6,-22 30,0 10,24 -20,14'];
const SHARDS = Array.from({ length: 11 }, (_, i) => {
  const a = (-50 + (i / 10) * 110 + rnd(i + 900) * 12) * Math.PI / 180, d = 200 + rnd(i + 920) * 200;
  const dx = Math.round(Math.cos(a) * d), dy = Math.round(Math.sin(a) * d * .85);
  return { x: IX + dx, y: IY + dy, dx, dy, r: Math.round(rnd(i + 940) * 360), k: +(.7 + rnd(i + 960) * .9).toFixed(2), p: SHARD_SHAPES[i % 4], c: ['#e9e1cf', '#1f5a61', '#d9cfb9', '#2c6e74'][i % 4] };
});
const CHIPS = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; const d = 50 + rnd(i + 400) * 80; return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d * .8), s: 7 + Math.round(rnd(i + 420) * 9), r: Math.round(rnd(i + 440) * 90) }; });
const SPARKS = Array.from({ length: 14 }, (_, i) => { const a = (i / 14 + rnd(i + 500) * .05) * Math.PI * 2, r0 = 40 + rnd(i + 510) * 20, r1 = r0 + 50 + rnd(i + 520) * 90; return { d: `M${f1(Math.cos(a) * r0)} ${f1(Math.sin(a) * r0)} L${f1(Math.cos(a) * r1)} ${f1(Math.sin(a) * r1)}`, c: i % 3 ? '#ffd27a' : '#fff6dc', w: i % 3 ? 3 : 5 }; });
// dodged, in the left-throw frame: the polaroid snaps 180px away from the throw; ghosts along the way
const SNAP = 180;
// The stuck shuriken, in photo coordinates. Its buried blade enters the picture at the crack centre (ENTRY) along the
// throw's line. The star stands out of the wall, tilted towards us (foreshortened to .62 along the buried blade), and
// casts a shadow on the photo that meets it at the entry: that is what makes it read as stabbed in, not lying on top.
// Visible blade: 54 of 98 units × 1.75 × .62 ≈ 58.6px, so the star's centre sits that far back along the throw.
const ENTRY = { x: 190, y: 140 };
const TILT = 'scale(1,.62)';
const STUCK: Record<string, { cx: number; cy: number; tf: string; from: string; sh: string }> = {
  left: { cx: 133.4, cy: 124.8, tf: `rotate(-75deg) ${TILT}`, from: 'translate(-620px,-90px)', sh: 'translate(26px,30px)' },
  right: { cx: 166.6, cy: 124.8, tf: `scale(-1,1) rotate(-75deg) ${TILT}`, from: 'translate(620px,-90px)', sh: 'translate(-26px,30px)' },
  high: { cx: 205.2, cy: 83.4, tf: `rotate(15deg) ${TILT}`, from: 'translate(60px,-620px)', sh: 'translate(26px,24px)' },
};
const AFTERIMAGES = [{ x: PX, o: .18, o2: .45 }, { x: PX + 70, o: .28, o2: .7 }, { x: PX + 135, o: .4, o2: .95 }];
const COLD_STREAKS = Array.from({ length: 9 }, (_, i) => ({ x: 760 + Math.round(rnd(i + 600) * 60), y: 330 + Math.round(i * 38 + rnd(i + 610) * 14), w: 170 + Math.round(rnd(i + 620) * 90), h: i % 3 ? 4 : 7, o: +(.45 + rnd(i + 630) * .4).toFixed(2) }));
const TRAIL = [{ x: 60, y: 430, w: 560, h: 7, o: .6 }, { x: 150, y: 410, w: 450, h: 4, o: .45 }, { x: 200, y: 454, w: 400, h: 4, o: .4 }];
const SLIVERS = Array.from({ length: 22 }, (_, i) => ({ x: Math.round(100 + rnd(i + 700) * 1760), y: Math.round(890 + rnd(i + 710) * 170), w: 60 + Math.round(rnd(i + 720) * 260), h: 2 + Math.round(rnd(i + 730) * 3), o: +(.35 + rnd(i + 740) * .4).toFixed(2) }));
const RIPPLES = [[760, 960], [980, 1020], [1260, 940], [1450, 960]].map(([x, y], i) => ({ x, y, rx: 40 + i % 3 * 18, ry: 9 + i % 3 * 4, o: .18 + (i % 4) * .06 }));
// palettes: the hit is drawn in greys (red kept for the ribbons and the stamp only)
const COLOUR = { sky: '#1a1d22', inLit: '#5a1826', floorLit: '#3a121a', neonA: '#ff5a70', neonB: '#e0304a', archCore: '#ffe4e8', archMid: '#ff2444', archEdge: '#a8081f',
  fog1: '#ff8090', fog2: '#9a6a74', fog3: '#5d646a', sheenA: '#ffcf8a', sheenB: '#ff8a1e', spill: .26, rust: 1, wallRef: '#2d1812',
  cone1: 'rgba(255,214,150,.26)', cone2: 'rgba(255,150,60,.06)', pool: 'rgba(255,184,102,.3)', bulb1: 'rgba(255,226,184,.6)', bulb2: 'rgba(255,138,30,.2)',
  cold: '111,199,232', hot: '224,48,74', sodium: '#ffa24a' };
const GREY: typeof COLOUR = { sky: '#202020', inLit: '#2c2c2c', floorLit: '#2a2a2a', neonA: '#f2f2f2', neonB: '#b0b0b0', archCore: '#ffffff', archMid: '#e4e4e4', archEdge: '#9a9a9a',
  fog1: '#e6e6e6', fog2: '#a8a8a8', fog3: '#7a7a7a', sheenA: '#ffffff', sheenB: '#d0d0d0', spill: 0, rust: 0, wallRef: '#262626',
  cone1: 'rgba(255,255,255,.2)', cone2: 'rgba(230,230,230,.05)', pool: 'rgba(255,255,255,.26)', bulb1: 'rgba(255,255,255,.55)', bulb2: 'rgba(210,210,210,.15)',
  cold: '214,218,222', hot: '214,214,214', sodium: '#d8d8d8' };
const CONE = 'polygon(1146px 124px, 1194px 124px, 1500px 872px, 690px 872px)';

function Star({ id = 'dg-star' }: { id?: string }) { return <use href={'#' + id} x="-100" y="-100" width="200" height="200" />; }

export function DodgeTV({ target, result, secs }: { target: DodgeTarget; result: DodgeResult | null; secs: number | null }) {
  const moment = !result ? 'live' : result.dodged ? 'dodged' : 'hit';
  const live = moment === 'live', hit = moment === 'hit', dodged = moment === 'dodged';
  const dir = result?.dir ?? 'left';
  const p = hit ? GREY : COLOUR;
  const NAME = target.name.toUpperCase(), Name = target.name[0]?.toUpperCase() + target.name.slice(1).toLowerCase();
  // where the polaroid ends up: it snaps away from the throw when dodged
  const snap = !dodged ? { x: PX, y: PY } : dir === 'right' ? { x: PX - SNAP, y: PY } : dir === 'high' ? { x: PX, y: PY + SNAP } : { x: PX + SNAP, y: PY };
  const angle = hit ? 18 : dodged ? (dir === 'right' ? -5 : 5) : -2;
  const from = dir === 'high' ? 'above' : `the ${dir}`;
  const caption = live ? 'Swipe on your phone: left, high or right'
    : result?.no_show ? `${Name} never showed. Hit.`
    : dodged ? `It came from ${from}. ${Name} read it. Missed.`
    : result?.guess ? `It came from ${from}. ${Name} went ${result.guess}. Hit.` : `It came from ${from}. ${Name} froze. Hit.`;
  const root = useRef<HTMLDivElement>(null);
  const frameHit = useMemo(() => throwFrame(dir, IX, IY), [dir]);
  const frameDodge = useMemo(() => throwFrame(dir, PX + 150, PY + 181), [dir]);

  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const q = (s: string) => [...el.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`)];
    const A: Animation[] = [], T: number[] = [];
    const go = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions) => A.push(e.animate(k, { fill: 'backwards', ...o }));
    const loop = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions) => { const a = e.animate(k, { iterations: Infinity, ...o }); A.push(a); return a; };
    const fall = (e: HTMLElement) => [{ transform: 'translateY(0)' }, { transform: `translateY(${e.dataset.dist}px)` }];
    const rainMs = (e: HTMLElement) => +e.dataset.speed! * (+e.dataset.dist! / 768);
    if (live) {
      // 8 loops: 2 rain layers, 4 ripples, the lamp flicker, the neon title's slow flicker
      q('rain').forEach(e => loop(e, fall(e), { duration: rainMs(e) }));
      q('ripple').forEach((e, i) => loop(e, [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], { duration: 1400 + (i % 3) * 300, delay: i * 230 }));
      q('lamp').forEach(e => loop(e, [{ opacity: 1 }, { opacity: 1, offset: .9 }, { opacity: .55, offset: .92 }, { opacity: 1, offset: .94 }, { opacity: .7, offset: .96 }, { opacity: 1 }], { duration: 5200, easing: 'steps(1,end)' }));
      q('neon').forEach(e => loop(e, [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: .82, offset: .82 }, { opacity: 1, offset: .84 }, { opacity: 1 }], { duration: 3400 }));
    }
    if (hit) {
      q('drain').forEach(e => go(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 60 }));
      // 0ms freeze → 60ms the two-tone flash, HELD ~0.6s (one flash, fading in and out: no strobe) → 700ms ribbons →
      // 720ms the star flies in spinning and stabs one blade into the picture → shards, the swing → 1250ms the stamp
      const F = 640;                                                  // the flash's end: everything after it waits for it
      q('flash').forEach(e => go(e, [{ opacity: 0 }, { opacity: 1, offset: .04 }, { opacity: 1, offset: .86 }, { opacity: 0 }], { duration: F, delay: 60, fill: 'none' }));
      q('ribbons').forEach(e => go(e, [{ transform: 'translateX(-1300px)', opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 160, delay: F, easing: 'cubic-bezier(.2,.8,.2,1)' }));
      q('star').forEach(e => go(e, [{ transform: `${e.dataset.from} rotate(-900deg) scale(1.3)`, opacity: 0 }, { opacity: 1, offset: .15 }, { transform: 'none', opacity: 1 }], { duration: 170, delay: F + 40, easing: 'cubic-bezier(.5,0,1,1)' }));
      q('star').forEach(e => go(e, [{ transform: 'none' }, { transform: 'scale(1.06)', offset: .3 }, { transform: 'none' }], { duration: 160, delay: F + 210 }));   // the thunk
      q('shard').forEach(e => go(e, [{ transform: `translate(${-e.dataset.dx!}px,${-e.dataset.dy!}px) scale(.2)`, opacity: 0 }, { transform: e.style.transform, opacity: 1 }], { duration: 380, delay: F + 210, easing: 'cubic-bezier(.1,.9,.3,1)' }));
      q('photo').forEach(e => go(e, ['rotate(-2deg)', 'rotate(-2deg)', 'rotate(34deg)', 'rotate(8deg)', 'rotate(24deg)', 'rotate(15deg)', 'rotate(19deg)', 'rotate(18deg)'].map(t => ({ transform: t })), { duration: 1700, delay: F + 180, easing: 'ease-out' }));
      q('stamp').forEach(e => go(e, [{ transform: 'rotate(-8deg) scale(2)', opacity: 0 }, { transform: 'rotate(-8deg) scale(1)', opacity: 1 }], { duration: 150, delay: F + 610, easing: 'cubic-bezier(.6,0,1,1)' }));
      T.push(window.setTimeout(() => q('lamp').forEach(e => loop(e, [{ opacity: 1 }, { opacity: .88 }], { duration: 2600, direction: 'alternate', easing: 'ease-in-out' })), F + 1900));
    }
    if (dodged) {
      q('rain').filter(e => e.dataset.dist === '768').forEach(e => { const a = loop(e, fall(e), { duration: rainMs(e) }); T.push(window.setTimeout(() => a.updatePlaybackRate(.33), 600)); });
      const back = dir === 'right' ? `translateX(${SNAP}px)` : dir === 'high' ? `translateY(${-SNAP}px)` : `translateX(${-SNAP}px)`;
      q('photo').forEach(e => go(e, [{ transform: `${back} rotate(-2deg)` }, { transform: e.style.transform }], { duration: 110, easing: 'cubic-bezier(.1,.9,.2,1)' }));
      q('star').forEach(e => go(e, [{ transform: 'translateX(-760px) rotate(-400deg) scale(1,.84)', opacity: .4 }, { transform: 'rotate(33deg) scale(1,.84)', opacity: 1 }], { duration: 150, delay: 120, easing: 'cubic-bezier(.4,0,1,1)' }));
      q('spark').forEach(e => go(e, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1, offset: .25 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, delay: 270 }));
      q('missed').forEach(e => go(e, [{ transform: 'rotate(-7deg) translateX(-30px)', opacity: 0 }, { transform: 'rotate(-7deg)', opacity: 1 }], { duration: 380, delay: 750, easing: 'ease-out' }));
    }
    return () => { A.forEach(a => a.cancel()); T.forEach(clearTimeout); };
  }, [live, hit, dodged, dir]);

  const face = target.photo
    ? <img src={target.photo} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #2c6e74, #0f3a41 55%, #06191d)', color: '#f1e8d4', fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 110 }}>{initials(target.name)}</div>;
  const photoClip = hit ? 'polygon(0 0, 100% 0, 100% 84%, 90% 90%, 84% 100%, 0 100%)' : 'none';
  const stuck = STUCK[dir] ?? STUCK.left;
  const crackFlip = dir === 'right' ? `matrix(-1,0,0,1,300,0)` : undefined;       // the cracks radiate from the entry, mirrored for a throw from the right
  // the flash frame's silhouette of the stuck star, in page coordinates (the photo sits at PX, PY)
  const flashStar = `translate(${PX + stuck.cx} ${PY + stuck.cy}) ${dir === 'right' ? 'scale(-1 1) ' : ''}rotate(${dir === 'high' ? 15 : -75}) scale(1.75 1.085)`;
  const flashHole = [PX + stuck.cx, PY + stuck.cy];

  return (
    <div ref={root} className="mgx dg-tv">
      <svg width="0" height="0" style={abs} aria-hidden="true">
        <defs>
          <linearGradient id="dg-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf5e8" /><stop offset=".45" stopColor="#8d8577" /><stop offset="1" stopColor="#0a0b0c" /></linearGradient>
          <linearGradient id="dg-ring-in" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f2529" /><stop offset="1" stopColor="#9aa5ac" /></linearGradient>
          <symbol id="dg-star" viewBox="-100 -100 200 200" overflow="visible">
            <path d="M0-98 L-24-24 L0 0Z" fill="#f4ecdc" /><path d="M0-98 L24-24 L0 0Z" fill="#111417" />
            <path d="M98 0 L24-24 L0 0Z" fill="#dcd2bf" /><path d="M98 0 L24 24 L0 0Z" fill="#0a0c0e" />
            <path d="M0 98 L24 24 L0 0Z" fill="#07080a" /><path d="M0 98 L-24 24 L0 0Z" fill="#b3aa99" />
            <path d="M-98 0 L-24 24 L0 0Z" fill="#cdc3b0" /><path d="M-98 0 L-24-24 L0 0Z" fill="#fbf5e8" />
            <path d="M0-98 L-24-24 M-98 0 L-24-24" stroke="#ffffff" strokeWidth="2.5" opacity=".9" fill="none" />
            <path d="M0-98 L24-24 L98 0 L24 24 L0 98 L-24 24 L-98 0 L-24-24Z" fill="none" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
            <path d="M3-88 L21-28 M88 3 L28 21 M3 88 L21 28" stroke="#6fc7e8" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M-40 -8 L-70 -3 M8 -44 L4 -70" stroke="#ffffff" strokeWidth="1.4" opacity=".45" />
            <circle r="31" fill="url(#dg-ring)" stroke="#07090b" strokeWidth="4" /><circle r="21" fill="url(#dg-ring-in)" /><circle r="12" fill="#050607" />
            <path d="M4 11 A 12 12 0 0 0 11 4" stroke="#c9d2d8" strokeWidth="2" fill="none" />
          </symbol>
          <symbol id="dg-star-sil" viewBox="-100 -100 200 200" overflow="visible"><path d="M0-98 L24-24 L98 0 L24 24 L0 98 L-24 24 L-98 0 L-24-24Z" /></symbol>
          {/* the same star with its bottom blade sunk into the picture: the blade stops at a torn slit */}
          <symbol id="dg-star-stuck" viewBox="-100 -100 200 200" overflow="visible">
            <path d="M0-98 L-24-24 L0 0Z" fill="#f4ecdc" /><path d="M0-98 L24-24 L0 0Z" fill="#111417" />
            <path d="M98 0 L24-24 L0 0Z" fill="#dcd2bf" /><path d="M98 0 L24 24 L0 0Z" fill="#0a0c0e" />
            <path d="M0 0 L24 24 L14.3 54 L0 54Z" fill="#07080a" /><path d="M0 0 L-24 24 L-14.3 54 L0 54Z" fill="#b3aa99" />
            <path d="M-98 0 L-24 24 L0 0Z" fill="#cdc3b0" /><path d="M-98 0 L-24-24 L0 0Z" fill="#fbf5e8" />
            <path d="M0-98 L-24-24 M-98 0 L-24-24" stroke="#ffffff" strokeWidth="2.5" opacity=".9" fill="none" />
            <path d="M14.3 54 L24 24 L98 0 L24-24 L0-98 L-24-24 L-98 0 L-24 24 L-14.3 54" fill="none" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
            <path d="M3-88 L21-28 M88 3 L28 21 M16 50 L21 31" stroke="#6fc7e8" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M-40 -8 L-70 -3 M8 -44 L4 -70" stroke="#ffffff" strokeWidth="1.4" opacity=".45" />
            <circle r="31" fill="url(#dg-ring)" stroke="#07090b" strokeWidth="4" /><circle r="21" fill="url(#dg-ring-in)" /><circle r="12" fill="#050607" />
            <path d="M4 11 A 12 12 0 0 0 11 4" stroke="#c9d2d8" strokeWidth="2" fill="none" />
            {/* the slit in the photo where the blade went in, with a torn paper lip */}
            <path d="M-38 54 Q0 70 38 54 Q0 44 -38 54Z" fill="#050505" />
            <path d="M-36 58 Q-18 70 0 69 L6 80 L12 68 Q24 66 36 58" fill="#f4efe4" stroke="#050505" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M-30 50 L-40 42 M30 50 L42 43" stroke="#050505" strokeWidth="3" strokeLinecap="round" />
          </symbol>
          <symbol id="dg-star-stuck-sil" viewBox="-100 -100 200 200" overflow="visible"><path d="M14.3 54 L24 24 L98 0 L24-24 L0-98 L-24-24 L-98 0 L-24 24 L-14.3 54Z" /></symbol>
        </defs>
      </svg>

      {/* THE WALL: two buildings of baked brick; a gap between them runs to a red arch at the vanishing point */}
      <div style={{ ...abs, left: 0, top: 0, width: 1270, height: 872, background: `url('${TEX}brick.png') 0 0 / 512px 256px repeat` }} />
      <div style={{ ...abs, left: 1470, top: 0, width: 450, height: 872, background: `url('${TEX}brick.png') -200px -64px / 512px 256px repeat` }} />
      {hit && <>
        <div data-fx="drain" style={{ ...abs, left: 0, top: 0, width: 1270, height: 872, background: `url('${TEX}brick-bw.png') 0 0 / 512px 256px repeat` }} />
        <div data-fx="drain" style={{ ...abs, left: 1470, top: 0, width: 450, height: 872, background: `url('${TEX}brick-bw.png') -200px -64px / 512px 256px repeat` }} />
      </>}
      <div style={{ ...abs, left: 1470, top: 0, width: 450, height: 872, background: 'linear-gradient(90deg, rgba(4,5,8,.55), rgba(4,5,8,.25) 30%, rgba(4,5,8,.4))' }} />

      <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
        <defs>
          <linearGradient id="dg-streak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".8" /><stop offset="1" stopColor="#000" stopOpacity="0" /></linearGradient>
          <linearGradient id="dg-rust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a2a12" stopOpacity=".7" /><stop offset="1" stopColor="#5a2a12" stopOpacity="0" /></linearGradient>
          <linearGradient id="dg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07090b" /><stop offset="1" stopColor={p.sky} /></linearGradient>
          <linearGradient id="dg-inL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#020203" /><stop offset=".6" stopColor="#060506" /><stop offset="1" stopColor={p.inLit} /></linearGradient>
          <linearGradient id="dg-inR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#020203" /><stop offset=".6" stopColor="#070506" /><stop offset="1" stopColor={p.inLit} /></linearGradient>
          <linearGradient id="dg-farfloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.floorLit} /><stop offset="1" stopColor="#060505" /></linearGradient>
          <linearGradient id="dg-redstreak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.neonA} stopOpacity=".9" /><stop offset="1" stopColor={p.neonB} stopOpacity=".1" /></linearGradient>
          <radialGradient id="dg-neonglow"><stop offset="0" stopColor={p.neonA} stopOpacity=".75" /><stop offset=".4" stopColor={p.neonB} stopOpacity=".3" /><stop offset="1" stopColor={p.neonB} stopOpacity="0" /></radialGradient>
          <radialGradient id="dg-arch" cx="1370" cy="690" r="130" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={p.archCore} /><stop offset=".45" stopColor={p.archMid} /><stop offset="1" stopColor={p.archEdge} /></radialGradient>
          {([['dg-fog1', p.fog1, .22, .16], ['dg-fog2', p.fog2, .26, .18], ['dg-fog3', p.fog3, .14, .1]] as const).map(([id, c, a, b]) => (
            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity="0" /><stop offset=".35" stopColor={c} stopOpacity={a} /><stop offset="1" stopColor={c} stopOpacity={b} /></linearGradient>
          ))}
          <linearGradient id="dg-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.neonB} stopOpacity="0" /><stop offset=".6" stopColor={p.neonA} stopOpacity=".85" /><stop offset="1" stopColor={p.neonB} stopOpacity=".25" /></linearGradient>
          <clipPath id="dg-slot"><rect x="1270" y="0" width="200" height="872" /></clipPath>
          <radialGradient id="dg-fall" cx="1170" cy="160" r="1250" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset=".3" stopColor="#000" stopOpacity=".18" /><stop offset=".62" stopColor="#000" stopOpacity=".62" /><stop offset="1" stopColor="#000" stopOpacity=".86" /></radialGradient>
          <radialGradient id="dg-sheen" cx="1170" cy="150" r="720" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={p.sheenA} stopOpacity=".34" /><stop offset=".35" stopColor={p.sheenB} stopOpacity=".1" /><stop offset="1" stopColor={p.sheenB} stopOpacity="0" /></radialGradient>
          <radialGradient id="dg-redspill" cx="1370" cy="640" r="380" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={p.neonB} stopOpacity={p.spill} /><stop offset="1" stopColor={p.neonB} stopOpacity="0" /></radialGradient>
          <linearGradient id="dg-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".6" /></linearGradient>
          <linearGradient id="dg-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#110d0c" /><stop offset="1" stopColor="#030303" /></linearGradient>
        </defs>
        {STREAKS.map((s, i) => <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill="url(#dg-streak)" opacity={s.o} />)}
        <path d="M1236 58 q -3 60 2 130 q 3 60 -1 120" stroke="url(#dg-rust)" strokeWidth="10" fill="none" opacity={p.rust} />
        <g clipPath="url(#dg-slot)">
          <rect x="1270" y="0" width="200" height="872" fill="url(#dg-sky)" />
          <rect x="1308" y="220" width="124" height="541" fill="#070506" />
          <circle cx="1370" cy="660" r="190" fill="url(#dg-neonglow)" />
          <path d="M1308 761 V598 A62 62 0 0 1 1432 598 V761Z" fill="url(#dg-arch)" />
          <path d="M1352 761 V640 A18 18 0 0 1 1388 640 V761Z" fill={p.archCore} opacity=".7" />
          <polygon points="1270,0 1308,220 1308,761 1270,872" fill="url(#dg-inL)" />
          <polygon points="1470,0 1432,220 1432,761 1470,872" fill="url(#dg-inR)" />
          {FAR_LINES.map((l, i) => <path key={i} d={l} stroke={p.neonB} strokeWidth="3" opacity=".55" fill="none" />)}
          <path d="M1270 0 L1308 220 H1432 L1470 0 M1308 220 V761 M1432 220 V761" stroke={p.neonB} strokeWidth="2" opacity=".5" fill="none" />
          <polygon points="1308,761 1432,761 1470,872 1270,872" fill="url(#dg-farfloor)" />
          <polygon points="1350,761 1390,761 1412,872 1328,872" fill="url(#dg-redstreak)" />
          <rect x="1296" y="520" width="148" height="260" fill="url(#dg-fog1)" />
          <rect x="1284" y="440" width="172" height="380" fill="url(#dg-fog2)" />
          <rect x="1270" y="340" width="200" height="532" fill="url(#dg-fog3)" />
        </g>
        <rect x="1266" y="300" width="5" height="572" fill="url(#dg-rim)" />
        <rect x="1469" y="300" width="5" height="572" fill="url(#dg-rim)" />
        <rect width="1920" height="872" fill="url(#dg-fall)" />
        <rect width="1920" height="872" fill="url(#dg-sheen)" />
        <rect width="1920" height="872" fill="url(#dg-redspill)" />
        <rect y="700" width="1920" height="172" fill="url(#dg-base)" />
        <path d="M 560 0 L 590 150 L 548 238 L 612 410 M 590 150 L 668 188" stroke="#080504" strokeWidth="3" fill="none" opacity=".85" />
        <rect y="864" width="1920" height="10" fill="#0a0707" />
        <rect y="872" width="1920" height="208" fill="url(#dg-floor)" />
      </svg>
      {hit && <div data-fx="drain" style={{ ...abs, inset: 0, background: 'radial-gradient(ellipse 60% 60% at 48% 46%, rgba(0,0,0,0), rgba(0,0,0,.4))' }} />}

      {/* spray-painted directions: all three, always (nothing points at the real throw) */}
      {SPRAYS.map(w => <div key={w.text} className="dg-spray" style={{ left: w.x, top: w.y, transform: `rotate(${w.r}deg)`, opacity: w.o }}>{w.text}</div>)}
      {(dodged ? DRIPS.concat(MISSED_DRIPS) : DRIPS).map((d, i) => <div key={i} style={{ ...abs, left: d.x, top: d.y, width: 4, height: d.h, borderRadius: '0 0 3px 3px', background: `linear-gradient(180deg, ${d.c}, transparent)`, opacity: d.o }} />)}
      {dodged && <div data-fx="missed" className="dg-missed">MISSED</div>}

      {/* the lamp and its cone (normal blend, pre-lightened colour) */}
      <div data-fx="lamp" style={{ ...abs, inset: 0, pointerEvents: 'none' }}>
        <div style={{ ...abs, inset: 0, clipPath: CONE, background: `linear-gradient(180deg, transparent 100px, ${p.cone1} 130px, ${p.cone2} 640px, transparent 872px)` }} />
        <div style={{ ...abs, left: 820, top: 830, width: 620, height: 120, borderRadius: '50%', background: `radial-gradient(ellipse closest-side, ${p.pool}, transparent)` }} />
        <div style={{ ...abs, left: 1040, top: -10, width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle closest-side, ${p.bulb1}, ${p.bulb2} 45%, transparent)` }} />
      </div>
      <svg viewBox="0 0 200 160" style={{ ...abs, left: 1070, top: 0, width: 200, height: 160, overflow: 'visible' }} aria-hidden="true">
        <rect x="160" y="30" width="22" height="46" fill="#15181b" stroke="#000" strokeWidth="2" />
        <path d="M 170 52 C 150 52, 110 44, 100 88" stroke="#1a1d20" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M 58 110 Q 100 76 142 110 L 150 126 L 50 126 Z" fill="#23282c" stroke="#000" strokeWidth="3" />
        <path d="M 64 106 Q 100 82 128 96" stroke="#5a646a" strokeWidth="3" fill="none" />
        <ellipse cx="100" cy="127" rx="34" ry="9" fill="#fff0d6" />
      </svg>

      {/* hit: the red speed ribbons from the throw side, over the frozen grey scene */}
      {hit && <div style={{ ...FULL, zIndex: 5, ...frameHit }}>
        <svg data-fx="ribbons" viewBox="0 0 1920 1080" style={{ ...FULL, overflow: 'visible' }} aria-hidden="true">
          {RIBBONS.map((b, i) => <path key={i} d={b.d} fill={b.c} opacity={b.o} />)}
        </svg>
      </div>}

      {/* dodged: the cold afterimage and the shuriken's line in, in the throw's frame */}
      {dodged && <div style={{ ...FULL, ...frameDodge }}>
        {AFTERIMAGES.map((a, i) => (
          <div key={i} style={{ ...abs, left: a.x, top: PY, width: 300, height: 362, transform: 'rotate(-2deg)', transformOrigin: '50% 12%', background: `linear-gradient(90deg, rgba(190,236,250,${a.o2}), rgba(111,199,232,${a.o}) 10%, rgba(111,199,232,0) 55%)`, boxShadow: `-5px 0 0 rgba(160,226,248,${a.o2}), -6px 0 22px rgba(111,199,232,${a.o})` }} />
        ))}
        {COLD_STREAKS.map((s, i) => <div key={i} style={{ ...abs, left: s.x, top: s.y, width: s.w, height: s.h, borderRadius: 3, background: `linear-gradient(90deg, rgba(111,199,232,0), rgba(160,226,248,${s.o}))` }} />)}
        {TRAIL.map((s, i) => <div key={i} style={{ ...abs, left: s.x, top: s.y, width: s.w, height: s.h, borderRadius: 3, background: `linear-gradient(90deg, rgba(241,232,212,0), rgba(241,232,212,${s.o}))` }} />)}
        <svg viewBox="-160 -160 320 320" style={{ ...abs, left: 540, top: 270, width: 320, height: 320, overflow: 'visible' }} aria-hidden="true">
          <path d="M 0 0 L -70 -34 L -104 -30 M 0 0 L 58 -62 L 70 -96 M 0 0 L 40 70 L 78 96 M 0 0 L -52 58 L -60 92" stroke="#050302" strokeWidth="4" fill="none" />
          {CHIPS.map((c, i) => <rect key={i} x={c.x} y={c.y} width={c.s} height={c.s} fill="#7a4530" stroke="#120806" strokeWidth="1.5" transform={`rotate(${c.r} ${c.x} ${c.y})`} />)}
        </svg>
        <div data-fx="spark" style={{ ...abs, left: 540, top: 270, width: 320, height: 320 }}>
          <div style={{ ...abs, inset: 40, borderRadius: '50%', background: 'radial-gradient(circle closest-side, rgba(255,246,214,.95), rgba(255,178,80,.55) 25%, rgba(255,138,30,.18) 55%, transparent)' }} />
          <svg viewBox="-160 -160 320 320" style={{ ...abs, inset: 0, width: 320, height: 320, overflow: 'visible' }} aria-hidden="true">
            {SPARKS.map((k, i) => <path key={i} d={k.d} stroke={k.c} strokeWidth={k.w} strokeLinecap="round" />)}
          </svg>
        </div>
        <svg data-fx="star" viewBox="-100 -100 200 200" style={{ ...abs, left: 585, top: 315, width: 230, height: 230, overflow: 'visible', transform: 'rotate(33deg) scale(1, .84)' }} aria-hidden="true">
          <ellipse cx="0" cy="0" rx="22" ry="22" fill="#000" />
          <use href="#dg-star-sil" x="-100" y="-100" width="200" height="200" transform="translate(-12 14)" fill="#000" opacity=".6" />
          <Star />
        </svg>
      </div>}

      {/* the target */}
      {hit && <div style={{ ...abs, zIndex: 5, left: 1046, top: 296, width: 58, height: 28, background: 'rgba(222,212,182,.8)', transform: 'rotate(21deg)', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12% 70%, 0 45%, 14% 22%)', boxShadow: '0 2px 4px rgba(0,0,0,.35)' }} />}
      <div data-fx="photo" style={{ ...abs, zIndex: 5, left: snap.x, top: snap.y, width: 300, height: 362, transform: `rotate(${angle}deg)`, transformOrigin: hit ? '10% 2%' : '50% 12%' }}>
        <div style={{ ...abs, inset: 0, boxShadow: '-30px 40px 46px rgba(0,0,0,.85)', clipPath: hit ? 'polygon(-40% -20%, 100% -20%, 100% 84%, 84% 100%, -40% 140%)' : 'none' }} />
        <div style={{ ...abs, inset: 0, boxSizing: 'border-box', padding: '14px 14px 64px', background: '#f4efe4', clipPath: photoClip }}>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>{face}</div>
          <div className="dg-photo-name">{NAME}</div>
          <div style={{ ...abs, inset: 0, background: 'linear-gradient(225deg, rgba(255,196,120,.34), transparent 45%, rgba(0,0,0,.3))' }} />
          <div style={{ ...abs, inset: 0, background: `url('${TEX}grain.png') 0 0 / 256px 256px`, opacity: .12 }} />
          {hit && <svg viewBox="0 0 300 362" style={{ ...abs, inset: 0, width: 300, height: 362 }} aria-hidden="true">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" transform={crackFlip}>
              {PHOTO_CRACKS.map((c, i) => <path key={i} d={c.d} stroke="#050505" strokeWidth={c.w} opacity=".85" />)}
              {PHOTO_CRACKS.map((c, i) => <path key={'h' + i} d={c.d} stroke="#fffaf0" strokeWidth="1.4" transform="translate(-1.5 -1.5)" opacity=".7" />)}
            </g>
            <circle cx={dir === 'right' ? 300 - ENTRY.x : ENTRY.x} cy={ENTRY.y} r="58" fill="#0a0605" opacity=".35" />
          </svg>}
        </div>
        {/* two-colour rim: cold on the left, far-neon red on the right */}
        <div style={{ ...abs, left: -4, top: 6, bottom: 10, width: 5, background: `linear-gradient(180deg, rgba(${p.cold},.25), rgba(${p.cold},.95) 40%, rgba(${p.cold},.4))`, boxShadow: `-2px 0 14px rgba(${p.cold},.55)` }} />
        <div style={{ ...abs, right: -4, top: 10, bottom: hit ? 70 : 10, width: 5, background: `linear-gradient(180deg, rgba(${p.hot},.3), rgba(${p.hot},.95) 55%, rgba(${p.hot},.5))`, boxShadow: `2px 0 16px rgba(${p.hot},.6)` }} />
        <div style={{ ...abs, left: -18, top: -10, width: 96, height: 30, background: 'rgba(222,212,182,.8)', transform: 'rotate(-24deg)', boxShadow: '0 2px 4px rgba(0,0,0,.35)' }} />
        {!hit && <div style={{ ...abs, right: -16, top: -8, width: 92, height: 30, background: 'rgba(222,212,182,.74)', transform: 'rotate(21deg)', boxShadow: '0 2px 4px rgba(0,0,0,.35)' }} />}
        {hit && <>
          <svg viewBox="0 0 300 362" style={{ ...abs, left: 0, top: 0, width: 300, height: 362, overflow: 'visible' }} aria-hidden="true">
            <path d="M 318 300 q 20 40 4 86 M 300 348 q 12 26 -2 52" stroke="#f1e8d4" strokeWidth="5" fill="none" strokeLinecap="round" opacity=".55" />
          </svg>
          <div data-fx="star" data-from={stuck.from} style={{ ...abs, left: stuck.cx - 175, top: stuck.cy - 175, width: 350, height: 350 }}>
            {/* its shadow on the photo, offset away from the light: it only meets the star where the blade goes in */}
            <svg viewBox="-100 -100 200 200" style={{ ...abs, left: 0, top: 0, width: 350, height: 350, overflow: 'visible', transform: `${stuck.sh} ${stuck.tf}` }} aria-hidden="true">
              <use href="#dg-star-stuck-sil" x="-100" y="-100" width="200" height="200" fill="#000" opacity=".5" />
            </svg>
            <svg viewBox="-100 -100 200 200" style={{ ...abs, left: 0, top: 0, width: 350, height: 350, overflow: 'visible', transform: stuck.tf }} aria-hidden="true">
              <Star id="dg-star-stuck" />
            </svg>
          </div>
        </>}
      </div>

      {/* hit: shards burst away from the impact (in the throw's frame) */}
      {hit && <div style={{ ...FULL, zIndex: 5, pointerEvents: 'none', ...frameHit }}>
        {SHARDS.map((s, i) => (
          <svg key={i} data-fx="shard" data-dx={s.dx} data-dy={s.dy} viewBox="-40 -40 80 80" style={{ ...abs, left: s.x, top: s.y, width: 80, height: 80, margin: '-40px 0 0 -40px', overflow: 'visible', transform: `rotate(${s.r}deg) scale(${s.k})` }} aria-hidden="true">
            <polygon points={s.p} fill={s.c} stroke="#050505" strokeWidth="2.5" />
          </svg>
        ))}
      </div>}

      {/* the floor: filled puddles holding flipped, darkened copies of the lamp, the polaroid and the far neon */}
      <svg viewBox="0 0 1920 1080" style={{ ...FULL, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <clipPath id="dg-puddles">
            <path d="M 640 926 C 720 892, 900 898, 1040 902 C 1200 888, 1420 880, 1530 914 C 1580 944, 1500 980, 1440 1000 C 1420 1060, 1360 1078, 1184 1066 C 1000 1076, 770 1062, 684 1032 C 598 1002, 588 958, 640 926 Z" />
            <path d="M 150 958 C 210 930, 420 930, 500 952 C 548 968, 520 1000, 440 1010 C 330 1022, 190 1016, 150 996 C 118 982, 122 968, 150 958 Z" />
            <path d="M 1590 904 C 1660 890, 1830 892, 1880 910 C 1912 926, 1880 954, 1800 962 C 1720 970, 1620 962, 1590 944 C 1566 930, 1570 912, 1590 904 Z" />
          </clipPath>
          <linearGradient id="dg-pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1418" /><stop offset="1" stopColor="#07090c" /></linearGradient>
          <linearGradient id="dg-wallref" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.wallRef} stopOpacity=".9" /><stop offset="1" stopColor={p.wallRef} stopOpacity="0" /></linearGradient>
          <radialGradient id="dg-lampref" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={p.sheenA} stopOpacity=".75" /><stop offset=".3" stopColor={p.sheenB} stopOpacity=".35" /><stop offset="1" stopColor={p.sheenB} stopOpacity="0" /></radialGradient>
          <linearGradient id="dg-neonref" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.neonA} stopOpacity=".9" /><stop offset=".6" stopColor={p.neonB} stopOpacity=".45" /><stop offset="1" stopColor={p.neonB} stopOpacity="0" /></linearGradient>
          <linearGradient id="dg-photoref" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".25" /><stop offset="1" stopColor="#000" stopOpacity=".85" /></linearGradient>
        </defs>
        <g clipPath="url(#dg-puddles)">
          <rect x="0" y="872" width="1920" height="208" fill="url(#dg-pool)" />
          <rect x="0" y="872" width="1920" height="120" fill="url(#dg-wallref)" />
          <rect x="1270" y="872" width="200" height="208" fill={p.floorLit} opacity=".7" />
          <polygon points="1340,876 1400,876 1420,1080 1320,1080" fill="url(#dg-neonref)" />
          <rect x="1364" y="880" width="12" height="190" fill={p.archCore} opacity=".6" />
          <g transform={`translate(${snap.x} ${hit ? 1010 : 1000}) scale(1 -.36) rotate(${-angle} 150 0)`}>
            <rect x="0" y="0" width="300" height="362" fill="#e6dccb" opacity=".62" />
            <rect x="14" y="64" width="272" height="284" fill="#1d5a62" opacity=".9" />
            <rect x="-4" y="10" width="5" height="340" fill={`rgb(${p.cold})`} opacity=".6" />
            <rect x="299" y="10" width="5" height="340" fill={`rgb(${p.hot})`} opacity=".6" />
            <rect x="0" y="0" width="300" height="362" fill="url(#dg-photoref)" />
          </g>
          <ellipse cx="1170" cy="1040" rx="90" ry="170" fill="url(#dg-lampref)" />
          <rect x="1160" y="990" width="20" height="90" fill="#fff0d6" opacity=".45" />
          <ellipse cx="1100" cy="930" rx="300" ry="40" fill="url(#dg-lampref)" opacity=".5" />
          <ellipse cx="330" cy="966" rx="150" ry="20" fill="#efe6d2" opacity=".07" />
          <ellipse cx="1700" cy="930" rx="130" ry="30" fill={p.neonB} opacity=".16" />
          {SLIVERS.map((v, i) => <rect key={i} x={v.x} y={v.y} width={v.w} height={v.h} fill="#07080a" opacity={v.o} />)}
          {live && RIPPLES.map((r, i) => <ellipse key={i} data-fx="ripple" cx={r.x} cy={r.y} rx={r.rx} ry={r.ry} fill="none" stroke="#ffe2b8" strokeWidth="1.5" opacity={reduced() ? 0 : r.o} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />)}
        </g>
      </svg>

      {/* rain: one baked tile at one angle, moved by transform. Two layers, each only as tall as the frame plus one
          tile of travel (no moving layer inside a clip: a weak TV would repaint it every frame) */}
      <div style={{ ...abs, inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: hit ? .55 : 1 }}>
        <div data-fx="rain" data-dist="768" data-speed="560" style={{ ...abs, left: 0, top: -768, width: 1920, height: 1848, background: `url('${TEX}rain.png') 0 0 / 768px 768px repeat`, opacity: .5 }} />
        <div data-fx="rain" data-dist="1024" data-speed="420" style={{ ...abs, left: 0, top: -1024, width: 1920, height: 2104, background: `url('${TEX}rain.png') 0 0 / 1024px 1024px repeat`, opacity: .22 }} />
      </div>

      {/* foreground: a thick black fire escape (left) and a drainpipe (right), rimmed so they read */}
      <svg viewBox="0 0 1920 1080" style={{ ...FULL, pointerEvents: 'none', zIndex: 6 }} aria-hidden="true">
        <defs><linearGradient id="dg-sodium" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.sodium} stopOpacity=".2" /><stop offset=".22" stopColor={p.sodium} stopOpacity=".9" /><stop offset=".7" stopColor={p.sodium} stopOpacity=".35" /><stop offset="1" stopColor={p.sodium} stopOpacity=".1" /></linearGradient></defs>
        <g fill="#000">
          <rect x="0" y="372" width="196" height="42" /><rect x="138" y="372" width="48" height="708" />
          <rect x="14" y="414" width="14" height="226" /><rect x="62" y="414" width="14" height="226" /><rect x="104" y="414" width="14" height="226" />
          <rect x="0" y="518" width="140" height="12" /><rect x="0" y="640" width="196" height="58" />
          <polygon points="150,698 196,698 34,1000 -12,1000" /><path d="M 138 698 L 40 790 L 72 790 L 162 698Z" />
          <path d="M -20 1080 L -20 870 Q 50 850 120 862 L 150 1080 Z" />
          <rect x="1862" y="0" width="58" height="1080" />
          <rect x="1846" y="176" width="74" height="30" /><rect x="1846" y="476" width="74" height="30" /><rect x="1846" y="776" width="74" height="30" />
          <rect x="1854" y="330" width="66" height="22" /><rect x="1854" y="630" width="66" height="22" />
        </g>
        <rect x="186" y="372" width="5" height="708" fill={`rgb(${p.cold})`} opacity=".8" />
        <rect x="1864" y="0" width="7" height="1080" fill="url(#dg-sodium)" />
      </svg>

      {/* neon title on its brackets, and the clock */}
      <div className="dg-head" style={{ zIndex: hit ? 6 : 'auto' }}>
        <div className="k">SOMETHING'S COMING FOR {NAME}</div>
        <div className="t">
          <i style={{ top: 34 }} /><i style={{ top: 118 }} />
          <div data-fx="neon" className={'n' + (hit ? ' grey' : '')}>DODGE!</div>
        </div>
        {live && <div className="s">Read where it comes from, or take the hit.</div>}
      </div>
      {live && <div className="dg-clock"><div className="k">{NAME} IS DECIDING</div>{secs !== null && <div className="n">{String(secs).padStart(2, '0')}</div>}</div>}
      {hit && <div data-fx="stamp" className="dg-stamp">TO THE<br />WHEEL</div>}
      <div className="dg-caption">{caption}</div>

      <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 75% 70% at 55% 48%, transparent 55%, rgba(0,0,0,.72)), linear-gradient(90deg, rgba(0,0,0,.25), transparent 12%, transparent 88%, rgba(0,0,0,.25))' }} />
      <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: `url('${TEX}grain.png') 0 0 / 256px 256px`, opacity: .06 }} />

      {/* the two-tone flash frame of the cut-in (held ~0.6s on a hit so the silhouette reads; invisible when still) */}
      {hit && <div data-fx="flash" style={{ ...abs, inset: 0, zIndex: 9, background: '#f1e8d4', opacity: 0 }}>
        <svg viewBox="0 0 1920 1080" style={{ ...abs, inset: 0, width: 1920, height: 1080 }} aria-hidden="true">
          <g transform={dir === 'right' ? `matrix(-1,0,0,1,${2 * IX},0)` : dir === 'high' ? `rotate(90 ${IX} ${IY})` : undefined}>
            {RIBBONS.map((b, i) => <path key={i} d={b.d} fill={b.fc} opacity={b.flash} />)}
          </g>
          <rect x="780" y="310" width="300" height="362" fill="#07090b" transform="rotate(-2 930 353)" />
          <rect x="794" y="324" width="272" height="284" fill="#f1e8d4" transform="rotate(-2 930 353)" />
          <use href="#dg-star-stuck-sil" x="-100" y="-100" width="200" height="200" transform={flashStar} fill="#07090b" />
          <ellipse cx={flashHole[0]} cy={flashHole[1]} rx="21" ry="15" fill="#f1e8d4" />
        </svg>
      </div>}
    </div>
  );
}
