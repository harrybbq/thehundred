// THE BOMB on the TV, ported from the approved mockup (design/mockups/Bomb.dc.html).
//   BLAST ROOM 3, a bomb-disposal bunker: riveted steel, a round blast door stencilled NO EXIT, sandbags, pipes, BLAST ZONE
//   painted under two cold tubes, a caged red beacon, a scarred steel bench, the "0 DAYS SINCE LAST INCIDENT" sign and a
//   traffic cone by the mop bucket (it ends up on the loser's head).
//   live  the bomb (a console: dynamite, wires, ARMED) sits on a rail above the holder's station and SLIDES to the next
//         holder on every pass, with a skid and speed lines; the passer gets NO RETURNS.
//   boom  2.6s, once, then it holds: the bomb shudders and vanishes, white flash, the room shakes, every lamp flicks red,
//         the tubes blow, a flat cartoon burst, debris lands on the bench, soot, the loser's station slams up scorched,
//         the cone lands on their head, TO THE WHEEL, and BOOM. on the marquee.
// THE RULE: the fuse is secret. Nothing here knows it. Tension (marquee speed, beacon, tube flicker, the holder's pulse, the
// bomb's jitter) follows the PASS COUNT only, capped at 10, so pass 10 and pass 40 look the same.
// No SVG filters or blend modes; motion is transform/opacity; reduced motion shows the settled frame.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { f1, reduced, rnd, segments, stations } from './machineKit';
import { BombArt, Face, Marquee, MarqueeStrip, PassBar, passLabel, type Seat } from '../components/Machine';

const TEX = '/textures/';
const abs = { position: 'absolute' } as const;
const FULL = { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 } as const;
const COLS = 72, PITCH = 14;

/** B3: everything that builds is a function of the PASS COUNT, capped at 10. Never the fuse. */
function tension(p: number) {
  const t = Math.min(Math.max(p, 0), 10) / 10, L = (a: number, b: number) => +(a + (b - a) * t).toFixed(3);
  return { step: L(.085, .035), flicker: Math.round(L(6100, 1800)), dip: L(.45, .12), pulse: L(1.3, .5), jit: L(.3, 1.5), jitT: L(.9, .35), sweep: Math.round(L(4200, 1300)) };
}

// ---- the room: depends on the player count only
function room(n: number) {
  const area = n <= 9 ? { x: 60, y: 790, w: 1800, h: 280 } : { x: 60, y: 614, w: 1800, h: 452 };
  const raw = stations(n, area);
  const two = raw.rows === 2;
  const rail = { y: raw.top - 30, x: Math.min(...raw.map(s => s.x)) - 20, w: 0 };
  rail.w = Math.max(...raw.map(s => s.x + s.w)) + 20 - rail.x;
  const sc = Math.max(.84, Math.min(1.1, (rail.y - 400) / 270));
  const bw = Math.round(400 * sc), bh = Math.round(270 * sc);
  const clampX = (cx: number) => Math.max(bw / 2 + 24, Math.min(1896 - bw / 2, cx));
  const B0 = rail.y - (two ? 170 : 210), B1 = rail.y + 16;
  const bx0 = 360, bx1 = 1560, fx0 = 110, fx1 = 1810;
  const onBench = (u: number, w: number) => { const y = B0 + (B1 - B0) * w, xl = bx0 + (fx0 - bx0) * w, xr = bx1 + (fx1 - bx1) * w; return { x: f1(xl + (xr - xl) * u), y: f1(y) }; };
  const bench = {
    back: B0, front: B1,
    top: `M${bx0} ${B0} L${bx1} ${B0} L${fx1} ${B1} L${fx0} ${B1} Z`,
    apron: `M${fx0} ${B1} L${fx1} ${B1} L${fx1} ${B1 + 80} L${fx0} ${B1 + 80} Z`,
    lip: `M${fx0 + 4} ${B1 - 4} L${fx1 - 4} ${B1 - 4}`,
    marks: [[.2, .5, 90], [.62, .35, 120], [.85, .7, 70], [.4, .8, 60], [.08, .25, 50]].map(([u, w, r], i) => ({ ...onBench(u, w), rx: r, ry: f1(r * .32), o: +(.35 + rnd(i + 5) * .3).toFixed(2) })),
    scratches: Array.from({ length: 34 }, (_, i) => { const p = onBench(rnd(i + 200), rnd(i + 300) * .9 + .05), a = (rnd(i + 400) - .5) * .8, l = 20 + rnd(i + 500) * 70; return `M${p.x} ${p.y}l${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l * .4)}`; }).join(''),
    floorLines: `M0 ${B0 + 40} L${bx0 - 30} ${B0 + 40} M${bx1 + 30} ${B0 + 40} L1920 ${B0 + 40}`,
  };
  // the word sits once, centred, dark on the lit steel
  const wordSize = two ? 150 : 200, wordTop = Math.round(B0 - 46 - wordSize * .8), wordCy = Math.round(wordTop + wordSize * .4);
  const door = { s: two ? .62 : .78, x: 250, y: 0 }; door.y = Math.round(B0 - 272 * door.s * .72);
  const bolts = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return { x: f1(Math.cos(a) * 212), y: f1(Math.sin(a) * 212) }; });
  const flanges = [60, 260, 1540, 1760].flatMap(x => [{ x, y: 106, w: 16, h: 38 }, { x: x + 40, y: 142, w: 12, h: 26 }]).concat([{ x: 1482, y: B0 - 120, w: 42, h: 14 }, { x: 1482, y: 300, w: 42, h: 14 }]);
  const bags: { d: string; hi: string; seam: string; c: string }[] = [];
  const bagBottom = B0 + (two ? 34 : 56), bagH = two ? 38 : 46, bagW = two ? 96 : 112;
  ([[3, 0], [3, .5], [2, 1]] as const).forEach(([count, offset], row) => {
    for (let k = 0; k < count; k++) {
      const x = 20 + (k + offset) * bagW, y = bagBottom - (row + 1) * (bagH - 6), w = bagW, h = bagH, j = rnd(row * 9 + k) * 6;
      bags.push({
        d: `M${x + 8} ${y + 6 + j * .3} Q${x + w / 2} ${y - 6 + j} ${x + w - 8} ${y + 6} Q${x + w + 6} ${y + h / 2} ${x + w - 8} ${y + h - 2} Q${x + w / 2} ${y + h + 6} ${x + 8} ${y + h - 2} Q${x - 6} ${y + h / 2} ${x + 8} ${y + 6 + j * .3} Z`,
        hi: `M${x + 16} ${y + 8} Q${x + w / 2} ${y} ${x + w - 20} ${y + 8}`, seam: `M${x + 18} ${y + h / 2} H${x + w - 18}`, c: ['#6b6a52', '#5e5e48', '#77755b'][(row + k) % 3],
      });
    }
  });
  const props = { s: two ? .6 : .8, x: 0, y: 0 }; props.x = 1920 - 300 * props.s - 40; props.y = Math.round(B0 + (two ? 40 : 70) - 200 * props.s);
  const rigW = COLS * PITCH + 44, rig = { l: Math.round(960 - rigW / 2), r: Math.round(960 + rigW / 2), top: 26 };
  return {
    raw, two, rail, bw, bh, clampX, bench, wordSize, wordTop, wordCy, door, bolts, flanges, bags, bagTape: `translate(40 ${bagBottom - 2.2 * bagH}) rotate(-9)`, props,
    signY: Math.max(240, wordTop - 20), rig, ctr: { x: 1548, y: 34, w: 300 }, beacon: { x: 960, y: 250, angle: 28 },
    rust: Array.from({ length: 9 }, (_, i) => ({ x: Math.round(rnd(i + 700) * 1860), y: Math.round(180 * Math.floor(rnd(i + 710) * 3) + 6), w: Math.round(10 + rnd(i + 720) * 26), h: Math.round(80 + rnd(i + 730) * 160) })),
  };
}
const TUBES = [{ x: 540, y: 214, w: 330 }, { x: 1050, y: 214, w: 330 }];
const ZERO = segments('0', { h: 66 });
const HANG = [
  { d: 'M-20 190 C 160 300, 380 240, 470 120', w: 9, hi: '#3a4642' },
  { d: 'M1940 200 C 1820 290, 1640 250, 1560 140', w: 10, hi: '#3a4642' },
  { d: 'M460 164 C 520 250, 610 250, 700 214', w: 6, hi: '#2f3a37' },
];
const SWEEP_BG = 'conic-gradient(from 0deg, transparent 0deg, rgba(255,50,24,.14) 12deg, rgba(255,60,30,.22) 18deg, rgba(255,50,24,.14) 24deg, transparent 40deg, transparent 180deg, rgba(255,50,24,.14) 192deg, rgba(255,60,30,.22) 198deg, rgba(255,50,24,.14) 204deg, transparent 220deg, transparent 360deg)';

