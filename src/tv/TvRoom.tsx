// The TV / host screen for one room. Everything shown here comes from get_state()
// for the host, which never contains secret roles. Animations are driven by the
// public event feed + state diffs, serialised through a small animation queue.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import { useRoom, useTicker } from '../lib/useRoom';
import type { GameEvent, GameState, Player } from '../lib/types';
import { ROLES } from '../lib/roles';
import { fmtClock, fmtDur, sleep } from '../lib/util';
import { Sound, setSoundEnabled, soundEnabled } from '../fx/sound';
import { bubblesFrom, burst, centerOf, floatEmoji, rain, restartAnim, showBanner, toast } from '../fx/effects';
import { Avatar } from '../components/ui';
import { PlayerGrid } from './PlayerGrid';
import { RoundOverlay } from './RoundOverlay';
import { VoteOverlay } from './VoteOverlay';
import { Lobby } from './Lobby';
import { CurseApproval, ExposeModal, GameModal, PlayerDetail, RevealAllConfirm, SettingsModal } from './TvModals';

const FINAL_STRETCH = 15 * 60 * 1000;
export type Act = <T = any>(action: string, args?: Record<string, unknown>) => Promise<T>;

export function TvRoom({ backend, code, onExit }: { backend: Backend; code: string; onExit: () => void }) {
  const { state, error, connected, refresh, now } = useRoom(backend, code, floatEmoji);
  useTicker(250);

  const act: Act = useCallback(async (action, args = {}) => {
    try {
      const r = await backend.api(action, { room_id: state?.room.id, ...args });
      refresh();
      return r;
    } catch (e) {
      const m = errText(e);
      if (m !== 'NEEDS_ROLE') toast('⚠ ' + m, 4000);
      throw e;
    }
  }, [backend, state?.room.id, refresh]);

  // ---------- serialised animation queue ----------
  const fxq = useRef(Promise.resolve());
  const enqueue = useCallback((fn: () => Promise<void> | void) => {
    fxq.current = fxq.current.then(async () => { await fn(); }).catch(() => {});
    return fxq.current;
  }, []);

  // ---------- local UI state ----------
  const [showLobby, setShowLobby] = useState(false);
  const [modal, setModal] = useState<null | { kind: 'settings' | 'game' | 'detail' | 'expose' | 'revealAll'; id?: string }>(null);
  const [jester, setJester] = useState<null | { title: string; sub: string }>(null);
  const [bigOverlay, setBigOverlay] = useState<null | 'win' | 'end'>(null);
  const [revealMask, setRevealMask] = useState<Set<string>>(new Set());
  const [revealSummary, setRevealSummary] = useState(false);

  // ---------- event feed → animations ----------
  const lastEvt = useRef<number | null>(null);
  const prevTally = useRef<number | null>(null);
  const prevPlayers = useRef<Player[]>([]);
  const endingRef = useRef(false);

  const pName = (s: GameState, id?: string | null) => s.players.find(p => p.id === id)?.name ?? '???';
  const cardEl = (id: string) => document.querySelector(`.card[data-id="${id}"]`);

  useEffect(() => {
    if (!state || state.error) return;
    const s = state;
    // milestones: detect live crossings only (so a refresh never re-celebrates)
    const t = s.room.tally;
    if (prevTally.current !== null && t > prevTally.current && !s.room.ended) {
      const ms = [0.25, 0.5, 0.75].map(f => Math.round(s.room.target * f));
      const crossed = ms.filter(m => prevTally.current! < m && t >= m);
      if (prevTally.current < s.room.target && t >= s.room.target) setBigOverlay('win');
      else if (crossed.length) {
        const m = crossed[crossed.length - 1];
        Sound.fanfare();
        showBanner({ title: `${m} DOWN!`, sub: `${s.room.target - m} TO GO — KEEP DRINKING 🍻`, hold: 3.2 });
        const [x, y] = centerOf(document.getElementById('tallyNum'));
        burst(x, y, { count: 160, speed: 18 });
      }
    }
    if (prevTally.current !== null && t !== prevTally.current) restartAnim(document.getElementById('tallyNum'), t > prevTally.current ? 'pop' : 'drop');
    prevTally.current = t;

    if (lastEvt.current === null) {             // first load: don't replay history
      lastEvt.current = s.events.at(-1)?.id ?? 0;
      prevPlayers.current = s.players;
      if (s.room.ended) setBigOverlay('end');
      return;
    }
    const fresh = s.events.filter(e => e.id > lastEvt.current!);
    lastEvt.current = s.events.at(-1)?.id ?? lastEvt.current;
    const before = prevPlayers.current;
    prevPlayers.current = s.players;
    for (const ev of fresh) handleEvent(ev, s, before);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.room?.version]);

  function handleEvent(ev: GameEvent, s: GameState, before: Player[]) {
    const p = ev.payload;
    switch (ev.kind) {
      case 'joined': Sound.pop(); toast(`👋 ${pName(s, p.player)} joined`); break;
      case 'beer':
        Sound.pop();
        bubblesFrom(document.getElementById('beerbar'), p.player ? `+1 ${pName(s, p.player)}` : '+1');
        break;
      case 'unbeer': Sound.down(); break;
      case 'cursed': enqueue(async () => { Sound.curse(); await showBanner({ title: '💀 CURSED', sub: `${pName(s, p.player).toUpperCase()} HOLDS THE CURSE`, color: 'var(--purple)', hold: 2.6 }); }); break;
      case 'exposed': enqueue(async () => {
        setTimeout(() => { restartAnim(cardEl(p.player)?.querySelector('.role') ?? null, 'stamp-in'); restartAnim(cardEl(p.player), 'thud'); }, 30);
        Sound.reveal();
        const R = ROLES[p.role as keyof typeof ROLES];
        await showBanner({ title: `${R.icon} ${R.label.toUpperCase()}`, sub: `${pName(s, p.player).toUpperCase()} HAS BEEN EXPOSED`, color: R.color, hold: 2.6 });
      }); break;
      case 'accepted':
        for (const id of [p.player, p.partner].filter(Boolean)) {
          restartAnim(cardEl(id), 'punished'); restartAnim(cardEl(id)?.querySelector('.pcount') ?? null, 'bump');
        }
        Sound.thud();
        break;
      case 'lovebirds': enqueue(async () => {
        Sound.love();
        for (const id of [p.a, p.b]) { const [x, y] = centerOf(cardEl(id)); burst(x, y, { count: 40, colors: ['#ff2d95', '#ff7ab8', '#fff'], shape: 'heart', size: 22, speed: 12 }); }
        await showBanner({ title: '💘 LOVEBIRDS!', sub: `${pName(s, p.a).toUpperCase()} & ${pName(s, p.b).toUpperCase()} SHARE THE PAIN`, color: 'var(--pink)', hold: 3.2 });
      }); break;
      case 'jester': enqueue(async () => {
        const sub = p.kind === 'respin' ? 'FORCED A RE-SPIN!'
          : p.kind === 'swap' ? `SWAPPED THE VICTIM: ${pName(s, p.from).toUpperCase()} → ${pName(s, p.to).toUpperCase()}`
          : `SCRAWLED ON THE WHEEL: “${p.text}”`;
        setJester({ title: '🃏 THE JESTER STRIKES', sub });
        Sound.jester();
        await sleep(3400);
        setJester(null);
      }); break;
      case 'penalty': Sound.beep(); toast(`🍺 PENALTY — ${pName(s, p.player)} owes a drink`, 7000); break;
      case 'curse_request': Sound.curse(); break;
      case 'curse_passed': enqueue(async () => { Sound.curse(); await showBanner({ title: '💀 CURSE PASSED', sub: `${pName(s, p.from).toUpperCase()} → ${pName(s, p.to).toUpperCase()}`, color: 'var(--purple)', hold: 3 }); }); break;
      case 'game_start': enqueue(async () => { Sound.fanfare(); await showBanner({ title: '🎮 NOW PLAYING', sub: String(p.name).toUpperCase(), color: 'var(--cyan)', hold: 2.4 }); }); break;
      case 'game_over': enqueue(async () => {
        Sound.thud();
        const losers = (p.losers as string[]).map(id => pName(s, id).toUpperCase()).join(', ');
        await showBanner({ title: 'GAME OVER', sub: losers ? `LOSERS: ${losers}` : 'NO LOSERS?!', color: 'var(--red)', hold: 3 });
      }); break;
      case 'ended': Sound.alarm(); setTimeout(() => setBigOverlay('end'), 600); break;
      case 'reveal_all': {
        const hidden = new Set(s.players.filter(pl => pl.public_role && !before.find(b => b.id === pl.id)?.public_role).map(pl => pl.id));
        setRevealMask(hidden);
        setBigOverlay(null);
        enqueue(async () => {
          for (const pl of s.players.filter(x => hidden.has(x.id))) {
            setRevealMask(m => { const n = new Set(m); n.delete(pl.id); return n; });
            await sleep(40);
            restartAnim(cardEl(pl.id)?.querySelector('.role') ?? null, 'stamp-in'); restartAnim(cardEl(pl.id), 'thud');
            Sound.thud();
            const [x, y] = centerOf(cardEl(pl.id)); burst(x, y, { count: 30, colors: [ROLES[pl.public_role!].color, '#fff'], speed: 10 });
            await sleep(900);
          }
          Sound.fanfare();
          setRevealSummary(true);
        });
        break;
      }
    }
  }

  // ---------- deadline ----------
  const deadline = state ? Date.parse(state.room.deadline_at) : 0;
  const remaining = deadline - now();
  const lastBeep = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.error || state.room.ended) { endingRef.current = false; return; }
    const secs = Math.ceil(remaining / 1000);
    if (secs <= 10 && secs > 0 && secs !== lastBeep.current) { lastBeep.current = secs; Sound.beep(); }
    if (remaining <= 0 && !endingRef.current) { endingRef.current = true; act('end_check').catch(() => { endingRef.current = false; }); }
  });

  // keyboard: space = +1, - = −1, f = fullscreen
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(input|textarea|select)$/i.test(t.tagName) || modal) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) addBeer(1); }
      else if (e.key === '-') addBeer(-1);
      else if (e.key === 'f' || e.key === 'F') toggleFs();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  if (!state) return <div className="center-screen"><div className="logo big">THE <span>HUNDRED</span></div><p className="muted">{error ?? 'Connecting…'}</p></div>;
  if (state.error === 'no_room' || !state.me.is_host) {
    return <div className="center-screen"><div className="host-card"><p>Room {code} not found (or it isn't yours).</p><button className="btn primary" onClick={onExit}>BACK</button></div></div>;
  }

  const s = state, room = s.room;
  const tally = room.ended ? room.final_tally ?? room.tally : room.tally;
  const pct = Math.min(100, (tally / room.target) * 100);
  const left = room.target - tally;
  const danger = !room.ended && remaining <= FINAL_STRETCH;
  const game = s.game;

  async function addBeer(d: 1 | -1) {
    Sound.unlock();
    if (room.ended) { toast("⏰ Time's up — the tally is frozen"); return; }
    act('log_beer', { delta: d }).catch(() => {});
  }

  return (
    <div className={'tv' + (danger ? ' final-stretch' : '')}>
      <div id="app" className="tv-app">
        <header className="topbar">
          <div className="brand">
            <div className="logo">THE <span>HUNDRED</span></div>
            <div className="now">ROOM <b>{room.code}</b> · NOW <b>{fmtClock(now())}</b>{!connected && <span className="offline"> · RECONNECTING…</span>}</div>
          </div>
          <div className={'countdown' + (danger ? ' danger' : '') + (room.ended ? ' over' : '')}>
            <div className="cd-label">{room.ended ? "TIME'S UP" : `UNTIL ${fmtClock(deadline)}`}</div>
            <div className="cd-time">{room.ended ? '00:00:00' : fmtDur(remaining)}</div>
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setShowLobby(true)} title="Join info / QR">📱 <span>JOIN</span></button>
            <button className="icon-btn" onClick={() => setModal({ kind: 'revealAll' })} title="End of night: reveal all">🎭</button>
            <button className="icon-btn" onClick={toggleFs} title="Fullscreen (F)">⛶</button>
            <button className="icon-btn" onClick={() => { setSoundEnabled(!soundEnabled()); toast(soundEnabled() ? '🔊 Sound on' : '🔇 Sound off'); }}>{soundEnabled() ? '🔊' : '🔇'}</button>
            <button className="icon-btn gear" onClick={() => setModal({ kind: 'settings' })} title="Setup">⚙</button>
          </div>
        </header>

        <main className="main">
          <section className={'panel tally-panel' + (room.ended ? ' frozen' : '') + (tally >= room.target ? ' won' : '')}>
            <div className="tally-label">BEERS DOWN{room.ended && <span className="final-badge">FINAL</span>}</div>
            <div className="tally"><span id="tallyNum">{tally}</span><span className="tally-target">/ {room.target}</span></div>
            <div className="beerbar" id="beerbar">
              <div className={'fill' + (tally === 0 ? ' empty' : '')} style={{ width: pct + '%' }}><div className="foam" /></div>
              {[0.25, 0.5, 0.75].map(f => <div key={f} className="tick" style={{ left: f * 100 + '%' }} />)}
            </div>
            <div className="togo">{left > 0 ? <><em>{left}</em> TO GO</> : left === 0 ? '🏆 TARGET HIT!' : <>🏆 SMASHED · <em>+{-left}</em> BONUS</>}</div>
            <div className="controls">
              <button className="btn-beer" onClick={() => addBeer(1)}>+1 BEER<small>OR PRESS SPACE</small></button>
              <div className="controls-row three">
                <button className="btn-minus" onClick={() => addBeer(-1)} title="Host only">−1</button>
                <button className="btn-game" onClick={() => setModal({ kind: 'game' })}>
                  {game?.status === 'active' ? <>🏁 GAME OVER<small>{game.name}</small></> : <>🎮 GAMES<small>START / VOTE</small></>}
                </button>
                <button className="btn-wheel" disabled={!!s.round || !s.queue.length} onClick={() => act('call_next').catch(() => {})}>
                  🎡 NEXT UP<small>{s.queue.length ? `${s.queue.length} IN QUEUE` : 'QUEUE EMPTY'}</small>
                </button>
              </div>
            </div>
          </section>

          <section className="panel players-panel">
            <div className="players-head">
              <div className="ph-title">PLAYERS</div>
              {game?.status === 'active' && <div className="ph-game">🎮 NOW PLAYING: <b>{game.name}</b></div>}
              <div className="ph-stats"><b>{s.players.filter(p => p.public_role).length}</b> / {s.players.length} EXPOSED</div>
            </div>
            {s.queue.length > 0 && (
              <div className="queue-strip">
                <span className="q-label">UP NEXT</span>
                {s.queue.slice(0, 6).map(q => {
                  const p = s.players.find(x => x.id === q.player_id);
                  return p ? <span key={q.id} className="q-item"><Avatar url={p.selfie_url} name={p.name} />{p.name}</span> : null;
                })}
                {s.queue.length > 6 && <span className="q-item">+{s.queue.length - 6}</span>}
              </div>
            )}
            <PlayerGrid players={s.players} revealMask={revealMask}
              onCard={id => setModal({ kind: 'detail', id })} onExpose={id => setModal({ kind: 'expose', id })}
              onEmpty={() => setShowLobby(true)} />
          </section>
        </main>
      </div>

      {s.round && <RoundOverlay key={s.round.id} state={s} round={s.round} act={act} enqueue={enqueue} now={now} />}
      {s.vote && <VoteOverlay state={s} vote={s.vote} act={act} now={now} />}
      {(room.status === 'lobby' || showLobby) && !s.round && (
        <Lobby state={s} act={act} onClose={() => { setShowLobby(false); if (room.status === 'lobby') act('update_settings', { status: 'live' }).catch(() => {}); }}
          onSettings={() => setModal({ kind: 'settings' })} />
      )}
      {s.curse_passes.length > 0 && !modal && <CurseApproval state={s} pass={s.curse_passes[0]} act={act} />}

      {jester && (
        <div className="jester-ov"><div className="jester-card"><div className="jester-title">{jester.title}</div><div className="jester-sub">{jester.sub}</div></div></div>
      )}

      {bigOverlay === 'win' && (
        <BigOverlay win kicker={`${room.target} BEERS DOWN`} title="THE GROUP WINS" icon="🏆"
          sub={remaining > 0 ? `WITH ${fmtDur(remaining)} TO SPARE` : ''} actions={[{ label: 'KEEP PARTYING 🍻', cls: 'spin', on: () => setBigOverlay(null) }]} />
      )}
      {bigOverlay === 'end' && room.result && (
        <BigOverlay win={room.result.winner === 'group'} kicker={`TIME'S UP · ${fmtClock(deadline)}`}
          title={room.result.winner === 'group' ? 'THE GROUP WINS' : room.result.betrayer_joined ? 'THE INTRUDER & BETRAYER WIN' : 'THE INTRUDER WINS'}
          icon={room.result.winner === 'group' ? '🏆' : '🗡️'} sub={`${room.final_tally} / ${room.target} BEERS`}
          actions={[{ label: '🎭 REVEAL ALL ROLES', cls: 'again', on: () => { setBigOverlay(null); setModal({ kind: 'revealAll' }); } },
                    { label: 'CLOSE', cls: 'plain', on: () => setBigOverlay(null) }]} />
      )}
      {revealSummary && room.reveal && <RevealSummary state={s} onClose={() => setRevealSummary(false)} />}

      {modal?.kind === 'settings' && <SettingsModal state={s} act={act} onClose={() => setModal(null)} onExit={onExit} />}
      {modal?.kind === 'game' && <GameModal state={s} act={act} onClose={() => setModal(null)} />}
      {modal?.kind === 'detail' && modal.id && <PlayerDetail state={s} id={modal.id} act={act} onClose={() => setModal(null)} onExpose={() => setModal({ kind: 'expose', id: modal.id })} />}
      {modal?.kind === 'expose' && modal.id && <ExposeModal state={s} id={modal.id} act={act} onClose={() => setModal(null)} />}
      {modal?.kind === 'revealAll' && <RevealAllConfirm state={s} act={act} onClose={() => setModal(null)} onShowSummary={() => { setModal(null); setRevealSummary(true); }} />}
    </div>
  );
}

