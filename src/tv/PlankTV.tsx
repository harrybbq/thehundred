// Walk the Plank on the TV, ported from the approved mockup (design/mockups/Plank.dc.html).
//   live    everyone walks together: ONE shared screen-x, equal planks, the Kraken rising evenly at the shared
//           tip. This component is not given anyone's position until the reveal, so the TV cannot leak a stop.
//   reveal  the camera drops to a split waterline; each loser goes straight down from where they left the plank
//           (their tip if overboard, their stop if they were furthest back) into the Kraken's arms. 1-3 losers.
// Textures are baked (public/textures/, scripts/bake-textures.mjs). No SVG filters, no blend modes; everything
// that moves, moves by transform or opacity. Reduced motion shows the settled frame.
import { useEffect, useMemo, useRef } from 'react';
import shipSvg from './art/plank-ship.svg?raw';
import { initials } from '../lib/util';

export type PlankWalker = { id: string; name: string; photo: string | null };
export type PlankResult = { pos?: Record<string, number>; losers: string[]; overboard?: string[]; no_show?: boolean };

const TEX = '/textures/';
const f1 = (n: number) => n.toFixed(1);
const rnd = (i: number) => { const v = Math.sin(i * 12.9898 + 7.3) * 43758.5453; return v - Math.floor(v); };
type Pt = [number, number];
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A player's photo filling a polaroid (initials on a dark card when there's no selfie). */
function Face({ w }: { w: PlankWalker }) {
  return w.photo
    ? <img src={w.photo} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #2c6e74, #0f3a41 55%, #06191d)', color: '#e6f2ee', fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 52 }}>{initials(w.name)}</div>;
}

// ---- tentacle geometry: fat at the base, flat outlined suckers down the inside
function tent(N: number, f: (q: number) => [number, number, number], W: number) {
  const Lp: Pt[] = [], Rp: Pt[] = [], S: { x: number; y: number; r: string; ry: string; ri: string; rri: string }[] = [], C: Pt[] = [];
  for (let k = 0; k <= N; k++) {
    const q = k / N, [x, y, a] = f(q), w = W * Math.pow(1 - q, .9) + 6;
    Lp.push([x - Math.cos(a) * w, y - Math.sin(a) * w]); Rp.push([x + Math.cos(a) * w, y + Math.sin(a) * w]);
    C.push([x - Math.cos(a) * w * .5, y - Math.sin(a) * w * .5]);
    if (k % 3 === 1 && q < .86) { const r = Math.max(4, w * .36); S.push({ x: Math.round(x + Math.cos(a) * w * .5), y: Math.round(y + Math.sin(a) * w * .5), r: f1(r), ry: f1(r * .82), ri: f1(r * .45), rri: f1(r * .36) }); }
  }
  const pts = Lp.concat(Rp.reverse());
  return { d: 'M ' + pts.map(pp => pp.map(f1).join(' ')).join(' L ') + ' Z', S, sheen: 'M ' + C.slice(2, -5).map(pp => pp.map(f1).join(' ')).join(' L ') };
}
const UP = tent(30, q => { const y = 340 - q * 330, x = 80 + Math.sin(q * 5.2) * 30 * q; const dx = 30 * Math.sin(q * 5.2) + 30 * q * 5.2 * Math.cos(q * 5.2); return [x, y, Math.atan2(dx, 330)]; }, 56);
// a ribbon along a Catmull-Rom spine (the arms that drag the losers under)
function spline(P: Pt[], n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < n; s++) { const t = s / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as Pt); }
  }
  out.push(P[P.length - 1]);
  return out;
}
function ribbon(pts: Pt[], w0: number, w1: number, side: number) {
  const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const T = len[len.length - 1], Lp: Pt[] = [], Rp: Pt[] = [], S: { x: string; y: string; r: string; ri: string }[] = [], C: Pt[] = []; let next = 30;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    const nx = -dy / m, ny = dx / m, q = len[i] / T, w = (w1 + (w0 - w1) * Math.pow(1 - q, 1.1)) / 2;
    Lp.push([p[0] + nx * w, p[1] + ny * w]); Rp.push([p[0] - nx * w, p[1] - ny * w]);
    if (q > .04 && q < .8) C.push([p[0] - side * nx * w * .5, p[1] - side * ny * w * .5]);
    if (len[i] >= next && q < .86) { next += Math.max(20, w * 1.5); const r = Math.max(4, w * .34); S.push({ x: f1(p[0] + side * nx * w * .5), y: f1(p[1] + side * ny * w * .5), r: f1(r), ri: f1(r * .42) }); }
  });
  const e = pts[pts.length - 1];
  return { d: 'M ' + Lp.map(pp => pp.map(f1).join(' ')).join(' L ') + ` Q ${f1(e[0])} ${f1(e[1])} ` + Rp.reverse().map(pp => pp.map(f1).join(' ')).join(' L ') + ' Z', S, sheen: 'M ' + C.map(pp => pp.map(f1).join(' ')).join(' L ') };
}
// the crew watching from the foreground (flat silhouettes: a tricorn, a bandana, a parrot)
function head(hat: 'tri' | 'band' | 'none') {
  const body = 'M -120 200 Q -118 118 -66 96 Q -40 86 -34 60 Q -58 44 -58 8 Q -58 -44 0 -48 Q 58 -44 58 8 Q 58 44 34 60 Q 40 86 66 96 Q 118 118 120 200 Z';
  const hats = { tri: ' M -86 -22 Q -40 -30 0 -86 Q 40 -30 86 -22 Q 40 -46 0 -40 Q -40 -46 -86 -22 Z', band: ' M -60 -12 Q 0 -70 60 -12 L 84 -2 L 64 10 L 58 -2 Q 0 -24 -58 -2 Z', none: '' };
  return { d: body + hats[hat], sh: 'M 60 96 Q 112 116 118 190', rim: { tri: 'M -80 -24 Q -40 -34 0 -84', band: 'M -56 -14 Q 0 -66 56 -14', none: 'M -54 -6 Q -52 -44 0 -48 Q 40 -46 54 -10' }[hat] };
}
const PARROT = ' M 70 70 Q 60 30 84 16 Q 104 6 112 24 L 126 26 L 112 34 Q 116 60 96 82 Z';

