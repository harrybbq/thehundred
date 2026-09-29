// The phone sides of Walk the Plank and Dodge, ported from the approved mockups (design/mockups/PlankPhone.dc.html,
// DodgePhone.dc.html). Baked textures only (public/textures/), no SVG filters; motion is transform/opacity, and the
// ambient loops (the walker's bob, the sea, the rain) stop for reduced motion.
import { useEffect, useRef, useState } from 'react';
import { initials } from '../lib/util';

const TEX = '/textures/';
const f1 = (n: number) => n.toFixed(1);
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const abs = { position: 'absolute' } as const;
export const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

function Face({ photo, name, size }: { photo: string | null; name: string; size: number }) {
  return photo
    ? <img src={photo} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg, #2c6e74, #0f3a41 55%, #06191d)', color: '#f1e8d4', fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: size }}>{initials(name)}</div>;
}
/** Web Animations on [data-fx] children, cancelled on unmount; skipped for reduced motion. */
function useFx(root: React.RefObject<HTMLElement>, run: (q: (s: string) => HTMLElement[]) => Animation[], deps: unknown[]) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const A = run(s => [...el.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`)]);
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ======================================================================== Walk the Plank
// the plank in the mini-scene is drawn once; the walker rides along it by transform
const X0 = 108, PL = 222, Y0 = 112, T = 10, SAG = 18;
const PX = (k: number) => X0 + PL * (1.2 * k * (1 - k) + k * k), PY = (k: number) => Y0 + k * k * SAG;
const TX = X0 + PL, TY = Y0 + SAG, CX = X0 + PL * .6;
const PLANK_D = `M ${X0} ${Y0} Q ${f1(CX)} ${Y0} ${f1(TX)} ${f1(TY)} L ${f1(TX)} ${f1(TY + T)} Q ${f1(CX)} ${Y0 + T} ${X0} ${Y0 + T} Z`;
const DANGER_D = (() => { const dx0 = PX(.86), dy0 = PY(.86); return `M ${f1(dx0)} ${f1(dy0)} Q ${f1((dx0 + TX) / 2)} ${f1((dy0 + TY) / 2 - 1)} ${f1(TX)} ${f1(TY)} L ${f1(TX)} ${f1(TY + T)} L ${f1(dx0)} ${f1(dy0 + T)} Z`; })();
const TENT = (() => {
  const Lp: number[][] = [], Rp: number[][] = [], S: { x: string; y: string; r: string; ry: string }[] = [];
  for (let k = 0; k <= 24; k++) {
    const q = k / 24, y = 300 - q * 290, x = 70 + Math.sin(q * 5.2) * 28 * q, w = 56 * Math.pow(1 - q, .9) + 6;
    Lp.push([x - w, y]); Rp.push([x + w, y]);
    if (k % 3 === 1 && q < .86) { const r = Math.max(5, w * .36); S.push({ x: f1(x + w * .5), y: f1(y), r: f1(r), ry: f1(r * .82) }); }
  }
  return { d: 'M ' + Lp.concat(Rp.reverse()).map(p => p.map(f1).join(' ')).join(' L ') + ' Z', S };
})();
/** Where the walker stands in the mini-scene at pos (0..110; past 100 they're off the end, dropping). */
function walkerAt(pos: number) {
  const u = Math.min(1, Math.max(0, pos) / 100);
  const off = Math.max(0, pos - 100);                    // overboard: a little past the tip and falling
  return { x: PX(u) - 30 + off * 1.4, y: PY(u) - 70 + off * off * .9 };
}

export function PlankPhone({ pos, done, name, photo, onStop }: { pos: number; done: boolean; name: string; photo: string | null; onStop: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useFx(root, q => [
    ...q('pbob').map(el => el.animate([{ transform: 'translateY(0) rotate(-3deg)' }, { transform: 'translateY(-3px) rotate(3deg)' }], { duration: 340, iterations: Infinity, direction: 'alternate' })),
    ...q('sea').map(el => el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-700px)' }], { duration: 30000, iterations: Infinity })),
  ], [done]);
  const w = walkerAt(pos);
  const over = pos > 100;
  return (
    <div ref={root} className="phone takeover mgp mgp-plank">
      <svg width="0" height="0" style={abs} aria-hidden="true">
        <defs>
          <pattern id="pp-wood" width="256" height="48" patternUnits="userSpaceOnUse"><image href={TEX + 'wood-hull.png'} width="256" height="48" /></pattern>
          <pattern id="pp-woodp" width="256" height="48" patternUnits="userSpaceOnUse"><image href={TEX + 'wood-plank.png'} width="256" height="48" /></pattern>
          <linearGradient id="pp-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd9a0" stopOpacity=".2" /><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#140a04" stopOpacity=".6" /></linearGradient>
          <linearGradient id="pp-hull" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2e1f14" /><stop offset=".7" stopColor="#22170e" /><stop offset="1" stopColor="#0c0806" /></linearGradient>
          <linearGradient id="pp-gilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2c07a" /><stop offset=".5" stopColor="#a47c3a" /><stop offset="1" stopColor="#4a3314" /></linearGradient>
          <linearGradient id="pp-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe2a8" /><stop offset=".5" stopColor="#f3a04a" /><stop offset="1" stopColor="#9a4a16" /></linearGradient>
          <radialGradient id="pp-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffc878" stopOpacity=".6" /><stop offset=".5" stopColor="#ff8a1e" stopOpacity=".15" /><stop offset="1" stopColor="#ff8a1e" stopOpacity="0" /></radialGradient>
          <linearGradient id="pp-tent" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#6e1d42" /><stop offset=".4" stopColor="#b8406e" /><stop offset="1" stopColor="#e2799f" /></linearGradient>
        </defs>
      </svg>
      <div className="mgp-kick">Walk the Plank</div>
      <div className="mgp-big">{!done ? "You're walking" : over ? 'OVERBOARD!' : `Stopped at ${Math.round(pos)}`}</div>

      {/* the mini-scene: the galleon's flat carved transom, your plank, the Kraken under the edge */}
      <div className="mgp-scene">
        <div style={{ ...abs, left: 180, top: 20, width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 38% 36%, #f6fbf8, #cfe2dc 70%)', boxShadow: '0 0 18px rgba(230,250,244,.5)' }} />
        <div style={{ ...abs, left: 0, top: 124, width: 350, height: 126, background: 'linear-gradient(180deg, #0f4a55, #083039 50%, #041d23)' }} />
        <div style={{ ...abs, left: 0, top: 124, width: 350, height: 126, overflow: 'hidden' }}>
          <div data-fx="sea" style={{ width: 1400, height: '100%', background: `url('${TEX}sea-mid.png') repeat-x 0 0 / 700px 126px`, opacity: .95 }} />
        </div>
        <div style={{ ...abs, left: 0, top: 123, width: 350, height: 2, background: 'rgba(170,230,222,.45)' }} />
        <svg viewBox="0 0 350 250" style={{ ...abs, inset: 0, width: 350, height: 250, overflow: 'visible' }} aria-hidden="true">
          <path d="M -4 26 Q 50 14 106 22 L 108 254 L -4 254 Z" fill="url(#pp-hull)" />
          <path d="M -4 26 Q 50 14 106 22 L 108 254 L -4 254 Z" fill="url(#pp-wood)" opacity=".6" />
          <path d="M -4 120 H 108 M -4 140 H 108 M -4 160 H 108 M -4 180 H 108 M -4 200 H 108 M -4 220 H 108 M -4 240 H 108" stroke="#0a0604" strokeWidth="1.6" />
          {[2, 26, 50, 74].map((x, i) => (
            <g key={x}>
              <path d={`M ${x} 70 L ${x} 44 Q ${x + 8} 34 ${x + 16} 44 L ${x + 16} 70 Z`} fill={i < 3 ? 'url(#pp-glass)' : '#2a1a0e'} stroke="#1a1006" strokeWidth="3" />
              <path d={`M ${x + 8} 40 V 70 M ${x} 56 H ${x + 16}`} stroke="#2a1606" strokeWidth="1.4" />
            </g>
          ))}
          {[-4, 20, 44, 68, 92].map(x => <rect key={x} x={x} y="38" width="4" height="34" fill="url(#pp-gilt)" />)}
          <circle cx="40" cy="58" r="44" fill="url(#pp-glow)" />
          <rect x="-4" y="72" width="110" height="4" fill="url(#pp-gilt)" />
          <rect x="-4" y="76" width="110" height="12" fill="#0a0604" />
          <path d={Array.from({ length: 16 }, (_, i) => `M ${i * 7} 77 v 10`).join(' ')} stroke="#c8a25a" strokeWidth="3" />
          <rect x="-4" y="88" width="112" height="4" fill="#c8a25a" />
          <rect x="6" y="98" width="86" height="14" fill="#4a1410" stroke="url(#pp-gilt)" strokeWidth="2" />
          <path d="M -4 28 Q 50 16 106 24" stroke="#050302" strokeWidth="10" fill="none" />
          <path d="M -4 26 Q 50 14 106 22" stroke="url(#pp-gilt)" strokeWidth="5" fill="none" />
          <ellipse cx="46" cy="22" rx="12" ry="8" fill="url(#pp-gilt)" stroke="#050302" strokeWidth="2" /><circle cx="46" cy="21" r="3.5" fill="#efe2c2" />
          <path d="M 106 22 L 108 254" stroke="#050302" strokeWidth="4" />
          <path d="M 107 26 L 109 254" stroke="#cdf6ef" strokeWidth="1.4" opacity=".7" />
          <rect x="96" y="104" width="14" height="28" fill="#050302" />
          <circle cx="104" cy="118" r="22" fill="url(#pp-glow)" />
          <path d="M 110 104 l 14 -20" stroke="#5a1410" strokeWidth="5" strokeLinecap="round" />
          <path d="M 104 30 L 122 26" stroke="#15181a" strokeWidth="3" />
          <circle cx="122" cy="46" r="28" fill="url(#pp-glow)" />
          <path d="M 116 34 L 128 34 L 130 56 L 114 56 Z" fill="#ffd89a" stroke="#1a1006" strokeWidth="2.5" />
          <path d="M 114 34 L 130 34 L 126 28 L 118 28 Z M 114 56 L 130 56 L 126 61 L 118 61 Z" fill="url(#pp-gilt)" />
          {/* your plank: thick outline, baked grain, the last stretch darkened */}
          <path d={PLANK_D} fill="url(#pp-woodp)" />
          <path d={PLANK_D} fill="url(#pp-shade)" />
          <path d={DANGER_D} fill="rgba(4,20,24,.55)" />
          <path d={PLANK_D} fill="none" stroke="#0a0604" strokeWidth="3" strokeLinejoin="round" />
          <path d={`M 292 ${f1(TY + T + 2)} v 9 M 306 ${f1(TY + T + 2)} v 14 M 320 ${f1(TY + T + 2)} v 7`} stroke="#bfe9e2" strokeWidth="2" strokeLinecap="round" opacity=".6" />
          <g transform="translate(300 146) scale(.34)">
            <path d={TENT.d} fill="url(#pp-tent)" stroke="#12040b" strokeWidth="12" strokeLinejoin="round" />
            {TENT.S.map((k, i) => <ellipse key={i} cx={k.x} cy={k.y} rx={k.r} ry={k.ry} fill="#f5d6c8" stroke="#12040b" strokeWidth="5" />)}
          </g>
          <path d={`M 322 42 Q 336 70 331 ${Math.round(TY - 8)}`} stroke="#050302" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d={`M 322 42 Q 336 70 331 ${Math.round(TY - 8)}`} stroke="#f4efe4" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={`M 324 ${Math.round(TY - 17)} L 331 ${Math.round(TY - 8)} L 339 ${Math.round(TY - 16)}`} stroke="#f4efe4" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 268 252 Q 280 238 296 246 Q 310 234 324 244 Q 338 236 352 248" fill="#e2f8f4" stroke="#0a3a40" strokeWidth="2" />
        </svg>
        <div className="mgp-edge">edge</div>
        {/* you: moved along the plank by transform, never by relayout */}
        <div style={{ ...abs, left: 0, top: 0, width: 60, height: 72, transform: `translate(${f1(w.x)}px, ${f1(w.y)}px)` }}>
          <div data-fx={done ? 'still' : 'pbob'} style={{ width: '100%', height: '100%', padding: '4px 4px 12px', boxSizing: 'border-box', background: '#f4efe4', boxShadow: '0 0 0 3px #0a0604, -4px 6px 8px rgba(0,0,0,.6)' }}>
            <Face photo={photo} name={name} size={24} />
          </div>
        </div>
      </div>

      <div className="mgp-heart">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 21 C 5 15 2 11 2 7.5 A 4.5 4.5 0 0 1 12 5 A 4.5 4.5 0 0 1 22 7.5 C 22 11 19 15 12 21 Z" fill="#e8391f" stroke="#2a0303" strokeWidth="1.5" /></svg>
        <span>{done ? 'The TV shows everyone at the end' : 'Buzzes faster near the edge'}</span>
      </div>
      {!done
        ? <button type="button" className="mgp-stop" onClick={onStop}>STOP</button>
        : <div className="mgp-wait">Waiting for the others…</div>}
      <div className="mgp-hint">Stop as close to the edge as you dare. Go over and you're in the sea.</div>
    </div>
  );
}

// ======================================================================== Dodge
const ARROWS = ['M 72 222 H 22 M 42 200 L 20 222 L 42 244', 'M 278 222 H 328 M 308 200 L 330 222 L 308 244', 'M 175 84 V 26 M 153 48 L 175 24 L 197 48'];
const DIRS = [
  { dir: 'left', label: 'LEFT', icon: 'M19 12 H5 M11 6 L5 12 L11 18' },
  { dir: 'high', label: 'HIGH', icon: 'M12 19 V5 M6 11 L12 5 L18 11' },
  { dir: 'right', label: 'RIGHT', icon: 'M5 12 H19 M13 6 L19 12 L13 18' },
];
/** The faceted shuriken (the same as the TV's): a lit and a shaded plane per blade, a raised ring. */
function StarDefs() {
  return (
    <svg width="0" height="0" style={abs} aria-hidden="true">
      <defs>
        <linearGradient id="dp-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf5e8" /><stop offset=".45" stopColor="#8d8577" /><stop offset="1" stopColor="#0a0b0c" /></linearGradient>
        <linearGradient id="dp-ring-in" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f2529" /><stop offset="1" stopColor="#9aa5ac" /></linearGradient>
        <symbol id="dp-star" viewBox="-100 -100 200 200" overflow="visible">
          <path d="M0-98 L-24-24 L0 0Z" fill="#f4ecdc" /><path d="M0-98 L24-24 L0 0Z" fill="#111417" />
          <path d="M98 0 L24-24 L0 0Z" fill="#dcd2bf" /><path d="M98 0 L24 24 L0 0Z" fill="#0a0c0e" />
          <path d="M0 98 L24 24 L0 0Z" fill="#07080a" /><path d="M0 98 L-24 24 L0 0Z" fill="#b3aa99" />
          <path d="M-98 0 L-24 24 L0 0Z" fill="#cdc3b0" /><path d="M-98 0 L-24-24 L0 0Z" fill="#fbf5e8" />
          <path d="M0-98 L-24-24 M-98 0 L-24-24" stroke="#ffffff" strokeWidth="2.5" opacity=".9" fill="none" />
          <path d="M0-98 L24-24 L98 0 L24 24 L0 98 L-24 24 L-98 0 L-24-24Z" fill="none" stroke="#000" strokeWidth="8" strokeLinejoin="miter" />
          <path d="M3-88 L21-28 M88 3 L28 21 M3 88 L21 28" stroke="#6fc7e8" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle r="31" fill="url(#dp-ring)" stroke="#07090b" strokeWidth="5" /><circle r="21" fill="url(#dp-ring-in)" /><circle r="12" fill="#050607" />
        </symbol>
        <symbol id="dp-star-sil" viewBox="-100 -100 200 200" overflow="visible"><path d="M0-98 L24-24 L98 0 L24 24 L0 98 L-24 24 L-98 0 L-24-24Z" /></symbol>
      </defs>
    </svg>
  );
}

export function DodgePhone({ left, guess, name, photo, onGuess }: { left: number; guess: string | null; name: string; photo: string | null; onGuess: (dir: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useFx(root, q => [
    ...q('ecg').map(el => el.animate([{ opacity: .35 }, { opacity: 1, offset: .1 }, { opacity: .35, offset: .4 }, { opacity: .35 }], { duration: 700, iterations: Infinity })),
    ...q('rain').map(el => el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(384px)' }], { duration: 420, iterations: Infinity })),
  ], [!!guess]);
  // swipe on the pad: the way your finger goes is where it's coming from (sideways = left/right, up = high)
  const start = useRef<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const onDown = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current; start.current = null;
    if (!s || guess) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'high' : null;
    if (!dir) { setHint('Swipe left, right or up'); return; }
    onGuess(dir);
  };
  return (
    <div ref={root} className="phone takeover mgp mgp-dodge">
      <StarDefs />
      <div className="mgp-kick dg">DODGE!</div>
      <div className="mgp-big">{guess ? <>You went<br />{guess}</> : <>Something's<br />coming</>}</div>
      <div className="mgp-timer">
        <svg viewBox="0 0 120 24" width="96" height="20" aria-hidden="true"><path data-fx="ecg" d="M0 12 H38 L44 4 L50 20 L56 12 H72 L76 8 L80 16 L84 12 H120" stroke="#ff8a1e" strokeWidth="2.5" fill="none" strokeLinejoin="round" /></svg>
        <span>{left} second{left === 1 ? '' : 's'}</span>
      </div>
      {/* the pad: wet alley ground under the lamp, baked grain, rain from one tile */}
      <div className="mgp-pad" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { start.current = null; }}>
        <div style={{ ...abs, inset: 0, background: `url('${TEX}grain.png') 0 0 / 128px 128px`, opacity: .16 }} />
        <div style={{ ...abs, inset: 0, clipPath: 'polygon(44% 0, 56% 0, 92% 100%, 8% 100%)', background: 'linear-gradient(180deg, rgba(255,214,150,.16), rgba(255,150,60,.04) 80%)' }} />
        <div style={{ ...abs, left: '22%', top: '70%', width: '56%', height: 70, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(255,184,102,.22), transparent)' }} />
        <div style={{ ...abs, left: '30%', top: '76%', width: '40%', height: 46, borderRadius: '50%', background: 'radial-gradient(ellipse closest-side, rgba(12,16,20,.9), rgba(12,16,20,.5) 70%, transparent)' }} />
        {!guess && <svg viewBox="0 0 350 440" preserveAspectRatio="xMidYMid meet" style={{ ...abs, inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
          <g stroke="#e9e3d6" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".72">{ARROWS.map(a => <path key={a} d={a} />)}</g>
          <g stroke="#fbf7ee" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".55" strokeDasharray="11 5 3 6">{ARROWS.map(a => <path key={a} d={a} transform="translate(-1 -1.5)" />)}</g>
          <g stroke="#0b0c0d" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".5" strokeDasharray="2 9 1 13">{ARROWS.map(a => <path key={a} d={a} transform="translate(1 1)" />)}</g>
        </svg>}
        <div className="mgp-pad-photo"><Face photo={photo} name={name} size={40} /></div>
        <div className="mgp-pad-label">{guess ? 'locked in' : hint ?? "swipe where it's coming from"}</div>
        <div style={{ ...abs, inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div data-fx="rain" style={{ ...abs, left: 0, top: -384, width: '100%', height: 824, background: `url('${TEX}rain.png') 0 0 / 384px 384px repeat`, opacity: .45 }} />
          <div style={{ ...abs, inset: 0, clipPath: 'polygon(44% 0, 56% 0, 92% 100%, 8% 100%)' }}>
            <div data-fx="rain" style={{ ...abs, left: 0, top: -384, width: '100%', height: 824, background: `url('${TEX}rain.png') 0 0 / 384px 384px repeat` }} />
          </div>
        </div>
      </div>
      {!guess && <div className="mgp-dirs">
        {DIRS.map(d => (
          <button key={d.dir} type="button" onClick={() => onGuess(d.dir)}>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d={d.icon} stroke="#ffb866" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {d.label}
          </button>
        ))}
      </div>}
    </div>
  );
}

// the HIT screen: the glass cracked from the impact, HIT split along a crack
const IX = 262, IY = 214;
const CRACKS = (() => {
  const rnd = (i: number) => { const v = Math.sin(i * 78.233 + 1.7) * 43758.5453; return v - Math.floor(v); };
  const out: { d: string; w: string }[] = [];
  for (let k = 0; k < 11; k++) {
    let a = k / 11 * Math.PI * 2 + rnd(k) * .4, x = IX, y = IY, d = 'M ' + x + ' ' + y;
    const len = 180 + rnd(k + 20) * 520;
    for (let s = 0; s < 6; s++) { a += (rnd(k * 7 + s) - .5) * .5; x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6; d += ' L ' + x.toFixed(1) + ' ' + y.toFixed(1); }
    out.push({ d, w: (2.2 - k % 3 * .5).toFixed(1) });
  }
  [62, 100].forEach((r, j) => { let d = ''; for (let s = 0; s < 9; s++) { const a0 = s / 9 * Math.PI * 2 + j, a1 = a0 + .45; d += ` M ${(IX + Math.cos(a0) * r).toFixed(1)} ${(IY + Math.sin(a0) * r).toFixed(1)} L ${(IX + Math.cos(a1) * r * 1.05).toFixed(1)} ${(IY + Math.sin(a1) * r * 1.05).toFixed(1)}`; } out.push({ d, w: '1.2' }); });
  return out;
})();
export function DodgeHitPhone({ line }: { line: string }) {
  return (
    <div className="phone takeover mgp mgp-hit">
      <StarDefs />
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice" style={{ ...abs, inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
        <g stroke="rgba(255,240,235,.55)" strokeWidth="1.6" fill="none" strokeLinecap="round">{CRACKS.map((c, i) => <path key={i} d={c.d} strokeWidth={c.w} />)}</g>
        <g stroke="rgba(0,0,0,.45)" strokeWidth="1" fill="none">{CRACKS.map((c, i) => <path key={i} d={c.d} transform="translate(1.5 1.5)" />)}</g>
        <circle cx={IX} cy={IY} r="44" fill="rgba(255,240,235,.1)" stroke="rgba(255,240,235,.55)" strokeWidth="1.5" />
        <g transform={`translate(${IX} ${IY}) rotate(24) scale(.85)`}>
          <use href="#dp-star-sil" x="-100" y="-100" width="200" height="200" transform="translate(-12 16)" fill="#000" opacity=".5" />
          <use href="#dp-star" x="-100" y="-100" width="200" height="200" />
        </g>
      </svg>
      <div className="mgp-hit-body">
        <div className="mgp-kick hot">DODGE!</div>
        <div className="mgp-hitword">
          <div style={{ visibility: 'hidden' }}>HIT</div>
          <div className="a">HIT</div>
          <div className="b">HIT</div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ...abs, left: '-12%', top: 0, width: '124%', height: '100%', overflow: 'visible' }} aria-hidden="true">
            <path d="M -2 58 L 25.5 63 L 38.5 45.5 L 51.5 50.5 L 64 32 L 77 37 L 102 24" stroke="rgba(255,240,235,.8)" strokeWidth="1.2" fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <div className="mgp-hitline">{line}</div>
      </div>
    </div>
  );
}
