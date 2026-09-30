// JACK-IN-THE-BOX on the TV, ported from the approved mockup (design/mockups/Jack.dc.html). Its own room: the backstage
// of a derelict industrial funfair (torn big-top canvas, conduit, a fuse box, a bulb-ringed mirror, NO REFUNDS stencilled,
// a traffic cone dressed as a clown), with the machine kit on top.
//   live  the battered crank box on a circus drum under one bare bulb. The brass crank turns a full revolution per crank
//         and the box shudders on each clunk; the seven-segment COUNT steps up; LAST +n. Four stations round the drum on a
//         painted path, the current player's lamp amber; the marquee says CRANK IT, NAME.
//         The eyes in the lid gap grow with the COUNT but are full size at 8 and never change again (the pop, 8–20, is
//         secret). They glance at whoever's turn it is; blinks run on a fixed clock.
//   pop   ~2.5s, once: the box rattles, the lid blasts off to the right, the room falls to black but the bulb's pool, a
//         drawn spring-and-Jack shoots up and clips the bulb (it swings), the popper's station goes red with CLOWNED,
//         and a wide POP. lands on the marquee.
// Motion is transform/opacity; reduced motion shows the settled frame.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { f1, glyph, reduced, rnd, segments, stations } from './machineKit';
import { Face, Marquee, MarqueeStrip, type Seat } from '../components/Machine';
import { Sound, cues } from '../fx/sound';

const abs = { position: 'absolute' } as const;
const FULL = { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 } as const;
const PITCH = 14, COLS = 84;
const RIG = (() => { const w = COLS * PITCH + 44; return { l: Math.round(960 - w / 2), r: Math.round(960 + w / 2), top: 26 }; })();
const CRANK_MS = 640;

