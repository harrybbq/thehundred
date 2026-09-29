// Full-screen TV scenes from the designs (TV-14 … TV-18), on a fixed 1920×1080 stage scaled to the screen.
// Each plays its film clip from /assets when the file is there (with the clip's own sound), and falls back
// to a drawn version with synthesised sound when it isn't, so a missing clip never breaks the night.
//   HolyNovaScene  the Angel's Holy Nova (inarius.mp4)       LockerScene   Davy Jones' Locker (davy-jones.mp4)
//   ShameScene     Judge Dredd's Walk of Shame (dredd.mp4)   BlessedScene  the Angel blesses the wheel (mercy.mp4)
//   ShurikenScene  the Ninja's silent strike (drawn only)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { initials } from '../lib/util';
import { audioCtx, soundEnabled } from '../fx/sound';

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
/** Start downloading every film clip (the TV calls this when a room opens). */
export function preloadClips() { ['/assets/inarius.mp4', '/assets/davy-jones.mp4', '/assets/dredd.mp4', '/assets/mercy.mp4'].forEach(clip); }

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
/** Runs the timeline once we know whether the clip is there; calls onDone after `total(ok)` ms. */
function useTimeline(ok: boolean | null, run: (ok: boolean) => number, onDone: () => void) {
  useLayoutEffect(() => {
    if (ok === null) return;
    const total = run(ok);
    const t = setTimeout(onDone, total);
    return () => clearTimeout(t);
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

// ================================================================ TV-15 · DAVY JONES' LOCKER
const BOLTS = Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return { x: Math.round(410 + Math.cos(a) * 375), y: Math.round(410 + Math.sin(a) * 375) }; });
const BUBBLES = Array.from({ length: 22 }, (_, i) => ({ x: 60 + (i * 181) % 1800, s: 10 + (i * 7) % 30 }));
const DAVY_FROM = 4;          // the clip starts 4s in (its opening is cut)

export function LockerScene({ victim, until, onDone }: { victim?: Player; until: string | null; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null), vid = useRef<HTMLVideoElement>(null);
  const scale = useStageScale();
  const ok = useClip('/assets/davy-jones.mp4');
  const left = until ? Math.max(0, Math.round((Date.parse(until) - Date.now()) / 1000)) : 0;
  const lockTime = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  useTimeline(ok, clip => {
    const { A, q } = fx(root.current);
    if (reduced()) {
      A('lk-water', [{ transform: 'translateY(0)' }], { duration: 1 });
      ['lk-cell', 'lk-final', 'lk-timer'].forEach(s => A(s, [{ opacity: 1 }], { duration: 1 }));
      ['lk-hang', 'lk-kick'].forEach(s => A(s, [{ opacity: 0 }], { duration: 1 }));
      return 3500;
    }
    // Davy falls 7.2s into the clip: with the first 4s cut, that's 3.2s in
    const FALL = clip ? Math.round((7.2 - DAVY_FROM) * 1000) : 4200;
    const ts: number[] = [];
    if (clip) {
      playClip(vid.current, DAVY_FROM);
      ts.push(window.setTimeout(() => { const v = vid.current; if (!v) return; const f = setInterval(() => { v.volume = Math.max(0, v.volume - .1); if (!v.volume) { v.pause(); clearInterval(f); } }, 60); }, FALL + 2600));
    }
    A('lk-black', [{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
    A('lk-port', [{ opacity: 0, transform: 'scale(.6) rotate(-40deg)' }, { opacity: 1, transform: 'scale(1.03) rotate(4deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 100 });
    A('lk-caustic', [{ transform: 'translateX(0)' }, { transform: 'translateX(170px)' }], { duration: 4000, iterations: Infinity, easing: 'linear', fill: 'none' });
    A('lk-kick', [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 500 });
    A('lk-hang', [{ transform: 'translateY(-900px)' }, { transform: 'translateY(40px)', offset: .7 }, { transform: 'none' }], { duration: 1100, delay: Math.min(900, FALL - 2300), easing: 'cubic-bezier(.3,1.2,.5,1)' });
    A('lk-hang', [{ transform: 'rotate(-5deg)' }, { transform: 'rotate(5deg)' }], { duration: 1100, delay: FALL - 2200, iterations: 2, direction: 'alternate', easing: 'ease-in-out', fill: 'none', composite: 'add' });
    A('lk-photo', [{ transform: 'rotate(-3deg)' }, { transform: 'rotate(-3deg) translateX(-4px)' }, { transform: 'rotate(-3deg) translateX(4px)' }], { duration: 90, delay: FALL - 1000, iterations: 10, fill: 'none' });
    A('lk-tentacle', [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }], { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', stagger: 300, fill: 'none' });
    // the fall: the chain snaps and the victim is dragged under
    A('lk-flash', [{ opacity: 0 }, { opacity: .9 }, { opacity: 0 }], { duration: 500, delay: FALL, easing: 'ease-out' });
    A('lk-stage', [{ transform: 'none' }, { transform: 'translate(-14px,10px)' }, { transform: 'translate(12px,-8px)' }, { transform: 'none' }], { duration: 420, delay: FALL, easing: 'linear', fill: 'none' });
    A('lk-chain', [{ transform: 'none' }, { transform: 'translateY(-600px)' }], { duration: 400, delay: FALL, easing: 'ease-in' });
    A('lk-photo', [{ transform: 'rotate(-3deg)' }, { transform: 'translateY(-40px) rotate(8deg)', offset: .15 }, { transform: 'translateY(900px) rotate(40deg)' }], { duration: 800, delay: FALL, easing: 'cubic-bezier(.5,0,.9,.6)' });
    A('lk-kick', [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: FALL });
    A('lk-water', [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 1300, delay: FALL + 200, easing: 'cubic-bezier(.4,0,.2,1)' });
    A('lk-wave', [{ transform: 'translateX(0)' }, { transform: 'translateX(120px)' }], { duration: 700, iterations: Infinity, easing: 'linear', fill: 'none' });
    A('lk-bubble', [{ opacity: 0, transform: 'translateY(0)' }, { opacity: 1, offset: .1 }, { opacity: 0, transform: 'translateY(-1150px) translateX(30px)' }], { duration: 2600, delay: FALL + 300, stagger: 110, easing: 'ease-in' });
    A('lk-port', [{ filter: 'none' }, { filter: 'brightness(.55) saturate(.7) hue-rotate(10deg)' }], { duration: 1200, delay: FALL + 400 });
    // the cell slams shut
    A('lk-cell', [{ opacity: 0, transform: 'translateY(160px)' }, { opacity: 1, transform: 'translateY(-10px)', offset: .8 }, { opacity: 1, transform: 'none' }], { duration: 900, delay: FALL + 1300 });
    A('lk-bars', [{ transform: 'translateY(-700px)' }, { transform: 'translateY(0)', offset: .7 }, { transform: 'translateY(-18px)', offset: .85 }, { transform: 'none' }], { duration: 500, delay: FALL + 1700, easing: 'cubic-bezier(.6,0,.9,.4)' });
    A('lk-lock', [{ opacity: 0, transform: 'scale(3) rotate(-30deg)' }, { opacity: 1, transform: 'scale(.9) rotate(6deg)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 450, delay: FALL + 2250, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    A('lk-final', [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: FALL + 2400 });
    A('lk-timer', [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: FALL + 2700, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    ts.push(window.setTimeout(() => { noise(1.2, 400, .5); tone(70, 1, 'sine', .6, 0, 30); }, FALL));
    ts.push(window.setTimeout(() => { tone(110, .25, 'square', .25); noise(.2, 3000, .4); }, FALL + 2000));
    ts.push(window.setTimeout(() => { noise(.15, 5000, .5); tone(1200, .12, 'square', .15); }, FALL + 2300));
    void q;
    return FALL + 5000;
  }, onDone);

  return (
    <div className="jr-ov sc-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="lk-stage" data-fx="lk-stage">
          <div className="lk-caustic" data-fx="lk-caustic" />
          <div className="lk-port" data-fx="lk-port">
            <div className="rim" />
            {BOLTS.map((b, i) => <i key={i} className="bolt" style={{ left: b.x, top: b.y }} />)}
            <div className="glass">
              {ok
                ? <Clip src="/assets/davy-jones.mp4" vidRef={vid} className="lk-video" />
                : <div className="lk-deep">{[0, 1, 2, 3].map(i => <span key={i} className="lk-tentacle" data-fx="lk-tentacle" style={{ left: 90 + i * 150, ['--h' as any]: `${300 + (i % 2) * 90}px` }} />)}<div className="lk-eyes"><b /><b /></div></div>}
              <div className="shine" />
            </div>
          </div>
          <div className="lk-kick" data-fx="lk-kick"><div className="k">Davy Jones' Locker</div><div className="t">Davy Jones has come to collect…</div></div>
          <div className="lk-hangwrap">
            <div className="lk-hang" data-fx="lk-hang">
              <div className="lk-chain" data-fx="lk-chain" />
              <div className="lk-photo" data-fx="lk-photo"><Photo p={victim} /><div className="nm">{victim?.name.toUpperCase()}</div><i className="ring" /></div>
            </div>
          </div>
          <div className="lk-water" data-fx="lk-water"><div className="lk-wave" data-fx="lk-wave" /></div>
          {BUBBLES.map((b, i) => <div key={i} className="lk-bubble" data-fx="lk-bubble" style={{ left: b.x, width: b.s, height: b.s }} />)}
          <div className="lk-cell" data-fx="lk-cell">
            <div className="lk-cellphoto"><Photo p={victim} /><div className="nm">{victim?.name.toUpperCase()}</div></div>
            <div className="lk-bars" data-fx="lk-bars">{Array.from({ length: 7 }, (_, i) => <i key={i} />)}<b className="h1" /><b className="h2" /><s className="weed a" /><s className="weed b" /></div>
            <div className="lk-lock" data-fx="lk-lock"><i /><b>⚓</b></div>
          </div>
          <div className="lk-final" data-fx="lk-final"><div className="t">Sleeping with the fishes</div><div className="s">NO PUNISHMENTS · NO POWERS · NO VOTE</div></div>
          <div className="lk-timer" data-fx="lk-timer"><div className="nm">{victim?.name.toUpperCase()}</div><div className="row"><span>LOCKED</span><b>{lockTime}</b></div></div>
        </div>
        <div className="sc-dark" data-fx="lk-black" />
        <div className="lk-flash" data-fx="lk-flash" />
        <div className="jr-grain top" />
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
