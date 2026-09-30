// PENNY DROP on the TV (the Scrooge's ability), ported from the approved mockup (design/mockups/Penny.dc.html): the machine
// set in the Scrooge's colours (gold marquee, IM Fell kicker and quote, his top hat on the coin, marker scrawls, riveted plaques).
//   live    "CALL IT, PEASANTS." scrolls in gold; his brass counting-house press spins the coin in its clamp; the console
//           shows the seconds left and CALLED x/n. The stations stay DARK: the TV knows how many have called, never who or what.
//   result  once (~3.2s), then it holds: the jaws drop open, the coin falls into the tray and wobbles flat, HEADS!/TAILS! slams
//           in with his quote, and station by station the plates light green CALLED IT / red DRINKS, each call on a brass tag.
// Motion is transform/opacity; reduced motion shows the settled frame.
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { f1, reduced, rnd, segments, stations } from './machineKit';
import { Face, Marquee, type Seat } from '../components/Machine';
import { Sound, cues } from '../fx/sound';

const abs = { position: 'absolute' } as const;
const FULL = { position: 'absolute', left: 0, top: 0, width: 1920, height: 1080 } as const;
const PITCH = 9, COLS = 100;
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen'];
const WIN = { c: '#7fe03a', soft: 'rgba(230,255,210,.3)', halo: 'rgba(164,255,90,.55)', strip: '#dcffc0', lamp: '#7fe03a', hot: '#efffdc', spill: 'rgba(164,255,90,.28)' };
const LOSE = { c: '#ff2b1a', soft: 'rgba(255,190,170,.3)', halo: 'rgba(255,43,26,.6)', strip: '#ff6a50', lamp: '#ff2b1a', hot: '#ffd8cc', spill: 'rgba(255,43,26,.4)' };
const DY = 158, JAW = 86;

// ---- drawn once
const LAUREL = (() => {
  const leaves: { x: number; y: number; r: number }[] = [];
  const stem = (side: number) => { const pts: number[][] = []; for (let t = 0; t <= 6; t++) { const a = (98 + t * 19) * Math.PI / 180; pts.push([Math.cos(a) * 66 * side, Math.sin(a) * 66]); } return 'M' + pts.map(p => p.map(f1).join(' ')).join('L'); };
  [-1, 1].forEach(side => { for (let t = 0; t <= 6; t++) { const deg = 98 + t * 19, a = deg * Math.PI / 180; [-1, 1].forEach(o => {
    const x = Math.cos(a) * (66 + o * 8), y = Math.sin(a) * (66 + o * 8), r0 = deg + 90 + o * 32;
    leaves.push({ x: f1(side === 1 ? x : -x), y: f1(y), r: f1(side === 1 ? r0 : 180 - r0) }); }); } });
  return { leaves, stemL: stem(1), stemR: stem(-1) };
})();
const RAYS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2, w = .07, r0 = 104, r1 = i % 2 ? 150 : 185, cx = 300, cy = 448;
  const p = (ang: number, r: number) => `${f1(cx + Math.cos(ang) * r)} ${f1(cy + Math.sin(ang) * r)}`;
  return `M${p(a - w, r0)}L${p(a, r1)}L${p(a + w, r0)}Z`;
}).join('');
const HANG = [
  { d: 'M-20 120 C 200 260, 420 200, 560 60', w: 9, hi: '#3a3f42' }, { d: 'M1940 150 C 1720 300, 1520 230, 1400 60', w: 10, hi: '#3a3f42' },
  { d: 'M-20 330 C 120 400, 260 360, 330 440', w: 12, hi: '#2c3134' }, { d: 'M1940 360 C 1800 410, 1680 380, 1600 450', w: 12, hi: '#2c3134' },
];
const P = { persp: 1600, ox: 960, oy: -260, L: 390, T: 334, W: 1140, H: 1100, deg: 60 };
const STAINS = Array.from({ length: 14 }, (_, i) => ({ x: f1(rnd(i + 11) * P.W), y: f1(rnd(i + 31) * 900), rx: f1(30 + rnd(i + 51) * 110), ry: f1(16 + rnd(i + 71) * 50), o: +(.12 + rnd(i + 91) * .2).toFixed(2) }));
const TAPES = [
  { tf: 'translate(30 30)', w: P.W / 2 - 130 }, { tf: `translate(${P.W / 2 + 100} 30)`, w: P.W / 2 - 130 },
  { tf: 'translate(-20 420) rotate(-38)', w: 360 }, { tf: `translate(${P.W - 260} 190) rotate(38)`, w: 360 },
];
const CON = { x: 50, y: 176, w: 440, h: 366 }, PLQ = { x: 1440, y: 172, w: 420, h: 372 };
const CHAINS = [CON.x + 70, CON.x + CON.w - 70].map(x => `M${x} -10 V${CON.y + 4}`).concat([PLQ.x + 70, PLQ.x + PLQ.w - 70].map(x => `M${x} -10 V${PLQ.y + 4}`));
const DRIPS = [{ x: 104, y: 258, h: 16 }, { x: 214, y: 262, h: 28 }, { x: 326, y: 254, h: 12 }];
const DRIPS2 = [{ x: 96, y: 168, h: 34 }, { x: 188, y: 172, h: 58 }, { x: 300, y: 166, h: 24 }];
const RIG = (() => { const w = COLS * PITCH + 44; return { l: Math.round(960 - w / 2), r: Math.round(960 + w / 2), top: 20 }; })();

