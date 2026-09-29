// Phone side of the mini-games: the call to the TV ("I'M HERE"), each game's controls, and the
// pickers that start them. The server holds every secret (the throw, the pop number, the fuse,
// the coin); a phone only ever sends its own move.
import { useEffect, useRef, useState } from 'react';
import type { GameState, MiniGame, MiniKind, Player } from '../lib/types';
import { Polaroid } from '../components/ui';

type Act = (action: string, args?: Record<string, unknown>) => Promise<any>;

export const GAME_NAMES: Record<MiniKind, string> = {
  dodge: 'DODGE!', plank: 'WALK THE PLANK', jack: 'JACK-IN-THE-BOX', bomb: 'THE BOMB', penny: 'PENNY DROP',
};
const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };
const secsLeft = (iso: string | null, now: number) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : 0);

/** Should this phone be taken over by the game right now? */
export function gameFor(s: GameState, meId: string, now: number): MiniGame | null {
  const g = s.minigame;
  if (!g || !g.players.includes(meId)) return null;
  if (g.status === 'muster' || g.status === 'live') return g;
  if (g.status === 'done' && g.finished_at && now - Date.parse(g.finished_at) < 7000) return g;   // a moment to see how it went
  return null;
}

export function GameTakeover({ s, g, me, act, clock }: { s: GameState; g: MiniGame; me: Player; act: Act; clock: () => number }) {
  const now = clock();
  const name = (id?: string | null) => s.players.find(p => p.id === id)?.name ?? '?';
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; buzz([300, 120, 300, 120, 300]); } }, []);

  // ---- called to the TV ----
  if (g.status === 'muster') {
    const here = g.ready.includes(me.id);
    const waiting = g.players.filter(id => !g.ready.includes(id));
    return (
      <div className="phone takeover mg muster">
        <div className="to-kicker">{GAME_NAMES[g.kind]}</div>
        <div className="mg-big">📺 GET TO THE TV</div>
        {!here
          ? <button className="p-btn big" onClick={() => { buzz(60); act('mg_ready', { game_id: g.id }).catch(() => {}); }}>I'M HERE</button>
          : <div className="to-hint">You're checked in. {waiting.length ? <>Waiting for <b>{waiting.map(name).join(', ')}</b>…</> : 'Starting as soon as the TV is free…'}</div>}
        <div className="to-hint">{g.state.waiting_host ? 'The host is deciding whether to start without everyone.' : `${secsLeft(g.muster_until, now)}s until the host can start without you.`}</div>
      </div>
    );
  }

  // ---- over: how did you do? ----
  if (g.status === 'done') {
    const lost = g.result?.losers.includes(me.id);
    return (
      <div className={'phone takeover notice ' + (lost ? 'knife' : 'ok')}>
        <div className="to-kicker">{GAME_NAMES[g.kind]}</div>
        <div className="to-title">{lost ? (g.kind === 'penny' ? 'DRINK!' : 'TO THE WHEEL') : 'YOU\'RE SAFE'}</div>
        <div className="to-sub">{outcome(g, me.id, name)}</div>
      </div>
    );
  }

  // ---- live ----
  const countdown = g.live_at ? Math.ceil((Date.parse(g.live_at) - now) / 1000) : 0;
  if (countdown > 0) {
    return <div className="phone takeover mg"><div className="to-kicker">{GAME_NAMES[g.kind]}</div><div className="mg-count">{countdown}</div><div className="to-hint">Eyes on the TV…</div></div>;
  }
  const left = secsLeft(g.ends_at, now);
  switch (g.kind) {
    case 'dodge': return <DodgeLive g={g} act={act} left={left} />;
    case 'plank': return <PlankLive g={g} act={act} clock={clock} />;
    case 'jack': {
      const turn = g.state.order?.[g.state.turn ?? 0];
      const mine = turn === me.id;
      return (
        <div className="phone takeover mg jack">
          <div className="to-kicker">🤡 JACK-IN-THE-BOX · {g.state.count ?? 0} CRANKS SO FAR</div>
          {mine
            ? <>
                <div className="mg-big">YOUR TURN · {left}s</div>
                <div className="to-hint">It pops somewhere between 8 and 20. Whoever pops it drinks.</div>
                <div className="mg-row3">{[1, 2, 3].map(n => <button key={n} className="p-btn big" onClick={() => { buzz(40 * n); act('mg_move', { game_id: g.id, n }).catch(() => {}); }}>{n}</button>)}</div>
                <div className="to-hint">Crank it 1, 2 or 3 times.</div>
              </>
            : <div className="mg-big dim">{name(turn)} is cranking… {left}s</div>}
          {g.state.last && <div className="to-hint">{name(g.state.last.player)} cranked {g.state.last.n}.</div>}
        </div>
      );
    }
    case 'bomb': {
      const holding = g.state.holder === me.id;
      const targets = s.players.filter(p => g.players.includes(p.id) && p.id !== me.id && (p.id !== g.state.from || g.players.length <= 2));
      return holding
        ? <div className="phone takeover mg bomb hot">
            <div className="mg-big">💣 YOU'VE GOT THE BOMB</div>
            <div className="to-hint">PASS IT! (Not straight back to {name(g.state.from)}.)</div>
            <div className="p-grid many">
              {targets.map(p => <button key={p.id} className="p-pick" onClick={() => { buzz(30); act('mg_move', { game_id: g.id, to: p.id }).catch(() => {}); }}>
                <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} /></button>)}
            </div>
          </div>
        : <div className="phone takeover mg bomb">
            <div className="to-kicker">💣 THE BOMB · {g.state.passes ?? 0} PASSES</div>
            <div className="mg-big dim">{name(g.state.holder)} has it</div>
            <div className="to-hint">Nobody knows how long the fuse is. Pray it isn't passed to you.</div>
          </div>;
    }
    case 'penny': {
      const called = typeof g.mine === 'string' ? g.mine : null;
      return (
        <div className="phone takeover mg penny">
          <div className="to-kicker">🪙 PENNY DROP · {left}s</div>
          <div className="mg-big">{called ? `YOU CALLED ${called.toUpperCase()}` : 'CALL IT!'}</div>
          {!called && <div className="mg-row2">
            {(['heads', 'tails'] as const).map(c => <button key={c} className="p-btn big" onClick={() => { buzz(40); act('mg_move', { game_id: g.id, call: c }).catch(() => {}); }}>{c.toUpperCase()}</button>)}
          </div>}
          <div className="to-hint">Wrong, or too slow, and you drink. {g.state.called ?? 0} of {g.players.length} have called.</div>
        </div>
      );
    }
  }
}

