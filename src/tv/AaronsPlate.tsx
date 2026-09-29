// TV-19 · Aaron's Plate (design "Aaron's Plate"), on the fixed 1920×1080 stage.
//   picking  the grill fires up over the balcony at golden hour; picks arrive as anonymous "? TAKEN" chips
//            (nobody learns who took which). The tell: the dirty one lies a little crooked, and a lone fly
//            keeps visiting it. Only the TV shows it.
//   served   everyone tucks in, fast then slower, to a heartbeat that speeds up; the spotlight flickers
//            between the last two; the last clean one goes; black; *gasp*; the dirty one is unmasked,
//            a hand reaches for it and turns to ash; the verdict strip: INTO THE QUEUE.
// All sound is synthesised on the TV's shared AudioContext.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { GameState, Plate, Player } from '../lib/types';
import type { Act } from './TvRoom';
import { initials, fmtClock } from '../lib/util';
import { audioCtx } from '../fx/sound';
import { useStageScale } from './Scenes';

const DIRTY_TILT = 13;                                              // degrees: just crooked enough to spot
const jitter = (i: number) => ((i * 53) % 13) - 6;
const CRUMBS = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * Math.PI * 2 + .4; return { s: 6 + (i % 3) * 3, dx: Math.round(Math.cos(a) * 90), dy: Math.round(Math.sin(a) * 60) }; });
const SMOKE = Array.from({ length: 8 }, (_, i) => ({ x: i * 150 + 20, y: (i * 97) % 300 }));
const ASH = Array.from({ length: 80 }, (_, i) => { const ember = i % 7 === 0; return { s: 4 + (i * 13) % 9, c: ember ? '#ff8a1e' : ['#2a2622', '#4a4540', '#1b1712', '#6b645c'][i % 4], g: ember ? '0 0 8px #ff8a1e' : 'none', dx: ((i * 71) % 160) - 110, dy: -120 - (i * 53) % 240 }; });
const HAND = 'M58 150 C54 110 56 60 62 30 C65 16 80 16 82 30 L86 120 L92 18 C94 2 112 2 113 18 L114 118 L122 26 C124 10 142 12 141 28 L138 126 L150 58 C153 44 170 46 168 62 L160 170 C158 200 156 222 150 246 L142 300 L150 760 L52 760 L60 300 C44 262 30 240 22 214 L6 160 C2 144 18 136 28 148 L46 182 Z';

// ---------------------------------------------------------------- sound
function snd() {
  const C = audioCtx();
  const buf = (dur: number) => { const b = C!.createBuffer(1, C!.sampleRate * dur, C!.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  const noise = (dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass', q = 1) => {
    if (!C) return; const t = C.currentTime, s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = buf(dur); f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f).connect(g).connect(C.destination); s.start(t);
  };
  const tone = (f: number, dur: number, type: OscillatorType, vol: number, slide?: number) => {
    if (!C) return; const t = C.currentTime, o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(C.destination); o.start(t); o.stop(t + dur + .05);
  };
  return {
    tone, noise,
    sizzle() {
      if (!C) return null; const s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
      s.buffer = buf(2); s.loop = true; f.type = 'highpass'; f.frequency.value = 3500; g.gain.value = .06; s.connect(f).connect(g).connect(C.destination); s.start(); return s;
    },
    sting() { [55, 55.8, 82.4].forEach(f => tone(f, 2.4, 'sawtooth', .12)); tone(1180, 1.6, 'sine', .05); tone(1250, 1.6, 'sine', .05); },
    crunch() { noise(.07, 1800 + Math.random() * 900, .7, 'bandpass', 1.4); noise(.05, 600, .4); },
    beat() { tone(62, .14, 'sine', .7, 40); setTimeout(() => tone(56, .12, 'sine', .45, 36), 170); },
    gasp() {
      if (!C) return; const t = C.currentTime, s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
      s.buffer = buf(.9); f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1400, t + .4);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.8, t + .12); g.gain.exponentialRampToValueAtTime(.001, t + .9);
      s.connect(f).connect(g).connect(C.destination); s.start(t); tone(90, .4, 'square', .25, 50);
    },
  };
}

