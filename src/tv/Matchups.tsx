// Matchup draw: the TV picks who plays whom, so nobody gets to dodge anyone.
// The Cursed player is always drawn in ("the curse demands a challenger"):
// beating them is how the curse moves on, so someone has to face them.
import { useEffect, useState } from 'react';
import type { GameState, Player } from '../lib/types';
import { Polaroid } from '../components/ui';
import { Sound } from '../fx/sound';
import { sleep } from '../lib/util';

export type Format = '1v1' | '2v2' | '3v3' | 'teams';
export const FORMATS: { id: Format; label: string; need: number }[] = [
  { id: '1v1', label: '1 v 1', need: 2 },
  { id: '2v2', label: '2 v 2', need: 4 },
  { id: '3v3', label: '3 v 3', need: 6 },
  { id: 'teams', label: 'TWO TEAMS (EVERYONE)', need: 2 },
];

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Random sides. Throws if there aren't enough players. */
export function draw(players: Player[], format: Format): string[][] {
  const f = FORMATS.find(x => x.id === format)!;
  if (players.length < f.need) throw new Error(`Need at least ${f.need} players for ${f.label}`);
  const cursed = players.filter(p => p.cursed);
  const rest = shuffle(players.filter(p => !p.cursed));
  const picked = format === 'teams' ? shuffle(players) : shuffle([...cursed, ...rest].slice(0, f.need));
  const half = Math.ceil(picked.length / 2);
  return [picked.slice(0, half).map(p => p.id), picked.slice(half).map(p => p.id)];
}

/** How many players are in each match when EVERYONE PLAYS at this size: the room is shared out as evenly as it
 *  goes with nobody over the size, bigger matches first, and an odd player makes the last match uneven by one.
 *  10 at 3 v 3 = [6, 4]: a 3 v 3, then a 2 v 2. */
export function matchSizes(n: number, format: Format): number[] {
  const k = FORMATS.find(x => x.id === format)!.need / 2;
  const pairs = Math.floor(n / 2);
  const m = Math.min(Math.ceil(n / (2 * k)), pairs);
  if (m < 1) return [];
  const sizes = Array.from({ length: m }, (_, i) => 2 * (Math.floor(pairs / m) + (i < pairs % m ? 1 : 0)));
  if (n % 2) sizes[m - 1] += 1;
  return sizes;
}

/** EVERYONE PLAYS: the whole room drawn into matches of this size. Sides come in pairs, one pair per match:
 *  [[match 1 side A], [match 1 side B], [match 2 side A], …]. The Cursed player is in, like everyone. */
export function drawAll(players: Player[], format: Format): string[][] {
  if (format === 'teams') return draw(players, format);
  const sizes = matchSizes(players.length, format);
  if (!sizes.length) throw new Error('Need at least 2 players');
  const pool = shuffle(players).map(p => p.id);
  const sides: string[][] = [];
  let at = 0;
  for (const size of sizes) {
    const group = pool.slice(at, at += size);
    const half = Math.ceil(group.length / 2);
    sides.push(group.slice(0, half), group.slice(half));
  }
  return sides;
}

/** The matches in a drawn matchup: its sides, two at a time. */
export const matchesOf = <T,>(sides: T[][]): T[][][] =>
  Array.from({ length: Math.ceil(sides.length / 2) }, (_, i) => sides.slice(2 * i, 2 * i + 2));

/** "3 v 3, then 2 v 2"; repeats are counted: "1 v 1 (×7), then 2 v 1" */
export const sizesLabel = (sizes: number[]) => {
  const runs: [string, number][] = [];
  for (const n of sizes) {
    const t = `${Math.ceil(n / 2)} v ${Math.floor(n / 2)}`;
    if (runs.length && runs[runs.length - 1][0] === t) runs[runs.length - 1][1]++; else runs.push([t, 1]);
  }
  return runs.map(([t, k]) => k > 1 ? `${t} (×${k})` : t).join(', then ');
};

export const sideNames = (state: GameState, side: string[]) =>
  side.map(id => state.players.find(p => p.id === id)?.name.toUpperCase() ?? '?').join(' & ');

/** One line for the whole matchup: "A & B vs C & D", or "MATCH 1: A vs B / MATCH 2: C vs D". */
export const matchupLine = (state: GameState, sides: string[][]) => {
  const ms = matchesOf(sides).map(m => m.map(sd => sideNames(state, sd)).join(' vs '));
  return ms.length > 1 ? ms.map((t, i) => `MATCH ${i + 1}: ${t}`).join('  /  ') : ms[0] ?? '';
};