function outcome(g: MiniGame, me: string, name: (id?: string | null) => string) {
  const r = g.result!;
  if (r.no_show) return r.losers.includes(me) ? "You didn't make it to the TV in time." : `${r.losers.map(name).join(' & ')} didn't turn up.`;
  switch (g.kind) {
    case 'dodge': return r.dodged ? `It came from the ${r.dir?.toUpperCase()}. You read it and dodged.` : `It came from the ${r.dir?.toUpperCase()}.${r.guess ? ` You went ${r.guess.toUpperCase()}.` : ' You didn\'t move.'}`;
    case 'plank': return r.overboard?.length ? `${r.overboard.map(name).join(' & ')} went overboard.` : `${r.losers.map(name).join(' & ')} stopped furthest from the edge.`;
    case 'jack': return `It popped at ${r.pop}. ${name(r.popper)} made it pop.`;
    case 'bomb': return `It went off in ${name(r.losers[0])}'s hands.`;
    case 'penny': return `It landed ${r.coin?.toUpperCase()}.${r.losers.length ? ` ${r.losers.length} ${r.losers.length === 1 ? 'person drinks' : 'people drink'}.` : ' Everyone called it right!'}`;
  }
}

function DodgeLive({ g, act, left }: { g: MiniGame; act: Act; left: number }) {
  const guess = g.state.guess;
  return (
    <div className="phone takeover mg dodge">
      <div className="to-kicker">✴ INCOMING · {left}s</div>
      <div className="mg-big">{guess ? `YOU WENT ${guess.toUpperCase()}` : 'WHERE\'S IT COMING FROM?'}</div>
      {!guess && <div className="mg-dodge">
        <button className="p-btn big up" onClick={() => { buzz(40); act('mg_move', { game_id: g.id, dir: 'high' }).catch(() => {}); }}>⬆ HIGH</button>
        <button className="p-btn big" onClick={() => { buzz(40); act('mg_move', { game_id: g.id, dir: 'left' }).catch(() => {}); }}>⬅ LEFT</button>
        <button className="p-btn big" onClick={() => { buzz(40); act('mg_move', { game_id: g.id, dir: 'right' }).catch(() => {}); }}>RIGHT ➡</button>
      </div>}
      <div className="to-hint">Read it right and it misses. Wrong, or too slow, and you're off to the wheel.</div>
    </div>
  );
}