// three planks off one hull, back to front (y's match the gunports in design/mockups/tools/ship.py).
// EQUAL planks: the same length and the same tip x. Depth shows only in thickness, haze and y.
const SLOTS = [
  { y: 436, L: 980, t: 12, s: .55, haze: .32 },
  { y: 612, L: 980, t: 18, s: .75, haze: .16 },
  { y: 826, L: 980, t: 28, s: 1, haze: 0 },
];
const X0 = 398, WALK_X = X0 + .6 * 980;          // THE RULE: until the reveal, one shared screen-x for everyone
const DROP = 140, SURF = 990;                     // camera drop at the reveal; the cutaway's surface line
const bend = (a: number, d: number) => (xr: number) => xr <= a ? d * (xr / a) ** 2 * (3 - xr / a) / 2 : d + 1.5 * d / a * (xr - a);

function layout(walkers: PlankWalker[], result: PlankResult | null) {
  const reveal = !!result;
  const slots = SLOTS.slice(SLOTS.length - Math.min(3, walkers.length));
  const P = walkers.slice(0, 3).map((w, i) => {
    // only at the reveal: the server's result (a no-show has no position: they went in off the end)
    const pos = reveal ? (result!.pos?.[w.id] ?? 110) : 0;
    return { ...slots[i], w, pos };
  });
  const lost = P.map(p => reveal && result!.losers.includes(p.w.id));
  const over = P.map(p => reveal && (p.pos > 100 || !!result!.overboard?.includes(p.w.id)));
  const anyOver = P.some((_, i) => lost[i] && over[i]);
  const planks = P.map((p, i) => {
    const L = p.L, t = p.t;
    const a = reveal ? Math.max(60, Math.min(L, L * p.pos / 100)) : WALK_X - X0;     // the load's distance along the plank
    const d = reveal && lost[i] ? 0 : 12 * p.s;                                      // the taken ones leave the plank springing back
    const dy = bend(a, d), N = 24, xs = Array.from({ length: N + 1 }, (_, k) => k / N * L);
    const top: Pt[] = xs.map(xr => [X0 + xr, p.y + dy(xr)]), bot: Pt[] = xs.map(xr => [X0 + xr, p.y + t + dy(xr)] as Pt).reverse();
    const pl = (pts: Pt[]) => pts.map(q => q.map(f1).join(' ')).join(' L ');
    const tx = X0 + L, ty = p.y + dy(L);
    const dz = xs.filter(xr => xr >= .86 * L);
    return {
      d: 'M ' + pl(top) + ' L ' + pl(bot) + ' Z',
      hi: 'M ' + pl(top.slice(1, -1).map(([x, y]) => [x, y + 2] as Pt)),
      shadow: 'M ' + pl(top.map(([x, y], k) => [x - k, y + t + 22 + k * .6] as Pt)) + ' L ' + pl(top.map(([x, y], k) => [x - k, y + t + 36 + k * .6] as Pt).reverse()) + ' Z',
      danger: reveal ? '' : 'M ' + pl(dz.map(xr => [X0 + xr, p.y + dy(xr)] as Pt)) + ' L ' + pl(dz.map(xr => [X0 + xr, p.y + t + dy(xr)] as Pt).reverse()) + ' Z',
      ow: f1(3 + p.s * 1.5), haze: p.haze,
      tipX: f1(tx), tipY: f1(ty + t / 2), tipRx: f1(3 + t * .18), tipRy: f1(t / 2),
      tx, ty, px: X0 + a, py: p.y + d, s: p.s, slope: Math.atan(1.5 * d / a) * 180 / Math.PI,
    };
  });
  // LIVE: two tentacle tips at every plank end, rising together (the shared walk, never anyone's stop)
  const tentacles = reveal ? [] : planks.flatMap(p => {
    const k = p.s;
    return [
      { x: Math.round(p.tx - 70 * k), y: Math.round(p.ty - 250 * k), w: Math.round(170 * k), h: Math.round(330 * k), tf: 'rotate(-8deg)', sw: f1(5 * 160 / (170 * k)), ssw: f1(2.5 * 160 / (170 * k)) },
      { x: Math.round(p.tx + 84 * k), y: Math.round(p.ty - 170 * k), w: Math.round(140 * k), h: Math.round(260 * k), tf: 'scaleX(-1) rotate(-6deg)', sw: f1(5 * 160 / (140 * k)), ssw: f1(2.5 * 160 / (140 * k)) },
    ];
  });
  const churns = reveal ? [] : planks.map(p => ({ x: Math.round(p.tx - 110 * p.s), y: Math.round(p.ty + 48 * p.s), w: Math.round(330 * p.s), h: Math.round(64 * p.s) }));
  const standing = P.map((p, i) => ({ p, i })).filter(({ i }) => !lost[i]).map(({ p, i }) => {
    const pl = planks[i];
    return { w: p.w, x: Math.round(pl.px - 64), y: Math.round(pl.py - 148 + 4), tilt: f1(pl.slope) };
  });

  // REVEAL: each loser straight down from where they left the plank; overboard ones fan out under the water
  const takenIdx = P.map((_, i) => i).filter(i => lost[i]);
  const n = takenIdx.length;
  const CT = SURF - 112;
  const FAN: Record<number, number[]> = { 1: [0], 2: [-170, 170], 3: [-330, 330, 0] };
  const fan = FAN[n] ?? [];
  const drops = takenIdx.map((i, j) => {
    const pl = planks[i], slotIdx = SLOTS.indexOf(SLOTS.find(s => s.y === P[i].y)!);
    const x = Math.round(over[i] ? pl.tx : pl.px);
    return { i, x, cx: x + (over[i] ? (n === 3 ? fan[slotIdx] : fan[j]) : 0), y: (over[i] ? pl.ty : pl.py) - 24, k: .6 + pl.s * .5 };
  });
  // a tie for furthest back takes more than one off the planks at the same spot: spread any cards that would
  // land closer than a card's width apart, around where they'd have been
  const byX = [...drops].sort((a, b) => a.cx - b.cx);
  for (let pass = 0; pass < 3; pass++) for (let k = 1; k < byX.length; k++) {
    const gap = byX[k].cx - byX[k - 1].cx;
    if (gap < 290) { const push = (290 - gap) / 2; byX[k - 1].cx -= push; byX[k].cx += push; }
  }
  drops.forEach(d => { d.cx = Math.round(Math.max(240, Math.min(1780, d.cx))); });
  const splashes = drops.map(({ x, y, k }) => ({ x: Math.round(x - 120 * k), y: Math.round(y + 12 - 100 * k), w: Math.round(240 * k), h: Math.round(120 * k) }));
  const trail = drops.flatMap(({ x, cx, y }, j) => { const out: { x: number; y: number; r: number }[] = [], y0 = y + 94, y1 = CT - 12; for (let yy = y0, b = 0; yy < y1; yy += 32, b++) { const u = (yy - y0) / Math.max(1, y1 - y0), e = u * u * (3 - 2 * u); out.push({ x: Math.round(x + (cx - x) * e - 8 + Math.sin(b * 1.9 + j) * 8), y: Math.round(yy), r: 8 + (b % 3) * 4 }); } return out; });
  const ex = 600, ey = SURF + 92;
  const sunk: { w: PlankWalker; x: number; y: number; wet: number; nx: number; ny: number; bubbles: { x: number; y: number; r: number }[] }[] = [];
  const arms: ReturnType<typeof ribbon>[] = [], collars: string[] = [];
  drops.forEach(({ i: pi, cx }, j) => {
    const ty = CT;
    const bubbles = Array.from({ length: 5 }, (_, b) => ({ x: Math.round(cx + 104 + Math.sin(b * 1.7 + j) * 10), y: Math.round(ty + 140 - b * 24), r: Math.round(9 + (b % 3) * 5) }));
    sunk.push({ w: P[pi].w, x: cx - 64, y: ty, wet: SURF - ty + 2, nx: cx + 34, ny: ty + 170, bubbles });
    const sx = ex + 300 + j * 70, low = SURF + 290 + j * 18;           // a further card's arm leaves lower and further right: no crossings
    const spine: Pt[] = [[sx, SURF + 330], [(sx + cx - 124) / 2 + 20, low], [cx - 124, ty + 214], [cx - 104, ty + 150], [cx - 46, ty + 120], [cx + 30, ty + 118], [cx + 84, ty + 106], [cx + 100, ty + 80], [cx + 84, ty + 58], [cx + 62, ty + 70]];
    arms.push(ribbon(spline(spine, 12), 128, 24, 1));
    let c = `M ${cx - 104} ${SURF + 4}`;
    ([[-86, -12], [-64, -4], [-40, -14], [-14, -5], [12, -15], [38, -5], [62, -13], [86, -4], [104, 4]] as Pt[]).forEach(([dx, dy], m) => { c += ` Q ${cx + dx - 11} ${SURF + dy - 6} ${cx + dx} ${SURF + (m % 2 ? dy : 2)}`; });
    collars.push(c + ` Q ${cx} ${SURF + 22} ${cx - 104} ${SURF + 4} Z`);
  });
  const look = n ? .8 : 0, HW = 270, ER = 180, IR = 66;
  const kr = {
    head: `M ${ex - HW - 40} 1360 C ${ex - HW} ${ey - 30} ${ex - 220} ${ey - 86} ${ex} ${ey - 88} C ${ex + 220} ${ey - 86} ${ex + HW} ${ey - 30} ${ex + HW + 40} 1360 Z`,
    rim: `M ${ex - HW + 16} ${ey + 4} C ${ex - HW + 40} ${ey - 56} ${ex - 190} ${ey - 80} ${ex - 40} ${ey - 82}`,
    spots: [[-222, 50, 18], [-250, 108, 13], [226, 44, 20], [252, 104, 12], [-170, -58, 10], [176, -56, 9]].map(([dx, dy, r]) => ({ x: ex + dx, y: ey + dy, r, ry: f1(r * .8) })),
    lidOut: `M ${ex - ER - 16} ${ey} Q ${ex} ${ey - 136} ${ex + ER + 16} ${ey} Q ${ex} ${ey + 126} ${ex - ER - 16} ${ey} Z`,
    white: `M ${ex - ER} ${ey} Q ${ex} ${ey - 118} ${ex + ER} ${ey} Q ${ex} ${ey + 110} ${ex - ER} ${ey} Z`,
    ix: ex + look * 54, iy: ey + 2, ir: IR,
    pupil: `M ${ex + look * 60} ${ey - 54} Q ${ex + look * 60 + 18} ${ey + 4} ${ex + look * 60} ${ey + 64} Q ${ex + look * 60 - 18} ${ey + 4} ${ex + look * 60} ${ey - 54} Z`,
    hx: ex + look * 54 - 26, hy: ey - 22,
    lid: `M ${ex - ER - 22} ${ey + 6} Q ${ex} ${ey - 146} ${ex + ER + 22} ${ey + 6} Q ${ex + 56} ${ey - 46} ${ex} ${ey - 48} Q ${ex - 56} ${ey - 46} ${ex - ER - 22} ${ey + 6} Z`,
    lidHi: `M ${ex - ER + 10} ${ey - 24} Q ${ex} ${ey - 106} ${ex + ER - 10} ${ey - 24}`,
  };
  const names = P.map((p, i) => ({ name: p.w.name.toUpperCase(), y: Math.round(p.y - 64), gone: reveal && lost[i] })).filter(q => !q.gone);
  const tags = reveal ? P.map((p, i) => ({ p, i })).filter(({ i }) => !lost[i]).map(({ p, i }) => { const pl = planks[i]; return { x: Math.round(pl.px + 78), y: Math.round(pl.py - 120), r: [3, -2, 2][i], n: Math.round(p.pos) }; }) : [];
  const crew = reveal
    ? [{ x: 150, y: 1130, s: 1.8, ...head('tri') }, { x: 1020, y: 1096, s: 1.7, ...head('band') }, { x: 1310, y: 1062, s: 1.8, ...head('none') }, { x: 1600, y: 1130, s: 1.8, ...head('tri') }, { x: 1870, y: 1096, s: 1.7, ...head('band') }]
    : [{ x: 110, y: 1010, s: 1.2, ...head('tri') }, { x: 318, y: 1040, s: .95, ...head('band') }, { x: 1664, y: 1040, s: .95, ...head('none') }, { x: 1850, y: 1010, s: 1.2, ...head('tri') }];
  crew[2] = { ...crew[2], d: crew[2].d + PARROT };
  const nm = (i: number) => P[i].w.name[0].toUpperCase() + P[i].w.name.slice(1).toLowerCase();
  const who = takenIdx.map(nm);
  const caption = !n ? 'The Kraken goes hungry.'
    : result?.no_show ? `${who.join(' and ')} never turned up.`
    : !anyOver ? `${who.length > 1 ? who.slice(0, -1).join(', ') + ' and ' + who[who.length - 1] : who[0]} stopped furthest from the edge.`
    : n === 1 ? `${who[0]} went over the edge.` : n === 2 ? `${who[0]} and ${who[1]} went over the edge.` : 'All three went over. Nobody is safe.';
  return { planks, tentacles, churns, standing, splashes, trail, sunk, arms, collars, kr, names, tags, crew, caption, n };
}

