// The TV / host screen for one room. Everything shown here comes from get_state()
// for the host, which never contains secret roles. Animations are driven by the
// public event feed + state diffs, serialised through a small animation queue.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import { useRoom, useTicker } from '../lib/useRoom';
import type { GameEvent, GameState, Player, Role } from '../lib/types';
import { ROLES } from '../lib/roles';
import { fmtClock, fmtDur, sleep } from '../lib/util';
import { Sound, setSoundEnabled, soundEnabled } from '../fx/sound';
import { bubblesFrom, burst, centerOf, floatEmoji, rain, restartAnim, showBanner, toast } from '../fx/effects';
import { Avatar, Logo, Polaroid } from '../components/ui';
import { PlayerGrid } from './PlayerGrid';
import { RoundOverlay } from './RoundOverlay';
import { VoteOverlay } from './VoteOverlay';
import { Lobby } from './Lobby';
import { CurseApproval, ExposeModal, FreeSpinModal, GameModal, PlayerDetail, RevealAllConfirm, SettingsModal } from './TvModals';
import { sideNames } from './Matchups';
import { SCROOGE_MS, ScroogeOverlay, type ScroogeFx } from './ScroogeOverlay';

const FINAL_STRETCH = 15 * 60 * 1000;
const UNDO_MS = 2 * 60 * 1000;
const NO_MASK = new Set<string>();
export type Act = <T = any>(action: string, args?: Record<string, unknown>) => Promise<T>;