// Walk the Plank: the marker creeps out along the plank, speeding up; stop it as near the edge (100) as you dare.
const RUN_MS = 5200;
export const plankPos = (ms: number) => Math.min(110, 110 * Math.pow(Math.max(0, ms) / RUN_MS, 1.7));
function PlankLive({ g, act, clock }: { g: MiniGame; act: Act; clock: () => number }) {
  const start = Date.parse(g.live_at!);
  const stopped = typeof g.mine === 'number' ? g.mine : null;
  const [local, setLocal] = useState<number | null>(null);
  const [, tick] = useState(0);
  const sent = useRef(false);
  const pos = stopped ?? local ?? plankPos(clock() - start);
  const stop = (p: number) => {
    if (sent.current) return; sent.current = true;
    setLocal(p); buzz(p > 100 ? [200, 80, 200] : 60);
    act('mg_move', { game_id: g.id, pos: Math.round(p * 10) / 10 }).catch(() => { sent.current = false; });
  };
  useEffect(() => {
    if (stopped !== null || local !== null) return;
    let raf = 0;
    const loop = () => { const p = plankPos(clock() - start); if (p >= 110) { stop(110); return; } tick(x => x + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopped, local, start]);
  const done = stopped !== null || local !== null;
  return (
    <div className="phone takeover mg plank">
      <div className="to-kicker">🏴‍☠️ WALK THE PLANK</div>
      <div className="plank-bar"><i className="plank-edge" /><b className={'plank-me' + (pos > 100 ? ' over' : '')} style={{ left: `${Math.min(100, pos / 1.1)}%` }}>🏴‍☠️</b></div>
      {!done
        ? <button className="p-btn big stop" onClick={() => stop(pos)}>STOP!</button>
        : <div className="mg-big">{pos > 100 ? 'OVERBOARD!' : `STOPPED AT ${Math.round(pos)}`}</div>}
      <div className="to-hint">{done ? 'Waiting for the others… the TV shows who walked furthest.' : 'Stop as close to the edge as you dare. Go past it and you\'re overboard.'}</div>
    </div>
  );
}

/** Pick exactly N players (the Kraken picks 3, Pennywise picks 4). */
export function MultiPicker({ state, title, n, exclude, confirm, onPick, onClose }: {
  state: GameState; title: string; n: number; exclude: string[]; confirm: string; onPick: (ids: string[]) => Promise<void>; onClose: () => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSel(x => x.includes(id) ? x.filter(y => y !== id) : x.length < n ? [...x, id] : x);
  return (
    <div className="phone takeover picker">
      <div className="to-kicker">{title} ({sel.length}/{n})</div>
      <div className="p-grid">
        {state.players.filter(p => !exclude.includes(p.id)).map(p => (
          <button key={p.id} className={'p-pick' + (sel.includes(p.id) ? ' sel' : '')} onClick={() => toggle(p.id)}>
            <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} />
          </button>
        ))}
      </div>
      <div className="picker-actions">
        <button className="p-btn ghost" onClick={onClose}>CANCEL</button>
        <button className="p-btn" disabled={sel.length !== n || busy} onClick={async () => { setBusy(true); try { await onPick(sel); onClose(); } catch { setBusy(false); } }}>
          {sel.length === n ? confirm : `PICK ${n - sel.length} MORE`}</button>
      </div>
    </div>
  );
}

/** The Assassin's throw: pick where it comes from (the target has to read it). */
export function ThrowPicker({ target, onThrow, onClose }: { target: Player; onThrow: (dir: string) => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const go = async (d: string) => { setBusy(true); try { await onThrow(d); onClose(); } catch { setBusy(false); } };
  return (
    <div className="phone takeover mg dodge">
      <div className="to-kicker">✴ THROW AT {target.name.toUpperCase()}</div>
      <div className="mg-big">WHERE DO YOU THROW?</div>
      <div className="mg-dodge">
        <button className="p-btn big up" disabled={busy} onClick={() => go('high')}>⬆ HIGH</button>
        <button className="p-btn big" disabled={busy} onClick={() => go('left')}>⬅ LEFT</button>
        <button className="p-btn big" disabled={busy} onClick={() => go('right')}>RIGHT ➡</button>
      </div>
      <div className="to-hint">They're called to the TV and have to guess where it's coming from. Guess right and it misses. The TV never shows who threw it.</div>
      <button className="p-btn ghost" onClick={onClose}>CANCEL</button>
    </div>
  );
}