function layout(n: number) {
  const area = n <= 4 ? { x: 160, y: 700, w: 1600, h: 376 } : n <= 9 ? { x: 60, y: 770, w: 1800, h: 306 } : { x: 60, y: 650, w: 1800, h: 426 };
  const raw = stations(n, area, n <= 4 ? { maxPhoto: 260, maxCell: 560 } : {});
  const c = Math.cos(P.deg * Math.PI / 180), sn = Math.sin(P.deg * Math.PI / 180);
  const toPlane = (sx: number, sy: number) => {
    const v = ((sy - P.oy) * P.persp - (P.T - P.oy) * P.persp) / (c * P.persp + (sy - P.oy) * sn);
    const Z = v * sn, X = P.ox + (sx - P.ox) * (P.persp - Z) / P.persp;
    return { u: f1(X - P.L), v: f1(v) };
  };
  const zTop = P.T + 8, zBot = raw.top - 20;
  const zc = toPlane(960, Math.round(zTop + (zBot - zTop) * .55)), ze = toPlane(960, zBot - 10);
  const zr = Math.min(300, Math.max(150, (ze.v - zc.v) * .95));
  const tick = (a: number, r0: number, r1: number) => `M${f1(zc.u + Math.cos(a) * r0)} ${f1(zc.v + Math.sin(a) * r0)}L${f1(zc.u + Math.cos(a) * r1)} ${f1(zc.v + Math.sin(a) * r1)}`;
  const zp = { u: zc.u, v: zc.v, r: f1(zr), ticks: [0, 2].map(k => tick(k * Math.PI / 2, zr * 1.06, zr * 1.28)).join('') };
  const pool = { u: zc.u, v: f1(zc.v - 20), tf: `translate(${zc.u} ${zc.v - 20}) scale(1 .8) translate(${-zc.u} ${-(zc.v - 20)})` };
  const box = { u: zc.u, v: 70 };
  const tableCables = [
    { d: `M-60 ${f1(box.v + 160)} C 180 ${f1(box.v + 40)}, 300 ${f1(box.v + 260)}, ${f1(box.u - 230)} ${f1(box.v + 60)} S ${f1(box.u - 110)} ${f1(box.v)}, ${f1(box.u - 70)} ${f1(box.v)}`, w: 18, col: '#1b1e20' },
    { d: `M${P.W + 60} ${f1(box.v + 240)} C ${P.W - 200} ${f1(box.v + 120)}, ${P.W - 300} ${f1(box.v + 330)}, ${f1(box.u + 240)} ${f1(box.v + 70)} S ${f1(box.u + 110)} ${f1(box.v - 4)}, ${f1(box.u + 70)} ${f1(box.v)}`, w: 20, col: '#191b1c' },
  ];
  // the press: local 600×580 (crown top at 158, foot at 580), as big as the gap under the lamp allows
  const k = f1(Math.max(.8, Math.min(1.25, (zBot - 196) / 422)) * 100) / 100;
  const pr = { x: f1(960 - 300 * k), y: f1(zBot - 580 * k) };
  const lampTop = Math.round(pr.y + 158 * k - 94), bulb = lampTop + 95 - 10;
  const lk = Math.min(k, 1);
  const led = { show: n < 10, k: lk, x: f1(pr.x - 300 * lk), y: f1(Math.max(zBot - 172 * lk, 552)),
    lines: [0, 1, 2, 3, 4, 5].flatMap(j => [`M${18 + j * -1.6} ${66 + j * 16} L152 ${58 + j * 16}`, `M184 ${58 + j * 16} L${326 + j * 1.8} ${68 + j * 16}`]).slice(0, 11) };
  const stackDef = [{ dx: 40, dy: -26, n: 6 }, { dx: 118, dy: -34, n: 10 }, { dx: 196, dy: -18, n: 4 }, { dx: 84, dy: 4, n: 3 }, { dx: 170, dy: 12, n: 1 }];
  const stk = { k: lk, x: f1(pr.x + 590 * k), y: f1(zBot - 30 * lk), coins: stackDef.flatMap(s => Array.from({ length: s.n }, (_, j) => ({ x: s.dx, y: s.dy - j * 9 }))) };
  const vbFs = n >= 10 ? 190 : 230, vbQs = n >= 10 ? 42 : 52;
  const vb = { top: 138, fs: vbFs, qs: vbQs, h: Math.round(38 + 8 + vbFs * .85 + 10 + vbQs * 1.1) };
  return { raw, zp, pool, tableCables, k, pr, lampTop, bulb, led, stk, vb, peek: { x: Math.round(pr.x + 420 * k), y: Math.round(pr.y + 270 * k) } };
}

