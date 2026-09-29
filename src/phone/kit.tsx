// Phone UI v2 kit (src/styles/phoneui.css; design/mockups/PhoneUI.dc.html). Built for drunk thumbs:
//   Key       one verb, 64px (lg 88px), and a second tap within 600ms is ignored
//   TopBar    you · level · room + LIVE: the same on every screen after joining
//   Check     step 2 of anything that can't be undone: the face big, a neutral question, NO on top, YES below that
//             arms after 0.6s (so the second half of a double tap can't land on it)
//   Result    a lamp (tick / cross / TV) and a neutral headline, the same for every role; one key; auto-return
//   Notice    a one-off message with fact rows and GOT IT (never "tap anywhere to close")
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Player } from '../lib/types';
import { initials } from '../lib/util';
import { segments } from '../tv/machineKit';

export const ICONS = {
  pint: 'M6 4h10l-1.2 16H7.2L6 4Z M16 8h1.5A2.5 2.5 0 0 1 20 10.5v3a2.5 2.5 0 0 1-2.5 2.5H15.4 M6.4 9h9.2 M9 12.5v4 M12.5 12.5v4',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 14.5v2',
  eyeoff: 'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.3-2.3 3.5 M6.6 6.6C4.6 7.9 3.1 10 2.5 12c1 2.5 4.5 7 9.5 7 1.8 0 3.4-.6 4.8-1.4 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  back: 'M15 4l-8 8 8 8',
  tap: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V11 M12 10V9a1.5 1.5 0 0 1 3 0v2 M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.9-2.6L4 14.5a1.5 1.5 0 0 1 2.4-1.8L9 15',
  check: 'M4.5 12.5l5 5L19.5 7',
  cross: 'M6 6l12 12 M18 6L6 18',
  camera: 'M3.5 8h4l1.8-3h5.4l1.8 3h4v11h-17z M12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7',
  tv: 'M3 7.5h18v12H3z M8 3l4 4.5L16 3',
  plus: 'M12 5v14 M5 12h14',
  anchor: 'M12 3a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M12 7v14 M4.5 13.5a7.5 7.5 0 0 0 15 0 M8 10.5h8 M4.5 13.5l-1.5 1.5 M19.5 13.5l1.5 1.5',
  gavel: 'M13.5 3.5l7 7 M10.5 6.5l7 7 M12 5l-5.5 5.5 M16 9l-5.5 5.5 M8.8 12.2L3 18l3 3 5.8-5.8 M13 21h8',
  blade: 'M4 20l3-3 M6 14l4 4 M8.5 15.5L19.5 4.5l-1 5-7 7',
  shield: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z M8.5 12l2.5 2.5 4.5-5',
  wheel: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4',
  horns: 'M12 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M6.8 9.2L4.5 3.5l4.8 3.3 M17.2 9.2l2.3-5.7-4.8 3.3 M9 13.5h.01 M15 13.5h.01 M9 17c2 1.3 4 1.3 6 0',
  hands: 'M9.5 21l-.5-7 3-9 3 9-.5 7 M12 5v10 M9 14l-3.5-2 M15 14l3.5-2',
  laugh: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M7.5 9.5l2 1 M16.5 9.5l-2 1 M7.5 13.5h9a4.5 4.5 0 0 1-9 0z',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17 M12 7.5V12l3 2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7 M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18.5 14.5c1.9.9 3 2.8 3 5.5',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13 M15.5 15.5L20 20',
  pen: 'M4 20l1-4L16 5l3 3L8 19z M13.5 7.5l3 3',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17 M12 11v5.5 M12 7.6v.1',
  skull: 'M5 11a7 7 0 0 1 14 0c0 2.4-1 3.8-2.5 4.6V19h-9v-3.4C6 14.8 5 13.4 5 11z M9.5 11.5h.01 M14.5 11.5h.01 M10 19v-2 M14 19v-2',
  heart: 'M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z',
  swap: 'M4 8h13l-3-3 M20 16H7l3 3',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-1 3-3 4-4 6-1-1-1.5-2-1.5-3C6.5 10 6 12.5 6 15a6 6 0 0 0 6 6z',
} as const;
export type IconName = keyof typeof ICONS;
export const Icon = ({ n }: { n: IconName }) => <svg className="pu-ic" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[n]} /></svg>;

