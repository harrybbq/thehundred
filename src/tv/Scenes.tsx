// Full-screen TV scenes from the designs (TV-14 … TV-18), on a fixed 1920×1080 stage scaled to the screen.
// Each plays its film clip from /assets when the file is there (with the clip's own sound), and falls back
// to a drawn version with synthesised sound when it isn't, so a missing clip never breaks the night.
//   HolyNovaScene  the Angel's Holy Nova (inarius.mp4)       LockerScene   Davy Jones' Locker (davy-jones.mp4)
//   ShameScene     Judge Dredd's Walk of Shame (dredd.mp4)   BlessedScene  the Angel blesses the wheel (mercy.mp4)
//   ShurikenScene  the Ninja's silent strike (drawn only)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { initials } from '../lib/util';
import { Sound, audioCtx, cues, soundEnabled } from '../fx/sound';
import { preloadTextures } from '../lib/textures';

// ---------------------------------------------------------------- shared
export function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1920, innerHeight / 1080));
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);
  return scale;
}

// One <video> per clip for the whole session, preloaded early (preloadClips) and reused every time the
// scene plays, so the film is already buffered when its moment comes (the timeline runs on the clock;
// a clip still downloading would fall out of sync with it).
const CLIPS = new Map<string, { el: HTMLVideoElement; ok: Promise<boolean> }>();
const h264 = () => !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
function clip(src: string) {
  let c = CLIPS.get(src);
  if (!c) {
    const el = document.createElement('video');
    el.preload = 'auto'; el.playsInline = true; el.muted = true;
    const ok = !h264() ? Promise.resolve(false) : new Promise<boolean>(res => {
      el.addEventListener('canplaythrough', () => res(true), { once: true });
      el.addEventListener('error', () => { res(false); CLIPS.delete(src); }, { once: true });   // missing (the SPA answers with index.html): try again next time
      el.src = src; el.load();
    });
    c = { el, ok };
    CLIPS.set(src, c);
  }
  return c;
}
/** Start downloading every film clip and baked texture (the TV calls this when a room opens). */
export function preloadClips() { ['/assets/inarius.mp4', '/assets/davy-jones.mp4', '/assets/dredd.mp4', '/assets/mercy.mp4'].forEach(clip); preloadTextures(); }


/** Is the clip ready to play through? Waits up to 8s, then the scene plays its drawn version instead. */
function useClip(src: string) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let dead = false;
    const c = clip(src);
    if (c.el.readyState >= 4) { setOk(true); return; }
    c.ok.then(v => { if (!dead) setOk(o => o ?? v); });
    const t = setTimeout(() => { if (!dead) setOk(o => o ?? false); }, 8000);
    return () => { dead = true; clearTimeout(t); };
  }, [src]);
  return ok;
}

/** Mounts the shared, preloaded <video> for `src` here (inside a display:contents wrapper). */
function Clip({ src, vidRef, className, fx: fxName }: { src: string; vidRef: { current: HTMLVideoElement | null }; className: string; fx?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = clip(src).el;
    el.className = className;
    if (fxName) el.dataset.fx = fxName; else delete el.dataset.fx;
    host.current?.appendChild(el);
    vidRef.current = el;
    return () => { el.pause(); el.getAnimations().forEach(a => a.cancel()); el.remove(); if (vidRef.current === el) vidRef.current = null; };
  }, [src, className, fxName, vidRef]);
  return <span ref={host} style={{ display: 'contents' }} />;
}

/** Play a clip from `from` seconds, with sound when the TV's sound is on (muted if the browser refuses). */
function playClip(v: HTMLVideoElement | null | undefined, from = 0) {
  if (!v) return;
  v.currentTime = from; v.muted = !soundEnabled(); v.volume = 1;
  v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
}

