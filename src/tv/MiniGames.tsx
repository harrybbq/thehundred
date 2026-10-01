// TV side of the mini-games, on the fixed 1920×1080 stage. Three beats:
//   muster  WANTED AT THE TV: the summoned players' photos, a tick as each taps I'M HERE, a countdown;
//           after 90s the host decides (start anyway: no-shows lose · call it off: the ability is refunded)
//   live    3-2-1, then the game itself (nothing secret is ever on screen: not the throw, the pop, the fuse or the coin)
//   done    the reveal, held for a few seconds
// The TV also ticks the server every second while a game is on, so deadlines move without anyone tapping.
import { useEffect, useRef } from 'react';
import type { GameState, MiniGame, Player } from '../lib/types';
import type { Act } from './TvRoom';
import { initials } from '../lib/util';
import { Sound } from '../fx/sound';
import { preloadNameCalls, stopSummon, summon } from '../fx/nameCalls';
import { useStageScale } from './Scenes';
import { GAME_NAMES } from '../phone/PhoneGames';
import { PlankTV } from './PlankTV';
import { DodgeTV } from './DodgeTV';
import { BombTV } from './BombTV';
import { PennyTV } from './PennyTV';
import { JackTV } from './JackTV';

const TAGLINES: Record<MiniGame['kind'], string> = {
  dodge: 'Something is coming out of the shadows. Read where it\'s coming from, or take the hit.',
  plank: 'The Kraken wants a sacrifice. Stop at the edge. Go too far and you\'re over.',
  jack: 'Turn the crank. 1, 2 or 3 at a time. Somebody is getting a clown in the face.',
  bomb: 'It\'s on everyone\'s phone. Pass it on. Nobody knows how long the fuse is.',
  penny: 'Heads or tails? Call it on your phone. Wrong, or silent, and you drink.',
};

function Photo({ p, className = '' }: { p?: Player; className?: string }) {
  return p?.selfie_url
    ? <img className={'jr-photo ' + className} src={p.selfie_url} alt={p.name} draggable={false} />
    : <div className={'jr-photo jr-blank ' + className}>{initials(p?.name ?? '?')}</div>;
}

