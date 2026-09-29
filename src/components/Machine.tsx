// React parts of the machine kit (see src/tv/machineKit.ts and src/styles/machine.css), shared by the TV boards and
// the phones of The Bomb, Penny Drop and Jack-in-the-Box.
import type { CSSProperties } from 'react';
import { initials } from '../lib/util';
import { f1, marquee, segments } from '../tv/machineKit';

export type Seat = { id: string; name: string; photo: string | null };

/** A player's selfie, or their initials on a blank tile. Fills its box. */
export function Face({ p, size = 60 }: { p?: Seat | null; size?: number }) {
  return p?.photo
    ? <img src={p.photo} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #2c6e74, #0f3a41 55%, #06191d)', color: '#f1e8d4', fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: size }}>{initials(p?.name ?? '?')}</div>;
}

/**
 * The LED marquee: `cols` × 9 dots. scroll: the text loops leftwards in whole-dot steps (`step` seconds per dot); the lit
 * strip is drawn ONCE and slid as a whole (never animate single dots). Otherwise the text sits centred.
 */
export function Marquee({ text, pitch = 14, cols, scroll = false, step = .085, gold = false, fx, style, stripStyle }: {
  text: string; pitch?: number; cols: number; scroll?: boolean; step?: number; gold?: boolean; fx?: string; style?: CSSProperties; stripStyle?: CSSProperties;
}) {
  const m = marquee(text, pitch, scroll ? { loop: true, gap: 10, fill: cols } : {});
  const left = scroll ? 0 : Math.floor((cols - m.textCols) / 2) * pitch;
  const steps = Math.round(m.period / pitch);
  return (
    <div className={'mk-marquee' + (gold ? ' mk-marquee--gold' : '')} style={{ '--mk-pitch': pitch + 'px', ...style } as CSSProperties}>
      <div className="mk-marquee-screen" style={{ width: cols * pitch, height: m.height }}>
        <svg data-fx={fx} className={'mk-marquee-strip' + (scroll ? ' mk-scroll' : '')} width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`} aria-label={text}
          style={{ left, '--mk-shift': `-${m.period}px`, '--mk-steps': steps, '--mk-dur': `${f1(steps * step)}s`, ...stripStyle } as CSSProperties}>
          <path className="mk-dot-halo" d={m.d} /><path className="mk-dot" d={m.d} />
        </svg>
      </div>
    </div>
  );
}

/** A second strip in the same screen (e.g. BOOM. landing over PASS IT.): only the lit dots, positioned by the caller. */
export function MarqueeStrip({ text, pitch = 14, cols, fx, style }: { text: string; pitch?: number; cols: number; fx?: string; style?: CSSProperties }) {
  const m = marquee(text, pitch);
  return (
    <svg data-fx={fx} className="mk-marquee-strip" width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`} aria-label={text}
      style={{ left: Math.floor((cols - m.textCols) / 2) * pitch, ...style }}>
      <path className="mk-dot-halo" d={m.d} /><path className="mk-dot" d={m.d} />
    </svg>
  );
}