function toggleFs() {
  try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); } catch { /* ignore */ }
}

function BigOverlay({ win, kicker, title, icon, sub, actions }: { win: boolean; kicker: string; title: string; icon: string; sub: string; actions: { label: string; cls: string; on: () => void }[] }) {
  useEffect(() => {
    if (win) {
      Sound.win(); rain(260);
      let n = 0;
      const id = setInterval(() => { if (++n > 8) return clearInterval(id); burst(Math.random() * innerWidth * 0.7 + innerWidth * 0.15, Math.random() * innerHeight * 0.4 + innerHeight * 0.2, { count: 90, speed: 16 }); }, 900);
      return () => clearInterval(id);
    }
    Sound.lose(); rain(80, ['#ff3b3b', '#7a0000', '#2a0000']);
  }, [win]);
  return (
    <div className={'overlay big-overlay' + (win ? '' : ' lose-bg')}>
      <div className="bo-icon">{icon}</div>
      <div className="bo-kicker">{kicker}</div>
      <div className={'bo-title ' + (win ? 'win' : 'lose')}>{title}</div>
      {sub && <div className="bo-sub">{sub}</div>}
      <div className="bo-actions">{actions.map(a => <button key={a.label} className={'big-btn ' + a.cls} onClick={a.on}>{a.label}</button>)}</div>
    </div>
  );
}

