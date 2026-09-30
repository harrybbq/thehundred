// The after-game announcements, ported from the approved mockups (design/mockups/Champ.dc.html, Slacker.dc.html).
//   ChampTV    BIGGEST CHAMP: a gold commendation. The beers rack up on a gold seven-segment counter, each champ's portrait
//              drops in on brass chains in a gilt frame, a No.1 rosette is pinned on, and a GOLDEN TICKET prints out of the
//              machine under it while gold confetti falls. Everything that matters settles by ~3.1s; CONTINUE is live from frame 0.
//   SlackerTV  BIGGEST SLACKER: "WANTED: FOR NOT DRINKING". Posters slap onto the booking-room wall, one flash develops the
//              mugshots, SLACKER stamps, a marker dunce cap, the count limps up, WAH… WAH… WAHHHH as the trombone droops, the
//              evidence bag holds their untouched pint. START THE TRIAL / SKIP are live from frame 0. Nobody: NO SLACKERS.
// Both play once and hold; the render is the end frame (reduced motion shows just that). Transform/opacity only.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Player } from '../lib/types';
import { initials } from '../lib/util';
import { f1, marquee, reduced, rnd, segments } from './machineKit';

const abs = { position: 'absolute' } as const;
type Frames = [number, Keyframe, string?][];
function timeline(P: number) {
  const A: Animation[] = [];
  const tl = (el: Element | undefined | null, frames: Frames) => {
    if (!el) return;
    const kf: Keyframe[] = frames.map(([t, p, e]) => ({ ...p, offset: Math.min(1, t / P), ...(e ? { easing: e } : {}) }));
    if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
    if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
    A.push(el.animate(kf, { duration: P, fill: 'both' }));
  };
  const loop = (el: Element | undefined | null, k: Keyframe[], o: KeyframeAnimationOptions) => { if (el) A.push(el.animate(k, { iterations: Infinity, ...o })); };
  return { tl, loop, A };
}
const tf = (v: string) => ({ transform: v }), op = (v: number) => ({ opacity: v }), io = 'ease-in-out', POP = 'cubic-bezier(.3,1.5,.5,1)';