/** Seven-segment digits in a recessed bezel. variant: '' (red) | 'green' | 'amber' | 'gold'. */
export function Seg({ text, h = 100, variant = '', style, className = '' }: { text: string; h?: number; variant?: string; style?: CSSProperties; className?: string }) {
  const s = segments(text, { h });
  return (
    <div className={'mk-seg' + (variant ? ' mk-seg--' + variant : '') + (className ? ' ' + className : '')} style={style}>
      <svg viewBox={`0 0 ${s.width} ${s.height}`} width={s.width} height={s.height} aria-label={text}>
        <path className="mk-seg-ghost" d={s.ghost} /><path className="mk-seg-glow" d={s.lit} /><path className="mk-seg-lit" d={s.lit} />
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ the Bomb (the TV and the holder's phone draw the same console)
const STICKS = [112, 146, 180, 214];
const WIRES = [
  { d: 'M106 50 C 56 36, 30 80, 58 118', c: '#e0200e' }, { d: 'M106 84 C 70 88, 66 110, 84 124', c: '#e8c53a' },
  { d: 'M294 50 C 346 36, 372 84, 340 118', c: '#3a78d8' }, { d: 'M294 86 C 330 92, 332 112, 318 124', c: '#5fe070' },
];
const ARMED = (() => { const m = marquee('ARMED', 5, { pad: 1 }); return { d: m.d, w: m.width, h: m.height, x: f1(200 - m.width / 2), y: f1(63 - m.height / 2) }; })();

/**
 * The bomb as a console (viewBox 0 0 400 270): dynamite, silver tape, wires and a readout that says ARMED in dot-matrix,
 * blinking at a constant rate. It is a word, never a clock: the fuse is secret. `id` prefixes the gradient ids.
 */
export function BombArt({ id, blink = 'bm' }: { id: string; blink?: 'bm' | 'bp' }) {
  return (
    <svg viewBox="0 0 400 270" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-label="The bomb">
      <defs>
        <linearGradient id={id + '-stick'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7050" /><stop offset=".28" stopColor="#d8301c" /><stop offset=".72" stopColor="#9c180b" /><stop offset="1" stopColor="#4e0904" /></linearGradient>
        <linearGradient id={id + '-steel'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d777c" /><stop offset=".35" stopColor="#3a4146" /><stop offset="1" stopColor="#15191b" /></linearGradient>
        <linearGradient id={id + '-tape'} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5d6367" /><stop offset=".35" stopColor="#c9cdd0" /><stop offset=".55" stopColor="#9aa0a4" /><stop offset="1" stopColor="#4a4f52" /></linearGradient>
        <pattern id={id + '-haz'} width="24" height="24" patternUnits="userSpaceOnUse"><image href="/textures/hazard.png" width="24" height="24" /></pattern>
        <pattern id={id + '-ledoff'} x={ARMED.x} y={ARMED.y} width="5" height="5" patternUnits="userSpaceOnUse"><image href="/textures/led-off.png" width="5" height="5" /></pattern>
      </defs>
      <ellipse cx="200" cy="262" rx="196" ry="14" fill="#000" opacity=".7" />
      {STICKS.map(y => <g key={y}>
        <rect x="22" y={y} width="356" height="40" rx="20" fill={`url(#${id}-stick)`} stroke="#000" strokeWidth="4" />
        <path d={`M48 ${y + 10} H352`} stroke="#ffb49a" strokeWidth="4" strokeLinecap="round" opacity=".45" />
        <ellipse cx="38" cy={y + 20} rx="12" ry="18" fill="#e9dcc0" stroke="#000" strokeWidth="3" />
        <circle cx="38" cy={y + 20} r="4" fill="#3a2a1a" />
      </g>)}
      <g stroke="#000" strokeWidth="4">
        <path d="M94 108 L132 106 L134 258 L96 260 L92 250 L96 240 Z" fill={`url(#${id}-tape)`} />
        <path d="M266 106 L304 108 L306 250 L302 258 L268 260 L264 246 Z" fill={`url(#${id}-tape)`} />
      </g>
      <g fill="none" strokeLinecap="round">
        {WIRES.map(w => <g key={w.c}>
          <path d={w.d} stroke="#000" strokeWidth="12" /><path d={w.d} stroke={w.c} strokeWidth="7" />
          <path d={w.d} stroke="#fff" strokeWidth="2" opacity=".35" transform="translate(-1 -2)" />
        </g>)}
      </g>
      <rect x="104" y="10" width="192" height="120" rx="9" fill={`url(#${id}-steel)`} stroke="#000" strokeWidth="5" />
      <path d="M112 16 H288" stroke="#c9d1d4" strokeWidth="3" opacity=".45" />
      {[[116, 22], [284, 22], [116, 118], [284, 118]].map(([x, y]) => <circle key={x + '-' + y} cx={x} cy={y} r="4.5" fill="#9aa3a7" stroke="#000" strokeWidth="2" />)}
      <rect x="120" y="28" width="160" height="70" rx="4" fill="#0b0101" stroke="#000" strokeWidth="4" />
      <rect x={ARMED.x} y={ARMED.y} width={ARMED.w} height={ARMED.h} fill={`url(#${id}-ledoff)`} />
      <g className={blink + '-armed'} transform={`translate(${ARMED.x} ${ARMED.y})`}>
        <path d={ARMED.d} fill="#ff2b1a" stroke="#ff2b1a" strokeWidth="2.4" opacity=".3" /><path d={ARMED.d} fill="#ff5a3c" />
      </g>
      <path d="M124 32 L276 32 L240 58 L124 58 Z" fill="#fff" opacity=".05" />
      <rect x="124" y="106" width="104" height="14" fill={`url(#${id}-haz)`} stroke="#000" strokeWidth="2" />
      <circle cx="260" cy="113" r="11" fill="#2a0604" stroke="#000" strokeWidth="3" />
      <circle className={blink + '-blink'} cx="260" cy="113" r="8" fill="#ff2b1a" />
      <circle cx="257" cy="110" r="3" fill="#ffd8cc" opacity=".8" />
    </svg>
  );
}

/** The ten-lamp pass bar: a tally of passes that fills at ten (the tension cap). Never a countdown. */
export function PassBar({ passes, cls = 'bm-bar' }: { passes: number; cls?: string }) {
  return <>{Array.from({ length: 10 }, (_, i) => <div key={i} className={cls + (i < Math.min(passes, 10) ? ' is-on' : '')} />)}</>;
}
export const passLabel = (p: number) => (p === 1 ? '1 PASS SO FAR' : `${p} PASSES SO FAR`);