export const buzz = (ms: number | number[] = 20) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

/** A key that ignores a second tap within 600ms (a drunk double tap never fires twice). */
export function Key({ children, onClick, variant = '', lg, icon, disabled, className = '', guard = 600 }: {
  children: ReactNode; onClick?: () => void; variant?: '' | 'steel' | 'red' | 'ghost'; lg?: boolean; icon?: IconName; disabled?: boolean; className?: string; guard?: number;
}) {
  const last = useRef(0);
  return (
    <button type="button" disabled={disabled} className={`pu-key ${variant} ${lg ? 'lg' : ''} ${className}`}
      onClick={() => { const t = Date.now(); if (t - last.current < guard) return; last.current = t; onClick?.(); }}>
      {icon && <Icon n={icon} />}{children}
    </button>
  );
}

export function Photo({ p, className = '' }: { p?: Pick<Player, 'name' | 'selfie_url'> | null; className?: string }) {
  return p?.selfie_url ? <img className={className} src={p.selfie_url} alt="" draggable={false} /> : <span className={'pu-ini ' + className}>{initials(p?.name ?? '?')}</span>;
}

/** The top bar: the same on every screen after joining. */
export function TopBar({ me, sub, subTone = '', room, live }: { me: Player; sub: string; subTone?: '' | 'red' | 'sea'; room: string; live: boolean }) {
  return (
    <div className="pu-tb">
      <div className="pu-snap"><Photo p={me} /></div>
      <div className="pu-tb-who"><div className="pu-tb-name">{me.name.toUpperCase()}</div><div className={'pu-tb-sub ' + subTone}>{sub}</div></div>
      <div className="pu-room"><span className={'pu-lamp ' + (live ? 'g' : 'y')} /><div><b>{room}</b><small className={live ? '' : 'off'}>{live ? 'LIVE' : 'OFFLINE'}</small></div></div>
    </div>
  );
}

/** The row under the top bar: back · title · a slot (chip or timer). */
export function Row({ onBack, title, sub, slot, center }: { onBack?: () => void; title: ReactNode; sub?: ReactNode; slot?: ReactNode; center?: boolean }) {
  const last = useRef(0);
  return (
    <div className="pu-row">
      {onBack && <button type="button" className="pu-back" aria-label="Back" onClick={() => { if (Date.now() - last.current < 600) return; last.current = Date.now(); onBack(); }}><Icon n="back" /></button>}
      <div className={'pu-row-title' + (center ? ' c' : '')}>{title}{sub && <small>{sub}</small>}</div>
      {slot}
    </div>
  );
}

/** Amber seven-segment digits in a recessed box (timers, the tally). */
export function Seg({ text, h = 44, of, sea }: { text: string; h?: number; of?: string; sea?: boolean }) {
  const s = segments(text, { h: 100 });
  return (
    <div className={'pu-segbox' + (sea ? ' sea' : '')}>
      <svg viewBox={`0 -4 ${s.width} 108`} height={h} width={Math.round(s.width * h / 108)} aria-label={text}>
        <path className="pu-seg-g" d={s.ghost} /><path className="pu-seg-glow" d={s.lit} /><path className="pu-seg-l" d={s.lit} />
      </svg>
      {of && <span className="of">{of}</span>}
    </div>
  );
}
export const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export type Fact = { icon: IconName; text: ReactNode; small?: ReactNode; hot?: boolean };
export const Facts = ({ facts }: { facts: Fact[] }) => (
  <div className="pu-facts">{facts.map((f, i) => (
    <div key={i} className={'pu-fact' + (f.hot ? ' hot' : '')}><div className="mi"><Icon n={f.icon} /></div><div className="tx">{f.text}{f.small && <small>{f.small}</small>}</div></div>
  ))}</div>
);