/** the 1920×1080 stage, scaled to the screen */
function Stage({ className, onClick, children }: { className: string; onClick?: () => void; children: ReactNode }) {
  const [s, setS] = useState(1);
  useEffect(() => { const fit = () => setS(Math.min(innerWidth / 1920, innerHeight / 1080)); fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit); }, []);
  return <div className={'an-ov ' + className} onClick={onClick}><div className="an-stage" style={{ transform: `scale(${s})` }}>{children}</div></div>;
}
function Photo({ p, size }: { p?: Player; size: number }) {
  return p?.selfie_url
    ? <img src={p.selfie_url} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#2c6e74,#0f3a41 55%,#06191d)', color: '#f1e8d4', fontFamily: "'Big Shoulders Display',sans-serif", fontWeight: 900, fontSize: size }}>{initials(p?.name ?? '?')}</div>;
}
/** a static centred marquee (gold / red / green) */
function Sign({ text, variant, fx }: { text: string; variant: '' | 'gold' | 'green'; fx: string }) {
  const pitch = 12, m = marquee(text, pitch), cols = m.textCols + 12, w = cols * pitch;
  return (
    <div data-fx={fx} style={{ ...abs, left: Math.round(960 - (w + 44) / 2), top: 18 }}>
      <div className={'mk-marquee' + (variant ? ' mk-marquee--' + variant : '')} style={{ '--mk-pitch': pitch + 'px' } as CSSProperties}>
        <div className="mk-marquee-screen" style={{ width: w, height: m.height }}>
          <svg className="mk-marquee-strip" width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`} style={{ left: 6 * pitch }} aria-label={text}>
            <path className="mk-dot-halo" d={m.d} /><path className="mk-dot" d={m.d} />
          </svg>
        </div>
      </div>
    </div>
  );
}
/** a seven-segment count: a ghost of 88 and ONE strip holding every value 00..n (ticking = one translateY per value) */
function Count({ n, h, gold, fx, stripFx, blinkFx, animate }: { n: number; h: number; gold?: boolean; fx?: string; stripFx: string; blinkFx?: string; animate: boolean }) {
  const STEP = 130, g = segments('88', { h: 100 }), vals = animate ? [...Array(n + 1).keys()] : [n];
  const w = Math.round(g.width * h / 112);
  return (
    <div data-fx={fx} className={'mk-seg' + (gold ? ' mk-seg--gold' : '')}>
      <svg viewBox={`0 -6 ${g.width} 112`} width={w} height={h} style={{ overflow: 'hidden' }} aria-label={`${n} beers`}>
        <path className="mk-seg-ghost" d={g.lit} />
        <g data-fx={blinkFx}><g data-fx={stripFx} style={{ transform: `translateY(${animate ? -n * STEP : 0}px)` }}>
          {vals.map((v, i) => { const s = segments(String(Math.min(99, v)).padStart(2, '0'), { h: 100 }); return <g key={i} transform={`translate(0 ${i * STEP})`}><path className="mk-seg-glow" d={s.lit} /><path className="mk-seg-lit" d={s.lit} /></g>; })}
        </g></g>
      </svg>
    </div>
  );
}

// ======================================================================== BIGGEST CHAMP
const RAYS = (() => { const k = 28, pts: string[] = []; for (let i = 0; i < k; i++) { const a0 = (i / k) * Math.PI * 2, w = Math.PI / k * .55; pts.push(`M0 0L${f1(Math.cos(a0 - w) * 900)} ${f1(Math.sin(a0 - w) * 900)}L${f1(Math.cos(a0 + w) * 900)} ${f1(Math.sin(a0 + w) * 900)}Z`); } return pts.join(''); })();
const ROSETTE = (() => { const k = 32, pts: string[] = []; for (let i = 0; i < k * 2; i++) { const a = (i / (k * 2)) * Math.PI * 2, r = i % 2 ? 80 : 94; pts.push(`${f1(Math.cos(a) * r)} ${f1(Math.sin(a) * r)}`); } return 'M' + pts.join('L') + 'Z'; })();
const GOLDS = ['#ffd84a', '#fff0b0', '#e0b458', '#c9a227', '#f5d77a', '#b8841e', '#fff8e0'];
const BITS = Array.from({ length: 90 }, (_, i) => ({ w: Math.round(10 + rnd(i + 500) * 10), h: Math.round(16 + rnd(i + 600) * 14), c: GOLDS[i % GOLDS.length],
  x: f1(rnd(i + 300) * 1900), y: f1(60 + rnd(i + 400) * 940), r: Math.round(rnd(i + 700) * 360), front: i % 4 === 0, d: Math.round(20 + rnd(i + 800) * 60), t: Math.round(1750 + rnd(i + 900) * 900), s: rnd(i + 200) }));

export function ChampTV({ champs, beers, onDone }: { champs: Player[]; beers: number; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const still = reduced();
  const who = champs.slice(0, 3), n = Math.max(1, who.length);
  const ph = [0, 300, 250, 214][n], fw = ph + 2 * (30 + 12), gap = [0, 0, 90, 46][n];
  const plH = n === 1 ? 84 : 76, tkH = 132, colH = fw - 12 + plH + 16 + 44 + tkH;
  const top = Math.round(262 + Math.max(0, (680 - colH) / 2));
  const total = n * fw + (n - 1) * gap, x0 = Math.round(960 - total / 2), colBottom = top + colH;
  const spot = { l: x0 - 140, r: x0 + total + 140 };
  const names = who.map(p => p.name.toUpperCase()), list = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0] ?? '';
  const sub = n > 1 ? `${list} SKIP THEIR NEXT PUNISHMENT` : `${list} SKIPS THEIR NEXT PUNISHMENT`;
  const subFs = Math.min(60, Math.floor(1400 / Math.max(1, sub.length * .52)));
  const subY = Math.min(990, colBottom + 30);
  const dust = Array.from({ length: 26 }, (_, i) => ({ x: f1(x0 - 60 + rnd(i + 1000) * (total + 120)), y: f1(top - 20 + rnd(i + 1100) * (fw + 60)), p: Math.round(1800 + rnd(i + 1200) * 1600) }));
  const ticks = [...Array(beers + 1).keys()].map(v => Math.round(400 + 800 * (1 - Math.pow(1 - v / Math.max(1, beers), 2))));
  useLayoutEffect(() => {
    const el = root.current; if (!el || still) return;
    const q = (s: string) => [...el.querySelectorAll(`[data-fx="${s}"]`)];
    const { tl, loop, A } = timeline(6000);
    tl(q('marquee')[0], [[0, op(0), 'steps(1,end)'], [100, op(1), 'steps(1,end)'], [170, op(.15), 'steps(1,end)'], [300, op(1)]]);
    tl(q('kicker')[0], [[300, { opacity: 0, transform: 'translateY(14px)' }, 'ease-out'], [650, { opacity: 1, transform: 'translateY(0px)' }]]);
    tl(q('panelL')[0], [[300, tf('translateX(-460px)'), 'cubic-bezier(.2,1.2,.4,1)'], [760, tf('translateX(0px)')]]);
    tl(q('panelR')[0], [[380, tf('translateX(460px) rotate(1.5deg)'), 'cubic-bezier(.2,1.2,.4,1)'], [840, tf('translateX(0px) rotate(1.5deg)')]]);
    tl(q('segStrip')[0], ticks.map((t, v) => [t, tf(`translateY(${-v * 130}px)`), 'steps(1,end)'] as [number, Keyframe, string]));
    const tEnd = ticks[ticks.length - 1];
    tl(q('segBox')[0], [[tEnd, tf('scale(1)'), 'ease-out'], [tEnd + 90, tf('scale(1.12)'), POP], [tEnd + 330, tf('scale(1)')]]);
    q('col').forEach((col, i) => {
      const t = 1000 + i * 120, one = (s: string) => [...col.querySelectorAll(`[data-fx="${s}"]`)];
      tl(one('hang')[0], [[t, tf('translateY(-1100px) rotate(0deg)'), 'cubic-bezier(.5,0,1,.7)'], [t + 380, tf('translateY(0px) rotate(0deg)'), 'ease-out'],
        [t + 470, tf('translateY(-26px) rotate(1.6deg)'), 'ease-in'], [t + 560, tf('translateY(0px) rotate(2.4deg)'), io], [t + 760, tf('translateY(0px) rotate(-1.6deg)'), io], [t + 940, tf('translateY(0px) rotate(.8deg)'), io], [t + 1100, tf('translateY(0px) rotate(0deg)')]]);
      tl(one('rosette')[0], [[1700 + i * 100, { opacity: 0, transform: 'rotate(-40deg) scale(2.4)' }, POP], [1920 + i * 100, { opacity: 1, transform: 'rotate(-12deg) scale(1)' }]]);
      const tp = 1950 + i * 100;
      tl(one('plamp')[0], [[1900 + i * 100, op(0), 'steps(1,end)'], [1940 + i * 100, op(1)]]);
      tl(one('ticket')[0], [[tp, tf('translateY(-100%)'), 'steps(5,end)'], [tp + 520, tf('translateY(-8%)'), 'ease-in'], [tp + 580, tf('translateY(0%)'), 'ease-out'], [tp + 640, tf('translateY(-2%)'), 'ease-in'], [tp + 700, tf('translateY(0%)')]]);
      tl(one('sheen')[0], [[t + 560, { opacity: 1, transform: 'translateX(-120%) skewX(-18deg)' }, 'ease-in-out'], [t + 1160, { opacity: 1, transform: 'translateX(420%) skewX(-18deg)' }, 'steps(1,end)'], [t + 1170, { opacity: 0, transform: 'translateX(420%) skewX(-18deg)' }]]);
    });
    tl(q('spot')[0], [[1350, op(0), 'steps(1,end)'], [1400, op(1)]]);
    tl(q('raysWrap')[0], [[1400, op(0), 'ease-out'], [1900, op(1)]]);
    loop(q('rays')[0], [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 90000, delay: 1400, iterations: 1, easing: 'linear' });   // one slow turn, once the rays are up
    tl(q('prize')[0], [[2350, { opacity: 0, transform: 'rotate(-4deg) scale(1.6)' }, POP], [2580, { opacity: 1, transform: 'rotate(-4deg) scale(1)' }]]);
    tl(q('sub')[0], [[2750, { opacity: 0, transform: 'translateY(16px)' }, 'ease-out'], [3050, { opacity: 1, transform: 'translateY(0px)' }]]);
    // the confetti falls once (translate + spin + a flutter), then it's gone
    q('bit').forEach(b => {
      const d = (b as HTMLElement).dataset, x = +d.x!, dd = +d.d!, t0 = +d.t!, r = +d.r!, s = +d.s!, dur = 2400 + s * 1400;
      const f = (k: number) => `translate(${(x + Math.sin(k * 3 + s * 6) * dd).toFixed(1)}px, ${(-60 + k * 1220).toFixed(1)}px) rotate(${(r + k * 540 * (s > .5 ? 1 : -1)).toFixed(0)}deg) scaleX(${Math.cos(k * 9 + s * 4).toFixed(2)})`;
      const fr: Frames = [0, .2, .4, .6, .8, 1].map(k => [t0 + k * dur, { transform: f(k), opacity: k === 0 || k === 1 ? 0 : 1 }]);
      fr.unshift([t0 - 1, { transform: f(0), opacity: 0 }]);
      tl(b, fr);
    });
    q('dust').forEach((d, i) => loop(d, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: .9, transform: 'scale(1)', offset: .5 }, { opacity: 0, transform: 'scale(.4)' }], { duration: +(d as HTMLElement).dataset.p!, delay: 1900 + i * 170, iterations: 3, easing: io }));
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bit = (b: typeof BITS[number], i: number) => <div key={i} data-fx="bit" className="ch-bit" data-x={b.x} data-d={b.d} data-t={b.t} data-r={b.r} data-s={b.s}
    style={{ width: b.w, height: b.h, background: b.c, transform: `translate(${b.x}px,${b.y}px) rotate(${b.r}deg)`, opacity: 0 }} />;
  return (
    <Stage className="slacker-ov champ-ov" onClick={onDone}>
      <div ref={root} style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', isolation: 'isolate', background: '#0b0804', color: '#f1e8d4', fontFamily: "'Courier Prime', monospace" }} className="mk-motion">
        <div className="mk-concrete" style={{ ...abs, inset: 0, opacity: .5 }} />
        <div style={{ ...abs, inset: 0, background: 'radial-gradient(ellipse 70% 60% at 50% 55%, rgba(60,40,6,.2), rgba(8,5,1,.82) 70%, #050301)' }} />
        <div data-fx="raysWrap" style={{ ...abs, left: 960, top: 90, width: 0, height: 0 }}>
          <svg data-fx="rays" viewBox="-900 -900 1800 1800" width="1800" height="1800" style={{ ...abs, left: -900, top: -900 }} aria-hidden="true">
            <defs><radialGradient id="ch-rayg" r=".5"><stop offset=".1" stopColor="#ffd84a" stopOpacity=".34" /><stop offset=".6" stopColor="#e0a030" stopOpacity=".08" /><stop offset="1" stopColor="#e0a030" stopOpacity="0" /></radialGradient></defs>
            <path d={RAYS} fill="url(#ch-rayg)" />
          </svg>
        </div>
        <div data-fx="spot" style={{ ...abs, inset: 0, pointerEvents: 'none' }}>
          <div style={{ ...abs, inset: 0, clipPath: `polygon(900px 150px, 1020px 150px, ${spot.r}px 1080px, ${spot.l}px 1080px)`, background: 'linear-gradient(180deg, rgba(255,236,170,.26) 150px, rgba(255,210,100,.1) 640px, rgba(255,200,90,.04) 1000px)' }} />
          <div style={{ ...abs, left: spot.l - 80, width: spot.r - spot.l + 160, top: 900, height: 260, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(255,220,120,.22), transparent)' }} />
        </div>
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(0,0,0,.55), transparent 18%, transparent 82%, rgba(0,0,0,.55))' }} />
        {!still && <div style={{ ...abs, inset: 0, pointerEvents: 'none' }}>{BITS.filter(b => !b.front).map(bit)}</div>}

        {who.map((p, i) => {
          const plW = fw - 36, prW = fw - 24, tkW = Math.min(fw + gap - 28, fw + 30, 420), prY = fw - 12 + plH + 12;
          const nameFs = Math.min(n === 1 ? 72 : 64, Math.floor(plW / (p.name.length * .5 + .6)));
          const ro = n === 1 ? 150 : 120, roX = n === 1 ? -56 : -40, roY = n === 1 ? -26 : -22, tkB = Math.min(58, Math.floor((tkW - 64) / 5.6));
          const wire = `M${f1(fw * .2)} 62 L${f1(fw * .5)} 8 L${f1(fw * .8)} 62`;
          return (
            <div key={p.id} data-fx="col" style={{ ...abs, left: x0 + i * (fw + gap), top, width: fw, height: fw - 12 + plH }}>
              <div data-fx="hang" style={{ ...abs, left: 0, top: 0, width: fw, height: fw - 12 + plH, transformOrigin: '50% -300px' }}>
                <svg width={fw} height="60" viewBox={`0 0 ${fw} 60`} style={{ ...abs, left: 0, top: -50, overflow: 'visible' }} aria-hidden="true">
                  <path d={wire} stroke="#000" strokeWidth="7" fill="none" strokeLinejoin="round" /><path d={wire} stroke="#c9a227" strokeWidth="3" fill="none" strokeLinejoin="round" />
                  <circle cx={fw / 2} cy="8" r="9" fill="#2a3034" stroke="#000" strokeWidth="3" /><circle cx={fw / 2 - 2} cy="6" r="3" fill="#9aa3a7" />
                </svg>
                <div className="ch-frame" style={{ left: 0, top: 0, width: fw, height: fw }}>
                  <div className="ch-mat"><div className="ch-photo"><Photo p={p} size={ph * .45} /></div></div>
                  <div style={{ ...abs, inset: 0, overflow: 'hidden', borderRadius: 6, pointerEvents: 'none' }}>
                    <div data-fx="sheen" style={{ ...abs, top: '-20%', bottom: '-20%', left: 0, width: '34%', opacity: 0, transform: 'translateX(-120%) skewX(-18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,250,225,.55) 45%, rgba(255,255,255,.75) 50%, rgba(255,250,225,.55) 55%, transparent)' }} />
                  </div>
                  <div className="ch-glint" style={{ left: fw - 40, top: 40 }} /><div className="ch-glint" style={{ left: 36, top: fw - 34 }} />
                </div>
                <div className="ch-plate" style={{ left: 18, top: fw - 12, width: plW, height: plH }}>
                  <div className="ch-plate-name" style={{ fontSize: nameFs, lineHeight: plH + 'px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>{p.name.toUpperCase()}</div>
                </div>
                <div data-fx="rosette" style={{ ...abs, left: roX, top: roY, width: ro, height: ro * 1.5, transform: 'rotate(-12deg)' }}>
                  <svg viewBox="-100 -100 200 300" width={ro} height={ro * 1.5} style={{ overflow: 'visible' }} aria-label="Champ rosette">
                    <path d="M-46 40 L-78 190 L-46 168 L-26 200 L-6 60Z" fill="#b8841e" stroke="#1a1200" strokeWidth="6" strokeLinejoin="round" />
                    <path d="M46 40 L78 190 L46 168 L26 200 L6 60Z" fill="#8a1a10" stroke="#1a1200" strokeWidth="6" strokeLinejoin="round" />
                    <path d={ROSETTE} fill="#e0b458" stroke="#1a1200" strokeWidth="6" strokeLinejoin="round" />
                    <circle r="66" fill="#8a1a10" stroke="#1a1200" strokeWidth="5" /><circle r="54" fill="url(#ch-medal)" stroke="#fff3c0" strokeWidth="3" />
                    <text y="-14" textAnchor="middle" fontFamily="'IM Fell English SC', serif" fontSize="30" fill="#3a2800">Champ</text>
                    <text y="40" textAnchor="middle" fontFamily="'Big Shoulders Display', Impact, sans-serif" fontWeight="900" fontSize="60" fill="#2a1e00">No.1</text>
                  </svg>
                </div>
              </div>
              <div className="ch-printer" style={{ left: 12, top: prY, width: prW, height: 44 }}>
                <div className="ch-plamp" style={{ left: 12, background: 'radial-gradient(circle at 36% 30%, #8a9297, #33373a 55%, #08090a)' }} />
                <div data-fx="plamp" className="ch-plamp" style={{ left: 12, background: 'radial-gradient(circle at 36% 30%, #fff8d0, #ffd84a 55%, #7a5a00)', boxShadow: '0 0 0 3px #0a0c0d, 0 0 0 4px #4a5358, 0 0 16px 4px rgba(255,216,74,.8)' }} />
                <div className="ch-plamp" style={{ right: 12, background: 'radial-gradient(circle at 36% 30%, #8a9297, #33373a 55%, #08090a)' }} />
                <div className="ch-slot" />
              </div>
              <div className="ch-feed" style={{ left: Math.round((fw - tkW) / 2), top: prY + 38, width: tkW, height: tkH + 16 }}>
                <div data-fx="ticket" className="ch-ticket" style={{ height: tkH, bottom: 'auto' }}>
                  <div className="ch-tk-big" style={{ fontSize: tkB, paddingTop: 24 }}>GOLDEN TICKET</div>
                  <div className="ch-tk-small" style={{ marginTop: 8 }}>SKIP 1 PUNISHMENT</div>
                </div>
              </div>
            </div>
          );
        })}
        <svg width="0" height="0" style={abs} aria-hidden="true"><defs><radialGradient id="ch-medal" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff3c0" /><stop offset=".5" stopColor="#e0b458" /><stop offset="1" stopColor="#8a6a00" /></radialGradient></defs></svg>

        <Sign text={n > 1 ? 'BIGGEST CHAMPS!' : 'BIGGEST CHAMP!'} variant="gold" fx="marquee" />
        <div data-fx="kicker" className="ch-kick" style={{ ...abs, left: 0, right: 0, top: 184 }}>MOST BEERS LOGGED SINCE THE LAST GAME</div>
        <div data-fx="panelL" className="ch-panel" style={{ left: 60, top: 300, width: 360, height: 380 }}>
          <div className="ch-dither" /><div className="ch-strip">Beers logged</div>
          <div data-fx="segBox" style={{ ...abs, left: 0, right: 0, top: 112, display: 'flex', justifyContent: 'center' }}>
            <Count n={beers} h={170} gold stripFx="segStrip" animate={!still} />
          </div>
          <div className="ch-quote" style={{ ...abs, left: 16, right: 16, bottom: 26, fontSize: 36 }}>since the <b>last game</b></div>
        </div>
        <div data-fx="panelR" className="ch-panel" style={{ left: 1500, top: 300, width: 360, height: 380, transform: 'rotate(1.5deg)' }}>
          <div className="ch-dither" /><div className="ch-strip">The prize</div>
          <div data-fx="prize" className="ch-ink" style={{ ...abs, left: 14, right: 14, top: 110, fontSize: 64, transform: 'rotate(-4deg)' }}>GOLDEN<br />TICKET!</div>
          <div className="ch-quote" style={{ ...abs, left: 16, right: 16, bottom: 24, fontSize: 38 }}>“Good work, <b>officer.</b>”</div>
        </div>
        <div data-fx="sub" className="ch-sub" style={{ ...abs, left: 60, width: 1400, top: subY, fontSize: subFs }}>{sub}</div>
        <button type="button" className="mk-key mk-key--sodium" style={{ ...abs, left: 1520, top: 944, width: 340, height: 120, fontSize: 60, zIndex: 5 }} onClick={e => { e.stopPropagation(); onDone(); }}>CONTINUE</button>
        {!still && <div style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 3 }}>
          {BITS.filter(b => b.front).map(bit)}
          {dust.map((d, i) => <div key={i} data-fx="dust" className="ch-dust" style={{ left: d.x, top: d.y, opacity: 0 }} data-p={d.p} />)}
        </div>}
        <div className="mk-grit" style={{ opacity: .12, zIndex: 4 }} />
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 4, background: "url('/textures/grain.png') 0 0 / 256px 256px", opacity: .05 }} />
      </div>
    </Stage>
  );
}

// ======================================================================== BIGGEST SLACKER
const LINES = [12, 24, 36, 48, 60, 72, 84, 96];
export function SlackerTV({ slackers, beers, onTrial, onSkip }: { slackers: Player[]; beers: number | null; onTrial: () => void; onSkip: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const still = reduced();
  const who = slackers.slice(0, 3), n = who.length;
  const b = beers ?? 0;
  const k = [0, .88, .84, .78][n] || .88, pw = Math.round(480 * k), gap = [0, 0, 80, 46][n];
  const cnt = Math.max(1, n), total = cnt * pw + (cnt - 1) * gap, x0 = Math.round(960 - total / 2), y0 = 250;
  const posters = (n ? who : [null]).map((p, i) => {
    let rot = [-1.4, 1.2, -.8][i] + (n === 1 ? .4 : 0);
    const sag = !!p && i === cnt - 1;
    if (sag) rot = +(rot + 4.5).toFixed(1);
    const name = p ? p.name.toUpperCase() : 'NOBODY';
    return { p, x: x0 + i * (pw + gap), y: y0 + (i === 1 ? 10 : 0), rot, sag, name, nameFs: Math.min(76, Math.floor(412 / Math.max(1, name.length * .5))) };
  });
  const pRight = x0 + total, pLeft = x0;
  const trbK = [0, .92, .8, .6][n], trbRot = -26;
  let trbX = n === 3 ? -150 : Math.round(pLeft - 500 * trbK - 60 - 500 * (1 - trbK)); if (n === 1) trbX = Math.round(pLeft - 560); if (n === 2) trbX = Math.round(pLeft - 520);
  const trbY = n === 3 ? 640 : 560;
  const wahL = n === 3 ? { x: pRight + 16, y: 300, s: .6 } : n === 2 ? { x: 44, y: 290, s: .8 } : { x: 120, y: 285, s: 1 };
  const wahs = n ? ([['WAH…', 0, 0, 76, -8], ['WAH…', 70, 96, 84, 4], ['WAHHHH…', 20, 204, 100, 12]] as const).map(([t, dx, dy, fs, r]) => ({ t, x: Math.round(wahL.x + dx * wahL.s), y: Math.round(wahL.y + dy * wahL.s), fs: Math.round(fs * wahL.s), r })) : [];
  const bagK = [.95, 1, .84, 0][n], bag = { show: n < 3, x: Math.round(pRight + (n === 2 ? 36 : 110)), y: n === 2 ? 330 : 290, full: n > 0 };
  const tick = Math.min(380, 1700 / Math.max(1, b));                     // the count limps up, but always lands inside the timeline
  const ticks = n ? [...Array(b + 1).keys()].map(v => Math.round(2700 + v * tick)) : null;
  const extra = Math.max(0, slackers.length - 3);                        // the TV shows three posters; the rest are named on the wall
  const sign = n ? { x: 526, w: 672, arrow: true, small: n > 1 ? 'OFF THEY GO' : 'OFF YOU GO', text: 'TO THE PUNISHMENT QUEUE' } : { x: 40, w: 1150, arrow: false, small: 'THE PUNISHMENT QUEUE', text: 'NO NEW ARRIVALS THIS ROUND' };
  useLayoutEffect(() => {
    const el = root.current; if (!el || still) return;
    const q = (s: string) => [...el.querySelectorAll(`[data-fx="${s}"]`)];
    const { tl, loop, A } = timeline(5000);
    tl(q('marquee')[0], [[0, op(0), 'steps(1,end)'], [100, op(1), 'steps(1,end)'], [170, op(.15), 'steps(1,end)'], [300, op(1)]]);
    tl(q('kicker')[0], [[250, { opacity: 0, transform: 'translateY(14px)' }, 'ease-out'], [600, { opacity: 1, transform: 'translateY(0px)' }]]);
    loop(q('light')[0], [{ transform: 'rotate(-.7deg)' }, { transform: 'rotate(.7deg)' }], { duration: 3600, direction: 'alternate', iterations: 4, easing: io });
    q('poster').forEach((po, i) => {
      const t = 500 + i * 160, one = (s: string) => po.querySelector(`[data-fx="${s}"]`), rot = +(po as HTMLElement).dataset.rot!;
      tl(one('slap'), [[t, { opacity: 0, transform: 'scale(1.4) rotate(-9deg)' }, 'cubic-bezier(.6,0,1,.6)'], [t + 170, { opacity: 1, transform: 'scale(.97) rotate(0deg)' }, 'ease-out'], [t + 260, { opacity: 1, transform: 'scale(1) rotate(0deg)' }]]);
      tl(one('undev'), [[t, op(1), 'steps(1,end)'], [1300, op(0)]]);
      tl(one('stamp'), [[1700 + i * 120, { opacity: 0, transform: 'translateX(-50%) rotate(-24deg) scale(2.3)' }, POP], [1920 + i * 120, { opacity: .92, transform: 'translateX(-50%) rotate(-11deg) scale(1)' }]]);
      tl(one('dunce'), [[2100 + i * 140, { opacity: 0, transform: 'translateY(-30px) rotate(-25deg) scale(.3)' }, POP], [2380 + i * 140, { opacity: 1, transform: 'translateY(0px) rotate(0deg) scale(1)' }]]);
      if ((po as HTMLElement).dataset.sag === 'true') {
        tl(one('tapeR'), [[3900, { opacity: 1, transform: 'translate(0px,0px) rotate(38deg)' }, 'ease-in'], [4400, { opacity: 0, transform: 'translate(40px,300px) rotate(160deg)' }]]);
        tl(po, [[0, tf(`rotate(${rot - 4.5}deg)`)], [3900, tf(`rotate(${rot - 6}deg)`), 'ease-in'], [4120, tf(`rotate(${rot + 1.8}deg)`), io], [4300, tf(`rotate(${rot - 1.6}deg)`), io], [4460, tf(`rotate(${rot + .6}deg)`), io], [4600, tf(`rotate(${rot}deg)`)]]);
      }
    });
    tl(q('flash')[0], [[1250, op(0), 'ease-out'], [1300, op(.8), 'ease-in'], [1650, op(0)]]);
    tl(q('count')[0], [[2300, tf('translateY(200px)'), 'cubic-bezier(.2,1.2,.4,1)'], [2650, tf('translateY(0px)')]]);
    if (ticks) {
      tl(q('segStrip')[0], ticks.map((t, v) => [t, tf(`translateY(${-v * 130}px)`), 'steps(1,end)'] as [number, Keyframe, string]));
      const last = ticks[ticks.length - 1], te = last + 250;
      q('num').forEach(e => tl(e, [[last, { opacity: 0, transform: 'scale(2.2)' }, POP], [last + 220, { opacity: 1, transform: 'scale(1)' }]]));
      tl(q('segBlink')[0], [[te, op(1), 'steps(1,end)'], [te + 200, op(.15), 'steps(1,end)'], [te + 400, op(1), 'steps(1,end)'], [te + 600, op(.15), 'steps(1,end)'], [te + 800, op(1)]]);
    }
    tl(q('bag')[0], [[2500, { opacity: 0, transform: `translateX(500px) scale(${bagK}) rotate(18deg)` }, 'cubic-bezier(.2,1.2,.4,1)'], [2950, { opacity: 1, transform: `translateX(0px) scale(${bagK}) rotate(4deg)` }]]);
    tl(q('note')[0], [[2600, { opacity: 0, transform: 'rotate(-5deg) scale(1.6)' }, POP], [2900, { opacity: 1, transform: 'rotate(-5deg) scale(1)' }]]);
    q('wah').forEach((w, i) => { const t = 2800 + i * 400, r = +(w as HTMLElement).dataset.r!; tl(w, [[t, { opacity: 0, transform: `translateY(-30px) rotate(${r - 10}deg) scale(1.5)` }, POP], [t + 240, { opacity: 1, transform: `translateY(0px) rotate(${r}deg) scale(1)` }]]); });
    const tb = (s: number) => tf(`scale(${trbK}) rotate(${s}deg)`), R = trbRot;
    tl(q('trombone')[0], [[2800, tb(0), io], [2950, tb(R * .3), io], [3200, tb(R * .3), io], [3350, tb(R * .6), io], [3600, tb(R * .6), io], [3800, tb(R * 1.15), io], [3950, tb(R * .92), io], [4100, tb(R)]]);
    tl(q('sign')[0], [[4000, tf('translateX(-1300px)'), 'cubic-bezier(.2,1.1,.4,1)'], [4450, tf('translateX(0px)')]]);
    // the host's keys are there and live from frame 0: only a lamp-on flicker
    tl(q('keys')[0], [[0, op(1), 'steps(1,end)'], [120, op(.55), 'steps(1,end)'], [200, op(1), 'steps(1,end)'], [300, op(.55), 'steps(1,end)'], [380, op(1)]]);
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Stage className="slacker-ov">
      <div ref={root} style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', isolation: 'isolate', background: '#0b0d0d', color: '#f1e8d4', fontFamily: "'Courier Prime', monospace" }} className="mk-motion">
        <div style={{ ...abs, inset: 0, background: "url('/textures/brick-bw.png') 0 0 / 512px auto", opacity: .38 }} />
        <div style={{ ...abs, inset: 0, background: 'radial-gradient(ellipse 60% 55% at 50% 42%, rgba(150,178,170,.2), rgba(10,14,14,.55) 60%, rgba(3,5,5,.94)), linear-gradient(180deg, rgba(4,6,6,.4), transparent 30%)' }} />
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{ ...abs, inset: 0 }} aria-hidden="true">
          <g stroke="#c9d3cc" strokeOpacity=".12" strokeWidth="3">{[300, 380, 460, 540, 620, 700, 780, 860].map(y => <line key={y} x1="0" x2="1920" y1={y} y2={y} />)}</g>
        </svg>
        <div data-fx="light" style={{ ...abs, inset: 0, pointerEvents: 'none', transformOrigin: '960px 150px' }}>
          <div style={{ ...abs, inset: 0, clipPath: 'polygon(890px 160px, 1030px 160px, 1860px 1080px, 60px 1080px)', background: 'linear-gradient(180deg, rgba(210,240,230,.14) 160px, rgba(190,220,210,.05) 700px, transparent)' }} />
        </div>
        {n > 0 && <div data-fx="trombone" style={{ ...abs, left: trbX, top: trbY, width: 500, height: 260, transformOrigin: '470px 150px', transform: `scale(${trbK}) rotate(${trbRot}deg)` }}>
          <svg viewBox="0 0 500 260" width="500" height="260" style={{ overflow: 'visible' }} aria-label="A drooping trombone">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M126 128 L300 128 M300 172 L196 172" stroke="#140e04" strokeWidth="20" /><path d="M300 128 L462 128 A22 22 0 0 1 462 172 L300 172" stroke="#140e04" strokeWidth="20" />
              <path d="M126 128 L300 128 M300 172 L196 172" stroke="#a88838" strokeWidth="10" /><path d="M300 128 L462 128 A22 22 0 0 1 462 172 L300 172" stroke="#a88838" strokeWidth="10" />
              <path d="M140 123 L290 123 M310 123 L450 123" stroke="#f0dc9a" strokeWidth="3" opacity=".7" />
              <path d="M236 128 L236 172 M394 128 L394 172" stroke="#140e04" strokeWidth="12" /><path d="M236 128 L236 172 M394 128 L394 172" stroke="#8a6e2a" strokeWidth="6" />
            </g>
            <path d="M130 116 Q80 96 26 50 L26 206 Q80 160 130 140 Z" fill="#b8963e" stroke="#140e04" strokeWidth="7" strokeLinejoin="round" />
            <ellipse cx="26" cy="128" rx="18" ry="80" fill="#3a2a08" stroke="#140e04" strokeWidth="7" />
            <path d="M60 88 Q90 108 118 118" stroke="#f0dc9a" strokeWidth="4" fill="none" opacity=".7" />
            <path d="M196 172 L176 172" stroke="#140e04" strokeWidth="16" strokeLinecap="round" /><path d="M196 172 L180 172" stroke="#c9a855" strokeWidth="8" strokeLinecap="round" />
          </svg>
        </div>}
        {wahs.map((w, i) => <div key={i} data-fx="wah" className="sl-wah" data-r={w.r} style={{ left: w.x, top: w.y, fontSize: w.fs, transform: `rotate(${w.r}deg)` }}>{w.t}</div>)}
        {n === 0 && <div data-fx="note" className="sl-wall-note" style={{ left: 150, top: 330, width: 460, fontSize: 64, transform: 'rotate(-5deg)' }}>NOBODY'S<br />PUNISHED<br />THIS TIME.</div>}
        {bag.show && <div data-fx="bag" style={{ ...abs, left: bag.x, top: bag.y, width: 380, height: 520, transformOrigin: '0 0', transform: `scale(${bagK}) rotate(4deg)` }}>
          <svg viewBox="0 0 380 520" width="380" height="520" style={{ ...abs, inset: 0, overflow: 'visible' }} aria-label={bag.full ? 'Evidence bag: an untouched pint' : 'Evidence bag: an empty pint glass'}>
            <rect x="8" y="14" width="364" height="500" rx="10" fill="#000" opacity=".45" transform="translate(10 12)" />
            <rect x="8" y="14" width="364" height="500" rx="10" fill="#b8c8cc" fillOpacity=".13" stroke="#dbe6e8" strokeOpacity=".55" strokeWidth="3" />
            <rect x="8" y="14" width="364" height="52" rx="6" fill="#c2371f" />
            <text x="190" y="52" textAnchor="middle" fontFamily="'Big Shoulders Stencil Display', Impact, sans-serif" fontWeight="900" fontSize="38" letterSpacing="6" fill="#f1e8d4">EVIDENCE</text>
            <path d="M8 74 H372" stroke="#dbe6e8" strokeOpacity=".6" strokeWidth="3" strokeDasharray="10 6" />
            <path d="M108 118 L272 118 L256 392 Q190 404 124 392 Z" fill="#dbe6e8" fillOpacity=".12" stroke="#e8f0f2" strokeOpacity=".75" strokeWidth="5" strokeLinejoin="round" />
            {bag.full ? <>
              <path d="M114 150 L266 150 L256 386 Q190 398 124 386 Z" fill="#d98a1a" />
              <path d="M114 150 L266 150 L263 196 L117 196 Z" fill="#f0a82e" opacity=".55" />
              <path d="M104 150 Q112 116 146 122 Q166 104 196 118 Q226 104 246 122 Q278 116 276 150 Q190 164 104 150 Z" fill="#fbf4e2" stroke="#d8ccb0" strokeWidth="3" />
              <g fill="#ffd27a" opacity=".8"><circle cx="160" cy="250" r="4" /><circle cx="172" cy="300" r="3" /><circle cx="214" cy="226" r="4" /><circle cx="226" cy="330" r="3" /><circle cx="190" cy="360" r="3" /></g>
            </> : <>
              <path d="M120 360 Q190 374 258 360" stroke="#d98a1a" strokeWidth="6" fill="none" opacity=".6" />
              <path d="M112 170 Q140 176 150 168 M230 200 Q250 206 262 198" stroke="#fbf4e2" strokeWidth="5" fill="none" opacity=".6" />
            </>}
            <path d="M130 130 L140 380" stroke="#fff" strokeWidth="8" opacity=".25" /><path d="M40 90 L110 90 L50 500 L20 500 Z" fill="#fff" opacity=".07" />
            <g transform="translate(46 410) rotate(-3)">
              <rect width="288" height="92" rx="4" fill="#f1e8d4" stroke="#1b1712" strokeWidth="3" />
              <text x="144" y="38" textAnchor="middle" fontFamily="'Special Elite', monospace" fontSize="34" fill="#1b1712">EXHIBIT A</text>
              <text x="144" y="80" textAnchor="middle" fontFamily="'Permanent Marker', cursive" fontSize="36" fill={bag.full ? '#c2371f' : '#2f6a2a'}>{bag.full ? 'UNTOUCHED' : 'EMPTY. GOOD.'}</text>
            </g>
          </svg>
        </div>}
        {posters.map((po, i) => (
          <div key={i} data-fx="poster" data-rot={po.rot} data-sag={po.sag ? 'true' : 'false'} style={{ ...abs, left: po.x, top: po.y, width: pw, height: Math.round(720 * k), transformOrigin: '0 0', transform: `rotate(${po.rot}deg)` }}>
            <div data-fx="slap" style={{ ...abs, inset: 0, transformOrigin: '50% 40%' }}>
              <div className="sl-shadow" style={{ transform: `scale(${k})` }} />
              <div className="sl-poster" style={{ transform: `scale(${k})` }}>
                <div className="sl-grain" />
                <div className="sl-wanted">WANTED</div>
                <div className="sl-for">FOR NOT DRINKING</div>
                <div className="sl-photo">
                  {po.p ? <Photo p={po.p} size={130} /> : <svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#3a4244" />
                    <path d="M4 100C8 78 26 70 50 70C74 70 92 78 96 100ZM50 20C63 20 71 30 71 45C71 60 62 70 50 70C38 70 29 60 29 45C29 30 37 20 50 20Z" fill="none" stroke="#e8f0ee" strokeOpacity=".6" strokeWidth="1.4" strokeDasharray="3 2.4" />
                    <text x="50" y="56" textAnchor="middle" fontFamily="'Big Shoulders Display', Impact, sans-serif" fontWeight="900" fontSize="32" fill="#e8f0ee" fillOpacity=".7">?</text></svg>}
                  {/* the booking-room height lines over the mugshot */}
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ...abs, inset: 0, width: '100%', height: '100%' }} aria-hidden="true"><g stroke="#e8f0ee" strokeOpacity=".3" strokeWidth=".8">{LINES.map(l => <line key={l} x1="0" x2="100" y1={l} y2={l} />)}</g></svg>
                  {!still && <div data-fx="undev" style={{ ...abs, inset: 0, background: '#2a2a28', opacity: 0 }} />}
                  {po.p && <svg data-fx="dunce" viewBox="0 0 100 100" style={{ ...abs, left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', transformOrigin: '50% 40%' }} aria-label="a dunce cap drawn on in marker">
                    <g transform="rotate(15 50 30)">
                      <path d="M38 31 L50 -26 L62 31" fill="none" stroke="#000" strokeWidth="5.6" strokeLinejoin="round" strokeLinecap="round" opacity=".55" />
                      <path d="M38 31 L50 -26 L62 31" fill="none" stroke="#f4efe0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                      <path d="M35 31 Q50 36 65 30" fill="none" stroke="#f4efe0" strokeWidth="3" strokeLinecap="round" />
                      <text x="50" y="26" textAnchor="middle" fontFamily="'Permanent Marker', cursive" fontSize="30" fill="#ff5a3c" stroke="#1b1712" strokeWidth="1">D</text>
                    </g>
                  </svg>}
                </div>
                <div className="sl-name" style={{ fontSize: po.nameFs, whiteSpace: 'nowrap' }}>{po.name}</div>
                <div className="sl-seen" style={{ fontSize: po.p ? 40 : 38 }}>{po.p ? <>LOGGED <b data-fx="num">{b}</b>{b === 1 ? ' BEER' : ' BEERS'}</> : 'EVERYONE DRANK'}</div>
                <div className="sl-reward">{po.p ? 'REWARD: 1 PUNISHMENT' : 'NO REWARD OFFERED'}</div>
                <div data-fx="stamp" className={'sl-stamp' + (po.p ? '' : ' ok')} style={{ top: po.p ? 434 : 380, transform: 'translateX(-50%) rotate(-11deg)' }}>{po.p ? 'SLACKER' : 'CASE CLOSED'}</div>
              </div>
              <div className="sl-tape" style={{ left: k * 240 - 60, top: -16, transform: 'rotate(-3deg)' }} />
              <div data-fx="tapeR" className="sl-tape" style={{ left: pw - 70, top: -12, transform: 'rotate(38deg)', opacity: po.sag ? 0 : 1 }} />
              <div className="sl-tape" style={{ left: -40, top: -8, transform: 'rotate(-38deg)' }} />
            </div>
          </div>
        ))}
        <Sign text={n === 0 ? 'NO SLACKERS' : n > 1 ? 'BIGGEST SLACKERS' : 'BIGGEST SLACKER'} variant={n === 0 ? 'green' : ''} fx="marquee" />
        <div data-fx="kicker" className="sl-kick" style={{ ...abs, left: 0, right: 0, top: 184 }}>{n === 0 ? 'EVERYONE LOGGED THE SAME SINCE THE LAST GAME' : 'FEWEST BEERS LOGGED SINCE THE LAST GAME'}</div>
        {!still && <div data-fx="flash" style={{ ...abs, inset: 0, background: '#f4fbff', opacity: 0, pointerEvents: 'none', zIndex: 5 }} />}
        {n > 0 && <div data-fx="count" className="sl-panel" style={{ left: 40, top: 924, width: 460, height: 128 }}>
          <div className="sl-mlabel" style={{ ...abs, left: 34, top: 22 }}>BEERS<br />LOGGED</div>
          <div style={{ ...abs, right: 22, top: 16 }}><Count n={b} h={90} stripFx="segStrip" blinkFx="segBlink" animate={!still} /></div>
        </div>}
        <div data-fx="sign" className="sl-sign" style={{ left: sign.x, top: 924, width: sign.w, height: 128 }}>
          <div className="mk-hazard" style={{ ...abs, inset: 0 }} />
          <div className="sl-sign-face">
            {sign.arrow && <svg viewBox="0 0 80 60" width="80" height="60" style={{ flex: 'none' }} aria-hidden="true"><path d="M4 22 H46 V6 L76 30 L46 54 V38 H4 Z" fill="#ff8a1e" stroke="#000" strokeWidth="4" strokeLinejoin="round" /></svg>}
            <div className="sl-sign-text"><small>{sign.small}</small>{sign.text}</div>
          </div>
        </div>
        {extra > 0 && <div className="sl-wah" style={{ left: 1240, top: 830, fontSize: 56, transform: 'rotate(-4deg)', color: '#ff6a50' }}>+{extra} MORE: {slackers.slice(3).map(p => p.name.toUpperCase()).join(', ')}</div>}
        <div data-fx="keys" style={{ ...abs, left: 1222, top: 928, display: 'flex', gap: 26, zIndex: 6 }}>
          <button type="button" className="mk-key mk-key--red" style={{ height: 116, fontSize: 52, padding: '0 34px 4px' }} onClick={onTrial}>START THE TRIAL</button>
          <button type="button" className="mk-key" style={{ height: 116, fontSize: 52, minWidth: 190 }} onClick={onSkip}>SKIP</button>
        </div>
        <div className="mk-grit" style={{ opacity: .14, zIndex: 4 }} />
        <div style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 4, background: "url('/textures/grain.png') 0 0 / 256px 256px", opacity: .06 }} />
      </div>
    </Stage>
  );
}