export function MiniGameOverlay({ state, g, act, now }: { state: GameState; g: MiniGame; act: Act; now: () => number }) {
  const scale = useStageScale();
  const byId = (id?: string | null) => state.players.find(p => p.id === id);
  const t = now();
  const seats = (ids: string[]) => ids.map(id => { const p = byId(id); return { id, name: p?.name ?? '?', photo: p?.selfie_url ?? null }; });
  const secs = (iso: string | null) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - t) / 1000)) : 0);

  // sounds on each beat up to GO; from then on each game's scene plays its own, timed to its animation
  const beat = g.status === 'live' && g.live_at && Date.parse(g.live_at) > t ? 'count' : g.status;
  const last = useRef<string>('');
  useEffect(() => {
    if (last.current === beat) return;
    last.current = beat;
    if (beat === 'muster') Sound.alarm();
    else if (beat === 'count') Sound.drumroll();
    else if (beat === 'live') Sound.fanfare();
    else if (beat === 'cancelled') Sound.down();
  }, [beat]);

  // SPOKEN SUMMONS (name clips from public/assets/names/, the voice for any name without one; fx/nameCalls.ts):
  // the TV calls the summoned players who haven't tapped I'M HERE, by name, ~1.6s after the
  // alarm and then every 20s until they're all in or the muster ends. Only the summoned names (the same ones on
  // the WANTED posters), never who started the game.
  const mustering = g.status === 'muster';
  const missing = g.players.filter(id => !g.ready.includes(id));
  const callNames = useRef<string[]>([]);
  callNames.current = missing.map(id => byId(id)?.name?.trim() ?? '').filter(Boolean);
  const allIn = missing.length === 0;
  useEffect(() => {
    if (!mustering || allIn) return;
    preloadNameCalls();
    const call = () => { const n = callNames.current; if (n.length) summon(n); };
    let iv: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => { call(); iv = setInterval(call, 20000); }, 1600);
    return () => { clearTimeout(first); if (iv) clearInterval(iv); stopSummon(); };
  }, [g.id, mustering, allIn]);
  const passes = g.state.passes ?? 0;
  const count = g.state.count ?? 0;

  const title = GAME_NAMES[g.kind];
  let body: JSX.Element;
  if (g.status === 'muster') {
    body = (
      <div className="mg-muster">
        <div className="mg-kick">WANTED AT THE TV</div>
        <div className="mg-title">{title}</div>
        <div className="mg-sub">{TAGLINES[g.kind]}</div>
        <div className="mg-wanted">
          {g.players.map(id => (
            <div key={id} className={'mg-poster' + (g.ready.includes(id) ? ' here' : '')}>
              <Photo p={byId(id)} />
              <b>{byId(id)?.name.toUpperCase()}</b>
              <span className="mg-stamp">{g.ready.includes(id) ? '✓ HERE' : 'ON THE WAY…'}</span>
            </div>
          ))}
        </div>
        {g.state.waiting_host
          ? <div className="mg-host">
              <div className="mg-sub">Not everyone's turned up.</div>
              <button className="jr-btn inline" onClick={() => act('mg_decide', { game_id: g.id, start: true }).catch(() => {})}>START ANYWAY · NO-SHOWS LOSE</button>
              <button className="jr-btn inline ghost" onClick={() => act('mg_decide', { game_id: g.id, start: false }).catch(() => {})}>CALL IT OFF</button>
            </div>
          : <div className="mg-clock">{g.ready.length === g.players.length ? 'EVERYONE\'S HERE · STARTING WHEN THE TV IS FREE' : <>TAP <b>I'M HERE</b> ON YOUR PHONE · {secs(g.muster_until)}s</>}</div>}
      </div>
    );
  } else if (beat === 'count') {
    const c = secs(g.live_at) - 1;                                    // 4s lead-in: 3, 2, 1, GO!
    body = <div className="mg-countdown"><div className="mg-title">{title}</div><div className="mg-num" key={c}>{c > 0 ? c : 'GO!'}</div></div>;
  } else {
    const done = g.status === 'done' || g.status === 'cancelled';
    const r = g.result;
    switch (g.kind) {
      case 'dodge': {
        // the throw's direction only exists here once the result is in; the TV never names the thrower
        const p = byId(g.players[0]);
        body = <DodgeTV target={{ id: p?.id ?? '', name: p?.name ?? '?', photo: p?.selfie_url ?? null }}
          result={done && r ? { dir: r.dir, guess: r.guess, dodged: r.dodged, no_show: r.no_show } : null}
          secs={!done && g.ends_at ? secs(g.ends_at) : null} />;
        break;
      }
      case 'plank': {
        // THE RULE: until the reveal the TV gets nobody's stop or position (not even who has stopped):
        // everyone walks one shared curve. Positions arrive with the result.
        body = <PlankTV walkers={g.players.map(id => { const p = byId(id); return { id, name: p?.name ?? '?', photo: p?.selfie_url ?? null }; })}
          result={done && r ? { pos: r.pos, losers: r.losers, overboard: r.overboard, no_show: r.no_show } : null}
          secs={!done && g.ends_at ? secs(g.ends_at) : null} />;
        break;
      }
      case 'jack': {
        // public only: the count, whose turn, the last crank. The pop number arrives with the result.
        body = <JackTV order={seats(g.state.order ?? g.players)} turn={g.state.turn ?? 0} count={count} last={g.state.last ?? null}
          pop={done && !r?.no_show && (r?.popper ?? r?.losers[0]) ? { popper: (r!.popper ?? r!.losers[0])!, at: r!.pop ?? count } : null} />;
        break;
      }
      case 'bomb': {
        // public facts only: who holds it, who passed it, the pass count; after the boom, the loser. Never the fuse.
        body = <BombTV players={seats(g.players)} holder={done ? r?.losers[0] ?? null : g.state.holder ?? null}
          prev={done ? null : g.state.from ?? null} passes={passes} boom={done && !!r?.losers.length} />;
        break;
      }
      case 'penny': {
        // live: only HOW MANY have called. The calls and the coin arrive with the result.
        body = <PennyTV players={seats(g.players)} called={g.state.called ?? 0} secs={!done && g.ends_at ? secs(g.ends_at) : null}
          result={done && r?.coin ? { coin: r.coin, calls: r.calls ?? {}, losers: r.losers } : null} />;
        break;
      }
    }
  }
  return (
    <div className={'jr-ov mg-ov kind-' + g.kind}>
      <div className="jr-stage" style={{ transform: `scale(${scale})` }}>{body}</div>
    </div>
  );
}

/** Keep a live game moving: nudge the server once a second (it answers "nothing to do" quietly). */
export function useMiniGameTicker(g: MiniGame | null | undefined, tick: (id: string) => void) {
  const active = g && (g.status === 'muster' || g.status === 'live') ? g.id : null;
  const fn = useRef(tick); fn.current = tick;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => fn.current(active), 1000);
    return () => clearInterval(id);
  }, [active]);
}