// ---- the blast, around a centre x (the loser's station) on the rail
function blast(cx: number, railY: number, bh: number) {
  const R = Math.round(Math.min(380, Math.max(280, bh * 1.25)));
  const x = Math.round(Math.max(R + 40, Math.min(1920 - R - 40, cx))), y = Math.round(railY - bh * .62);
  const star = (r: number, k: number, seed: number) => { let d = ''; const N = 18; for (let i = 0; i < N * 2; i++) { const a = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2 + (rnd(i + seed) - .5) * .08; const rr = r * (i % 2 ? k : 1) * (.82 + rnd(i * 3 + seed) * .3); d += (i ? 'L' : 'M') + f1(Math.cos(a) * rr) + ' ' + f1(Math.sin(a) * rr * .9); } return d + 'Z'; };
  const layers = [star(R * 1.05, .58, 5), star(R, .58, 5), star(R * .78, .6, 17), star(R * .55, .62, 29), star(R * .28, .66, 41)];
  const smoke = [[-.34, -.74, .2], [.02, -.86, .22], [.4, -.72, .19], [-.8, -.2, .16], [.82, -.24, .16], [-.6, .3, .14], [.64, .28, .14]]
    .map(([sx, sy, r], i) => ({ x: f1(sx * R), y: f1(sy * R), r: f1(r * R), c: i % 2 ? '#26211e' : '#342d29', dx: f1(sx * R * .6), dy: f1(sy * R * .6 - 70) }));
  // debris: the apex (mid-air) and where each piece comes to REST on the bench (local px of the burst box)
  const ox = x - R * 1.4, oy = y - R * 1.4;
  const debris = ([
    { kind: 'stick', a: -150, d: 1.12, rot: 172, s: 1.1, rx: -300, ry: 30 }, { kind: 'stick', a: -48, d: 1.02, rot: -6, s: 1, rx: 230, ry: 58 },
    { kind: 'wire', a: -120, d: .98, rot: 4, s: 1, c: '#3a78d8', rx: -150, ry: 70 }, { kind: 'wire', a: 200, d: 1.05, rot: -8, s: .9, c: '#e8c53a', rx: 340, ry: 24 },
    { kind: 'plate', a: -18, d: 1.18, rot: 10, s: 1.2, rx: 60, ry: 40 }, { kind: 'stick', a: 170, d: 1.25, rot: 186, s: .85, rx: -440, ry: 64 },
  ] as { kind: string; a: number; d: number; rot: number; s: number; c?: string; rx: number; ry: number }[]).map(o => {
    const a = o.a * Math.PI / 180, dd = R * o.d;
    const px = Math.max(60, Math.min(1860, x + o.rx)) - ox, py = railY - 10 - o.ry - oy;
    const ax = R * 1.4 + Math.cos(a) * dd, ay = R * 1.4 + Math.sin(a) * dd * .9;
    return { ...o, x: f1(px), y: f1(py), cx: f1(R * 1.4 - px), cy: f1(R * 1.4 - py), ax: f1(ax - px), ay: f1(ay - py) };
  });
  return { x, y, r: R, layers, smoke, debris };
}

