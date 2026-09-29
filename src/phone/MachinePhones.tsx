// The phone sides of The Bomb, Penny Drop and Jack-in-the-Box, ported from the approved mockups (design/mockups/
// BombPhone, PennyPhone and JackPhone .dc.html). Each is drawn on a 390 × 844 board, scaled to fit the phone.
// Built for drunk thumbs: big tap-only keys (no drags), one decision per screen, a plain line saying what to do,
// and a double tap never sends twice. iPhones can't vibrate from the web, so every buzz also jolts the screen.
// Motion is transform/opacity; reduced motion shows the settled frame.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { f1, reduced, segments } from '../tv/machineKit';
import { BombArt, Face, Marquee, PassBar, passLabel, type Seat } from '../components/Machine';
import { buzz } from './MiniPhones';

const abs = { position: 'absolute' } as const;
const W = 390, H = 844;
const JOLT = (s = 1): Keyframe[] => [{ transform: 'translate(0,0)' }, { transform: `translate(${-8 * s}px,${4 * s}px)` }, { transform: `translate(${7 * s}px,${-4 * s}px)` }, { transform: `translate(${-4 * s}px,${2 * s}px)` }, { transform: `translate(${2 * s}px,-1px)` }, { transform: 'translate(0,0)' }];
const jolt = (el: Element | null | undefined, s = 1) => { if (el && !reduced()) el.animate(JOLT(s), { duration: 380, easing: 'steps(6,end)' }); };