// Scrooge graffiti already shown on this TV (survives a refresh)
const GKEY = 'thehundred-graffiti-seen';
const graffitiSeen = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch { return []; } })());
const saveGraffitiSeen = () => { try { localStorage.setItem(GKEY, JSON.stringify([...graffitiSeen].slice(-100))); } catch { /* ignore */ } };

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
  const [modal, setModal] = useState<null | { kind: 'settings' | 'game' | 'detail' | 'expose' | 'revealAll' | 'spin'; id?: string }>(null);
  const [scrooge, setScroogeFx] = useState<null | { fx: ScroogeFx; n: number }>(null);
  const setScrooge = (fx: ScroogeFx | null) => setScroogeFx(fx && { fx, n: Math.random() });
  const [hit, setHit] = useState<null | { player: string; role: Role; partner?: string }>(null);
  const [slacker, setSlacker] = useState<null | { game: string; players: string[]; beers: number | null }>(null);
  const [bigOverlay, setBigOverlay] = useState<null | 'win' | 'end'>(null);
  const [reveal, setReveal] = useState<null | { animate: boolean }>(null);

  // ---------- event feed → animations ----------
  const lastEvt = useRef<number | null>(null);
  const prevTally = useRef<number | null>(null);
  const prevPlayers = useRef<Player[]>([]);
  const endingRef = useRef(false);

  const pName = (s: GameState, id?: string | null) => s.players.find(p => p.id === id)?.name ?? '???';
  const pImg = (s: GameState, id?: string | null) => s.players.find(p => p.id === id)?.selfie_url ?? null;
  const cardEl = (id: string) => document.querySelector(`.case[data-id="${id}"]`);

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
        showBanner({ title: `${m} DOWN`, sub: `${s.room.target - m} TO GO. KEEP DRINKING.`, hold: 3.2 });
        const [x, y] = centerOf(document.getElementById('tallyNum'));
        burst(x, y, { count: 120, speed: 16, colors: ['#ff8a1e', '#ffe2b8', '#ffb866'] });
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
    prevPlayers.current = s.players;
    for (const ev of fresh) handleEvent(ev, s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.room?.version]);

  function handleEvent(ev: GameEvent, s: GameState) {
    const p = ev.payload;
    switch (ev.kind) {
      case 'joined': Sound.pop(); toast(`${pName(s, p.player)} walked in`); break;
      case 'beer':
        Sound.pop();
        bubblesFrom(document.getElementById('cellbar'), p.player ? `+1 ${pName(s, p.player).toUpperCase()}` : '+1');
        break;
      case 'unbeer': Sound.down(); break;
      case 'level_up': enqueue(async () => {
        Sound.fanfare();
        await showBanner({ title: `LEVEL ${p.level}`, sub: `${pName(s, p.player).toUpperCase()} ${p.level === 3 ? 'IS AT FULL POWER' : 'POWERS UP'}`, color: '#ff8a1e', hold: 2.4, img: pImg(s, p.player) });
      }); break;
      case 'undo': Sound.down(); toast(`↶ UNDONE: ${p.label}`, 3500); break;
      case 'evidence': Sound.beep(); toast('New evidence submitted. It goes up at the next Trial.', 3500); break;
      case 'cursed': enqueue(async () => { Sound.curse(); await showBanner({ title: 'CURSED', sub: `${pName(s, p.player).toUpperCase()} HOLDS THE CURSE`, color: '#5c2a54', hold: 2.6, img: pImg(s, p.player) }); }); break;
      case 'exposed': enqueue(async () => {
        setTimeout(() => { restartAnim(cardEl(p.player)?.querySelector('.idstamp') ?? null, 'slam'); restartAnim(cardEl(p.player), 'thud'); }, 30);
        Sound.gavel();
        const R = ROLES[p.role as Role];
        if (p.rehab) Sound.siren();
        await showBanner({ title: p.rehab ? 'CAUGHT' : R.label.toUpperCase(),
          sub: p.rehab ? `${pName(s, p.player).toUpperCase()} WAS THE ${R.label.toUpperCase()}. OFF TO REHAB.` : `${pName(s, p.player).toUpperCase()} HAS BEEN IDENTIFIED`,
          color: R.color, hold: 2.8, img: pImg(s, p.player) });
      }); break;
      case 'accepted':
        for (const id of [p.player, p.partner].filter(Boolean)) {
          restartAnim(cardEl(id), 'punished'); restartAnim(cardEl(id)?.querySelector('.pun') ?? null, 'bump');
        }
        Sound.thud();
        break;
      case 'lovebirds': enqueue(async () => {
        Sound.love();
        await showBanner({ title: 'LOVEBIRDS', sub: `${pName(s, p.a).toUpperCase()} & ${pName(s, p.b).toUpperCase()} SHARE THE PAIN`, color: '#9e2f42', hold: 3.2 });
      }); break;
      case 'scrooge':
        if (p.kind === 'graffiti') break;          // held back: announced at the start of the next punishment (see below)
        enqueue(async () => {
          setScrooge(p.kind === 'swap' ? { kind: 'swap', from: s.players.find(x => x.id === p.from), to: s.players.find(x => x.id === p.to) } : { kind: 'respin' });
          await sleep(p.kind === 'swap' ? SCROOGE_MS.swap : SCROOGE_MS.respin);
          setScrooge(null);
        });
        break;
      case 'hit': enqueue(async () => {
        setHit({ player: p.player, role: p.role, partner: p.partner });
        Sound.siren();
        await sleep(5200);
        setHit(null);
      }); break;
      case 'jester_revenge': break;     // the Trial overlay plays Jester's Revenge
      case 'penalty': Sound.beep(); toast(`PENALTY: ${pName(s, p.player)} owes a drink`, 7000); break;
      case 'curse_request': Sound.curse(); break;
      case 'curse_passed': enqueue(async () => { Sound.curse(); await showBanner({ title: 'CURSE PASSED', sub: `${pName(s, p.from).toUpperCase()} → ${pName(s, p.to).toUpperCase()}`, color: '#5c2a54', hold: 3 }); }); break;
      case 'game_start': enqueue(async () => { Sound.fanfare(); await showBanner({ title: 'NOW PLAYING', sub: String(p.name).toUpperCase(), color: '#2c6e74', hold: 2.4 }); }); break;
      case 'game_over': enqueue(async () => {
        Sound.thud();
        const losers = (p.losers as string[]).map(id => pName(s, id).toUpperCase()).join(', ');
        await showBanner({ title: 'GAME OVER', sub: losers ? `LOST: ${losers}` : 'NO LOSERS?', color: '#c2371f', hold: 3 });
      }); break;
      case 'slacker': enqueue(async () => {
        Sound.drumroll(); await sleep(400);
        setSlacker({ game: p.game, players: p.players ?? [], beers: p.beers ?? null });
      }); break;
      case 'ended': Sound.alarm(); setTimeout(() => setBigOverlay('end'), 600); break;
      case 'reveal_all': setBigOverlay(null); setReveal({ animate: true }); break;
    }
  }

  // ---------- Scrooge graffiti: announced when the next punishment starts, not when it was
  // written, so the timing doesn't give the Scrooge away ----------
  const roundId = state?.round?.id;
  useEffect(() => {
    if (!state || !roundId) return;
    const fresh = state.graffiti.filter(g => !graffitiSeen.has(g.id));
    if (!fresh.length) return;
    fresh.forEach(g => graffitiSeen.add(g.id)); saveGraffitiSeen();
    for (const g of fresh) enqueue(async () => { setScrooge({ kind: 'graffiti', text: g.text }); await sleep(SCROOGE_MS.graffiti); setScrooge(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

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

  // keyboard: space = +1, - = −1, f = fullscreen, ctrl/cmd+z = undo
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(input|textarea|select)$/i.test(t.tagName) || modal) return;
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) addBeer(1); }
      else if (e.key === '-') addBeer(-1);
      else if (e.key === 'f' || e.key === 'F') toggleFs();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  if (!state) return <div className="center-screen"><Logo className="big" /><p className="muted">{error ?? 'Connecting…'}</p></div>;
  if (state.error === 'no_room' || !state.me.is_host) {
    return <div className="center-screen"><div className="host-card"><p>Room {code} not found (or it isn't yours).</p><button className="btn primary" onClick={onExit}>BACK</button></div></div>;
  }

  const s = state, room = s.room;
  const tally = room.ended ? room.final_tally ?? room.tally : room.tally;
  const left = room.target - tally;
  const danger = !room.ended && remaining <= FINAL_STRETCH;
  const game = s.game;
  const cdText = room.ended ? '00:00:00' : fmtDur(remaining);
  const undoable = s.undo && now() - Date.parse(s.undo.at) < UNDO_MS ? s.undo : null;
  const nCells = Math.max(10, Math.min(200, room.target));
  const cols = Math.ceil(nCells / 2);

  async function addBeer(d: 1 | -1) {
    Sound.unlock();
    if (room.ended) { toast("Time's up. The tally is frozen."); return; }
    act('log_beer', { delta: d }).catch(() => {});
  }
  function undo() {
    if (!undoable) { toast('Nothing to undo (only the last 2 minutes)'); return; }
    act('undo').catch(() => {});
  }

  return (
    <div className={'tv' + (danger ? ' final-stretch' : '')}>
      <div className="rain" /><div className="fence" /><div className="bulb" />
      <div id="app" className="tv-app">
        <header className="panel topbar">
          <div className="brand">
            <Logo />
            <div className="room-line">ROOM <b>{room.code}</b> · NOW <b>{fmtClock(now())}</b>{!connected && <span className="offline"> · RECONNECTING…</span>}</div>
          </div>
          <div className={'countdown' + (danger ? ' danger' : '') + (room.ended ? ' over' : '')}>
            <div className="cd-label">{room.ended ? <>TIME'S<br /><b>UP</b></> : danger ? <>FINAL<br />STRETCH</> : <>UNTIL<br /><b>{fmtClock(deadline)}</b></>}</div>
            <div className="cd-box" style={{ ['--len' as any]: cdText.length }}>{cdText}</div>
          </div>
          <div className="top-actions">
            <button className={'key undo' + (undoable ? '' : ' off')} disabled={!undoable} onClick={undo} title={undoable ? `Undo: ${undoable.label}` : 'Nothing to undo'}>↶ UNDO</button>
            <button className="key" onClick={() => setShowLobby(true)} title="Join info / QR">JOIN</button>
            <button className="key" onClick={() => room.revealed ? setReveal({ animate: false }) : setModal({ kind: 'revealAll' })} title="End of night: reveal all">REVEAL</button>
            <button className="key icon" onClick={toggleFs} title="Fullscreen (F)">⛶</button>
            <button className="key icon" onClick={() => { setSoundEnabled(!soundEnabled()); toast(soundEnabled() ? 'Sound on' : 'Sound off'); }}>{soundEnabled() ? '🔊' : '🔇'}</button>
            <button className="key icon gear" onClick={() => setModal({ kind: 'settings' })} title="Setup">⚙</button>
          </div>
        </header>

        <main className="main">
          <section className={'panel tally-panel' + (room.ended ? ' frozen' : '') + (tally >= room.target ? ' won' : '')}>
            <div className="tally-label">BEERS DOWN{room.ended && <span className="final-badge">FINAL</span>}</div>
            <div className="tally"><span id="tallyNum">{tally}</span><span className="tally-target">/{room.target}</span></div>
            <div>
              <div className="cellbar" id="cellbar" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
                {Array.from({ length: nCells }, (_, i) => {
                  const on = i < tally, mark = [0.25, 0.5, 0.75].some(f => i === Math.round(nCells * f) - 1);
                  return <div key={i} className={'cell' + (on ? ' on' : mark ? ' m' : '') + (on && (i + 1) % 10 === 0 ? ' ten' : '') + (on && tally > room.target && i >= nCells - (tally - room.target) ? ' bonus' : '')} />;
                })}
              </div>
              <div className="cell-labels">{[0.25, 0.5, 0.75, 1].map(f => <span key={f} style={{ textAlign: f === 1 ? 'right' : 'center' }}>{Math.round(room.target * f)}</span>)}</div>
            </div>
            <div className="togo">{left > 0 ? <><em>{left}</em> TO GO</> : left === 0 ? 'TARGET HIT' : <>SMASHED · <em>+{-left}</em> BONUS</>}</div>
            <div className="controls">
              <button className="btn-beer" onClick={() => addBeer(1)}>+1 BEER<small>OR PRESS SPACE</small></button>
              <div className="controls-row">
                <button className="btn-minus" onClick={() => addBeer(-1)} title="Host only">−1</button>
                <button className="btn-game" onClick={() => setModal({ kind: 'game' })}>
                  {game?.status === 'active' ? <><b>GAME OVER</b><small>{game.name.toUpperCase()}</small></> : <><b>GAMES</b><small>START / TRIAL</small></>}
                </button>
                <button className="btn-wheel" disabled={!!s.round || !s.queue.length} onClick={() => act('call_next').catch(() => {})}>
                  <b>NEXT UP</b><small>{s.queue.length ? `${s.queue.length} IN QUEUE` : 'QUEUE EMPTY'}</small>
                </button>
                <button className="btn-free" disabled={!!s.round} onClick={() => setModal({ kind: 'spin' })} title="Spin the wheel now (special cases)">
                  <b>FREE</b><small>SPIN</small>
                </button>
              </div>
            </div>
          </section>

          <section className="panel suspects-panel">
            <div className="sp-head">
              <div className="sp-title"><b>SUSPECTS</b><span>case no. {room.target}</span></div>
              {game?.status === 'active' && <div className="sp-game">NOW PLAYING: <b>{game.name.toUpperCase()}</b>
                {game.matchup && game.matchup.length > 1 && <span className="sp-mu">{game.matchup.map(sd => sideNames(s, sd)).join(' vs ')}</span>}</div>}
              <div className="sp-stats"><b>{s.players.filter(p => p.public_role).length}</b> / {s.players.length} IDENTIFIED</div>
            </div>
            {s.queue.length > 0 && (
              <div className="queue-strip">
                <span className="q-label">UP NEXT ▸</span>
                {s.queue.slice(0, 5).map(q => {
                  const p = s.players.find(x => x.id === q.player_id);
                  return p ? <span key={q.id} className="q-item"><Avatar url={p.selfie_url} name={p.name} />{p.name.toUpperCase()}{q.times > 1 && <b className="q-times">×{q.times}</b>}</span> : null;
                })}
                {s.queue.length > 5 && <span className="q-item">+{s.queue.length - 5}</span>}
              </div>
            )}
            <PlayerGrid players={s.players} revealMask={NO_MASK}
              onCard={id => setModal({ kind: 'detail', id })} onExpose={id => setModal({ kind: 'expose', id })}
              onEmpty={() => setShowLobby(true)} />
          </section>
        </main>
      </div>

      {s.round && <RoundOverlay key={s.round.id} state={s} round={s.round} act={act} enqueue={enqueue} now={now} />}
      {s.vote && <VoteOverlay key={s.vote.id} state={s} vote={s.vote} act={act} now={now} />}
      {slacker && !s.round && !(s.vote?.status === 'open') && (
        <SlackerOverlay state={s} slacker={slacker} onClose={() => setSlacker(null)}
          onTrial={() => act('start_vote', { kind: 'trial', game_id: slacker.game }).then(() => setSlacker(null)).catch(() => {})} />
      )}
      {(room.status === 'lobby' || showLobby) && !s.round && (
        <Lobby state={s} act={act} onClose={() => { setShowLobby(false); if (room.status === 'lobby') act('update_settings', { status: 'live' }).catch(() => {}); }}
          onSettings={() => setModal({ kind: 'settings' })} />
      )}
      {s.curse_passes.length > 0 && !modal && <CurseApproval state={s} pass={s.curse_passes[0]} act={act} />}

      {scrooge && <ScroogeOverlay key={scrooge.n} fx={scrooge.fx} />}
      {hit && <HitOverlay state={s} hit={hit} />}

      {bigOverlay === 'win' && (
        <BigOverlay state={s} win kicker={`${room.target} BEERS DOWN`} title="THE GROUP WINS"
          sub={remaining > 0 ? `WITH ${fmtDur(remaining)} TO SPARE` : `${tally} / ${room.target} BEERS`}
          actions={[{ label: 'KEEP PARTYING', cls: 'sodium', on: () => setBigOverlay(null) }]} />
      )}
      {bigOverlay === 'end' && room.result && (
        <BigOverlay state={s} win={room.result.winner === 'group'} kicker={`TIME'S UP · ${fmtClock(deadline)}`}
          title={room.result.winner === 'group' ? 'THE GROUP WINS' : 'THE SABOTEURS WIN'}
          sub={`${room.result.skank_bonus ? `${room.result.counted} + ${room.result.skank_bonus} SKANK BONUS = ` : ''}${room.final_tally} / ${room.target} BEERS${room.result.winner !== 'group' ? ` · ${room.target - (room.final_tally ?? 0)} SHORT` : ''}`}
          actions={[{ label: 'REVEAL ALL ROLES', cls: 'rust', on: () => { setBigOverlay(null); room.revealed ? setReveal({ animate: false }) : setModal({ kind: 'revealAll' }); } },
                    { label: 'CLOSE', cls: '', on: () => setBigOverlay(null) }]} />
      )}
      {reveal && room.revealed && room.reveal && <RevealOverlay state={s} animate={reveal.animate} onClose={() => setReveal(null)} />}

      {modal?.kind === 'settings' && <SettingsModal state={s} act={act} onClose={() => setModal(null)} onExit={onExit} />}
      {modal?.kind === 'spin' && <FreeSpinModal state={s} act={act} onClose={() => setModal(null)} />}
      {modal?.kind === 'game' && <GameModal state={s} act={act} onClose={() => setModal(null)} />}
      {modal?.kind === 'detail' && modal.id && <PlayerDetail state={s} id={modal.id} act={act} onClose={() => setModal(null)} onExpose={() => setModal({ kind: 'expose', id: modal.id })} />}
      {modal?.kind === 'expose' && modal.id && <ExposeModal state={s} id={modal.id} act={act} onClose={() => setModal(null)} />}
      {modal?.kind === 'revealAll' && <RevealAllConfirm state={s} act={act} onClose={() => setModal(null)} onShowSummary={() => { setModal(null); setReveal({ animate: false }); }} />}
    </div>
  );
}

function toggleFs() {
  try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); } catch { /* ignore */ }
}

// ---------- after each game: the automatic Slacker, then the Trial ----------
function SlackerOverlay({ state, slacker, onClose, onTrial }: { state: GameState; slacker: { players: string[]; beers: number | null }; onClose: () => void; onTrial: () => void }) {
  const ps = slacker.players.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
  return (
    <div className="overlay slacker-ov">
      <div className="spot" /><div className="lamp-shade" />
      <div className="kicker" style={{ position: 'relative' }}>FEWEST BEERS LOGGED SINCE THE LAST GAME</div>
      <div className="vote-title" style={{ position: 'relative' }}>{ps.length ? `BIGGEST SLACKER${ps.length > 1 ? 'S' : ''}` : 'NO SLACKERS'}</div>
      {ps.length > 0 ? <>
        <div className="row-pol">{ps.map(p => (
          <div key={p.id} style={{ position: 'relative' }}>
            <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
            <div className="stamp slam big-stamp" style={{ right: -60, top: '38%', ['--sc' as any]: 'var(--rust)' }}>SLACKER</div>
          </div>
        ))}</div>
        <div className="vline" style={{ position: 'relative', fontFamily: 'var(--type)', fontWeight: 700, fontSize: 30, color: 'var(--alarm)', letterSpacing: '.12em' }}>
          {slacker.beers ?? 0} BEER{slacker.beers === 1 ? '' : 'S'} LOGGED → PUNISHMENT QUEUE
        </div>
      </> : <div className="vote-sub" style={{ position: 'relative' }}>Everyone logged the same. Nobody's punished this time.</div>}
      <div className="bo-actions">
        <button className="big-btn rust" onClick={onTrial}>START THE TRIAL</button>
        <button className="big-btn" onClick={onClose}>SKIP</button>
      </div>
    </div>
  );
}

// ---------- a Hit lands: someone's cover is blown ----------
function HitOverlay({ state, hit }: { state: GameState; hit: { player: string; role: Role; partner?: string } }) {
  const p = state.players.find(x => x.id === hit.player);
  const R = ROLES[hit.role];
  return (
    <div className="overlay hit-ov">
      <div className="beacon" /><div className="beacon-lamp" />
      <div className="kicker" style={{ position: 'relative', color: '#ffd9cf' }}>THE KNIFE HAS STRUCK</div>
      <div style={{ position: 'relative' }}>
        {p && <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />}
        <div className="stamp slam big-stamp" style={{ left: '-12%', top: '52%', ['--sc' as any]: R.color }}>{R.label.toUpperCase()}</div>
      </div>
      <div className="hit-title">COVER BLOWN</div>
      <div className="vote-sub" style={{ position: 'relative', color: '#ffd9cf' }}>{p?.name.toUpperCase()} WAS THE {R.label.toUpperCase()}. POWERS BURNED. SPIN THE WHEEL.</div>
    </div>
  );
}

function BigOverlay({ state, win, kicker, title, sub, actions }: { state: GameState; win: boolean; kicker: string; title: string; sub: string; actions: { label: string; cls: string; on: () => void }[] }) {
  useEffect(() => {
    if (win) {
      Sound.win(); rain(200, ['#ff8a1e', '#ffe2b8', '#ffb866', '#ffd84a']);
      let n = 0;
      const id = setInterval(() => { if (++n > 6) return clearInterval(id); burst(Math.random() * innerWidth * 0.7 + innerWidth * 0.15, Math.random() * innerHeight * 0.4 + innerHeight * 0.2, { count: 80, speed: 16, colors: ['#ff8a1e', '#ffe2b8', '#ffd84a'] }); }, 900);
      return () => clearInterval(id);
    }
    Sound.lose(); Sound.siren();
  }, [win]);
  return (
    <div className={'overlay big-overlay ' + (win ? 'win' : 'lose')}>
      {win ? <div className="stringlights">{Array.from({ length: 16 }, (_, i) => <i key={i} />)}</div> : <><div className="beacon" /><div className="beacon-lamp" /></>}
      <div className="bo-kicker">{kicker}</div>
      <div className="bo-title">{title}</div>
      {sub && <div className="bo-sub">{sub}</div>}
      <div className="crowd">{state.players.map((p, i) => <Polaroid key={p.id} url={p.selfie_url} name={p.name} style={{ marginTop: i % 2 ? -14 : 8 }} />)}</div>
      <div className="bo-actions">{actions.map(a => <button key={a.label} className={'big-btn ' + a.cls} onClick={a.on}>{a.label}</button>)}</div>
    </div>
  );
}

// ---------- end of night: every role stamped, then the case file ----------
function RevealOverlay({ state, animate, onClose }: { state: GameState; animate: boolean; onClose: () => void }) {
  const r = state.room.reveal!;
  const ps = state.players.filter(p => p.public_role);
  const [shown, setShown] = useState(animate ? 0 : ps.length);
  const [file, setFile] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    let alive = true;
    (async () => {
      await sleep(700);
      for (let i = 1; i <= ps.length && alive; i++) { setShown(i); Sound.gavel(); await sleep(750); }
      if (alive) { Sound.fanfare(); setFile(true); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nm = (id: string) => (state.players.find(p => p.id === id)?.name ?? '???').toUpperCase();
  const roleOf = (id: string) => state.players.find(p => p.id === id)?.public_role;
  const forgers = state.players.filter(p => p.public_role === 'forger');
  const guilty = r.guilty ?? [];
  return (
    <div className="overlay reveal-ov">
      <button className="key close-x" onClick={onClose}>✕</button>
      <div className="reveal-left">
        <div className="kicker">END OF NIGHT</div>
        <div className="ttl">ALL REVEALED</div>
        <div className="reveal-grid">
          {ps.map((p, i) => {
            const R = ROLES[p.public_role!];
            return (
              <div key={p.id} className="cell-r">
                <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
                {i < shown && <div className="stamp slam" style={{ ['--sc' as any]: R.color }}>{R.label.toUpperCase()}{p.love_partner_id ? ' ♥' : ''}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {file && (
        <div className="casefile" style={{ animation: 'modalIn .5s cubic-bezier(.2,1.3,.4,1)' }}>
          <div className="tabl">CASE {state.room.target}</div>
          <div className="hdr"><span>FINDINGS</span><span className="stamp" style={{ fontSize: 26 }}>CASE CLOSED</span></div>
          <div className="findings">
            {(() => { const seen = new Set<string>(); return state.players.filter(p => p.love_partner_id && !seen.has(p.id) && (seen.add(p.love_partner_id), true))
              .map(p => <div key={'lb' + p.id} style={{ ['--fc' as any]: '#9e2f42' }}>Lovebirds: <b>{nm(p.id)}</b> ({ROLES[roleOf(p.id) ?? 'drinker'].label}) &amp; <b>{nm(p.love_partner_id!)}</b> ({ROLES[roleOf(p.love_partner_id!) ?? 'drinker'].label})</div>); })()}
            <div style={{ ['--fc' as any]: '#c2371f' }}>SABOTEURS: <b>{guilty.length ? guilty.map(id => `${nm(id)} (${ROLES[roleOf(id) ?? 'drinker'].label})`).join(', ') : 'nobody'}</b></div>
            {r.teams.map((t, i) => <div key={i} style={{ ['--fc' as any]: '#b8560f' }}><b>{nm(t.betrayer)}</b> (Betrayer) found and secretly joined <b>{nm(t.intruder)}</b></div>)}
            {r.teams.length === 0 && state.players.some(p => p.public_role === 'betrayer') && <div style={{ ['--fc' as any]: '#b8560f' }}>The Betrayer never found the Intruder.</div>}
            {r.knife.map(id => roleOf(id) !== 'intruder' && <div key={id} style={{ ['--fc' as any]: '#c2371f' }}>The knife passed to <b>{nm(id)}</b></div>)}
            {state.players.filter(p => p.rehab).length > 0 && <div style={{ ['--fc' as any]: '#51606a' }}>In rehab: <b>{state.players.filter(p => p.rehab).map(p => p.name.toUpperCase()).join(', ')}</b></div>}
            {r.checks.map((c, i) => {
              const others = (c.group ?? []).filter(g => g !== c.target);
              return <div key={i} style={{ ['--fc' as any]: '#2a4d69' }}>Detective <b>{nm(c.detective)}</b> checked <b>{nm(c.target)}</b>
                {others.length ? <> (a level {c.level} reading, lumped in with {others.map(nm).join(' & ')})</> : null}: {c.guilty ? (others.length ? 'a SABOTEUR among them' : 'SABOTEUR') : 'innocent'}{c.framed ? ' (FRAMED by the Forger)' : ''}</div>;
            })}
            {(r.frames ?? []).map((f, i) => <div key={'f' + i} style={{ ['--fc' as any]: '#5c2a54' }}><b>{nm(f.forger)}</b> (Forger) framed <b>{nm(f.target)}</b>{f.spent ? '' : '. The Detective never checked them.'}</div>)}
            {r.forgeries.map((f, i) => <div key={i} style={{ ['--fc' as any]: '#5c2a54' }}>{forgers.length ? <b>{forgers.map(p => p.name.toUpperCase()).join(' & ')}</b> : 'The Forger'} forged <b>{nm(f.medic)}</b>'s heal on <b>{nm(f.player)}</b>{f.used ? '. It never saved them.' : ' (never triggered)'}</div>)}
            {r.forgeries.length === 0 && forgers.length > 0 && <div style={{ ['--fc' as any]: '#5c2a54' }}>The Forger never rewrote a heal.</div>}
            {state.players.filter(p => p.public_role === 'skank').map(p => <div key={'sk' + p.id} style={{ ['--fc' as any]: ROLES.skank.color }}>
              Skank <b>{nm(p.id)}</b>{state.room.result?.skank_bonus ? <> secretly added <b>+{state.room.result.skank_bonus}</b> beers to the final count</> : ' was quietly doubling every beer'}</div>)}
          </div>
          <button className="close" onClick={onClose}>CLOSE</button>
        </div>
      )}
    </div>
  );
}