function RevealSummary({ state, onClose }: { state: GameState; onClose: () => void }) {
  const r = state.room.reveal!;
  const nm = (id: string) => state.players.find(p => p.id === id)?.name ?? '???';
  const intruders = state.players.filter(p => p.public_role === 'intruder');
  return (
    <div className="overlay big-overlay reveal-summary">
      <div className="bo-kicker">END OF NIGHT</div>
      <div className="bo-title win">ALL REVEALED</div>
      <div className="rs-grid">
        <div className="rs-item intr">🗡️ INTRUDER{intruders.length > 1 ? 'S' : ''}: <b>{intruders.map(p => p.name).join(' & ') || 'nobody!'}</b></div>
        {r.teams.map((t, i) => <div key={i} className="rs-item betr">🐍 <b>{nm(t.betrayer)}</b> (Betrayer) secretly joined <b>{nm(t.intruder)}</b></div>)}
        {r.teams.length === 0 && state.players.some(p => p.public_role === 'betrayer') && <div className="rs-item muted">🐍 The Betrayer never found the Intruder</div>}
        {r.fake_heals.map((f, i) => <div key={i} className="rs-item fake">🩹 <b>{nm(f.player)}</b>'s heal was <b>FAKE</b> — the Intruder faked it{f.texts.length ? `. Owes: ${f.texts.join(', ')}` : ''}</div>)}
      </div>
      <div className="bo-actions"><button className="big-btn plain" onClick={onClose}>CLOSE</button></div>
    </div>
  );
}
