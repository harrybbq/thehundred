// TV: the Scrooge's three abilities, in his counting house. Ported from the approved mockups (design/mockups/
// ScroogeSwap / ScroogeRespin / ScroogeGraffiti .dc.html, and scrooge-kit.js → ./scroogeKit.js). Each opens with a static
// sting and the old "BAH, HUMBUG!", then the lights come up on his panelled room, ledgers and lamp.
//   swap      SWAPSIES!: his two white-gloved hands come down, pick up the two polaroids and cross them over; his top hat
//             drops onto the new victim; YOU'RE UP! / OFF THE HOOK! beside the cards (never over the faces)
//   respin    his coin (heads = his hat) falls in, flipping, and SLAMS onto a wheel lying on the counter, knocking it into
//             a full turn: AGAIN! AGAIN! AGAIN!, SPIN AGAIN, PEASANTS
//   graffiti  his gloved hand writes the text on a riveted plaque, stroke by stroke (stroke-dashoffset), then drips and
//             TEE-HEE!. Shown at the start of the next punishment, not when it was written.
// Every scene plays once and holds; the DOM's own styles are the end frame (reduced motion shows just that).
// The static art is markup built from fixed data (scroogeKit.js); names and the graffiti text are rendered by React.
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Player } from '../lib/types';
import { initials } from '../lib/util';
import { Sound, cues } from '../fx/sound';
import K from './scroogeKit.js';
import { useFitScale } from './stage';

export type ScroogeFx =
  | { kind: 'swap'; from?: Player; to?: Player }
  | { kind: 'respin' }
  | { kind: 'graffiti'; text: string };

/** How long each animation holds the screen (ms). */
export const SCROOGE_MS = { swap: 4300, respin: 3900, graffiti: 4500 } as const;

type Frames = [number, Keyframe, string?][];
const abs = { position: 'absolute' } as const;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Markup from scroogeKit.js: fixed data only, never player input. */
const Art = ({ html, style, className, fx }: { html: string; style?: CSSProperties; className?: string; fx?: string }) => <div data-fx={fx} className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
const ArtG = ({ html, ...rest }: { html: string } & React.SVGProps<SVGGElement>) => <g {...rest} dangerouslySetInnerHTML={{ __html: html }} />;
const VIGNETTE = 'radial-gradient(ellipse 62% 66% at 50% 52%,transparent 50%,rgba(0,0,0,.5) 80%,rgba(0,0,0,.85)),linear-gradient(90deg,rgba(0,0,0,.45),transparent 14%,transparent 86%,rgba(0,0,0,.45))';
const DEFS = K.defs(), STING = K.sting(), GLOVE = K.glove();

/** One-shot keyframe timeline over P ms: absolute-time frames, plays once and holds (fill both). */
function timeline(P: number) {
  const A: Animation[] = [];
  const tl = (el: Element | undefined | null, frames: Frames) => {
    if (!el) return;
    const kf: Keyframe[] = frames.map(([t, p, e]) => ({ ...p, offset: Math.min(1, Math.max(0, t / P)), ...(e ? { easing: e } : {}) }));
    if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
    if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
    A.push(el.animate(kf, { duration: P, fill: 'both' }));
  };
  return { tl, A };
}
const tf = (v: string) => ({ transform: v }), op = (v: number) => ({ opacity: v });

export function ScroogeOverlay({ fx }: { fx: ScroogeFx }) {
  const scale = useFitScale();
  useEffect(() => { Sound.staticNoise(); const t = setTimeout(() => Sound.scrooge(), 420); return () => clearTimeout(t); }, []);
  return (
    <div className="jr-ov sg-ov">
      <div className="jr-stage" style={{ transform: `scale(${scale})`, background: '#0a0804' }}>
        {fx.kind === 'swap' ? <Swap from={fx.from} to={fx.to} /> : fx.kind === 'respin' ? <Respin /> : <Graffiti text={fx.text} />}
      </div>
    </div>
  );
}

/** the shared wrapper: defs, the scene, grit, grain, the sting on top */
function Room({ root, children }: { root: React.RefObject<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <div ref={root} className="sg-root">
      <Art html={DEFS} />
      <div data-fx="stage" className="sg-layer">{children}</div>
      <div className="mk-grit" style={{ opacity: .1, zIndex: 18 }} />
      <div className="sg-grain" />
      <Art html={STING} />
    </div>
  );
}
const useQ = (root: React.RefObject<HTMLDivElement>) => (s: string) => [...(root.current?.querySelectorAll(`[data-fx="${s}"]`) ?? [])];