/** A console readout: a label and seven-segment digits (with an optional "/ of"). */
function ConRow({ top, label, lcls, text, den, h, gold = true }: { top: number; label: string; lcls: string; text: string; den?: string; h: number; gold?: boolean }) {
  const g = segments('8'.repeat(text.length), { h: 100 }), v = segments(text, { h: 100 }), aw = g.width;
  const d = den ? segments(den, { h: 100 }) : null;
  const vw = d ? f1(aw + 40 + d.width) : aw;
  const slash = `M${f1(aw + 22)} 4L${f1(aw + 34)} 4L${f1(aw + 12)} 96L${f1(aw)} 96Z`;
  return (
    <div data-fx="conRow" style={{ ...abs, left: 28, right: 28, top, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className={lcls}>{label}</div>
      <div className={'mk-seg' + (gold ? ' mk-seg--gold' : '')}>
        <svg viewBox={`0 -6 ${vw} 112`} width={Math.round(vw * h / 100)} height={Math.round(h * 1.12)} aria-label={den ? `${text} of ${den}` : text}>
          <path className="mk-seg-ghost" d={v.ghost} /><path className="mk-seg-glow" d={v.lit} /><path className="mk-seg-lit" d={v.lit} />
          {d && <>
            <path className="mk-seg-glow" d={slash} /><path className="mk-seg-lit" d={slash} />
            <g transform={`translate(${f1(aw + 40)} 0)`}><path className="mk-seg-ghost" d={d.ghost} /><path className="mk-seg-glow" d={d.lit} /><path className="mk-seg-lit" d={d.lit} /></g>
          </>}
        </svg>
      </div>
    </div>
  );
}

export function PennyTV({ players, called, secs, result }: {
  players: Seat[]; called: number; secs: number | null;
  result: null | { coin: 'heads' | 'tails'; calls: Record<string, string>; losers: string[] };
}) {
  const n = Math.max(1, players.length);
  const L = useMemo(() => layout(n), [n]);
  const landed = !!result;
  const still = reduced();
  const word = result?.coin === 'tails' ? 'TAILS' : 'HEADS';
  const final = landed ? word.toLowerCase() : 'heads', other = final === 'heads' ? 'tails' : 'heads';
  const losers = new Set(result?.losers ?? []);
  const drinkers = losers.size;
  const quote = drinkers === 0 ? { a: 'Hmph. ', b: 'Lucky peasants.' }
    : drinkers === n ? { a: 'Ha! Every one of you ', b: 'owes me.' }
    : drinkers === 1 ? { a: 'Bah! One of you ', b: 'owes me.' }
    : { a: `Bah! ${WORDS[drinkers] ?? drinkers} of you `, b: 'owe me.' };
  const pad2 = (v: number) => String(Math.max(0, Math.min(99, v))).padStart(2, '0');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || still) return;
    const q = (s: string) => [...el.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`)];
    const A: Animation[] = [];
    const loop = (e: Element | undefined, k: Keyframe[], o: KeyframeAnimationOptions) => { if (e) A.push(e.animate(k, { iterations: Infinity, ...o })); };
    // always: the lamp's sway and its rare flicker (the marquee's scroll is CSS)
    q('lampRig').concat(q('light')).forEach(e => loop(e, [{ transform: 'rotate(-.6deg)' }, { transform: 'rotate(.6deg)' }], { duration: 4200, direction: 'alternate', easing: 'ease-in-out' }));
    q('beam').concat(q('pool')).forEach(e => loop(e, [{ opacity: 1 }, { opacity: 1, offset: .9 }, { opacity: .45, offset: .915 }, { opacity: 1, offset: .93 }, { opacity: .7, offset: .95 }, { opacity: 1 }], { duration: 6100, easing: 'steps(1,end)' }));
    const [spin] = q('coinSpin'), [faceF] = q('faceF'), [faceO] = q('faceO');
    if (!landed) {
      // the coin flips about its spindle (scaleX through zero; the face swaps at the zero). Faces only: the TV never knows the coin.
      const t = { duration: 280, direction: 'alternate' as const };
      loop(spin, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(-1)' }], { ...t, easing: 'ease-in-out' });
      loop(faceF, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0, offset: .5 }, { opacity: 0 }], { ...t, easing: 'linear' });
      loop(faceO, [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1, offset: .5 }, { opacity: 1 }], { ...t, easing: 'linear' });
      q('plaque').forEach(e => loop(e, [{ transform: 'rotate(-1.8deg)' }, { transform: 'rotate(-1.2deg)' }], { duration: 3100, direction: 'alternate', easing: 'ease-in-out' }));
      return () => A.forEach(a => a.cancel());
    }
    // RESULT: plays once (~3.2s). The render IS the end frame, so each animation is simply dropped when it finishes.
    const D = 3200;
    const tl = (e: Element | null | undefined, frames: [number, Keyframe, string?][]) => {
      if (!e) return;
      const kf: Keyframe[] = frames.map(([t, p, ez]) => ({ ...p, offset: Math.min(1, t / D), ...(ez ? { easing: ez } : {}) }));
      if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
      if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
      const a = e.animate(kf, { duration: D, fill: 'both' });
      A.push(a); a.finished.then(() => a.cancel()).catch(() => {});
    };
    const tf = (v: string) => ({ transform: v }), op = (v: number) => ({ opacity: v }), io = 'ease-in-out';
    // 0-860: the coin keeps flipping, slowing, and ends on its face
    const flips = [0, 120, 240, 360, 500, 660, 860];
    tl(spin, flips.map((t, i) => [t, tf(`scaleX(${i % 2 ? -1 : 1})`), io]));
    const zeros = flips.slice(1).map((t, i) => (t + flips[i]) / 2);
    const swap = (first: number) => { const f: [number, Keyframe][] = [[0, op(first)]]; zeros.forEach((z, i) => { const v = (i % 2 ? first : 1 - first); f.push([z, op(1 - v)], [z, op(v)]); }); return f; };
    tl(faceF, swap(1)); tl(faceO, swap(0));
    // 300: the trapdoor drops open; 340-1020: the coin falls into the tray and bounces; 900-1500: a damped wobble to rest
    const ty = (v: number) => tf(`translateY(${v}px)`), rot = (v: number) => tf(`rotate(${v}deg)`);
    tl(q('jawL')[0], [[300, rot(0), 'cubic-bezier(.3,1.5,.5,1)'], [520, rot(JAW)]]);
    tl(q('jawR')[0], [[300, rot(0), 'cubic-bezier(.3,1.5,.5,1)'], [520, rot(-JAW)]]);
    tl(q('coinDrop')[0], [[340, ty(0), 'cubic-bezier(.55,0,1,.6)'], [680, ty(DY), 'ease-out'], [800, ty(DY - 30), 'ease-in'], [900, ty(DY), 'ease-out'], [960, ty(DY - 8), 'ease-in'], [1020, ty(DY)]]);
    tl(q('coinShadow')[0], [[600, op(0)], [700, op(.6)]]);
    tl(q('coinWob')[0], [[900, rot(0), 'ease-out'], [1000, rot(-9), io], [1100, rot(7), io], [1200, rot(-4.5), io], [1300, rot(2.5), io], [1400, rot(-1), io], [1500, rot(0)]]);
    tl(q('rays')[0], [[1000, op(0)], [1300, op(1)]]);
    // 1450-1800: the verdict slams in over the press, the marquee dims
    tl(q('scrim')[0], [[1450, op(0)], [1700, op(1)]]);
    tl(q('verdict')[0], [[1500, { opacity: 0, transform: 'scale(1.5)' }, 'cubic-bezier(.3,1.5,.5,1)'], [1800, { opacity: 1, transform: 'scale(1)' }]]);
    tl(q('marquee')[0], [[1500, op(1)], [1800, op(.3)]]);
    q('plaque').forEach(e => tl(e, [[1650, { transform: 'translateY(-80px) rotate(-7deg)', opacity: 0 }, 'cubic-bezier(.3,1.5,.5,1)'], [2000, { transform: 'translateY(0px) rotate(-1.5deg)', opacity: 1 }]]));
    q('conRow').forEach(e => tl(e, [[1800, op(0)], [2000, op(1)]]));
    // 2050+: station by station, the lit layer (lamp, ring, edge, spill) flicks on, the call tag drops, the scrawl stamps.
    // Four animations a station (not one per lamp, ring and edge), so 14 players stay cheap.
    const st = q('station'), step = Math.min(80, 700 / Math.max(1, st.length - 1));
    st.forEach((s, i) => {
      const t = Math.round(2050 + i * step), one = (f: string) => s.querySelector(`[data-fx="${f}"]`);
      s.querySelectorAll('[data-fx="lit"]').forEach(e => tl(e, [[t, op(0), 'ease-out'], [t + 200, op(1)]]));
      tl(one('tag'), [[t, { opacity: 0, transform: 'translateY(-16px) rotate(3deg)' }, 'ease-out'], [t + 160, { opacity: 1, transform: 'translateY(0px) rotate(3deg)' }]]);
      tl(one('scrawl'), [[t + 80, { opacity: 0, transform: 'translate(-50%,-50%) rotate(-8deg) scale(1.7)' }, 'cubic-bezier(.3,1.4,.5,1)'], [t + 300, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-8deg) scale(1)' }]]);
    });
    return () => A.forEach(a => a.cancel());
  }, [landed, still]);

  // sound: a brass click as each call goes in (the count only); the result follows the timeline's beats: the flips,
  // the trapdoor, the coin clinking into the tray, the verdict slam, a tick per station, and his snicker if anyone drinks
  useEffect(() => { if (called && !landed) Sound.countTick(); }, [called, landed]);
  useEffect(() => {
    if (!landed) return;
    const last = 2050 + Math.min(80, 700 / Math.max(1, n - 1)) * (n - 1) + 300;
    const end = () => (drinkers ? Sound.giggle() : Sound.down());
    if (still) return cues([[0, Sound.clang], [600, end]]);
    return cues([
      ...[0, 120, 240, 360, 500, 660].map(t => [t, Sound.tick] as [number, () => void]),
      [300, Sound.lever], [680, Sound.coinDrop], [1500, Sound.clang],
      ...Array.from({ length: n }, (_, i) => [Math.round(2050 + i * Math.min(80, 700 / Math.max(1, n - 1))), Sound.countTick] as [number, () => void]),
      [last, end],
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  const { pr, k } = L;
  const text = landed ? `${word}. PAY UP, PEASANTS.` : 'CALL IT, PEASANTS.';
  const stillText = landed ? `${word}. PAY UP.` : 'CALL IT.';

  return (
    <div ref={root} className="mgx mk-motion" style={{ ...FULL, overflow: 'hidden', isolation: 'isolate', background: '#0a0804', color: '#f1e8d4', fontFamily: "'Courier Prime', monospace" }}>
      {/* coin faces, drawn once: heads = his purple top hat with the pink band; tails = his pound mark in a laurel */}
      <svg width="0" height="0" style={abs} aria-hidden="true">
        <defs>
          <radialGradient id="pd-gold" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff3c0" /><stop offset=".45" stopColor="#e0b458" /><stop offset=".9" stopColor="#8a6a00" /></radialGradient>
          <linearGradient id="pd-brass-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3a2c00" /><stop offset=".18" stopColor="#8a6a10" /><stop offset=".36" stopColor="#fff0b0" /><stop offset=".52" stopColor="#e0b458" /><stop offset=".82" stopColor="#8a6a10" /><stop offset="1" stopColor="#2a1e00" /></linearGradient>
          <linearGradient id="pd-brass-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0b0" /><stop offset=".3" stopColor="#e0b458" /><stop offset=".75" stopColor="#8a6a10" /><stop offset="1" stopColor="#3a2c00" /></linearGradient>
          <linearGradient id="pd-iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#434b50" /><stop offset=".5" stopColor="#22292d" /><stop offset="1" stopColor="#0d1012" /></linearGradient>
          <linearGradient id="pd-iron-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0d1012" /><stop offset=".35" stopColor="#5a646a" /><stop offset=".6" stopColor="#2a3034" /><stop offset="1" stopColor="#0a0c0d" /></linearGradient>
          <radialGradient id="pd-ball" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#9aa3a7" /><stop offset=".5" stopColor="#2c3336" /><stop offset="1" stopColor="#060708" /></radialGradient>
          <symbol id="pd-coin-blank" viewBox="-100 -100 200 200" overflow="visible">
            <circle r="99" fill="#2a1e00" /><circle r="95" fill="url(#pd-gold)" />
            <circle r="89" fill="none" stroke="#7a5a00" strokeWidth="6" strokeDasharray="3 3.2" />
            <circle r="82" fill="none" stroke="#fff3c0" strokeWidth="2" opacity=".45" /><circle r="78" fill="none" stroke="#5a4400" strokeWidth="2.5" opacity=".7" />
          </symbol>
          <symbol id="pd-coin-heads" viewBox="-100 -100 200 200" overflow="visible">
            <use href="#pd-coin-blank" x="-100" y="-100" width="200" height="200" />
            <g stroke="#1e1230" strokeLinejoin="round">
              <ellipse cx="0" cy="36" rx="64" ry="15" fill="#3e2b58" strokeWidth="4" />
              <path d="M-38 36 L-44 -44 Q0 -56 44 -44 L38 36 Q0 44 -38 36 Z" fill="#6a4f8f" strokeWidth="4" />
              <path d="M-40 8 Q0 16 40 8 L38 32 Q0 40 -38 32 Z" fill="#ff4f9a" strokeWidth="3" />
              <ellipse cx="0" cy="-44" rx="44" ry="11" fill="#8a6db3" strokeWidth="4" />
              <path d="M-64 36 Q0 62 64 36 Q0 47 -64 36 Z" fill="#4a3566" strokeWidth="3" />
            </g>
            <path d="M-32 -36 L-35 2 L-25 4 L-21 -39 Z" fill="#fff" opacity=".2" /><path d="M-34 14 L-33 28 L-24 29 L-25 16 Z" fill="#fff" opacity=".35" />
          </symbol>
          <symbol id="pd-coin-tails" viewBox="-100 -100 200 200" overflow="visible">
            <use href="#pd-coin-blank" x="-100" y="-100" width="200" height="200" />
            <g fill="none" stroke="#6a4e00" strokeWidth="3.5" strokeLinecap="round"><path d={LAUREL.stemL} /><path d={LAUREL.stemR} /></g>
            {LAUREL.leaves.map((l, i) => <ellipse key={i} cx={l.x} cy={l.y} rx="12" ry="5.2" transform={`rotate(${l.r} ${l.x} ${l.y})`} fill="#7a5a00" stroke="#4a3600" strokeWidth="1.5" />)}
            <text x="2" y="38" textAnchor="middle" fontFamily="'IM Fell English', serif" fontSize="112" fill="#fff3c0" opacity=".55">£</text>
            <text x="0" y="36" textAnchor="middle" fontFamily="'IM Fell English', serif" fontSize="112" fill="#5a4400">£</text>
          </symbol>
        </defs>
      </svg>

      {/* THE WALL: the Scrooge's dark gold-striped panelling over concrete, only just caught by the lamp */}
      <div style={{ ...abs, inset: '0 0 520px 0', background: 'repeating-linear-gradient(90deg, #0c0a05 0 60px, #120e06 60px 62px)' }} />
      <div className="mk-concrete" style={{ ...abs, inset: '0 0 520px 0', opacity: .22 }} />
      <div style={{ ...abs, inset: 0, background: 'radial-gradient(ellipse 44% 50% at 50% 36%, rgba(224,180,88,.16), rgba(4,4,4,.8) 70%, #050402 100%)' }} />
      <div style={{ ...abs, left: 0, right: 0, top: 330, height: 230, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.75) 70%, #030302)' }} />
      <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
        <g fill="none" strokeLinecap="round">
          {HANG.map((c, i) => <g key={i}><path d={c.d} stroke="#000" strokeWidth={c.w + 4} /><path d={c.d} stroke="#1a1c1d" strokeWidth={c.w} /><path d={c.d} stroke={c.hi} strokeWidth="2" opacity=".5" transform="translate(0 -2)" /></g>)}
        </g>
      </svg>

      {/* THE TABLE: one static perspective plane */}
      <div style={{ ...abs, inset: 0, perspective: P.persp, perspectiveOrigin: `${P.ox}px ${P.oy}px`, pointerEvents: 'none' }}>
        <div style={{ ...abs, left: P.L, top: P.T, width: P.W, height: P.H, transformOrigin: '50% 0', transform: `rotateX(${P.deg}deg)` }}>
          <div className="mk-concrete" style={{ ...abs, inset: 0, backgroundSize: '200px 200px', boxShadow: '0 0 0 18px #16191b, 0 0 0 22px #000, 0 -3px 0 22px #3a4146' }} />
          <svg viewBox={`0 0 ${P.W} ${P.H}`} style={{ ...abs, inset: 0, width: P.W, height: P.H, overflow: 'visible' }} aria-hidden="true">
            <defs>
              <radialGradient id="ms-pool" cx={L.pool.u} cy={L.pool.v} r="820" gradientUnits="userSpaceOnUse" gradientTransform={L.pool.tf}>
                <stop offset="0" stopColor="#ffe7a8" stopOpacity=".5" /><stop offset=".35" stopColor="#ffc452" stopOpacity=".2" /><stop offset=".75" stopColor="#e0b458" stopOpacity=".05" /><stop offset="1" stopColor="#e0b458" stopOpacity="0" />
              </radialGradient>
              <pattern id="ms-haz" width="46" height="46" patternUnits="userSpaceOnUse"><image href="/textures/hazard.png" width="46" height="46" /></pattern>
              <radialGradient id="ms-fall" cx={L.pool.u} cy={L.pool.v} r={820 * 1.25} gradientUnits="userSpaceOnUse" gradientTransform={L.pool.tf}>
                <stop offset=".3" stopColor="#000" stopOpacity="0" /><stop offset=".72" stopColor="#000" stopOpacity=".62" /><stop offset="1" stopColor="#000" stopOpacity=".9" />
              </radialGradient>
            </defs>
            {STAINS.map((s, i) => <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill="#0a0806" opacity={s.o} />)}
            <g opacity=".5" fill="none" stroke="#e6dcc4">
              <ellipse cx={L.zp.u} cy={L.zp.v} rx={L.zp.r} ry={L.zp.r} strokeWidth="10" strokeDasharray="120 14 40 14" />
              <path d={L.zp.ticks} strokeWidth="10" />
            </g>
            {TAPES.map((t, i) => <g key={i} transform={t.tf}><rect x="0" y="0" width={t.w} height="46" fill="#000" opacity=".45" transform="translate(0 6)" /><rect x="0" y="0" width={t.w} height="46" fill="url(#ms-haz)" /></g>)}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {L.tableCables.map((c, i) => <g key={i}>
                <path d={c.d} stroke="#000" strokeWidth={c.w + 10} opacity=".55" transform="translate(6 14)" /><path d={c.d} stroke="#050606" strokeWidth={c.w + 4} />
                <path d={c.d} stroke={c.col} strokeWidth={c.w} /><path d={c.d} stroke="#9aa3a7" strokeWidth="3" opacity=".35" transform="translate(-3 -5)" />
              </g>)}
            </g>
            <g data-fx="pool"><rect x="-40" y="-40" width={P.W + 80} height={P.H + 80} fill="url(#ms-pool)" /></g>
            <rect x="-40" y="-40" width={P.W + 80} height={P.H + 80} fill="url(#ms-fall)" />
          </svg>
        </div>
      </div>

      {/* THE PROP: the Scrooge's brass counting-house press, his ledger and his coin stacks */}
      <svg viewBox="0 0 1920 1080" style={{ ...FULL, overflow: 'visible' }} aria-hidden="true">
        {L.led.show && <g transform={`translate(${L.led.x} ${L.led.y}) scale(${L.led.k})`}>
          <ellipse cx="170" cy="170" rx="200" ry="22" fill="#000" opacity=".5" />
          <path d="M-6 50 L168 26 L346 50 L358 172 L168 160 L-18 172 Z" fill="#3a1410" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
          <path d="M8 54 L166 36 L166 154 L-4 164 Z" fill="#e8dcc0" /><path d="M170 36 L332 54 L344 164 L170 154 Z" fill="#d6c8a8" />
          <path d="M168 34 V156" stroke="#6a5a40" strokeWidth="3" />
          <g stroke="#4a3208" strokeWidth="3.2" strokeLinecap="round" opacity=".7" strokeDasharray="16 6 26 7 10 5">{L.led.lines.map((l, i) => <path key={i} d={l} />)}</g>
          <path d="M190 128 L324 138" stroke="#b01e10" strokeWidth="3" opacity=".8" />
          <path d="M240 156 L256 140 Q330 62 396 26 Q354 92 266 152 Z" fill="#f1e8d4" stroke="#1b1712" strokeWidth="3" strokeLinejoin="round" />
          <path d="M232 164 L380 40" stroke="#1b1712" strokeWidth="2.5" />
        </g>}
        <g transform={`translate(${L.stk.x} ${L.stk.y}) scale(${L.stk.k})`}>
          <ellipse cx="110" cy="10" rx="150" ry="20" fill="#000" opacity=".5" />
          {L.stk.coins.map((c, i) => <g key={i}><ellipse cx={c.x} cy={c.y + 7} rx="34" ry="10" fill="#5a4400" stroke="#1e1500" strokeWidth="2" /><ellipse cx={c.x} cy={c.y} rx="34" ry="10" fill="url(#pd-brass-h)" stroke="#3a2c00" strokeWidth="2" /></g>)}
        </g>
        <g transform={`translate(${pr.x} ${pr.y}) scale(${k})`}>
          <ellipse cx="300" cy="560" rx="300" ry="26" fill="#000" opacity=".6" />
          <rect x="-10" y="170" width="620" height="14" rx="6" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" />
          <circle cx="-10" cy="177" r="28" fill="url(#pd-ball)" stroke="#000" strokeWidth="3" /><circle cx="610" cy="177" r="28" fill="url(#pd-ball)" stroke="#000" strokeWidth="3" />
          <path d="M64 214 L64 188 Q64 172 100 170 Q300 156 500 170 Q536 172 536 188 L536 214 Z" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
          <path d="M84 192 Q300 172 516 192" stroke="#5a4400" strokeWidth="3" fill="none" opacity=".7" />
          <circle cx="96" cy="202" r="6" fill="#3a2c00" /><circle cx="504" cy="202" r="6" fill="#3a2c00" />
          <rect x="92" y="214" width="56" height="218" fill="url(#pd-brass-v)" stroke="#000" strokeWidth="3" />
          <rect x="452" y="214" width="56" height="218" fill="url(#pd-brass-v)" stroke="#000" strokeWidth="3" />
          <path d="M108 220 V428 M132 220 V428 M468 220 V428 M492 220 V428" stroke="#5a4400" strokeWidth="3" opacity=".55" />
          <rect x="82" y="208" width="76" height="16" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" /><rect x="442" y="208" width="76" height="16" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" />
          <rect x="80" y="418" width="80" height="22" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" /><rect x="440" y="418" width="80" height="22" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" />
          <rect x="252" y="184" width="96" height="20" rx="4" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" />
          <path d="M292 202 H308 L302 208 H298 Z" fill="url(#pd-iron-v)" stroke="#000" strokeWidth="2" />
          <path d="M40 540 L60 454 H540 L560 540 Z" fill="url(#pd-iron)" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
          <path d="M60 454 L80 440 H520 L540 454 Z" fill="#4a5257" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
          <rect x="52" y="462" width="496" height="8" fill="url(#pd-brass-h)" />
          <circle cx="76" cy="522" r="6" fill="#9aa3a7" stroke="#000" strokeWidth="2" /><circle cx="524" cy="522" r="6" fill="#9aa3a7" stroke="#000" strokeWidth="2" />
          <g stroke="#000" strokeWidth="2"><circle cx="112" cy="500" r="20" fill="url(#pd-gold)" /><circle cx="488" cy="500" r="20" fill="url(#pd-gold)" /></g>
          <g fontFamily="'IM Fell English', serif" fontSize="28" fill="#5a4400" textAnchor="middle"><text x="112" y="509">£</text><text x="488" y="509">£</text></g>
          <ellipse cx="300" cy="532" rx="130" ry="17" fill="#1e1500" stroke="#000" strokeWidth="3" />
          <g data-fx="rays" style={{ opacity: landed ? 1 : 0 }}><path d={RAYS} fill="#ffd84a" opacity=".32" /></g>
        </g>
      </svg>
      {/* the coin, the jaws and the tray lip in their own small SVG over the press: the coin flips all through the
          live game, and this keeps each flip from repainting the whole full-screen drawing */}
      <svg viewBox="0 0 600 580" style={{ ...abs, left: pr.x, top: pr.y, width: 600 * k, height: 580 * k, overflow: 'visible' }} aria-hidden="true">
          {/* THE COIN: between the ram and the trapdoor; flips about its upright axis (scaleX). Still: edge-on and faceless. */}
        <ellipse data-fx="coinShadow" cx="300" cy="538" rx="84" ry="9" fill="#000" style={{ opacity: landed ? .6 : 0 }} />
        <g data-fx="coinDrop" style={{ transform: `translateY(${landed ? DY : 0}px)` }}>
          <g data-fx="coinWob" style={{ transformOrigin: '300px 380px' }}>
            {!landed && still && <>
              <ellipse cx="300" cy="290" rx="62" ry="90" fill="none" stroke="#ffd84a" strokeWidth="3" opacity=".14" />
              <ellipse cx="300" cy="290" rx="34" ry="90" fill="none" stroke="#ffd84a" strokeWidth="4" opacity=".26" />
            </>}
            <g data-fx="coinSpin" style={{ transformOrigin: '300px 290px', transform: `scaleX(${landed || !still ? 1 : .14})` }}>
              <use href="#pd-coin-blank" x="210" y="200" width="180" height="180" style={{ opacity: landed || !still ? 0 : 1 }} />
              <g data-fx="faceF" style={{ opacity: landed || !still ? 1 : 0 }}><use href={`#pd-coin-${final}`} x="210" y="200" width="180" height="180" /></g>
              <g data-fx="faceO" style={{ opacity: 0, transformOrigin: '300px 290px', transform: 'scaleX(-1)' }}><use href={`#pd-coin-${other}`} x="210" y="200" width="180" height="180" /></g>
            </g>
          </g>
        </g>
        <g data-fx="jawL" style={{ transformOrigin: '150px 391px', transform: `rotate(${landed ? JAW : 0}deg)` }}>
          <path d="M144 380 H286 Q300 380 300 388 V396 Q300 403 290 403 H144 Z" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
        </g>
        <g data-fx="jawR" style={{ transformOrigin: '450px 391px', transform: `rotate(${landed ? -JAW : 0}deg)` }}>
          <path d="M456 380 H314 Q300 380 300 388 V396 Q300 403 310 403 H456 Z" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
        </g>
        <circle cx="150" cy="391" r="8" fill="#9aa3a7" stroke="#000" strokeWidth="2" /><circle cx="450" cy="391" r="8" fill="#9aa3a7" stroke="#000" strokeWidth="2" />
        <path d="M170 532 Q300 570 430 532 L426 546 Q300 586 174 546 Z" fill="url(#pd-brass-h)" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      {!landed && <div className="pd-scrawl-free pd-green" style={{ left: L.peek.x, top: L.peek.y, fontSize: 46, transform: 'rotate(-11deg)' }}>NO PEEKING!</div>}

      {/* THE LIGHT: one hard cone from the bulb above the crown */}
      <div data-fx="light" style={{ ...abs, inset: 0, transformOrigin: `960px ${L.lampTop}px`, pointerEvents: 'none' }}>
        <div data-fx="beam" style={{ ...abs, inset: 0, clipPath: `polygon(922px ${L.bulb}px, 998px ${L.bulb}px, 1600px 1080px, 320px 1080px)`, background: `linear-gradient(180deg, rgba(255,232,170,.24) ${L.bulb}px, rgba(255,200,90,.09) 640px, rgba(255,190,80,.03) 1000px)` }} />
        <div style={{ ...abs, left: 850, top: L.bulb - 60, width: 220, height: 130, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(255,244,210,.5), rgba(255,200,90,.16) 50%, transparent)' }} />
      </div>
      <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 58% 62% at 50% 56%, transparent 45%, rgba(0,0,0,.55) 78%, rgba(0,0,0,.9)), linear-gradient(90deg, rgba(0,0,0,.5), transparent 16%, transparent 84%, rgba(0,0,0,.5))' }} />
      <div data-fx="lampRig" style={{ ...abs, left: 880, top: L.lampTop, width: 160, height: 96, transformOrigin: '80px 0', pointerEvents: 'none' }}>
        <svg viewBox="0 0 200 120" style={{ ...abs, inset: 0, width: 160, height: 96, overflow: 'visible' }} aria-hidden="true">
          <path d="M100 -300 V44" stroke="#000" strokeWidth="7" /><path d="M100 -300 V44" stroke="#2c3033" strokeWidth="3" />
          <rect x="90" y="34" width="20" height="22" fill="#1a1e21" stroke="#000" strokeWidth="3" />
          <path d="M40 104 Q46 62 100 56 Q154 62 160 104 Z" fill="#1d3a36" stroke="#000" strokeWidth="4" />
          <path d="M54 94 Q60 70 98 64" stroke="#79ada3" strokeWidth="4" fill="none" opacity=".55" />
          <path d="M40 104 Q100 98 160 104" stroke="#000" strokeWidth="6" fill="none" />
          <ellipse cx="100" cy="106" rx="50" ry="8" fill="#fff6e2" /><ellipse cx="100" cy="104" rx="24" ry="5" fill="#ffffff" />
        </svg>
      </div>

      {/* THE RIG, chains and the GOLD marquee */}
      <svg viewBox="0 0 1920 1080" style={FULL} aria-hidden="true">
        <g stroke="#000" strokeWidth="3" fill="#2a3034"><rect x={RIG.l + 60} y="-10" width="16" height={RIG.top + 14} /><rect x={RIG.r - 76} y="-10" width="16" height={RIG.top + 14} /></g>
        <g fill="none" strokeLinecap="round">{CHAINS.map((c, i) => <g key={i}><path d={c} stroke="#000" strokeWidth="10" strokeDasharray="12 5" /><path d={c} stroke="#8a6a10" strokeWidth="6" strokeDasharray="12 5" /></g>)}</g>
      </svg>
      <div style={{ ...abs, left: RIG.l, top: RIG.top }}>
        <Marquee text={still ? stillText : text} pitch={PITCH} cols={COLS} scroll={!still} step={.075} gold fx="marquee" stripStyle={{ opacity: landed ? .3 : 1 }} />
      </div>
      <div style={{ ...abs, left: RIG.l - 60, top: RIG.top + 110, width: RIG.r - RIG.l + 120, height: 110, pointerEvents: 'none', background: 'radial-gradient(ellipse 50% 60% at 50% 0%, rgba(255,216,74,.12), transparent 70%)' }} />

      {/* P5 THE CONSOLE: the seconds left and how many have called (never who) / after: the tally */}
      <div className="pd-panel" style={{ left: CON.x, top: CON.y, width: CON.w, height: CON.h }}>
        <div className="pd-dither" />
        <div className="pd-strip">Scrooge &amp; Co.</div>
        {landed
          ? <>
              <ConRow top={100} label="CALLED IT" lcls="pd-mlabel pd-green" text={pad2(n - drinkers)} h={100} />
              <ConRow top={234} label="DRINKS" lcls="pd-mlabel pd-red" text={pad2(drinkers)} h={100} gold={false} />
            </>
          : <>
              <ConRow top={96} label="Time" lcls="pd-label" text={pad2(secs ?? 0)} h={110} />
              <ConRow top={254} label="Called" lcls="pd-label" text={String(called)} den={String(n)} h={60} />
            </>}
      </div>

      {/* THE SCROOGE'S PLAQUE: live, the rule in his gold marker; result, his taunt */}
      <div data-fx="plaque" className="pd-panel" style={{ left: PLQ.x, top: PLQ.y, width: PLQ.w, height: PLQ.h, transform: 'rotate(-1.5deg)' }}>
        <div className="pd-dither" />
        {!landed
          ? <>
              <div className="pd-kick" style={{ ...abs, left: 0, right: 0, top: 30 }}>The Scrooge says…</div>
              <div className="pd-ink" style={{ ...abs, left: 20, right: 20, top: 82, fontSize: 54 }}>WRONG OR<br />SILENT?<br />YOU DRINK.</div>
              {DRIPS.map((d, i) => <div key={i} className="pd-drip" style={{ left: d.x, top: d.y, height: d.h }} />)}
              <div className="pd-quote" style={{ ...abs, left: 16, right: 16, bottom: 22 }}>“Call it, <b>peasants.</b>”</div>
            </>
          : <>
              <div className="pd-ink" style={{ ...abs, left: 20, right: 20, top: 70, fontSize: 96 }}>PAY UP!</div>
              {DRIPS2.map((d, i) => <div key={i} className="pd-drip" style={{ left: d.x, top: d.y, height: d.h }} />)}
              <div className="pd-quote" style={{ ...abs, left: 16, right: 16, bottom: 30 }}>“My coin. <b>My rules.</b>”</div>
              <div className="pd-scrawl-free pd-red" style={{ right: -6, top: -40, fontSize: 54, transform: 'rotate(9deg)' }}>TEE-HEE!</div>
            </>}
      </div>

      {/* P2 THE VERDICT: over the press, once the coin has settled */}
      {landed && <>
        <div data-fx="scrim" style={{ ...abs, left: 330, width: 1260, top: L.vb.top - 70, height: L.vb.h + 140, pointerEvents: 'none', background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(6,4,1,.84), rgba(6,4,1,.6) 50%, transparent 72%)' }} />
        <div data-fx="verdict" style={{ ...abs, left: 0, right: 0, top: L.vb.top, textAlign: 'center', transformOrigin: '50% 45%', pointerEvents: 'none' }}>
          <div className="pd-kick" style={{ fontSize: 38 }}>The Scrooge says…</div>
          <div className="pd-verdict" style={{ fontSize: L.vb.fs, marginTop: 8 }}>{word}!</div>
          <div className="pd-quote" style={{ fontSize: L.vb.qs, marginTop: 10 }}>“{quote.a}<b>{quote.b}</b>”</div>
        </div>
      </>}

      {/* THE STATIONS: dark while calls come in; at the result, lit, the verdict over the polaroid, the call on a brass tag */}
      {L.raw.map(s => {
        const p = players[s.i];
        const call = result?.calls?.[p?.id ?? ''] ?? null;
        const lose = landed && losers.has(p?.id ?? ''), lit = lose ? LOSE : WIN;
        const name = (p?.name ?? '?').toUpperCase();
        const fs = Math.max(32, Math.min(Math.round(s.photo * .25), Math.floor((s.w - 6) / 5.4)));
        return (
          <div key={s.i} data-fx="station" className="mk-station" style={{ left: s.x, top: s.y, width: s.w, height: s.h, zIndex: s.z }}>
            {landed && <div data-fx="lit" style={{ ...abs, inset: 0 }}>
              <div className="mk-station-glow" style={{ '--mk-glow': lit.spill, opacity: 1 } as CSSProperties} />
              <div style={{ ...abs, inset: 0, borderRadius: 6, pointerEvents: 'none', boxShadow: `inset 0 0 0 4px ${lit.c}, inset 0 2px 0 5px ${lit.soft}, 0 0 18px 2px ${lit.halo}` }} />
              <div style={{ ...abs, left: 22, right: 22, top: -5, height: 6, borderRadius: 3, background: lit.strip, boxShadow: `0 0 0 1px #000, 0 0 14px 3px ${lit.halo}` }} />
            </div>}
            <div className="mk-polaroid" style={{ left: s.photoX, top: s.photoY, width: s.photo, transform: `rotate(${s.tilt}deg)` }}>
              <div className="mk-photo"><Face p={p} size={s.photo * .4} /></div>
            </div>
            <div className="mk-nameplate" style={{ top: s.nameY }}>
              <span className="mk-lamp" /><span className="mk-name">{name}</span>
              {landed && <span data-fx="lit" style={{ ...abs, inset: 0 }}>
                <span className="mk-lamp pd-litlamp" style={{ '--mk-l': lit.lamp, '--mk-lh': lit.hot, '--mk-lg': lit.halo } as CSSProperties} />
                {lose && <span className="mk-name pd-name-red">{name}</span>}
              </span>}
            </div>
            {landed && <>
              <div data-fx="tag" className={'pd-tag' + (call ? '' : ' none')} style={{ top: s.nameY - 30 }}>{call ? call.toUpperCase() : 'NO CALL'}</div>
              <div data-fx="scrawl" className={'pd-scrawl ' + (lose ? 'pd-red' : 'pd-green')} style={{ top: s.photoY + 4, fontSize: fs }}>{lose ? 'DRINKS' : 'CALLED IT'}</div>
            </>}
          </div>
        );
      })}

      <div className="mk-grit" style={{ opacity: .13, zIndex: 4 }} />
      <div style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 4, background: "url('/textures/grain.png') 0 0 / 256px 256px", opacity: .05 }} />
    </div>
  );
}
