// Phone side of the mini-games: the call to the TV ("I'M HERE"), each game's controls, and the
// pickers that start them. The server holds every secret (the throw, the pop number, the fuse,
// the coin); a phone only ever sends its own move.
import { useEffect, useRef, useState } from 'react';
import { Facts, Icon, Key, TopBar } from './kit';
import type { GameState, MiniGame, MiniKind, Player } from '../lib/types';
import { preloadTextures } from '../lib/textures';
import { DodgeHitPhone, DodgePhone, PlankPhone } from './MiniPhones';
import { BombPhone, JackPhone, JackPopPhone, PennyPhone, PennyResultPhone } from './MachinePhones';
import { errText } from '../lib/backend';
import type { Backend } from '../lib/backend';
import { sleep } from '../lib/util';
import { plankRevealMs } from '../tv/PlankTV';
import { levelOf } from '../lib/roles';
import { Sound } from '../fx/sound';

type Act = (action: string, args?: Record<string, unknown>) => Promise<any>;

/** A send that never got an answer (no signal, the wifi dropped, a gateway timeout), as opposed to a real refusal
 *  from the server ("Too late", "That game is over"), which arrives as a plain sentence and must never be retried. */
export function isNetErr(e: unknown): boolean {
  if (e instanceof TypeError) return true;                           // fetch itself failed
  return /failed to fetch|load failed|networkerror|failed to send a request|relay error|non-2xx|bad gateway|gateway time-?out|service unavailable|timed? ?out|offline/i
    .test(errText(e));
}

/** How long the phones keep quiet after Walk the Plank finishes, so the TV's one-by-one reveal isn't spoiled. */
// (plus a margin: the TV only starts its reveal when the done state reaches it, and its clock may lag the phone's)
export const PLANK_HUSH_MARGIN_MS = 3000;
const plankHushMs = (g: MiniGame) => plankRevealMs(g.players.length) + PLANK_HUSH_MARGIN_MS;
/** How long after a summoned game finishes before its result is public on the TV (dodge's cut-in, the Plank's one-by-one
 *  fall, Jack's pop). Until then the phones keep anything that would give the result away (the queue, your caps, a bet). */
export const MG_REVEAL_MS = 8000;
export const miniRevealMs = (g: MiniGame) => (g.kind === 'plank' && !g.result?.no_show ? plankHushMs(g) : MG_REVEAL_MS);
/** When this game's TV reveal is over (ms), or 0 if it isn't finished. */
export const miniRevealEnd = (g: MiniGame | null | undefined) => (g && g.status === 'done' && g.finished_at ? Date.parse(g.finished_at) + miniRevealMs(g) : 0);

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
  // a moment to see how it went (Walk the Plank: after the TV's reveal has played)
  if (g.status === 'done' && g.finished_at && now - Date.parse(g.finished_at) < 7000 + (g.kind === 'plank' ? plankHushMs(g) : 0)) return g;
  return null;
}

// The TV ticks mg_tick every second; if it has gone to sleep, a phone-only game (the Bomb, Penny Drop) would never
// settle. So the phones in it tick too, but only once the deadline has passed, with jitter, and every few seconds:
//   penny  ends_at is public: tick from ends_at + grace.
//   bomb   the fuse is secret, but the server lights it 20-40s after live_at, so nothing can be due before live_at + 20s.
// The server answers a tick quietly when there's nothing to settle, and doesn't care who sends it.
const BOMB_MIN_FUSE_MS = 20000, TICK_GRACE_MS = 1500, TICK_JITTER_MS = 1500;
// The tick goes straight to the backend, not through act(): act() refreshes the whole state after every call,
// which doubled the load for nothing (the realtime "changed" ping brings the new state when a tick settles a game).
function useDeadlineTick(g: MiniGame, backend: Backend, roomId: string, clock: () => number) {
  const due = g.status !== 'live' ? null
    : g.kind === 'penny' && g.ends_at ? Date.parse(g.ends_at) + TICK_GRACE_MS
    : g.kind === 'bomb' && g.live_at ? Date.parse(g.live_at) + BOMB_MIN_FUSE_MS + TICK_GRACE_MS
    : null;
  const every = g.kind === 'bomb' ? 4000 : 3000;
  const fns = useRef({ backend, roomId, clock }); fns.current = { backend, roomId, clock };
  useEffect(() => {
    if (due === null || Number.isNaN(due)) return;
    let t = 0, dead = false;
    const tick = () => {
      if (dead) return;
      fns.current.backend.api('mg_tick', { room_id: fns.current.roomId, game_id: g.id }).catch(() => {});
      t = window.setTimeout(tick, every + Math.random() * TICK_JITTER_MS);
    };
    t = window.setTimeout(tick, Math.max(0, due - fns.current.clock()) + Math.random() * TICK_JITTER_MS);
    return () => { dead = true; clearTimeout(t); };
  }, [g.id, due, every]);
}