/** The 390 × 844 board, scaled to fit the screen and centred on the board's own background. */
function Stage({ bg, children, stageRef }: { bg: string; children: ReactNode; stageRef?: React.Ref<HTMLDivElement> }) {
  const [s, setS] = useState(1);
  useEffect(() => {
    const fit = () => setS(Math.min(innerWidth / W, innerHeight / H));
    fit(); addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);
  return (
    <div className="mps" style={{ background: bg }}>
      <div ref={stageRef} className="mk-motion" style={{ position: 'relative', flex: 'none', width: W, height: H, transform: `scale(${s})`, overflow: 'hidden', color: '#f1e8d4', fontFamily: "'Courier Prime', monospace", background: bg }}>
        {children}
      </div>
    </div>
  );
}

// ======================================================================== THE BOMB
/**
 * B5 (holding): a red-alarm screen, the bomb console, and a face keycap for everyone you can pass to. Whoever passed it to you
 * is crossed out. B6 (not holding): the holder's polaroid under a swinging red lamp, PRAY IT ISN'T YOU, and the pass tally.
 */
export function BombPhone({ holding, holder, blocked, targets, passes, onPass }: {
  holding: boolean; holder: Seat | null; blocked: Seat | null; targets: Seat[]; passes: number; onPass: (id: string) => Promise<unknown>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState<string | null>(null);
  const q = (s: string) => root.current?.querySelector<HTMLElement>(`[data-fx="${s}"]`);
  // the bomb arrives: a hard buzz, the console drops in, the screen jolts
  useLayoutEffect(() => {
    if (!holding) return;
    buzz(200);
    const b = q('bomb');
    if (b && !reduced()) b.animate([{ transform: 'translateY(-520px) rotate(10deg)' }, { transform: 'translateY(0) rotate(0deg)', offset: .75, easing: 'ease-out' }, { transform: 'translateY(-14px) rotate(-2deg)', offset: .88 }, { transform: 'none' }], { duration: 560, easing: 'ease-in' });
    const t = window.setTimeout(() => jolt(q('jolt'), 1.2), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);
  // a fresh hand (or the bomb straight back to you): the keys unlock
  useEffect(() => { setSent(null); }, [holding, passes]);
  // someone else's hands: a clunk when it changes hands
  useEffect(() => { if (!holding) jolt(q('card')); }, [holding, holder?.id]);
  // the red lamp swings on its cord
  useEffect(() => {
    const el = q('swing');
    if (holding || !el || reduced()) return;
    const a = el.animate([{ transform: 'rotate(-5deg)' }, { transform: 'rotate(5deg)' }], { duration: 1700, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    return () => a.cancel();
  }, [holding]);

  const pass = (id: string) => {
    if (sent) return;                                               // a double tap never sends twice
    setSent(id); buzz(40); jolt(q('jolt'));
    const b = q('bomb'), g = q('gone');
    if (!reduced()) {
      b?.animate([{ transform: 'none' }, { transform: 'translateY(-560px) rotate(-18deg) scale(.8)' }], { duration: 450, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' });
      g?.animate([{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-8deg) scale(1.9)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-8deg) scale(1)' }], { duration: 260, delay: 220, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' });
    }
    onPass(id).catch(() => {                                        // refused (too late, or it moved on): unlock and put the bomb back
      setSent(null); root.current?.querySelectorAll('[data-fx="bomb"], [data-fx="gone"]').forEach(e => e.getAnimations().forEach(a => a.cancel()));
    });
  };

  const t = Math.min(passes, 10) / 10;
  const many = targets.length + (blocked ? 1 : 0) > 8;
  const keys = [...targets.map(p => ({ p, crossed: false })), ...(blocked ? [{ p: blocked, crossed: true }] : [])];
  const sentName = keys.find(k => k.p.id === sent)?.p.name.toUpperCase();

  if (holding) return (
    <Stage bg="radial-gradient(ellipse 90% 60% at 50% 28%, #8a1208, #4a0604 55%, #1c0201)" stageRef={root}>
      <div data-fx="jolt" style={{ ...abs, inset: 0 }}>
        {!reduced() && <div style={{ ...abs, left: '50%', top: 300, width: 1200, height: 1200, margin: '-600px 0 0 -600px', pointerEvents: 'none', opacity: .5 }}>
          <div className="bp-sweep" style={{ ...abs, inset: 0, borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,90,60,.34) 20deg, transparent 60deg, transparent 180deg, rgba(255,90,60,.34) 200deg, transparent 240deg, transparent 360deg)' }} />
        </div>}
        <div className="bp-alarm" style={{ ...abs, inset: 0, pointerEvents: 'none', opacity: .3, background: 'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(255,60,30,.6), transparent 70%)' }} />
        <div className="mk-grit" style={{ opacity: .2 }} />
        <div className="mk-hazard" style={{ ...abs, left: 0, right: 0, top: 0, height: 16, boxShadow: '0 2px 0 #000' }} />
        <div className="mk-hazard" style={{ ...abs, left: 0, right: 0, bottom: 0, height: 16, boxShadow: '0 -2px 0 #000' }} />
        <div style={{ ...abs, inset: '40px 16px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Marquee text="PASS IT!" pitch={7} cols={44} scroll={!reduced()} step={.085 - .05 * t} style={{ padding: '10px 14px' }} />
          <div style={{ marginTop: 12, fontFamily: "'Big Shoulders Stencil Display', sans-serif", fontWeight: 900, fontSize: 50, lineHeight: .86, letterSpacing: '.02em', color: '#fff4e6', textShadow: '0 3px 0 #000, 0 0 24px rgba(255,60,30,.6)' }}>YOU'VE GOT<br />THE BOMB.</div>
          <div style={{ position: 'relative', width: many ? 200 : 250, height: (many ? 200 : 250) * .675, marginTop: many ? 6 : 12, flex: 'none' }}>
            <div data-fx="bomb" style={{ ...abs, inset: 0 }}><BombArt id="bp" blink="bp" /></div>
            <div data-fx="gone" style={{ opacity: sent ? 1 : 0, ...abs, left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-8deg)', padding: '4px 18px 0', border: '5px solid #ff8a1e', borderRadius: 6, fontFamily: "'Big Shoulders Stencil Display', sans-serif", fontWeight: 900, fontSize: 64, lineHeight: 1, color: '#ffb866', background: 'rgba(20,4,2,.7)' }}>GONE.</div>
          </div>
          {/* the one instruction, big */}
          <div style={{ marginTop: 8, fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 30, letterSpacing: '.03em', color: '#fff4e6' }}>{sent ? `SENT TO ${sentName}.` : 'TAP A FACE TO PASS IT'}</div>
          {blocked && !sent && <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.04em', color: '#ffd8cc' }}>Not back to {blocked.name}.</div>}
          <div style={{ marginTop: many ? 10 : 14, width: '100%', display: 'grid', gridTemplateColumns: `repeat(${many ? 5 : keys.length <= 3 ? keys.length : 4}, 1fr)`, gap: many ? '12px 6px' : '16px 8px' }}>
            {keys.map(({ p, crossed }) => (
              <button key={p.id} type="button" disabled={crossed || !!sent} onClick={() => pass(p.id)}
                className={'mk-key mk-key--face bp-key' + (crossed ? ' is-crossed' : sent === p.id ? ' is-snap mk-snap-anim' : sent ? ' is-disabled' : '')}
                style={{ border: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', ...(many ? { fontSize: 19, padding: '5px 5px 7px' } : {}) } as CSSProperties}
                aria-label={crossed ? `${p.name} (can't pass straight back)` : `Pass to ${p.name}`}>
                <div className="mk-key-photo"><Face p={p} size={many ? 26 : 36} /></div>
                <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 'auto', fontSize: 17, color: '#e8b8a8', letterSpacing: '.02em' }}>{sent ? 'Breathe.' : 'It goes the moment you tap.'}</div>
        </div>
      </div>
    </Stage>
  );

  return (
    <Stage bg="#060404" stageRef={root}>
      {/* the Bomb's bunker steel (the same room as the TV) */}
      <div style={{ ...abs, inset: 0, background: `radial-gradient(circle at 20px 12px, #8a9a93 0 2px, #0b0f0e 3px, transparent 4px) 0 0 / 40px 150px,
        repeating-linear-gradient(180deg, #070a09 0 3px, #4a5a54 3px 5px, transparent 5px 150px),
        repeating-linear-gradient(90deg, #070a09 0 3px, #4a5a54 3px 5px, transparent 5px 195px),
        linear-gradient(180deg, #26302d, #1a2220)` }} />
      <div className="mk-concrete" style={{ ...abs, inset: 0, opacity: .25 }} />
      <div style={{ ...abs, inset: 0, background: 'radial-gradient(ellipse 70% 42% at 50% 44%, rgba(120,14,6,.45), rgba(6,6,5,.82) 75%, #050505)' }} />
      <div data-fx="swing" style={{ ...abs, inset: 0, transformOrigin: '195px 0', pointerEvents: 'none' }}>
        <div className="bp-alarm" style={{ ...abs, inset: 0, opacity: .8, clipPath: 'polygon(172px 150px, 218px 150px, 360px 620px, 30px 620px)', background: 'linear-gradient(180deg, rgba(255,70,40,.4), rgba(255,43,26,.12) 60%, rgba(255,43,26,0))' }} />
        <svg viewBox="0 0 390 180" style={{ ...abs, left: 0, top: 0, width: 390, height: 180, overflow: 'visible' }} aria-hidden="true">
          <path d="M195 0 V96" stroke="#000" strokeWidth="6" /><path d="M195 0 V96" stroke="#2c3033" strokeWidth="2.5" />
          <rect x="187" y="90" width="16" height="16" fill="#1a1e21" stroke="#000" strokeWidth="3" />
          <path d="M145 150 Q150 110 195 104 Q240 110 245 150 Z" fill="#3a0c08" stroke="#000" strokeWidth="4" />
          <path d="M156 142 Q160 120 192 112" stroke="#a0463a" strokeWidth="3" fill="none" opacity=".7" />
          <ellipse cx="195" cy="151" rx="44" ry="7" fill="#ff5a3c" /><ellipse cx="195" cy="150" rx="20" ry="4" fill="#ffd8cc" />
        </svg>
      </div>
      <div className="mk-grit" style={{ opacity: .3 }} />
      <div style={{ ...abs, left: 20, right: 20, top: 190, textAlign: 'center', fontFamily: "'Big Shoulders Stencil Display', sans-serif", fontWeight: 900, fontSize: 34, letterSpacing: '.1em', color: '#ffb4a6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(holder?.name ?? '?').toUpperCase()} HAS IT</div>
      <div data-fx="card" style={{ ...abs, left: 75, top: 244, width: 240 }}>
        <div className="mk-polaroid" style={{ position: 'relative', width: 240, transform: 'rotate(-3deg)', padding: '10px 10px 34px' }}>
          <div className="mk-photo"><Face p={holder} size={90} /><div style={{ ...abs, inset: 0, background: 'rgba(255,43,26,.22)' }} /></div>
          <div style={{ ...abs, left: 0, right: 0, bottom: 3, textAlign: 'center', fontFamily: "'Permanent Marker', cursive", fontSize: 24, color: '#1b1712', whiteSpace: 'nowrap', overflow: 'hidden' }}>{holder?.name}</div>
        </div>
        <svg viewBox="0 0 400 270" style={{ ...abs, right: -40, bottom: -34, width: 126, height: 85, transform: 'rotate(10deg)', overflow: 'visible' }} aria-hidden="true">
          <ellipse cx="200" cy="262" rx="196" ry="14" fill="#000" opacity=".6" />
          {[112, 146, 180, 214].map(y => <rect key={y} x="22" y={y} width="356" height="40" rx="20" fill="#c42a18" stroke="#000" strokeWidth="8" />)}
          <path d="M94 108 L132 106 L134 258 L96 260 Z M266 106 L304 108 L306 258 L268 260 Z" fill="#a8adb0" stroke="#000" strokeWidth="8" />
          <rect x="104" y="10" width="192" height="120" rx="9" fill="#3a4146" stroke="#000" strokeWidth="8" />
          <rect x="120" y="28" width="160" height="70" rx="4" fill="#0b0101" />
          <path d="M150 63h.1M175 63h.1M200 63h.1M225 63h.1M250 63h.1" stroke="#ff2b1a" strokeWidth="14" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ ...abs, left: 0, right: 0, top: 596, textAlign: 'center', transform: 'rotate(-4deg)', fontFamily: "'Permanent Marker', cursive", fontSize: 46, lineHeight: 1.02, color: '#efe4cc', textShadow: '0 3px 0 #000' }}>PRAY IT<br />ISN'T YOU</div>
      <div style={{ ...abs, left: 0, right: 0, top: 708, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}><PassBar passes={passes} cls="bp-bar" /></div>
        <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 26, letterSpacing: '.08em', color: '#ffcf8a' }}>{passLabel(passes)}</div>
        <div style={{ maxWidth: 320, textAlign: 'center', fontSize: 17, lineHeight: 1.3, color: '#c9bfa8' }}>Nothing to do. If it comes to you, pass it on.</div>
      </div>
      <div className="mk-hazard" style={{ ...abs, left: 0, right: 0, top: 0, height: 14 }} />
      <div className="mk-hazard" style={{ ...abs, left: 0, right: 0, bottom: 0, height: 14 }} />
      <div className="mk-hazard" style={{ ...abs, left: 0, top: 0, bottom: 0, width: 14 }} />
      <div className="mk-hazard" style={{ ...abs, right: 0, top: 0, bottom: 0, width: 14 }} />
      <div style={{ ...abs, inset: 14, pointerEvents: 'none', boxShadow: '0 0 0 2px #000, inset 0 0 40px rgba(0,0,0,.9)' }} />
    </Stage>
  );
}

// ======================================================================== PENNY DROP
const LAUREL = (() => {
  const leaves: { x: number; y: number; r: number }[] = [];
  const stem = (side: number) => { const pts: number[][] = []; for (let t = 0; t <= 6; t++) { const a = (98 + t * 19) * Math.PI / 180; pts.push([Math.cos(a) * 66 * side, Math.sin(a) * 66]); } return 'M' + pts.map(p => p.map(f1).join(' ')).join('L'); };
  [-1, 1].forEach(side => { for (let t = 0; t <= 6; t++) { const deg = 98 + t * 19, a = deg * Math.PI / 180; [-1, 1].forEach(o => {
    const x = Math.cos(a) * (66 + o * 8), y = Math.sin(a) * (66 + o * 8), rot = deg + 90 + o * 32;
    leaves.push({ x: f1(side === 1 ? x : -x), y: f1(y), r: f1(side === 1 ? rot : 180 - rot) }); }); } });
  return { leaves, stemL: stem(1), stemR: stem(-1) };
})();
function PennyDefs() {
  return (
    <svg width="0" height="0" style={abs} aria-hidden="true">
      <defs>
        <radialGradient id="pp-gold" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff3c0" /><stop offset=".45" stopColor="#e0b458" /><stop offset=".9" stopColor="#8a6a00" /></radialGradient>
        <linearGradient id="pp-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0b0" /><stop offset=".3" stopColor="#e0b458" /><stop offset=".75" stopColor="#8a6a10" /><stop offset="1" stopColor="#3a2c00" /></linearGradient>
        <linearGradient id="pp-shaft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6c767b" /><stop offset=".4" stopColor="#eef2f3" /><stop offset="1" stopColor="#4a5358" /></linearGradient>
        <radialGradient id="pp-knob" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#8a8070" /><stop offset=".4" stopColor="#2a2218" /><stop offset="1" stopColor="#050302" /></radialGradient>
        <symbol id="pp-coin-blank" viewBox="-100 -100 200 200" overflow="visible">
          <circle r="99" fill="#2a1e00" /><circle r="95" fill="url(#pp-gold)" />
          <circle r="89" fill="none" stroke="#7a5a00" strokeWidth="6" strokeDasharray="3 3.2" />
          <circle r="82" fill="none" stroke="#fff3c0" strokeWidth="2" opacity=".45" /><circle r="78" fill="none" stroke="#5a4400" strokeWidth="2.5" opacity=".7" />
        </symbol>
        <symbol id="pp-coin-heads" viewBox="-100 -100 200 200" overflow="visible">
          <use href="#pp-coin-blank" x="-100" y="-100" width="200" height="200" />
          <g stroke="#1e1230" strokeLinejoin="round">
            <ellipse cx="0" cy="36" rx="64" ry="15" fill="#3e2b58" strokeWidth="4" />
            <path d="M-38 36 L-44 -44 Q0 -56 44 -44 L38 36 Q0 44 -38 36 Z" fill="#6a4f8f" strokeWidth="4" />
            <path d="M-40 8 Q0 16 40 8 L38 32 Q0 40 -38 32 Z" fill="#ff4f9a" strokeWidth="3" />
            <ellipse cx="0" cy="-44" rx="44" ry="11" fill="#8a6db3" strokeWidth="4" />
            <path d="M-64 36 Q0 62 64 36 Q0 47 -64 36 Z" fill="#4a3566" strokeWidth="3" />
          </g>
          <path d="M-32 -36 L-35 2 L-25 4 L-21 -39 Z" fill="#fff" opacity=".2" />
        </symbol>
        <symbol id="pp-coin-tails" viewBox="-100 -100 200 200" overflow="visible">
          <use href="#pp-coin-blank" x="-100" y="-100" width="200" height="200" />
          <g fill="none" stroke="#6a4e00" strokeWidth="3.5" strokeLinecap="round"><path d={LAUREL.stemL} /><path d={LAUREL.stemR} /></g>
          {LAUREL.leaves.map((l, i) => <ellipse key={i} cx={l.x} cy={l.y} rx="12" ry="5.2" transform={`rotate(${l.r} ${l.x} ${l.y})`} fill="#7a5a00" stroke="#4a3600" strokeWidth="1.5" />)}
          <text x="2" y="38" textAnchor="middle" fontFamily="'IM Fell English', serif" fontSize="112" fill="#fff3c0" opacity=".55">£</text>
          <text x="0" y="36" textAnchor="middle" fontFamily="'IM Fell English', serif" fontSize="112" fill="#5a4400">£</text>
        </symbol>
        <symbol id="pp-plate" viewBox="0 0 120 200">
          <rect x="26" y="4" width="68" height="192" rx="8" fill="#120d05" stroke="#000" strokeWidth="3" />
          <rect x="30" y="8" width="60" height="184" rx="6" fill="none" stroke="#6a4e0a" strokeWidth="2" />
          <circle cx="38" cy="16" r="3.5" fill="#e0b458" /><circle cx="82" cy="16" r="3.5" fill="#e0b458" /><circle cx="38" cy="184" r="3.5" fill="#e0b458" /><circle cx="82" cy="184" r="3.5" fill="#e0b458" />
          <rect x="52" y="24" width="16" height="152" rx="8" fill="#050505" stroke="#000" strokeWidth="2" />
        </symbol>
      </defs>
    </svg>
  );
}
function SegNum({ text, h, den }: { text: string; h: number; den?: string }) {
  const g = segments('8'.repeat(text.length), { h: 100 }), v = segments(text, { h: 100 }), aw = g.width;
  const d = den ? segments(den, { h: 100 }) : null, vw = d ? f1(aw + 40 + d.width) : aw;
  const slash = `M${f1(aw + 22)} 4L${f1(aw + 34)} 4L${f1(aw + 12)} 96L${f1(aw)} 96Z`;
  return (
    <div className="mk-seg mk-seg--gold"><svg viewBox={`0 -6 ${vw} 112`} width={Math.round(vw * h / 112)} height={h} aria-label={den ? `${text} of ${den}` : text}>
      <path className="mk-seg-ghost" d={v.ghost} /><path className="mk-seg-glow" d={v.lit} /><path className="mk-seg-lit" d={v.lit} />
      {d && <><path className="mk-seg-glow" d={slash} /><path className="mk-seg-lit" d={slash} />
        <g transform={`translate(${f1(aw + 40)} 0)`}><path className="mk-seg-ghost" d={d.ghost} /><path className="mk-seg-glow" d={d.lit} /><path className="mk-seg-lit" d={d.lit} /></g></>}
    </svg></div>
  );
}
const PENNY_BG = 'radial-gradient(ellipse 70% 40% at 50% 30%, rgba(224,180,88,.24), rgba(90,60,0,.08) 55%, transparent 80%), repeating-linear-gradient(90deg, #0c0a05 0 40px, #120e06 40px 42px), #0a0804';

/** P4 / P5: CALL IT! Two big brass lever keys (tap, no drags). A tap throws the lever, snaps, jolts; no take-backs. */
export function PennyPhone({ mine, secs, called, n, onCall }: { mine: 'heads' | 'tails' | null; secs: number; called: number; n: number; onCall: (c: 'heads' | 'tails') => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState<'heads' | 'tails' | null>(null);
  const pick = mine ?? local;
  const q = (s: string) => root.current?.querySelector<HTMLElement>(`[data-fx="${s}"]`);
  // the idle knobs breathe until you call
  useEffect(() => {
    if (pick || reduced()) return;
    const A = ['h', 't'].map((id, i) => q('knob-' + id)?.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(4px)' }], { duration: 900, delay: i * 450, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
    return () => A.forEach(a => a?.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);
  const call = (c: 'heads' | 'tails') => {
    if (pick) return;                                               // one call, no take-backs, and never twice
    setLocal(c); buzz(60); onCall(c);
    if (reduced()) return;
    const id = c === 'heads' ? 'h' : 't';
    q('shaft-' + id)?.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(-1)' }], { duration: 220, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'backwards' });
    q('knob-' + id)?.animate([{ transform: 'translateY(0px) scale(1)' }, { transform: 'translateY(64px) scale(1.25)', offset: .5 }, { transform: 'translateY(128px) scale(1)', offset: .85 }, { transform: 'translateY(122px)', offset: .92 }, { transform: 'translateY(128px)' }], { duration: 320, fill: 'backwards' });
    q('flash-' + id)?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, delay: 220, easing: 'ease-out' });
    q('stamp')?.animate([{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-12deg) scale(1.8)' }, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-12deg) scale(1)' }], { duration: 200, delay: 480, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
    window.setTimeout(() => jolt(q('jolt')), 220);
  };
  const pad2 = (v: number) => String(Math.max(0, Math.min(99, v))).padStart(2, '0');
  const levers = [{ id: 'h', c: 'heads' as const, word: 'HEADS', x: 20 }, { id: 't', c: 'tails' as const, word: 'TAILS', x: 204 }];
  const quote = !pick ? { a: 'Wrong, or silent, and you ', b: 'drink.', c: '' } : pick === 'heads' ? { a: 'Heads? ', b: 'Bold.', c: ' We shall see.' } : { a: 'Tails? ', b: 'Brave.', c: ' We shall see.' };
  return (
    <Stage bg={PENNY_BG} stageRef={root}>
      <PennyDefs />
      <div data-fx="jolt" style={{ ...abs, inset: 0 }}>
        <div className="pp-kick" style={{ ...abs, left: 0, right: 0, top: 46 }}>The Scrooge says…</div>
        <div className="pp-title" style={{ ...abs, left: 0, right: 0, top: 78, fontSize: 84 }}>{pick ? 'LOCKED IN.' : 'CALL IT!'}</div>
        <div className="pp-panel" style={{ left: 22, right: 22, top: 170, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
          <SegNum text={pad2(secs)} h={58} />
          <div className="pp-label">Called</div>
          <SegNum text={String(called)} den={String(n)} h={45} />
        </div>
        {levers.map(v => {
          const thrown = pick === v.c, dead = !!pick && !thrown;
          return (
            <button key={v.id} type="button" disabled={!!pick} onClick={() => call(v.c)} className="mk-key pp-lever"
              style={{ left: v.x, top: 284, transform: `translateY(${thrown ? 8 : 0}px)`, border: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }} aria-label={`Call ${v.word}`}>
              <svg viewBox="0 0 120 200" width="90" height="150" style={{ position: 'relative', flex: 'none', overflow: 'visible' }} aria-hidden="true">
                <use href="#pp-plate" x="0" y="0" width="120" height="200" />
                <g data-fx={'shaft-' + v.id} style={{ transformOrigin: '60px 100px', transform: `scaleY(${thrown ? -1 : 1})` }}>
                  <rect x="54" y="38" width="12" height="62" rx="5" fill="url(#pp-shaft)" stroke="#000" strokeWidth="2" />
                </g>
                <circle cx="60" cy="100" r="11" fill="url(#pp-shaft)" stroke="#000" strokeWidth="2.5" />
                <g data-fx={'knob-' + v.id} style={{ transformOrigin: '60px 36px', transform: `translateY(${thrown ? 128 : 0}px)` }}>
                  <circle cx="60" cy="36" r="27" fill="url(#pp-knob)" stroke="#000" strokeWidth="3" />
                  <ellipse cx="51" cy="26" rx="9" ry="6" fill="#fff" opacity=".35" />
                </g>
              </svg>
              <svg viewBox="-100 -100 200 200" width="108" height="108" style={{ position: 'relative', flex: 'none' }} aria-hidden="true"><circle r="104" fill="#1e1500" /><use href={`#pp-coin-${v.c}`} x="-100" y="-100" width="200" height="200" /></svg>
              <span>{v.word}</span>
              <div className="pp-snapring" style={{ opacity: thrown ? 1 : 0 }} />
              <div data-fx={'flash-' + v.id} className="pp-flash" style={{ opacity: 0 }} />
              <div className="pp-dim" style={{ opacity: dead ? 1 : 0 }} />
            </button>
          );
        })}
        {pick && <div data-fx="stamp" className="pp-scrawl" style={{ left: '50%', top: 452, fontSize: 44, color: '#ff4a2e', zIndex: 3, transform: 'translate(-50%,-50%) rotate(-12deg)' }}>NO TAKE-BACKS!</div>}
        <div className="pp-quote" style={{ ...abs, left: 24, right: 24, top: 690 }}>“{quote.a}<b>{quote.b}</b>{quote.c}”</div>
        <div style={{ ...abs, left: 0, right: 0, top: 776, textAlign: 'center', fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 26, letterSpacing: '.06em', color: pick ? '#c9bfa8' : '#ffd84a' }}>{pick ? 'WATCH THE TV' : 'TAP HEADS OR TAILS'}</div>
      </div>
      <div className="mk-grit" style={{ opacity: .1 }} />
    </Stage>
  );
}

/** The result: the coin drops into the tray and wobbles flat, the word, your verdict (a losing call gets the red edge + a jolt). */
export function PennyResultPhone({ coin, mine }: { coin: 'heads' | 'tails'; mine: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  const won = mine === coin;
  useEffect(() => {
    buzz(won ? 60 : [200, 80, 200]);
    const el = root.current;
    if (!el || reduced()) return;
    const q = (s: string) => el.querySelector<HTMLElement>(`[data-fx="${s}"]`);
    const P = 2000, A: Animation[] = [];
    const tl = (e: Element | null, frames: [number, Keyframe, string?][]) => {
      if (!e) return;
      const kf: Keyframe[] = frames.map(([t, p, ez]) => ({ ...p, offset: Math.min(1, t / P), ...(ez ? { easing: ez } : {}) }));
      if ((kf[0].offset as number) > 0) kf.unshift({ ...frames[0][1], offset: 0 });
      if ((kf[kf.length - 1].offset as number) < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
      const a = e.animate(kf, { duration: P, fill: 'both' }); A.push(a); a.finished.then(() => a.cancel()).catch(() => {});
    };
    const tf = (v: string) => ({ transform: v }), op = (v: number) => ({ opacity: v });
    const flips = [0, 110, 220, 330, 450, 590, 780];
    tl(q('rSpin'), flips.map((t, i) => [t, tf(`scaleX(${i % 2 ? -1 : 1})`), 'ease-in-out']));
    const zeros = flips.slice(1).map((t, i) => (t + flips[i]) / 2);
    const swap = (first: number) => { const f: [number, Keyframe][] = [[0, op(first)]]; zeros.forEach((z, i) => { const v = i % 2 ? first : 1 - first; f.push([z, op(1 - v)], [z, op(v)]); }); return f; };
    tl(q('rFaceF'), swap(1)); tl(q('rFaceO'), swap(0));
    const ty = (v: number) => tf(`translateY(${v}px)`), rot = (v: number) => tf(`rotate(${v}deg)`);
    tl(q('rDrop'), [[0, ty(-230), 'cubic-bezier(.5,0,1,.7)'], [620, ty(0), 'ease-out'], [740, ty(-26), 'ease-in'], [850, ty(0), 'ease-out'], [910, ty(-7), 'ease-in'], [970, ty(0)]]);
    tl(q('rShadow'), [[500, op(0)], [640, op(.6)]]);
    tl(q('rWob'), [[850, rot(0), 'ease-out'], [950, rot(-9), 'ease-in-out'], [1050, rot(7), 'ease-in-out'], [1150, rot(-4), 'ease-in-out'], [1250, rot(2), 'ease-in-out'], [1350, rot(0)]]);
    tl(q('rWord'), [[1000, { opacity: 0, transform: 'translateY(-30px)' }, 'cubic-bezier(.3,1.5,.5,1)'], [1250, { opacity: 1, transform: 'translateY(0px)' }]]);
    tl(q('rVerdict'), [[1400, { opacity: 0, transform: 'translate(-50%,-50%) rotate(-7deg) scale(1.9)' }, 'cubic-bezier(.3,1.4,.5,1)'], [1620, { opacity: 1, transform: 'translate(-50%,-50%) rotate(-7deg) scale(1)' }]]);
    tl(q('rTag'), [[1600, op(0)], [1800, op(1)]]);
    tl(q('rQuote'), [[1700, op(0)], [1950, op(1)]]);
    if (!won) {
      tl(q('edge'), [[1400, op(0)], [1420, op(1), 'ease-out'], [1900, op(.55)]]);
      tl(q('jolt'), [[1400, tf('translate(0px,0px)')], [1440, tf('translate(-8px,2px)')], [1480, tf('translate(7px,-2px)')], [1520, tf('translate(-5px,1px)')], [1560, tf('translate(4px,0px)')], [1620, tf('translate(0px,0px)')]]);
    }
    return () => A.forEach(a => a.cancel());
  }, [won]);
  const other = coin === 'heads' ? 'tails' : 'heads';
  const verdict = won ? { text: 'CALLED IT!', col: '#a4ff5a', fs: 70 } : { text: 'DRINK!', col: '#ff4a2e', fs: 92 };
  const quote = won ? { a: 'Hmph. ', b: 'Lucky', c: ' peasant.' } : mine ? { a: `You said ${mine}. Bah! `, b: 'Pay up.', c: '' } : { a: 'Silent? ', b: 'Pay up.', c: '' };
  return (
    <Stage bg={PENNY_BG} stageRef={root}>
      <PennyDefs />
      {!won && <div data-fx="edge" style={{ ...abs, inset: 0, pointerEvents: 'none', zIndex: 5, boxShadow: 'inset 0 0 0 6px rgba(255,74,46,.9), inset 0 0 70px 14px rgba(255,43,26,.55)', opacity: .55 }} />}
      <div data-fx="jolt" style={{ ...abs, inset: 0 }}>
        <div className="pp-kick" style={{ ...abs, left: 0, right: 0, top: 46 }}>The Scrooge says…</div>
        <svg viewBox="0 0 390 360" width="390" height="360" style={{ ...abs, left: 0, top: 70, overflow: 'visible' }} aria-hidden="true">
          <ellipse cx="195" cy="318" rx="118" ry="16" fill="#1e1500" stroke="#000" strokeWidth="3" />
          <ellipse data-fx="rShadow" cx="195" cy="322" rx="82" ry="9" fill="#000" style={{ opacity: .6 }} />
          <g data-fx="rDrop"><g data-fx="rWob" style={{ transformOrigin: '195px 322px' }}><g data-fx="rSpin" style={{ transformOrigin: '195px 214px' }}>
            <g data-fx="rFaceF"><use href={`#pp-coin-${coin}`} x="87" y="106" width="216" height="216" /></g>
            <g data-fx="rFaceO" style={{ opacity: 0, transformOrigin: '195px 214px', transform: 'scaleX(-1)' }}><use href={`#pp-coin-${other}`} x="87" y="106" width="216" height="216" /></g>
          </g></g></g>
          <path d="M77 318 Q195 352 313 318 L309 332 Q195 368 81 332 Z" fill="url(#pp-brass)" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <div data-fx="rWord" className="pp-title" style={{ ...abs, left: 0, right: 0, top: 452, fontSize: 104 }}>{coin.toUpperCase()}</div>
        <div data-fx="rVerdict" className="pp-scrawl" style={{ left: '50%', top: 610, fontSize: verdict.fs, color: verdict.col, transform: 'translate(-50%,-50%) rotate(-7deg)' }}>{verdict.text}</div>
        <div data-fx="rTag" style={{ ...abs, left: 0, right: 0, top: 676, textAlign: 'center' }}><span className="pp-tag">{mine ? `YOU CALLED ${mine.toUpperCase()}` : 'YOU DIDN\'T CALL'}</span></div>
        <div data-fx="rQuote" className="pp-quote" style={{ ...abs, left: 24, right: 24, top: 734 }}>“{quote.a}<b>{quote.b}</b>{quote.c}”</div>
      </div>
      <div className="mk-grit" style={{ opacity: .1 }} />
    </Stage>
  );
}

// ======================================================================== JACK-IN-THE-BOX
const JACK_STRIPES = Array.from({ length: 15 }, (_, k) => { const xb = -300 + k * 70; return { d: `M${f1(195 + (xb - 195) * .45)} 0L${f1(195 + (xb + 70 - 195) * .45)} 0L${f1(195 + (xb + 70 - 195) * 1.5)} 844L${f1(195 + (xb - 195) * 1.5)} 844Z`, c: k % 2 ? '#4a3a1e' : '#2c1733' }; });
const eyesFor = (count: number) => { const t = Math.min(count, 8) / 8, L = f1(10 + 40 * t); return { L, y: f1(50 - L / 2), s: f1(.5 + .7 * t), o: +(.25 + .75 * t).toFixed(2), glow: +(.04 + .1 * t).toFixed(3) }; };
function JackDefs() {
  return (
    <svg width="0" height="0" style={abs} aria-hidden="true">
      <defs>
        <linearGradient id="jp-fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".35" /><stop offset=".45" stopColor="#000" stopOpacity=".7" /><stop offset="1" stopColor="#000" stopOpacity=".92" /></linearGradient>
        <linearGradient id="jp-paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a2419" /><stop offset=".5" stopColor="#4a170f" /><stop offset="1" stopColor="#2a0b07" /></linearGradient>
        <linearGradient id="jp-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#262c30" /><stop offset="1" stopColor="#4a5358" /></linearGradient>
        <linearGradient id="jp-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe19a" /><stop offset=".45" stopColor="#c8922f" /><stop offset="1" stopColor="#5a3a0e" /></linearGradient>
        <radialGradient id="jp-glow"><stop offset="0" stopColor="#8dff9a" stopOpacity=".55" /><stop offset=".5" stopColor="#8dff9a" stopOpacity=".16" /><stop offset="1" stopColor="#8dff9a" stopOpacity="0" /></radialGradient>
        <pattern id="jp-haz" width="40" height="40" patternUnits="userSpaceOnUse"><image href="/textures/hazard.png" width="40" height="40" /></pattern>
      </defs>
    </svg>
  );
}
function JackBackdrop({ dim = .55 }: { dim?: number }) {
  return (
    <svg viewBox="0 0 390 844" style={{ ...abs, inset: 0, width: 390, height: 844 }} aria-hidden="true">
      {JACK_STRIPES.map((s, i) => <path key={i} d={s.d} fill={s.c} opacity={dim} />)}
      <rect width="390" height="844" fill="url(#jp-fall)" />
    </svg>
  );
}
function CountSeg({ n, h = 56, variant = '' }: { n: number; h?: number; variant?: string }) {
  const s = segments(n < 10 ? ' ' + n : String(n), { h: 76 });
  return (
    <div className={'mk-seg' + (variant ? ' mk-seg--' + variant : '')} style={{ padding: '10px 12px' }}>
      <svg viewBox={`0 0 ${s.width} ${s.height}`} height={h} style={{ width: s.width * h / 76 }} aria-label={String(n)}>
        <path className="mk-seg-ghost" d={s.ghost} /><path className="mk-seg-glow" d={s.lit} /><path className="mk-seg-lit" d={s.lit} />
      </svg>
    </div>
  );
}
const blinkLoop = (root: HTMLElement | null) => (reduced() || !root ? [] : [...root.querySelectorAll('[data-fx="blink"]')].map(e => e.animate(
  [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1)', offset: .9 }, { transform: 'scaleY(.06)', offset: .94 }, { transform: 'scaleY(1)', offset: .98 }, { transform: 'scaleY(1)' }], { duration: 3400, iterations: Infinity })));

/**
 * J5 (your turn): the box with its eyes and COUNT, the seconds left (too slow and it cranks once for you), and three big
 * bone keycaps 1 / 2 / 3. Tap only. J6 (waiting): NAME IS CRANKING, the box's eyes close up, watching you; each crank on
 * the TV is a clunk here.
 */
export function JackPhone({ mine, count, secs, order, onCrank }: {
  mine: boolean; count: number; secs: number; order: { name: string; you: boolean; cur: boolean; next: boolean }[]; onCrank: (n: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState<number | null>(null);
  const q = (s: string) => root.current?.querySelector<HTMLElement>(`[data-fx="${s}"]`);
  useEffect(() => { setSent(null); if (mine) { buzz([120, 60, 120]); jolt(q('jolt'), 1.2); } }, [mine]);
  useEffect(() => { const A = blinkLoop(root.current); return () => A.forEach(a => a.cancel()); }, [mine]);
  // every crank (anyone's) is a clunk: a jolt and a blink
  const lastCount = useRef(count);
  useEffect(() => {
    if (count === lastCount.current) return;
    lastCount.current = count;
    jolt(q('jolt'), .6);
    if (!reduced()) root.current?.querySelectorAll('[data-fx="blink"]').forEach(e => e.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.06)' }, { transform: 'scaleY(1)' }], { duration: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  // the eyes follow your finger
  const [look, setLook] = useState({ x: 0, y: 3 });
  const tap = (n: number) => {
    if (sent) return;
    setSent(n); buzz(40 * n); jolt(q('jolt'), 1.2); onCrank(n);
    const c = q('crank');
    if (c && !reduced()) c.animate([{ transform: 'rotate(32deg)' }, { transform: `rotate(${32 + n * 360}deg)` }], { duration: n * 560, easing: `steps(${n * 8}, end)` });
  };
  const eye = eyesFor(count);
  const cur = order.find(o => o.cur);
  const late = secs <= 3;

  return (
    <Stage bg="#0a0609" stageRef={root}>
      <JackDefs />
      <div data-fx="jolt" style={{ ...abs, inset: 0 }} onPointerMove={e => {
        if (mine) return;
        const r = e.currentTarget.getBoundingClientRect();
        setLook({ x: Math.max(-12, Math.min(12, (e.clientX - r.left - r.width / 2) / 12)), y: Math.max(-5, Math.min(7, (e.clientY - r.top - r.height * .5) / 16)) });
      }}>
        <JackBackdrop />
        <div className="jp-kicker" style={{ ...abs, left: 0, right: 0, top: 46 }}>JACK-IN-THE-BOX{mine ? ' · YOUR TURN' : ''}</div>
        <div style={{ ...abs, left: '50%', top: 74, transform: 'translateX(-50%)' }}>
          <Marquee text={mine ? 'CRANK IT.' : 'WAIT.'} pitch={6} cols={50} style={{ padding: '12px 16px' }} />
        </div>

        {mine ? <>
          {/* the box: eyes in the lid gap (capped at count 8), the COUNT, the crank */}
          <svg viewBox="-30 -84 520 396" style={{ ...abs, left: 20, top: 168, width: 350, height: 266, overflow: 'visible' }} aria-hidden="true">
            <ellipse cx="190" cy="294" rx="236" ry="22" fill="#000" opacity=".6" />
            <rect x="10" y="-2" width="360" height="54" fill="#030202" />
            <rect x="10" y="-2" width="360" height="54" fill="#8dff9a" opacity={eye.glow} />
            <g className="jp-tr" style={{ transform: `translate(190px, ${eye.y}px) scale(${eye.s})` }}>
              <g style={{ transform: `scaleY(${eye.o})` }}>
                <ellipse cx="0" cy="0" rx="120" ry="44" fill="url(#jp-glow)" />
                {[-48, 48].map(ex => <g key={ex} transform={`translate(${ex} 0)`}><g data-fx="blink">
                  <path d="M-26 0 Q0 -19 26 0 Q0 19 -26 0Z" fill="#8dff9a" />
                  <ellipse cx="0" cy="3" rx="12" ry="9" fill="#eaffec" opacity=".85" /><ellipse cx="0" cy="3" rx="4" ry="15" fill="#021006" />
                </g></g>)}
              </g>
            </g>
            <rect x="0" y="50" width="380" height="240" rx="4" fill="url(#jp-paint)" stroke="#000" strokeWidth="6" />
            <rect x="6" y="56" width="368" height="24" fill="url(#jp-haz)" /><rect x="6" y="260" width="368" height="24" fill="url(#jp-haz)" />
            <path d="M6 80 H374 M6 260 H374" stroke="#000" strokeWidth="4" />
            <text x="190" y="123" textAnchor="middle" fill="#e6dcc4" opacity=".92" style={{ fontFamily: "'Big Shoulders Stencil Display', Impact, sans-serif", fontWeight: 900, fontSize: 42, letterSpacing: '.04em' }}>JACK-IN-THE-BOX</text>
            {(() => { const s = segments(count < 10 ? ' ' + count : String(count), { h: 76 }), bw = Math.round(s.width + 36); return <>
              <rect x="22" y="138" width={bw} height="110" rx="6" fill="#2a3034" stroke="#000" strokeWidth="4" />
              <rect x="30" y="146" width={bw - 16} height="94" rx="4" fill="#0b0101" />
              <g transform="translate(40 156)" style={{ '--mk-on': '#ff2b1a', '--mk-ghost': 'rgba(255,43,26,.11)' } as CSSProperties}>
                <path className="mk-seg-ghost" d={s.ghost} /><path className="mk-seg-glow" d={s.lit} /><path className="mk-seg-lit" d={s.lit} />
              </g>
              <text x={bw + 38} y="190" fill="#f1e8d4" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 900, fontSize: 44 }}>CRANKS</text>
              <text x={bw + 38} y="232" fill="#c9bfa8" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 800, fontSize: 38 }}>SO FAR</text>
            </>; })()}
            <g transform="translate(386 170)">
              <rect x="-6" y="-30" width="18" height="60" rx="3" fill="#23292c" stroke="#000" strokeWidth="3" />
              <g data-fx="crank" style={{ transform: 'rotate(32deg)', transformBox: 'fill-box', transformOrigin: '37.5% 80.3%', pointerEvents: 'none' }}>
                <path d="M12 0 L12 -84" stroke="#000" strokeWidth="22" strokeLinecap="round" /><path d="M12 0 L12 -84" stroke="url(#jp-brass)" strokeWidth="14" strokeLinecap="round" />
                <g transform="translate(12 -84)"><rect x="-4" y="-14" width="44" height="28" rx="12" fill="#5a1c10" stroke="#000" strokeWidth="4" /></g>
                <circle cx="12" cy="0" r="24" fill="url(#jp-brass)" stroke="#000" strokeWidth="4" /><circle cx="12" cy="0" r="8" fill="#3a2608" stroke="#000" strokeWidth="2" />
              </g>
            </g>
            <g className="jp-tr" style={{ transform: `translateY(${-eye.L}px)` }}>
              <path d="M-12 30 L392 30 L364 -20 L16 -20Z" fill="url(#jp-steel)" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
              <text x="190" y="20" textAnchor="middle" fill="#e8c53a" opacity=".75" style={{ fontFamily: "'Big Shoulders Stencil Display', Impact, sans-serif", fontWeight: 900, fontSize: 32, letterSpacing: '.12em' }}>NO PEEKING</text>
              <rect x="-12" y="30" width="404" height="20" fill="#5a1c14" stroke="#000" strokeWidth="5" />
            </g>
          </svg>
          {/* the clock: too slow and it cranks once for you */}
          <div style={{ ...abs, left: 20, right: 20, top: 452, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 'none' }}><CountSeg n={secs} h={40} variant={late ? '' : 'amber'} /></div>
            <div className="jp-small" style={{ textAlign: 'left', fontSize: 17 }}>seconds. Too slow and it cranks <b style={{ color: '#ffb866' }}>once</b> for you.</div>
          </div>
          <div className="jp-big" style={{ ...abs, left: 0, right: 0, top: 530, fontSize: 30, color: sent ? '#c9bfa8' : '#f1e8d4' }}>{sent ? `CRANKING ${sent}…` : 'HOW MANY CRANKS?'}</div>
          <div className="jp-keys" style={{ ...abs, left: 20, right: 20, top: 572 }}>
            {[1, 2, 3].map(n => (
              <button key={n} type="button" disabled={!!sent} onClick={() => tap(n)} aria-label={`Crank ${n}`}
                className={'mk-key' + (sent === n ? ' is-snap mk-snap-anim' : sent ? ' is-disabled' : '')} style={{ border: 0 }}>
                <span>{n}</span><small>{n === 1 ? 'CRANK' : 'CRANKS'}</small>
              </button>
            ))}
          </div>
          <div className="jp-small" style={{ ...abs, left: 24, right: 24, top: 726, fontSize: 17 }}>It pops somewhere from 8 to 20.<br />Pop it and you get the <b style={{ color: '#f1e8d4' }}>clown</b>.</div>
        </> : <>
          <div className="jp-big" style={{ ...abs, left: 12, right: 12, top: 170, fontSize: 60, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{(cur?.name ?? '?').toUpperCase()} IS</div>
          <div className="jp-big" style={{ ...abs, left: 12, right: 12, top: 226, fontSize: 60, color: '#ffb866' }}>CRANKING</div>
          {/* the lid gap, close up: the eyes watch you */}
          <div style={{ ...abs, left: 20, right: 20, top: 312, height: 200, borderRadius: 6, overflow: 'hidden', background: '#030202', boxShadow: '0 0 0 3px #000, 0 14px 24px rgba(0,0,0,.7)' }}>
            <div style={{ ...abs, left: 0, right: 0, top: 0, height: 44, background: 'linear-gradient(180deg, #4a5358, #262c30)', boxShadow: 'inset 0 -4px 0 #5a1c14, 0 4px 0 #000' }} />
            <div style={{ ...abs, left: 0, right: 0, bottom: 0, height: 40, background: "url('/textures/hazard.png') 0 0 / 40px 40px", boxShadow: '0 -4px 0 #000' }} />
            <div style={{ ...abs, left: 0, right: 0, top: 48, bottom: 44, background: `rgba(141,255,154,${eye.glow})` }} />
            <svg viewBox="-175 -60 350 120" style={{ ...abs, left: 0, top: 40, width: 350, height: 120 }} aria-hidden="true">
              <g className="jp-tr" style={{ transform: `scale(${f1(eye.s * 1.35)})` }}>
                <g style={{ transform: `scaleY(${eye.o})` }}>
                  <ellipse cx="0" cy="0" rx="150" ry="52" fill="url(#jp-glow)" />
                  {[-56, 56].map(ex => <g key={ex} transform={`translate(${ex} 0)`}><g data-fx="blink">
                    <path d="M-32 0 Q0 -24 32 0 Q0 24 -32 0Z" fill="#8dff9a" />
                    <g className="jp-tr" style={{ transform: `translate(${look.x}px, ${look.y}px)` }}><ellipse cx="0" cy="0" rx="14" ry="11" fill="#eaffec" opacity=".85" /><ellipse cx="0" cy="0" rx="5" ry="18" fill="#021006" /></g>
                  </g></g>)}
                </g>
              </g>
            </svg>
          </div>
          <div style={{ ...abs, left: 20, right: 20, top: 534, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <CountSeg n={count} />
            <div className="jp-big" style={{ fontSize: 34, textAlign: 'left' }}>CRANKS<br /><span style={{ color: '#c9bfa8', fontSize: 28 }}>SO FAR</span></div>
          </div>
          <div className="jp-order" style={{ ...abs, left: 20, right: 20, top: 646 }}>
            {order.map((o, i) => <div key={i} className={'jp-seat' + (o.cur ? ' is-amber' : '')}>{o.you && <i>YOU</i>}<span className="mk-lamp" /><b style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name.toUpperCase()}</b></div>)}
          </div>
          <div className="jp-big" style={{ ...abs, left: 0, right: 0, top: 752, fontSize: 40, color: '#ffb866' }}>{order.find(o => o.you)?.next ? "YOU'RE NEXT." : 'NOT YOUR TURN.'}</div>
        </>}
        <div className="mk-grit" style={{ opacity: .18, zIndex: 4 }} />
      </div>
    </Stage>
  );
}

const COILS = (() => {
  const A = [190, 40], C = [226, -40], B = [190, -120], out: { back: string; front: string }[] = [];
  for (let k = 0; k < 9; k++) {
    const u = (k + .5) / 9, w = 1 - u;
    const p = [w * w * A[0] + 2 * w * u * C[0] + u * u * B[0], w * w * A[1] + 2 * w * u * C[1] + u * u * B[1]];
    const tg = [2 * w * (C[0] - A[0]) + 2 * u * (B[0] - C[0]), 2 * w * (C[1] - A[1]) + 2 * u * (B[1] - C[1])];
    const a = Math.atan2(tg[1], tg[0]) + Math.PI / 2, deg = f1(a * 180 / Math.PI);
    const e1 = `${f1(p[0] + 42 * Math.cos(a))} ${f1(p[1] + 42 * Math.sin(a))}`, e2 = `${f1(p[0] - 42 * Math.cos(a))} ${f1(p[1] - 42 * Math.sin(a))}`;
    out.push({ back: `M${e1}A42 12 ${deg} 0 0 ${e2}`, front: `M${e1}A42 12 ${deg} 0 1 ${e2}` });
  }
  return out;
})();
const pstar = (rx: number, ry: number, rin: number, cy: number, n: number) => Array.from({ length: n * 2 }, (_, k) => { const a = Math.PI * k / n, r = k % 2 ? rin : 1; return `${k ? 'L' : 'M'}${f1(Math.cos(a) * rx * r)} ${f1(cy + Math.sin(a) * ry * r)}`; }).join('') + 'Z';
const RUFF = { outer: pstar(84, 34, .62, 92, 9), inner: pstar(62, 24, .6, 88, 8) };
const TEETH = [-34, -23, -12, 10, 21, 32].map((x, k) => ({ x, y: f1(38 + Math.abs(x) * .06), h: 9 + (k * 5) % 4 }));

/** The pop, on every phone that played: YOU POPPED IT (red, to the wheel) or NAME POPPED IT (safe, this time). */
export function JackPopPhone({ you, name, at }: { you: boolean; name: string; at: number }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    buzz(you ? [300, 100, 300] : 80);
    const el = root.current;
    if (!el || reduced()) return;
    const q = (s: string) => el.querySelector<HTMLElement>(`[data-fx="${s}"]`);
    const A: Animation[] = [];
    const run = (e: Element | null, k: Keyframe[], o: KeyframeAnimationOptions) => { if (e) A.push(e.animate(k, o)); };
    run(q('flash'), [{ opacity: .85 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
    run(q('jolt'), JOLT(2.2), { duration: 380, easing: 'steps(6,end)' });
    const S = (s: number) => `translate(190px,60px) scale(${s}) translate(-190px,-60px)`;
    run(q('spring'), [{ transform: S(.08), easing: 'cubic-bezier(.1,.9,.3,1)' }, { transform: S(1.12), offset: .3 }, { transform: S(.95), offset: .5 }, { transform: S(1.03), offset: .7 }, { transform: S(1) }], { duration: 1150, fill: 'backwards' });
    run(q('jack'), [{ transform: 'translate(0px,470px)', easing: 'cubic-bezier(.1,.9,.3,1)' }, { transform: 'translate(0px,-22px)', offset: .3 }, { transform: 'translate(0px,9px)', offset: .5 }, { transform: 'translate(0px,-5px)', offset: .7 }, { transform: 'translate(0px,0px)' }], { duration: 1150, fill: 'backwards' });
    run(q('head'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0deg)' }], { duration: 2800, delay: 700, easing: 'ease-in-out' });
    run(q('mq'), [{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1.8)', opacity: 0, offset: .5 }, { transform: 'scale(.94)', opacity: 1, offset: .85 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, fill: 'backwards' });
    return () => A.forEach(a => a.cancel());
  }, [you]);
  const s = segments(at < 10 ? ' ' + at : String(at), { h: 76 }), bw = Math.round(s.width + 36);
  return (
    <Stage bg={you ? '#2a0504' : '#0a0609'} stageRef={root}>
      <JackDefs />
      <div data-fx="jolt" style={{ ...abs, inset: 0 }}>
        <JackBackdrop dim={you ? .35 : .55} />
        {you && <div style={{ ...abs, inset: 0, background: 'radial-gradient(ellipse 90% 60% at 50% 40%, rgba(190,20,10,.55), rgba(60,0,0,.5) 60%, transparent)' }} />}
        <div className="jp-kicker" style={{ ...abs, left: 0, right: 0, top: 46 }}>JACK-IN-THE-BOX · POP</div>
        <div data-fx="mq" style={{ ...abs, left: '50%', top: 74, transform: 'translateX(-50%)' }}>
          <Marquee text="POP." pitch={6} cols={50} style={{ padding: '12px 16px' }} />
        </div>
        <svg viewBox="-30 -400 440 700" style={{ ...abs, left: 65, top: 176, width: 260, height: 414, overflow: 'visible' }} aria-hidden="true">
          <path d="M0 50 L380 50 L355 0 L25 0Z" fill="#070303" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
          <g data-fx="spring" fill="none" strokeLinecap="round">
            {COILS.map((c, i) => <g key={i}><path d={c.back} stroke="#000" strokeWidth="12" /><path d={c.back} stroke="#3a4146" strokeWidth="6" /></g>)}
            {COILS.map((c, i) => <g key={i}><path d={c.front} stroke="#000" strokeWidth="13" /><path d={c.front} stroke="#c9d0d3" strokeWidth="7" /></g>)}
          </g>
          <g data-fx="jack"><g transform="translate(190 -186) rotate(-12) scale(1.3)"><g data-fx="head" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
            <path d={RUFF.outer} fill="#a3261a" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            <path d={RUFF.inner} fill="#e6dcc4" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
            <path d="M-60 -44 C-104 -58 -118 -12 -94 -2 C-120 12 -104 46 -64 32 C-72 10 -70 -20 -60 -44Z" fill="#9c3520" stroke="#000" strokeWidth="5" />
            <path d="M60 -44 C104 -58 118 -12 94 -2 C120 12 104 46 64 32 C72 10 70 -20 60 -44Z" fill="#9c3520" stroke="#000" strokeWidth="5" />
            <path d="M0 -80 C50 -80 78 -40 76 6 C74 52 42 84 0 84 C-42 84 -74 52 -76 6 C-78 -40 -50 -80 0 -80Z" fill="#ece2cc" stroke="#000" strokeWidth="6" />
            <path d="M40 -64 C82 -24 78 48 28 80 C58 40 62 -12 40 -64Z" fill="#b9a988" opacity=".8" />
            <path d="M-28 -48 L-20 -14 L-28 20 L-36 -14Z M28 -48 L36 -14 L28 20 L20 -14Z" fill="#161010" />
            <path d="M-48 -42 Q-30 -66 -10 -46 M48 -42 Q30 -66 10 -46" stroke="#161010" strokeWidth="5" fill="none" strokeLinecap="round" />
            <ellipse cx="-28" cy="-14" rx="19" ry="15" fill="#120806" /><ellipse cx="28" cy="-14" rx="19" ry="15" fill="#120806" />
            <ellipse cx="-28" cy="-14" rx="28" ry="20" fill="url(#jp-glow)" /><ellipse cx="28" cy="-14" rx="28" ry="20" fill="url(#jp-glow)" />
            <path d="M-40 -14 Q-28 -23 -16 -14 Q-28 -5 -40 -14Z M16 -14 Q28 -23 40 -14 Q28 -5 16 -14Z" fill="#8dff9a" />
            <path d="M-28 -21 V-7 M28 -21 V-7" stroke="#021006" strokeWidth="4" />
            <circle cx="-50" cy="26" r="12" fill="#c0584a" opacity=".55" /><circle cx="50" cy="26" r="12" fill="#c0584a" opacity=".55" />
            <path d="M-54 30 C-40 36 -20 40 0 40 C20 40 40 36 54 30 C44 60 24 74 0 74 C-24 74 -44 60 -54 30Z" fill="#6e120c" stroke="#000" strokeWidth="4" />
            <path d="M-44 37 C-20 45 20 45 44 37 C34 56 18 64 0 64 C-18 64 -34 56 -44 37Z" fill="#1a0403" />
            {TEETH.map((t, i) => <rect key={i} x={t.x} y={t.y} width="9" height={t.h} rx="1.5" fill="#e9e0c8" stroke="#000" strokeWidth="1.5" />)}
            <circle cx="0" cy="14" r="12" fill="#b82a18" stroke="#000" strokeWidth="3" /><circle cx="-4" cy="10" r="4" fill="#ff9a80" />
            <path d="M-50 -60 L8 -80 L-38 -126Z" fill="url(#jp-haz)" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            <circle cx="-38" cy="-128" r="10" fill="#e6dcc4" stroke="#000" strokeWidth="4" />
          </g></g></g>
          <rect x="0" y="50" width="380" height="240" rx="4" fill="url(#jp-paint)" stroke="#000" strokeWidth="6" />
          <rect x="6" y="56" width="368" height="24" fill="url(#jp-haz)" /><rect x="6" y="260" width="368" height="24" fill="url(#jp-haz)" />
          <text x="190" y="123" textAnchor="middle" fill="#e6dcc4" style={{ fontFamily: "'Big Shoulders Stencil Display', Impact, sans-serif", fontWeight: 900, fontSize: 42 }}>JACK-IN-THE-BOX</text>
          <rect x="22" y="138" width={bw} height="110" rx="6" fill="#2a3034" stroke="#000" strokeWidth="4" />
          <rect x="30" y="146" width={bw - 16} height="94" rx="4" fill="#0b0101" />
          <g transform="translate(40 156)" style={{ '--mk-on': '#ff2b1a', '--mk-ghost': 'rgba(255,43,26,.11)' } as CSSProperties}><path className="mk-seg-ghost" d={s.ghost} /><path className="mk-seg-glow" d={s.lit} /><path className="mk-seg-lit" d={s.lit} /></g>
          <text x={bw + 38} y="190" fill="#f1e8d4" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 900, fontSize: 44 }}>POPPED</text>
          <text x={bw + 38} y="232" fill="#c9bfa8" style={{ fontFamily: "'Big Shoulders Display', Impact, sans-serif", fontWeight: 800, fontSize: 38 }}>AT</text>
        </svg>
        <div className="jp-big" style={{ ...abs, left: 10, right: 10, top: 604, fontSize: 54, color: you ? '#fff1ea' : '#f1e8d4', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{you ? 'YOU POPPED IT.' : `${name.toUpperCase()} POPPED IT.`}</div>
        {you ? <>
          <div style={{ ...abs, left: 0, right: 0, top: 668, textAlign: 'center', fontFamily: "'Permanent Marker', cursive", fontSize: 34, color: '#ffd2c4', transform: 'rotate(-3deg)' }}>Grab the clown.</div>
          <div className="jp-big" style={{ ...abs, left: 0, right: 0, top: 722, fontSize: 44, color: '#ff6a50' }}>TO THE WHEEL.</div>
        </> : <>
          <div style={{ ...abs, left: 0, right: 0, top: 672, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}><span className="mk-lamp is-green" style={{ width: 30, height: 30 }} /><span className="jp-big" style={{ fontSize: 44, color: '#c8ffd0' }}>SAFE.</span></div>
          <div style={{ ...abs, left: 0, right: 0, top: 728, textAlign: 'center', fontFamily: "'Permanent Marker', cursive", fontSize: 30, color: '#c9bfa8', transform: 'rotate(-2deg)' }}>This time.</div>
        </>}
        <div className="mk-grit" style={{ opacity: .18, zIndex: 4 }} />
      </div>
      <div data-fx="flash" style={{ ...abs, inset: 0, zIndex: 6, pointerEvents: 'none', background: '#fff6e2', opacity: 0 }} />
    </Stage>
  );
}