// the bits that never change
let surf = `M 0 ${SURF}`; for (let x = 0; x < 1920; x += 60) surf += ` Q ${x + 30} ${SURF + (x % 120 ? -10 : 10)} ${x + 60} ${SURF}`;
const MOTES = Array.from({ length: 40 }, (_, i) => ({ x: Math.round(rnd(i + 700) * 1920), y: Math.round(rnd(i + 740) * 360), r: f1(1.5 + rnd(i + 780) * 3), o: f1(.15 + rnd(i + 820) * .35) }));
const SEAS = [
  { file: 'sea-far.png', y: 476, h: 96, o: .9, speed: 60000 },
  { file: 'sea-mid.png', y: 560, h: 160, o: .9, speed: 38000 },
  { file: 'sea-near.png', y: 712, h: 280, o: .95, speed: 24000 },
];
const SLIVERS = Array.from({ length: 34 }, (_, i) => { const y = 480 + Math.pow(i / 34, 1.25) * 490, spread = 30 + (y - 480) * .42; const w = Math.round(14 + (y - 470) * .1 + rnd(i + 90) * 24); return { x: Math.round(1624 - spread / 2 + rnd(i + 60) * spread - w / 2), y: Math.round(y), w, h: Math.round(3 + (y - 480) / 160), o: f1(.3 + rnd(i + 120) * .5) }; });
const STARS = Array.from({ length: 36 }, (_, i) => ({ x: Math.round(820 + rnd(i + 300) * 1080), y: Math.round(rnd(i + 340) * 420), r: rnd(i + 380) > .8 ? 3 : 2, o: f1(.25 + rnd(i + 420) * .6) }));
const abs = { position: 'absolute' } as const;
const FULL = { position: 'absolute', left: 0, top: 0, width: 1920, height: 1340 } as const;