// ---- drawn once
const BIG = (() => {                                   // POP. with every glyph column drawn three dots wide
  const sx = 3, r = f1(PITCH * .38), pts: number[][] = []; let c = 0;
  [...'POP.'].forEach((ch, k, arr) => { const g = glyph(ch); g.forEach((row, y) => [...row].forEach((bit, x) => { if (bit === '#') for (let j = 0; j < sx; j++) pts.push([(c + x * sx + j + .5) * PITCH, (y + 1.5) * PITCH]); })); c += g[0].length * sx + (k < arr.length - 1 ? 2 : 0); });
  const d = pts.map(([x, y]) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${f1(2 * r)} 0a${r} ${r} 0 1 0 ${f1(-2 * r)} 0`).join('');
  return { d, width: c * PITCH, height: 9 * PITCH, left: Math.floor((COLS - c) / 2) * PITCH };
})();
const RAW = stations(4, { x: 60, y: 790, w: 1800, h: 280 });
const POS = [[330, 640], [700, 790], [1220, 790], [1590, 640]];
const LOOK = POS.map(([x]) => f1(Math.max(-1, Math.min(1, (x - 960) / 630)) * 9));
const LEGS = [
  [[446, 790, 540, 790, 520, 955, 584, 955]],
  [[816, 955, 900, 955, 1010, 955, 1104, 955]],
  [[1336, 955, 1400, 955, 1380, 790, 1474, 790]],
  [[1476, 718, 1380, 742, 1250, 746, 960, 746], [960, 746, 670, 746, 540, 742, 446, 718]],
];
const bz = (c: number[], u: number) => { const w = 1 - u; return [w * w * w * c[0] + 3 * w * w * u * c[2] + 3 * w * u * u * c[4] + u * u * u * c[6], w * w * w * c[1] + 3 * w * w * u * c[3] + 3 * w * u * u * c[5] + u * u * u * c[7]]; };
const PATH = LEGS.map((pieces, i) => {
  const d = pieces.map((c, k) => (k ? '' : `M${c[0]} ${c[1]}`) + `C${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]} ${c[7]}`).join('');
  const c = pieces[pieces.length - 1], u = pieces.length === 2 ? .62 : .5;
  const [mx, my] = bz(c, u), [ax, ay] = bz(c, u + .01), a = Math.atan2(ay - my, ax - mx);
  const P = (x: number, y: number) => `${f1(mx + x * Math.cos(a) - y * Math.sin(a))} ${f1(my + x * Math.sin(a) + y * Math.cos(a))}`;
  return { i, d, chev: `M${P(-10, -14)}L${P(6, 0)}L${P(-10, 14)}` };
});
const BS = .8, BX = 960 - 190 * BS, BY = 760 - 290 * BS;
const RIVETS = [[14, 94], [366, 94], [14, 246], [366, 246]];
const LID_GONE = 'translate(1500px, -60px) rotate(330deg)';
const COILS = (() => {
  const A = [190, 40], C = [226, -40], B = [190, -120], N = 9, out: { back: string; front: string }[] = [];
  for (let k = 0; k < N; k++) {
    const u = (k + .5) / N, w = 1 - u;
    const p = [w * w * A[0] + 2 * w * u * C[0] + u * u * B[0], w * w * A[1] + 2 * w * u * C[1] + u * u * B[1]];
    const tg = [2 * w * (C[0] - A[0]) + 2 * u * (B[0] - C[0]), 2 * w * (C[1] - A[1]) + 2 * u * (B[1] - C[1])];
    const a = Math.atan2(tg[1], tg[0]) + Math.PI / 2, rx = 42, ry = 12, deg = f1(a * 180 / Math.PI);
    const e1 = `${f1(p[0] + rx * Math.cos(a))} ${f1(p[1] + rx * Math.sin(a))}`, e2 = `${f1(p[0] - rx * Math.cos(a))} ${f1(p[1] - rx * Math.sin(a))}`;
    out.push({ back: `M${e1}A${rx} ${ry} ${deg} 0 0 ${e2}`, front: `M${e1}A${rx} ${ry} ${deg} 0 1 ${e2}` });
  }
  return out;
})();
const star = (rx: number, ry: number, rin: number, cy: number, n: number, cx = 0, rot = 0) => Array.from({ length: n * 2 }, (_, k) => { const a = Math.PI * k / n + rot, r = k % 2 ? rin : 1; return `${k ? 'L' : 'M'}${f1(cx + Math.cos(a) * rx * r)} ${f1(cy + Math.sin(a) * ry * r)}`; }).join('') + 'Z';
const RUFF = { outer: star(84, 34, .62, 92, 9), inner: star(62, 24, .6, 88, 8) };
const TEETH = [-34, -23, -12, 10, 21, 32].map((x, k) => ({ x, y: f1(38 + Math.abs(x) * .06), h: 9 + (k * 5) % 4, r: ((k * 7) % 5) - 2 }));
const ENV = (() => {
  const stripes: { d: string; c: string }[] = [];
  for (let k = 0, xb = -440; xb < 2380; xb += 150, k++) { const top = (x: number) => f1(960 + (x - 960) * (1400 / 2030)); stripes.push({ d: `M${top(xb)} 0L${top(xb + 150)} 0L${xb + 150} 630L${xb} 630Z`, c: k % 2 ? '#4a3a1e' : '#2c1733' }); }
  const boards: { d: string; c: string }[] = [];
  for (let k = 0, xb = -1500; xb < 3420; xb += 140, k++) { const at = (x: number) => f1(960 + (x - 960) * .531); boards.push({ d: `M${at(xb)} 630L${at(xb + 140)} 630L${xb + 140} 1080L${xb} 1080Z`, c: ['#1e110f', '#180d0d', '#22140f'][k % 3] }); }
  const scuffs = Array.from({ length: 12 }, (_, i) => ({ x: f1(100 + rnd(i + 5) * 1720), y: f1(660 + rnd(i + 25) * 400), rx: f1(40 + rnd(i + 45) * 120), ry: f1(8 + rnd(i + 65) * 22), o: +(.25 + rnd(i + 85) * .3).toFixed(2) }));
  const bulbs: number[][] = [];
  for (let x = 1224; x <= 1516; x += 48.6) bulbs.push([x, 266]);
  for (let y = 314; y <= 554; y += 48) { bulbs.push([1216, y]); bulbs.push([1524, y]); }
  const dead = [2, 9, 15];
  const cols = ['#8a6a2c', '#7a1a14', '#3e2246', '#8c8270'];
  const string = (a: number[], c: number[], b: number[], n: number, skip: number[], torn: number[]) => {
    const flags: { d: string; c: string }[] = [];
    for (let k = 0; k < n; k++) {
      if (skip.includes(k)) continue;
      const u = (k + .5) / n, w = 1 - u;
      const p = [w * w * a[0] + 2 * w * u * c[0] + u * u * b[0], w * w * a[1] + 2 * w * u * c[1] + u * u * b[1]];
      let tg = [2 * w * (c[0] - a[0]) + 2 * u * (b[0] - c[0]), 2 * w * (c[1] - a[1]) + 2 * u * (b[1] - c[1])];
      const len = Math.hypot(tg[0], tg[1]); tg = [tg[0] / len, tg[1] / len];
      const nrm = [-tg[1], tg[0]], h = torn.includes(k) ? 22 : 44;
      flags.push({ d: `M${f1(p[0] - tg[0] * 17)} ${f1(p[1] - tg[1] * 17)}L${f1(p[0] + tg[0] * 17)} ${f1(p[1] + tg[1] * 17)}L${f1(p[0] + nrm[0] * h)} ${f1(p[1] + nrm[1] * h)}Z`, c: cols[k % 4] });
    }
    return { line: `M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`, flags };
  };
  let lacing = '';
  for (let k = 0; k <= 16; k++) { const th = Math.PI * k / 16, x = f1(960 - 250 * Math.cos(th)), y = f1(k % 2 ? 860 + 32 * Math.sin(th) : 792 + 34 * Math.sin(th)); lacing += (k ? 'L' : 'M') + x + ' ' + y; }
  return {
    stripes, boards, scuffs, lacing, sags: ['M0 96 Q480 150 960 104 T1920 96', 'M0 300 Q300 340 620 300'],
    bulbs: bulbs.map(([x, y], i) => ({ x: f1(x), y, on: !dead.includes(i), flick: i === 5 })),
    bunting: [string([90, 60], [240, 250], [396, 110], 7, [3], [5]), string([1540, 104], [1554, 220], [1600, 330], 4, [], [2])],
    star: star(22, 22, .42, 834, 5, 960, -Math.PI / 2), coneRuff: star(34, 11, .6, -6, 7),
  };
})();
const HANG = [
  { d: 'M-20 150 C 200 280, 400 230, 520 40', w: 9, hi: '#3a3032' }, { d: 'M1940 120 C 1800 260, 1700 200, 1660 60', w: 10, hi: '#3a3032' },
  { d: 'M700 -10 C 760 150, 820 150, 880 -10', w: 6, hi: '#2f2a2c' }, { d: 'M1100 -10 C 1160 170, 1300 160, 1340 -10', w: 7, hi: '#2f2a2c' },
];

export function JackTV({ order, turn, count, last, pop }: {
  order: Seat[]; turn: number; count: number; last: { player: string; n: number } | null;
  pop: null | { popper: string; at: number };
}) {
  const still = reduced();
  const popped = !!pop;
  const popI = pop ? Math.max(0, order.findIndex(p => p.id === pop.popper)) : -1;
  const cur = popped ? popI : ((turn % 4) + 4) % 4;
  const root = useRef<HTMLDivElement>(null);
  const q = (s: string) => [...(root.current?.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`) ?? [])];

  // the count on the box steps up one crank at a time (the server's count arrives all at once)
  const [shown, setShown] = useState(count);
  const [red, setRed] = useState(popped);
  const lastCount = useRef(count);
  useLayoutEffect(() => {
    const from = lastCount.current; lastCount.current = count;
    if (!popped && count > from) Sound.ratchet(Math.min(3, count - from), CRANK_MS / 1000);   // the crank's pawl, click by click
    if (popped || still || count <= from) { setShown(count); return; }
    const d = Math.min(3, count - from), T: number[] = [], A: Animation[] = [];
    const crank = q('crank')[0], body = q('body')[0];
    setShown(from);
    if (crank) A.push(crank.animate([{ transform: `rotate(${32 - d * 360}deg)` }, { transform: 'rotate(32deg)' }], { duration: d * CRANK_MS, easing: `steps(${d * 8}, end)` }));
    for (let i = 1; i <= d; i++) T.push(window.setTimeout(() => {
      setShown(from + i); Sound.clunk();
      if (body) A.push(body.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,3px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 240 }));
    }, i * CRANK_MS - 200));
    return () => { T.forEach(clearTimeout); A.forEach(a => a.cancel()); setShown(count); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // ambient: the bulb's stutter and the dying mirror bulb (always); the eyes' blinks (live only: they're gone after the pop)
  useEffect(() => {
    if (still) return;
    const A: Animation[] = [];
    const loop = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions) => A.push(e.animate(k, { iterations: Infinity, ...o }));
    q('beam').concat(q('halo')).forEach(e => loop(e, [{ opacity: 1 }, { opacity: 1, offset: .9 }, { opacity: .4, offset: .915 }, { opacity: 1, offset: .93 }, { opacity: .7, offset: .95 }, { opacity: 1 }], { duration: 6100, easing: 'steps(1,end)' }));
    q('flick').forEach(e => loop(e, [{ opacity: 1 }, { opacity: .1, offset: .08 }, { opacity: 1, offset: .12 }, { opacity: .15, offset: .5 }, { opacity: .9, offset: .53 }, { opacity: .2, offset: .56 }, { opacity: 1, offset: .6 }, { opacity: 1 }], { duration: 2300, easing: 'steps(1,end)' }));
    if (!popped) q('blink').forEach(e => loop(e, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1)', offset: .9 }, { transform: 'scaleY(.06)', offset: .94 }, { transform: 'scaleY(1)', offset: .98 }, { transform: 'scaleY(1)' }], { duration: 3400 }));
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popped, still]);

  // THE POP: plays once. The render is the end frame; every animation here holds it or runs a short while.
  useLayoutEffect(() => {
    if (!popped) return;
    // sound on the pop's beats: the last crank, the rattle, the lid BLASTS and the spring boings (with the clown horn),
    // Jack clips the bulb, CLOWNED stamps down, POP. buzzes onto the marquee
    const hush = still ? cues([[0, Sound.boing]]) : cues([[150, () => Sound.ratchet(1, CRANK_MS / 1000)], [580, () => Sound.ratchet(1, .32, 7)], [900, Sound.thud], [900, Sound.boing],
      [960, () => Sound.ding()], [1250, Sound.stamp], [1500, Sound.ledOn]]);
    if (still) { setRed(true); return hush; }
    const A: Animation[] = [], T: number[] = [];
    const run = (e: Element | undefined, k: Keyframe[], o: KeyframeAnimationOptions) => { if (e) A.push(e.animate(k, o)); };
    const one = (s: string) => q(s)[0];
    setRed(false);
    // the last crank turns, the box rattles, the lid hops, then BLASTS off to the right and spins away
    run(one('crank'), [{ transform: 'rotate(-328deg)' }, { transform: 'rotate(32deg)' }], { duration: CRANK_MS, delay: 150, easing: 'steps(8, end)', fill: 'backwards' });
    run(one('segWrap'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: 550, fill: 'backwards' });
    run(one('body'), [0, 1, 2, 3, 4, 5, 6].map(i => ({ transform: `translate(${i % 2 ? -6 : 6}px, ${i % 3 - 1}px) rotate(${i % 2 ? -.8 : .8}deg)` })).concat([{ transform: 'none' }]), { duration: 320, delay: 580 });
    run(one('lid'), [
      { transform: 'translate(0px,0px) rotate(0deg)' },
      { transform: 'translate(0px,-8px) rotate(-2deg)', offset: .06 }, { transform: 'translate(0px,0px) rotate(0deg)', offset: .12 },
      { transform: 'translate(0px,-12px) rotate(3deg)', offset: .19 }, { transform: 'translate(0px,0px) rotate(0deg)', offset: .27, easing: 'cubic-bezier(.15,.8,.4,1)' },
      { transform: 'translate(330px,-190px) rotate(8deg)', offset: .45, easing: 'linear' },
      { transform: 'translate(640px,-150px) rotate(22deg)', offset: .62, easing: 'linear' },     // flat while under the marquee
      { transform: 'translate(980px,-80px) rotate(200deg)', offset: .82, easing: 'linear' },    // spins only past its right end
      { transform: LID_GONE },
    ], { duration: 1100, delay: 600, fill: 'backwards' });
    run(one('eyes'), [{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 880, fill: 'backwards' });
    run(one('blackout'), [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 900, fill: 'backwards' });
    run(one('flash'), [{ opacity: .8 }, { opacity: 0 }], { duration: 360, delay: 900, easing: 'ease-out' });
    run(one('shake'), [{ transform: 'translate(0,0)' }, { transform: 'translate(-16px,10px)' }, { transform: 'translate(12px,-8px)' }, { transform: 'translate(-8px,5px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 440, delay: 900 });
    run(one('chip'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: 900, fill: 'backwards' });
    T.push(window.setTimeout(() => setRed(true), 900));
    // the spring and Jack shoot up, overshoot, settle; the head wobbles a while
    const S = (s: number) => `translate(190px,60px) scale(${s}) translate(-190px,-60px)`;
    run(one('spring'), [{ transform: S(.08), easing: 'cubic-bezier(.1,.9,.3,1)' }, { transform: S(1.12), offset: .3 }, { transform: S(.95), offset: .5 }, { transform: S(1.03), offset: .7 }, { transform: S(1) }], { duration: 1150, delay: 900, fill: 'backwards' });
    run(one('jack'), [{ transform: 'translate(0px,470px)', easing: 'cubic-bezier(.1,.9,.3,1)' }, { transform: 'translate(0px,-22px)', offset: .3 }, { transform: 'translate(0px,9px)', offset: .5 }, { transform: 'translate(0px,-5px)', offset: .7 }, { transform: 'translate(0px,0px)' }], { duration: 1150, delay: 900, fill: 'backwards' });
    run(one('head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0deg)' }], { duration: 3400, delay: 1600, easing: 'ease-in-out' });
    // Jack clips the bulb: a decaying swing that settles into a slow sway
    q('lampRig').concat(q('light')).forEach(e => {
      run(e, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(15deg)', offset: .12 }, { transform: 'rotate(-10deg)', offset: .32 }, { transform: 'rotate(8deg)', offset: .52 }, { transform: 'rotate(-5deg)', offset: .74 }, { transform: 'rotate(-8deg)' }], { duration: 2600, delay: 960, easing: 'ease-in-out', fill: 'backwards' });
      run(e, [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }], { duration: 2200, delay: 3560, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    });
    q('stamp').forEach(e => run(e, [{ transform: 'rotate(-11deg) scale(2.4)', opacity: 0 }, { transform: 'rotate(-11deg) scale(.92)', opacity: 1, offset: .7 }, { transform: 'rotate(-11deg) scale(1)', opacity: 1 }], { duration: 420, delay: 1250, fill: 'backwards', easing: 'ease-in' }));
    // "POP." lands on the marquee (the old line holds until then), then blinks a few times and stays lit
    run(one('mqOld'), [{ opacity: 1 }, { opacity: 1 }], { duration: 1500, fill: 'backwards' });
    run(one('mqPop'), [{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(.94)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, delay: 1500, easing: 'ease-in', fill: 'backwards' });
    run(one('mqPop'), [{ opacity: 1 }, { opacity: 1, offset: .7 }, { opacity: .15, offset: .71 }, { opacity: .15 }], { duration: 900, delay: 2100, iterations: 4 });
    return () => { A.forEach(a => a.cancel()); T.forEach(clearTimeout); hush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popped]);

  // J2: THE EYE CAP. Everything that grows follows t = min(count, 8) / 8: full at 8, flat from 8 to 20.
  const t = Math.min(shown, 8) / 8;
  const L = f1(10 + 40 * t), eyeS = f1(.62 + .86 * t), eyeO = +(.25 + .75 * t).toFixed(2), gapGlow = +(.04 + .1 * t).toFixed(3), eyeY = f1(50 - L / 2);
  const shownNum = popped ? pop!.at : shown;
  const seg = segments(shownNum < 10 ? ' ' + shownNum : String(shownNum), { h: 76 });
  const preSeg = popped ? segments(pop!.at - 1 < 10 ? ' ' + (pop!.at - 1) : String(pop!.at - 1), { h: 76 }) : null;
  const segBox = { w: Math.round(seg.width + 36), x: 40 };
  const lastN = !popped && last ? last.n : 0;
  const prevLeg = (cur + 3) % 4;
  const nm = (i: number) => (order[i]?.name ?? '?').toUpperCase();
  const chip = lastN ? { lab: 'LAST', val: '+' + lastN, col: '#ffb866', bar: '#ffae3a' } : { lab: 'LAST', val: '-', col: '#5a5246', bar: '#2a2420' };
  const byName = popped ? nm(popI).slice(0, 7) : '';

  return (
    <div ref={root} className="mgx mk-motion" style={{ ...FULL, overflow: 'hidden', isolation: 'isolate', background: '#040404', color: '#f1e8d4', fontFamily: "'Courier Prime', monospace" }}>
      <div data-fx="shake" style={{ ...abs, inset: 0 }}>
        {/* THE BACKSTAGE: flat fills and few values; the grime is the baked dither tile over everything */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <defs>
            <linearGradient id="jk-canvas-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".85" /><stop offset=".45" stopColor="#000" stopOpacity=".3" /><stop offset=".9" stopColor="#000" stopOpacity=".45" /><stop offset="1" stopColor="#000" stopOpacity=".75" /></linearGradient>
            <linearGradient id="jk-fold" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat"><stop offset="0" stopColor="#1e0406" /><stop offset=".4" stopColor="#561218" /><stop offset=".55" stopColor="#6a1a22" /><stop offset="1" stopColor="#1e0406" /></linearGradient>
            <linearGradient id="jk-drum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#240706" /><stop offset=".45" stopColor="#8a2618" /><stop offset=".6" stopColor="#8a2618" /><stop offset="1" stopColor="#240706" /></linearGradient>
            <linearGradient id="jk-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#26222a" /><stop offset=".5" stopColor="#101013" /><stop offset="1" stopColor="#1a171d" /></linearGradient>
            <linearGradient id="jk-rust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4038" /><stop offset="1" stopColor="#231c18" /></linearGradient>
            <radialGradient id="jk-bulbglow"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".9" /><stop offset=".3" stopColor="#ffc860" stopOpacity=".3" /><stop offset="1" stopColor="#ffb040" stopOpacity="0" /></radialGradient>
            <radialGradient id="jk-warm"><stop offset="0" stopColor="#ffcf7a" stopOpacity=".2" /><stop offset="1" stopColor="#ffcf7a" stopOpacity="0" /></radialGradient>
            <pattern id="jk-haz2" width="40" height="40" patternUnits="userSpaceOnUse"><image href="/textures/hazard.png" width="40" height="40" /></pattern>
          </defs>
          <rect width="1920" height="1080" fill="#0a0609" />
          {ENV.stripes.map((s, i) => <path key={i} d={s.d} fill={s.c} />)}
          {ENV.sags.map((d, i) => <path key={i} d={d} fill="none" stroke="#000" strokeWidth="18" opacity=".25" strokeLinecap="round" />)}
          <ellipse cx="1380" cy="170" rx="140" ry="60" fill="#140a0e" opacity=".5" /><ellipse cx="700" cy="120" rx="80" ry="150" fill="#140a0e" opacity=".45" />
          <path d="M1586 150 L1630 128 L1664 160 L1650 214 L1676 246 L1618 262 L1594 222 L1570 196Z" fill="#030102" />
          <path d="M1586 150 L1630 128 L1664 160 L1644 158 L1616 146Z" fill="#8a6a2c" opacity=".7" />
          <rect x="1540" y="182" width="170" height="30" fill="url(#jk-haz2)" stroke="#000" strokeWidth="2" transform="rotate(32 1625 197)" />
          <rect x="1540" y="182" width="170" height="30" fill="url(#jk-haz2)" stroke="#000" strokeWidth="2" transform="rotate(-28 1625 197)" />
          <rect width="1920" height="630" fill="url(#jk-canvas-shade)" />
          <g fill="none" strokeLinecap="round">
            {HANG.map((c, i) => <g key={i}><path d={c.d} stroke="#000" strokeWidth={c.w + 4} /><path d={c.d} stroke="#1a1618" strokeWidth={c.w} /><path d={c.d} stroke={c.hi} strokeWidth="2" opacity=".5" transform="translate(0 -2)" /></g>)}
          </g>
          <path d="M650 -10 V330" stroke="#000" strokeWidth="22" /><path d="M650 -10 V330" stroke="#3a3430" strokeWidth="14" /><path d="M646 -10 V330" stroke="#6a5e54" strokeWidth="3" opacity=".6" />
          <rect x="640" y="90" width="20" height="14" fill="#5a4a3e" stroke="#000" strokeWidth="3" /><rect x="640" y="220" width="20" height="14" fill="#5a4a3e" stroke="#000" strokeWidth="3" />
          <g fill="#d8cdb4" opacity=".3" style={{ fontFamily: "'Big Shoulders Stencil Display', Impact, sans-serif", fontWeight: 900, letterSpacing: '.08em' }}>
            <text x="128" y="410" style={{ fontSize: 132 }}>NO</text><text x="128" y="548" style={{ fontSize: 132 }}>REFUNDS</text>
          </g>
          <path d="M152 412 v24 M232 412 v36 M150 550 v30 M300 550 v18 M436 551 v34 M520 550 v22" stroke="#d8cdb4" strokeWidth="5" opacity=".24" strokeLinecap="round" />
          <rect x="590" y="330" width="120" height="150" rx="4" fill="url(#jk-rust)" stroke="#000" strokeWidth="5" />
          <rect x="598" y="340" width="104" height="22" fill="url(#jk-haz2)" />
          <path d="M600 470 l16 -8 l10 6 M690 380 l6 30 l-8 14" stroke="#6a3a1c" strokeWidth="5" opacity=".7" fill="none" />
          <rect x="636" y="386" width="28" height="60" rx="3" fill="#120e0c" stroke="#000" strokeWidth="3" />
          <path d="M650 430 L684 398" stroke="#000" strokeWidth="12" strokeLinecap="round" /><path d="M650 430 L684 398" stroke="#9aa3a7" strokeWidth="6" strokeLinecap="round" />
          <circle cx="686" cy="396" r="9" fill="#b8201a" stroke="#000" strokeWidth="3" />
          <path d="M650 480 C650 560 700 600 760 640 S 820 720 800 760" stroke="#000" strokeWidth="16" fill="none" strokeLinecap="round" />
          <path d="M650 480 C650 560 700 600 760 640 S 820 720 800 760" stroke="#1c1618" strokeWidth="10" fill="none" strokeLinecap="round" />
          <ellipse cx="1370" cy="410" rx="280" ry="220" fill="url(#jk-warm)" />
          <rect x="1200" y="250" width="340" height="316" rx="8" fill="#2c1a14" stroke="#000" strokeWidth="6" />
          <rect x="1232" y="282" width="276" height="252" fill="url(#jk-glass)" stroke="#000" strokeWidth="5" />
          <path d="M1250 520 L1350 300 M1280 530 L1390 296" stroke="#fff" strokeWidth="10" opacity=".05" />
          <path d="M1470 290 L1446 348 L1466 370 L1434 434 M1446 348 L1414 338" stroke="#cfc6d8" strokeWidth="2" opacity=".35" fill="none" />
          <path d="M1364 534 L1364 470 C1334 470 1324 430 1334 400 C1344 370 1390 366 1404 396 C1418 426 1406 470 1376 470 L1376 534Z" fill="#050407" opacity=".9" />
          <path d="M1336 410 C1300 404 1304 370 1326 372 C1318 350 1344 340 1352 360 M1402 410 C1438 404 1434 370 1412 372 C1420 350 1394 340 1386 360" fill="#4a160e" opacity=".75" />
          {ENV.bulbs.map((u, i) => <g key={i} data-fx={u.flick ? 'flick' : undefined}>
            <circle cx={u.x} cy={u.y} r="26" fill="url(#jk-bulbglow)" opacity={u.on ? .6 : 0} />
            <circle cx={u.x} cy={u.y} r="11" fill={u.on ? '#fff1c8' : '#35302c'} stroke="#000" strokeWidth="3" />
          </g>)}
          <path d="M1690 -10 H1930 V1010 L1900 990 L1880 1020 L1850 986 L1820 1012 L1790 978 L1762 1004 L1730 968 L1712 990 L1704 700 C1680 500 1712 250 1690 -10Z" fill="url(#jk-fold)" stroke="#000" strokeWidth="5" />
          <path d="M1706 560 C1770 600 1860 590 1930 560" stroke="#7a6230" strokeWidth="12" fill="none" />
          <path d="M-10 -10 H86 C70 300 102 600 78 1030 L50 1000 L24 1030 L-10 1010Z" fill="url(#jk-fold)" stroke="#000" strokeWidth="5" />
          {ENV.bunting.map((b, i) => <g key={i}><path d={b.line} stroke="#0b0708" strokeWidth="4" fill="none" />{b.flags.map((f, j) => <path key={j} d={f.d} fill={f.c} stroke="#000" strokeWidth="3" strokeLinejoin="round" />)}</g>)}
          {ENV.boards.map((b, i) => <path key={i} d={b.d} fill={b.c} stroke="#070304" strokeWidth="3" />)}
          <rect x="0" y="612" width="1920" height="22" fill="#070405" />
          <ellipse cx="960" cy="850" rx="760" ry="220" fill="url(#jk-warm)" />
          {ENV.scuffs.map((c, i) => <ellipse key={i} cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill="#070304" opacity={c.o} />)}
          <g transform="translate(1348 612)">
            <ellipse cx="0" cy="120" rx="66" ry="12" fill="#000" opacity=".6" />
            <path d="M-58 112 H58 V124 H-58Z" fill="#b8531a" stroke="#000" strokeWidth="4" />
            <path d="M-12 -20 L12 -20 L44 112 L-44 112Z" fill="#d86a22" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
            <path d="M-20 20 L20 20 L26 44 L-26 44Z M-32 70 L32 70 L37 90 L-37 90Z" fill="#d8cdb4" opacity=".85" />
            <path d={ENV.coneRuff} fill="#e6dcc4" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="0" cy="-26" r="11" fill="#b82a18" stroke="#000" strokeWidth="3" /><circle cx="-3" cy="-29" r="3.5" fill="#ff9a80" />
          </g>
        </svg>

        {/* J3: THE PATH painted on the boards, 0 -> 1 -> 2 -> 3 and back round behind the drum; the last move's leg in amber */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <g fill="none" strokeLinecap="butt">
            {PATH.map(p => { const hot = !!lastN && p.i === prevLeg; return <g key={p.i}>
              <path d={p.d} stroke="#000" strokeWidth="15" strokeDasharray="24 16" opacity=".45" transform="translate(2 4)" />
              <g stroke={hot ? '#ffae3a' : '#e6dcc4'} opacity={hot ? .95 : .42}>
                <path d={p.d} strokeWidth="10" strokeDasharray="24 16" /><path d={p.chev} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>; })}
          </g>
        </svg>

        {/* the circus drum the box stands on */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <ellipse cx="960" cy="908" rx="300" ry="36" fill="#000" opacity=".55" />
          <path d="M710 772 V876 A250 32 0 0 0 1210 876 V772Z" fill="url(#jk-drum)" stroke="#000" strokeWidth="6" />
          <path d={ENV.lacing} stroke="#bfb49c" strokeWidth="4" fill="none" opacity=".75" />
          <path d="M710 772 A250 34 0 0 0 1210 772 V792 A250 34 0 0 1 710 792Z" fill="#8a6a2c" stroke="#000" strokeWidth="4" />
          <path d="M710 860 A250 32 0 0 0 1210 860 V876 A250 32 0 0 1 710 876Z" fill="#8a6a2c" stroke="#000" strokeWidth="4" />
          <path d="M760 800 l18 6 l-4 10 l-16 -4Z M1120 806 l22 -4 l2 12 l-20 4Z M880 868 l30 2 l-2 10 l-28 -2Z" fill="#3a2410" />
          <circle cx="960" cy="834" r="30" fill="#2e1a33" stroke="#000" strokeWidth="4" />
          <path d={ENV.star} fill="#c9a03a" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="960" cy="772" rx="250" ry="34" fill="#b9ab8a" stroke="#000" strokeWidth="6" />
          <ellipse cx="960" cy="772" rx="212" ry="24" fill="#a49474" opacity=".6" />
        </svg>

        {/* J1 / J2 / J4: THE CRANK BOX (box-local coords; the front face is 380 × 240) */}
        <svg viewBox="0 0 1920 1080" style={{ ...FULL, overflow: 'visible', zIndex: 4 }} aria-hidden="true">
          <defs>
            <linearGradient id="jk-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a2419" /><stop offset=".5" stopColor="#4a170f" /><stop offset="1" stopColor="#2a0b07" /></linearGradient>
            <linearGradient id="jk-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#262c30" /><stop offset="1" stopColor="#4a5358" /></linearGradient>
            <linearGradient id="jk-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe19a" /><stop offset=".45" stopColor="#c8922f" /><stop offset="1" stopColor="#5a3a0e" /></linearGradient>
            <radialGradient id="jk-glow"><stop offset="0" stopColor="#8dff9a" stopOpacity=".55" /><stop offset=".5" stopColor="#8dff9a" stopOpacity=".16" /><stop offset="1" stopColor="#8dff9a" stopOpacity="0" /></radialGradient>
            <pattern id="jk-haz" width="40" height="40" patternUnits="userSpaceOnUse"><image href="/textures/hazard.png" width="40" height="40" /></pattern>
          </defs>
          <g transform={`translate(${BX} ${BY}) scale(${BS})`}>
            <ellipse cx="190" cy="294" rx="236" ry="26" fill="#000" opacity=".6" />
            <g data-fx="body">
              {/* the lid gap with the eyes in it; the lid's lift reveals it */}
              <rect x="10" y="-2" width="360" height="54" fill="#030202" />
              <rect className="jk-tr" x="10" y="-2" width="360" height="54" fill="#8dff9a" style={{ opacity: popped ? 0 : gapGlow }} />
              <g data-fx="eyes" className="jk-tr" style={{ transform: `translate(190px, ${eyeY}px) scale(${eyeS})`, opacity: popped ? 0 : 1 }}>
                <g className="jk-tr" style={{ transform: `scaleY(${eyeO})` }}>
                  <ellipse cx="0" cy="0" rx="120" ry="44" fill="url(#jk-glow)" />
                  {[-48, 48].map(ex => <g key={ex} transform={`translate(${ex} 0)`}>
                    <g data-fx="blink">
                      <path d="M-26 0 Q0 -19 26 0 Q0 19 -26 0Z" fill="#8dff9a" />
                      <g className="jk-tr" style={{ transform: `translateX(${LOOK[cur] ?? 0}px)` }}>
                        <ellipse cx="0" cy="0" rx="12" ry="9" fill="#eaffec" opacity=".85" />
                        <ellipse cx="0" cy="0" rx="4" ry="15" fill="#021006" />
                      </g>
                    </g>
                  </g>)}
                </g>
              </g>

              {/* POP: the open box, the spring, the Jack (behind the front face, so he rises out of it) */}
              {popped && <>
                <path d="M0 50 L380 50 L355 0 L25 0Z" fill="#070303" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
                <path d="M25 0 L355 0 L342 16 L38 16Z" fill="#241009" />
                <g data-fx="spring" fill="none" strokeLinecap="round">
                  {COILS.map((c, i) => <g key={i}><path d={c.back} stroke="#000" strokeWidth="12" /><path d={c.back} stroke="#3a4146" strokeWidth="6" /></g>)}
                  {COILS.map((c, i) => <g key={i}><path d={c.front} stroke="#000" strokeWidth="13" /><path d={c.front} stroke="#c9d0d3" strokeWidth="7" /><path d={c.front} stroke="#ffffff" strokeWidth="2" opacity=".7" transform="translate(0 -2)" /></g>)}
                </g>
                <g data-fx="jack">
                  <g transform="translate(190 -186) rotate(-12) scale(1.3)">
                    <g data-fx="head" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                      <path d={RUFF.outer} fill="#a3261a" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
                      <path d={RUFF.inner} fill="#e6dcc4" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                      <path d="M-60 -44 C-104 -58 -118 -12 -94 -2 C-120 12 -104 46 -64 32 C-72 10 -70 -20 -60 -44Z" fill="#9c3520" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
                      <path d="M60 -44 C104 -58 118 -12 94 -2 C120 12 104 46 64 32 C72 10 70 -20 60 -44Z" fill="#9c3520" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
                      <path d="M0 -80 C50 -80 78 -40 76 6 C74 52 42 84 0 84 C-42 84 -74 52 -76 6 C-78 -40 -50 -80 0 -80Z" fill="#ece2cc" stroke="#000" strokeWidth="6" />
                      <path d="M40 -64 C82 -24 78 48 28 80 C58 40 62 -12 40 -64Z" fill="#b9a988" opacity=".8" />
                      <path d="M-8 -80 L-14 -62 L-5 -52 L-12 -34 M-12 -62 L-22 -58" stroke="#4a3b2c" strokeWidth="2.5" fill="none" />
                      <path d="M-28 -48 L-20 -14 L-28 20 L-36 -14Z M28 -48 L36 -14 L28 20 L20 -14Z" fill="#161010" />
                      <path d="M-48 -42 Q-30 -66 -10 -46 M48 -42 Q30 -66 10 -46" stroke="#161010" strokeWidth="5" fill="none" strokeLinecap="round" />
                      <ellipse cx="-28" cy="-14" rx="19" ry="15" fill="#120806" /><ellipse cx="28" cy="-14" rx="19" ry="15" fill="#120806" />
                      <ellipse cx="-28" cy="-14" rx="28" ry="20" fill="url(#jk-glow)" /><ellipse cx="28" cy="-14" rx="28" ry="20" fill="url(#jk-glow)" />
                      <path d="M-40 -14 Q-28 -23 -16 -14 Q-28 -5 -40 -14Z M16 -14 Q28 -23 40 -14 Q28 -5 16 -14Z" fill="#8dff9a" />
                      <path d="M-28 -21 V-7 M28 -21 V-7" stroke="#021006" strokeWidth="4" />
                      <circle cx="-50" cy="26" r="12" fill="#c0584a" opacity=".55" /><circle cx="50" cy="26" r="12" fill="#c0584a" opacity=".55" />
                      <path d="M-54 30 C-40 36 -20 40 0 40 C20 40 40 36 54 30 C44 60 24 74 0 74 C-24 74 -44 60 -54 30Z" fill="#6e120c" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                      <path d="M-44 37 C-20 45 20 45 44 37 C34 56 18 64 0 64 C-18 64 -34 56 -44 37Z" fill="#1a0403" />
                      {TEETH.map((t, i) => <rect key={i} x={t.x} y={t.y} width="9" height={t.h} rx="1.5" fill="#e9e0c8" stroke="#000" strokeWidth="1.5" transform={`rotate(${t.r} ${t.x + 4} ${t.y})`} />)}
                      <path d="M-54 30 L-70 12 M-65 26 L-58 17 M-70 19 L-63 11 M54 30 L70 12 M65 26 L58 17 M70 19 L63 11" stroke="#1b0f0c" strokeWidth="3" fill="none" strokeLinecap="round" />
                      <circle cx="0" cy="14" r="12" fill="#b82a18" stroke="#000" strokeWidth="3" /><circle cx="-4" cy="10" r="4" fill="#ff9a80" />
                      <path d="M-50 -60 L8 -80 L-38 -126Z" fill="url(#jk-haz)" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
                      <circle cx="-38" cy="-128" r="10" fill="#e6dcc4" stroke="#000" strokeWidth="4" />
                    </g>
                  </g>
                </g>
              </>}

              {/* THE FRONT FACE: battered oxblood steel, hazard bands, the stencil, the COUNT */}
              <rect x="0" y="50" width="380" height="240" rx="4" fill="url(#jk-paint)" stroke="#000" strokeWidth="6" />
              <rect x="6" y="56" width="368" height="24" fill="url(#jk-haz)" /><rect x="6" y="260" width="368" height="24" fill="url(#jk-haz)" />
              <path d="M6 80 H374 M6 260 H374" stroke="#000" strokeWidth="4" />
              <ellipse cx="318" cy="118" rx="30" ry="12" fill="#1a0604" opacity=".45" transform="rotate(-18 318 118)" />
              <path d="M292 110 Q318 100 342 112" stroke="#b5553f" strokeWidth="3" fill="none" opacity=".5" />
              <ellipse cx="54" cy="236" rx="22" ry="9" fill="#1a0604" opacity=".45" />
              <path d="M210 236 L262 226 M226 244 L300 232 M20 150 L44 128" stroke="#e0a58e" strokeWidth="2" opacity=".35" />
              <path d="M342 262 l14 -4 l6 10 l-12 8Z M40 260 l18 6 l-6 12 l-14 -4Z" fill="#2a0b07" />
              <path d="M-3 60 V100 M-3 60 H40 M383 60 V100 M383 60 H340 M-3 280 V240 M-3 280 H40 M383 280 V240 M383 280 H340" stroke="#4a5358" strokeWidth="10" fill="none" />
              {RIVETS.map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="5" fill="#9aa3a7" stroke="#000" strokeWidth="2.5" />)}
              <text x="190" y="123" textAnchor="middle" fill="#e6dcc4" opacity=".92" style={{ fontFamily: "'Big Shoulders Stencil Display', Impact, sans-serif", fontWeight: 900, fontSize: 44, letterSpacing: '.03em' }}>JACK-IN-THE-BOX</text>
              <rect x="22" y="138" width={segBox.w} height="110" rx="6" fill="#2a3034" stroke="#000" strokeWidth="4" />
              <rect x="30" y="146" width={segBox.w - 16} height="94" rx="4" fill="#0b0101" />
              <path d={`M30 150 H${segBox.w + 14}`} stroke="#000" strokeWidth="8" opacity=".8" />
              <g transform={`translate(${segBox.x} 156)`} style={{ '--mk-on': '#ff2b1a', '--mk-ghost': 'rgba(255,43,26,.11)' } as CSSProperties}>
                {preSeg && <g><path className="mk-seg-ghost" d={preSeg.ghost} /><path className="mk-seg-glow" d={preSeg.lit} /><path className="mk-seg-lit" d={preSeg.lit} /></g>}
                <g data-fx="segWrap" style={{ opacity: 1 }}>
                  {preSeg && <rect x="-4" y="-6" width={seg.width + 8} height="88" fill="#0b0101" />}
                  <path className="mk-seg-ghost" d={seg.ghost} /><path className="mk-seg-glow" d={seg.lit} /><path className="mk-seg-lit" d={seg.lit} />
                </g>
              </g>
              <text x={segBox.w + 34} y="174" fill="#f1e8d4" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 900, fontSize: 44, letterSpacing: '.03em' }}>{popped ? 'POPPED' : 'CRANKS'}</text>
              <rect x={segBox.w + 30} y="186" width={352 - segBox.w} height="62" rx="5" fill="#0b0707" stroke="#000" strokeWidth="4" />
              <rect x={segBox.w + 36} y="240" width={340 - segBox.w} height="4" rx="2" fill={chip.bar} />
              <text x={segBox.w + 40} y="232" fill="#8f8674" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 800, fontSize: 40 }}>{chip.lab}</text>
              <text x="372" y="234" textAnchor="end" fill={chip.col} style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 900, fontSize: 52 }}>{chip.val}</text>
              {popped && <g data-fx="chip">
                <rect x={segBox.w + 32} y="188" width={348 - segBox.w} height="58" rx="4" fill="#0b0707" />
                <rect x={segBox.w + 36} y="240" width={340 - segBox.w} height="4" rx="2" fill="#ff2b1a" />
                <text x={segBox.w + 40} y="232" fill="#8f8674" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 800, fontSize: 40 }}>BY</text>
                <text x="372" y="234" textAnchor="end" fill="#ff5a44" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 900, fontSize: byName.length > 5 ? 40 : 52 }}>{byName}</text>
              </g>}

              {/* THE CRANK: a brass hub on the right side; the arm turns once per crank */}
              <g transform="translate(386 170)">
                <rect x="-6" y="-30" width="18" height="60" rx="3" fill="#23292c" stroke="#000" strokeWidth="3" />
                <g data-fx="crank" style={{ transform: 'rotate(32deg)', transformBox: 'fill-box', transformOrigin: '37.5% 80.3%' }}>
                  <path d="M12 0 L12 -84" stroke="#000" strokeWidth="22" strokeLinecap="round" />
                  <path d="M12 0 L12 -84" stroke="url(#jk-brass)" strokeWidth="14" strokeLinecap="round" />
                  <path d="M8 -8 L8 -78" stroke="#fff0c0" strokeWidth="3" opacity=".6" />
                  <g transform="translate(12 -84)">
                    <rect x="-4" y="-14" width="44" height="28" rx="12" fill="#5a1c10" stroke="#000" strokeWidth="4" />
                    <path d="M4 -7 H32" stroke="#c46a4a" strokeWidth="4" strokeLinecap="round" opacity=".7" />
                  </g>
                  <circle cx="12" cy="0" r="24" fill="url(#jk-brass)" stroke="#000" strokeWidth="4" />
                  <circle cx="12" cy="0" r="8" fill="#3a2608" stroke="#000" strokeWidth="2" />
                </g>
              </g>

              {/* THE LID: lifted by L while live; blown off after the pop */}
              <g data-fx="lift" className="jk-tr" style={{ transform: `translateY(${-L}px)` }}>
                <g data-fx="lid" className="jk-fb" style={{ transform: popped ? LID_GONE : 'none' }}>
                  <path d="M-12 30 L392 30 L364 -20 L16 -20Z" fill="url(#jk-steel)" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
                  <path d="M40 -12 L340 -12" stroke="#6a767b" strokeWidth="3" opacity=".6" />
                  <ellipse cx="96" cy="6" rx="34" ry="8" fill="#0d1012" opacity=".45" />
                  <text x="190" y="20" textAnchor="middle" fill="#e8c53a" opacity=".75" style={{ fontFamily: "'Big Shoulders Stencil Display', Impact, sans-serif", fontWeight: 900, fontSize: 32, letterSpacing: '.12em' }}>NO PEEKING</text>
                  <rect x="-12" y="30" width="404" height="20" fill="#5a1c14" stroke="#000" strokeWidth="5" />
                  <path d="M-6 36 H386" stroke="#c46a4a" strokeWidth="2" opacity=".5" />
                </g>
              </g>
            </g>
          </g>
        </svg>

        {/* THE LIGHT: one bare bulb under the marquee; the cone and the drum's pool swing with it */}
        <div data-fx="light" style={{ ...abs, inset: 0, zIndex: 4, transformOrigin: '960px 190px', pointerEvents: 'none', transform: `rotate(${popped ? -8 : 0}deg)` }}>
          <div data-fx="beam" style={{ ...abs, inset: 0, clipPath: 'polygon(930px 300px, 990px 300px, 1440px 1080px, 480px 1080px)', background: 'linear-gradient(180deg, rgba(255,230,160,.2) 300px, rgba(255,210,120,.08) 640px, rgba(255,190,100,.03) 1000px)' }} />
          <div style={{ ...abs, left: 700, top: 700, width: 520, height: 150, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(255,226,150,.2), transparent)' }} />
        </div>
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 62% 66% at 50% 58%, transparent 48%, rgba(0,0,0,.42) 80%, rgba(0,0,0,.8)), linear-gradient(90deg, rgba(0,0,0,.35), transparent 10%, transparent 90%, rgba(0,0,0,.35))' }} />

        {/* THE RIG AND THE MARQUEE */}
        <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
          <g stroke="#000" strokeWidth="3" fill="#2a3034"><rect x={RIG.l + 60} y="-10" width="16" height={RIG.top + 14} /><rect x={RIG.r - 76} y="-10" width="16" height={RIG.top + 14} /></g>
        </svg>
        <div style={{ ...abs, left: RIG.l, top: RIG.top, zIndex: 5 }}>
          {popped
            ? <div className="mk-marquee" style={{ '--mk-pitch': PITCH + 'px' } as CSSProperties}>
                <div className="mk-marquee-screen" style={{ width: COLS * PITCH, height: 9 * PITCH }}>
                  {!still && <MarqueeStrip text={`CRANK IT, ${nm(popI)}.`} cols={COLS} fx="mqOld" style={{ opacity: 0 }} />}
                  <svg data-fx="mqPop" className="mk-marquee-strip" width={BIG.width} height={BIG.height} viewBox={`0 0 ${BIG.width} ${BIG.height}`} style={{ left: BIG.left }} aria-label="POP.">
                    <path className="mk-dot-halo" d={BIG.d} /><path className="mk-dot" d={BIG.d} />
                  </svg>
                </div>
              </div>
            : <Marquee text={`CRANK IT, ${nm(cur)}.`} cols={COLS} scroll={!still} step={.07} />}
        </div>
        <div style={{ ...abs, left: RIG.l - 60, top: RIG.top + 150, width: RIG.r - RIG.l + 120, height: 120, pointerEvents: 'none', background: `radial-gradient(ellipse 50% 60% at 50% 0%, rgba(255,43,26,${popped ? .3 : .16}), transparent 70%)` }} />

        {/* the bare bulb on its flex (Jack knocks it; it swings) */}
        <div data-fx="lampRig" style={{ ...abs, zIndex: 4, left: 860, top: 188, width: 200, height: 160, transformOrigin: '100px 0', pointerEvents: 'none', transform: `rotate(${popped ? -8 : 0}deg)` }}>
          <svg viewBox="0 0 200 160" style={{ ...abs, inset: 0, width: 200, height: 160, overflow: 'visible' }} aria-hidden="true">
            <circle data-fx="halo" cx="100" cy="78" r="96" fill="url(#jk-bulbglow)" />
            <path d="M100 0 V34" stroke="#000" strokeWidth="7" /><path d="M100 0 V34" stroke="#3a2a2a" strokeWidth="3" />
            <rect x="88" y="30" width="24" height="24" rx="3" fill="#2a1e1a" stroke="#000" strokeWidth="3" />
            <path d="M90 36 H110 M90 43 H110" stroke="#6a5048" strokeWidth="2" />
            <path d="M92 54 C92 60 76 66 76 80 C76 94 88 102 100 102 C112 102 124 94 124 80 C124 66 108 60 108 54Z" fill="#fff4d0" stroke="#000" strokeWidth="3" />
            <path d="M92 80 L96 68 L100 80 L104 68 L108 80" stroke="#ff9a2a" strokeWidth="3" fill="none" />
            <path d="M84 74 C84 66 90 62 94 60" stroke="#fff" strokeWidth="3" fill="none" opacity=".8" />
          </svg>
        </div>

        {/* THE BLACKOUT at the pop: everything but the bulb's pool falls to black (the popper and the marquee sit above it) */}
        <div data-fx="blackout" style={{ ...abs, inset: 0, zIndex: 3, pointerEvents: 'none', opacity: popped ? 1 : 0, background: 'radial-gradient(ellipse 360px 420px at 960px 500px, transparent 50%, rgba(0,0,0,.72) 82%, rgba(0,0,0,.9))' }} />

        {/* THE STATIONS: four, round the box, in turn order */}
        {RAW.map((s, i) => {
          const p = order[i]; if (!p) return null;
          const [cx, y] = POS[i];
          const on = i === cur;
          const cls = popped ? (on && red ? 'is-red' : on ? 'is-amber' : '') : on ? 'is-amber' : '';
          return (
            <div key={p.id} className={'mk-station ' + cls} style={{ left: Math.round(cx - s.w / 2), top: y, width: s.w, height: s.h, zIndex: popped && on ? 5 : 2 }}>
              <div className={'mk-station-glow' + (on && !popped ? ' mk-pulse' : '')} />
              <div className="mk-polaroid" style={{ left: s.photoX, top: s.photoY, width: s.photo, transform: `rotate(${s.tilt}deg)` }}>
                <div className="mk-photo"><Face p={p} size={s.photo * .4} /></div>
              </div>
              {popped && on && <div data-fx="stamp" className="jk-stamp">CLOWNED</div>}
              <div className="mk-nameplate" style={{ top: s.nameY }}><span className="mk-lamp" /><span className="mk-name">{p.name.toUpperCase()}</span></div>
            </div>
          );
        })}

        <div className="mk-grit" style={{ opacity: .2, zIndex: 4 }} />
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 4, background: "url('/textures/grain.png') 0 0 / 256px 256px", opacity: .05 }} />
      </div>
      <div data-fx="flash" style={{ ...abs, inset: 0, zIndex: 6, pointerEvents: 'none', background: '#fff6e2', opacity: 0 }} />
    </div>
  );
}
