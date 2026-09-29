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

export const sideNames = (state: GameState, side: string[]) =>
  side.map(id => state.players.find(p => p.id === id)?.name.toUpperCase() ?? '?').join(' & ');

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
      for (let i = 0; i < 14 && alive; i++) {
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
  return (
    <div className="overlay matchup-ov">
      <div className="spot" /><div className="lamp-shade" />
      <div className="kicker" style={{ position: 'relative' }}>{gameName ? gameName.toUpperCase() : 'THE DRAW'}</div>
      <div className="vote-title" style={{ position: 'relative' }}>{rolling ? 'DRAWING…' : 'THE MATCHUP'}</div>
      <div className={'mu-sides' + (rolling ? ' rolling' : '') + (Math.max(...sides.map(x => x.length)) > 3 ? ' matchup-teams' : '')}>
        {faces.map((side, i) => (
          <div key={i} className="mu-wrap">
            {i > 0 && <div className="mu-vs">VS</div>}
            <div className="mu-side">
              {side.map((p, j) => (
                <div key={j} className="mu-p">
                  <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
                  {!rolling && p.cursed && <div className="mu-skull">☠</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {cursedIn && <div className="vline" style={{ position: 'relative' }}>THE CURSE DEMANDS A CHALLENGER. LOSE TO THEM AND IT COULD BE YOURS.</div>}
      <div className="bo-actions">
        <button className="big-btn" disabled={rolling} onClick={onRedraw}>RE-DRAW</button>
        <button className="big-btn sodium" disabled={rolling} onClick={onStart}>{gameName ? 'START GAME' : 'NAME THE GAME'}</button>
        <button className="big-btn" onClick={onClose}>BACK</button>
      </div>
    </div>
  );
}