export function PlankTV({ walkers, result, secs }: { walkers: PlankWalker[]; result: PlankResult | null; secs: number | null }) {
  const reveal = !!result;
  const key = walkers.map(w => `${w.id}|${w.name}|${w.photo}`).join(',') + JSON.stringify(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const L = useMemo(() => layout(walkers, result), [key]);
  const root = useRef<HTMLDivElement>(null);

  // One motion budget during the walk (sea drift, walkers bob, the Kraken rises: 9 loops); the reveal is one-shot.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const q = (s: string) => [...el.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`)];
    const A: Animation[] = [];
    const go = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions) => A.push(e.animate(k, o));
    if (!reveal) {
      q('sea').forEach(e => go(e, [{ transform: 'translateX(0)' }, { transform: 'translateX(-1024px)' }], { duration: +e.dataset.speed!, iterations: Infinity }));
      q('bob').forEach(e => go(e, [{ transform: 'translateY(0) rotate(-2deg)' }, { transform: 'translateY(-6px) rotate(2deg)' }], { duration: 420, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      q('rise').forEach(e => go(e, [{ transform: 'translateY(22px)' }, { transform: 'translateY(0)' }], { duration: 1600, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
      q('glintA').forEach(e => go(e, [{ opacity: .3 }, { opacity: 1 }, { opacity: .3 }], { duration: 3600, iterations: Infinity }));
      q('glintB').forEach(e => go(e, [{ opacity: 1 }, { opacity: .3 }, { opacity: 1 }], { duration: 4200, iterations: Infinity }));
    } else {
      // freeze → the camera drops → yanked under → splash → verdict → tags
      q('scene').forEach(e => go(e, [{ transform: 'translateY(0)' }, { transform: `translateY(${-DROP}px)` }], { duration: 900, delay: 500, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'backwards' }));
      q('yank').forEach((e, i) => go(e, [{ transform: 'translateY(-150px)', opacity: 0 }, { transform: 'translateY(-150px)', opacity: 1, offset: .3 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 520, delay: 1400 + i * 260, easing: 'cubic-bezier(.7,0,1,.6)', fill: 'backwards' }));
      q('splash').forEach((e, i) => go(e, [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, delay: 1500 + i * 260, easing: 'ease-out', fill: 'backwards' }));
      q('verdict').forEach(e => go(e, [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 360, delay: 2300, easing: 'cubic-bezier(.3,1.4,.6,1)', fill: 'backwards' }));
      q('tag').forEach((e, i) => go(e, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, delay: 2800 + i * 140, fill: 'backwards' }));
    }
    return () => A.forEach(a => a.cancel());
  }, [reveal]);

  const polaroid = { width: '100%', height: '100%', boxSizing: 'border-box', padding: '8px 8px 22px', background: '#f4efe4' } as const;
  return (
    <div ref={root} className={'mgx pl-tv' + (reveal ? ' pl-reveal' : '')}>
      <svg width="0" height="0" style={abs} aria-hidden="true">
        <defs>
          <pattern id="pl-wood" width="512" height="96" patternUnits="userSpaceOnUse"><image href={TEX + 'wood-plank.png'} width="512" height="96" /></pattern>
          <linearGradient id="pl-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd9a0" stopOpacity=".22" /><stop offset=".4" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#140a04" stopOpacity=".6" /></linearGradient>
          <linearGradient id="pl-tent" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#6e1d42" /><stop offset=".35" stopColor="#b8406e" /><stop offset="1" stopColor="#e2799f" /></linearGradient>
          <linearGradient id="pl-arm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#4a1030" /><stop offset=".45" stopColor="#b8406e" /><stop offset="1" stopColor="#dc6f98" /></linearGradient>
          <linearGradient id="pl-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8406e" /><stop offset=".4" stopColor="#7c2449" /><stop offset="1" stopColor="#2a0716" /></linearGradient>
          <radialGradient id="pl-iris" cx=".5" cy=".5" r=".55"><stop offset="0" stopColor="#fff4b8" /><stop offset=".45" stopColor="#ffcf4a" /><stop offset="1" stopColor="#d0700e" /></radialGradient>
        </defs>
      </svg>

      {/* ============ the scene: at the reveal the camera drops to look under the water ============ */}
      <div data-fx="scene" style={{ ...FULL, transform: `translateY(${reveal ? -DROP : 0}px)` }}>
        <div style={{ ...abs, inset: 0, background: 'linear-gradient(180deg, #06161b, #0b2a31 34%, #123f47 44%, #0b3640 44.2%, #083039 60%, #041d23 76%, #02121a)' }} />
        {STARS.map((s, i) => <div key={i} style={{ ...abs, left: s.x, top: s.y, width: s.r, height: s.r, borderRadius: '50%', background: '#dff3ee', opacity: +s.o }} />)}
        <div style={{ ...abs, left: 1334, top: 74, width: 580, height: 580, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,245,238,.26), rgba(120,210,200,.07) 42%, transparent 68%)' }} />
        <div style={{ ...abs, left: 1560, top: 300, width: 128, height: 128, borderRadius: '50%', background: 'radial-gradient(circle at 38% 36%, #f6fbf8, #d4e6e0 60%, #a9c4bd)', boxShadow: '0 0 40px rgba(230,250,244,.55)' }}>
          <div style={{ ...abs, left: 28, top: 40, width: 22, height: 18, borderRadius: '50%', background: 'rgba(120,150,145,.35)' }} />
          <div style={{ ...abs, left: 70, top: 70, width: 30, height: 24, borderRadius: '50%', background: 'rgba(120,150,145,.3)' }} />
        </div>
        <svg viewBox="0 0 1920 480" style={{ ...abs, left: 0, top: 0, width: 1920, height: 480 }}>
          <path d="M 1000 70 Q 1060 30 1140 52 Q 1190 18 1250 40 Q 1270 64 1252 88 Q 1200 108 1120 100 Q 1050 110 1000 96 Z" fill="#0d2a31" />
          <path d="M 1040 98 Q 1140 110 1250 90" stroke="#6fb4ac" strokeWidth="3" fill="none" opacity=".45" />
          <path d="M 1460 190 Q 1520 154 1610 172 Q 1680 136 1770 162 Q 1840 154 1920 176 L 1920 240 Q 1800 254 1700 242 Q 1590 254 1460 230 Z" fill="#0c262d" />
          <path d="M 1480 232 Q 1580 246 1680 238 Q 1800 246 1920 234" stroke="#6fb4ac" strokeWidth="3" fill="none" opacity=".4" />
          <path d="M 1560 20 Q 1640 -10 1740 10 Q 1830 -6 1920 16 L 1920 64 Q 1820 74 1740 62 Q 1640 76 1560 50 Z" fill="#0b242a" />
        </svg>

        {/* the sea: three baked wave-line depths, drifting */}
        <div style={{ ...abs, left: 0, top: 472, width: 1920, height: 3, background: 'rgba(170,230,222,.35)' }} />
        {SEAS.map(w => (
          <div key={w.file} style={{ ...abs, left: 0, top: w.y, width: 1920, height: w.h, overflow: 'hidden' }}>
            <div data-fx="sea" data-speed={w.speed} style={{ width: 3840, height: '100%', background: `url('${TEX}${w.file}') repeat-x 0 0 / 1024px ${w.h}px`, opacity: w.o }} />
          </div>
        ))}
        {/* the moon's reflection in slivers: two groups, each faded as one element */}
        {(['glintA', 'glintB'] as const).map((fx, g) => (
          <div key={fx} data-fx={fx} style={{ ...FULL, opacity: g ? .6 : 1 }}>
            {SLIVERS.filter((_, i) => i % 2 === (g ? 0 : 1)).map((s, i) => <div key={i} style={{ ...abs, left: s.x, top: s.y, width: s.w, height: s.h, borderRadius: 3, background: '#e8f7f2', opacity: +s.o }} />)}
          </div>
        ))}
        <div style={{ ...abs, left: -100, right: -100, top: 440, height: 90, background: 'radial-gradient(ellipse 32% 50% at 30% 50%, rgba(170,210,205,.16), transparent 70%), radial-gradient(ellipse 36% 45% at 76% 55%, rgba(170,210,205,.12), transparent 70%)' }} />

        {reveal && <>
          <div style={{ ...abs, left: 0, top: SURF, width: 1920, height: 400, background: 'linear-gradient(180deg, #11707a, #0d5d68 30%, #0a4c57 65%, #084550)' }} />
          <svg viewBox="0 0 1920 400" style={{ ...abs, left: 0, top: SURF, width: 1920, height: 400 }}>
            <path d="M 560 0 L 690 0 L 520 400 L 340 400 Z M 930 0 L 1010 0 L 940 400 L 800 400 Z M 1400 0 L 1510 0 L 1620 400 L 1440 400 Z" fill="#9fe6de" opacity=".08" />
            {MOTES.map((m, i) => <circle key={i} cx={m.x} cy={m.y} r={m.r} fill="#bfeee8" opacity={m.o} />)}
          </svg>
        </>}

        {/* the ship (a flat carved stern; its ensign is hidden at the reveal, when the camera drops past it) */}
        <div style={FULL} dangerouslySetInnerHTML={{ __html: shipSvg }} />

        {reveal && <>
          {/* the Kraken's head and one enormous eye; every arm leaves right of the eye, so it is never covered */}
          <svg viewBox="0 0 1920 1340" style={{ ...FULL, overflow: 'visible' }}>
            <path d={L.kr.head} fill="url(#pl-head)" stroke="#12040b" strokeWidth="7" strokeLinejoin="round" />
            <path d={L.kr.rim} stroke="#f2a9c4" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".55" />
            {L.kr.spots.map((s, i) => <ellipse key={i} cx={s.x} cy={s.y} rx={s.r} ry={s.ry} fill="#d9709a" stroke="#12040b" strokeWidth="3" opacity=".9" />)}
            <path d={L.kr.lidOut} fill="#12040b" />
            <path d={L.kr.white} fill="#f6e7c9" />
            <ellipse cx={L.kr.ix} cy={L.kr.iy} rx={L.kr.ir} ry={L.kr.ir} fill="url(#pl-iris)" stroke="#12040b" strokeWidth="5" />
            <path d={L.kr.pupil} fill="#0a0206" />
            <ellipse cx={L.kr.hx} cy={L.kr.hy} rx="22" ry="13" fill="#fffbe6" opacity=".9" />
            <path d={L.kr.lid} fill="#8d2b55" stroke="#12040b" strokeWidth="6" strokeLinejoin="round" />
            <path d={L.kr.lidHi} stroke="#e98bb0" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d={L.kr.white} fill="none" stroke="#12040b" strokeWidth="8" strokeLinejoin="round" />
          </svg>
          {L.trail.map((b, i) => <div key={i} style={{ ...abs, left: b.x, top: b.y, width: b.r, height: b.r, borderRadius: '50%', boxShadow: 'inset 0 0 0 3px rgba(223,247,242,.7)' }} />)}
        </>}

        {/* the planks: thick outlines so they survive TV blur */}
        {L.planks.map((p, i) => (
          <svg key={i} viewBox="0 0 1920 1340" style={{ ...FULL, overflow: 'visible' }}>
            <path d={p.shadow} fill="rgba(0,0,0,.28)" />
            <path d={p.d} fill="url(#pl-wood)" />
            <path d={p.d} fill="url(#pl-shade)" />
            <path d={p.d} fill="#0a1a1e" opacity={p.haze} />
            {p.danger && <path d={p.danger} fill="rgba(4,20,24,.5)" />}
            <path d={p.d} fill="none" stroke="#0a0604" strokeWidth={p.ow} strokeLinejoin="round" />
            <path d={p.hi} stroke="#e7c08a" strokeWidth="2" fill="none" opacity=".55" />
            <ellipse cx={p.tipX} cy={p.tipY} rx={p.tipRx} ry={p.tipRy} fill="#2a1a0e" stroke="#0a0604" strokeWidth="3" />
          </svg>
        ))}

        {/* LIVE: the Kraken rises evenly at the shared tip (one group: every tip together) */}
        {!reveal && <div data-fx="rise" style={FULL}>
          {L.tentacles.map((t, i) => (
            <div key={i} style={{ ...abs, left: t.x, top: t.y, width: t.w, height: t.h }}>
              <svg viewBox="0 0 160 340" style={{ width: '100%', height: '100%', overflow: 'visible', transform: t.tf, transformOrigin: '50% 100%' }}>
                <path d={UP.d} fill="url(#pl-tent)" stroke="#12040b" strokeWidth={t.sw} strokeLinejoin="round" />
                <path d={UP.sheen} stroke="#f7b8cf" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".55" />
                {UP.S.map((k, j) => <g key={j}><ellipse cx={k.x} cy={k.y} rx={k.r} ry={k.ry} fill="#f5d6c8" stroke="#12040b" strokeWidth={t.ssw} /><ellipse cx={k.x} cy={k.y} rx={k.ri} ry={k.rri} fill="#b8406e" /></g>)}
              </svg>
            </div>
          ))}
        </div>}
        {L.churns.map((c, i) => (
          <svg key={i} viewBox="-100 -20 200 40" style={{ ...abs, left: c.x, top: c.y, width: c.w, height: c.h, overflow: 'visible' }}>
            <path d="M -96 6 Q -80 -8 -62 2 Q -50 -14 -30 -2 Q -14 -16 4 -2 Q 22 -14 38 0 Q 56 -12 70 2 Q 86 -6 96 6 Q 60 18 0 16 Q -60 18 -96 6 Z" fill="#e2f8f4" stroke="#0a3a40" strokeWidth="3" opacity=".85" />
          </svg>
        ))}

        {/* the walkers: every polaroid the same size, whatever the plank's depth */}
        {L.standing.map(p => (
          <div key={p.w.id} style={{ ...abs, left: p.x, top: p.y, width: 128, height: 148, transform: `rotate(${p.tilt}deg)`, transformOrigin: '50% 100%' }}>
            <div data-fx={reveal ? 'still' : 'bob'} style={{ ...polaroid, boxShadow: '0 0 0 4px #0a0604, -10px 16px 18px rgba(0,0,0,.6)' }}><Face w={p.w} /></div>
          </div>
        ))}

        {L.splashes.map((s, i) => (
          <svg key={i} data-fx="splash" viewBox="-120 -90 240 120" style={{ ...abs, left: s.x, top: s.y, width: s.w, height: s.h, overflow: 'visible', transformOrigin: '50% 90%' }}>
            <path d="M -114 22 Q -86 -6 -70 16 Q -70 -50 -38 -22 Q -30 -86 0 -34 Q 22 -92 34 -24 Q 64 -58 68 14 Q 90 -6 114 22 Q 0 44 -114 22 Z" fill="#e2f8f4" stroke="#0a3a40" strokeWidth="5" strokeLinejoin="round" />
            <path d="M -60 18 Q -30 6 0 16 Q 30 6 60 18" stroke="#9fd8d0" strokeWidth="5" fill="none" />
            <circle cx="-52" cy="-66" r="9" fill="#e2f8f4" stroke="#0a3a40" strokeWidth="3" /><circle cx="50" cy="-76" r="7" fill="#e2f8f4" stroke="#0a3a40" strokeWidth="3" /><circle cx="8" cy="-100" r="6" fill="#e2f8f4" stroke="#0a3a40" strokeWidth="3" />
          </svg>
        ))}

        {reveal && <>
          {L.sunk.map(s => (
            <div key={s.w.id} data-fx="yank" style={FULL}>
              {s.bubbles.map((b, i) => <div key={i} style={{ ...abs, left: b.x, top: b.y, width: b.r, height: b.r, borderRadius: '50%', boxShadow: 'inset 0 0 0 3px rgba(223,247,242,.8)' }} />)}
              <div style={{ ...abs, left: s.x, top: s.y, width: 128, height: 148, transform: 'rotate(4deg)' }}>
                <div style={{ ...polaroid, position: 'relative', boxShadow: '0 0 0 4px #04161a', overflow: 'hidden' }}>
                  <Face w={s.w} />
                  {/* under the surface: the water's tint over the card (no filters) */}
                  <div style={{ ...abs, left: 0, right: 0, bottom: 0, top: s.wet, background: 'linear-gradient(180deg, rgba(17,112,122,.38), rgba(5,48,58,.62))' }} />
                </div>
              </div>
            </div>
          ))}
          <svg viewBox="0 0 1920 1340" style={{ ...FULL, overflow: 'visible' }}>
            <path d={surf} fill="none" stroke="#9fe6de" strokeWidth="18" opacity=".16" />
            <path d={surf} fill="none" stroke="#04161a" strokeWidth="9" strokeLinejoin="round" />
            <path d={surf} fill="none" stroke="#dff7f2" strokeWidth="5" strokeLinejoin="round" />
            {L.collars.map((c, i) => <path key={i} d={c} fill="#e2f8f4" stroke="#0a3a40" strokeWidth="4" strokeLinejoin="round" />)}
            {L.arms.map((a, i) => (
              <g key={i}>
                <path d={a.d} fill="url(#pl-arm)" stroke="#12040b" strokeWidth="7" strokeLinejoin="round" />
                <path d={a.sheen} stroke="#f7b8cf" strokeWidth="10" strokeLinecap="round" fill="none" opacity=".55" />
                {a.S.map((k, j) => <g key={j}><ellipse cx={k.x} cy={k.y} rx={k.r} ry={k.r} fill="#f5d6c8" stroke="#12040b" strokeWidth="4" /><ellipse cx={k.x} cy={k.y} rx={k.ri} ry={k.ri} fill="#b8406e" /></g>)}
              </g>
            ))}
          </svg>
          {L.sunk.map(s => (
            <div key={s.w.id} data-fx="tag" style={{ ...abs, left: s.nx, top: s.ny, width: 300, marginLeft: -150, display: 'flex', justifyContent: 'center' }}>
              <div className="pl-name loser">{s.w.name.toUpperCase()}</div>
            </div>
          ))}
        </>}

        {/* names at the root of each plank: big, bone on near-black, the same size for everyone */}
        {L.names.map(n => <div key={n.name + n.y} className="pl-name" style={{ ...abs, left: 452, top: n.y, transform: 'rotate(-2deg)' }}>{n.name}</div>)}
        {L.tags.map((g, i) => (
          <div key={i} data-fx="tag" className="pl-safe" style={{ ...abs, left: g.x, top: g.y, transform: `rotate(${g.r}deg)` }}><b>{g.n}</b> · safe</div>
        ))}
      </div>

      {/* ============ fixed overlays: the crew watching, title, clock, caption, film ============ */}
      <svg viewBox="0 0 1920 1080" style={{ ...abs, left: 0, top: 0, width: 1920, height: 1080, pointerEvents: 'none' }} aria-hidden="true">
        {L.crew.map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.s})`}>
            <path d={c.d} fill="#010405" stroke="#010405" strokeWidth="4" strokeLinejoin="round" />
            <path d={c.rim} stroke="#9fe6de" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".75" />
            <path d={c.sh} stroke="#9fe6de" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".45" />
          </g>
        ))}
      </svg>
      {!reveal ? <>
        <div className="pl-head">
          <div className="k">The Kraken wants a sacrifice</div>
          <div className="t">Walk the Plank</div>
        </div>
        <div className="pl-clock">
          <div className="k">STOP BEFORE THE EDGE</div>
          {secs !== null && <div className="n">{secs}</div>}
        </div>
        <div className="pl-band" />
        <div className="pl-caption">Everyone walks together. No stops shown till the end.</div>
      </> : <>
        <div className="pl-vband" />
        <div data-fx="verdict" className="pl-verdict"><div className="v">Dragged under</div><div className="c">{L.caption}</div></div>
      </>}
      <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 74% at 55% 50%, transparent 58%, rgba(0,6,8,.72))' }} />
      <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: `url('${TEX}grain.png') repeat 0 0 / 256px 256px`, opacity: .07 }} />
    </div>
  );
}