export function GameTakeover({ s, g, me, act, backend, clock, caps }: { s: GameState; g: MiniGame; me: Player; act: Act; backend: Backend; clock: () => number; caps?: number | null }) {
  const now = clock();
  const name = (id?: string | null) => s.players.find(p => p.id === id)?.name ?? '?';
  const seat = (id?: string | null) => { const p = s.players.find(x => x.id === id); return { id: id ?? '', name: p?.name ?? '?', photo: p?.selfie_url ?? null }; };
  const first = useRef(true);
  // a game that skips the call to the TV still buzzes once; a summons rings (below)
  useEffect(() => { if (first.current) { first.current = false; if (g.status !== 'muster') buzz([300, 120, 300, 120, 300]); preloadTextures(); } }, []);
  // SUMMONED: the phone itself rings until I'M HERE: an alarm, a buzz (Android; iPhones can't vibrate from the web) and
  // three slow flashes, straight away and again every 20 seconds, in step with the TV calling the missing names.
  // The phone has to be awake with the game open: the web can't ring a locked phone.
  const summoned = g.status === 'muster' && !g.ready.includes(me.id);
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (!summoned) return;
    const go = () => { Sound.alarm(); buzz([300, 120, 300, 120, 300]); setRing(n => n + 1); };
    go();
    const t = window.setInterval(go, 20000);
    return () => clearInterval(t);
  }, [summoned, g.id]);
  useDeadlineTick(g, backend, s.room.id, clock);

  const lvl = s.me.level_info?.level ?? levelOf(me);
  const bar = <TopBar me={me} sub={me.rehab ? 'IN REHAB' : `LV${lvl} · ${me.beers} BEER${me.beers === 1 ? '' : 'S'}`} subTone={me.rehab ? 'red' : ''} room={s.room.code} live caps={caps} />;
  // ---- called to the TV ----
  if (g.status === 'muster') {
    const here = g.ready.includes(me.id);
    const waiting = g.players.filter(id => !g.ready.includes(id));
    return (
      <div className="pu-app pu-red">
        {summoned && ring > 0 && <div key={ring} className="pu-summon-flash" aria-hidden />}
        {bar}
        <div className="pu-verdict wait"><Icon n="tv" /></div>
        <div className="pu-kick pu-center pu-c-sodium" style={{ marginTop: 16 }}>{GAME_NAMES[g.kind]}</div>
        <div className="pu-hero pu-center">GET TO<br />THE TV</div>
        <div className="pu-body pu-center pu-c-bone2">{here ? (waiting.length ? `You're checked in. Waiting for ${waiting.map(name).join(', ')}.` : 'Everyone is here. Starting as soon as the TV is free.') : "Stand where you can see the TV, then tap I'M HERE."}</div>
        <Facts facts={[{ icon: 'clock', text: g.state.waiting_host ? 'The host is deciding whether to start without everyone.' : `${secsLeft(g.muster_until, now)}s until the host can start without you` }]} />
        <div className="pu-keys">{here ? <Key lg variant="steel" disabled icon="check">CHECKED IN</Key>
          : <Key lg className="pu-here" onClick={() => { buzz(60); act('mg_ready', { game_id: g.id }).catch(() => {}); }}>I'M HERE</Key>}</div>
      </div>
    );
  }

  // ---- over: how did you do? ----
  if (g.status === 'done') {
    // Walk the Plank: the TV reveals the stops one by one; the phones say nothing until it has
    if (g.kind === 'plank' && !g.result?.no_show && g.finished_at && now - Date.parse(g.finished_at) < plankHushMs(g)) {
      return (
        <div className="pu-app">
          {bar}
          <div className="pu-verdict wait"><Icon n="tv" /></div>
          <div className="pu-kick pu-center pu-c-sodium" style={{ marginTop: 16 }}>{GAME_NAMES[g.kind]}</div>
          <div className="pu-hero pu-center">WATCH<br />THE TV</div>
          <div className="pu-body pu-center pu-c-bone2">The Kraken is choosing. Your result comes up here after the TV shows it.</div>
        </div>
      );
    }
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
      <div className={'pu-app' + (lost ? ' pu-red' : '')}>
        {bar}
        <div className={'pu-verdict ' + (lost ? 'no' : 'ok')}><Icon n={lost ? 'cross' : 'check'} /></div>
        <div className={'pu-kick pu-center ' + (lost ? 'pu-c-red' : 'pu-c-green')} style={{ marginTop: 16 }}>{GAME_NAMES[g.kind]}</div>
        <div className="pu-display pu-center">{lost ? (g.kind === 'penny' ? 'DRINK!' : 'TO THE WHEEL') : "YOU'RE SAFE"}</div>
        <div className="pu-body pu-center pu-c-bone2">{outcome(g, me.id, name)}</div>
      </div>
    );
  }

  // ---- live ----
  const countdown = g.live_at ? Math.ceil((Date.parse(g.live_at) - now) / 1000) : 0;
  if (countdown > 0) {
    return (
      <div className="pu-app">
        {bar}
        <div className="pu-kick pu-center pu-c-sodium" style={{ marginTop: 40 }}>{GAME_NAMES[g.kind]}</div>
        <div className="pu-hero pu-center" style={{ fontSize: 160, marginTop: 24 }}>{countdown > 1 ? countdown - 1 : 'GO!'}</div>
        <div className="pu-body pu-center pu-c-bone2">Eyes on the TV.</div>
      </div>
    );
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
  const [failed, setFailed] = useState(false);
  const sent = useRef(false);
  const lastBuzz = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const landed = useRef(stopped !== null); landed.current = stopped !== null;
  const pos = stopped ?? local ?? plankPos(clock() - start);
  const stop = (p: number) => {
    if (sent.current) return; sent.current = true;
    setLocal(p); setFailed(false); buzz(p > 100 ? [200, 80, 200] : 60);
    // Party wifi drops: keep resending the same stop until the server stops taking them (ends_at + 1s). The server
    // keeps the clock (it only believes the phone's figure inside the last second, and clamps to its own), so a late
    // resend can't gain anything. A real refusal ("Too late", "That game is over") is final and never retried, and a
    // resend of a stop that did land is answered quietly.
    const pos = Math.round(p * 10) / 10;
    const deadline = (g.ends_at ? Date.parse(g.ends_at) : start + 14000) + 1000;
    void (async () => {
      for (let k = 0; ; k++) {
        if (!alive.current || landed.current) return;
        try { await act('mg_move', { game_id: g.id, pos }); return; }
        catch (e) {
          if (!isNetErr(e)) return;
          const left = deadline - clock();
          if (left <= 0) break;
          await sleep(Math.min(left, [250, 500, 900][k] ?? 1000));
        }
      }
      // it never got through: say so, and put STOP back (the marker carries on from where the server's clock has it)
      if (!alive.current || landed.current) return;
      sent.current = false; setLocal(null); setFailed(true); buzz([80, 60, 80, 60, 80]);
    })();
  };
  useEffect(() => {
    if (stopped !== null || local !== null) return;
    let raf = 0;
    const loop = () => {
      const p = plankPos(clock() - start);
      if (p >= 110) { if (!failed) stop(110); return; }       // (after NOT SENT, only a tap resends)
      // the closer to the edge, the faster it buzzes (a short tick; from every 700ms down to every 110ms)
      const now = performance.now(), every = 700 - Math.min(100, p) * 5.9;
      if (p > 20 && now - lastBuzz.current > every) { lastBuzz.current = now; buzz(18); }
      tick(x => x + 1); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopped, local, start, failed]);
  const done = stopped !== null || local !== null;
  return <>
    <PlankPhone pos={pos} done={done} name={me.name} photo={me.selfie_url} onStop={() => stop(pos)} />
    {failed && !done && (
      // the stop never reached the server: a loud banner over the scene, and the STOP key is live again
      <button type="button" className="pu-plank-unsent" onClick={() => stop(plankPos(clock() - start))}
        style={{ position: 'fixed', left: 16, right: 16, top: 16, zIndex: 50, padding: '18px 12px', border: 0, borderRadius: 10,
          background: '#e8391f', color: '#fff', font: "900 30px/1.05 'Big Shoulders Display', sans-serif", letterSpacing: '.04em',
          boxShadow: '0 0 0 4px #2a0303, 0 10px 18px rgba(0,0,0,.6)' }}>NOT SENT · TAP AGAIN</button>
    )}
  </>;
}
