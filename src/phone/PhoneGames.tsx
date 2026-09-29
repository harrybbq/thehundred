// Phone side of the mini-games: the call to the TV ("I'M HERE"), each game's controls, and the
// pickers that start them. The server holds every secret (the throw, the pop number, the fuse,
// the coin); a phone only ever sends its own move.
import { useEffect, useRef, useState } from 'react';
import type { GameState, MiniGame, MiniKind, Player } from '../lib/types';
import { Polaroid } from '../components/ui';
import { preloadTextures } from '../lib/textures';
import { DodgeHitPhone, DodgePhone, PlankPhone } from './MiniPhones';
import { BombPhone, JackPhone, JackPopPhone, PennyPhone, PennyResultPhone } from './MachinePhones';

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
  const seat = (id?: string | null) => { const p = s.players.find(x => x.id === id); return { id: id ?? '', name: p?.name ?? '?', photo: p?.selfie_url ?? null }; };
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; buzz([300, 120, 300, 120, 300]); preloadTextures(); } }, []);

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
    if (g.kind === 'dodge' && lost) {
      const r = g.result!;
      return <DodgeHitPhone line={r.no_show ? "You didn't make it to the TV in time. Off to the wheel."
        : `It came from ${fromWhere(r.dir)}. ${r.guess ? `You went ${r.guess}.` : "You didn't move."} Off to the wheel.`} />;
    }
    const r = g.result;
    if (g.kind === 'penny' && r?.coin && !r.no_show) return <PennyResultPhone coin={r.coin} mine={typeof g.mine === 'string' ? g.mine : null} />;
    if (g.kind === 'jack' && r && !r.no_show && (r.popper ?? r.losers[0])) { const popper = (r.popper ?? r.losers[0])!; return <JackPopPhone you={popper === me.id} name={name(popper)} at={r.pop ?? g.state.count ?? 0} />; }
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
    return <div className="phone takeover mg"><div className="to-kicker">{GAME_NAMES[g.kind]}</div><div className="mg-count">{countdown > 1 ? countdown - 1 : 'GO!'}</div><div className="to-hint">Eyes on the TV…</div></div>;
  }
  const left = secsLeft(g.ends_at, now);
  switch (g.kind) {
    case 'dodge': return <DodgeLive g={g} act={act} left={left} me={me} />;
    case 'plank': return <PlankLive g={g} act={act} clock={clock} me={me} />;
    case 'jack': {
      const order = g.state.order ?? g.players;
      const t = g.state.turn ?? 0, me_i = order.indexOf(me.id);
      return <JackPhone mine={order[t] === me.id} count={g.state.count ?? 0} secs={left}
        order={order.map((id, i) => ({ name: name(id), you: id === me.id, cur: i === t, next: me_i === (t + 1) % order.length }))}
        onCrank={n => act('mg_move', { game_id: g.id, n }).catch(() => {})} />;
    }
    case 'bomb': {
      const holding = g.state.holder === me.id;
      const blocked = g.players.length > 2 && g.state.from ? seat(g.state.from) : null;
      const targets = g.players.filter(id => id !== me.id && id !== blocked?.id).map(seat);
      return <BombPhone holding={holding} holder={seat(g.state.holder)} blocked={holding ? blocked : null} targets={targets} passes={g.state.passes ?? 0}
        onPass={to => act('mg_move', { game_id: g.id, to })} />;
    }
    case 'penny': {
      const called = g.mine === 'heads' || g.mine === 'tails' ? g.mine : null;
      return <PennyPhone mine={called} secs={left} called={g.state.called ?? 0} n={g.players.length}
        onCall={call => act('mg_move', { game_id: g.id, call }).catch(() => {})} />;
    }
  }
}

/** Where the throw came from, in words: "the left", "the right", "above". */
const fromWhere = (dir?: string | null) => (dir === 'high' ? 'above' : `the ${dir}`);

function outcome(g: MiniGame, me: string, name: (id?: string | null) => string) {
  const r = g.result!;
  if (r.no_show) return r.losers.includes(me) ? "You didn't make it to the TV in time." : `${r.losers.map(name).join(' & ')} didn't turn up.`;
  switch (g.kind) {
    case 'dodge': return r.dodged ? `It came from ${fromWhere(r.dir)}. You read it and dodged.` : `It came from ${fromWhere(r.dir)}.${r.guess ? ` You went ${r.guess}.` : ' You didn\'t move.'}`;
    case 'plank': return r.overboard?.length ? `${r.overboard.map(name).join(' & ')} went overboard.` : `${r.losers.map(name).join(' & ')} stopped furthest from the edge.`;
    case 'jack': return `It popped at ${r.pop}. ${name(r.popper)} made it pop.`;
    case 'bomb': return `It went off in ${name(r.losers[0])}'s hands.`;
    case 'penny': return `It landed ${r.coin?.toUpperCase()}.${r.losers.length ? ` ${r.losers.length} ${r.losers.length === 1 ? 'person drinks' : 'people drink'}.` : ' Everyone called it right!'}`;
  }
}

function DodgeLive({ g, act, left, me }: { g: MiniGame; act: Act; left: number; me: Player }) {
  const guess = g.state.guess ?? null;
  return <DodgePhone left={left} guess={guess} name={me.name} photo={me.selfie_url}
    onGuess={dir => { buzz(40); act('mg_move', { game_id: g.id, dir }).catch(() => {}); }} />;
}

// Walk the Plank: the marker creeps out along the plank, speeding up; stop it as near the edge (100) as you dare.
const RUN_MS = 5200;
export const plankPos = (ms: number) => Math.min(110, 110 * Math.pow(Math.max(0, ms) / RUN_MS, 1.7));
function PlankLive({ g, act, clock, me }: { g: MiniGame; act: Act; clock: () => number; me: Player }) {
  const start = Date.parse(g.live_at!);
  const stopped = typeof g.mine === 'number' ? g.mine : null;
  const [local, setLocal] = useState<number | null>(null);
  const [, tick] = useState(0);
  const sent = useRef(false);
  const lastBuzz = useRef(0);
  const pos = stopped ?? local ?? plankPos(clock() - start);
  const stop = (p: number) => {
    if (sent.current) return; sent.current = true;
    setLocal(p); buzz(p > 100 ? [200, 80, 200] : 60);
    act('mg_move', { game_id: g.id, pos: Math.round(p * 10) / 10 }).catch(() => { sent.current = false; });
  };
  useEffect(() => {
    if (stopped !== null || local !== null) return;
    let raf = 0;
    const loop = () => {
      const p = plankPos(clock() - start);
      if (p >= 110) { stop(110); return; }
      // the closer to the edge, the faster it buzzes (a short tick; from every 700ms down to every 110ms)
      const now = performance.now(), every = 700 - Math.min(100, p) * 5.9;
      if (p > 20 && now - lastBuzz.current > every) { lastBuzz.current = now; buzz(18); }
      tick(x => x + 1); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopped, local, start]);
  return <PlankPhone pos={pos} done={stopped !== null || local !== null} name={me.name} photo={me.selfie_url} onStop={() => stop(pos)} />;
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
