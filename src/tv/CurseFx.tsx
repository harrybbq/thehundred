// CURSE PASSED (TV-17) on the live Suspects board. Nothing covers the board: it plays across the cards, with the
// beats it has always had (698d3ba):
//   0     ANTICIPATION: the old holder's card shudders, its burn glows hot, a hex sigil flares on it, the skull squashes
//   550   the SHADOW FIGURE pours up out of the burnt corner and settles beside the card, clear of every name; the rest
//         of the board dims under it (a 25% scrim), and a cold blue-white rim light cuts it out of the dark
//   800   it glides across the board on an arc: it leans into the motion and stretches at speed; its hem wisps and lags;
//         it sheds baked smoke and embers and drags a short smoke comet (one element moved by transform)
//   1900  it brakes beside the new holder's card (again clear of the names), then dives into the corner: POSSESSION.
//         Six thorned vines, thick at the root and tapering, with an ember rim, grow in from the card's edges, each one
//         a bud, a fast lash, then a slow creep, and grip the photo frame (the face stays visible); the card trembles
//   3000  the vines RETRACT along themselves into the corner and KNOT; 3350 the skull SLAMS out of the knot (1.6×) and
//         settles exactly where the board's own resting skull sits (measured), growing away from the name, never over it
//   2300  a strip taped across the bottom of their card and the neighbours' bars says what happened and what it costs
// Card positions, every name's box and the board's resting skull are measured from the DOM (PlayerGrid); every size is
// in the card's --k units, so it runs card to card at any board size. Transform/opacity, plus stroke-dashoffset on just
// six mask strokes (one per vine); textures are baked (scripts/bake-curse.mjs). Reduced motion: a plain crossfade.
import { useId, useLayoutEffect, useRef } from 'react';
import { Sound, cues } from '../fx/sound';
import { reduced } from './machineKit';
import '../styles/curse.css';

/** How long the curse pass holds the animation queue (ms). */
export const CURSE_MS = 4600;
const D = CURSE_MS;
const T_RISE = 550, T0 = 800, T1 = 1900, T_POSSESS = 2050, T_CAP = 2300, T_RETRACT = 3000, T_SKULL = 3350;

type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** a card's box relative to .grid-wrap, plus the centre of the board's own resting skull on it when it's laid out,
 *  and the box of its name's text */
export type Box = Rect & { sk?: Pt; nm?: Rect };

// the card's --k (board.css: .bd .case-in --k:min(1cqh,.62cqw), cq = the card) and where its curse skull rests
// (curse.css: .bd .grid .case .curse .skull, right 1k, top .5k, 23k glyph)
const kOf = (b: Box) => Math.min(b.h / 100, b.w * .0062);
const skullAt = (b: Box): Pt => { if (b.sk) return b.sk; const k = kOf(b); return { x: b.x + b.w - 12.5 * k, y: b.y + 12 * k }; };
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