function Face({ p }: { p?: Player }) {
  return p?.selfie_url
    ? <img src={p.selfie_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : <span className="ap-initials">{initials(p?.name ?? '?')}</span>;
}

export function PlateOverlay({ state, plate, act, now, onClose }: { state: GameState; plate: Plate; act: Act; now: () => number; onClose: () => void }) {
  const scale = useStageScale();
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const sizzle = useRef<AudioBufferSourceNode | null>(null);
  const closing = useRef(false);
  const open = plate.status === 'open';
  const mountedOpen = useRef(open);                                  // mounted after it was served → show the end state
  const S = useMemo(snd, []);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const n = plate.n;
  const cols = n <= 4 ? Math.max(2, n) : n <= 8 ? 4 : n <= 15 ? 5 : 6;
  const rows = Math.ceil(n / cols);
  const sw = Math.min(220, (1180 / cols) * .8), sh = sw * 56 / 220;   // sausage size
  const byIdx = new Map(Object.entries(plate.picks).map(([pid, i]) => [i, state.players.find(p => p.id === pid)]));
  const loser = state.players.find(p => p.id === plate.loser);
  const dirty = plate.dirty ?? -1;
  const left = Math.max(0, Date.parse(plate.ends_at) - now());
  const takenCount = Object.keys(plate.picks).length;
  const endState = !open && !mountedOpen.current;                     // no reveal to watch: draw it finished

  const q = (s: string, scope?: Element | null) => [...((scope ?? root.current)?.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`) ?? [])];
  const A = (els: string | (HTMLElement | undefined)[], kf: Keyframe[], o: KeyframeAnimationOptions & { stagger?: number }) =>
    (typeof els === 'string' ? q(els) : els).forEach((el, i) => el?.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)', ...o, delay: ((o.delay as number) || 0) + (o.stagger || 0) * i }));
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  const centerOf = (el?: Element | null) => {
    const r = root.current?.getBoundingClientRect(); if (!r || !el || !root.current) return { x: 0, y: 0 };
    const c = el.getBoundingClientRect(), k = root.current.offsetWidth / r.width;
    return { x: (c.left + c.width / 2 - r.left) * k, y: (c.top + c.height / 2 - r.top) * k };
  };
  useEffect(() => () => { timers.current.forEach(clearTimeout); try { sizzle.current?.stop(); } catch { /* ignore */ } }, []);

  // time's up → serve (the server fills in anyone who didn't pick)
  useEffect(() => {
    if (open && left <= 0 && !closing.current) { closing.current = true; act('bbq_close', { plate_id: plate.id }).catch(() => { closing.current = false; }); }
  });

  // ---- 1: fire up ----
  useLayoutEffect(() => {
    if (!open || reduced()) return;
    S.sting(); sizzle.current = S.sizzle();
    A('black', [{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-in' });
    A('smoke', [{ opacity: 1, transform: 'scale(2)' }, { opacity: 0, transform: 'scale(3) translateY(-160px)' }], { duration: 1600, stagger: 60, easing: 'ease-out' });
    A('grill', [{ transform: 'translateY(120px) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 200 });
    A('coals', [{ opacity: .6 }, { opacity: 1 }, { opacity: .8 }, { opacity: 1 }], { duration: 2200, iterations: Infinity, easing: 'ease-in-out', fill: 'none' });
    A('body', [{ transform: 'translateY(-70px) scale(1.25)', opacity: 0 }, { transform: 'translateY(6px) scale(.98)', opacity: 1, offset: .75 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 700, stagger: 70, easing: 'cubic-bezier(.5,0,.6,1.4)' });
    A('title', [{ opacity: 0, transform: 'translateY(-40px) scaleY(1.4)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translateY(6px) scaleY(.95)', filter: 'blur(0)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 900 });
    A('title', [{ transform: 'none' }, { transform: 'translateY(3px) skewX(-2deg)' }], { duration: 1600, delay: 1900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
    A('timer', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 1400 });
    later(2400, () => {                                               // the tell: a lone fly keeps visiting the crooked one
      const fly = q('fly')[0], cell = q('cell-dirty')[0], grill = q('grill')[0]; if (!fly || !cell || !grill) return;
      const g = centerOf(grill), c = centerOf(cell), x = c.x - g.x + 630, y = c.y - g.y + 300;
      fly.animate([
        { opacity: 0, transform: `translate(${x + 180}px,${y - 160}px)` }, { opacity: .9, transform: `translate(${x + 60}px,${y - 60}px)`, offset: .12 },
        { opacity: .9, transform: `translate(${x - 20}px,${y - 16}px)`, offset: .22 }, { opacity: .9, transform: `translate(${x + 14}px,${y - 30}px)`, offset: .3 },
        { opacity: .9, transform: `translate(${x - 8}px,${y + 12}px)`, offset: .38 }, { opacity: .9, transform: `translate(${x - 90}px,${y - 110}px)`, offset: .48 },
        { opacity: 0, transform: `translate(${x - 220}px,${y - 240}px)`, offset: .56 }, { opacity: 0, transform: `translate(${x - 220}px,${y - 240}px)` },
      ], { duration: 6000, iterations: Infinity });
      A('wing', [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.2)' }], { duration: 40, iterations: Infinity, direction: 'alternate', fill: 'none' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // picks arrive as anonymous chips
  const seen = useRef(new Set<number>(Object.values(plate.picks)));
  useEffect(() => {
    if (!open) return;
    const cells = q('cell').concat(q('cell-dirty')).sort((a, b) => +a.dataset.i! - +b.dataset.i!);
    Object.values(plate.picks).forEach(i => {
      if (seen.current.has(i)) return;
      seen.current.add(i);
      q('anon', cells[i])[0]?.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.15)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 300 });
      S.tone(660 + seen.current.size * 30, .08, 'triangle', .12);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenCount]);

  // ---- 2: served ----
  const revealed = useRef(false);
  useLayoutEffect(() => {
    if (open || revealed.current || endState) return;
    revealed.current = true;
    const cells = q('cell').concat(q('cell-dirty')).sort((a, b) => +a.dataset.i! - +b.dataset.i!);
    const bodies = cells.map(c => q('body', c)[0]);
    const dCell = cells[dirty];
    const finish = () => {
      A('anon', [{ opacity: 0 }], { duration: 1 }); A('who', [{ opacity: 1 }], { duration: 1 });
      bodies.forEach((b, i) => i !== dirty && b?.animate([{ clipPath: 'polygon(0 0,0 0,0 100%,0 100%)' }], { fill: 'both', duration: 1 }));
      A('dirt', [{ opacity: 1 }], { duration: 1 }); A('panel', [{ opacity: 1 }], { duration: 1 }); A('stamp', [{ opacity: 1 }], { duration: 1 }); A('close', [{ opacity: 1 }], { duration: 1 });
    };
    try { sizzle.current?.stop(); } catch { /* ignore */ }
    if (reduced() || !dCell) { finish(); return; }
    sizzle.current = S.sizzle();
    A('timer', [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
    A('fly', [{ opacity: 0 }], { duration: 200 });

    const unmask = (cell: HTMLElement, at: number) => {
      q('anon', cell).forEach(a => a.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'rotateX(90deg)' }], { duration: 140, delay: at - 160, fill: 'both', easing: 'ease-in' }));
      q('who', cell).forEach(w => w.animate([{ opacity: 0, transform: 'rotateX(-90deg)' }, { opacity: 1, transform: 'none' }], { duration: 160, delay: at - 20, fill: 'both', easing: 'ease-out' }));
    };
    const P = (x: number) => { const j = x >= 100 || x <= 0 ? 0 : 5; return `polygon(0% 0%, ${x}% 0%, ${x - j}% 14%, ${x}% 28%, ${x - j}% 42%, ${x}% 56%, ${x - j}% 70%, ${x}% 84%, ${x - j * .6}% 100%, 0% 100%)`; };
    const eat = (el: HTMLElement | undefined, cell: HTMLElement, at: number, dur: number) => {
      if (!el) return;
      el.animate([{ clipPath: P(100) }, { clipPath: P(100), offset: .06 }, { clipPath: P(66), offset: .1 }, { clipPath: P(66), offset: .4 }, { clipPath: P(33), offset: .44 }, { clipPath: P(33), offset: .74 }, { clipPath: P(0), offset: .78 }, { clipPath: P(0) }], { duration: dur, delay: at, fill: 'both', easing: 'linear' });
      el.animate([{ transform: 'none' }, { transform: 'scale(1.06,.9)', offset: .1 }, { transform: 'none', offset: .2 }, { transform: 'scale(1.06,.9)', offset: .44 }, { transform: 'none', offset: .54 }, { transform: 'scale(1.06,.9)', offset: .78 }, { transform: 'none' }], { duration: dur, delay: at });
      [.1, .44, .78].forEach(o => {
        q('crumb', cell).forEach((c, i) => c.animate([{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: 'translate(var(--dx),var(--dy)) rotate(200deg)' }], { duration: 380, delay: at + dur * o + i * 10, easing: 'cubic-bezier(.1,.8,.3,1)' }));
        later(at + dur * o, () => S.crunch());
      });
      unmask(cell, at);
      q('who', cell).forEach(w => w.animate([{ transform: 'none' }, { transform: 'scale(1.25) rotate(-6deg)' }, { transform: 'none' }], { duration: 220, delay: at + dur * .1, iterations: 3, fill: 'none' }));
    };

    // everyone tucks in: fast at first, then slower and slower. One clean sausage is saved for last.
    const clean = cells.map((_, i) => i).filter(i => i !== dirty);
    const last = clean.length ? clean.splice(Math.floor(Math.random() * clean.length), 1)[0] : -1;
    clean.sort(() => Math.random() - .5);
    let t = 500;
    clean.forEach((i, k) => { eat(bodies[i], cells[i], t, k < clean.length / 2 ? 360 : 560); t += 220 + (clean.length > 1 ? k / (clean.length - 1) : 0) * 580; });
    let bt = 300, gap = 900;                                         // a heartbeat that speeds up
    while (bt < t + 1500) { const at = bt; later(at, () => { q('vig')[0]?.animate([{ opacity: 0 }, { opacity: .9 }, { opacity: 0 }], { duration: 360 }); S.beat(); }); bt += gap; gap = Math.max(330, gap * .9); }
    A('stage', [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], { duration: t + 800, delay: 400, easing: 'ease-in', fill: 'forwards' });
    // two left: the spotlight flickers between them
    const spot = q('spot')[0], b = centerOf(dCell), a = last >= 0 ? centerOf(cells[last]) : b;
    const aim = (p: { x: number; y: number }) => { spot?.style.setProperty('--x', p.x + 'px'); spot?.style.setProperty('--y', p.y + 'px'); };
    later(t, () => { try { sizzle.current?.stop(); } catch { /* ignore */ } sizzle.current = null; });
    A('spot', [{ opacity: 0 }, { opacity: .75 }], { duration: 300, delay: t });
    [0, 180, 300, 520, 620, 760, 860].forEach((d, k) => later(t + d, () => aim(k % 2 ? b : a)));
    [last >= 0 ? bodies[last] : undefined, bodies[dirty]].forEach((el, k) => el?.animate([{ transform: 'none' }, { transform: 'translateX(-4px) rotate(-2deg)' }, { transform: 'translateX(4px) rotate(2deg)' }, { transform: 'none' }], { duration: 120, delay: t + k * 60, iterations: 7, fill: 'none' }));
    t += 1000;
    if (last >= 0) eat(bodies[last], cells[last], t, 330);
    t += 360;
    // silence, then the snap
    A('spot', [{ opacity: .75 }, { opacity: 1 }], { duration: 120, delay: t, fill: 'forwards' });
    later(t, () => aim(b));
    const SNAP = t + 420;
    A('black', [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 420, delay: t, easing: 'linear', fill: 'none' });
    later(SNAP, () => S.gasp());
    unmask(dCell, SNAP + 700);
    q('who', dCell).forEach(w => w.animate([{ transform: 'none', boxShadow: '0 0 0 1px #000' }, { transform: 'scale(1.5)', boxShadow: '0 0 0 3px #a4ff5a,0 0 30px rgba(164,255,90,.7)' }, { transform: 'scale(1.3)', boxShadow: '0 0 0 3px #a4ff5a,0 0 30px rgba(164,255,90,.7)' }], { duration: 500, delay: SNAP + 700, fill: 'forwards' }));
    later(SNAP + 700, () => S.tone(110, .5, 'sawtooth', .25, 70));
    A('stage', [{ transform: 'scale(1.06)' }, { transform: 'scale(1.1) translate(-8px,6px)' }, { transform: 'scale(1.1)' }], { duration: 260, delay: SNAP });
    A('gasp', [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1.05)', offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1500, delay: SNAP + 80, fill: 'none' });
    A('dirt', [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: SNAP + 300 });
    A([bodies[dirty]], [{ transform: 'none' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(3deg)' }], { duration: 300, delay: SNAP + 400, iterations: 4, direction: 'alternate', fill: 'forwards' });
    const stink = q('stink')[0]; if (stink) { stink.style.left = b.x + 'px'; stink.style.top = b.y + 'px'; }
    A('stink', [{ opacity: 0, transform: 'translateY(30px) scale(.7)' }, { opacity: .8, transform: 'translateY(-20px) scale(1.1)', offset: .5 }, { opacity: 0, transform: 'translateY(-60px) scale(1.3)' }], { duration: 1400, delay: SNAP + 500, easing: 'ease-out' });
    // a hand reaches in for it… and turns to ash on contact
    const hand = q('hand')[0], ang = -35, rad = ang * Math.PI / 180, ux = -Math.sin(rad), uy = Math.cos(rad);
    if (hand) { hand.style.left = b.x + 'px'; hand.style.top = (b.y - 10) + 'px'; }
    const H = SNAP + 1500, C = H + 1300;
    A('spot', [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: H - 200, fill: 'forwards' });
    A('hand', [{ opacity: 1, transform: `rotate(${ang}deg) translateY(900px)` }, { opacity: 1, transform: `rotate(${ang}deg) translateY(260px)`, offset: .45 }, { opacity: 1, transform: `rotate(${ang}deg) translateY(240px) rotate(2deg)`, offset: .7 }, { opacity: 1, transform: `rotate(${ang}deg) translateY(14px)` }], { duration: C - H, delay: H, easing: 'cubic-bezier(.3,.6,.4,1)' });
    A('hand', [{ transform: 'translateX(0)' }, { transform: 'translateX(3px)' }], { duration: 60, delay: H + 500, iterations: 14, direction: 'alternate', fill: 'none', composite: 'add' });
    later(H + 300, () => S.beat()); later(H + 900, () => S.beat());
    A('flash', [{ opacity: 0 }, { opacity: .8 }, { opacity: 0 }], { duration: 400, delay: C, fill: 'none' });
    A([bodies[dirty]], [{ filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 500, delay: C, fill: 'forwards' });
    A('stage', [{ transform: 'scale(1.1)' }, { transform: 'scale(1.1) translate(-10px,6px)' }, { transform: 'scale(1.1) translate(8px,-4px)' }, { transform: 'scale(1.1)' }], { duration: 300, delay: C, fill: 'forwards' });
    A('hand', [{ filter: 'drop-shadow(0 30px 30px rgba(0,0,0,.7))' }, { filter: 'brightness(.35) sepia(.4) drop-shadow(0 0 20px rgba(255,120,30,.8))', offset: .25 }, { filter: 'brightness(.18) grayscale(1)' }], { duration: 500, delay: C });
    A('hand', [{ clipPath: 'inset(0 -40px 0 -40px)' }, { clipPath: 'inset(100% -40px 0 -40px)' }], { duration: 1100, delay: C + 250, easing: 'ease-in' });
    q('ash').forEach((el, i) => {
      const f = (i % 40) / 40, along = f * 720, side = ((i * 37) % 100 - 50);
      el.style.left = (b.x + ux * along - uy * side * .9) + 'px'; el.style.top = (b.y + uy * along + ux * side * .9) + 'px';
      el.animate([{ opacity: 0, transform: 'translate(0,0)' }, { opacity: 1, transform: 'translate(0,-4px)', offset: .08 }, { opacity: 0, transform: 'translate(var(--dx),var(--dy)) rotate(260deg) scale(.4)' }], { duration: 1500 + (i % 5) * 200, delay: C + 250 + f * 1100, fill: 'both', easing: 'cubic-bezier(.2,.6,.4,1)' });
    });
    later(C, () => { S.noise(1.3, 3000, .5, 'highpass'); S.tone(80, .6, 'sawtooth', .3, 40); });
    for (let k = 0; k < 10; k++) later(C + 250 + k * 110, () => S.noise(.04, 2500 + Math.random() * 2000, .5, 'bandpass', 3));
    // the verdict strip
    const L = C + 1500;
    A('panel', [{ opacity: 0, transform: 'translateY(60px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: L });
    A('lface', [{ filter: 'none' }, { filter: 'sepia(.6) hue-rotate(50deg) saturate(1.6)' }], { duration: 1200, delay: L + 300 });
    A('stamp', [{ opacity: 0, transform: 'scale(3) rotate(-18deg)' }, { opacity: 1, transform: 'scale(.92) rotate(-5deg)', offset: .6 }, { opacity: 1, transform: 'rotate(-6deg)' }], { duration: 450, delay: L + 600, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    later(L + 650, () => { S.noise(.08, 2500, .8); S.tone(90, .3, 'square', .3, 50); });
    A('close', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: L + 1100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const eaten = 'polygon(0 0,0 0,0 100%,0 100%)';
  return (
    <div className="jr-ov ap-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="ap-root" data-fx="stage">
          <div className="ap-bg" /><div className="ap-warm" /><div className="ap-vig" />
          <div className="ap-head" data-fx="head">
            <div className="ap-kick">{open ? `Costa Adeje · the villa up the hill · ${fmtClock(now())}` : 'Costa Adeje · the villa up the hill · served'}</div>
            <div className="ap-title" data-fx="title">AARON'S PLATE</div>
            <div className="ap-sub">{open ? 'One of these fell on the balcony. Pick a sausage on your phone before they’re gone.' : 'Everyone tucks in… Aaron swears it’s fine.'}</div>
          </div>

          <div className="ap-grill" data-fx="grill">
            <div className="ap-coals" data-fx="coals" /><div className="ap-grate" />
            <div className="ap-cells" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gridTemplateRows: `repeat(${rows},minmax(0,${rows < 3 ? '170px' : '1fr'}))`, alignContent: 'center' }}>
              {Array.from({ length: n }, (_, i) => {
                const isDirty = i === dirty, who = byIdx.get(i), taken = byIdx.has(i);
                return (
                  <div key={i} className="ap-cell" data-fx={isDirty ? 'cell-dirty' : 'cell'} data-i={i}>
                    <div style={{ transform: `rotate(${isDirty ? DIRTY_TILT : jitter(i)}deg)` }}>
                      <div className="ap-body" data-fx="body" style={{ width: sw, height: sh, clipPath: endState && !isDirty ? eaten : undefined }}>
                        <i /><i /><i />
                        {isDirty && <div className="ap-dirt" data-fx="dirt" style={{ opacity: endState ? 1 : 0 }}><i style={{ width: 16, height: 11, left: '18%', top: '21%' }} /><i style={{ width: 10, height: 10, left: '55%', top: '57%' }} /><i style={{ width: 13, height: 8, left: '77%', top: '29%' }} /><i style={{ width: 6, height: 6, left: '40%', top: '36%' }} /></div>}
                      </div>
                    </div>
                    {CRUMBS.map((k, j) => <i key={j} className="ap-crumb" data-fx="crumb" style={{ width: k.s, height: k.s, ['--dx' as any]: k.dx + 'px', ['--dy' as any]: k.dy + 'px' }} />)}
                    <div className="ap-num">{i + 1}</div>
                    <div className="ap-chip anon" data-fx="anon" style={{ opacity: taken && !endState ? 1 : 0 }}><span>?</span>TAKEN</div>
                    <div className="ap-chip who" data-fx="who" style={{ opacity: endState && who ? 1 : 0 }}><span><Face p={who} /></span>{who?.name.toUpperCase() ?? '—'}</div>
                  </div>
                );
              })}
            </div>
            <div className="ap-fly" data-fx="fly"><span /><span data-fx="wing" /><span data-fx="wing" /></div>
            {SMOKE.map((s, i) => <div key={i} className="ap-smoke" data-fx="smoke" style={{ left: s.x, top: s.y }} />)}
          </div>

          {open && <div className="ap-timer" data-fx="timer"><span className="ap-secs">{Math.ceil(left / 1000)}s</span><span>{takenCount} / {n} TAKEN</span></div>}

          <div className="ap-spot" data-fx="spot" />
          <div className="ap-gasp" data-fx="gasp"><span className="a">*gasp*</span><span className="b">oh no…</span><span className="c">not that one</span></div>
          <div className="ap-stink" data-fx="stink" />
          <div className="ap-vigpulse" data-fx="vig" />
          <div className="ap-hand" data-fx="hand"><svg viewBox="0 0 200 760"><path d={HAND} fill="#c9a080" stroke="#1b1712" strokeWidth="5" strokeLinejoin="round" /><path d="M60 300 L142 300" stroke="#1b1712" strokeWidth="4" opacity=".4" /><path d="M70 320 L66 740 M100 330 L104 740" stroke="#1b1712" strokeWidth="2" opacity=".2" /></svg></div>
          {ASH.map((a, i) => <i key={i} className="ap-ash" data-fx="ash" style={{ width: a.s, height: a.s, background: a.c, boxShadow: a.g, ['--dx' as any]: a.dx + 'px', ['--dy' as any]: a.dy + 'px' }} />)}

        </div>
        <div className="ap-panel" data-fx="panel" style={{ opacity: endState ? 1 : 0 }}>
          {loser
            ? <>
                <div className="ap-lphoto"><div data-fx="lface" style={endState ? { filter: 'sepia(.6) hue-rotate(50deg) saturate(1.6)' } : undefined}><Face p={loser} /></div></div>
                <div className="ap-lname"><div>{loser.name.toUpperCase()}</div><div>GOT THE DIRTY SAUSAGE</div></div>
                <div className="ap-stamp" data-fx="stamp" style={{ opacity: endState ? 1 : 0 }}>INTO THE QUEUE</div>
              </>
            : <div className="ap-lname"><div>NOBODY</div><div>ATE IT. AARON'S DISAPPOINTED.</div></div>}
          <button className="ap-close" data-fx="close" style={{ opacity: endState ? 1 : 0 }} onClick={onClose}>CLOSE</button>
        </div>
        <div className="ap-black" data-fx="black" />
        <div className="ap-flash" data-fx="flash" />
        <div className="ap-grain" />
      </div>
    </div>
  );
}
