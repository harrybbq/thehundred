// Shared pieces for the APP GAMES' TV boards (src/styles/apps.css), drawn on the fixed 1920×1080 stage.
import type { CSSProperties, ReactNode } from 'react';
import type { Player } from '../../lib/types';
import { initials } from '../../lib/util';
import '../../styles/apps.css';

/** Whole seconds left until an ISO time (0 once it's passed). */
export const secsTo = (iso: string | null | undefined, now: number) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : 0);

/** The four answer colours, shared by the TV cards and the phone buttons so a drunk eye can match them. */
export const ANSWER_INK = [
  { l: 'A', bg: 'linear-gradient(180deg,#ffc27a,#ff8a1e 60%,#e06e00)', ink: '#1a0c00', lt: '#ffb866' },
  { l: 'B', bg: 'linear-gradient(180deg,#3f8a90,#2c6e74 60%,#1d5257)', ink: '#f1e8d4', lt: '#7fc4c9' },
  { l: 'C', bg: 'linear-gradient(180deg,#d0687a,#b8475a 60%,#8c3142)', ink: '#f1e8d4', lt: '#f0a0ad' },
  { l: 'D', bg: 'linear-gradient(180deg,#f4efe4,#dcd3bf 60%,#bfb59d)', ink: '#1b1712', lt: '#f4efe4' },
] as const;
export const answerVars = (i: number) => ({ ['--bg' as any]: ANSWER_INK[i].bg, ['--ai' as any]: ANSWER_INK[i].ink, ['--lt' as any]: ANSWER_INK[i].lt }) as CSSProperties;

const TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.5, -1, 2];
export const tiltOf = (i: number) => TILTS[i % TILTS.length];

/** A polaroid: their selfie (or initials) and a marker caption. Width comes from the caller (style/--pw). */
export function Pol({ p, tilt = 0, className = '', style }: { p?: Pick<Player, 'name' | 'selfie_url'> | null; tilt?: number; className?: string; style?: CSSProperties }) {
  const name = p?.name ?? '?';
  return (
    <div className={'ap-pol ' + className} style={{ ['--t' as any]: `${tilt}deg`, ...style }}>
      {p?.selfie_url ? <img className="ph" src={p.selfie_url} alt={name} draggable={false} /> : <div className="ph blank">{initials(name)}</div>}
      <div className="cap">{name.toUpperCase()}</div>
    </div>
  );
}

/** The title line: the game's name on the left; the count and the host's keys on the right. */
export function TopLine({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="ap-top"><div className="ap-title">{title}</div><div className="ap-top-r">{children}</div></div>;
}

/** The timer bar and its seconds (the bar runs down over `of` seconds). */
export function Timer({ secs, of, className = '', children }: { secs: number; of: number; className?: string; children?: ReactNode }) {
  return (
    <div className={'ap-timer ' + className}>
      <div className={'ap-bar' + (secs <= 5 ? ' low' : '')}><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, secs / of))})` }} /></div>
      <div className="ap-secs">{secs}</div>
      {children}
    </div>
  );
}

/** Chalk tally marks: | | | | in gates of five. */
export function Gates({ n, className = 'hd-gate' }: { n: number; className?: string }) {
  const gates: number[] = [];
  for (let left = n; left > 0; left -= 5) gates.push(Math.min(5, left));
  return <>{gates.map((k, i) => <div key={i} className={className}>{Array.from({ length: Math.min(4, k) }, (_, j) => <i key={j} />)}{k === 5 && <b />}</div>)}</>;
}
