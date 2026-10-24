// TV side of the APP GAMES (GAMES → LET THE TV RUN ONE): the fixed 1920×1080 stage with each kind's board, and a
// one-second tick so deadlines move without anyone tapping. The TV only ever gets public facts: never a pick before
// the reveal, never the famous name or the odd one out before theirs.
import { useEffect, useRef } from 'react';
import type { AppGame, GameState } from '../../lib/types';
import type { Act } from '../TvRoom';
import { useStageScale } from '../Scenes';
import { ConfirmButton } from '../../components/ui';
import { HerdTV } from './HerdTV';
import { OddTV } from './OddTV';
import { ChessTV } from './ChessTV';

/** What every kind's TV board gets. `host(op)` sends one of the host's keys for this game. */
export interface AppTvProps<G extends AppGame> { state: GameState; g: G; act: Act; now: () => number; host: (op: string, args?: Record<string, unknown>) => void }

export function AppGameOverlay({ state, g, act, now }: { state: GameState; g: AppGame; act: Act; now: () => number }) {
  const scale = useStageScale();
  const host = (op: string, args: Record<string, unknown> = {}) => { act('app_host', { game_id: g.id, op, ...args }).catch(() => {}); };
  const p = { state, act, now, host };
  return (
    <div className={'jr-ov app-ov kind-' + g.kind}>
      <div className="jr-stage" style={{ transform: `scale(${scale})` }}>
        {g.kind === 'herd' ? <HerdTV {...p} g={g} /> : g.kind === 'odd' ? <OddTV {...p} g={g} /> : <ChessTV {...p} g={g} />}
        {/* the host's way out, on every board (top centre: the boards keep that spot clear): the result so far stands */}
        <ConfirmButton className="ag-end" confirmText="END IT NOW?" onConfirm={() => host('stop')}>END GAME</ConfirmButton>
      </div>
    </div>
  );
}

/** Keep a running app game moving: nudge the server once a second (it answers quietly when nothing is due). */
export function useAppTicker(g: AppGame | null | undefined, tick: (id: string) => void) {
  const active = g?.id ?? null;
  const fn = useRef(tick); fn.current = tick;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => fn.current(active), 1000);
    return () => clearInterval(id);
  }, [active]);
}