export function BombTV({ players, holder, prev, passes, boom }: {
  players: Seat[]; holder: string | null; prev: string | null; passes: number; boom: boolean;
}) {
  const n = Math.max(1, players.length);
  const R = useMemo(() => room(n), [n]);
  const found = players.findIndex(p => p.id === holder), hi = Math.max(0, found);   // no holder yet: no bomb, no amber
  const pi = boom ? -1 : players.findIndex(p => p.id === prev);
  const tn = tension(passes);
  const still = reduced();
  const H = R.raw[hi], PV = pi >= 0 ? R.raw[pi] : null;
  const bx = R.clampX(H.cx);
  const bomb = { x: bx - R.bw / 2, y: R.rail.y + 10 - R.bh };
  const burst = useMemo(() => blast(H.cx, R.rail.y, R.bh), [H.cx, R.rail.y, R.bh]);
  const from = PV ? PV.cx - H.cx : 0;
  const root = useRef<HTMLDivElement>(null);
  const q = (s: string) => [...(root.current?.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`) ?? [])];

  // the boom: the stations light red at the blast (before it: the holder amber, the rest off); the bomb unmounts once it's gone
  const [red, setRed] = useState(boom);
  const [settled, setSettled] = useState(false);

  // the beacon turns for ever; its speed follows passes (and races in the boom)
  const sweepA = useRef<Animation | null>(null);
  useEffect(() => {
    const el = q('sweep')[0];
    if (!el || still) return;
    const a = el.animate([{ transform: `rotate(${R.beacon.angle}deg)` }, { transform: `rotate(${R.beacon.angle + 360}deg)` }], { duration: 4200, iterations: Infinity });
    sweepA.current = a;
    return () => { a.cancel(); sweepA.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
  useEffect(() => { sweepA.current?.updatePlaybackRate(boom ? 2.2 : 4200 / tn.sweep); }, [boom, tn.sweep]);

  // the tubes flicker, more often and deeper with passes (live only: the boom blows them)
  useEffect(() => {
    if (still || boom) return;
    const A = q('tube').map((el, i) => el.animate(
      [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: tn.dip, offset: .84 }, { opacity: 1, offset: .88 }, { opacity: (1 + tn.dip) / 2, offset: .93 }, { opacity: 1 }],
      { duration: Math.round(tn.flicker * (1 + i * .23)), iterations: Infinity, easing: 'steps(1,end)' }));
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, boom, tn.flicker, tn.dip]);

  // B2: a pass. The bomb is drawn at the new holder; it slides in from the old one's detent, overshoots and settles.
  const lastHolder = useRef(holder);
  useLayoutEffect(() => {
    const old = lastHolder.current; lastHolder.current = holder;
    if (still || boom || !old || old === holder) return;
    const oi = players.findIndex(p => p.id === old);
    if (oi < 0) return;
    const off = R.clampX(R.raw[oi].cx) - bx, dir = Math.sign(-off) || 1;
    const A: Animation[] = [];
    const b = q('bomb')[0];
    if (b) A.push(b.animate([{ transform: `translateX(${off}px)` }, { transform: `translateX(${dir * 18}px)`, offset: .72 }, { transform: 'translateX(0)' }],
      { duration: Math.round(420 + Math.abs(off) * .28), easing: 'cubic-bezier(.55,0,.25,1)' }));
    q('lines').forEach(e => A.push(e.animate([{ opacity: 0 }, { opacity: .7, offset: .25 }, { opacity: 0 }], { duration: 900 })));
    q('skid').forEach(e => A.push(e.animate([{ opacity: 0 }, { opacity: .9, offset: .3 }, { opacity: .35 }], { duration: 1400 })));
    q('glow')[hi] && A.push(q('glow')[hi].animate([{ opacity: 0 }, { opacity: 1 }, { opacity: .15 }, { opacity: 1 }], { duration: 360, easing: 'steps(1,end)' }));
    q('noret').forEach(e => A.push(e.animate([{ opacity: 0, transform: 'translateX(-50%) rotate(-7deg) scale(1.7)' }, { opacity: 1, transform: 'translateX(-50%) rotate(-7deg) scale(1)' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' })));
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder]);

  // B4: BOOM. One 2.6s timeline; every element holds its end frame (which is also what the reduced-motion render shows).
  useLayoutEffect(() => {
    if (!boom) return;
    if (still) { setRed(true); setSettled(true); return; }
    const P = 2600, B = 330;
    const A: Animation[] = [], T: number[] = [], clones: HTMLElement[] = [];
    const tl = (el: Element | undefined | null, keys: [number, Keyframe, string?][], step = false) => {
      if (!el) return;
      const kf: Keyframe[] = keys.map(([ms, p, e], k) => ({ ...p, offset: Math.min(1, ms / P), easing: e || (step || k === 0 ? 'steps(1,end)' : 'linear') }));
      if ((kf[0].offset as number) > 0) kf.unshift({ ...kf[0], offset: 0 });
      if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...kf[kf.length - 1], offset: 1 });
      A.push(el.animate(kf, { duration: P, fill: 'both' }));
    };
    setRed(false); T.push(window.setTimeout(() => setRed(true), B));
    const tr = (x: number, y: number, s = 1) => ({ transform: `translate(${x}px,${y}px) scale(${s})` });
    tl(q('marquee')[0], [[0, { opacity: 1 }], [B, { opacity: 0 }]], true);
    tl(q('mqBoom')[0], [[0, { opacity: 0, transform: 'translateY(-28px)' }], [1150, { opacity: 1, transform: 'translateY(-28px)' }], [1220, { opacity: 1, transform: 'translateY(-14px)' }],
      [1290, { opacity: 1, transform: 'translateY(0px)' }], [1500, { opacity: 0, transform: 'translateY(0px)' }], [1580, { opacity: 1, transform: 'translateY(0px)' }],
      [1660, { opacity: 0, transform: 'translateY(0px)' }], [1740, { opacity: 1, transform: 'translateY(0px)' }]], true);
    tl(q('bomb')[0], [[0, { opacity: 1, ...tr(0, 0) }], [70, { opacity: 1, ...tr(-5, 2) }], [140, { opacity: 1, ...tr(6, -2) }], [210, { opacity: 1, ...tr(-8, 3) }],
      [270, { opacity: 1, ...tr(0, 0, 1.08) }], [B, { opacity: 0, ...tr(0, 0, 1.2) }]], true);
    tl(q('flash')[0], [[0, { opacity: 0 }], [B, { opacity: 1 }, 'steps(1,end)'], [B + 90, { opacity: 1 }, 'ease-out'], [B + 560, { opacity: 0 }]]);
    tl(q('shake')[0], [[0, tr(0, 0)], [B, tr(-16, 9)], [B + 70, tr(14, -11)], [B + 140, tr(-10, 7)], [B + 210, tr(6, -4)], [B + 280, tr(-3, 2)], [B + 350, tr(0, 0)]], true);
    // two red flashes in ~0.6s (photosensitivity: at most 3 a second)
    tl(q('redroom')[0], [[0, { opacity: 0 }], [B + 20, { opacity: 1 }], [B + 300, { opacity: .35 }], [B + 600, { opacity: 1 }]], true);
    tl(q('scorchRoom')[0], [[0, { opacity: 0 }], [B + 60, { opacity: 0 }, 'ease-out'], [B + 700, { opacity: 1 }]]);
    q('tube').forEach((el, i) => tl(el, [[0, { opacity: 1 }], [B + 30 * i, { opacity: 0 }], [B + 350, { opacity: .5 }], [B + 520, { opacity: .1 }]], true));
    tl(q('burst')[0], [[0, { opacity: 0, transform: 'scale(.15)' }], [B, { opacity: 1, transform: 'scale(.15)' }, 'cubic-bezier(.2,1.4,.4,1)'], [B + 320, { opacity: 1, transform: 'scale(1)' }],
      [1500, { opacity: 1, transform: 'scale(1.03)' }, 'ease-in'], [2200, { opacity: 0, transform: 'scale(1.2)' }]]);
    q('puff').forEach((el, i) => { const dx = +el.dataset.dx!, dy = +el.dataset.dy!, s = B + 60 + i * 30;
      tl(el, [[0, { opacity: 0, ...tr(0, 0, .3) }], [s, { opacity: .95, ...tr(0, 0, .5) }, 'cubic-bezier(.2,.8,.4,1)'], [2400, { opacity: 0, ...tr(dx, dy, 1.6) }]]); });
    // debris: out of the blast to an apex, then it FALLS and lies on the bench (deadpan)
    q('deb').forEach((el, i) => { const d = el.dataset, spin = i % 2 ? 1 : -1;
      const at = (x: number | string, y: number | string, r: number, sc = 1) => ({ transform: `translate(${x}px,${y}px) rotate(${r}deg) scale(${sc})` });
      tl(el, [[0, { opacity: 0, ...at(d.cx!, d.cy!, 0, .3) }], [B + 10, { opacity: 1, ...at(d.cx!, d.cy!, 0, .3) }, 'cubic-bezier(.1,.8,.3,1)'],
        [B + 380, { opacity: 1, ...at(d.ax!, d.ay!, spin * 200) }, 'cubic-bezier(.5,0,1,.6)'], [B + 880 + i * 30, { opacity: 1, ...at(0, 0, spin * 360) }, 'ease-out'],
        [B + 960 + i * 30, { opacity: 1, ...at(0, -14, spin * 360) }, 'ease-in'], [B + 1040 + i * 30, { opacity: 1, ...at(0, 0, spin * 360) }]]); });
    // every lamp flicks red: a dark "unlit" copy over each lamp blinks away, rippling out from the holder; the glows follow
    q('station').forEach((stEl, i) => {
      const lamp = stEl.querySelector<HTMLElement>('.mk-lamp'); if (!lamp) return;
      const off = lamp.cloneNode() as HTMLElement;
      off.style.cssText = `position:absolute;left:${lamp.offsetLeft}px;top:${lamp.offsetTop}px;margin:0;--mk-l:#3b1410;--mk-lh:#5a241c;--mk-lg:transparent`;
      lamp.parentNode!.appendChild(off); clones.push(off);
      const d = B + Math.abs(i - hi) * 35;
      tl(off, [[0, { opacity: 1 }], [d, { opacity: 0 }], [d + 300, { opacity: 1 }], [d + 420, { opacity: 0 }]], true);
      tl(stEl.querySelector('[data-fx="glow"]'), [[0, { opacity: 0 }], [d, { opacity: 1 }], [d + 300, { opacity: .2 }], [d + 420, { opacity: 1 }]], true);
    });
    // the loser: the station slams up scorched, the floor cone vanishes and lands on their head, the tag drops on
    tl(q('station')[hi], [[0, { transform: 'scale(1)' }], [900, { transform: 'scale(1)' }, 'cubic-bezier(.3,1.8,.5,1)'], [1080, { transform: 'scale(1.24)' }, 'ease-out'], [1200, { transform: 'scale(1.15)' }]]);
    tl(q('scorch')[0], [[0, { opacity: 0 }], [900, { opacity: 0 }], [960, { opacity: 1 }]], true);
    tl(q('soot')[0], [[0, { opacity: 0 }], [900, { opacity: 0 }], [960, { opacity: 1 }]], true);
    tl(q('floorCone')[0], [[0, { opacity: 1 }], [1120, { opacity: 0 }]], true);
    tl(q('cone')[0], [[0, { opacity: 0, transform: 'translateY(-320px) rotate(-60deg) scale(1.6)' }], [1120, { opacity: 1, transform: 'translateY(-320px) rotate(-60deg) scale(1.6)' }, 'cubic-bezier(.6,0,.9,.6)'],
      [1300, { opacity: 1, transform: 'translateY(0px) rotate(-13deg) scale(1.15,.82)' }, 'cubic-bezier(.3,1.7,.5,1)'], [1440, { opacity: 1, transform: 'translateY(0px) rotate(-13deg) scale(1)' }]]);
    tl(q('wheel')[0], [[0, { opacity: 0, transform: 'rotate(6deg) scale(1.9)' }], [1560, { opacity: 1, transform: 'rotate(6deg) scale(1.9)' }, 'cubic-bezier(.3,1.5,.5,1)'], [1720, { opacity: 1, transform: 'rotate(6deg) scale(1)' }]]);
    // once it's all landed: drop the (hidden) bomb and the burst, so nothing keeps looping out of sight
    T.push(window.setTimeout(() => setSettled(true), P + 50));
    return () => { A.forEach(a => a.cancel()); T.forEach(clearTimeout); clones.forEach(c => c.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boom]);

  const { rail, bench, door, props } = R;
  const two = R.two;
  const showBomb = found >= 0 && (!boom || (!still && !settled));
  const drop = !boom && two && H.row === 1 ? { x: H.cx, h: H.y - rail.y - 34 } : null;

  return (
    <div ref={root} className="mgx mk-motion" style={{ ...FULL, overflow: 'hidden', isolation: 'isolate', background: '#0b0f0e', color: '#f1e8d4', fontFamily: "'Courier Prime', monospace" }}>
      <div data-fx="shake" style={{ ...abs, inset: 0 }}>
        {/* BLAST ROOM 3: riveted steel wall, seams, rust runs (posterised: hard stops, few values) */}
        <div style={{ ...abs, inset: 0, background: `radial-gradient(circle at 20px 12px, #8a9a93 0 2.5px, #0b0f0e 3.5px, transparent 4.5px) 0 0 / 40px 180px,
          radial-gradient(circle at 14px 20px, #8a9a93 0 2.5px, #0b0f0e 3.5px, transparent 4.5px) 0 0 / 240px 40px,
          repeating-linear-gradient(90deg, #070a09 0 4px, #4a5a54 4px 6px, transparent 6px 240px),
          repeating-linear-gradient(180deg, #070a09 0 4px, #4a5a54 4px 6px, transparent 6px 180px),
          linear-gradient(180deg, #26302d 0 30%, #212a27 30% 62%, #1a2220 62% 100%)` }} />
        {R.rust.map((r, i) => <div key={i} style={{ ...abs, left: r.x, top: r.y, width: r.w, height: r.h, background: 'linear-gradient(180deg, rgba(120,62,28,.34), rgba(120,62,28,.18) 40%, transparent)' }} />)}
        <div className="mk-concrete" style={{ ...abs, inset: 0, opacity: .2 }} />
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 700px 330px at 960px ${R.wordCy}px, rgba(205,245,225,.2) 0 42%, rgba(205,245,225,.11) 42% 70%, rgba(205,245,225,.05) 70% 100%, transparent 100%)` }} />
        <div style={{ ...abs, left: 0, right: 0, top: R.wordTop, textAlign: 'center', fontFamily: "'Big Shoulders Stencil Display', sans-serif", fontWeight: 900, fontSize: R.wordSize, lineHeight: .8, letterSpacing: '.06em', color: '#0a0e0d', opacity: .55, whiteSpace: 'nowrap' }}>BLAST ZONE</div>

        {/* pipes along the top and down the right-hand wall, and the hanging cables */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <g stroke="#000" strokeWidth="4">
            <rect x="-10" y="112" width="460" height="26" fill="#3b4a45" /><rect x="1470" y="112" width="460" height="26" fill="#3b4a45" />
            <rect x="-10" y="146" width="460" height="18" fill="#5a3a26" /><rect x="1470" y="146" width="460" height="18" fill="#5a3a26" />
            <rect x="1488" y="150" width="30" height={bench.back - 150} fill="#3b4a45" />
            {R.flanges.map((f, i) => <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} rx="3" fill="#56675f" />)}
          </g>
          <path d={`M-10 118 H450 M1470 118 H1930 M1494 150 V${bench.back}`} stroke="#a8bdb3" strokeWidth="3" opacity=".35" />
          <g fill="none" strokeLinecap="round">
            {HANG.map((c, i) => <g key={i}>
              <path d={c.d} stroke="#000" strokeWidth={c.w + 4} /><path d={c.d} stroke="#18201d" strokeWidth={c.w} />
              <path d={c.d} stroke={c.hi} strokeWidth="2" opacity=".5" transform="translate(0 -2)" />
            </g>)}
          </g>
        </svg>

        {/* THE BLAST DOOR: round, bolted, a hazard ring, a wheel, and NO EXIT */}
        <svg viewBox="-300 -300 600 600" style={{ ...abs, left: door.x - door.s * 300, top: door.y - door.s * 300, width: door.s * 600, height: door.s * 600, overflow: 'visible' }} aria-hidden="true">
          <defs>
            <linearGradient id="bm-door" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#56665f" /><stop offset=".45" stopColor="#56665f" /><stop offset=".45" stopColor="#3b4843" /><stop offset=".8" stopColor="#3b4843" /><stop offset=".8" stopColor="#252f2c" /></linearGradient>
            <pattern id="bm-haz3" width="40" height="40" patternUnits="userSpaceOnUse"><image href={TEX + 'hazard.png'} width="40" height="40" /></pattern>
          </defs>
          <rect x="228" y="-120" width="64" height="70" rx="6" fill="#2a3431" stroke="#000" strokeWidth="5" />
          <rect x="228" y="50" width="64" height="70" rx="6" fill="#2a3431" stroke="#000" strokeWidth="5" />
          <circle r="272" fill="#0b0f0e" stroke="#000" strokeWidth="6" />
          <circle r="252" fill="none" stroke="url(#bm-haz3)" strokeWidth="26" />
          <circle r="234" fill="url(#bm-door)" stroke="#000" strokeWidth="6" />
          <circle r="190" fill="#303c38" stroke="#000" strokeWidth="4" />
          <path d="M-150 -150 A 212 212 0 0 1 150 -150" stroke="#b8c8c0" strokeWidth="4" fill="none" opacity=".35" />
          {R.bolts.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r="11" fill="#8a9a93" stroke="#000" strokeWidth="3" />)}
          <g stroke="#000" strokeLinecap="round">
            <circle r="84" fill="none" strokeWidth="22" /><circle r="84" fill="none" stroke="#6f7f78" strokeWidth="14" />
            <path d="M-84 0 H84 M-42 -73 L42 73 M42 -73 L-42 73" strokeWidth="16" />
            <path d="M-84 0 H84 M-42 -73 L42 73 M42 -73 L-42 73" stroke="#56655f" strokeWidth="9" />
            <circle r="24" fill="#3a4642" strokeWidth="5" />
          </g>
          <text x="0" y="158" textAnchor="middle" fontFamily="Big Shoulders Stencil Display, sans-serif" fontWeight="900" fontSize="60" letterSpacing="6" fill="#c9311e" opacity=".8">NO EXIT</text>
        </svg>

        {/* "0 DAYS SINCE LAST INCIDENT": it never goes up */}
        <div style={{ ...abs, left: 1580, top: R.signY, width: 290, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: '#d9d2bf', borderRadius: 3, boxShadow: '0 0 0 3px #000, 0 12px 18px rgba(0,0,0,.7)', transform: 'rotate(1.5deg)' }}>
          <div className="mk-seg" style={{ padding: '8px 10px' }}>
            <svg viewBox={`0 0 ${ZERO.width} ${ZERO.height}`} width={ZERO.width} height={ZERO.height} aria-label="0">
              <path className="mk-seg-ghost" d={ZERO.ghost} /><path className="mk-seg-glow" d={ZERO.lit} /><path className="mk-seg-lit" d={ZERO.lit} />
            </svg>
          </div>
          <div style={{ fontFamily: "'Big Shoulders Stencil Display', sans-serif", fontWeight: 900, fontSize: 32, lineHeight: .92, letterSpacing: '.02em', color: '#15130f', textAlign: 'left' }}>DAYS SINCE<br />LAST<br />INCIDENT</div>
        </div>

        {/* the fluorescent tubes (cold; they flicker with passes and blow in the boom) */}
        {TUBES.map((t, i) => <div key={i}>
          <div style={{ ...abs, left: t.x + 40, top: t.y - 30, width: 3, height: 30, background: '#0b0f0e' }} />
          <div style={{ ...abs, left: t.x + t.w - 43, top: t.y - 30, width: 3, height: 30, background: '#0b0f0e' }} />
          <div style={{ ...abs, left: t.x, top: t.y, width: t.w, height: 28, borderRadius: 4, background: 'linear-gradient(180deg, #3a4642 0 50%, #1a2220 50%)', boxShadow: '0 0 0 2px #000, 0 10px 16px rgba(0,0,0,.6)' }}>
            <div data-fx="tube" style={{ ...abs, left: 12, right: 12, top: 16, height: 12, borderRadius: 6, background: 'linear-gradient(180deg, #ffffff 0 50%, #bff5dc 50%)', boxShadow: '0 0 0 1px #0b100e, 0 0 26px 8px rgba(190,255,225,.45)', opacity: boom ? .1 : 1 }} />
          </div>
        </div>)}

        {/* THE WORKBENCH: scarred steel with blast marks; a hazard kick-plate along the wall */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <defs>
            <linearGradient id="bm-bench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34403c" /><stop offset=".34" stopColor="#34403c" /><stop offset=".34" stopColor="#43514c" /><stop offset=".7" stopColor="#43514c" /><stop offset=".7" stopColor="#55655f" /></linearGradient>
            <pattern id="bm-haz4" width="44" height="44" patternUnits="userSpaceOnUse"><image href={TEX + 'hazard.png'} width="44" height="44" /></pattern>
          </defs>
          <rect x="0" y={bench.back - 40} width="1920" height="40" fill="url(#bm-haz4)" opacity=".75" />
          <path d={`M0 ${bench.back - 40} H1920 M0 ${bench.back} H1920`} stroke="#000" strokeWidth="4" />
          <rect x="0" y={bench.back + 2} width="1920" height={1080 - bench.back} fill="#101514" />
          <path d={bench.floorLines} stroke="#e8c53a" strokeWidth="10" opacity=".35" fill="none" />
          <path d={bench.top} fill="url(#bm-bench)" stroke="#000" strokeWidth="5" />
          <path d={bench.apron} fill="#1a2220" stroke="#000" strokeWidth="5" />
          <path d={bench.lip} stroke="#b8c8c0" strokeWidth="3" opacity=".45" fill="none" />
          {bench.marks.map((m, i) => <g key={i} opacity={m.o}><ellipse cx={m.x} cy={m.y} rx={m.rx} ry={m.ry} fill="#0b0f0e" /><ellipse cx={m.x} cy={m.y} rx={m.rx * .45} ry={m.ry * .45} fill="#050706" /></g>)}
          <path d={bench.scratches} stroke="#c9d6cf" strokeWidth="1.5" opacity=".28" fill="none" />
          {/* sandbags in front of the door, hazard tape slapped across the stack */}
          {R.bags.map((b, i) => <g key={i}>
            <path d={b.d} fill={b.c} stroke="#000" strokeWidth="4" />
            <path d={b.hi} stroke="#a9a78a" strokeWidth="4" fill="none" opacity=".6" strokeLinecap="round" />
            <path d={b.seam} stroke="#23241a" strokeWidth="3" fill="none" strokeDasharray="6 5" />
          </g>)}
          <g transform={R.bagTape}><rect x="0" y="0" width="330" height="34" fill="url(#bm-haz4)" stroke="#000" strokeWidth="3" /></g>
        </svg>

        {/* floor props: a mop bucket and THE traffic cone (in the boom it ends up on the loser's head) */}
        <svg viewBox="0 0 300 200" style={{ ...abs, left: props.x, top: props.y, width: props.s * 300, height: props.s * 200, overflow: 'visible' }} aria-hidden="true">
          <ellipse cx="150" cy="192" rx="150" ry="12" fill="#000" opacity=".6" />
          <path d="M58 30 L112 186" stroke="#000" strokeWidth="12" strokeLinecap="round" /><path d="M58 30 L112 186" stroke="#8a6a44" strokeWidth="6" strokeLinecap="round" />
          <path d="M20 96 H136 L126 190 H30 Z" fill="#e8c53a" stroke="#000" strokeWidth="5" />
          <path d="M20 96 H136 L134 116 H22 Z" fill="#b8961e" stroke="#000" strokeWidth="3" />
          <path d="M36 128 H120" stroke="#fff4c0" strokeWidth="4" opacity=".5" />
          <rect x="86" y="70" width="46" height="30" rx="4" fill="#3a4642" stroke="#000" strokeWidth="4" />
          <g data-fx="floorCone" style={{ opacity: boom ? 0 : 1 }}>
            <path d="M150 188 L286 188 L278 172 L158 172 Z" fill="#d4500c" stroke="#000" strokeWidth="5" />
            <path d="M212 20 Q218 14 224 20 L262 174 L174 174 Z" fill="#ff6a14" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            <path d="M198 76 L238 76 L246 108 L190 108 Z M186 128 L250 128 L256 150 L180 150 Z" fill="#f4efe4" stroke="#000" strokeWidth="3" />
          </g>
        </svg>

        {boom && <div data-fx="scorchRoom" style={{ ...abs, inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 560px 400px at ${burst.x}px ${burst.y}px, rgba(6,5,4,.85) 0 30%, rgba(10,8,6,.55) 30% 55%, rgba(10,8,6,.25) 55% 72%, transparent 72%), radial-gradient(ellipse 170px 90px at ${burst.x - 440}px ${burst.y + 160}px, rgba(6,5,4,.7) 0 50%, transparent 70%), radial-gradient(ellipse 200px 110px at ${burst.x + 460}px ${burst.y - 130}px, rgba(6,5,4,.6) 0 50%, transparent 70%)` }} />}

        {/* the beacon's sweep: two soft red beams, turned (transform only) */}
        <div data-fx="sweep" style={{ ...abs, left: R.beacon.x - 1300, top: R.beacon.y - 1300, width: 2600, height: 2600, pointerEvents: 'none', transform: `rotate(${R.beacon.angle}deg)`, background: SWEEP_BG }} />
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 64% 68% at 50% 50%, transparent 52%, rgba(0,0,0,.45) 80%, rgba(0,0,0,.8)), linear-gradient(90deg, rgba(0,0,0,.35), transparent 9%, transparent 91%, rgba(0,0,0,.35))' }} />
        {boom && <div data-fx="redroom" style={{ ...abs, inset: 0, pointerEvents: 'none', willChange: 'opacity', background: `radial-gradient(ellipse 60% 55% at ${burst.x}px ${burst.y}px, rgba(255,60,20,.26), rgba(160,10,0,.2) 55%, rgba(60,0,0,.35))` }} />}

        {/* THE RIG: hangers, the marquee, the pass counter, the beacon's bracket */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <g stroke="#000" strokeWidth="3" fill="#2a3431">
            <rect x={R.rig.l + 60} y="-10" width="16" height={R.rig.top + 14} /><rect x={R.rig.r - 76} y="-10" width="16" height={R.rig.top + 14} />
            <rect x={R.ctr.x + 40} y="-10" width="10" height={R.ctr.y + 14} /><rect x={R.ctr.x + R.ctr.w - 50} y="-10" width="10" height={R.ctr.y + 14} />
            <rect x={R.beacon.x - 8} y={R.rig.top + 150} width="16" height={R.beacon.y - R.rig.top - 150} />
          </g>
        </svg>
        <div style={{ ...abs, left: R.rig.l, top: R.rig.top }}>
          {boom
            ? <div className="mk-marquee" style={{ '--mk-pitch': PITCH + 'px' } as CSSProperties}>
                <div className="mk-marquee-screen" style={{ width: COLS * PITCH, height: 9 * PITCH }}>
                  <MarqueeStrip text="PASS IT." cols={COLS} fx="marquee" style={{ opacity: 0 }} />
                  <MarqueeStrip text="BOOM." cols={COLS} fx="mqBoom" />
                </div>
              </div>
            : <Marquee text="PASS IT." cols={COLS} scroll={!still} step={tn.step} fx="marquee" />}
        </div>

        {/* the pass counter: public, and the only live number on the board */}
        <div style={{ ...abs, left: R.ctr.x, top: R.ctr.y, width: R.ctr.w, boxSizing: 'border-box', padding: '14px 0 20px', borderRadius: 6, textAlign: 'center', background: 'linear-gradient(180deg,#2d3635,#151b1a 40%,#0c100f)', boxShadow: '0 0 0 2px #000, inset 0 2px 0 rgba(241,232,212,.14), 0 18px 30px rgba(0,0,0,.75)' }}>
          <div style={{ fontFamily: "'Big Shoulders Stencil Display', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: '.14em', lineHeight: 1, color: '#c9bfa8', marginBottom: 12 }}>PASSES</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}><PassBar passes={passes} /></div>
          <div style={{ marginTop: 12, fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 34, lineHeight: 1, letterSpacing: '.06em', color: '#ffcf8a' }}>{passLabel(passes)}</div>
        </div>

        {/* the caged red beacon */}
        <div style={{ ...abs, left: R.beacon.x - 160, top: R.beacon.y - 150, width: 320, height: 300, pointerEvents: 'none', background: 'radial-gradient(circle closest-side, rgba(255,70,40,.38) 0 22%, rgba(255,40,20,.12) 22% 55%, transparent 55%)' }} />
        <svg viewBox="-60 -60 120 96" style={{ ...abs, left: R.beacon.x - 60, top: R.beacon.y - 60, width: 120, height: 96, overflow: 'visible' }} aria-label="Warning beacon">
          <path d="M-30 16 V-10 A30 30 0 0 1 30 -10 V16 Z" fill={boom ? '#ff3a1e' : '#e0200e'} stroke="#000" strokeWidth="4" />
          <path d="M-30 16 V-10 A30 30 0 0 1 0 -40 V16 Z" fill="#ff7a5a" opacity=".55" />
          <path d="M-18 8 V-8 A18 18 0 0 1 -6 -24" stroke="#ffe2d8" strokeWidth="5" fill="none" opacity=".8" strokeLinecap="round" />
          <g stroke="#0b0f0e" strokeWidth="4" fill="none"><path d="M-35 16 V-12 A35 35 0 0 1 35 -12 V16" /><path d="M0 16 V-47 M-21 16 V-38 M21 16 V-38 M-35 -2 H35" /></g>
          <rect x="-42" y="14" width="84" height="18" rx="3" fill="#2a3431" stroke="#000" strokeWidth="4" />
        </svg>

        {/* THE RAIL: a steel track above the stations, one detent per player. The bomb rides it. */}
        <div style={{ ...abs, left: rail.x, top: rail.y, width: rail.w, height: 24, borderRadius: 4, background: 'repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 2px, transparent 2px 38px), linear-gradient(180deg, #7c878c, #3a4146 30%, #1b2023 70%, #0b0d0e)', boxShadow: '0 0 0 2px #000, inset 0 2px 0 rgba(241,232,212,.35), 0 12px 16px rgba(0,0,0,.8)' }} />
        {R.raw.map(s => <div key={s.i} style={{ ...abs, left: s.cx - 6, top: rail.y - 7, width: 12, height: 12, borderRadius: 2, boxShadow: '0 0 0 2px #000', background: s.i === hi ? '#ffb866' : s.i === pi ? '#f1e8d4' : '#5a646a' }} />)}

        {!boom && PV && <div data-fx="skid" style={{ ...abs, left: Math.min(PV.cx, H.cx), top: rail.y - 5, width: Math.abs(from), height: 9, borderRadius: 5, opacity: .35, background: `linear-gradient(${from < 0 ? '90deg' : '270deg'}, rgba(0,0,0,0), rgba(0,0,0,.85))` }} />}
        {drop && <>
          <div style={{ ...abs, left: drop.x - 4, top: rail.y + 20, width: 8, height: drop.h, zIndex: 4, borderRadius: 4, background: 'repeating-linear-gradient(180deg, #ffb866 0 14px, #1a0c00 14px 22px)', boxShadow: '0 0 0 2px #000, 0 0 14px 3px rgba(255,138,30,.6)' }} />
          <div style={{ ...abs, left: drop.x - 14, top: rail.y + 12 + drop.h, width: 0, height: 0, zIndex: 4, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '18px solid #ffb866' }} />
        </>}

        {/* THE BOMB (B1): a console on the rail above the holder */}
        {showBomb && <div data-fx="bomb" style={{ ...abs, left: bomb.x, top: bomb.y, width: R.bw, height: R.bh, zIndex: 3 }}>
          <svg viewBox="0 0 400 270" style={{ ...abs, inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
            <g data-fx="lines" opacity={still && PV ? .55 : 0} transform={from < 0 ? 'translate(0 0)' : 'translate(400 0) scale(-1 1)'} stroke="#f1e8d4" strokeWidth="7" strokeLinecap="round">
              <path d="M4 140 H-70" /><path d="M8 186 H-110" /><path d="M4 232 H-50" />
            </g>
          </svg>
          <div className="bm-jit" style={{ ...abs, inset: 0, transformOrigin: '50% 100%', '--jit': tn.jit, '--jit-t': tn.jitT + 's' } as CSSProperties}>
            <BombArt id="bm" />
          </div>
        </div>}

        {/* BOOM: the burst where the bomb was, smoke, and the debris that lands on the bench */}
        {boom && <div style={{ ...abs, left: burst.x - burst.r * 1.4, top: burst.y - burst.r * 1.4, width: burst.r * 2.8, height: burst.r * 2.8, zIndex: 0, pointerEvents: 'none' }}>
          {!still && !settled && <>
            <svg viewBox={`${-burst.r * 1.4} ${-burst.r * 1.4} ${burst.r * 2.8} ${burst.r * 2.8}`} style={{ ...abs, inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
              {burst.smoke.map((p, i) => <circle key={i} data-fx="puff" data-dx={p.dx} data-dy={p.dy} className="bm-puff" cx={p.x} cy={p.y} r={p.r} fill={p.c} stroke="#000" strokeWidth="6" opacity="0" />)}
            </svg>
            <svg data-fx="burst" viewBox={`${-burst.r * 1.4} ${-burst.r * 1.4} ${burst.r * 2.8} ${burst.r * 2.8}`} style={{ ...abs, inset: 0, width: '100%', height: '100%', overflow: 'visible', opacity: 0 }} aria-label="Boom">
              {burst.layers.map((d, i) => <path key={i} d={d} fill={['#000', '#e0200e', '#ff8a1e', '#ffe25a', '#fffbe8'][i]} />)}
            </svg>
          </>}
          <svg width="0" height="0" style={abs}><defs><linearGradient id="bm-stick-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7050" /><stop offset=".35" stopColor="#d8301c" /><stop offset="1" stopColor="#4e0904" /></linearGradient></defs></svg>
          {burst.debris.map((d, i) => (
            <div key={i} data-fx="deb" data-cx={d.cx} data-cy={d.cy} data-ax={d.ax} data-ay={d.ay} style={{ ...abs, left: d.x, top: d.y, width: 0, height: 0 }}>
              <svg viewBox="-60 -30 120 60" width={d.s * 120} height={d.s * 60} style={{ ...abs, left: -d.s * 60, top: -d.s * 30, transform: `rotate(${d.rot}deg)`, overflow: 'visible' }} aria-hidden="true">
                {d.kind === 'stick' && <>
                  <path d="M-50 -16 H30 L38 -10 L32 -2 L40 6 L30 16 H-50 A16 16 0 0 1 -50 -16 Z" fill="url(#bm-stick-d)" stroke="#000" strokeWidth="5" />
                  <ellipse cx="-50" cy="0" rx="9" ry="15" fill="#e9dcc0" stroke="#000" strokeWidth="3" />
                </>}
                {d.kind === 'wire' && <>
                  <path d="M-50 0 C -30 -30, -10 30, 10 0 S 40 -20, 50 6" fill="none" stroke="#000" strokeWidth="12" strokeLinecap="round" />
                  <path d="M-50 0 C -30 -30, -10 30, 10 0 S 40 -20, 50 6" fill="none" stroke={d.c} strokeWidth="7" strokeLinecap="round" />
                </>}
                {d.kind === 'plate' && <>
                  <path d="M-40 -24 L36 -20 L44 22 L-10 26 L-18 12 L-44 16 Z" fill="#3a4146" stroke="#000" strokeWidth="5" />
                  <path d="M-26 -10 H20 V10 H-26 Z" fill="#0b0101" stroke="#000" strokeWidth="3" />
                  <path d="M-20 0 H-6 M4 0 H16" stroke="#ff2b1a" strokeWidth="5" />
                </>}
              </svg>
            </div>
          ))}
        </div>}

        {/* THE STATIONS */}
        {R.raw.map(s => {
          const p = players[s.i];
          const hold = found >= 0 && s.i === hi, loser = boom && hold;
          const cls = found < 0 ? '' : boom ? (red ? 'is-red' : hold ? 'is-amber' : '') + (loser ? ' bm-loser' : '') : hold ? 'is-amber' : '';
          const above = R.raw.rows === 1 || s.row === 0;
          return (
            <div key={s.i} data-fx="station" className={'mk-station ' + cls} style={{ left: s.x, top: s.y, width: s.w, height: s.h, zIndex: s.z }}>
              <div data-fx="glow" className={'mk-station-glow' + (!boom && hold ? ' mk-pulse' : '')} style={{ animationDuration: tn.pulse + 's' }} />
              <div className="bm-ring" style={{ left: s.photoX - 11, top: s.photoY - 11, width: s.photo + 22, height: s.polH + 22 }} />
              <div className="mk-polaroid" style={{ left: s.photoX, top: s.photoY, width: s.photo, transform: `rotate(${s.tilt}deg)` }}>
                <div className="mk-photo">
                  <Face p={p} size={s.photo * .4} />
                  {loser && <svg data-fx="soot" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ...abs, inset: 0, width: '100%', height: '100%', zIndex: 2 }} aria-hidden="true">
                    <defs><radialGradient id="bm-soot" cx=".5" cy=".3" r=".8"><stop offset="0" stopColor="#2a1206" stopOpacity="0" /><stop offset=".65" stopColor="#1a0a04" stopOpacity=".25" /><stop offset="1" stopColor="#0a0402" stopOpacity=".7" /></radialGradient></defs>
                    <path d="M6 20 C 18 12, 30 22, 44 14 C 58 22, 76 10, 94 18 L 96 30 C 70 24, 30 32, 4 28 Z" fill="#120a06" opacity=".55" />
                    <path d="M10 64 C 18 74, 30 70, 24 80 C 14 84, 8 76, 10 64 Z M78 58 C 90 60, 92 72, 84 76 Z" fill="#120a06" opacity=".6" />
                    <rect width="100" height="100" fill="url(#bm-soot)" />
                  </svg>}
                </div>
              </div>
              <div className="mk-nameplate" style={{ top: s.nameY }}><span className="mk-lamp" /><span className="mk-name">{(p?.name ?? '?').toUpperCase()}</span></div>
              {loser && <>
                <div data-fx="scorch" style={{ ...abs, inset: -6, borderRadius: 8, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 30% at 50% 0%, rgba(14,8,4,.8), rgba(40,18,6,.3) 50%, transparent 80%), radial-gradient(circle at 12% 70%, rgba(10,6,4,.7), transparent 22%), radial-gradient(circle at 88% 58%, rgba(10,6,4,.6), transparent 20%)' }} />
                <svg data-fx="cone" viewBox="0 0 120 132" style={{ ...abs, left: s.photoX + s.photo * .12, top: s.photoY - s.photo * .7, width: s.photo * .8, height: s.photo * .88, transform: 'rotate(-13deg)', overflow: 'visible' }} aria-label="Traffic cone hat">
                  <path d="M8 124 L112 124 L106 112 L14 112 Z" fill="#000" transform="translate(5 6)" opacity=".5" />
                  <path d="M52 6 Q60 0 68 6 L96 112 L24 112 Z" fill="#ff6a14" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
                  <path d="M40 48 L80 48 L86 70 L34 70 Z" fill="#f4efe4" stroke="#000" strokeWidth="3" />
                  <path d="M30 86 L90 86 L94 100 L26 100 Z" fill="#f4efe4" stroke="#000" strokeWidth="3" />
                  <path d="M56 12 L44 60" stroke="#ffc08a" strokeWidth="5" strokeLinecap="round" opacity=".8" />
                  <rect x="6" y="110" width="108" height="16" rx="3" fill="#d4500c" stroke="#000" strokeWidth="6" />
                </svg>
                <div data-fx="wheel" className="bm-tag" style={{ left: above ? (s.x + s.w * .8 + 270 > 1900 ? Math.round(s.w * .2 - 270) : Math.round(s.w * .8)) : 6, top: above ? -104 : Math.round(s.nameY - 44), transform: 'rotate(6deg)', color: '#1a0c00', background: '#ff8a1e' }}>TO THE WHEEL</div>
              </>}
              {!boom && s.i === pi && <div data-fx="noret" className="bm-tag" style={{ left: s.w / 2, top: s.photoY + s.photo * .52, transform: 'translateX(-50%) rotate(-7deg)' }}>NO RETURNS</div>}
            </div>
          );
        })}

        <div className="mk-grit" style={{ opacity: .2, zIndex: 7 }} />
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 7, background: `url('${TEX}grain.png') 0 0 / 256px 256px`, opacity: .05 }} />
      </div>
      {boom && !still && <div data-fx="flash" className="bm-flash" />}
    </div>
  );
}
