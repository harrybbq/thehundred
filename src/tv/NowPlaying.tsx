// NOW PLAYING (game_start): a 1940s picture-house marquee lights up over the board and the game's name is
// hung on its readerboard letter by letter; then the name lifts off the still-lit glass and flies up into the
// top bar, where it becomes the NOW PLAYING chip (a FLIP hand-off: measured, inverted, played). Only once the
// name has left does the marquee power down, with one last bulb popping.
//   0-560     a Saul Bass stinger: three flat, hard-edged bars cut across the frame
//   260       the marquee's relay throws: the frame drops into place, the milk glass flickers on
//   520-~1250 the letters are hooked onto the rail one at a time; the bulbs start chasing (3 channels)
//   ~1300     a muted-brass sting on the finished name
//   2450-3050 the name lifts off the lit glass, turns to lit type and arcs up onto the chip's own text
//   2690      the name has left the glass: the bulbs drop out, the last one pops, the glass stutters off
//   3050      the chip takes over (a filament flash), the scene is gone by 3300
// Motion is transform/opacity only (WAAPI). The bulbs are baked once per render as one gradient per bulb (so every
// bulb has its own warmth and brightness, and a couple are tired), split into 3 chase channels per strip.
// Reduced motion: the lit marquee as a still frame, then the chip appears.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { reduced } from './machineKit';
import { Sound, cues } from '../fx/sound';
import '../styles/nowplaying.css';
import { useFitScale } from './stage';

export const NOW_PLAYING_MS = 3300;
const FLY = 2450, LAND = 3050, OFF = FLY + 240;   // OFF: the name is clear of the glass, the marquee may die
const PANEL_W = 1400, MAX_FS = 236, MIN_FS = 60, CW = .5;   // Big Shoulders Display 900 caps average ~0.5em wide

/** The live chip's text in the top bar (or null in the Test Lab, where there is no board). */
const chipText = () => document.querySelector<HTMLElement>('.bd .nowplaying .np-g');

// ---- the bulbs. Strip geometry (stage px, inside each strip's own box): a bulb every 40px, centred 20px in, 28px deep.
type Side = 'top' | 'bot' | 'lft' | 'rgt';
const BULBS: Record<Side, number> = { top: 39, bot: 39, lft: 9, rgt: 9 };
const TIRED: Partial<Record<Side, number[]>> = { top: [23], bot: [11], rgt: [5] };   // old filaments, a touch dimmer
const FLICK = { side: 'top' as Side, i: 8 };     // one bulb on the fritz
const POP = { side: 'top' as Side, i: 30 };      // the last one to go, with a pop
const at = (side: Side, i: number) => side === 'top' || side === 'bot' ? `${20 + i * 40}px 28px` : `28px ${20 + i * 40}px`;
const hash = (side: Side, i: number) => { const s = side.charCodeAt(0) * 131 + i * 977; return ((s * 2654435761) >>> 0) / 4294967296; };
// three baked states: white-hot, warm, amber (a slightly older lamp)
const LIT = [['#fffaf0', '#ffe2b8', '#ff8a1e'], ['#fff1d4', '#ffcf8e', '#ff7c14'], ['#ffdca0', '#ffa64c', '#e0580c']];
const litBulb = (side: Side, i: number) => {
  const p = `circle at ${at(side, i)}`;
  if (TIRED[side]?.includes(i)) return `radial-gradient(${p},#f2c48c 0 2.5px,#cf8a3e 5px,#9a5416 8px,rgba(200,110,30,.16) 11px,transparent 15px)`;
  const h = hash(side, i), [a, b, c] = LIT[Math.floor(h * 3)], halo = (.18 + ((h * 7) % 1) * .26).toFixed(2), r = 3.1 + ((h * 13) % 1) * 1.7;
  return `radial-gradient(${p},${a} 0 ${r.toFixed(1)}px,${b} ${(r + 2).toFixed(1)}px,${c} ${(r + 5).toFixed(1)}px,rgba(255,138,30,${halo}) ${(r + 9).toFixed(1)}px,transparent ${(r + 15).toFixed(1)}px)`;
};
const DIM = ['#ffd9a0', '#ffe3b4', '#ffcb86'];
const dimBulb = (side: Side, i: number) => {
  const p = `circle at ${at(side, i)}`;
  if (TIRED[side]?.includes(i)) return `radial-gradient(${p},#b88452 0 2px,#7a4a1e 5px,transparent 8px)`;
  return `radial-gradient(${p},${DIM[Math.floor(hash(side, i) * 3)]} 0 3px,#b8742c 6px,transparent 9px)`;
};
/** every bulb of a strip in chase channel k (bulb i is on channel i % 3), as one background */
const channel = (side: Side, k: number) => [...Array(BULBS[side]).keys()].filter(i => i % 3 === k && !(side === FLICK.side && i === FLICK.i)).map(i => litBulb(side, i)).join(',');
const dimAll = (side: Side) => [...Array(BULBS[side]).keys()].map(i => dimBulb(side, i)).join(',');