type Opts = KeyframeAnimationOptions & { stagger?: number };
function fx(root: HTMLElement | null) {
  const q = (s: string) => [...(root?.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`) ?? [])];
  const A = (s: string, kf: Keyframe[], o: Opts) => q(s).forEach((el, i) =>
    el.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)', ...o, delay: ((o.delay as number) || 0) + (o.stagger || 0) * i }));
  return { q, A };
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const POP: Keyframe[] = [{ opacity: 0, transform: 'scale(.2) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1.18) rotate(4deg)', offset: .6 }, { opacity: 1, transform: 'scale(.95) rotate(-2deg)', offset: .8 }, { opacity: 1, transform: 'none' }];

// tiny synth kit on the TV's shared AudioContext
function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = .3, at = 0, slide?: number) {
  const C = audioCtx(); if (!C) return;
  const t = C.currentTime + at, o = C.createOscillator(), g = C.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(C.destination); o.start(t); o.stop(t + dur + .05);
}
function noise(dur: number, freq: number, vol = .4, at = 0) {
  const C = audioCtx(); if (!C) return;
  const t = C.currentTime + at, b = C.createBuffer(1, C.sampleRate * dur, C.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(C.destination); s.start(t);
}
function choir(at: number, notes: number[], vol: number, len: number) {
  const C = audioCtx(); if (!C) return;
  const t = C.currentTime + at, lp = C.createBiquadFilter(), g = C.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 2000;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .4); g.gain.setValueAtTime(vol, t + len - 1.2); g.gain.linearRampToValueAtTime(0, t + len);
  lp.connect(g).connect(C.destination);
  notes.forEach(fr => [-7, 0, 7].forEach(dt => { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + len); }));
}
function bells(at: number, freqs: number[], step: number, vol = .18) { freqs.forEach((f, i) => tone(f, 1.6, 'sine', vol, at + i * step)); }

function Photo({ p, className = '' }: { p?: Player; className?: string }) {
  return p?.selfie_url
    ? <img className={'jr-photo ' + className} src={p.selfie_url} alt={p.name} draggable={false} />
    : <div className={'jr-photo jr-blank ' + className}>{initials(p?.name ?? '?')}</div>;
}
/** Runs the timeline once we know whether the clip is there; calls onDone after `total(ok)` ms.
 *  `run` may return [total, cleanup] so its own timers and sounds stop if the scene is closed early. */
function useTimeline(ok: boolean | null, run: (ok: boolean) => number | [number, () => void], onDone: () => void) {
  useLayoutEffect(() => {
    if (ok === null) return;
    const r = run(ok), [total, stop] = Array.isArray(r) ? r : [r, undefined];
    const t = setTimeout(onDone, total);
    return () => { clearTimeout(t); stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);
}

// ================================================================ TV-14 · HOLY NOVA
const WINDOWS = [[150, 420, 120], [170, 520, 60], [190, 600, 0], [190, 600, 0], [170, 520, 60], [150, 420, 120]];
const STREAKS = Array.from({ length: 48 }, (_, i) => ({ a: i * 7.5 + (i % 3) * 2.3, off: 40 + (i * 37) % 120, len: 260 + (i * 53) % 340, h: i % 4 === 0 ? 8 : 4 }));
const SHADOWS = [[240, 520, 260], [520, 640, 200], [1180, 650, 210], [1450, 520, 260], [90, 780, 230], [1610, 790, 230], [760, 820, 180], [1010, 830, 170], [380, 330, 170], [1380, 320, 170]]
  .map(([x, y, s]) => { const cx = x + s / 2 - 960, cy = y + s / 2 - 432, m = Math.hypot(cx, cy) || 1; return { x, y, s, bx: Math.round(cx / m * 420), by: Math.round(cy / m * 420) }; });
const FEATHERS = Array.from({ length: 16 }, (_, i) => 80 + (i * 263) % 1760);

export function HolyNovaScene({ angel, n, tally, target, onDone }: { angel?: Player; n: number; tally: number; target: number; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null), count = useRef<HTMLElement>(null), vid = useRef<HTMLVideoElement>(null);
  const scale = useStageScale();
  const ok = useClip('/assets/inarius.mp4');
  const before = Math.max(0, tally - n);
  const pct = (x: number) => Math.min(100, (x / target) * 100);
  useTimeline(ok, clip => {
    const { A } = fx(root.current);
    const HIT = clip ? 6600 : 1500;
    if (reduced()) { if (count.current) count.current.textContent = String(tally); A('dark', [{ opacity: 0 }], { duration: 1 }); return 3000; }
    if (count.current) count.current.textContent = String(before);
    const ts: number[] = [];
    if (clip) {
      playClip(vid.current, 0);
      const v = vid.current!;
      const cut = setInterval(() => { if (v.currentTime >= 9.5) v.volume = Math.max(0, 1 - (v.currentTime - 9.5) / .5); if (v.currentTime >= 10) { v.pause(); clearInterval(cut); } }, 30);
      ts.push(window.setTimeout(() => clearInterval(cut), 12000));
      A('stage', [{ transform: 'none' }, { transform: 'translate(-12px,8px)' }, { transform: 'translate(10px,-6px)' }, { transform: 'none' }], { duration: 420, delay: 2350, fill: 'none' });
      A('stage', [{ transform: 'none' }, { transform: 'translate(-8px,6px)' }, { transform: 'translate(6px,-4px)' }, { transform: 'none' }], { duration: 360, delay: 3650, fill: 'none' });
      A('inarius', [{ filter: 'none', transform: 'none' }, { filter: 'blur(7px) brightness(.58) sepia(.25)', transform: 'scale(1.03)' }], { duration: 900, delay: HIT });
      A('lbox', [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: HIT });
    } else {
      // no clip: a cathedral, shadows gathering round a charging orb, then the blast throws them back
      A('window', [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
      A('shadow', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 100, stagger: 40 });
      A('orb', [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(2.5)' }], { duration: HIT, easing: 'cubic-bezier(.6,0,.9,.5)' });
      A('shadow', [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(var(--bx),var(--by)) scale(.4) rotate(40deg)' }], { duration: 700, delay: HIT, easing: 'cubic-bezier(.2,.8,.3,1)' });
      A('streak', [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: 900, delay: HIT, stagger: 6 });
      A('orb', [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: HIT });
      // charge → boom → choir → shimmer bells
      noise(1.4, 1200, .35);
      ts.push(window.setTimeout(() => { tone(120, .9, 'sine', .9, 0, 35); choir(0, [261.6, 329.6, 392, 523.3, 659.3], .12, 3.8); bells(.1, [1568, 2093, 2637, 3136], .18); }, HIT));
    }
    A('dark', [{ opacity: 1 }, { opacity: 0 }], { duration: 500 });
    A('flash', [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .6, offset: .4 }, { opacity: 0 }], { duration: 1200, delay: HIT - 200, easing: 'ease-out' });
    A('stage', [{ transform: 'none' }, { transform: 'translate(-20px,12px) scale(1.03)' }, { transform: 'translate(18px,-10px) scale(1.02)' }, { transform: 'translate(-10px,6px)' }, { transform: 'none' }], { duration: 600, delay: HIT, easing: 'linear', fill: 'none' });
    A('rays', [{ opacity: 0, transform: 'scale(.15) rotate(0)' }, { opacity: 1, transform: 'scale(1.1) rotate(25deg)', offset: .25 }, { opacity: .8, transform: 'scale(1) rotate(80deg)' }], { duration: 3200, delay: HIT, easing: 'cubic-bezier(.1,.8,.3,1)' });
    A('ring', [{ opacity: 1, transform: 'scale(.1)' }, { opacity: 0, transform: 'scale(6)' }], { duration: 1400, delay: HIT, stagger: 220, easing: 'cubic-bezier(.1,.7,.3,1)' });
    A('angel', [{ opacity: 0, transform: 'translateY(60px) scale(.7)' }, { opacity: 1, transform: 'translateY(-10px) scale(1.05)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 800, delay: HIT + 150 });
    A('kick', [{ opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.3em' }], { duration: 700, delay: HIT + 350 });
    A('title', [{ opacity: 0, transform: 'scale(1.8)', filter: 'blur(20px)' }, { opacity: 1, transform: 'scale(.97)', filter: 'blur(0)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 800, delay: HIT + 400 });
    A('plus', POP, { duration: 600, delay: HIT + 1000, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    A('tally', [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: HIT + 1300 });
    A('gain', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: HIT + 1600, easing: 'cubic-bezier(.3,.8,.3,1)' });
    A('feather', [{ opacity: 0, transform: 'translateY(0) rotate(0)' }, { opacity: .9, offset: .15 }, { opacity: 0, transform: 'translateY(1150px) rotate(300deg)' }], { duration: 3400, delay: HIT + 200, stagger: 110, easing: 'cubic-bezier(.3,.1,.7,1)' });
    A('halo', [{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)' }], { duration: 1200, delay: HIT + 900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
    for (let i = 1; i <= n; i++) ts.push(window.setTimeout(() => { if (count.current) count.current.textContent = String(before + i); }, HIT + 1600 + i * (900 / n)));
    return HIT + 3600;
  }, onDone);

  return (
    <div className="jr-ov sc-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="hn2-stage" data-fx="stage">
          <div className="hn2-windows">{WINDOWS.map(([w, h, t], i) => <div key={i} className="hn2-window" data-fx="window" style={{ width: w, height: h, marginTop: t }} />)}</div>
          <div className="hn2-floor" />
          {ok && <Clip src="/assets/inarius.mp4" vidRef={vid} fx="inarius" className="sc-video" />}
          {ok && <div className="hn2-lbox" data-fx="lbox" />}
          <div className="hn2-rays" data-fx="rays" />
          <div className="hn2-streaks">{STREAKS.map((s, i) => <div key={i} className="hn2-streak" data-fx="streak" style={{ width: s.len, height: s.h, transform: `rotate(${s.a}deg) translateX(${s.off}px)` }} />)}</div>
          {SHADOWS.map((d, i) => (
            <div key={i} className="hn2-shadow" data-fx="shadow" style={{ left: d.x, top: d.y, width: d.s, height: d.s, ['--bx' as any]: d.bx + 'px', ['--by' as any]: d.by + 'px' }}>
              <i className="body" /><i className="horn l" /><i className="horn r" /><span className="eyes"><b style={{ width: d.s * .1 }} /><b style={{ width: d.s * .1 }} /></span>
            </div>
          ))}
          {[0, 1, 2].map(i => <div key={i} className="hn2-ring" data-fx="ring" />)}
          <div className="hn2-angel" data-fx="angel">
            <div className="hn2-halo" data-fx="halo" />
            <div className="hn2-arch"><Photo p={angel} /></div>
          </div>
          <div className="hn2-orb" data-fx="orb" />
          <div className="hn2-words">
            <div className="hn2-kick" data-fx="kick">{(angel?.name ?? 'The Angel').toUpperCase()} raises the light</div>
            <div className="hn2-title" data-fx="title">Holy Nova</div>
            <div className="hn2-plus" data-fx="plus">+{n} BEERS</div>
          </div>
          <div className="hn2-tally" data-fx="tally">
            <div className="row"><span>THE TALLY IS BLESSED</span><span><b ref={count}>{tally}</b> / {target}</span></div>
            <div className="bar"><div className="in">
              <div className="old" style={{ width: pct(before) + '%' }} />
              <div className="gain" data-fx="gain" style={{ left: pct(before) + '%', width: pct(tally) - pct(before) + '%' }} />
            </div></div>
          </div>
          {FEATHERS.map((x, i) => <div key={i} className="hn2-feather" data-fx="feather" style={{ left: x }} />)}
        </div>
        <div className="sc-dark" data-fx="dark" />
        <div className="hn2-flash" data-fx="flash" />
        <div className="jr-grain top" />
      </div>
    </div>
  );
}

// ================================================================ TV-15 · DAVY JONES' LOCKER (approved mockup: design/mockups/Locker.dc.html)
// SENTENCED TO THE DEEP. The film (davy-jones.mp4 from 4.9s, gated and grained) plays in the Flying Dutchman's brass window;
// the victim's polaroid hangs beside it on a chain running down into the dark. When Davy falls in the film the chain snaps
// taut and drags the photo under; the camera dives past the broken keel to the sea bed where the Locker waits open and
// glowing. The photo drops in, the lid SLAMS, a lantern lights their face behind a bar, a chain whips round, a padlock drops,
// then SENTENCED TO THE DEEP / NAME / N MINUTES / RELEASED IN (live). Data: the victim and `until` only. The same scene plays
// whether the host approved a rest or the Davy Jones role locked them: never who did it.
const djRnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const f1 = (v: number) => +v.toFixed(1);
const DJ = (() => {
  const rivets: { x: number; y: number }[] = [];
  for (let x = 420; x <= 1020; x += 67) rivets.push({ x, y: 175 }, { x, y: 655 });
  for (let a = -90; a <= 90; a += 22.5) { const r = a * Math.PI / 180; rivets.push({ x: f1(1045 + Math.cos(r) * 240), y: f1(415 + Math.sin(r) * 240) }, { x: f1(395 - Math.cos(r) * 240), y: f1(415 + Math.sin(r) * 240) }); }
  const edge: [number, number][] = []; for (let x = 0; x <= 1920; x += 48) edge.push([x, f1(985 + (djRnd(x, 30) - .5) * 26 + (djRnd(Math.floor(x / 240), 31) - .5) * 30)]);
  const clip = 'polygon(0 0,1920px 0,' + edge.slice().reverse().map(([x, y]) => `${x}px ${y}px`).join(',') + ')';
  const strands = (k: number, len: number, w: number) => { let d = ''; edge.forEach(([x, y], i) => { const n = 1 + Math.floor(djRnd(i, k) * 3); for (let j = 0; j < n; j++) { const cx = x + djRnd(i * 7 + j, k + 1) * 48, L = len * (djRnd(i * 5 + j, k + 2) ** 1.6) * (djRnd(Math.floor(x / 300), k + 3) > .35 ? 1 : .25), ww = w * (.6 + djRnd(i + j, k + 4)); if (L < 10) continue; const bend = (djRnd(i + j * 3, k + 5) - .5) * 30; d += `M${f1(cx - ww)} ${y - 4} Q${f1(cx + bend)} ${f1(y + L * .6)} ${f1(cx + bend * .6)} ${f1(y + L)} Q${f1(cx + bend * .4)} ${f1(y + L * .5)} ${f1(cx + ww)} ${y - 4} Z`; } }); return d; };
  return {
    rivets, keel: { clip, edge: 'M' + edge.map(([x, y]) => `${x} ${y}`).join(' L'), weed: strands(40, 190, 14), weed2: strands(50, 90, 9) },
    snow: Array.from({ length: 100 }, (_, i) => ({ x: f1(djRnd(i, 1) * 1920), y: f1(djRnd(i, 2) * 2400), r: f1(1 + djRnd(i, 3) * 2.2), o: f1(.12 + djRnd(i, 4) * .3) })),
    farSnow: Array.from({ length: 50 }, (_, i) => ({ x: f1(djRnd(i, 5) * 1920), y: f1(djRnd(i, 6) * 1740), r: f1(.8 + djRnd(i, 7) * 1.4), o: f1(.08 + djRnd(i, 8) * .18) })),
    barn: Array.from({ length: 26 }, (_, i) => { const cl = [[60, 940], [1500, 930], [1860, 700], [30, 260], [1880, 180], [760, 950]][i % 6]; return { x: f1(cl[0] + (djRnd(i, 9) - .5) * 70), y: f1(cl[1] + (djRnd(i, 10) - .5) * 40), r: f1(4 + djRnd(i, 11) * 7) }; }),
    bubA: Array.from({ length: 18 }, (_, i) => ({ x: f1(1360 + djRnd(i, 12) * 440), y: f1(860 + djRnd(i, 13) * 260), s: f1(10 + djRnd(i, 14) * 30), dx: f1((djRnd(i, 15) - .5) * 120), dy: f1(900 + djRnd(i, 16) * 400) })),
    bubB: Array.from({ length: 14 }, (_, i) => ({ x: f1(120 + djRnd(i, 17) * 700), y: f1(380 + djRnd(i, 18) * 80), s: f1(8 + djRnd(i, 19) * 26), dx: f1((djRnd(i, 20) - .5) * 160), dy: f1(420 + djRnd(i, 21) * 260) })),
    puffs: Array.from({ length: 10 }, (_, i) => { const side = i % 2 ? 1 : -1; return { x: f1(side > 0 ? 780 + djRnd(i, 22) * 60 : 160 + djRnd(i, 22) * 60), y: f1(930 + djRnd(i, 23) * 20), s: f1(90 + djRnd(i, 24) * 90), dx: f1(side * (80 + djRnd(i, 25) * 160)), dy: f1(-20 - djRnd(i, 26) * 80) }; }),
  };
})();
const DJ_CLIP0 = 4.9, DJ_P = 8800;
const djFmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function DjFace({ p }: { p?: Player }) {
  return p?.selfie_url ? <img className="ph" src={p.selfie_url} alt={p.name} draggable={false} /> : <div className="ph ini">{initials(p?.name ?? '?')}</div>;
}
function DjAnchor() {
  return <svg viewBox="0 0 40 44" width="36" height="40" style={{ verticalAlign: -6 }} aria-hidden="true"><g fill="none" stroke="#b8a57e" strokeWidth="4.5" strokeLinecap="round"><circle cx="20" cy="7" r="4.5" /><path d="M20 12 V40 M11 19 H29 M5 28 Q7 40 20 40 Q33 40 35 28" /></g></svg>;
}

export function LockerScene({ victim, until, onDone }: { victim?: Player; until: string | null; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null), vid = useRef<HTMLVideoElement>(null), clockEl = useRef<HTMLSpanElement>(null);
  const scale = useStageScale();
  const ok = useClip('/assets/davy-jones.mp4');
  const [t0] = useState(() => Date.now());
  const secsLeft = until ? Math.max(0, Math.round((Date.parse(until) - t0) / 1000)) : 0;
  const minutes = Math.max(1, Math.ceil(secsLeft / 60 - .05));
  const name = (victim?.name ?? '?').toUpperCase();
  // names: one line up to the width; a two-word name that would get too small goes on two lines
  const cw = .52, oneFs = (s: string, w: number, max: number) => Math.floor(Math.min(max, w / (Math.max(1, s.length) * cw)));
  const film1 = { fs: oneFs(name, 1100, 150), y: 752 };
  let end1 = { lines: [name], fs: oneFs(name, 864, 190) };
  const words = name.split(' ');
  if (end1.fs < 130 && words.length > 1) {
    let best: typeof end1 | null = null;
    for (let i = 1; i < words.length; i++) { const L = [words.slice(0, i).join(' '), words.slice(i).join(' ')]; const fs = Math.min(...L.map(l => oneFs(l, 864, 112))); if (!best || fs > best.fs) best = { lines: L, fs }; }
    if (best && best.fs > end1.fs) end1 = best;
  }
  const end1y = Math.round(356 + (200 - end1.lines.length * end1.fs * .86) / 2);
  const polFs = Math.min(44, Math.floor(262 / (name.length * .52)));

  // the live release clock (text only, never an animation)
  useEffect(() => {
    const paint = () => { if (clockEl.current) clockEl.current.textContent = djFmt(Math.max(0, secsLeft - Math.floor((Date.now() - t0) / 1000))); };
    paint(); const iv = setInterval(paint, 250); return () => clearInterval(iv);
  }, [secsLeft, t0]);
  // long lines shrink to their boxes once the fonts are in
  useLayoutEffect(() => {
    let dead = false;
    document.fonts.ready.then(() => {
      if (dead || !root.current) return;
      root.current.querySelectorAll<HTMLElement>('[data-fit]').forEach(el => { let fs = parseFloat(el.style.fontSize); const min = el.classList.contains('nm') ? 16 : 40; while (el.scrollWidth > el.clientWidth + 1 && fs > min) { fs -= 2; el.style.fontSize = fs + 'px'; } });
    });
    return () => { dead = true; };
  }, [name]);

  useTimeline(ok, clip => {
    const el = root.current; if (!el) return 3000;
    if (reduced()) return 4200;                                     // the DOM's own styles are the settled end frame
    const q = (s: string) => [...el.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`)], one = (s: string) => q(s)[0];
    const D = DJ_P;
    const tl = (e: Element | undefined, frames: [number, Keyframe, string?][]) => {
      if (!e) return;
      const kf: Keyframe[] = frames.map(([t, p, ez]) => ({ ...p, offset: Math.min(1, Math.max(0, t / D)), ...(ez ? { easing: ez } : {}) }));
      if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
      if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
      e.animate(kf, { duration: D, fill: 'both' });
    };
    const tf = (v: string) => ({ transform: v }), op = (v: number) => ({ opacity: v });
    const OUT = 'cubic-bezier(.2,.8,.3,1)', IN = 'cubic-bezier(.6,0,.9,.5)', IO = 'cubic-bezier(.65,0,.35,1)';
    // ---- 0-2200: the film in the window
    tl(one('dark'), [[0, op(1), 'ease-out'], [550, op(0)]]);
    tl(el, [[8400, op(1), 'ease-in'], [8800, op(0)]]);                  // the whole scene fades: the flooded card on the board shows through
    tl(one('view'), [[0, { opacity: 0, transform: 'scale(.93)' }, OUT], [700, { opacity: 1, transform: 'scale(1)' }]]);
    tl(one('kick'), [[150, { opacity: 0, transform: 'translateY(-18px)' }, OUT], [650, { opacity: 1, transform: 'none' }], [2700, { opacity: 1, transform: 'none' }, 'ease-in'], [2900, { opacity: 0, transform: 'none' }]]);
    tl(one('hang'), [[350, tf('translateY(-720px)'), 'cubic-bezier(.3,1.25,.5,1)'], [1050, tf('translateY(0px)')]]);
    tl(one('sway'), [[950, tf('rotate(-3deg)'), 'ease-in-out'], [1350, tf('rotate(2.2deg)'), 'ease-in-out'], [1700, tf('rotate(-1deg)'), 'ease-in-out'], [2000, tf('rotate(0deg)')]]);
    tl(one('cap'), [[500, { opacity: 0, transform: 'translateY(20px)' }, OUT], [850, { opacity: 1, transform: 'none' }], [2250, { opacity: 1, transform: 'none' }, IN], [2550, { opacity: 0, transform: 'translateY(50px)' }]]);
    tl(one('bigname'), [[650, { opacity: 0, transform: 'scale(1.18)' }, OUT], [1000, { opacity: 1, transform: 'scale(1)' }], [2250, { opacity: 1, transform: 'scale(1)' }, IN], [2550, { opacity: 0, transform: 'translateY(80px) scale(.96)' }]]);
    tl(one('vflash'), [[680, op(0), 'ease-out'], [750, op(.3)], [1200, op(0)]]);
    tl(one('flash'), [[680, op(0), 'ease-out'], [750, op(.36)], [1250, op(0)]]);
    one('fgrain')?.animate([{ transform: 'translate(0px,0px)' }, { transform: 'translate(-60px,40px)' }, { transform: 'translate(30px,-70px)' }, { transform: 'translate(-90px,-20px)' }, { transform: 'translate(0px,0px)' }], { duration: 333, iterations: Math.ceil(3700 / 333), easing: 'steps(1,end)' });
    // ---- 2200 THE FALL: the chain below snaps taut, the photo jolts, the top chain snaps
    tl(one('topChain'), [[2200, { transform: 'translateY(0px)', opacity: 1 }, 'cubic-bezier(.2,.9,.3,1)'], [2520, { transform: 'translateY(-420px)', opacity: 0 }]]);
    tl(one('ringT'), [[2200, op(1)], [2320, op(0)]]);
    tl(one('ringB'), [[3700, op(1)], [3850, op(0)]]);
    tl(one('lowChain'), [[3700, op(1)], [3850, op(0)]]);
    tl(one('polVis'), [[0, op(1)], [4000, op(1), 'steps(1,end)'], [4010, op(0)]]);
    tl(one('pol'), [[2200, tf('translate(0px,0px) rotate(0deg) scale(1)'), 'ease-out'], [2270, tf('translate(0px,-34px) rotate(3deg) scale(1)'), IN],
      [2550, tf('translate(-60px,220px) rotate(-8deg) scale(.97)'), 'linear'], [3000, tf('translate(-420px,700px) rotate(7deg) scale(.9)'), 'linear'],
      [3400, tf('translate(-850px,1150px) rotate(-5deg) scale(.83)'), 'ease-out'], [3750, tf('translate(-1110px,1320px) rotate(8deg) scale(.78)'), IN],
      [4000, tf('translate(-1130px,1529px) rotate(8deg) scale(.78)')]]);
    tl(one('shake'), [[2200, tf('none'), 'linear'], [2250, tf('translate(-10px,6px)'), 'linear'], [2320, tf('translate(8px,-5px)'), 'linear'], [2400, tf('translate(-3px,2px)'), 'linear'], [2480, tf('none')],
      [4300, tf('none'), 'linear'], [4340, tf('translate(-22px,14px)'), 'linear'], [4410, tf('translate(18px,-10px)'), 'linear'], [4490, tf('translate(-9px,6px)'), 'linear'], [4570, tf('translate(4px,-2px)'), 'linear'], [4650, tf('none')]]);
    // ---- 2550-3700 the camera dives; the far layer at half speed
    tl(one('world'), [[2550, tf('translateY(0px)'), IO], [3700, tf('translateY(-1320px)')]]);
    tl(one('far'), [[2550, tf('translateY(0px)'), IO], [3700, tf('translateY(-660px)')]]);
    q('bubA').forEach((b, i) => { const s = 2280 + i * 55, dx = +b.dataset.dx!, dy = +b.dataset.dy!; tl(b, [[s, { opacity: 0, transform: 'translate(0px,0px)' }, 'linear'], [s + 120, { opacity: .85, transform: `translate(0px,${-dy * .08}px)` }, 'ease-in'], [s + 1500, { opacity: 0, transform: `translate(${dx}px,${-dy}px)` }]]); });
    // ---- the Locker, open and glowing; 4000 the photo drops in; 4150-4300 THE LID SLAMS
    tl(one('openGlow'), [[0, op(1)], [4150, op(1), 'ease-in'], [4310, op(0)]]);
    tl(one('lidIn'), [[4150, tf('scaleY(1)'), 'cubic-bezier(.7,0,1,.6)'], [4300, tf('scaleY(0)')]]);
    tl(one('lidFront'), [[4150, { opacity: 0, transform: 'translateY(-280px)' }, 'steps(1,end)'], [4160, { opacity: 1, transform: 'translateY(-270px)' }, 'cubic-bezier(.7,0,1,.6)'],
      [4300, { opacity: 1, transform: 'translateY(0px)' }, 'ease-out'], [4350, { opacity: 1, transform: 'translateY(-8px)' }, 'ease-in'], [4410, { opacity: 1, transform: 'translateY(0px)' }]]);
    q('puff').forEach((p, i) => { const dx = +p.dataset.dx!, dy = +p.dataset.dy!; tl(p, [[4300, { opacity: 0, transform: 'translate(0px,0px) scale(.3)' }, 'ease-out'], [4390, { opacity: .7, transform: `translate(${dx * .3}px,${dy * .3}px) scale(.8)` }, 'ease-out'], [5200 + i * 30, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.7)` }]]); });
    q('bubB').forEach((b, i) => { const s = 4310 + i * 45, dx = +b.dataset.dx!, dy = +b.dataset.dy!; tl(b, [[s, { opacity: 0, transform: 'translate(0px,0px)' }, 'linear'], [s + 100, { opacity: .8, transform: `translate(0px,${-dy * .08}px)` }, 'ease-in'], [s + 1500, { opacity: 0, transform: `translate(${dx}px,${-dy}px)` }]]); });
    // 4420 the lantern catches: their face behind the bar
    tl(one('win'), [[4420, op(0), 'steps(1,end)'], [4470, op(.75), 'steps(1,end)'], [4530, op(.2), 'steps(1,end)'], [4600, op(1)]]);
    tl(one('winGlow'), [[4420, op(0), 'steps(1,end)'], [4470, op(.8), 'steps(1,end)'], [4530, op(.25), 'steps(1,end)'], [4600, op(1)]]);
    // 4500-4800 the chain whips round; 4800-4950 the padlock drops and swings to rest by 5500
    tl(one('chainL'), [[4500, tf('scaleX(0)'), 'cubic-bezier(.2,.9,.3,1.1)'], [4760, tf('scaleX(1)')]]);
    tl(one('chainR'), [[4540, tf('scaleX(0)'), 'cubic-bezier(.2,.9,.3,1.1)'], [4800, tf('scaleX(1)')]]);
    tl(one('lock'), [[4800, { opacity: 0, transform: 'translateY(-300px) rotate(0deg)' }, IN], [4950, { opacity: 1, transform: 'translateY(0px) rotate(0deg)' }, 'ease-out'],
      [5050, { opacity: 1, transform: 'translateY(0px) rotate(14deg)' }, 'ease-in-out'], [5190, { opacity: 1, transform: 'translateY(0px) rotate(-8deg)' }, 'ease-in-out'],
      [5320, { opacity: 1, transform: 'translateY(0px) rotate(4deg)' }, 'ease-in-out'], [5420, { opacity: 1, transform: 'translateY(0px) rotate(-1.5deg)' }, 'ease-in-out'], [5500, { opacity: 1, transform: 'translateY(0px) rotate(0deg)' }]]);
    // ---- the words
    tl(one('title'), [[5150, { opacity: 0, transform: 'scale(1.5)' }, 'cubic-bezier(.5,0,.9,.4)'], [5300, { opacity: 1, transform: 'scale(.97)' }, 'ease-out'], [5390, { opacity: 1, transform: 'scale(1)' }]]);
    tl(one('name'), [[5350, { opacity: 0, transform: 'translateY(46px)' }, OUT], [5700, { opacity: 1, transform: 'none' }]]);
    tl(one('rule'), [[5500, tf('scaleX(0)'), OUT], [5850, tf('scaleX(1)')]]);
    tl(one('label'), [[5500, { opacity: 0, transform: 'translateY(-14px)' }, OUT], [5900, { opacity: 1, transform: 'none' }]]);
    tl(one('mins'), [[5750, { opacity: 0, transform: 'scale(1.35)' }, 'cubic-bezier(.5,0,.9,.4)'], [5900, { opacity: 1, transform: 'scale(.98)' }, 'ease-out'], [5990, { opacity: 1, transform: 'scale(1)' }]]);
    tl(one('rel'), [[6050, { opacity: 0, transform: 'translateY(14px)' }, OUT], [6350, { opacity: 1, transform: 'none' }]]);
    tl(one('rules'), [[6300, { opacity: 0, transform: 'translateY(12px)' }, OUT], [6650, { opacity: 1, transform: 'none' }]]);
    one('caustic')?.animate([{ transform: 'translateX(0px)' }, { transform: 'translateX(180px)' }], { duration: 6000, iterations: 2, easing: 'linear' });
    // ---- the film rolls from 4.9s with the timeline; its own sound fades 3000-3400, then it stops (the camera has left)
    const ts: number[] = [];
    let fade = 0;
    if (clip) {
      playClip(vid.current, DJ_CLIP0);
      ts.push(window.setTimeout(() => { const v = vid.current; if (!v) return; fade = window.setInterval(() => { v.volume = Math.max(0, v.volume - .15); if (!v.volume) clearInterval(fade); }, 60); }, 3000));
      ts.push(window.setTimeout(() => vid.current?.pause(), 3400));
    }
    // ---- the sound, on the beats
    const hush = cues([[0, () => Sound.clang()], [350, () => Sound.ratchet(1, .7, 10)], [700, () => Sound.whoosh(.6, false, .1)],
      [2200, () => { Sound.clang(); Sound.ratchet(1, .25, 5); }], [2280, Sound.splash], [2550, () => Sound.whoosh(1.1, false, .25)],
      [4000, Sound.plop], [4300, () => { Sound.boom(); Sound.thud(); }], [4500, () => Sound.ratchet(1, .3, 8)], [4950, Sound.clang],
      [5150, Sound.stamp], [5750, Sound.stamp], [8400, () => Sound.whoosh(.4, true, .15)]]);
    return [DJ_P, () => { hush(); ts.forEach(clearTimeout); clearInterval(fade); }];
  }, onDone);

  const d = DJ;
  return (
    <div className="jr-ov sc-ov dj-ov">
      <div className="jr-stage lk-stage" style={{ transform: `scale(${scale})` }}>
        <div ref={root} className="dj-root">
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <defs>
              <pattern id="dj-plank" width="512" height="96" patternUnits="userSpaceOnUse"><image href="/textures/wood-plank.png" width="512" height="96" /></pattern>
              <pattern id="dj-chV" width="24" height="44" patternUnits="userSpaceOnUse">
                <ellipse cx="12" cy="11" rx="7.5" ry="12" fill="none" stroke="#070a0b" strokeWidth="7" /><ellipse cx="12" cy="11" rx="7.5" ry="12" fill="none" stroke="#8a989c" strokeWidth="3" />
                <rect x="8.5" y="19" width="7" height="28" rx="3.5" fill="#56646a" stroke="#070a0b" strokeWidth="2.5" /><rect x="10.5" y="22" width="2" height="20" rx="1" fill="#b9c6c9" opacity=".6" />
              </pattern>
              <pattern id="dj-chH" width="44" height="24" patternUnits="userSpaceOnUse">
                <ellipse cx="11" cy="12" rx="12" ry="7.5" fill="none" stroke="#070a0b" strokeWidth="7" /><ellipse cx="11" cy="12" rx="12" ry="7.5" fill="none" stroke="#8a989c" strokeWidth="3" />
                <rect x="19" y="8.5" width="28" height="7" rx="3.5" fill="#56646a" stroke="#070a0b" strokeWidth="2.5" /><rect x="22" y="10.5" width="20" height="2" rx="1" fill="#b9c6c9" opacity=".6" />
              </pattern>
              <linearGradient id="dj-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dccfae" /><stop offset=".45" stopColor="#9c8656" /><stop offset="1" stopColor="#3e3220" /></linearGradient>
              <linearGradient id="dj-iron" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1a2226" /><stop offset=".45" stopColor="#5d6a6e" /><stop offset="1" stopColor="#1f292d" /></linearGradient>
              <linearGradient id="dj-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd9a0" stopOpacity=".12" /><stop offset=".35" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#050302" stopOpacity=".72" /></linearGradient>
              <linearGradient id="dj-inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#140a04" /><stop offset=".5" stopColor="#4a2410" /><stop offset="1" stopColor="#d07a2a" /></linearGradient>
              <radialGradient id="dj-gold" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#f6ecc4" /><stop offset=".5" stopColor="#d0aa5a" /><stop offset="1" stopColor="#6a4c1a" /></radialGradient>
            </defs>
          </svg>

          <div data-fx="shake" className="dj-layer">
            <div data-fx="far" className="dj-far">
              <svg viewBox="0 0 1920 1740" width="1920" height="1740" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                <g fill="#05232a" opacity=".9" transform="translate(0 120)"><path d="M1180 1620 L1260 1330 L1300 1335 L1250 1620 Z" /><path d="M1090 1400 L1450 1440 L1446 1452 L1088 1412 Z" /><path d="M1480 1620 Q1560 1470 1700 1440 Q1820 1420 1920 1450 L1920 1620 Z" /></g>
                {d.farSnow.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#bfeee8" opacity={s.o} />)}
              </svg>
            </div>

            <div data-fx="world" className="dj-world">
              <div className="dj-water" />
              <svg viewBox="0 0 1920 2400" width="1920" height="2400" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                <path d="M300 0 H420 L200 1000 H40 Z M880 0 H960 L1010 1000 H860 Z M1500 0 H1620 L1880 1000 H1690 Z" fill="#9fe6de" opacity=".05" />
                {d.snow.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cff5ef" opacity={s.o} />)}
              </svg>
              {/* TOP: the hull, its broken keel and its weed */}
              <div className="dj-hull" style={{ clipPath: d.keel.clip }} />
              <svg viewBox="0 0 1920 1300" width="1920" height="1300" style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden="true">
                <path d={d.keel.edge} fill="none" stroke="#050302" strokeWidth="16" strokeLinejoin="round" />
                <path d={d.keel.weed} fill="#04130f" /><path d={d.keel.weed2} fill="#0a2a20" />
                {d.barn.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#7d8a80" stroke="#0a0f0c" strokeWidth="2.5" opacity=".7" />)}
              </svg>
              <div data-fx="view" style={{ position: 'absolute', left: 0, top: 0, width: 1440, height: 1000, transformOrigin: '720px 415px' }}>
                <div className="dj-rim" />
                {d.rivets.map((r, i) => <i key={i} className="dj-rivet" style={{ left: r.x, top: r.y }} />)}
                <div className="dj-glass">
                  {ok ? <Clip src="/assets/davy-jones.mp4" vidRef={vid} className="dj-video" /> : <div className="dj-deep" />}
                  <div className="dj-grade" />
                  <div data-fx="fgrain" className="dj-fgrain" />
                  <div className="dj-halo" />
                  <div data-fx="vflash" style={{ position: 'absolute', inset: 0, background: '#dffcf6', opacity: 0 }} />
                  <div className="dj-gate" />
                  <div className="dj-sheen" />
                </div>
                <div data-fx="cap" className="dj-cap" style={{ top: 706 }}>Down to the Locker goes…</div>
                <div data-fx="bigname" data-fit className="dj-bigname" style={{ top: film1.y, fontSize: film1.fs }}>{name}</div>
              </div>

              {/* BOTTOM: the sea bed (world y 1320-2400) */}
              <div className="dj-bed">
                <div data-fx="caustic" className="dj-caustic" />
                <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(300px 0,640px 0,960px 900px,-20px 900px)', background: 'linear-gradient(180deg,rgba(190,245,235,.07),rgba(190,245,235,.1) 50%,rgba(190,245,235,.02))' }} />
                <div style={{ position: 'absolute', left: -60, top: 540, width: 1060, height: 540, background: 'radial-gradient(ellipse 50% 42% at 50% 62%,rgba(255,160,60,.2),transparent 70%)' }} />
                <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                  <path d="M0 902 Q120 880 260 896 Q420 914 560 900 Q720 884 880 902 Q1060 920 1240 900 Q1420 884 1600 900 Q1760 914 1920 896 V1080 H0 Z" fill="#26352e" />
                  <path d="M0 940 Q200 926 420 944 Q700 962 980 944 Q1300 924 1600 946 Q1780 958 1920 944 V1080 H0 Z" fill="#1c2a24" />
                  <g stroke="#3a4c40" strokeWidth="3" fill="none" opacity=".7"><path d="M40 980 Q180 968 320 982" /><path d="M960 990 Q1120 976 1280 992" /><path d="M1440 1010 Q1600 996 1760 1012" /><path d="M620 1030 Q760 1018 900 1032" /></g>
                  <g transform="translate(930 930)">
                    <path d="M-80 10 L-20 -2" stroke="#0a0c0a" strokeWidth="16" strokeLinecap="round" /><path d="M-80 10 L-20 -2" stroke="#9c9886" strokeWidth="9" strokeLinecap="round" />
                    <path d="M-24 -10 Q-26 -44 0 -46 Q26 -44 24 -10 L16 -2 H-16 Z" fill="#aaa692" stroke="#0a0c0a" strokeWidth="4" />
                    <circle cx="-9" cy="-22" r="6" fill="#0a0c0a" /><circle cx="9" cy="-22" r="6" fill="#0a0c0a" />
                  </g>
                </svg>
              </div>

              {/* THE LOCKER, back layer: its glow and the open lid's inside face */}
              <div className="dj-chest">
                <div data-fx="openGlow" style={{ position: 'absolute', left: 120, top: 360, width: 760, height: 420, opacity: 0, background: 'radial-gradient(ellipse 50% 45% at 50% 62%,rgba(255,190,90,.75),rgba(255,140,40,.22) 55%,transparent 75%)' }} />
                <svg data-fx="lidIn" className="dj-part" viewBox="0 0 1020 1080" style={{ transform: 'scaleY(0)', transformOrigin: '500px 610px' }} aria-hidden="true">
                  <path d="M228 330 H772 L800 610 H200 Z" fill="url(#dj-plank)" stroke="#0a0604" strokeWidth="6" strokeLinejoin="round" />
                  <path d="M228 330 H772 L800 610 H200 Z" fill="url(#dj-inner)" opacity=".86" />
                  <path d="M270 330 L258 610 M730 330 L742 610" stroke="url(#dj-iron)" strokeWidth="26" />
                  <g fill="url(#dj-gold)"><circle cx="300" cy="596" r="12" /><circle cx="340" cy="602" r="9" /><circle cx="620" cy="598" r="11" /><circle cx="690" cy="602" r="8" /><circle cx="470" cy="600" r="10" /></g>
                </svg>
              </div>

              {/* the polaroid: hangs by the window; a slack chain runs from it down into the black */}
              <div data-fx="hang" style={{ position: 'absolute', left: 1450, top: 260, width: 300, height: 362 }}>
                <div data-fx="sway" style={{ position: 'absolute', inset: 0, transformOrigin: '150px -260px' }}>
                  <svg data-fx="topChain" viewBox="0 0 24 300" width="24" height="300" style={{ position: 'absolute', left: 138, top: -298 }} aria-hidden="true"><rect width="24" height="300" fill="url(#dj-chV)" /></svg>
                  <div data-fx="polVis" style={{ position: 'absolute', inset: 0, opacity: 0 }}>
                    <div data-fx="pol" style={{ position: 'absolute', inset: 0, transformOrigin: '150px 181px' }}>
                      <svg data-fx="lowChain" viewBox="0 0 24 2200" width="24" height="2200" style={{ position: 'absolute', left: 138, top: 360, WebkitMaskImage: 'linear-gradient(180deg,#000 30%,transparent 92%)', maskImage: 'linear-gradient(180deg,#000 30%,transparent 92%)' }} aria-hidden="true"><rect width="24" height="2200" fill="url(#dj-chV)" /></svg>
                      <div className="dj-pol"><DjFace p={victim} /><div className="nm" data-fit style={{ fontSize: polFs }}>{name}</div></div>
                      <i data-fx="ringT" className="dj-ring" style={{ top: -22 }} />
                      <i data-fx="ringB" className="dj-ring" style={{ top: 354 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* THE LOCKER, front layer */}
              <div className="dj-chest">
                <svg className="dj-part" viewBox="0 0 1020 1080" aria-hidden="true">
                  <rect x="200" y="606" width="600" height="340" fill="url(#dj-plank)" /><rect x="200" y="606" width="600" height="340" fill="url(#dj-shade)" />
                  <path d="M200 720 H800 M200 834 H800" stroke="#0a0604" strokeWidth="3" opacity=".55" />
                  <rect x="200" y="606" width="600" height="340" fill="none" stroke="#0a0604" strokeWidth="6" />
                  <rect x="252" y="606" width="34" height="340" fill="url(#dj-iron)" stroke="#070a0b" strokeWidth="3" /><rect x="714" y="606" width="34" height="340" fill="url(#dj-iron)" stroke="#070a0b" strokeWidth="3" />
                  <rect x="200" y="910" width="600" height="30" fill="url(#dj-iron)" stroke="#070a0b" strokeWidth="3" />
                  <g fill="url(#dj-brass)" stroke="#050302" strokeWidth="4">
                    <path d="M196 606 H262 V640 H230 V672 H196 Z" /><path d="M804 606 H738 V640 H770 V672 H804 Z" /><path d="M196 948 H262 V914 H230 V882 H196 Z" /><path d="M804 948 H738 V914 H770 V882 H804 Z" />
                  </g>
                  <g fill="#9aa6a9" stroke="#070a0b" strokeWidth="2"><circle cx="269" cy="660" r="5" /><circle cx="269" cy="760" r="5" /><circle cx="269" cy="860" r="5" /><circle cx="731" cy="660" r="5" /><circle cx="731" cy="760" r="5" /><circle cx="731" cy="860" r="5" /></g>
                  <g fill="#7d8a80" stroke="#0a0f0c" strokeWidth="2.5" opacity=".8"><circle cx="330" cy="900" r="9" /><circle cx="348" cy="912" r="6" /><circle cx="660" cy="660" r="7" /><circle cx="780" cy="820" r="8" /></g>
                  <path d="M184 740 v60 M816 740 v60" stroke="#070a0b" strokeWidth="16" strokeLinecap="round" /><path d="M184 740 v60 M816 740 v60" stroke="#5d6a6e" strokeWidth="8" strokeLinecap="round" />
                  <g fill="#0a2a20" stroke="#04130f" strokeWidth="3"><path d="M206 946 Q180 860 214 780 Q226 870 222 946 Z" /><path d="M796 946 Q820 870 790 800 Q780 880 782 946 Z" /></g>
                </svg>
                <div style={{ position: 'absolute', left: 400, top: 715, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#123238,#040c0e 70%)', boxShadow: 'inset 0 0 30px #000' }} />
                <div data-fx="winGlow" className="dj-winglow" />
                <div data-fx="win" className="dj-win"><DjFace p={victim} /><div className="warm" /><div className="bar" /><div className="shine" /></div>
                <div className="dj-winrim" />
                <svg data-fx="lidFront" className="dj-part" viewBox="0 0 1020 1080" aria-hidden="true">
                  <path d="M190 616 V574 Q190 516 256 516 H744 Q810 516 810 574 V616 Z" fill="url(#dj-plank)" />
                  <path d="M190 616 V574 Q190 516 256 516 H744 Q810 516 810 574 V616 Z" fill="url(#dj-shade)" />
                  <path d="M190 616 V574 Q190 516 256 516 H744 Q810 516 810 574 V616 Z" fill="none" stroke="#0a0604" strokeWidth="6" />
                  <rect x="252" y="518" width="34" height="98" fill="url(#dj-iron)" /><rect x="714" y="518" width="34" height="98" fill="url(#dj-iron)" />
                  <rect x="186" y="598" width="628" height="20" fill="url(#dj-brass)" stroke="#050302" strokeWidth="4" />
                  <path d="M320 516 Q360 506 400 516" stroke="#0a2a20" strokeWidth="10" fill="none" strokeLinecap="round" />
                </svg>
                <svg data-fx="chainL" viewBox="0 0 340 24" width="340" height="24" style={{ position: 'absolute', left: 164, top: 596, transformOrigin: '0 12px' }} aria-hidden="true"><rect width="340" height="24" fill="url(#dj-chH)" /></svg>
                <svg data-fx="chainR" viewBox="0 0 340 24" width="340" height="24" style={{ position: 'absolute', left: 500, top: 596, transformOrigin: '340px 12px' }} aria-hidden="true"><rect width="340" height="24" fill="url(#dj-chH)" /></svg>
                <div data-fx="lock" style={{ position: 'absolute', left: 452, top: 590, width: 96, height: 130, transformOrigin: '48px 12px' }}>
                  <svg viewBox="0 0 96 130" width="96" height="130" aria-label="padlock">
                    <path d="M24 56 V32 Q24 8 48 8 Q72 8 72 32 V56" fill="none" stroke="#070a0b" strokeWidth="18" /><path d="M24 56 V32 Q24 8 48 8 Q72 8 72 32 V56" fill="none" stroke="#8a989c" strokeWidth="9" />
                    <rect x="6" y="50" width="84" height="74" rx="10" fill="url(#dj-brass)" stroke="#050302" strokeWidth="5" /><path d="M14 60 H82" stroke="#f2ead2" strokeWidth="3" opacity=".5" />
                    <circle cx="48" cy="82" r="9" fill="#1a0e02" /><path d="M44 86 H52 L50 104 H46 Z" fill="#1a0e02" />
                  </svg>
                </div>
                <svg className="dj-part" viewBox="0 0 1020 1080" aria-hidden="true"><path d="M150 960 Q240 924 340 936 Q500 952 660 934 Q760 924 860 956 Q700 976 500 972 Q300 976 150 960 Z" fill="#26352e" /></svg>
                {d.puffs.map((p, i) => <div key={i} data-fx="puff" data-dx={p.dx} data-dy={p.dy} style={{ position: 'absolute', left: p.x, top: p.y, width: p.s, height: p.s, margin: `-${p.s / 2}px 0 0 -${p.s / 2}px`, borderRadius: '50%', background: 'radial-gradient(circle,rgba(44,60,50,.55),rgba(34,48,40,.25) 55%,transparent 72%)', opacity: 0 }} />)}
              </div>
            </div>

            {/* THE END CARD (screen space; the right column is title-safe: x 960-1824) */}
            <div data-fx="label" className="dj-label">Davy Jones' Locker</div>
            <div style={{ position: 'absolute', left: 900, top: 160, width: 1000, height: 820, background: 'radial-gradient(ellipse 55% 50% at 50% 50%,rgba(1,10,12,.55),transparent 75%)', pointerEvents: 'none' }} />
            <div data-fx="title" data-fit className="dj-col dj-title" style={{ top: 236, fontSize: 104 }}>Sentenced to the Deep</div>
            <div data-fx="name" data-fit className="dj-col dj-name" style={{ top: end1y, fontSize: end1.fs }}>{end1.lines.map((l, i) => <div key={i}>{l}</div>)}</div>
            <div data-fx="rule" className="dj-rule" />
            <div data-fx="mins" data-fit className="dj-col dj-mins" style={{ top: 608, fontSize: 150 }}>{minutes} MINUTE{minutes === 1 ? '' : 'S'}</div>
            <div data-fx="rel" className="dj-col dj-rel" style={{ top: 762 }}>RELEASED IN <span ref={clockEl}>{djFmt(secsLeft)}</span></div>
            <div data-fx="rules" data-fit className="dj-col dj-rules" style={{ top: 848, fontSize: 28 }}>NO MOVES<i>·</i>NO VOTE<i>·</i>PUNISHMENTS WAIT</div>

            {d.bubA.map((b, i) => <div key={'a' + i} data-fx="bubA" data-dx={b.dx} data-dy={b.dy} className="dj-bub" style={{ left: b.x, top: b.y, width: b.s, height: b.s }} />)}
            {d.bubB.map((b, i) => <div key={'b' + i} data-fx="bubB" data-dx={b.dx} data-dy={b.dy} className="dj-bub" style={{ left: b.x, top: b.y, width: b.s, height: b.s }} />)}
          </div>

          <div data-fx="kick" className="dj-kick" style={{ opacity: 0 }}><DjAnchor /> DAVY JONES' LOCKER <DjAnchor /></div>
          <div className="dj-vig" />
          <div className="dj-grain" />
          <div data-fx="flash" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, background: 'radial-gradient(ellipse 60% 60% at 38% 38%,rgba(225,255,250,.75),rgba(150,220,215,.25) 55%,transparent 80%)' }} />
          <div data-fx="dark" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: '#000', opacity: ok === null ? 1 : 0 }} />
        </div>
      </div>
    </div>
  );
}

// ================================================================ TV-16 · WALK OF SHAME
const CHART = [["6'6", 0], ["6'0", 88], ["5'6", 176], ["5'0", 264], ["4'6", 352], ["4'0", 440]] as const;
const SPLATS = [[20, 30, -20], [150, 120, 30], [60, 180, 10]];
const TOMATOES = [[120, 820, 750, -520], [1760, 800, -760, -440], [200, 980, 680, -560]];
const CROWD = Array.from({ length: 22 }, (_, i) => ({ w: 110 + (i * 23) % 50, h: 170 + (i * 41) % 80 }));
const CHANTS = [{ r: -10, l: 110, t: 240 }, { r: 6, l: 1360, t: 240 }, { r: -4, l: 110, t: 540 }];
const DREDD_FROM = 21.4, DREDD_LEN = 1.6;

export function ShameScene({ victim, caption, onDone }: { victim?: Player; caption: string; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null), vid = useRef<HTMLVideoElement>(null);
  const scale = useStageScale();
  const ok = useClip('/assets/dredd.mp4');
  const citizen = String(1000 + ((victim?.seat ?? 4) * 377) % 9000).slice(-4);
  useTimeline(ok, clip => {
    const { A, q } = fx(root.current);
    if (reduced()) { ['sh-chart', 'sh-splat', 'sh-shame', 'sh-stamp'].forEach(s => A(s, [{ opacity: 1 }], { duration: 1 })); return 3500; }
    const ts: number[] = [];
    if (clip && vid.current) vid.current.currentTime = DREDD_FROM;          // cue the line now so it's buffered by the time it's needed
    A('sh-kick', [{ opacity: 0, letterSpacing: '.8em' }, { opacity: 1, letterSpacing: '.2em' }], { duration: 600, delay: 100 });
    A('sh-bell', [{ transform: 'rotate(-22deg)' }, { transform: 'rotate(22deg)' }], { duration: 300, iterations: 2, direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
    // the walk: in from the left, one heavy bob per step
    A('sh-walker', [{ transform: 'translateX(-1300px)' }, { transform: 'translateX(0)' }], { duration: 2000, delay: 300, easing: 'linear' });
    A('sh-bob', [{ transform: 'translateY(0) rotate(-3deg)' }, { transform: 'translateY(-24px) rotate(0)', offset: .5 }, { transform: 'translateY(0) rotate(3deg)' }], { duration: 400, delay: 300, iterations: 5, direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
    A('sh-crowd', [{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }], { duration: 220, iterations: 24, direction: 'alternate', stagger: 37, fill: 'none' });
    A('sh-chart', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 2300 });
    A('sh-caption', [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay: 2400, easing: 'steps(18,jump-end)' });
    for (let i = 0; i < 5; i++) ts.push(window.setTimeout(() => noise(.09, 180, .7), 300 + i * 400 + 200));        // footsteps
    [3300, 3900, 4500].forEach((d, i) => {
      q('sh-shame')[i]?.animate(POP, { duration: 380, delay: d, fill: 'both', easing: 'cubic-bezier(.3,1.6,.5,1)' });
      q('sh-bell')[0]?.animate([{ transform: 'rotate(-26deg)' }, { transform: 'rotate(26deg)' }, { transform: 'rotate(0)' }], { duration: 500, delay: d, fill: 'none' });
      q('sh-tomato')[i]?.animate([{ opacity: 1, transform: 'translate(0,0) rotate(0) scale(.6)' }, { opacity: 1, transform: 'translate(var(--dx),var(--dy)) rotate(540deg) scale(1)' }], { duration: 380, delay: d - 380, fill: 'none', easing: 'cubic-bezier(.4,0,.8,.6)' });
      q('sh-splat')[i]?.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.3,.8)', offset: .4 }, { opacity: 1, transform: 'scale(1)' }], { duration: 300, delay: d, fill: 'both' });
      q('sh-stage')[0]?.animate([{ transform: 'none' }, { transform: 'translate(-8px,5px)' }, { transform: 'none' }], { duration: 160, delay: d, fill: 'none' });
      ts.push(window.setTimeout(() => { tone(392, 2, 'sine', .35); tone(784, 1.4, 'sine', .12); tone(1177, .9, 'triangle', .08); noise(.12, 900, .6); }, d));
    });
    // lights cut to a red spotlight and the Judge delivers the line
    const LAW = 5200, OUT = 7000;
    A('sh-law', [{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: OUT - LAW + 300, delay: LAW, easing: 'linear', fill: 'none' });
    A('sh-lawkick', [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: LAW + 100, fill: 'none' });
    A('sh-word', [{ opacity: 0, transform: 'scale(2.6) translateY(-40px)', filter: 'blur(8px)' }, { opacity: 1, transform: 'scale(.94)', filter: 'blur(0)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 260, delay: LAW + 90, stagger: 190, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    [0, 1, 2, 3].forEach(i => q('sh-stage')[0]?.animate([{ transform: 'none' }, { transform: 'translate(-10px,6px)' }, { transform: 'none' }], { duration: 140, delay: LAW + 160 + i * 190 }));
    A('sh-monitor', [{ opacity: 0, transform: 'scale(.6) rotate(-6deg)', filter: 'brightness(4)' }, { opacity: 1, transform: 'scale(1.03) rotate(1deg)', filter: 'brightness(1.5)', offset: .6 }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 400, delay: LAW, fill: 'backwards' });
    A('sh-rec', [{ opacity: 1 }, { opacity: .2 }], { duration: 400, iterations: 6, direction: 'alternate', delay: LAW, fill: 'none' });
    if (clip) ts.push(window.setTimeout(() => {
      const v = vid.current; if (!v) return;
      playClip(v, DREDD_FROM);
      const stop = setInterval(() => { if (v.currentTime >= DREDD_FROM + DREDD_LEN) { v.pause(); clearInterval(stop); } }, 30);
    }, LAW));
    else [0, 1, 2, 3].forEach(i => ts.push(window.setTimeout(() => { tone(70, .35, 'sawtooth', .35, 0, 45); noise(.1, 300, .5); }, LAW + 160 + i * 190)));
    A('sh-stamp', [{ opacity: 0, transform: 'scale(3.4) rotate(-20deg)' }, { opacity: 1, transform: 'scale(.92) rotate(-11deg)', offset: .6 }, { opacity: 1, transform: 'rotate(-12deg)' }], { duration: 450, delay: OUT, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    ts.push(window.setTimeout(() => { noise(.08, 2500, .8); tone(90, .3, 'square', .3, 0, 50); }, OUT + 50));
    return OUT + 1900;
  }, onDone);

  return (
    <div className="jr-ov sc-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="sh2-stage" data-fx="sh-stage">
          <div className="sh2-rain" /><div className="sh2-floor" /><div className="sh2-cone" />
          <div className="sh2-bell" data-fx="sh-bell"><i className="rope" /><i className="cup" /><i className="clap" /></div>
          <div className="sh2-kick" data-fx="sh-kick">BY ORDER OF JUDGE DREDD</div>
          <div className="sh2-chart" data-fx="sh-chart">{CHART.map(([l, y]) => <div key={l} style={{ top: y }}><span>{l}</span><span>{l}</span></div>)}</div>
          <div className="sh2-walker" data-fx="sh-walker">
            <div className="sh2-bob" data-fx="sh-bob">
              <Photo p={victim} />
              <div className="nm">{victim?.name.toUpperCase()}</div>
              {SPLATS.map(([x, y, r], i) => <div key={i} className="sh2-splat" data-fx="sh-splat" style={{ left: x, top: y, transform: `rotate(${r}deg)` }} />)}
              <div className="sh2-plate"><div className="c">CITIZEN</div><div className="n">{victim?.name.toUpperCase()} · {citizen}</div></div>
            </div>
          </div>
          {TOMATOES.map(([x, y, dx, dy], i) => <div key={i} className="sh2-tomato" data-fx="sh-tomato" style={{ left: x, top: y, ['--dx' as any]: dx + 'px', ['--dy' as any]: dy + 'px' }} />)}
          <div className="sh2-caption" data-fx="sh-caption">“{caption}”</div>
          {CHANTS.map((c, i) => <div key={i} className="sh2-shame" data-fx="sh-shame" style={{ left: c.l, top: c.t, transform: `rotate(${c.r}deg)` }}>SHAME!</div>)}
          <div className="sh2-crowd">{CROWD.map((c, i) => <div key={i} data-fx="sh-crowd" style={{ width: c.w, height: c.h }}><i /><b /><span><u /><u /></span></div>)}</div>
          <div className="sh2-law" data-fx="sh-law">
            <div className="cone" />
            <div className="sh2-monitor" data-fx="sh-monitor">
              <div className="screen">
                {ok ? <Clip src="/assets/dredd.mp4" vidRef={vid} className="sh2-dredd" />
                    : <svg className="sh2-helmet" viewBox="0 0 200 220"><path d="M20 120 C20 40 60 10 100 10 C140 10 180 40 180 120 L170 170 L130 150 L70 150 L30 170 Z" fill="#1a1a1e" stroke="#e0b458" strokeWidth="4" /><path d="M40 95 L160 95 L150 128 L50 128 Z" fill="#b01e10" /><path d="M85 10 L100 -6 L115 10" fill="#e0b458" /><rect x="70" y="150" width="60" height="50" rx="10" fill="#d9b48a" /><path d="M80 182 Q100 172 120 182" stroke="#5a2a14" strokeWidth="5" fill="none" /></svg>}
                <div className="scan" />
                <div className="live"><span data-fx="sh-rec" />JUDGE · LIVE</div>
              </div>
            </div>
            <div className="words">
              <div className="k" data-fx="sh-lawkick">THE JUDGE HAS SPOKEN</div>
              <div className="w">{['I', 'AM', 'THE', 'LAW.'].map(w => <span key={w} data-fx="sh-word">{w}</span>)}</div>
            </div>
          </div>
          <div className="sh2-stamp" data-fx="sh-stamp">DRINK.</div>
        </div>
        <div className="jr-grain top" />
      </div>
    </div>
  );
}

// ================================================================ TV-18 · BLESSED
const INKS: [string, string][] = [['#c9861f', '#0d0b09'], ['#1d4d52', '#f1e8d4'], ['#d8ccb0', '#0d0b09'], ['#8e2a1a', '#f1e8d4'], ['#3a4a50', '#f1e8d4'], ['#b3601a', '#0d0b09']];
const SPARKS = Array.from({ length: 26 }, (_, i) => { const a = i / 26 * Math.PI * 2, r = 180 + (i * 53) % 220; return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r), s: 6 + (i % 4) * 3 }; });

export function BlessedScene({ angel, segments, index, from, onDone }: { angel?: Player; segments: string[]; index: number; from: string; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null), vid = useRef<HTMLVideoElement>(null);
  const scale = useStageScale();
  const ok = useClip('/assets/mercy.mp4');
  const n = Math.max(2, segments.length), A0 = 360 / n, R = 400, ti = Math.max(0, index);
  const P = (a: number, r: number) => [Math.round(Math.cos(a * Math.PI / 180) * r), Math.round(Math.sin(a * Math.PI / 180) * r)];
  const wedge = (i: number) => { const a0 = -90 - A0 / 2 + (i - ti) * A0, a1 = a0 + A0, [x0, y0] = P(a0, R), [x1, y1] = P(a1, R); return { d: `M0 0 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`, mid: a0 + A0 / 2 }; };
  const segs = segments.map((t, i) => { const [fill, ink] = /^\s*safe\b/i.test(t) && i !== ti ? ['#d8ccb0', '#0d0b09'] : INKS[i % INKS.length]; return { ...wedge(i), fill, ink, text: i === ti ? '' : t.toUpperCase() }; });
  const target = { ...wedge(ti), fill: INKS[ti % INKS.length][0], ink: INKS[ti % INKS.length][1], text: from.toUpperCase() };
  const BULBS = Array.from({ length: 30 }, (_, i) => { const [x, y] = P(i * 12, 428); return { x, y, fill: i % 7 === 3 ? '#3a2a1a' : i % 2 ? '#ffe2b8' : '#ff8a1e' }; });
  const RIVETS = Array.from({ length: 36 }, (_, i) => { const [x, y] = P(i * 10 + 5, 446); return { x, y }; });

  useTimeline(ok, clip => {
    const { A } = fx(root.current);
    if (reduced()) {
      A('black', [{ opacity: 0 }], { duration: 1 }); A('scene', [{ opacity: 1 }], { duration: 1 });
      ['vkick', 'old-wedge', 'old-label'].forEach(s => A(s, [{ opacity: 0 }], { duration: 1 })); ['safe-wedge', 'safe-label'].forEach(s => A(s, [{ opacity: 1 }], { duration: 1 }));
      return 3500;
    }
    const ts: number[] = [];
    let loop = 0;
    const CUT = clip ? 3250 : 1100, HIT = CUT + 1450;
    if (clip) {
      const v = vid.current!;
      playClip(v, 0);
      // keep her moving behind the wheel: after the first pass, loop the hovering part (1.1s–3.2s) silently
      loop = window.setInterval(() => { if (v.currentTime >= 3.2 || v.ended) { v.muted = true; v.currentTime = 1.1; if (v.paused) v.play().catch(() => {}); } }, 30);
      A('mercy', [{ filter: 'none', transform: 'none' }, { filter: 'blur(7px) brightness(.55) sepia(.3)', transform: 'scale(1.08)' }], { duration: 700, delay: CUT });
      A('bars', [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: CUT });
    }
    A('black', [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
    A('vkick', [{ opacity: 0, letterSpacing: '.6em' }, { opacity: 1, letterSpacing: '.2em', offset: .3 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: CUT - 450, delay: 400, easing: 'ease-out' });
    A('flash', [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: 700, delay: CUT - 100, easing: 'ease-out' });
    A('scene', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: CUT });
    A('wheel', [{ opacity: 0, transform: 'scale(.82) rotate(-25deg)' }, { opacity: 1, transform: 'scale(1.02) rotate(3deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 800, delay: CUT + 50 });
    A('beam', [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 450, delay: CUT + 550 });
    const shake = [{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translate(-4px,0)', filter: 'brightness(1.6)', offset: .3 }, { transform: 'translate(4px,-3px)', filter: 'brightness(2.4)', offset: .6 }, { transform: 'translate(-3px,-6px)', filter: 'brightness(4)' }];
    A('old-wedge', shake, { duration: HIT - CUT - 800, delay: CUT + 800, easing: 'linear' });
    A('old-label', shake.map(({ transform, offset }) => ({ transform, offset })), { duration: HIT - CUT - 800, delay: CUT + 800, easing: 'linear' });
    const off = [{ transform: 'translate(-3px,-6px)', opacity: 1 }, { transform: 'translate(0,-150px) rotate(-6deg)', opacity: 1, offset: .25 }, { transform: 'translate(-420px,900px) rotate(-38deg)', opacity: 0 }];
    A('old-wedge', off, { duration: 1100, delay: HIT, easing: 'cubic-bezier(.3,0,.8,.5)' });
    A('old-label', off, { duration: 1100, delay: HIT, easing: 'cubic-bezier(.3,0,.8,.5)' });
    A('flash', [{ opacity: 0 }, { opacity: .6, offset: .15 }, { opacity: 0 }], { duration: 500, delay: HIT, easing: 'ease-out', fill: 'none', composite: 'add' });
    A('spark', [{ opacity: 1, transform: 'translate(0,0) scale(1)' }, { opacity: 0, transform: 'translate(var(--dx),var(--dy)) scale(.3)' }], { duration: 900, delay: HIT, stagger: 8, easing: 'cubic-bezier(.1,.8,.3,1)' });
    const drop = [{ opacity: 0, transform: 'translateY(-520px) scale(1.15)' }, { opacity: 1, transform: 'translateY(14px) scale(1)', offset: .6 }, { opacity: 1, transform: 'translateY(-10px)', offset: .8 }, { opacity: 1, transform: 'none' }];
    A('safe-wedge', drop, { duration: 650, delay: HIT + 250, easing: 'cubic-bezier(.5,0,.6,1.4)' });
    A('safe-label', drop, { duration: 650, delay: HIT + 250, easing: 'cubic-bezier(.5,0,.6,1.4)' });
    A('wheel', [{ transform: 'none' }, { transform: 'translateY(10px)' }, { transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 300, delay: HIT + 650, fill: 'none', composite: 'add' });
    A('bulb', [{ fill: '#fff6c8' }, { fill: '#ffd84a' }], { duration: 250, delay: HIT + 650, stagger: 18, iterations: 3, direction: 'alternate', fill: 'none' });
    A('beam', [{ opacity: 1 }, { opacity: .5 }], { duration: 800, delay: HIT + 700 });
    A('safe-halo', [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }], { duration: 900, delay: HIT + 900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
    A('kick', [{ opacity: 0, letterSpacing: '.6em' }, { opacity: 1, letterSpacing: '.24em' }], { duration: 700, delay: HIT + 300 });
    A('title', [{ opacity: 0, transform: 'scale(1.7)', filter: 'blur(14px)' }, { opacity: 1, transform: 'scale(.97)', filter: 'blur(0)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 700, delay: HIT + 650 });
    A('sub', [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: HIT + 1200 });
    // chime: sparkle hiss, rising bells and a short choir swell
    ts.push(window.setTimeout(() => { noise(.5, 4000, .3); bells(.2, [1046, 1318, 1568, 2093], .09, .25); choir(.2, [261.6, 329.6, 392, 523.3], .1, 2.5); }, HIT));
    ts.push(window.setTimeout(() => clearInterval(loop), HIT + 2900));
    return HIT + 2900;
  }, onDone);

  return (
    <div className="jr-ov sc-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="bl-stage">
          {ok ? <Clip src="/assets/mercy.mp4" vidRef={vid} fx="mercy" className="sc-video bl-video" /> : <div className="bl-heaven" />}
          {ok && <div className="bl-bars" data-fx="bars" />}
          <div className="bl-vkick" data-fx="vkick">{(angel?.name ?? 'The Angel').toUpperCase()} blesses the wheel</div>
          <div className="bl-scene" data-fx="scene">
            <div className="bl-beam" data-fx="beam" />
            <div className="bl-wheel" data-fx="wheel">
              <svg viewBox="-460 -460 920 920">
                <defs>
                  <radialGradient id="bl-metal" cx="45%" cy="40%" r="65%"><stop offset="0" stopColor="#4a565c" /><stop offset=".7" stopColor="#1a2226" /><stop offset="1" stopColor="#0b0e10" /></radialGradient>
                  <radialGradient id="bl-shade" cx="50%" cy="50%" r="50%"><stop offset=".15" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
                  <filter id="bl-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <circle r="455" fill="#000" transform="translate(0,22)" opacity=".7" />
                <circle r="452" fill="url(#bl-metal)" stroke="#000" strokeWidth="4" />
                <circle r="402" fill="#0b0e10" />
                {segs.map((s, i) => <path key={i} d={s.d} fill={s.fill} stroke="#0b0e10" strokeWidth="5" />)}
                <circle r="400" fill="url(#bl-shade)" pointerEvents="none" />
                <g data-fx="old-wedge" style={{ transformBox: 'view-box', transformOrigin: '0 0' }}><path d={target.d} fill={target.fill} stroke="#0b0e10" strokeWidth="5" /></g>
                <g data-fx="safe-wedge" style={{ transformBox: 'view-box', transformOrigin: '0 0', opacity: 0 }}><path d={target.d} fill="#efe6cc" stroke="#e0b458" strokeWidth="6" filter="url(#bl-glow)" /></g>
                {BULBS.map((b, i) => <circle key={i} data-fx="bulb" cx={b.x} cy={b.y} r="10" fill={b.fill} />)}
                {RIVETS.map((r, i) => <circle key={i} cx={r.x} cy={r.y} r="4" fill="#6b7a80" stroke="#000" strokeWidth="2" />)}
                <circle r="74" fill="url(#bl-metal)" stroke="#000" strokeWidth="6" /><circle r="22" fill="#0b0e10" stroke="#51606a" strokeWidth="3" />
                <g transform="translate(0,-446)"><path d="M -38 -36 L 38 -36 L 9 60 L -9 60 Z" fill="#28333a" stroke="#000" strokeWidth="5" /><circle cy="-12" r="12" fill="#ffd84a" stroke="#000" strokeWidth="4" filter="url(#bl-glow)" /></g>
              </svg>
              <div className="bl-labels">
                {segs.map((s, i) => s.text && <div key={i} className="bl-label" style={{ transform: `rotate(${s.mid}deg) translateX(112px)`, color: s.ink, fontSize: s.text.length > 11 ? 22 : 28 }}>{s.text}</div>)}
                <div className="bl-anchor" data-fx="old-label"><div className="bl-label" style={{ transform: 'rotate(-90deg) translateX(112px)', color: target.ink, fontSize: 22 }}>{target.text}</div></div>
                <div className="bl-anchor" data-fx="safe-label" style={{ opacity: 0 }}>
                  <div className="bl-safe"><div className="halo" data-fx="safe-halo" /><div className="t">SAFE</div></div>
                </div>
              </div>
            </div>
            <div className="bl-words">
              <div className="k" data-fx="kick">{(angel?.name ?? 'The Angel').toUpperCase()} laid a hand on the wheel</div>
              <div className="t" data-fx="title">BLESSED</div>
              <div className="s" data-fx="sub"><div className="old"><span>“{from}”</span></div><div className="note">IS SAFE FOR THE REST OF THE NIGHT</div></div>
            </div>
            {SPARKS.map((p, i) => <div key={i} className="bl-spark" data-fx="spark" style={{ width: p.s, height: p.s, ['--dx' as any]: p.dx + 'px', ['--dy' as any]: p.dy + 'px' }} />)}
          </div>
        </div>
        <div className="sc-dark on" data-fx="black" />
        <div className="bl-flash" data-fx="flash" />
        <div className="jr-grain top" />
      </div>
    </div>
  );
}

// ================================================================ NINJA · the shuriken
// Lights drop, a shuriken whistles in out of the dark, spinning, and thunks into the victim's photo.
// Nobody is told who threw it. Drawn only (no clip), ~4.4s.
const SMOKE = Array.from({ length: 10 }, (_, i) => ({ x: 120 + (i * 181) % 1680, y: 700 + (i * 67) % 300, s: 220 + (i * 41) % 180 }));
export function ShurikenScene({ victim, onDone }: { victim?: Player; onDone: () => void }) {
  const scale = useStageScale();
  const root = useRef<HTMLDivElement>(null);
  useTimeline(true, () => {
    const { A } = fx(root.current);
    if (reduced()) return 2500;
    A('dark', [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    A('smoke', [{ opacity: 0, transform: 'translateY(40px) scale(.8)' }, { opacity: .55, transform: 'none' }, { opacity: 0, transform: 'translateY(-60px) scale(1.2)' }], { duration: 3200, delay: 100, stagger: 90, easing: 'ease-out' });
    A('photo', [{ opacity: 0, transform: 'scale(.9) rotate(-2deg)' }, { opacity: 1, transform: 'rotate(-2deg)' }], { duration: 400, delay: 250 });
    A('star', [{ transform: 'translate(-1300px,-360px) rotate(0) scale(.6)', opacity: 1 }, { transform: 'translate(0,0) rotate(1440deg) scale(1)', opacity: 1 }], { duration: 650, delay: 700, easing: 'cubic-bezier(.5,0,.9,.6)' });
    A('photo', [{ transform: 'rotate(-2deg)' }, { transform: 'translate(14px,-6px) rotate(1deg)' }, { transform: 'translate(-8px,4px) rotate(-3deg)' }, { transform: 'rotate(-2deg)' }], { duration: 320, delay: 1350, fill: 'none' });
    A('flash', [{ opacity: .55 }, { opacity: 0 }], { duration: 260, delay: 1350 });
    A('crack', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 160, delay: 1350 });
    A('kick', [{ opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.4em' }], { duration: 600, delay: 1500 });
    A('name', POP, { duration: 550, delay: 1650 });
    A('sub', [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 2100 });
    A('all', [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 4000 });
    noise(.65, 2600, .35, .7);                       // the whistle in
    tone(1800, .6, 'sine', .08, .7, 900);
    tone(120, .25, 'sine', .7, 1.35, 45);            // thunk
    noise(.08, 3200, .5, 1.35);
    tone(220, .9, 'sawtooth', .06, 1.5, 110);
    return 4400;
  }, onDone);
  return (
    <div className="jr-ov nj-ov" ref={root}>
      <div className="jr-stage" style={{ transform: `scale(${scale})` }}>
        <div className="nj-scene" data-fx="all">
          <div className="nj-dark" data-fx="dark" />
          {SMOKE.map((m, i) => <i key={i} className="nj-smoke" data-fx="smoke" style={{ left: m.x, top: m.y, width: m.s, height: m.s }} />)}
          <div className="nj-photo" data-fx="photo">
            <Photo p={victim} />
            <span className="nj-crack" data-fx="crack" />
            <svg className="nj-star" data-fx="star" viewBox="-50 -50 100 100" aria-hidden="true">
              <path d="M0-46 L9-9 L46 0 L9 9 L0 46 L-9 9 L-46 0 L-9-9Z" fill="#c9ced6" stroke="#15171b" strokeWidth="3" />
              <circle r="8" fill="#15171b" /><circle r="4" fill="#5a606a" />
            </svg>
          </div>
          <div className="nj-flash" data-fx="flash" />
          <div className="nj-text">
            <div className="nj-kick" data-fx="kick">FROM THE SHADOWS</div>
            <div className="nj-name" data-fx="name">{(victim?.name ?? 'SOMEONE').toUpperCase()}</div>
            <div className="nj-sub" data-fx="sub">TAKES A SHURIKEN · OFF TO THE WHEEL · NOBODY SAW A THING</div>
          </div>
        </div>
      </div>
    </div>
  );
}
