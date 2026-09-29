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
import { useStageScale } from './Scenes';
import { GAME_NAMES } from '../phone/PhoneGames';

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
  const secs = (iso: string | null) => (iso ? Math.max(0, Math.ceil((Date.parse(iso) - t) / 1000)) : 0);

  // sounds on each beat
  const beat = g.status === 'live' && g.live_at && Date.parse(g.live_at) > t ? 'count' : g.status;
  const last = useRef<string>('');
  useEffect(() => {
    if (last.current === beat) return;
    last.current = beat;
    if (beat === 'muster') Sound.alarm();
    else if (beat === 'count') Sound.drumroll();
    else if (beat === 'live') Sound.fanfare();
    else if (beat === 'done') { if (g.result?.losers.length) { Sound.thud(); setTimeout(() => Sound.lose(), 300); } else Sound.win(); }
  }, [beat, g.result]);
  const passes = g.state.passes ?? 0;
  useEffect(() => { if (g.kind === 'bomb' && passes) Sound.tick(); }, [g.kind, passes]);
  const count = g.state.count ?? 0;
  useEffect(() => { if (g.kind === 'jack' && count) Sound.clunk(); }, [g.kind, count]);

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
    const losers = new Set(r?.losers ?? []);
    const timer = !done && g.ends_at ? <div className="mg-timer">{secs(g.ends_at)}</div> : null;
    switch (g.kind) {
      case 'dodge': {
        const p = byId(g.players[0]);
        const dir = done ? r?.dir : null;
        body = (
          <div className={'mg-dodge-tv' + (done ? (r?.dodged ? ' dodged' : ' hit') : '')}>
            <div className="mg-title">{title}</div>
            <div className={'mg-target' + (dir ? ' from-' + dir : '')}>
              <Photo p={p} />
              <svg className="mg-star" viewBox="-50 -50 100 100"><path d="M0-46 L9-9 L46 0 L9 9 L0 46 L-9 9 L-46 0 L-9-9Z" fill="#c9ced6" stroke="#15171b" strokeWidth="3" /><circle r="8" fill="#15171b" /></svg>
            </div>
            <div className="mg-sub">{done
              ? (r?.no_show ? `${p?.name.toUpperCase()} NEVER SHOWED · HIT` : r?.dodged ? `IT CAME FROM THE ${r.dir?.toUpperCase()} · ${p?.name.toUpperCase()} DODGED IT!` : `IT CAME FROM THE ${r?.dir?.toUpperCase()} · ${p?.name.toUpperCase()} ${r?.guess ? `WENT ${r.guess.toUpperCase()}` : 'FROZE'} · HIT!`)
              : <>WHERE'S IT COMING FROM? <b>LEFT · HIGH · RIGHT</b></>}</div>
            {timer}
          </div>
        );
        break;
      }
      case 'plank': {
        const stopped = new Set(g.state.stopped ?? []);
        body = (
          <div className="mg-plank-tv">
            <div className="mg-title">{title}</div>
            <div className="mg-planks">
              {g.players.map(id => {
                const pos = done ? r?.pos?.[id] ?? 110 : 0;
                const over = done && pos > 100;
                return (
                  <div key={id} className={'mg-plank' + (losers.has(id) ? ' lost' : '') + (over ? ' over' : '')}>
                    <div className="mg-board"><i className="mg-edge" />
                      <div className="mg-pirate" style={{ left: `${Math.min(100, pos) * 0.86}%` }}><Photo p={byId(id)} /></div>
                      {over && <span className="mg-splash">SPLASH!</span>}
                    </div>
                    <div className="mg-plank-name">{byId(id)?.name.toUpperCase()} · {done ? (over ? 'OVERBOARD' : Math.round(pos)) : stopped.has(id) ? 'STOPPED' : 'WALKING…'}</div>
                  </div>
                );
              })}
            </div>
            <div className="mg-sub">{done ? (r?.no_show ? 'NO-SHOW' : `${[...losers].map(id => byId(id)?.name.toUpperCase()).join(' & ')} WALKS THE PLANK`) : 'STOP AS CLOSE TO THE EDGE AS YOU DARE'}</div>
            {timer}
          </div>
        );
        break;
      }
      case 'jack': {
        const order = g.state.order ?? g.players;
        const turn = order[g.state.turn ?? 0];
        const popper = done ? r?.popper ?? r?.losers[0] : null;
        body = (
          <div className={'mg-jack-tv' + (done ? ' popped' : '')}>
            <div className="mg-title">{title}</div>
            <div className="mg-box">
              <div className="mg-lid" />
              <div className="mg-crate"><span>{count}</span><i className="mg-crank" style={{ transform: `rotate(${count * 120}deg)` }} /></div>
              {done && <div className="mg-clown">🤡</div>}
            </div>
            <div className="mg-order">
              {order.map(id => <div key={id} className={'mg-seat' + (id === turn && !done ? ' turn' : '') + (id === popper ? ' lost' : '')}><Photo p={byId(id)} /><b>{byId(id)?.name.toUpperCase()}</b></div>)}
            </div>
            <div className="mg-sub">{done ? (r?.no_show ? 'NO-SHOW' : `POP! AT ${r?.pop} · ${byId(popper)?.name.toUpperCase()} GETS THE CLOWN`)
              : <>{g.state.last ? `${byId(g.state.last.player)?.name.toUpperCase()} CRANKED ${g.state.last.n} · ` : ''}<b>{byId(turn)?.name.toUpperCase()}</b>'S TURN</>}</div>
            {timer}
          </div>
        );
        break;
      }
      case 'bomb': {
        const holder = done ? r?.losers[0] : g.state.holder;
        body = (
          <div className={'mg-bomb-tv' + (done ? ' boom' : '')}>
            <div className="mg-title">{done ? 'BOOM!' : title}</div>
            <div className="mg-grid">
              {g.players.map(id => <div key={id} className={'mg-seat' + (id === holder ? ' holder' : '')}><Photo p={byId(id)} /><b>{byId(id)?.name.toUpperCase()}</b>{id === holder && <span className="mg-bombicon">💣</span>}</div>)}
            </div>
            <div className="mg-sub">{done ? `IT WENT OFF IN ${byId(holder)?.name.toUpperCase()}'S HANDS · ${passes} PASSES` : <>PASS IT ON · <b>{passes}</b> PASSES · THE FUSE IS SECRET</>}</div>
          </div>
        );
        break;
      }
      case 'penny': {
        body = (
          <div className={'mg-penny-tv' + (done ? ' landed' : '')}>
            <div className="mg-title">{title}</div>
            <div className={'mg-coin' + (done ? ' ' + r?.coin : '')}><span>{done ? (r?.coin === 'heads' ? '👑' : '🏛') : '£'}</span></div>
            {done
              ? <>
                  <div className="mg-sub">IT'S <b>{r?.coin?.toUpperCase()}</b>{losers.size ? ' · THESE DRINK:' : ' · EVERYONE CALLED IT!'}</div>
                  <div className="mg-grid small">{[...losers].map(id => <div key={id} className="mg-seat lost"><Photo p={byId(id)} /><b>{byId(id)?.name.toUpperCase()}</b></div>)}</div>
                </>
              : <div className="mg-sub">CALL IT ON YOUR PHONE · <b>{g.state.called ?? 0}</b> / {g.players.length} CALLED</div>}
            {timer}
          </div>
        );
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