export function NowPlayingScene({ name, onDone }: { name: string; onDone: () => void }) {
  const scale = useFitScale();   // the 1920x1080 stage, inside the TV edge margin
  const root = useRef<HTMLDivElement>(null);
  const title = name.trim().toUpperCase() || 'A GAME';
  const chars = useMemo(() => [...title], [title]);
  // each letter hangs a touch off true, like hand-hooked marquee letters (fixed per position, so every copy matches)
  const jit = useMemo(() => chars.map((_, i) => ({ r: ((i * 37) % 7 - 3) * .45, y: ((i * 53) % 5 - 2) * 2, w: 1 - ((i * 29) % 4) * .04 })), [chars]);
  const fs0 = Math.floor(Math.min(MAX_FS, PANEL_W / (Math.max(4, chars.length) * CW)));
  const bg = useMemo(() => {
    const sides: Side[] = ['top', 'bot', 'lft', 'rgt'];
    return Object.fromEntries(sides.map(s => [s, { dim: dimAll(s), ch: [0, 1, 2].map(k => channel(s, k)) }])) as Record<Side, { dim: string; ch: string[] }>;
  }, []);

  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    const html = document.documentElement;
    html.classList.add('np-hold');                                     // the chip waits until the name lands on it
    const one = (s: string) => el.querySelector<HTMLElement>(`[data-fx="${s}"]`) ?? undefined;
    const all = (s: string) => [...el.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`)];
    // one line, always: shrink until it fits the glass (a two-line title couldn't become a one-line chip)
    const fit = () => {
      const box = one('name'), line = one('ink'), refl = one('rname'); if (!box || !line) return;
      box.style.fontSize = MAX_FS + 'px';                              // measure at full size, then scale to the glass
      let fs = Math.max(MIN_FS, Math.min(MAX_FS, Math.floor(MAX_FS * PANEL_W / Math.max(1, line.scrollWidth))));
      box.style.fontSize = fs + 'px';
      while (line.scrollWidth > PANEL_W + 1 && fs > MIN_FS) { fs -= 2; box.style.fontSize = fs + 'px'; }
      if (refl) refl.style.fontSize = fs + 'px';                       // the wet street mirrors the same line
    };
    fit();
    let dead = false;
    document.fonts?.ready.then(() => { if (!dead) fit(); });

    const land = () => {
      html.classList.remove('np-hold');
      const chip = chipText()?.closest('.nowplaying');
      if (chip) { chip.classList.remove('np-land'); void (chip as HTMLElement).offsetWidth; chip.classList.add('np-land'); chip.addEventListener('animationend', () => chip.classList.remove('np-land'), { once: true }); }
    };
    const timers: number[] = [];
    const after = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));

    if (reduced()) {                                                    // the DOM's own styles are the lit end frame
      Sound.marqueeOn(); const hush = cues([[200, Sound.marqueeSting]]);
      after(2600, land); after(2700, onDone);
      return () => { dead = true; hush(); timers.forEach(clearTimeout); html.classList.remove('np-hold'); };
    }

    const D = NOW_PLAYING_MS;
    const tl = (e: Element | undefined, frames: [number, Keyframe, string?][]) => {
      if (!e) return;
      const kf: Keyframe[] = frames.map(([t, p, ez]) => ({ ...p, offset: Math.min(1, Math.max(0, t / D)), ...(ez ? { easing: ez } : {}) }));
      if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
      if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
      return e.animate(kf, { duration: D, fill: 'both' });
    };
    const op = (v: number) => ({ opacity: v }), tf = (v: string) => ({ transform: v });
    const OUT = 'cubic-bezier(.2,.8,.3,1)', SNAP = 'steps(1,end)';
    // the glass's tube flicker, on at 300 and off at OFF (shared by everything the glass lights)
    const tubes = (peak: number): [number, Keyframe, string?][] => [[300, op(0), SNAP], [360, op(.7 * peak), SNAP], [420, op(.2 * peak), SNAP], [470, op(peak)],
      [OFF, op(peak), SNAP], [OFF + 60, op(.35 * peak), SNAP], [OFF + 120, op(.8 * peak), SNAP], [OFF + 200, op(0)]];

    // ---- 0-560 the stinger: flat bars cut across (Saul Bass), the board goes dark under them
    tl(one('scrim'), [[0, op(0), 'ease-out'], [300, op(1)], [FLY, op(1), 'ease-in-out'], [LAND - 50, op(0)]]);
    all('bar').forEach((b, i) => tl(b, [[i * 70, tf('translateX(-2700px) skewX(-18deg)'), 'cubic-bezier(.5,0,.4,1)'], [i * 70 + 520, tf('translateX(2700px) skewX(-18deg)')]]));
    // ---- 260 the relay: the marquee drops into place, the glass flickers on like tubes behind it
    tl(one('mq'), [[240, { opacity: 0, transform: 'translateY(-40px) scale(1.06)' }, OUT], [460, { opacity: 1, transform: 'none' }],
      [OFF + 90, { opacity: 1, transform: 'none' }, 'cubic-bezier(.4,0,.6,1)'], [OFF + 250, { opacity: 0, transform: 'scale(.97)' }]]);
    tl(one('glass'), tubes(1));
    tl(one('halo'), tubes(1));
    tl(one('wet'), tubes(1));
    tl(one('spill'), [[300, op(0), 'ease-out'], [520, op(1)], [OFF, op(1), 'ease-in'], [OFF + 200, op(0)]]);
    tl(one('cone'), [[420, op(0), 'ease-out'], [700, op(1)], [OFF, op(1), 'ease-in'], [OFF + 220, op(0)]]);
    one('rain')?.animate([{ transform: 'translate(0px,0px)' }, { transform: 'translate(-90px,512px)' }], { duration: 420, iterations: Math.ceil((OFF + 220) / 420), easing: 'linear' });
    one('ripple')?.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(16px)' }], { duration: 700, iterations: Math.ceil((OFF + 220) / 700), easing: 'linear' });
    one('grain')?.animate([{ transform: 'translate(0px,0px)' }, { transform: 'translate(-60px,40px)' }, { transform: 'translate(30px,-70px)' }, { transform: 'translate(-90px,-20px)' }, { transform: 'translate(0px,0px)' }],
      { duration: 333, iterations: Math.ceil(D / 333), easing: 'steps(1,end)' });   // grain jumps at 12 fps, like a projected print
    tl(one('grain'), [[0, op(0), 'ease-out'], [300, op(.07)], [FLY, op(.07), 'ease-in'], [LAND, op(0)]]);
    tl(one('neon'), [[380, op(0), SNAP], [430, op(1), SNAP], [480, op(.3), SNAP], [540, op(1)], [OFF + 30, op(1), SNAP], [OFF + 90, op(.25), SNAP], [OFF + 130, op(0)]]);
    // ---- the bulbs: every socket glows dim, three channels chase over it (bulb 1, 4, 7… on channel 1)
    all('bulbsOn').forEach(b => tl(b, [[470, op(0), SNAP], [520, op(.55)], [OFF, op(.55), SNAP], [OFF + 1, op(0)]]));
    const STEP = 110;
    all('ch').forEach(c => {
      const k = +c.dataset.k!;
      const steps: [number, Keyframe, string?][] = [[0, op(0), SNAP]];
      for (let t = 520 + k * STEP; t < OFF; t += STEP * 3) steps.push([t, op(1), SNAP], [Math.min(t + STEP, OFF), op(1), 'ease-out'], [Math.min(t + STEP + 90, OFF), op(0), SNAP]);   // a filament flares on and cools off
      steps.push([OFF, op(0)]);
      tl(c, steps);
    });
    // the bad one: on with everything else, but it stutters, now and then dropping to its dim glow
    const fl: [number, Keyframe, string?][] = [[0, op(0), SNAP]];
    const pat = [1, 1, .15, 1, 1, 1, 1, .55, .05, 1, 1, 1, .3, 1, 1, 1];
    for (let t = 520, j = 0; t < OFF; t += j % 3 ? 70 : 130, j++) fl.push([t, op(pat[j % pat.length]), SNAP]);
    fl.push([OFF, op(0)]);
    tl(one('flick'), fl);
    // the last bulb: everything else has gone out, it flares white and blows
    tl(one('pop'), [[OFF + 30, { opacity: 0, transform: 'scale(.5)' }, SNAP], [OFF + 40, { opacity: 1, transform: 'scale(.5)' }, 'cubic-bezier(.2,.9,.3,1)'], [OFF + 110, { opacity: 1, transform: 'scale(1.35)' }, 'ease-in'], [OFF + 190, { opacity: 0, transform: 'scale(1.5)' }]]);
    // ---- 520 the letters go up, one at a time, each swinging onto its hook and settling a touch off true
    const n = chars.length, stagger = Math.min(55, 560 / Math.max(1, n));
    const rest = (i: number) => `translateY(${jit[i].y}px) rotate(${jit[i].r}deg)`;
    // in flight, both copies straighten up together, and the ink copy hands over to lit type as the name clears the glass
    const XF = FLY + 30, XT = FLY + 150;
    all('l').forEach((l, i) => {
      const s = 520 + i * stagger, j = jit[i];
      tl(l, [[s, { opacity: 0, transform: `translateY(-90px) rotate(${j.r * 4 - 6}deg)` }, 'cubic-bezier(.3,0,.6,1)'], [s + 120, { opacity: 1, transform: `translateY(${j.y + 10}px) rotate(${-j.r}deg)` }, 'ease-out'],
        [s + 210, { opacity: 1, transform: rest(i) }], [FLY, { opacity: 1, transform: rest(i) }, OUT], [XF, { opacity: 1, transform: `translateY(${j.y * .6}px) rotate(${j.r * .6}deg)` }, 'linear'], [XT, { opacity: 0, transform: `translateY(${j.y * .2}px) rotate(${j.r * .2}deg)` }]]);
    });
    all('rl').forEach((l, i) => { const s = 520 + i * stagger; tl(l, [[s + 60, op(0), 'ease-out'], [s + 160, op(1)], [FLY, op(1), 'ease-in'], [FLY + 140, op(0)]]); });
    const lastIn = 520 + (n - 1) * stagger + 120;
    all('lit').forEach((l, i) => { const j = jit[i]; tl(l, [[FLY, { opacity: 0, transform: rest(i) }, OUT], [XF, { opacity: 0, transform: `translateY(${j.y * .6}px) rotate(${j.r * .6}deg)` }, 'linear'], [XT, { opacity: 1, transform: `translateY(${j.y * .2}px) rotate(${j.r * .2}deg)` }, OUT], [FLY + 380, { opacity: 1, transform: 'none' }]]); });
    tl(one('glow'), [[XF, op(0), 'ease-out'], [XT, op(1)], [FLY + 330, op(1), 'ease-in'], [LAND - 80, op(0)]]);

    // the FLIP: measured at the moment of flight (the chip only exists once the state has caught up with the event)
    after(FLY - 10, () => {
      const box = one('name'), fx = one('flyX'), fy = one('flyY'), fz = one('flyZ'); if (!box || !fx || !fy || !fz) return;
      const scale = (el.querySelector('.np-stage')?.getBoundingClientRect().width ?? 1920) / 1920;   // live, not the first render's
      const r = box.getBoundingClientRect(), chip = chipText(), fsName = parseFloat(box.style.fontSize) * scale;
      let cx = innerWidth / 2, cy = innerHeight * .034, fsChip = innerHeight * .042;          // no board (Test Lab): where the chip would be
      let k = 0;
      if (chip) {
        const c = chip.getBoundingClientRect(); cx = c.left + c.width / 2; cy = c.top + c.height / 2; fsChip = parseFloat(getComputedStyle(chip).fontSize);
        if (chip.scrollWidth > chip.clientWidth + 1) k = c.width / r.width;   // a name too long for the bar: shrink it into the chip's box, then cross-fade
      }
      k ||= fsChip / fsName;
      const dx = (cx - (r.left + r.width / 2)) / scale, dy = (cy - (r.top + r.height / 2)) / scale;
      const dur = LAND - FLY, o = { duration: dur, fill: 'both' as const };
      fx.animate([{ transform: 'translateX(0px)' }, { transform: `translateX(${dx}px)` }], { ...o, easing: 'cubic-bezier(.55,0,.3,1)' });
      fy.animate([{ transform: 'translateY(0px)', easing: 'cubic-bezier(.3,0,.5,1)' }, { transform: 'translateY(18px)', offset: .14, easing: 'cubic-bezier(.3,0,.12,1)' }, { transform: `translateY(${dy}px)` }], o);   // a dip (anticipation), then y leads x: the name arcs up
      fz.animate([{ transform: 'scale(1)' }, { transform: `scale(${k})` }], { ...o, easing: 'cubic-bezier(.3,0,.15,1)' });
      fz.animate([{ opacity: 1 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: dur + 160, fill: 'both' });     // cross-fades into the real chip as it lands
    });
    after(LAND, land);

    // ---- the sound, on the beats
    const every = Math.max(1, Math.ceil(n / 12));                     // a long name rattles, it doesn't drum-roll
    const hooks = chars.map((_, i) => [520 + i * stagger + 115, () => Sound.letterHook(i)] as [number, () => void]).filter((_, i) => chars[i] !== ' ' && i % every === 0);
    const hush = cues([[0, () => Sound.whoosh(.5, true, .2)], [260, Sound.marqueeOn], ...hooks, [lastIn + 140, Sound.marqueeSting],
      [FLY, () => Sound.whoosh(.55, true, .14)], [OFF, () => Sound.whoosh(.35, false, .08)], [OFF + 40, Sound.tick], [LAND, Sound.chipLand]]);
    after(D, onDone);
    return () => { dead = true; hush(); timers.forEach(clearTimeout); html.classList.remove('np-hold'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strip = (side: Side) => (
    <div className={'np-bulbs np-' + side} aria-hidden="true">
      <i className="np-sockets" /><i data-fx="bulbsOn" className="np-dim" style={{ backgroundImage: bg[side].dim }} />
      {[0, 1, 2].map(k => <i key={k} data-fx="ch" data-k={side === 'bot' || side === 'lft' ? 2 - k : k} className="np-ch" style={{ backgroundImage: bg[side].ch[k] }} />)}
      {side === FLICK.side && <i data-fx="flick" className="np-flick" style={{ backgroundImage: litBulb(side, FLICK.i) }} />}
      {side === POP.side && <i data-fx="pop" className="np-pop" style={{ backgroundImage: `radial-gradient(circle at ${at(side, POP.i)},#fff 0 6px,#fff1d8 9px,rgba(255,196,120,.75) 14px,rgba(255,138,30,.3) 24px,transparent 38px)`, transformOrigin: at(side, POP.i) }} />}
    </div>
  );
  const letters = (cls: string, fx: string) => chars.map((ch, i) => ch === ' '
    ? <span key={i} className="np-sp">{' '}</span>
    : <span key={i} data-fx={fx} className={cls} style={{ transform: `translateY(${jit[i].y}px) rotate(${jit[i].r}deg)`, ['--wear' as string]: jit[i].w }}>{ch}</span>);

  return (
    <div ref={root} className="np-ov" role="status" aria-label={`Now playing: ${title}`}>
      <div data-fx="scrim" className="np-scrim" />
      <div className="np-stage" style={{ transform: `scale(${scale})` }}>
        <div data-fx="halo" className="np-halo" />
        <div data-fx="spill" className="np-spill" />
        {/* the wet street: the lit panel mirrored, squashed and broken up by ripples, fading away from the kerb */}
        <div data-fx="wet" className="np-wet" aria-hidden="true">
          <div className="np-refl">
            <div className="np-rbox" /><div className="np-rglass" /><i className="np-rbulbs" />
            <div data-fx="rname" className="np-rname" style={{ fontSize: fs0 }}><div className="np-line">{letters('np-rl', 'rl')}</div></div>
          </div>
          <div data-fx="ripple" className="np-ripple" />
        </div>
        <div data-fx="cone" className="np-cone"><div data-fx="rain" className="np-rain" /></div>
        <div data-fx="mq" className="np-mq">
          {strip('top')}{strip('bot')}{strip('lft')}{strip('rgt')}
          <div className="np-face">
            <div data-fx="glass" className="np-glass" />
            <i className="np-rail np-rail-a" /><i className="np-rail np-rail-b" />
          </div>
          <div data-fx="neon" className="np-neon">Now Playing</div>
        </div>
        {/* the name: three nested wrappers so x, y and scale can each take their own curve in flight */}
        <div data-fx="flyX" className="np-fly"><div data-fx="flyY" className="np-fly"><div data-fx="flyZ" className="np-fly">
          <div data-fx="name" className="np-name" style={{ fontSize: fs0 }}>
            <div data-fx="glow" className="np-glow" />
            <div data-fx="ink" className="np-line np-ink">{letters('np-l', 'l')}</div>
            <div className="np-line np-litline" aria-hidden="true">{letters('np-lit', 'lit')}</div>
          </div>
        </div></div></div>
        {[0, 1, 2].map(i => <div key={i} data-fx="bar" className={'np-bar np-bar' + i} />)}
      </div>
      <div data-fx="grain" className="np-grain" aria-hidden="true" />
    </div>
  );
}
