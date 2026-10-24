// Phone side of the APP GAMES: while one runs, every phone in it is taken over by that game's screen. The phone
// buzzes (and rings) once when the game starts; each kind buzzes again when it needs you (a new question, your turn).
// If the TV goes to sleep, the phones tick the server past a public deadline, so a game never stalls.
import { useEffect, useRef } from 'react';
import type { AppGame, GameState, Player } from '../../lib/types';
import type { Backend } from '../../lib/backend';
import { TopBar, buzz } from '../kit';
import { Sound } from '../../fx/sound';
import { HerdPhone } from './HerdPhone';
import { OddPhone } from './OddPhone';
import { ChessPhone } from './ChessPhone';
import '../../styles/apps.css';

type Act = (action: string, args?: Record<string, unknown>) => Promise<any>;

/** What every kind's phone screen gets. `move(args)` sends this player's move; `bar(sub)` is the usual top bar
 *  (the game's name under yours, or `sub`). */
export interface AppPhoneProps<G extends AppGame> {
  s: GameState; g: G; me: Player; now: number; bar: (sub?: string) => JSX.Element;
  move: (args: Record<string, unknown>) => Promise<any>;
}

/** The app game this phone is playing right now, if any. */
export const appFor = (s: GameState, meId: string): AppGame | null => (s.app && s.app.players.includes(meId) ? s.app : null);

const TICK_GRACE_MS = 1500, TICK_JITTER_MS = 1500, TICK_EVERY_MS = 3000;

export function AppGamePhone({ s, g, me, act, backend, clock, caps }: { s: GameState; g: AppGame; me: Player; act: Act; backend: Backend; clock: () => number; caps?: number | null }) {
  // the call to play: a buzz and the alarm, once, when the game has just started (not on a refresh mid-game)
  const rung = useRef(false);
  useEffect(() => {
    if (rung.current) return;
    rung.current = true;
    if (clock() - Date.parse(g.started_at) < 30000) { buzz([300, 120, 300, 120, 300]); Sound.alarm(); }
  }, []);

  // the TV ticks every second; the phones only once a public deadline has passed (with jitter), in case it's asleep
  const due = g.until ? Date.parse(g.until) + TICK_GRACE_MS : null;
  const fns = useRef({ backend, roomId: s.room.id, clock }); fns.current = { backend, roomId: s.room.id, clock };
  useEffect(() => {
    if (due === null || Number.isNaN(due)) return;
    let t = 0, dead = false;
    const tick = () => {
      if (dead) return;
      fns.current.backend.api('app_tick', { room_id: fns.current.roomId, game_id: g.id }).catch(() => {});
      t = window.setTimeout(tick, TICK_EVERY_MS + Math.random() * TICK_JITTER_MS);
    };
    t = window.setTimeout(tick, Math.max(0, due - fns.current.clock()) + Math.random() * TICK_JITTER_MS);
    return () => { dead = true; clearTimeout(t); };
  }, [g.id, due]);

  const bar = (sub?: string) => <TopBar me={me} sub={sub ?? g.name.toUpperCase()} room={s.room.code} live caps={caps} />;
  const p = { s, me, now: clock(), bar, move: (args: Record<string, unknown>) => act('app_move', { game_id: g.id, ...args }) };
  return g.kind === 'herd' ? <HerdPhone {...p} g={g} /> : g.kind === 'odd' ? <OddPhone {...p} g={g} /> : <ChessPhone {...p} g={g} />;
}