/** A player row for pickers: 80px, photo + name; not pickable = hatched, dimmed, with the reason. */
export function PlayerRow({ p, onPick, note, sel }: { p: Player; onPick: () => void; note?: string; sel?: boolean }) {
  return (
    <button type="button" className={'pu-prow' + (sel ? ' sel' : '')} disabled={!!note} onClick={onPick} aria-label={p.name}>
      <span className="pf"><Photo p={p} /></span>
      <span className="pn">{p.name.toUpperCase()}{note && <small>{note}</small>}</span>
      {sel && <span className="tick"><Icon n="check" /></span>}
    </button>
  );
}

/** Step 2 of anything irreversible. YES arms after 0.6s. */
export function Check({ face, question, cost, yes, red, onNo, onYes, noLabel = 'NO, GO BACK', busy }: {
  face?: Player | null; question: string; cost: ReactNode; yes: string; red?: boolean; onNo: () => void; onYes: () => void; noLabel?: string; busy?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 600); return () => clearTimeout(t); }, []);
  return (
    <div className="pu-check" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
      {face && <div className="pu-bigface"><Photo p={face} /><div className="cap">{face.name}</div></div>}
      <div className="pu-display pu-center" style={{ marginTop: face ? 8 : 40 }}>{question}</div>
      <div className="pu-body pu-center pu-c-bone2">{cost}</div>
      <div className="pu-keys">
        <Key variant="ghost" icon="cross" onClick={onNo}>{noLabel}</Key>
        <div className="pu-arming"><i /></div>
        <Key lg variant={red ? 'red' : ''} icon="check" className="pu-yes" disabled={!armed || busy} onClick={onYes}>{busy ? 'SENDING…' : yes}</Key>
      </div>
    </div>
  );
}

export type Outcome = { tone: 'ok' | 'no' | 'wait'; kicker: string; title: string; line: ReactNode; facts?: Fact[]; again?: () => void; back?: string; count?: number };
/** A result: the same lamp and headline for every role; what happened in one sentence; auto-return. */
export function Result({ o, onDone }: { o: Outcome; onDone: () => void }) {
  const [left, setLeft] = useState(o.count ?? (o.tone === 'ok' ? 5 : 0));
  const doneRef = useRef(onDone); doneRef.current = onDone;
  useEffect(() => {
    if (!left) return;
    const t = setTimeout(() => { if (left <= 1) doneRef.current(); else setLeft(left - 1); }, 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="pu-result" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
      <div className={'pu-verdict ' + o.tone}><Icon n={o.tone === 'ok' ? 'check' : o.tone === 'no' ? 'cross' : 'tv'} /></div>
      <div className={'pu-kick pu-center ' + (o.tone === 'ok' ? 'pu-c-green' : o.tone === 'no' ? 'pu-c-red' : 'pu-c-sodium')} style={{ marginTop: 16 }}>{o.kicker}</div>
      <div className="pu-display pu-center">{o.title}</div>
      <div className="pu-body pu-center pu-c-bone2">{o.line}</div>
      {o.facts && <Facts facts={o.facts} />}
      <div className="pu-keys">
        {o.again && <Key lg onClick={o.again}>PICK SOMEONE ELSE</Key>}
        <Key lg={!o.again} variant={o.again ? 'ghost' : o.tone === 'ok' ? 'steel' : ''} className="pu-ok" onClick={onDone}>{o.back ?? (o.tone === 'ok' ? 'OK' : 'BACK TO HOME')}</Key>
        {o.tone === 'ok' && left > 0 && <div className="pu-small pu-center">Back to Home by itself in {left}s</div>}
      </div>
    </div>
  );
}