// ---------------------------------------------------------------- the vines (card space: a 254 × 215 viewBox)
// Six strands grow in from the edges, hug the photo frame (left ~7-120, top ~22-168) and the card's rim, and all end
// on the skull (cx, cy). Each is a filled, tapered body (built from its spine in the layout effect: ~3× as thick at the
// root as at the tip, with knuckles), an ember rim and a contact shadow, revealed by ONE animated mask stroke.
const VB_W = 254, VB_H = 215;
/** a smooth path through points (Catmull-Rom as cubics) */
const smooth = (P: [number, number][]) => {
  const f = (n: number) => n.toFixed(1);
  let d = `M ${f(P[0][0])} ${f(P[0][1])}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)}, ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
};
/** the six strands; nx = the name's right edge, ny = its bottom (card space): they climb the column right of the
 *  name, run under it, or hug the top rim above it, so the name is never covered */
const vinePaths = (cx: number, cy: number, nx: number, ny: number) => {
  const xr = Math.min(cx - 8, Math.max(nx + 10, 196)), yb = Math.min(150, ny + 10);
  return ([
    [[-8, 190], [40, 180], [100, 184], [128, 160], [134, Math.max(yb + 30, 120)], [156, yb + 12], [xr - 10, yb + 2], [xr + 2, cy + 34], [cx, cy]],
    [[200, 224], [180, 198], [196, 164], [222, 134], [xr + 16, Math.max(yb, 70)], [xr + 8, cy + 30], [cx, cy]],
    [[262, 150], [244, 126], [250, 92], [247, 58], [cx + 6, cy + 22], [cx, cy]],
    [[-8, 30], [12, 10], [52, 6], [100, 5], [150, 4], [200, 5], [cx - 16, cy - 7], [cx, cy]],
    [[-8, 118], [6, 84], [4, 50], [22, 24], [64, 14], [112, 9], [164, 6], [cx - 30, cy - 4], [cx, cy]],
    [[118, 224], [132, 204], [150, 186], [160, 152], [176, yb + 26], [xr - 4, yb + 8], [xr + 4, cy + 44], [cx, cy]],
  ] as [number, number][][]).map(smooth);
};
const VINE_W = [17, 16, 14, 15, 13, 18];            // root thickness (viewBox units); the tip is a third of it
const vineW = (j: number, t: number) => { const R = VINE_W[j], tip = R / 3.2; return (tip + (R - tip) * Math.pow(1 - t, 1.25)) * (1 + .13 * Math.sin(t * 22 + j * 1.7)); };
const THORN_T = [.24, .47, .7];
/** how far a vine has grown (0..1), dt ms after it starts: a bud, a recoil, a fast lash, then a slow creep */
function grown(dt: number) {
  const eo = (x: number) => 1 - Math.pow(1 - x, 3), ei = (x: number) => x * x;
  if (dt <= 0) return 0;
  if (dt < 200) return .07 * eo(dt / 200);
  if (dt < 290) return .07 - .02 * ((dt - 200) / 90);
  if (dt < 440) return .05 + .57 * ei((dt - 290) / 150);
  if (dt < 1040) return .62 + .38 * eo((dt - 440) / 600);
  return 1;
}
const GROW_MS = 1040;
const vineStart = (j: number) => T_POSSESS + 30 + [0, 90, 40, 140, 190, 60][j];
const GLYPHS = ['M0 -13 V13 M0 -12 L9 -3 L0 6', 'M-6 -13 V13 M6 -13 V13 M-6 -3 L6 6', 'M0 -13 V13 M-8 -7 L0 1 L8 -7', 'M-7 13 L0 -13 L7 13 M-4 4 H4', 'M-6 -13 L6 13 M6 -13 L-6 13'];

/** the figure's flight: a cubic from hold to hold, bowed towards the middle of the board so it never leaves it */
function flight(F: Pt, T: Pt, mid: Pt) {
  const phi = Math.atan2(T.y - F.y, T.x - F.x), dist = Math.hypot(T.x - F.x, T.y - F.y), K = Math.max(40, dist * .45);
  const build = (beta: number) => ({ C1: { x: F.x + K * Math.cos(phi - beta), y: F.y + K * Math.sin(phi - beta) }, C2: { x: T.x - K * Math.cos(phi + beta), y: T.y - K * Math.sin(phi + beta) } });
  const g1 = build(.7), g2 = build(-.7), md = (g: typeof g1) => Math.hypot((g.C1.x + g.C2.x) / 2 - mid.x, (g.C1.y + g.C2.y) / 2 - mid.y);
  const { C1, C2 } = md(g1) <= md(g2) ? g1 : g2;
  const bez = (t: number): Pt => { const u = 1 - t; return { x: u * u * u * F.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t * t * t * T.x, y: u * u * u * F.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t * t * t * T.y }; };
  const tab = [{ t: 0, s: 0 }]; let p = bez(0), s = 0;
  for (let i = 1; i <= 120; i++) { const t = i / 120, q = bez(t); s += Math.hypot(q.x - p.x, q.y - p.y); tab.push({ t, s }); p = q; }
  const at = (d: number): Pt => {
    let i = 1; while (i < tab.length - 1 && tab[i].s < d) i++;
    const a = tab[i - 1], b = tab[i], k = (d - a.s) / Math.max(1e-6, b.s - a.s);
    return bez(a.t + (b.t - a.t) * k);
  };
  return { A: Math.max(1, s), at };
}

const ease = (p: number) => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // tears free, rushes, eases in
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function CurseFx({ from, to, fromId, toId, fromName, toName, wrap, names = [] }: {
  from: Box | null; to: Box | null; fromId: string; toId: string; fromName: string; toName: string; wrap: HTMLElement | null;
  /** every name's text box on the board (relative to .grid-wrap): the figure never holds over one */
  names?: Rect[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const uid = 'cv' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = wrap?.clientWidth ?? 1200, H = wrap?.clientHeight ?? 700;
  const kF = from ? kOf(from) : 2, kT = to ? kOf(to) : 2, kr = Math.max(kF, kT);
  const F = from ? skullAt(from) : null, T = to ? skullAt(to) : null;
  const Fl = from && F ? { x: F.x - from.x, y: F.y - from.y } : { x: 0, y: 0 };        // card-local skull spots
  const Tl = to && T ? { x: T.x - to.x, y: T.y - to.y } : { x: 0, y: 0 };
  const FIG = 96 * kr;                               // the shadow figure's height: ~200px on a 1080p board
  // its box at a point (anchored at the chest: the svg spans x ±.36, y -.45..+.55 of FIG)
  const figBox = (p: Pt): Rect => ({ x: p.x - .36 * FIG, y: p.y - .45 * FIG, w: .72 * FIG, h: FIG });
  /** where it holds next to a corner: as near as it can be without sitting on any name, inside the board */
  const holdNear = (C: Pt, toward: Pt): Pt => {
    const pad = 6 * kr, nm = names.map(n => ({ x: n.x - pad, y: n.y - pad, w: n.w + pad * 2, h: n.h + pad * 2 }));
    const area = .72 * FIG * FIG; let best = C, bestS = Infinity;
    for (const d of [.3, .42, .55, .7, .85, 1]) for (let a = 0; a < 24; a++) {
      const ang = a / 24 * Math.PI * 2, p = { x: C.x + Math.cos(ang) * d * FIG, y: C.y + Math.sin(ang) * d * FIG }, r = figBox(p);
      const hit = nm.reduce((s, n) => s + overlap(r, n), 0) / area;
      const out = 1 - overlap(r, { x: 0, y: 0, w: W, h: H }) / area;
      const lean = Math.hypot(toward.x - p.x, toward.y - p.y) / Math.max(1, Math.hypot(toward.x - C.x, toward.y - C.y));  // <1: on the way
      const s = hit * 40 + out * 6 + d * 1.2 + lean * .8;
      if (s < bestS) { bestS = s; best = p; }
    }
    return best;
  };
  const A0 = F && T ? holdNear(F, T) : null, B0 = F && T && A0 ? holdNear(T, A0) : null;
  const geo = A0 && B0 ? flight(A0, B0, { x: W / 2, y: H / 2 }) : null;
  const mirror = !!(A0 && B0 && B0.x < A0.x - 1);     // its strong rim faces where it came from
  const TRAIL = geo ? Math.min(geo.A * .5, 120 * kr) : 0;
  const headAt = (s: number) => {                    // when (ms) the figure passes s px along its flight
    if (!geo) return T0;
    const want = Math.min(1, Math.max(0, s / geo.A)); let lo = 0, hi = 1;
    for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (ease(m) < want) lo = m; else hi = m; }
    return T0 + (T1 - T0) * lo;
  };
  const r = 22 * kr;
  const N_PUFF = 12;
  const puffs = geo ? Array.from({ length: N_PUFF }, (_, i) => {
    const s = geo.A * (i + .6) / (N_PUFF + .4), p = geo.at(s), ember = i % 3 === 1;
    return { s, x: p.x, y: p.y + FIG * .15, size: r * (2.4 + (i % 4) * .5), ember, cell: i % 4, rot: (i * 67) % 360, dx: (((i * 37) % 30) - 15) * kr * .6, dy: ember ? (14 + (i * 13) % 14) * kr : -(10 + (i * 11) % 12) * kr };
  }) : [];
  // the vines end on the skull: its spot in the 254 × 215 card space
  const cxv = to ? Tl.x / to.w * VB_W : 240, cyv = to ? Tl.y / to.h * VB_H : 16;
  const nmv = to?.nm ? { x: (to.nm.x + to.nm.w - to.x) / to.w * VB_W, y: (to.nm.y + to.nm.h - to.y) / to.h * VB_H } : { x: 200, y: 70 };
  const VINES = vinePaths(cxv, cyv, nmv.x, nmv.y);

  // the skull grows out of its corner AWAY from the name (transform-origin on the glyph's corner nearest the name)
  const SK = 23 * kT, SB = 30 * kT;                  // glyph size (the board's), and its centred box
  const nmT = to?.nm, skOrigin = (() => {
    if (!nmT || !T) return { x: SB / 2 - SK / 2, y: SB / 2 + SK / 2 };          // default: the bottom-left corner
    const nx = nmT.x + nmT.w / 2 < T.x ? -1 : 1, ny = nmT.y + nmT.h / 2 > T.y ? 1 : -1;
    return { x: SB / 2 + nx * SK / 2, y: SB / 2 + ny * SK / 2 };
  })();

  // the strip: across the bottom of their card and the neighbours' bars (below the face), never off the board, and
  // always below the skull (and its slam)
  const fs1 = 12.5 * kT, fs2 = 8 * kT, pad = 3 * kT;
  const capW = Math.min(W - 4 * kT, (to?.w ?? 300) * 1.75), capH = fs1 + fs2 * 1.2 + pad * 2.5;
  const capX = to ? Math.min(W - capW - 2 * kT, Math.max(2 * kT, to.x + to.w / 2 - capW / 2)) : 0;
  const capY = to && T ? Math.max(T.y + SK * 1.1 + 4 * kT, Math.min(H - capH - kT, to.y + to.h * .76)) : 0;

  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    const q = (s: string) => [...el.querySelectorAll<HTMLElement | SVGElement>(`[data-cfx="${s}"]`)], one = (s: string) => q(s)[0];
    const tl = (e: Element | null | undefined, frames: [number, Keyframe, string?][]) => {
      if (!e) return;
      let last = 0;                        // offsets never go backwards (a bad frame must never take the TV down)
      const kf: Keyframe[] = frames.map(([t, p, ez]) => { last = Math.max(last, Math.min(1, Math.max(0, t / D))); return { ...p, offset: last, ...(ez ? { easing: ez } : {}) }; });
      if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
      if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
      try { e.animate(kf, { duration: D, fill: 'both' }); } catch { /* skip this element rather than crash the board */ }
    };
    const op = (v: number) => ({ opacity: v }), tf = (v: string) => ({ transform: v });
    const OUT = 'cubic-bezier(.2,.8,.3,1)', IN = 'cubic-bezier(.6,0,.9,.5)', GRAVITY = 'cubic-bezier(.45,0,.9,.55)', POP = 'cubic-bezier(.3,1.6,.5,1)';
    el.querySelectorAll<HTMLElement>('[data-fit]').forEach(n => { let f = parseFloat(n.style.fontSize); while (n.scrollWidth > n.clientWidth + 1 && f > 8) { f -= .5; n.style.fontSize = f + 'px'; } });

    // the vines' tapered bodies and thorns, from their spines (static geometry: only the mask strokes animate)
    const spines = q('vine') as SVGPathElement[];
    const bodies = new Map<number, SVGPathElement[]>();
    q('vbody').forEach(b => { const j = +(b.getAttribute('data-j') ?? 0); bodies.set(j, [...(bodies.get(j) ?? []), b as SVGPathElement]); });
    spines.forEach(sp => {
      const j = +(sp.getAttribute('data-j') ?? 0);
      try {
        const total = sp.getTotalLength(), N = 44, L: string[] = [], R: string[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, P = sp.getPointAtLength(total * t), P2 = sp.getPointAtLength(Math.min(total, total * t + 1.5)), P0 = sp.getPointAtLength(Math.max(0, total * t - 1.5));
          let tx = P2.x - P0.x, ty = P2.y - P0.y; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
          const w = vineW(j, t) / 2;
          L.push(`${(P.x - ty * w).toFixed(1)} ${(P.y + tx * w).toFixed(1)}`); R.push(`${(P.x + ty * w).toFixed(1)} ${(P.y - tx * w).toFixed(1)}`);
        }
        const tipR = (vineW(j, 1) / 2).toFixed(1), rootR = (vineW(j, 0) / 2).toFixed(1);
        const d = `M ${L[0]} L ${L.slice(1).join(' L ')} A ${tipR} ${tipR} 0 0 1 ${R[N]} L ${R.slice(0, N).reverse().join(' L ')} A ${rootR} ${rootR} 0 0 1 ${L[0]} Z`;
        bodies.get(j)?.forEach(b => b.setAttribute('d', d));
      } catch { /* ignore */ }
    });

    if (reduced()) {                       // a plain crossfade: the brand leaves one card and appears on the other
      tl(one('fromChar'), [[0, op(1)], [900, op(0)]]);
      tl(one('fromSkull'), [[0, op(1)], [900, op(0)]]);
      tl(one('toChar'), [[600, op(0)], [1500, op(1)]]);
      tl(one('skull'), [[600, op(0)], [1500, op(1)]]);
      tl(one('cap'), [[900, op(0)], [1500, op(1)]]);
      return cues([[0, () => Sound.curse()], [1000, () => Sound.toll()]]);
    }
    if (!geo || !F || !T || !A0 || !B0) return;
    const px = (v: number) => `${(v * kr).toFixed(2)}px`;
    const card = (id: string) => wrap?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    /** shake a real card on the scene clock: [ms, x, y] in card units */
    const shake = (id: string, pts: [number, number, number][]) => { try { card(id)?.animate(
      [{ translate: '0 0', offset: 0 }, ...pts.map(([t, x, y]) => ({ translate: `${px(x)} ${px(y)}`, offset: t / D })), { translate: '0 0', offset: 1 }], { duration: D, easing: 'linear' }); } catch { /* ignore */ } };

    // ---- 0-550 ANTICIPATION on the old card
    shake(fromId, [[0, 0, 0], [60, -1.6, .6], [120, 1.6, -.6], [180, -1.4, .5], [240, 1.4, -.5], [300, -1, .3], [360, 1, -.3], [420, 0, 0]]);
    tl(one('fromEmber'), [[0, op(0), 'ease-out'], [180, op(.8)], [240, op(.5)], [330, op(1)], [400, op(.75)], [T_RISE, op(1), 'ease-in'], [T_RISE + 700, op(0)]]);
    tl(one('runesF'), [[0, { opacity: 0, transform: 'rotate(-30deg) scale(.8)' }, OUT], [380, { opacity: 1, transform: 'rotate(0deg) scale(1)' }], [T_RISE, { opacity: 1, transform: 'rotate(10deg)' }, IN], [T_RISE + 450, { opacity: 0, transform: 'rotate(60deg) scale(1.2)' }]]);
    tl(one('fromSkull'), [[0, tf('none'), 'ease-in-out'], [T_RISE - 150, tf('translateY(6%) scale(1.12,.8)')], [T_RISE - 20, { opacity: 1, transform: 'translateY(6%) scale(1.12,.8)' }, 'steps(1,end)'], [T_RISE, { opacity: 0, transform: 'none' }]]);
    tl(one('fromChar'), [[T_RISE, op(1), 'ease-in'], [T_RISE + 900, op(0)]]);    // the old burn heals behind it
    // the rest of the board dims under the figure while it travels
    tl(one('scrim'), [[T_RISE - 150, op(0), 'ease-out'], [T_RISE + 200, op(1)], [T1, op(1), 'ease-in-out'], [T_POSSESS + 300, op(0)]]);

    // ---- 550-2050 THE SHADOW FIGURE: pours out of the corner to a clear hold, glides on the arc, dives into the new card
    const fig: [number, Keyframe, string?][] = [];
    const fx = (p: Pt, rot: number, sx: number, sy: number, o = 1) => ({ transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`, opacity: o });
    fig.push([0, fx(F, 0, .2, .2, 0)]);
    fig.push([T_RISE - 10, fx(F, 0, .2, .2, 0), 'steps(1,end)']);
    fig.push([T_RISE, fx(F, 0, .25, .18, 1), OUT]);                                  // it pours up out of the burn, stretched
    fig.push([T_RISE + 150, fx(lerp(F, A0, .6), -4, .75, 1.2), 'ease-in-out']);
    fig.push([T0, fx(A0, 0, 1, 1), 'linear']);                                        // a beat, clear of the names
    const N = 40;
    let prev = geo.at(0);
    for (let i = 1; i <= N; i++) {
      const p = i / N, e = ease(p), t = T0 + (T1 - T0) * p, at = geo.at(geo.A * e);
      const vx = at.x - prev.x, vy = at.y - prev.y, v = Math.hypot(vx, vy) / (geo.A / N);   // ~0..2.6 (normalised speed)
      const lean = Math.max(-26, Math.min(26, (vx / Math.max(1e-6, Math.hypot(vx, vy))) * 22 * Math.min(1, v)));
      const st = Math.min(.22, v * .1);
      fig.push([t, fx(at, lean, 1 - st * .5, 1 + st), 'linear']);
      prev = at;
    }
    fig.push([T1 + 60, fx(B0, 0, 1.04, .97), 'cubic-bezier(.55,0,.9,.45)']);        // it gathers itself... and dives
    fig.push([T_POSSESS, fx(T, 0, .5, .62, .85), 'ease-out']);
    fig.push([T_POSSESS + 140, fx({ x: T.x - 6 * kr, y: T.y + 10 * kr }, 0, .22, .3, 0)]);   // ...and is gone into the card
    tl(one('figure'), fig);
    // its hem wisps and lags (secondary motion: the outer, fainter hem a beat later and wider); its eyes glint
    const swing = (lag: number, amp: number): [number, Keyframe, string?][] => [[T_RISE + lag, tf('rotate(0deg)'), 'ease-in-out'], [T0 + lag, tf(`rotate(${14 * amp}deg)`), 'ease-in-out'], [1100 + lag, tf(`rotate(${-16 * amp}deg)`), 'ease-in-out'],
      [1350 + lag, tf(`rotate(${12 * amp}deg)`), 'ease-in-out'], [1600 + lag, tf(`rotate(${-10 * amp}deg)`), 'ease-in-out'], [T1 + lag, tf(`rotate(${8 * amp}deg)`), 'ease-in-out'], [T_POSSESS + lag, tf(`rotate(${-20 * amp}deg)`)]];
    tl(one('tail'), swing(0, 1));
    tl(one('hem'), swing(120, 1.5));
    tl(one('eyes'), [[T_RISE + 100, op(0)], [T_RISE + 200, op(1)], [T_RISE + 260, op(.3)], [T_RISE + 320, op(1)], [1700, op(.75)], [T1, op(1), 'ease-in'], [T_POSSESS + 80, op(0)]]);
    tl(one('figRim'), [[T_RISE, op(.3)], [T0, op(1)], [1250, op(.8)], [1450, op(1)], [1700, op(.85)], [T1, op(1)]]);
    // the smoke comet: one short streak riding behind it (transform only), longer and denser at speed
    const comet: [number, Keyframe, string?][] = [];
    const ang = (s: number) => { const a = geo.at(Math.max(0, s - 3)), b = geo.at(Math.min(geo.A, s + 3)); return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; };
    let aPrev = ang(0), sPrev = 0;
    const cf = (s: number, a: number, sx: number, o: number) => { const p = geo.at(s); return { transform: `translate(${p.x.toFixed(1)}px,${(p.y + FIG * .12).toFixed(1)}px) rotate(${a.toFixed(1)}deg) scaleX(${sx.toFixed(3)})`, opacity: o }; };
    comet.push([T0, cf(0, aPrev, .1, 0), 'linear']);
    for (let i = 1; i <= N; i++) {
      const p = i / N, s = geo.A * ease(p), v = (s - sPrev) / (geo.A / N);
      let a = ang(s); while (a - aPrev > 180) a -= 360; while (a - aPrev < -180) a += 360;   // never spin the long way
      comet.push([T0 + (T1 - T0) * p, cf(s, a, Math.max(.1, Math.min(1, v / 1.6)), Math.min(.95, v * .7)), 'linear']);
      aPrev = a; sPrev = s;
    }
    comet.push([T1 + 120, cf(geo.A, aPrev, .1, 0)]);
    tl(one('comet'), comet);
    q('puff').forEach((n, i) => {
      const P = puffs[i], s = headAt(P.s);
      if (P.ember) tl(n, [[s - 10, { opacity: 0, transform: 'translate(0px,0px) scale(1)' }, 'linear'], [s + 40, { opacity: 1, transform: 'translate(0px,0px) scale(1)' }, GRAVITY], [s + 950, { opacity: 0, transform: `translate(${P.dx.toFixed(1)}px,${P.dy.toFixed(1)}px) scale(.35)` }]]);
      else tl(n, [[s - 20, { opacity: 0, transform: `translate(0px,0px) rotate(${P.rot}deg) scale(.35)` }, 'ease-out'], [s + 160, { opacity: .95, transform: `translate(${(P.dx * .2).toFixed(1)}px,${(P.dy * .2).toFixed(1)}px) rotate(${P.rot + 10}deg) scale(.8)` }, 'ease-out'],
        [s + 1500, { opacity: 0, transform: `translate(${P.dx.toFixed(1)}px,${P.dy.toFixed(1)}px) rotate(${P.rot + 50}deg) scale(1.7)` }]]);
    });

    // ---- 2050-3000 POSSESSION: the vines grip the card from its edges (one mask stroke per vine reveals its body)
    tl(one('toDim'), [[T_POSSESS - 50, op(0), 'ease-out'], [T_POSSESS + 400, op(1)], [T_RETRACT, op(1), 'ease-in'], [T_SKULL + 100, op(0)]]);
    spines.forEach(v => {
      const j = +(v.getAttribute('data-j') ?? 0), s = vineStart(j);
      const kf: [number, Keyframe, string?][] = [[s, { strokeDashoffset: 1 }, 'linear']];
      for (let dt = 40; dt <= GROW_MS; dt += 40) kf.push([s + dt, { strokeDashoffset: 1 - grown(dt) }, 'linear']);
      kf.push([s + GROW_MS + 10, { strokeDashoffset: 0 }]);
      // 3000: the vine draws itself back along itself into the corner
      kf.push([T_RETRACT + j * 20, { strokeDashoffset: 0 }, 'cubic-bezier(.6,0,.8,.5)'], [T_SKULL - 30, { strokeDashoffset: -1 }]);
      tl(v, kf);
    });
    // hooked thorns, placed along each vine from its own geometry, pop as the vine reaches them
    const spineOf = new Map(spines.map(s => [+(s.getAttribute('data-j') ?? 0), s]));
    q('thorn').forEach(th => {
      const j = +(th.getAttribute('data-j') ?? 0), t = +(th.getAttribute('data-t') ?? .5), side = +(th.getAttribute('data-side') ?? 1), path = spineOf.get(j);
      if (!path) return;
      try {
        const total = path.getTotalLength(), P = path.getPointAtLength(total * t), P2 = path.getPointAtLength(Math.min(total, total * t + 2));
        let tx = P2.x - P.x, ty = P2.y - P.y; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
        const nx = -ty * side, ny = tx * side;
        const hw = vineW(j, t) / 2, b = Math.max(2, hw * .7), h = hw + 4 + 5 * (1 - t);
        const pt = (a: number, c: number) => `${(P.x + tx * a + nx * c).toFixed(1)} ${(P.y + ty * a + ny * c).toFixed(1)}`;
        th.setAttribute('d', `M ${pt(-b, hw * .6)} Q ${pt(-h * .05, h * .85)} ${pt(h * .55, h)} Q ${pt(b * .5, hw + (h - hw) * .3)} ${pt(b, hw * .6)} Z`);
        (th as SVGElement).style.transformOrigin = `${(P.x + nx * hw).toFixed(1)}px ${(P.y + ny * hw).toFixed(1)}px`;
        let dt = 0; while (dt < GROW_MS && grown(dt) < t) dt += 10;
        const s = vineStart(j) + dt;
        tl(th, [[s, { opacity: 0, transform: 'scale(0)' }, POP], [s + 150, { opacity: 1, transform: 'scale(1)' }], [T_RETRACT + 40, { opacity: 1, transform: 'scale(1)' }, IN], [T_RETRACT + 260, { opacity: 0, transform: 'scale(0)' }]]);
      } catch { /* ignore */ }
    });
    // the grip pulses twice (a slow heartbeat)
    tl(one('vines'), [[2650, tf('scale(1)'), 'ease-out'], [2730, tf('scale(1.025)'), 'ease-in'], [2850, tf('scale(1)'), 'ease-out'], [2930, tf('scale(1.02)'), 'ease-in'], [T_RETRACT + 40, tf('scale(1)'), IN], [T_SKULL, tf('scale(.96)')]]);
    const trem: [number, number, number][] = [];
    for (let t = T_POSSESS + 40, i = 0; t < T_RETRACT; t += 70, i++) trem.push([t, (i % 2 ? 1 : -1) * (.5 + (i % 3) * .25), (i % 3 - 1) * .4]);
    // ---- 3000-3350 they retract into the corner and KNOT; 3350 the skull SLAMS out of the knot: the jolt
    shake(toId, [[T_POSSESS, 0, 0], ...trem, [T_SKULL - 10, 0, 0], [T_SKULL + 30, -2.6, 1.8], [T_SKULL + 90, 2.1, -1.3], [T_SKULL + 160, -1.1, .8], [T_SKULL + 230, .6, -.3], [T_SKULL + 300, 0, 0]]);
    tl(one('knot'), [[T_RETRACT + 120, { opacity: 0, transform: 'scale(.4) rotate(0deg)' }, 'ease-in'], [T_SKULL - 40, { opacity: 1, transform: 'scale(1) rotate(220deg)' }, 'ease-out'], [T_SKULL + 60, { opacity: 0, transform: 'scale(.5) rotate(280deg)' }]]);
    // bursts to 1.6× (squashed on the hit), rebounds, settles in ever smaller steps: from its far corner, away from the name
    tl(one('skull'), [[T_SKULL - 40, { opacity: 0, transform: 'scale(.5)' }, 'cubic-bezier(.2,.9,.3,1)'], [T_SKULL + 60, { opacity: 1, transform: 'scale(1.75,1.45)' }, 'ease-out'],
      [T_SKULL + 150, { opacity: 1, transform: 'scale(1.5,1.65)' }, 'ease-in-out'], [T_SKULL + 290, { opacity: 1, transform: 'scale(.92,1.06)' }, 'ease-in-out'],
      [T_SKULL + 400, { opacity: 1, transform: 'scale(1.05,.97)' }, 'ease-in-out'], [T_SKULL + 520, { opacity: 1, transform: 'none' }]]);
    tl(one('toChar'), [[T_SKULL - 20, { opacity: 0, transform: 'scale(.3)' }, 'ease-out'], [T_SKULL + 140, { opacity: 1, transform: 'scale(1.12)' }], [T_SKULL + 380, { opacity: 1, transform: 'none' }]]);
    tl(one('toEmber'), [[T_SKULL - 20, op(0), 'ease-out'], [T_SKULL + 60, op(1)], [3600, op(.8)], [3700, op(1)], [3880, op(.7)], [4000, op(.9)], [4180, op(.55)], [4300, op(.65)], [4450, op(.2)], [D, op(0)]]);
    tl(one('ember'), [[T_SKULL, { opacity: 0, transform: 'scale(.3)' }, 'ease-out'], [T_SKULL + 100, { opacity: 1, transform: 'scale(1)' }, 'ease-out'], [T_SKULL + 700, { opacity: 0, transform: 'scale(1.5)' }]]);
    tl(one('runesT'), [[T_SKULL - 60, { opacity: 0, transform: 'rotate(-50deg) scale(1.3)' }, OUT], [T_SKULL + 220, { opacity: 1, transform: 'rotate(0deg) scale(1)' }], [4000, { opacity: 1, transform: 'rotate(6deg)' }, IN], [D - 80, { opacity: 0, transform: 'rotate(18deg) scale(.8)' }]]);
    // ---- 2300 the strip is slapped on below their face
    tl(one('cap'), [[T_CAP, { opacity: 0, transform: 'translateY(-6%) rotate(-4deg) scale(1.08)' }, POP], [T_CAP + 260, { opacity: 1, transform: 'rotate(-1.2deg)' }], [D - 250, { opacity: 1, transform: 'rotate(-1.2deg)' }, IN], [D, { opacity: 0, transform: 'rotate(-1.2deg)' }]]);

    // ---- the sound, on the beats
    return cues([[0, () => { Sound.curse(); Sound.boneRattle(); }], [T_RISE, () => Sound.whoosh(.35, true, .14)], [T0, () => { Sound.whoosh((T1 - T0) / 1000, true, .16); Sound.hexLine((T1 - T0) / 1000); }],
      [T1, () => Sound.whoosh(.18, false, .14)], [T_POSSESS, () => Sound.thud()], [T_POSSESS + 320, () => Sound.scratch()], [T_CAP, () => Sound.slap()], [T_RETRACT, () => Sound.boneRattle()],
      [T_SKULL, () => { Sound.stamp(); Sound.sear(); }], [T_SKULL + 120, () => Sound.toll()]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const box = (b: Box) => ({ left: b.x, top: b.y, width: b.w, height: b.h });
  /** the hex sigil, in a card's own pixel space (clipped to the card) */
  const runes = (b: Box, c: Pt, k: number, fx: string) => {
    const R = 11 * k;
    return (
      <svg className="cv-cardsvg" width={b.w} height={b.h} viewBox={`0 0 ${b.w} ${b.h}`} aria-hidden="true">
        <g data-cfx={fx} className="cv-runes" opacity="0">
          <circle cx={c.x} cy={c.y} r={R} fill="none" stroke="#ff8a1e" strokeOpacity=".8" strokeWidth={.9 * k} />
          <circle cx={c.x} cy={c.y} r={R * .8} fill="none" stroke="#ff8a1e" strokeOpacity=".55" strokeWidth={.55 * k} strokeDasharray={`${.8 * k} ${2.8 * k}`} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 + (i % 3) * 4) * Math.PI / 180, R2 = R + 4.2 * k, x = c.x + R2 * Math.sin(a), y = c.y - R2 * Math.cos(a);
            return <path key={i} d={GLYPHS[(i * 7) % GLYPHS.length]} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(i * 30).toFixed(0)}) scale(${(.14 * k).toFixed(3)})`} fill="none" stroke="#ffb866" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </g>
      </svg>
    );
  };
  const skullStyle = (c: Pt, k: number) => ({ left: c.x - 15 * k, top: c.y - 15 * k, width: 30 * k, height: 30 * k, fontSize: 23 * k });
  return (
    <div className="cv" ref={root}>
      {/* the rest of the board dims while the figure travels */}
      <div className="cv-scrim" data-cfx="scrim" />
      {/* the old holder's burn, lifting off (the board's own corner, drawn here so it can leave) */}
      {from && (
        <div className="cv-card" style={{ ...box(from), ['--k' as any]: kF + 'px' }}>
          <div className="cv-clip">
            <div className="cv-char" data-cfx="fromChar" style={{ opacity: 0 }} />
            <div className="cv-rim" data-cfx="fromEmber" />
            {runes(from, Fl, kF, 'runesF')}
            <span className="cv-mark" data-cfx="fromSkull" style={{ ...skullStyle(Fl, kF), opacity: 0 }}>☠</span>
          </div>
        </div>
      )}
      {/* the new holder's card: everything that lands here stays inside it, except the skull's slam */}
      {to && (
        <div className="cv-card" style={{ ...box(to), ['--k' as any]: kT + 'px' }}>
          <div className="cv-clip">
            <div className="cv-dim" data-cfx="toDim" />
            <svg className="cv-vines" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                {VINES.map((d, j) => (
                  <mask key={j} id={`${uid}m${j}`} maskUnits="userSpaceOnUse" x={-40} y={-40} width={VB_W + 80} height={VB_H + 80}>
                    <path data-cfx="vine" data-j={j} d={d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1} fill="none" stroke="#fff" strokeWidth={VINE_W[j] * 1.7} strokeLinecap="round" />
                  </mask>
                ))}
              </defs>
              <g data-cfx="vines" className="cv-vgrip" style={{ transformOrigin: `${cxv.toFixed(1)}px ${cyv.toFixed(1)}px` }}>
                {VINES.map((_, j) => (
                  <g key={j} mask={`url(#${uid}m${j})`}>
                    {/* a soft contact shadow on the paper, a faint ember glow round the rim, the body with a hot edge */}
                    <path data-cfx="vbody" data-j={j} d="M0 0" fill="#000" fillOpacity=".35" transform="translate(1.8 2.8)" />
                    <path data-cfx="vbody" data-j={j} d="M0 0" fill="none" stroke="#ff5a1e" strokeOpacity=".28" strokeWidth={3.4} strokeLinejoin="round" />
                    <path data-cfx="vbody" data-j={j} d="M0 0" fill="#1e060c" stroke="#ff8a4a" strokeOpacity=".7" strokeWidth={.8} strokeLinejoin="round" />
                  </g>
                ))}
                {VINES.flatMap((_, j) => THORN_T.map((t, i) => <path key={'t' + j + '-' + i} data-cfx="thorn" data-j={j} data-t={t} data-side={(i + j) % 2 ? 1 : -1} className="cv-thorn" d="M0 0" fill="#22060c" stroke="#ff7a3a" strokeOpacity=".55" strokeWidth=".7" opacity="0" />))}
              </g>
            </svg>
            <div className="cv-knot" data-cfx="knot" style={skullStyle(Tl, kT)} />
            <div className="cv-char" data-cfx="toChar" />
            <div className="cv-rim" data-cfx="toEmber" />
            <div className="cv-ember" data-cfx="ember" style={{ left: Tl.x - 26 * kT, top: Tl.y - 26 * kT, width: 52 * kT, height: 52 * kT }} />
            {runes(to, Tl, kT, 'runesT')}
          </div>
          {/* the skull the vines knot into: exactly where the board's own resting skull sits; it slams out past the
              card's edge, growing from its corner nearest the name so it never lands on it */}
          <span className="cv-mark cv-slam" data-cfx="skull" style={{ ...skullStyle(Tl, kT), transformOrigin: `${skOrigin.x.toFixed(1)}px ${skOrigin.y.toFixed(1)}px` }}>☠</span>
        </div>
      )}
      {geo && (
        <div className="cv-comet" data-cfx="comet" style={{ ['--k' as any]: kr + 'px', ['--trail' as any]: TRAIL + 'px', opacity: 0 }}><i /></div>
      )}
      {puffs.map((p, i) => (
        <div key={i} className="cv-at" style={{ left: p.x, top: p.y }}>
          {p.ember
            ? <div className="cv-spark" data-cfx="puff" style={{ width: 3.2 * kr, height: 3.2 * kr, margin: -1.6 * kr }} />
            : <div className="cv-puff" data-cfx="puff" style={{ width: p.size, height: p.size, margin: -p.size / 2, backgroundPosition: `${(p.cell % 2) * 100}% ${(p.cell >> 1) * 100}%` }} />}
        </div>
      ))}
      {/* THE SHADOW FIGURE: a hooded wraith, shaded from within, a cold blue-white rim light all round (strongest on
          one side), a wisping hem, two ember eye glints, wreathed in baked smoke, the skull carried at its chest */}
      {F && (
        <div className="cv-figure" data-cfx="figure" style={{ ['--k' as any]: kr + 'px', ['--fig' as any]: FIG + 'px', opacity: 0 }}>
          <div className="cv-fig-smoke" />
          <div className="cv-fig-halo" />
          <svg className="cv-fig-svg" viewBox="0 0 100 140" aria-hidden="true">
            <defs>
              <radialGradient id={`${uid}robe`} cx=".46" cy=".36" r=".72"><stop offset="0" stopColor="#2a2238" /><stop offset=".45" stopColor="#0f0b16" /><stop offset="1" stopColor="#040306" /></radialGradient>
              <linearGradient id={`${uid}hem`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0810" /><stop offset="1" stopColor="#0a0810" stopOpacity="0" /></linearGradient>
              <linearGradient id={`${uid}rim`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4faff" /><stop offset=".55" stopColor="#a8cfff" /><stop offset="1" stopColor="#7aa8ff" stopOpacity="0" /></linearGradient>
            </defs>
            <g transform={mirror ? 'translate(100 0) scale(-1 1)' : undefined}>
              {/* the outer hem: fainter, longer wisps that lag a beat behind */}
              <g data-cfx="hem" className="cv-fig-tail">
                <path d="M26 80 C 20 104, 8 122, 2 140 C 12 128, 18 132, 22 140 C 26 126, 34 130, 38 140 C 42 124, 50 128, 54 140 C 58 124, 66 126, 72 138 C 74 122, 84 124, 94 134 C 84 110, 78 96, 74 80 Z" fill={`url(#${uid}hem)`} opacity=".55" />
              </g>
              <g data-cfx="tail" className="cv-fig-tail">
                <path d="M30 78 C 26 100, 18 116, 12 136 L 26 124 L 34 138 L 44 122 L 52 140 L 58 122 L 68 136 L 70 118 L 84 130 C 76 110, 72 96, 70 78 Z" fill={`url(#${uid}robe)`} />
                {/* the rim light runs on down the hem's edge, swinging with it */}
                <path d="M30 80 C 26 100, 18 116, 12 136" fill="none" stroke={`url(#${uid}rim)`} strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" />
              </g>
              <path d="M50 4 C 30 6, 22 26, 22 42 C 14 50, 10 64, 18 82 C 34 88, 66 88, 82 82 C 90 64, 86 50, 78 42 C 78 26, 70 6, 50 4 Z" fill={`url(#${uid}robe)`} />
              {/* the hood's fold */}
              <path d="M50 8 C 40 12, 36 24, 38 30" fill="none" stroke="#4a4466" strokeOpacity=".7" strokeWidth="1.6" strokeLinecap="round" />
              {/* the cold rim light: a soft bloom under a hot line, strong down one side, fainter down the other */}
              <g data-cfx="figRim">
                <path d="M50 4 C 30 6, 22 26, 22 42 C 14 50, 10 64, 18 82" fill="none" stroke="#8ab8ff" strokeOpacity=".3" strokeWidth="8" strokeLinecap="round" />
                <path d="M50 4 C 30 6, 22 26, 22 42 C 14 50, 10 64, 18 82" fill="none" stroke={`url(#${uid}rim)`} strokeWidth="2.6" strokeLinecap="round" />
                <path d="M50 4 C 70 6, 78 26, 78 42 C 86 50, 90 64, 82 82" fill="none" stroke="#8ab8ff" strokeOpacity=".18" strokeWidth="6" strokeLinecap="round" />
                <path d="M50 4 C 70 6, 78 26, 78 42 C 86 50, 90 64, 82 82" fill="none" stroke={`url(#${uid}rim)`} strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
              </g>
              <path d="M50 18 C 38 19, 33 30, 34 42 C 40 47, 60 47, 66 42 C 67 30, 62 19, 50 18 Z" fill="#000" />
              <g data-cfx="eyes" opacity="0">
                <ellipse cx="43" cy="34" rx="4" ry="1.9" fill="#ff6a4a" opacity=".35" /><ellipse cx="57" cy="34" rx="4" ry="1.9" fill="#ff6a4a" opacity=".35" />
                <ellipse cx="43" cy="34" rx="2" ry=".9" fill="#ffd0c4" opacity=".8" /><ellipse cx="57" cy="34" rx="2" ry=".9" fill="#ffd0c4" opacity=".8" />
                <circle cx="42.2" cy="33.6" r=".5" fill="#fff" /><circle cx="56.2" cy="33.6" r=".5" fill="#fff" />
              </g>
            </g>
          </svg>
          <span className="cv-fig-skull">☠</span>
        </div>
      )}
      <div className="cv-cap" data-cfx="cap" style={{ left: capX, top: capY, width: capW, padding: `${pad}px ${pad * 1.6}px`, fontSize: fs2 }}>
        <div className="cv-cap1" data-fit style={{ fontSize: fs1 }}>{fromName.toUpperCase()} PASSED THE CURSE TO {toName.toUpperCase()}</div>
        <div className="cv-cap2" data-fit style={{ fontSize: fs2 }}>{toName.toUpperCase()} NOW SPINS TWICE ON EVERY PUNISHMENT</div>
      </div>
    </div>
  );
}