/** Columns and photo width (in vh) for `m` matches of up to `per` photos each: the biggest photos that fit about
 *  50vh of height and 92% of the screen's width (1vw = width/height vh). The gaps are the ones in tv.css (.mu-matches). */
function gridFor(m: number, per: number): { cols: number; pw: number } {
  const wide = 92 * (window.innerWidth / Math.max(1, window.innerHeight));
  let best = { cols: 1, pw: 0 };
  for (let cols = 1; cols <= Math.min(3, m); cols++) {
    const rows = Math.ceil(m / cols);
    const byH = (50 - (rows - 1) * 2.4) / rows - 6.1;                           // label + photo + caption per row
    const byW = ((wide - (cols - 1) * 6) / cols - (per - 2) * 1.2 - 4) / (per + 0.48);   // photos + gaps + VS per match
    const pw = Math.min(16, byH, byW);
    if (pw > best.pw) best = { cols, pw };
  }
  return { cols: best.cols, pw: Math.max(5, Math.floor(best.pw * 10) / 10) };
}

/** Full-screen reveal: faces flicker, then the sides lock in. */
export function MatchupOverlay({ state, sides, gameName, onRedraw, onStart, onClose }: {
  state: GameState; sides: string[][]; gameName: string; onRedraw: () => void; onStart: () => void; onClose: () => void;
}) {
  const [rolling, setRolling] = useState(true);
  const [faces, setFaces] = useState<Player[][]>([]);
  const key = JSON.stringify(sides);
  useEffect(() => {
    let alive = true;
    setRolling(true);
    (async () => {
      const shape = sides.map(s => s.length);
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;   // reduced motion: no flicker
      for (let i = 0; i < (still ? 0 : 14) && alive; i++) {
        const pool = shuffle(state.players);
        let k = 0;
        setFaces(shape.map(n => Array.from({ length: n }, () => pool[k++ % pool.length])));
        Sound.tick();
        await sleep(70 + i * 12);
      }
      if (!alive) return;
      setFaces(sides.map(s => s.map(id => state.players.find(p => p.id === id)!).filter(Boolean)));
      setRolling(false); Sound.gavel();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const cursedIn = !rolling && sides.flat().some(id => state.players.find(p => p.id === id)?.cursed);
  const side = (ps: Player[], i: number) => (
    <div key={i} className="mu-wrap">
      {i > 0 && <div className="mu-vs">VS</div>}
      <div className="mu-side">
        {ps.map((p, j) => (
          <div key={j} className="mu-p">
            <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
            {!rolling && p.cursed && <div className="mu-skull">☠</div>}
          </div>
        ))}
      </div>
    </div>
  );
  // EVERYONE PLAYS: the matches in a grid, as big as fits the screen
  const matches = matchesOf(faces);
  const many = sides.length > 2;
  const { cols, pw } = gridFor(Math.ceil(sides.length / 2), 2 * Math.max(...sides.map(x => x.length)));
  return (
    <div className="overlay matchup-ov">
      <div className="spot" /><div className="lamp-shade" />
      <div className="kicker" style={{ position: 'relative' }}>{gameName ? gameName.toUpperCase() : 'THE DRAW'}</div>
      <div className="vote-title" style={{ position: 'relative' }}>{rolling ? 'DRAWING…' : many ? 'THE MATCHES' : 'THE MATCHUP'}</div>
      {many
        ? <div className="mu-matches" style={{ ['--cols' as any]: cols, ['--pw' as any]: `${pw}vh` }}>
            {matches.map((m, i) => (
              <div key={i} className="mu-match">
                <div className="mu-mlabel">MATCH {i + 1}</div>
                <div className={'mu-sides' + (rolling ? ' rolling' : '')}>{m.map(side)}</div>
              </div>
            ))}
          </div>
        : <div className={'mu-sides' + (rolling ? ' rolling' : '') + (Math.max(...sides.map(x => x.length)) > 3 ? ' matchup-teams' : '')}>
            {faces.map(side)}
          </div>}
      {cursedIn && <div className="vline" style={{ position: 'relative' }}>THE CURSE DEMANDS A CHALLENGER. LOSE TO THEM AND IT COULD BE YOURS.</div>}
      <div className="bo-actions">
        <button className="big-btn" disabled={rolling} onClick={onRedraw}>RE-DRAW</button>
        <button className="big-btn sodium" disabled={rolling} onClick={onStart}>{gameName ? 'START GAME' : 'NAME THE GAME'}</button>
        <button className="big-btn" onClick={onClose}>BACK</button>
      </div>
    </div>
  );
}