// ======================================================================== SWAPSIES
const CARD = { w: 330, h: 330 - 32 + 16 + 78 };
const SLOTS = [{ x: 450, y: 400 }, { x: 1140, y: 400 }];
const D = SLOTS[1].x - SLOTS[0].x;
/** a name that fits its polaroid strip: one line up to 58px, else split at the space nearest the middle */
function fitName(raw: string) {
  const name = raw.toUpperCase(), W = 298, k = .52, one = W / ([...name].length * k);
  let fs = Math.min(58, Math.floor(one)), lines = [name];
  if (one < 40 && /[ -]/.test(name)) {
    const cuts = [...name].map((c, i) => (c === ' ' || c === '-' ? i : -1)).filter(i => i > 0), mid = name.length / 2, c = cuts.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    lines = [name.slice(0, name[c] === '-' ? c + 1 : c), name.slice(c + 1)]; fs = Math.min(40, Math.floor(W / (Math.max(...lines.map(l => l.length)) * k)));
  }
  return { lines, fs: Math.max(26, fs), nice: raw ? raw[0].toUpperCase() + raw.slice(1) : raw };
}
function Polaroid({ p, tilt }: { p?: Player; tilt: number }) {
  const n = fitName(p?.name ?? '?');
  return (
    <div className="sg-polaroid" style={{ left: 0, top: 0, width: CARD.w, transform: `rotate(${tilt}deg)`, transformOrigin: '50% 0' }}>
      <div className="sg-ph">{p?.selfie_url
        ? <img src={p.selfie_url} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#2c6e74,#0f3a41 55%,#06191d)', color: '#f1e8d4', fontFamily: "'Big Shoulders Display',sans-serif", fontWeight: 900, fontSize: 130 }}>{initials(p?.name ?? '?')}</div>}</div>
      <div className="sg-nm" style={{ fontSize: n.fs, lineHeight: .92, textAlign: 'center' }}>{n.lines.map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}</div>
    </div>
  );
}
const SWAP_ART = {
  room: K.room({ lampTop: 292, cordTop: 262, floor: 690, spread: 640, shelfTop: 100, shelfBot: 690 }),
  counter: K.counter({ back: 690, front: 830 }),
  props: K.ledger(140, 640, .95, true) + K.stacks(1560, 780, 1),
  hat: K.hat(190),
};
function Swap({ from, to }: { from?: Player; to?: Player }) {
  const root = useRef<HTMLDivElement>(null), q = useQ(root);
  const fromN = fitName(from?.name ?? 'Them'), toN = fitName(to?.name ?? 'You');
  const one = Math.floor(1780 / ((fromN.nice.length + toN.nice.length + 38) * .43));
  const quote = one >= 44 ? { fs: Math.min(52, one), two: false, y: 930 } : { fs: Math.max(40, Math.min(48, Math.floor(1780 / (Math.max(fromN.nice.length + 7, toN.nice.length + 29) * .43)))), two: true, y: 904 };
  useLayoutEffect(() => {
    if (reduced()) return cues([[800, Sound.stamp], [1100, Sound.giggle]]);
    const { tl, A } = timeline(SCROOGE_MS.swap);
    K.stingTimeline(tl, q);
    tl(q('kick')[0], [[450, { opacity: 0, transform: 'translateY(-16px)' }, 'ease-out'], [900, { opacity: 1, transform: 'none' }]]);
    tl(q('title')[0], K.POP(550, 520));
    // the hands come down (each onto its own card), pinch, carry, let go, go back up
    const glove = (el: Element | undefined, t0: number) => tl(el, [[t0, tf('translateY(-1300px)'), 'cubic-bezier(.2,.7,.3,1)'], [t0 + 400, tf('translateY(0px)'), 'ease-out'], [t0 + 440, tf('translateY(10px)'), 'ease-in-out'], [1270, tf('translateY(6px)')],
      [2020, tf('translateY(6px)'), 'ease-out'], [2090, tf('translateY(-14px)'), 'cubic-bezier(.5,0,.8,.4)'], [2450, tf('translateY(-1300px)')]]);
    glove(q('gloveA')[0], 700); glove(q('gloveB')[0], 760);
    // FROM (A) goes left → right OVER the top; TO (B) right → left, low, in front
    tl(q('cardA')[0], [[1200, tf('translate(0px,0px) rotate(0deg) scale(1)'), 'ease-out'], [1330, tf('translate(-10px,-60px) rotate(-4deg) scale(1.05)'), 'ease-in-out'],
      [1600, tf(`translate(${D * .5}px,-170px) rotate(8deg) scale(1.06)`), 'ease-in-out'], [1880, tf(`translate(${D + 12}px,-50px) rotate(2deg) scale(1.05)`), 'cubic-bezier(.6,0,1,.6)'],
      [1960, tf(`translate(${D}px,6px) rotate(0deg) scale(1.03,.96)`), 'ease-out'], [2060, tf(`translate(${D}px,0px) rotate(0deg) scale(1)`)]]);
    tl(q('cardB')[0], [[1200, tf('translate(0px,0px) rotate(0deg) scale(1)'), 'ease-out'], [1330, tf('translate(10px,-40px) rotate(3deg) scale(1.03)'), 'ease-in-out'],
      [1600, tf(`translate(${-D * .5}px,160px) rotate(-7deg) scale(.92)`), 'ease-in-out'], [1880, tf(`translate(${-D - 12}px,-36px) rotate(-2deg) scale(1.03)`), 'cubic-bezier(.6,0,1,.6)'],
      [1960, tf(`translate(${-D}px,6px) rotate(0deg) scale(1.03,.96)`), 'ease-out'], [2060, tf(`translate(${-D}px,0px) rotate(0deg) scale(1)`)]]);
    // the thunk: dust puffs, the coin stacks hop, the room shakes a touch
    q('puff').forEach(el => tl(el, [[1950, { opacity: 0, transform: 'scale(.5,.6)' }, 'ease-out'], [2050, { opacity: 1, transform: 'scale(1,1)' }, 'ease-in'], [2350, { opacity: 0, transform: 'scale(1.35,1.1)' }]]));
    q('stack').forEach((el, i) => tl(el, [[1960 + i * 15, tf('translateY(0px)'), 'ease-out'], [2040 + i * 15, tf(`translateY(${-10 - (i % 3) * 5}px)`), 'ease-in'], [2120 + i * 15, tf('translateY(0px)')]]));
    tl(q('set')[0], [[1955, tf('translate(0px,0px)')], [1990, tf('translate(0px,7px)')], [2040, tf('translate(0px,-4px)')], [2090, tf('translate(0px,2px)')], [2140, tf('translate(0px,0px)')]]);
    // the hat drops onto the new victim and settles
    tl(q('hat')[0], [[2150, { opacity: 1, transform: 'translate(40px,-760px) rotate(-40deg)' }, 'cubic-bezier(.5,0,.9,.5)'], [2400, { opacity: 1, transform: 'translate(0px,0px) rotate(4deg) scale(1.12,.78)' }, 'ease-out'],
      [2480, { opacity: 1, transform: 'translate(0px,-46px) rotate(-6deg) scale(.96,1.06)' }, 'ease-in'], [2560, { opacity: 1, transform: 'translate(0px,0px) rotate(2deg) scale(1.05,.9)' }, 'ease-out'], [2640, { opacity: 1, transform: 'none' }]]);
    tl(q('you')[0], K.STAMP(2500, -9));
    tl(q('off')[0], K.STAMP(2620, 8));
    tl(q('quote')[0], [[2800, { opacity: 0, transform: 'translateY(24px)' }, 'ease-out'], [3200, { opacity: 1, transform: 'none' }]]);
    // sound on the beats: the gloves swoop down and land, the cards are carried over, THUNK (the stacks rattle), the hat
    // drops onto the new victim, the two stamps, his snicker under the quote
    const hush = cues([[700, () => Sound.whoosh(.4, false, .16)], [1100, Sound.plop], [1160, Sound.plop], [1330, () => Sound.whoosh(.55, true, .2)],
      [1960, Sound.stamp], [1980, () => Sound.coinDrop()], [2150, () => Sound.fall(.25)], [2400, Sound.plop], [2500, Sound.stamp], [2620, Sound.stamp], [2900, Sound.giggle]]);
    return () => { A.forEach(a => a.cancel()); hush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cards = [
    { fx: 'cardB', glove: 'gloveB', p: to, x: SLOTS[1].x, y: SLOTS[1].y, dx: -D, tilt: -3.5, z: 4, gx: 16, grot: 30 },
    { fx: 'cardA', glove: 'gloveA', p: from, x: SLOTS[0].x, y: SLOTS[0].y, dx: D, tilt: 3, z: 5, gx: -10, grot: -30 },
  ];
  return (
    <Room root={root}>
      <div data-fx="set" className="sg-layer">
        <Art html={SWAP_ART.room} /><Art html={SWAP_ART.counter} />
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" className="sg-layer" style={{ overflow: 'visible' }} aria-hidden="true"><ArtG html={SWAP_ART.props} /></svg>
        {SLOTS.map((s, i) => <div key={i} style={{ ...abs, left: s.x - 30, top: s.y + CARD.h - 26, width: CARD.w + 60, height: 44, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side,rgba(0,0,0,.75),transparent)' }} />)}
      </div>
      <div data-fx="kick" className="sg-kick" style={{ ...abs, left: 0, right: 0, top: 46, zIndex: 9 }}>The Scrooge says…</div>
      <div data-fx="title" className="sg-title swap" style={{ ...abs, left: 0, right: 0, top: 92, fontSize: 200, transformOrigin: '50% 60%', zIndex: 9 }}>SWAPSIES!</div>
      {cards.map(c => (
        <div key={c.fx} data-fx={c.fx} className="sw-carrier" style={{ left: c.x, top: c.y, transform: `translate(${c.dx}px,0px)`, zIndex: c.z }}>
          <Polaroid p={c.p} tilt={c.tilt} />
          <svg data-fx={c.glove} className="sw-glove" style={{ left: CARD.w / 2 + c.gx, top: -4, transform: 'translateY(-1300px)' }} aria-hidden="true"><ArtG html={GLOVE} transform={`rotate(${c.grot}) scale(.95)`} /></svg>
        </div>
      ))}
      {SLOTS.map((s, i) => <div key={i} data-fx="puff" style={{ ...abs, left: s.x - 60, top: s.y + CARD.h - 50, width: CARD.w + 120, height: 80, opacity: 0, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side,rgba(241,232,212,.45),rgba(241,232,212,.12) 60%,transparent)' }} />)}
      <div style={{ ...abs, left: SLOTS[0].x - 70, top: SLOTS[0].y - 118, transform: 'rotate(-16deg)', zIndex: 6 }}><Art fx="hat" html={SWAP_ART.hat} style={{ transformOrigin: '50% 100%' }} /></div>
      <div data-fx="you" className="sg-scrawl sg-red" style={{ left: 70, top: 470, fontSize: 84, transform: 'rotate(-9deg)', zIndex: 7 }}>YOU'RE UP!</div>
      <div data-fx="off" className="sg-scrawl sg-green" style={{ left: SLOTS[1].x + CARD.w + 40, top: 430, fontSize: 66, transform: 'rotate(8deg)', zIndex: 7 }}>OFF THE<br />HOOK!</div>
      <div data-fx="quote" className="sg-quote" style={{ ...abs, left: 0, right: 0, top: quote.y, zIndex: 7, fontSize: quote.fs }}>“{fromN.nice}? Bah!{quote.two && <br />} {toN.nice} looks far more <b>punishable</b>.”</div>
      <div className="sg-layer" style={{ background: VIGNETTE, zIndex: 8 }} />
    </Room>
  );
}

// ======================================================================== RE-SPIN
const RS = (() => {
  const f1 = K.f1;
  const wh = { x: 960, y: 650, r: 290, flat: .5, depth: 44 };
  const COLS = ['#6a4f8f', '#e0b458', '#5a1a12', '#e8dcc0', '#1d3a36', '#ff4f9a'];
  const segs = Array.from({ length: 12 }, (_, i) => { const a0 = (i / 12) * Math.PI * 2 - Math.PI / 2, a1 = a0 + Math.PI / 6, r = wh.r;
    return { c: COLS[i % COLS.length], d: `M0 0L${f1(Math.cos(a0) * r)} ${f1(Math.sin(a0) * r)}A${r} ${r} 0 0 1 ${f1(Math.cos(a1) * r)} ${f1(Math.sin(a1) * r)}Z`, px: f1(Math.cos(a0) * (r - 18)), py: f1(Math.sin(a0) * (r - 18)) }; });
  const coin = { x: wh.x, y: wh.y, r: 150, flat: .62, hang: -800 };
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2 + .09, w = .06, r0 = coin.r * 1.1, r1 = coin.r * (i % 2 ? 1.6 : 2.05);
    const p = (ang: number, r: number) => `${f1(coin.x + Math.cos(ang) * r)} ${f1(coin.y + Math.sin(ang) * r * coin.flat)}`;
    return `M${p(a - w, r0)}L${p(a, r1)}L${p(a + w, r0)}Z`;
  }).join('');
  const dust = Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (i / 9), side = Math.cos(a);
    return { x: f1(coin.x + side * coin.r * 1.05), y: f1(coin.y + 18 - Math.sin(a) * 20), r: f1(34 + K.rnd(i + 3) * 30), dx: f1(side * (130 + K.rnd(i + 9) * 110)), dy: f1(-30 - K.rnd(i + 5) * 70) }; });
  const agains = [{ s: 116, r: -8 }, { s: 156, r: 4 }, { s: 116, r: -3 }];
  const art = {
    room: K.room({ lampTop: 250, cordTop: 236, floor: 500, spread: 520, shelfTop: 90, shelfBot: 500 }),
    counter: K.counter({ back: 500, front: 812, inset: 110 }),
    props: K.ledger(110, 620, .95, true) + K.stacks(1540, 760, 1.1),
  };
  return { wh: { ...wh, segs }, coin: { ...coin, rays }, dust, agains, art };
})();
function Respin() {
  const root = useRef<HTMLDivElement>(null), q = useQ(root);
  const { wh, coin, dust, agains, art } = RS;
  useLayoutEffect(() => {
    if (reduced()) return cues([[800, Sound.clang], [1300, Sound.giggle]]);
    const { tl, A } = timeline(SCROOGE_MS.respin);
    const io = 'ease-in-out', LAND = 1180;
    K.stingTimeline(tl, q);
    tl(q('kick')[0], [[450, { opacity: 0, transform: 'translateY(-16px)' }, 'ease-out'], [900, { opacity: 1, transform: 'none' }]]);
    // tossed high: it falls in accelerating the whole way, flipping, and SLAMS flat
    tl(q('coinDrop')[0], [[450, tf(`translateY(${coin.hang}px)`), 'cubic-bezier(.5,0,.95,.55)'], [LAND, tf('translateY(0px)')]]);
    const flips = [450, 560, 660, 750, 840, 920, 1000, 1090, 1180];
    tl(q('coinFlip')[0], flips.map((t, i) => [t, tf(`scaleY(${i % 2 ? -1 : 1})`), io] as [number, Keyframe, string]));
    const zeros = flips.slice(1).map((t, i) => (t + flips[i]) / 2);
    const swap = (first: number) => { const f: Frames = [[0, op(first)]]; zeros.forEach((z, i) => { const v = i % 2 ? first : 1 - first; f.push([z, op(1 - v)], [z, op(v)]); }); return f; };
    tl(q('faceH')[0], swap(1)); tl(q('faceT')[0], swap(0));
    tl(q('coinSquash')[0], [[960, tf('scale(1,1)'), 'ease-in'], [LAND, tf(`scale(1.12,${coin.flat * .7})`), 'ease-out'], [LAND + 90, tf(`scale(.97,${coin.flat * 1.08})`), io], [LAND + 180, tf(`scale(1.02,${coin.flat * .96})`), io], [LAND + 260, tf(`scale(1,${coin.flat})`)]]);
    tl(q('shadow')[0], [[800, { opacity: 0, transform: 'scale(.4)' }, 'ease-in'], [LAND, { opacity: .6, transform: 'scale(1)' }]]);
    // THE HIT
    tl(q('ring')[0], [[LAND - 1, { opacity: 0, transform: 'scale(.7)' }, 'steps(1,end)'], [LAND, { opacity: 1, transform: 'scale(.7)' }, 'cubic-bezier(.2,.8,.3,1)'], [LAND + 420, { opacity: 0, transform: 'scale(1.9)' }]]);
    q('dust').forEach((el, i) => { const d = dust[i]; tl(el, [[LAND, { opacity: 0, transform: 'translate(0px,0px) scale(.4)' }, 'ease-out'], [LAND + 60, { opacity: .7, transform: `translate(${d.dx * .3}px,${d.dy * .3}px) scale(.8)` }, 'ease-out'], [LAND + 520, { opacity: 0, transform: `translate(${d.dx}px,${d.dy}px) scale(1.6)` }]]); });
    tl(q('set')[0], [[LAND, tf('translate(0px,0px)')], [LAND + 40, tf('translate(-6px,14px)')], [LAND + 100, tf('translate(5px,-8px)')], [LAND + 170, tf('translate(-3px,4px)')], [LAND + 250, tf('translate(1px,-2px)')], [LAND + 330, tf('translate(0px,0px)')]]);
    tl(q('flash')[0], [[LAND - 1, op(0), 'steps(1,end)'], [LAND, op(1), 'ease-out'], [LAND + 380, op(0)]]);
    tl(q('rays')[0], [[LAND, { opacity: 0 }, 'ease-out'], [LAND + 120, { opacity: 1 }, 'ease-in-out'], [LAND + 700, { opacity: .4 }]]);
    q('stack').forEach((el, i) => { const h = 22 + (i * 17) % 30, t = LAND + 20 + i * 25; tl(el, [[t, tf('translateY(0px) rotate(0deg)'), 'ease-out'], [t + 130, tf(`translateY(${-h}px) rotate(${i % 2 ? 6 : -5}deg)`), 'ease-in'], [t + 260, tf('translateY(0px) rotate(0deg)'), 'ease-out'], [t + 320, tf('translateY(-5px) rotate(0deg)'), 'ease-in'], [t + 380, tf('translateY(0px) rotate(0deg)')]]); });
    // the hit knocks the wheel into one full turn, then it runs down and ends where it began
    tl(q('wheelSpin')[0], [[LAND, tf('rotate(0deg)'), 'cubic-bezier(.15,.75,.35,1)'], [LAND + 1500, tf('rotate(360deg)')]]);
    q('again').forEach((el, i) => tl(el, K.STAMP(1350 + i * 150, agains[i].r, 260)));
    tl(q('title')[0], [[1900, { opacity: 0, transform: 'scaleX(2.4) scaleY(.2)' }, 'cubic-bezier(.3,1.4,.5,1)'], [2200, { opacity: 1, transform: 'scaleX(.92) scaleY(1.15)' }, io], [2400, { opacity: 1, transform: 'none' }]]);
    tl(q('quote')[0], [[2300, { opacity: 0, transform: 'translateY(20px)' }, 'ease-out'], [2700, { opacity: 1, transform: 'none' }]]);
    // sound: tossed up (a whistle down as it falls), the flips ring, it SLAMS flat, the wheel ratchets round and runs down,
    // AGAIN stamps, the title slaps in, his snicker
    const hush = cues([[450, () => Sound.fall((LAND - 450) / 1000)], ...flips.slice(1, -1).map(t => [t, Sound.countTick] as [number, () => void]),
      [LAND, Sound.clang], [LAND, () => Sound.wheelSpin(1.5, 20)], ...agains.map((_, i) => [1350 + i * 150, Sound.stamp] as [number, () => void]),
      [1900, Sound.slap], [2500, Sound.giggle]]);
    return () => { A.forEach(a => a.cancel()); hush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fb: CSSProperties = { transformBox: 'fill-box', transformOrigin: '50% 50%' };
  return (
    <Room root={root}>
      <div data-fx="set" className="sg-layer">
        <Art html={art.room} /><Art html={art.counter} />
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" className="sg-layer" style={{ overflow: 'visible' }} aria-hidden="true">
          <defs><radialGradient id="rs-flash"><stop offset="0" stopColor="#fff6d0" stopOpacity=".9" /><stop offset=".35" stopColor="#ffd84a" stopOpacity=".45" /><stop offset="1" stopColor="#ffd84a" stopOpacity="0" /></radialGradient></defs>
          <ArtG html={art.props} />
          {/* THE WHEEL, lying on the counter; the hit knocks it into one full turn */}
          <g transform={`translate(${wh.x} ${wh.y}) scale(1 ${wh.flat})`}>
            <circle cx="0" cy={wh.depth} r={wh.r + 14} fill="#1a0c05" stroke="#000" strokeWidth="6" />
            <circle cx="0" cy="0" r={wh.r + 14} fill="url(#sg-brass-h)" stroke="#000" strokeWidth="6" />
            <g data-fx="wheelSpin">
              {wh.segs.map((g, i) => <path key={i} d={g.d} fill={g.c} stroke="#000" strokeWidth="4" />)}
              {wh.segs.map((g, i) => <circle key={i} cx={g.px} cy={g.py} r="9" fill="#fff0b0" stroke="#000" strokeWidth="3" />)}
              <circle cx="0" cy="0" r={wh.r * .18} fill="url(#sg-brass-h)" stroke="#000" strokeWidth="5" />
            </g>
          </g>
          <g transform={`translate(${wh.x} ${wh.y - wh.r * wh.flat - 6})`}>
            <path d="M-22 -58 H22 V-40 L0 16 L-22 -40 Z" fill="url(#sg-brass-h)" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="0" cy="-46" r="7" fill="#3a2c00" />
          </g>
          <ellipse data-fx="flash" cx={coin.x} cy={coin.y} rx={coin.r * 3.2} ry={coin.r * 1.5} fill="url(#rs-flash)" style={{ opacity: 0 }} />
          <g data-fx="rays" style={{ opacity: .4 }}><path d={coin.rays} fill="#ffd84a" opacity=".5" /></g>
          <ellipse data-fx="shadow" cx={coin.x} cy={coin.y + 16} rx={coin.r * 1.05} ry={coin.r * .28} fill="#000" opacity=".6" style={fb} />
          <ellipse data-fx="ring" cx={coin.x} cy={coin.y + 8} rx={coin.r * 1.2} ry={coin.r * .36} fill="none" stroke="#fff0b0" strokeWidth="14" style={{ opacity: 0, ...fb }} />
          {dust.map((d, i) => <ellipse key={i} data-fx="dust" cx={d.x} cy={d.y} rx={d.r} ry={d.r * .55} fill="#e8dcc0" style={{ opacity: 0, ...fb }} />)}
          <g data-fx="coinDrop">
            <g data-fx="coinSquash" style={{ transformOrigin: `${coin.x}px ${coin.y}px`, transform: `scale(1,${coin.flat})` }}>
              <g data-fx="coinFlip" style={{ transformOrigin: `${coin.x}px ${coin.y}px` }}>
                <g data-fx="faceH"><use href="#sg-coin-heads" x={coin.x - coin.r} y={coin.y - coin.r} width={coin.r * 2} height={coin.r * 2} /></g>
                <g data-fx="faceT" style={{ opacity: 0, transformOrigin: `${coin.x}px ${coin.y}px`, transform: 'scaleY(-1)' }}><use href="#sg-coin-tails" x={coin.x - coin.r} y={coin.y - coin.r} width={coin.r * 2} height={coin.r * 2} /></g>
              </g>
            </g>
          </g>
        </svg>
      </div>
      <div data-fx="kick" className="sg-kick" style={{ ...abs, left: 0, right: 0, top: 30 }}>The Scrooge says…</div>
      <div style={{ ...abs, left: 0, right: 0, top: 80, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 44 }}>
        {agains.map((a, i) => <div key={i} data-fx="again" className="rs-again" style={{ fontSize: a.s, transform: `rotate(${a.r}deg)` }}>AGAIN!</div>)}
      </div>
      <div data-fx="title" className="rs-title sg-respin-title" style={{ ...abs, left: 0, right: 0, top: 838, fontSize: 150 }}>SPIN AGAIN, PEASANTS</div>
      <div data-fx="quote" className="sg-quote" style={{ ...abs, left: 0, right: 0, top: 985, fontSize: 50 }}>“Didn't fancy that one. <b>Spin it again.</b>”</div>
      <div className="sg-layer" style={{ background: VIGNETTE }} />
    </Room>
  );
}

// ======================================================================== GRAFFITI
const PLQ = { x: 250, y: 314, w: 1420, h: 392 };
const BOX = { x: 70, y: 52, w: 1280, h: 290 };
const PEN_OUT = { x: BOX.w + 260, y: BOX.h + 520 };
const GRAF_ART = {
  room: K.room({ lamp: false, lampTop: 250, floor: 742, shelfTop: 100, shelfBot: 742 }),
  counter: K.counter({ back: 742, front: 858 }),
  props: K.ledger(140, 700, .88, true) + K.stacks(1560, 830, 1) + K.inkwell(1450, 836, .9),
  glovePen: `<g transform="translate(0 92) rotate(180) scale(.78)">${GLOVE}</g>`,
  hat: K.hat(170),
};
const CHAINS = [PLQ.x + 110, PLQ.x + PLQ.w - 110].map((x, i) => `M${x} -10 V${PLQ.y + 6 + (i ? -18 : 18)}`);
function Graffiti({ text }: { text: string }) {
  const root = useRef<HTMLDivElement>(null), q = useQ(root);
  const w = useMemo(() => K.write(text, { w: BOX.w, h: BOX.h, maxCap: 112, minCap: 44 }), [text]);
  const raw = w.raw ?? text;
  const fbFs = Math.round(Math.max(56, Math.min(120, 2 * BOX.w / Math.max(1, [...raw].length) / 1.1)));
  useLayoutEffect(() => {
    if (reduced()) return cues([[800, Sound.stamp], [1000, Sound.giggle]]);
    const P = SCROOGE_MS.graffiti, { tl, A } = timeline(P);
    const sq: [number, () => void][] = [];                            // the marker squeaks, one per stroke
    K.stingTimeline(tl, q);
    tl(q('kick')[0], [[450, { opacity: 0, transform: 'translateY(-16px)' }, 'ease-out'], [900, { opacity: 1, transform: 'none' }]]);
    tl(q('title')[0], K.POP(550, 480));
    // measure every stroke in the writing's own coordinates (points along the gold path)
    const wroot = q('wroot')[0] as SVGGraphicsElement;
    const rinv = wroot.getScreenCTM()!.inverse();
    const strokes = (q('stroke') as SVGGElement[]).map(g => {
      const ink = g.querySelector('.gf-ink') as SVGPathElement, L = ink.getTotalLength(), m = rinv.multiply(ink.getScreenCTM()!), N = 8, pts: number[][] = [];
      for (let i = 0; i <= N; i++) { const p = ink.getPointAtLength(L * i / N); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
      let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return { g, pts, len: Math.max(len, 6), glyph: g.parentNode };
    });
    // ink AND the lifts between strokes share one budget, so the writing ends by END whatever the length
    const T0 = 950, END = 2600, total = strokes.reduce((s, x) => s + x.len, 0), sigFrom = strokes.length - 1;
    const gaps: number[] = strokes.map((s, i) => (!i ? 0 : s.glyph !== strokes[i - 1].glyph ? (i === sigFrom ? 140 : 55) : 35));
    const B = END - T0, gapSum = gaps.reduce((a, b) => a + b, 0), gapK = Math.min(1, .35 * B / Math.max(1, gapSum));
    const inkRaw = Math.max(900, Math.min(1600, total / 2.7)), durs = strokes.map(s => Math.max(30, s.len / Math.max(1, total) * inkRaw));
    const sum = gapSum * gapK + durs.reduce((a, b) => a + b, 0), fit = Math.min(1, B / Math.max(1, sum));
    let t = T0;
    const pen: [number, { x: number; y: number }, string][] = [[700, PEN_OUT, 'cubic-bezier(.2,.7,.3,1)']];
    strokes.forEach((s, i) => {
      t += gaps[i] * gapK * fit;
      const d = durs[i] * fit, ts = Math.round(t), te = Math.round(t + d);
      tl(s.g, [[ts - 1, op(0), 'steps(1,end)'], [ts, op(1)]]);
      sq.push([ts, () => Sound.marker(Math.max(.05, d / 1000))]);
      s.g.querySelectorAll('path').forEach(p => tl(p, [[ts, { strokeDashoffset: 1 } as Keyframe, 'linear'], [te, { strokeDashoffset: 0 } as Keyframe]]));
      s.pts.forEach((p, k) => pen.push([ts + (te - ts) * k / (s.pts.length - 1), { x: p[0], y: p[1] }, 'linear']));
      t = te;
    });
    if (!strokes.length) {                            // fallback: a stepped wipe, the hand sweeping along with it
      t = 2200;
      tl(q('fbInk')[0], [[T0, { clipPath: 'inset(0 100% 0 0)' } as Keyframe, 'steps(16,jump-end)'], [t, { clipPath: 'inset(0 0% 0 0)' } as Keyframe]]);
      pen.push([T0, { x: 20, y: BOX.h * .55 }, 'linear'], [t, { x: BOX.w - 20, y: BOX.h * .45 }, 'linear']);
      for (let k = T0; k < t; k += 160) sq.push([k, () => Sound.marker(.13)]);
    }
    const tEnd = Math.round(t);
    pen.push([tEnd + 40, pen[pen.length - 1][1], 'cubic-bezier(.5,0,.8,.5)'], [tEnd + 400, PEN_OUT, '']);
    if (pen[1]) pen[1][2] = 'linear';
    tl(q('pen')[0], pen.map(([tt, p, e]) => [tt, tf(`translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`), e || undefined] as [number, Keyframe, string?]));
    const drips = q('drip'), dStep = Math.min(60, 260 / Math.max(1, drips.length));
    drips.forEach((el, i) => tl(el, [[tEnd + 60 + i * dStep, tf('scaleY(0)'), 'cubic-bezier(.5,0,.2,1)'], [tEnd + 460 + i * dStep, tf('scaleY(1)')]]));
    tl(q('tee')[0], K.STAMP(tEnd + 200, 9));
    tl(q('quote')[0], [[tEnd + 250, { opacity: 0, transform: 'translateY(22px)' }, 'ease-out'], [tEnd + 600, { opacity: 1, transform: 'none' }]]);
    // the hand swoops in, squeaks out every stroke, the TEE-HEE stamp lands with his giggle
    const hush = cues([[700, () => Sound.whoosh(.3, false, .14)], ...sq, [tEnd + 200, Sound.stamp], [tEnd + 320, Sound.giggle]]);
    return () => { A.forEach(a => a.cancel()); hush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);
  const stroke = (d: string, key: number) => (
    <g key={key} data-fx="stroke" className="gf-stroke"><path className="gf-glow" d={d} pathLength={1} /><path className="gf-under" d={d} pathLength={1} /><path className="gf-ink" d={d} pathLength={1} /></g>
  );
  return (
    <Room root={root}>
      <Art html={GRAF_ART.room} /><Art html={GRAF_ART.counter} />
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" className="sg-layer" style={{ overflow: 'visible' }} aria-hidden="true"><ArtG html={GRAF_ART.props} /></svg>
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" className="sg-layer" aria-hidden="true">
        <g fill="none" strokeLinecap="round">{CHAINS.map((c, i) => <g key={i}><path d={c} stroke="#000" strokeWidth="10" strokeDasharray="12 5" /><path d={c} stroke="#8a6a10" strokeWidth="6" strokeDasharray="12 5" /></g>)}</g>
      </svg>
      <div data-fx="kick" className="sg-kick" style={{ ...abs, left: 0, right: 0, top: 40 }}>The Scrooge has been scribbling…</div>
      <div data-fx="title" className="sg-title" style={{ ...abs, left: 0, right: 0, top: 92, fontSize: 150, transformOrigin: '50% 60%' }}>ON YOUR WHEEL</div>
      {/* THE PLAQUE: riveted steel; his writing lives in its coordinates */}
      <div className="sg-panel" style={{ left: PLQ.x, top: PLQ.y, width: PLQ.w, height: PLQ.h, transform: 'rotate(-1.5deg)' }}>
        <div className="sg-dither" />
        <svg viewBox={`0 0 ${PLQ.w} ${PLQ.h}`} width={PLQ.w} height={PLQ.h} style={{ ...abs, inset: 0, overflow: 'visible' }} aria-label={text} className="sg-writing">
          <g data-fx="wroot" transform={`translate(${BOX.x} ${BOX.y})`}>
            {!w.fallback && <>
              {w.glyphs.map((g, gi) => (
                <g key={gi} transform={g.tf}>
                  {g.drip && <rect data-fx="drip" x={g.drip.x} y={g.drip.y} width={g.drip.w} height={g.drip.h} rx={g.drip.w / 2} fill="#ffd84a" style={{ transformBox: 'fill-box', transformOrigin: '50% 0' }} />}
                  {g.strokes.map((d, i) => stroke(d, i))}
                </g>
              ))}
              <g transform={w.sig.tf}>{w.sig.strokes.map((d, i) => stroke(d, i))}</g>
            </>}
            {w.fallback && (
              <foreignObject x="0" y="0" width={BOX.w} height={BOX.h}>
                <div data-fx="fbInk" style={{ width: BOX.w, height: BOX.h, display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: "'Permanent Marker',cursive", fontSize: fbFs, lineHeight: 1.05, color: '#ffd84a', textShadow: '0 5px 0 #4a3600,0 0 18px rgba(255,216,74,.35)', transform: 'rotate(-2deg)', clipPath: 'inset(0 0 0 0)', overflowWrap: 'anywhere' }}>{raw}</div>
              </foreignObject>
            )}
            {/* his hand and gold marker: nib at (0,0); rests out of frame (the end state) */}
            <g data-fx="pen" style={{ transform: `translate(${PEN_OUT.x}px,${PEN_OUT.y}px)` }}>
              <g transform="rotate(-32)">
                <ArtG html={GRAF_ART.glovePen} />
                <path d="M-6 3 Q0 -4 6 3 L9 22 H-9 Z" fill="#ffd84a" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                <rect x="-15" y="20" width="30" height="18" fill="url(#sg-brass-h)" stroke="#000" strokeWidth="4" />
                <rect x="-19" y="36" width="38" height="200" rx="9" fill="#3e2b58" stroke="#000" strokeWidth="5" />
                <rect x="-10" y="44" width="8" height="182" rx="4" fill="#8a6db3" opacity=".7" />
                <rect x="-19" y="200" width="38" height="12" fill="#ffd84a" stroke="#000" strokeWidth="3" />
              </g>
            </g>
          </g>
        </svg>
      </div>
      {/* the brass picture light over the plaque and its wash */}
      <div style={{ ...abs, left: PLQ.x, top: PLQ.y, width: PLQ.w, height: PLQ.h, transform: 'rotate(-1.5deg)', pointerEvents: 'none' }}>
        <div style={{ ...abs, left: -60, right: -60, top: -10, height: 330, background: 'radial-gradient(ellipse 52% 100% at 50% 0%,rgba(255,226,150,.22),rgba(255,200,90,.07) 60%,transparent 80%)' }} />
        <svg viewBox={`0 0 ${PLQ.w} 120`} width={PLQ.w} height="120" style={{ ...abs, left: 0, top: -92, overflow: 'visible' }} aria-hidden="true">
          <path d={`M${PLQ.w / 2 - 70} 96 L${PLQ.w / 2 - 50} 60 H${PLQ.w / 2 + 50} L${PLQ.w / 2 + 70} 96 Z`} fill="url(#sg-brass-h)" stroke="#000" strokeWidth="4" />
          <path d={`M${PLQ.w / 2 - 10} 60 Q${PLQ.w / 2} 20 ${PLQ.w / 2 + 60} 30`} stroke="#000" strokeWidth="12" fill="none" />
          <path d={`M${PLQ.w / 2 - 10} 60 Q${PLQ.w / 2} 20 ${PLQ.w / 2 + 60} 30`} stroke="#a57a22" strokeWidth="6" fill="none" />
          <rect x={PLQ.w / 2 - 330} y="26" width="660" height="30" rx="14" fill="url(#sg-brass-h)" stroke="#000" strokeWidth="4" />
          <ellipse cx={PLQ.w / 2} cy="56" rx="310" ry="7" fill="#fff6e2" />
        </svg>
      </div>
      <div style={{ ...abs, left: PLQ.x - 70, top: PLQ.y - 96, transform: 'rotate(-17deg)' }}><Art html={GRAF_ART.hat} /></div>
      <div data-fx="tee" className="sg-scrawl sg-red" style={{ left: PLQ.x + PLQ.w - 250, top: PLQ.y - 64, fontSize: 76, transform: 'rotate(9deg)' }}>TEE-HEE!</div>
      <div data-fx="quote" className="sg-quote" style={{ ...abs, left: 0, right: 0, top: 944 }}>“It's on the wheel now. <b>Pray it isn't you.</b>”</div>
      <div className="sg-layer" style={{ background: VIGNETTE }} />
    </Room>
  );
}
