// Host modals: settings, games & trials, player detail, expose, reveal-all, curse approval.
import { Mugshot } from '../components/Mugshot';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import '../styles/setup.css';
import type { GameState, Role, Team } from '../lib/types';
import type { Act } from './TvRoom';
import { errText } from '../lib/backend';
import { CARD_ROLES, MODIFIERS, ROLES, TEAMS } from '../lib/roles';

const TEAM_INK: Record<Team, string> = { guilty: 'var(--alarm)', drinkers: 'var(--bone)', chaos: 'var(--synth)' };
import { computeDeadline, fmtClock, splitDeadline } from '../lib/util';
import { Avatar, ConfirmButton, Modal, Polaroid } from '../components/ui';
import { toast } from '../fx/effects';
import { FORMATS, MatchupOverlay, draw, sideNames, type Format } from './Matchups';
import { EDGE_MARGINS, useEdgeMargin, useFitScale } from './stage';

const GAME_IDEAS = ['Beer Pong', 'Flip Cup', 'Kings', 'Ring of Fire', 'Darts', 'Quiz', 'Arm Wrestle', 'Rock Paper Scissors'];

// ---------------- games & votes ----------------
export function GameModal({ state, act, onClose }: { state: GameState; act: Act; onClose: () => void }) {
  const game = state.game;
  const [name, setName] = useState('');
  const [losers, setLosers] = useState<string[]>([]);
  const [format, setFormat] = useState<Format>('1v1');
  const [sides, setSides] = useState<string[][] | null>(null);
  const [showDraw, setShowDraw] = useState(false);
  const active = game?.status === 'active';
  const voteOpen = state.vote?.status === 'open';
  const doDraw = () => { try { setSides(draw(state.players, format)); setShowDraw(true); } catch (e) { toast('⚠ ' + (e as Error).message); } };
  const start = () => act('start_game', { name, ...(sides ? { matchup: sides } : {}) }).then(onClose).catch(() => {});

  if (active) {
    const m = game!.matchup;
    return (
      <Modal title={`${game!.name.toUpperCase()}: WHO LOST?`} wide onClose={onClose}
        actions={<><button className="btn" onClick={onClose}>CANCEL</button>
          <button className="btn danger" onClick={() => act('finish_game', { game_id: game!.id, losers }).then(onClose).catch(() => {})}>
            CONFIRM {losers.length} LOSER{losers.length === 1 ? '' : 'S'}</button></>}>
        <p className="muted">Tap every loser. They go straight into the punishment queue. Then the Slacker is named automatically (fewest beers logged on their phone since the last game), and the Trial follows.</p>
        {m && m.length > 1 && <div className="chips">{m.map((side, i) => (
          <button key={i} className="chip" onClick={() => setLosers(side)}>{sideNames(state, side)} LOST</button>
        ))}</div>}
        <div className="pick-grid">
          {state.players.map(p => (
            <button key={p.id} className={'pick' + (losers.includes(p.id) ? ' sel' : '')} onClick={() => setLosers(l => l.includes(p.id) ? l.filter(x => x !== p.id) : [...l, p.id])}>
              <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} />
            </button>
          ))}
        </div>
      </Modal>
    );
  }
  if (showDraw && sides) {
    return <MatchupOverlay state={state} sides={sides} gameName={name} onRedraw={doDraw} onClose={() => setShowDraw(false)}
      onStart={() => { if (name.trim()) start(); else setShowDraw(false); }} />;
  }
  return (
    <Modal title="GAMES" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>CLOSE</button>
        <button className="btn danger" disabled={voteOpen} onClick={() => act('start_vote', { kind: 'trial', game_id: game?.id }).then(onClose).catch(() => {})}>START A TRIAL</button>
        <button className="btn" disabled={voteOpen || !!state.round || state.plate?.status === 'open'} onClick={() => act('bbq_start').then(onClose).catch(() => {})}>🌭 AARON'S PLATE</button>
        <button className="btn primary" disabled={!name.trim()} onClick={start}>START GAME</button></>}>
      <p>Game {Math.min(3, state.room.games_done + 1)} of 3. Name it. When it ends, tap GAME OVER and pick the loser(s).</p>
      <input type="text" placeholder="e.g. Beer Pong" value={name} onChange={e => setName(e.target.value)} maxLength={40} autoFocus />
      <div className="chips">{GAME_IDEAS.map(g => <button key={g} className="chip" onClick={() => setName(g)}>{g}</button>)}</div>
      <h3>THE DRAW</h3>
      <p className="hint">Let the TV pick who plays whom. The Cursed player is always drawn in.</p>
      <div className="chips">
        {FORMATS.map(f => <button key={f.id} className={'chip' + (format === f.id ? ' on' : '')} onClick={() => setFormat(f.id)}>{f.label}</button>)}
        <button className="btn danger small" onClick={doDraw}>DRAW MATCHUPS</button>
      </div>
      {sides && <p className="hint">Drawn: <b>{sides.map(sd => sideNames(state, sd)).join('  vs  ')}</b> <button className="link" onClick={() => setShowDraw(true)}>show</button> <button className="link" onClick={() => setSides(null)}>clear</button></p>}
    </Modal>
  );
}

// ---------------- host free spin ----------------
const SPIN_REASONS = ["Host's spin", 'Birthday spin', 'Broke a rule', 'Special occasion', 'Everybody drinks'];
export function FreeSpinModal({ state, act, onClose }: { state: GameState; act: Act; onClose: () => void }) {
  const [who, setWho] = useState<string | null>(null);   // null = the whole room
  const [reason, setReason] = useState(SPIN_REASONS[0]);
  return (
    <Modal title="FREE SPIN" wide onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>CANCEL</button>
        <button className="btn danger" disabled={!!state.round} onClick={() => act('free_spin', { player_id: who, reason }).then(onClose).catch(() => {})}>
          SPIN NOW{who ? ` FOR ${state.players.find(p => p.id === who)?.name.toUpperCase()}` : ': WHOLE ROOM'}</button></>}>
      <p className="muted">Spins straight away, skipping the queue and any heals. Pick a player, or spin for the whole room (nothing gets logged against anyone).</p>
      <div className="chips">{SPIN_REASONS.map(r => <button key={r} className={'chip' + (reason === r ? ' on' : '')} onClick={() => setReason(r)}>{r}</button>)}</div>
      <div className="pick-grid" style={{ marginTop: 14 }}>
        <button className={'pick room-pick' + (who === null ? ' sel' : '')} onClick={() => setWho(null)}><div className="polaroid" style={{ ['--tilt' as any]: '-1deg' }}><div className="ph blank">ALL</div><div className="cap">WHOLE ROOM</div></div></button>
        {state.players.map(p => (
          <button key={p.id} className={'pick' + (who === p.id ? ' sel' : '')} onClick={() => setWho(p.id)}>
            <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} />
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ---------------- player detail ----------------
export function PlayerDetail({ state, id, act, onClose, onExpose }: { state: GameState; id: string; act: Act; onClose: () => void; onExpose: () => void }) {
  const p = state.players.find(x => x.id === id);
  if (!p) return null;
  return (
    <Modal title={<><Avatar url={p.selfie_url} name={p.name} className="title-avatar" /> #{p.seat} {p.name.toUpperCase()}{p.rehab && <span className="stamp" style={{ fontSize: 22 }}>REHAB</span>}</>} className="detail-modal" onClose={onClose}
      actions={<>
        <ConfirmButton className="btn danger" confirmText="REALLY KICK?" onConfirm={() => act('kick', { player_id: p.id }).then(onClose).catch(() => {})}>KICK</ConfirmButton>
        <button className="btn" onClick={() => act('queue_add', { player_id: p.id }).then(() => { toast(`${p.name} added to the queue`); onClose(); }).catch(() => {})}>+ QUEUE</button>
        <button className="btn danger" disabled={!!state.round} onClick={() => act('call_next', { player_id: p.id }).then(onClose).catch(() => {})}>PUNISH NOW</button>
        <button className="btn primary" onClick={onExpose}>EXPOSE</button>
      </>}>
      <p>🍺 <b>{p.beers}</b> beers logged · ☠ <b>{p.punishments.length}</b> punishments {p.cursed && '· holds the curse'}</p>
      <p className="role-line">{p.public_role && <Mugshot role={p.public_role} className="mug-sm" />}Role: <b>{p.public_role ? ROLES[p.public_role].label : p.has_role ? 'secret (code entered ✓)' : 'no code entered yet'}</b></p>
      <div className="srow locker-row">
        <span className="grow">⚓ Davy Jones' Locker{p.locked_until ? `: locked until ${fmtClock(Date.parse(p.locked_until))}` : ''}{p.held ? ' · 1 punishment waiting' : ''}</span>
        {p.locked_until
          ? <button className="btn small" onClick={() => act('unlock', { player_id: p.id }).catch(() => {})}>LET OUT</button>
          : <button className="btn small" onClick={() => act('lock', { player_id: p.id, minutes: 15 }).then(onClose).catch(() => {})}>LOCK 15 MIN</button>}
      </div>
      {!p.has_role && (
        <div className="srow">
          <span className="grow">😇 Not drinking tonight? Make them the Angel (public, never punished).</span>
          <ConfirmButton className="btn small" confirmText="SURE?" onConfirm={() => act('make_angel', { player_id: p.id }).then(onClose).catch(() => {})}>MAKE ANGEL</ConfirmButton>
        </div>
      )}
      {p.punishments.length > 0 && <ul className="log-list">{p.punishments.map((l, i) => <li key={i}><span>{l.via_love ? '♥ ' : l.kind === 'penalty' ? '+ ' : '☠ '}{l.text}</span><span className="muted">{fmtClock(Date.parse(l.at))}</span></li>)}</ul>}
    </Modal>
  );
}

// ---------------- expose ----------------
export function ExposeModal({ state, id, act, onClose }: { state: GameState; id: string; act: Act; onClose: () => void }) {
  const p = state.players.find(x => x.id === id);
  const [manual, setManual] = useState(false);
  if (!p) return null;
  const go = (role?: Role) => act('expose', { player_id: p.id, ...(role ? { role } : {}) }).then(onClose).catch(e => { if (errText(e) === 'NEEDS_ROLE') setManual(true); });
  if (manual) {
    return (
      <Modal title={`EXPOSE ${p.name.toUpperCase()} AS…`} onClose={onClose} actions={<button className="btn" onClick={onClose}>CANCEL</button>}>
        <p className="muted">{p.name} never entered a role code, so pick what to stamp.</p>
        <div className="role-grid">{CARD_ROLES.map(r => (
          <button key={r} className="role-choice" style={{ ['--rc' as any]: ROLES[r].color }} onClick={() => go(r)}><Mugshot role={r} className="ic" />{ROLES[r].label.toUpperCase()}</button>
        ))}</div>
      </Modal>
    );
  }
  return (
    <Modal title={`EXPOSE ${p.name.toUpperCase()}?`} onClose={onClose}
      actions={<>
        {p.public_role && <button className="btn" onClick={() => act('unexpose', { player_id: p.id }).then(onClose).catch(() => {})}>HIDE ROLE AGAIN</button>}
        <button className="btn" onClick={onClose}>CANCEL</button>
        <button className="btn danger" onClick={() => go()}>EXPOSE THEM</button></>}>
      <p>Their <b>real</b> role (from their secret code) gets stamped on their card for everyone to see. There's no faking it.</p>
      <p className="muted">If they turn out to be a Saboteur they're caught on the spot: powers gone, off to rehab. A caught Intruder's knife passes to the Betrayer.</p>
    </Modal>
  );
}

// ---------------- reveal all ----------------
export function RevealAllConfirm({ state, act, onClose, onShowSummary }: { state: GameState; act: Act; onClose: () => void; onShowSummary: () => void }) {
  return (
    <Modal title="END OF NIGHT: REVEAL ALL" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>CANCEL</button>
        {state.room.revealed && <button className="btn" onClick={onShowSummary}>SHOW SUMMARY</button>}
        <ConfirmButton className="btn danger" confirmText="SURE? TAP AGAIN" onConfirm={() => act('reveal_all').then(onClose).catch(() => {})}>REVEAL EVERYONE</ConfirmButton></>}>
      <p>Stamps every player's real role one by one, strings up the Lovebirds (a modifier on top of their role), then opens the case file: who the Saboteurs were, whether the <b>Betrayer</b> joined, who held the knife, what the <b>Detective</b> checked and which heal was <b>forged</b>.</p>
      {!state.room.ended && <p className="muted">The deadline hasn't passed yet. You can still reveal now if the night's over.</p>}
      {state.players.some(p => !p.has_role) && <p className="muted">Players without a code: {state.players.filter(p => !p.has_role).map(p => p.name).join(', ')} (they stay hidden).</p>}
    </Modal>
  );
}

// ---------------- curse pass approval ----------------

// ---------------- Davy Jones' Locker: someone asks to be locked up for a rest ----------------
export function LockApproval({ state, player, act }: { state: GameState; player: string; act: Act }) {
  const p = state.players.find(x => x.id === player);
  if (!p) return null;
  return (
    <Modal title="DAVY JONES' LOCKER?" className="curse-modal"
      actions={<><button className="btn" onClick={() => act('decide_lock', { player_id: p.id, approve: false }).catch(() => {})}>NOT YET</button>
        {[10, 15, 20, 30].map(m => <button key={m} className="btn primary" onClick={() => act('decide_lock', { player_id: p.id, approve: true, minutes: m }).catch(() => {})}>{m} MIN</button>)}</>}>
      <div className="curse-pass"><div><Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} /></div></div>
      <p><b>{p.name}</b> wants a rest in Davy Jones' Locker: no punishments (only one waits for them), no powers, no vote.</p>
    </Modal>
  );
}

// ---------------- settings ----------------
// The host's case file. One index down the left, in the order the night is set up: who's playing, the deck
// (roles, then the modifiers printed on top), the night itself, then the wheel and the housekeeping.
// Every control fires the same act() calls as before; only the presentation changed. The TV is public, so the
// deck is shown as counts only: nothing here ever joins a player to a role.
type SetupTab = 'players' | 'roles' | 'game' | 'wheel' | 'evidence' | 'room';
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const deckSize = (c: Partial<Record<Role, number>>) => CARD_ROLES.reduce((a, r) => a + (c[r] ?? 0), 0);
/** Codes typed in by players (the Angel is set by the host, not by a code). */
const codesEntered = (state: GameState) => state.players.filter(p => p.has_role && p.public_role !== 'angel').length;

// The modal is laid out once on a fixed 1600×960 stage and zoomed to fit the screen, so it reads the same on a 40" TV
// whatever the laptop's CSS viewport is (1280×720 at 150% scaling up to 4K), inside the TV edge margin (the shared
// fit in src/tv/stage.ts). Below 1000 px wide (the host's phone) it drops the stage and falls back to the fluid layout
// in setup.css.
const SU_W = 1600, SU_H = 960;
function useStageZoom() {
  const fit = useFitScale(SU_W, SU_H, 0.98, 0.98);
  const z = innerWidth < 1000 ? 0 : fit;
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--su-z', String(z || 1)); return () => { root.removeProperty('--su-z'); };
  }, [z]);
  return z > 0;
}

export function SettingsModal({ state, act, onClose, onExit }: { state: GameState; act: Act; onClose: () => void; onExit: () => void }) {
  const room = state.room;
  const staged = useStageZoom();
  const [tab, setTab] = useState<SetupTab>(room.status === 'lobby' ? 'roles' : 'game');
  const n = state.players.length, entered = codesEntered(state), deck = deckSize(room.settings.role_counts);
  const dl = new Date(Date.parse(room.deadline_at));
  const NAV: { id: SetupTab; label: string; sub: string; warn?: boolean }[] = [
    { id: 'players', label: 'PLAYERS', sub: `${n} joined, ${entered} coded` },
    { id: 'roles', label: 'ROLES & CARDS', sub: `${plural(deck, 'card')} for ${n}`, warn: n > deck },
    { id: 'game', label: 'NIGHT & DEADLINE', sub: `ends ${dl.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}, ${room.target} beers` },
    { id: 'wheel', label: 'WHEEL', sub: plural(room.segments.length, 'punishment') },
    { id: 'evidence', label: 'EVIDENCE', sub: plural(state.evidence.filter(e => !e.hidden).length, 'photo') },
    { id: 'room', label: 'ROOM', sub: `code ${room.code}` },
  ];
  // Arrow keys walk the index (a vertical tablist); Home/End jump to the ends.
  const navKey = (e: KeyboardEvent) => {
    const i = NAV.findIndex(x => x.id === tab);
    const j = e.key === 'ArrowDown' ? (i + 1) % NAV.length : e.key === 'ArrowUp' ? (i - 1 + NAV.length) % NAV.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? NAV.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); setTab(NAV[j].id); document.getElementById(`su-tab-${NAV[j].id}`)?.focus();
  };
  return (
    <Modal wide className={'setup-modal' + (staged ? ' staged' : '')} onClose={onClose}
      title={<>SETUP <span className="su-title-code">ROOM {room.code}</span><button className="btn su-done" onClick={onClose}>DONE</button></>}>
      <div className="su-shell">
        <nav className="su-nav tabs" role="tablist" aria-orientation="vertical" aria-label="Setup sections" onKeyDown={navKey}>
          {NAV.map(x => (
            <button key={x.id} id={`su-tab-${x.id}`} type="button" role="tab" aria-selected={tab === x.id} aria-controls="su-panel"
              tabIndex={tab === x.id ? 0 : -1} className={'tab su-tab' + (tab === x.id ? ' active' : '') + (x.warn ? ' warn' : '')} onClick={() => setTab(x.id)}>
              <span className="su-tab-label">{x.label}</span>
              <span className="su-tab-sub">{x.warn && <span aria-hidden>▲ </span>}{x.sub}</span>
            </button>
          ))}
        </nav>
        <div className="su-panel" id="su-panel" role="tabpanel" aria-labelledby={`su-tab-${tab}`} key={tab}>
          {tab === 'players' && <PlayersTab state={state} act={act} />}
          {tab === 'roles' && <RolesTab state={state} act={act} />}
          {tab === 'game' && <GameTab state={state} act={act} />}
          {tab === 'wheel' && <WheelTab state={state} act={act} />}
          {tab === 'evidence' && (
            <div>
              <h3 className="su-h">Evidence photos</h3>
              <p className="hint">Photos guests submit as evidence. They're pinned down both sides of the TV during a Trial. Submitters stay anonymous. Hide anything that shouldn't be on the big screen.</p>
              <div className="ev-admin">{state.evidence.slice().reverse().map(e => (
                <div key={e.id} className={'ev' + (e.hidden ? ' hidden' : '')}>
                  <img src={e.image_url} alt="" />
                  <span>{e.caption || '—'}</span>
                  {!e.hidden ? <button className="btn small danger" onClick={() => act('hide_evidence', { evidence_id: e.id }).catch(() => {})}>HIDE</button> : <span className="muted">HIDDEN</span>}
                </div>
              ))}</div>
              {!state.evidence.length && <p className="su-empty">No evidence yet. Guests send photos from their phones.</p>}
            </div>
          )}
          {tab === 'room' && (
            <div>
              <h3 className="su-h">This room</h3>
              <div className="su-roomcode">{room.code}</div>
              <p>Guests join at <b>{location.origin}/join/{room.code}</b></p>
              <div className="srow"><button className="btn" onClick={onExit}>SWITCH / CREATE ROOM</button></div>
              <EdgeMarginSetting />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// TV EDGE MARGIN: many TVs crop the picture's edges (overscan). Everything that matters stays this far in from each
// edge; saved on this laptop (src/tv/stage.ts), so it survives a new room.
function EdgeMarginSetting() {
  const [m, setM] = useEdgeMargin();
  return (
    <section className="su-group su-edge">
      <h3 className="su-h">TV edge margin <span className="su-h-meta">for a TV that crops the edges of the picture</span></h3>
      <div className="chips" role="radiogroup" aria-label="TV edge margin">
        {EDGE_MARGINS.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={m === x.id} className={'chip' + (m === x.id ? ' on' : '')} onClick={() => setM(x.id)}>{x.label}</button>
        ))}
      </div>
      <p className="hint">If the top bar or the lobby's keys are cut off on the TV, pick LARGE. OFF uses the whole screen. Saved on this laptop.</p>
    </section>
  );
}

function PlayersTab({ state, act }: { state: GameState; act: Act }) {
  const n = state.players.length, entered = codesEntered(state);
  return (
    <div>
      <h3 className="su-h">Who's playing <span className="su-h-meta">{n} joined, {entered} {entered === 1 ? 'code' : 'codes'} entered</span></h3>
      {!n && <p className="su-empty">Nobody has joined yet. Guests scan the QR code in the lobby.</p>}
      <div className="su-players">{state.players.map(p => (
        <div key={p.id} className={'su-player' + (p.rehab ? ' rehab' : '')}>
          <Avatar url={p.selfie_url} name={p.name} className="su-player-face" />
          <div className="su-player-id">
            <b>#{p.seat} {p.name}</b>
            <span>{p.has_role ? '✓ code entered' : 'no code yet'}{p.rehab ? ', in rehab' : ''}</span>
            <span className="muted">🍺 {p.beers}  ☠ {p.punishments.length}</span>
          </div>
          <ConfirmButton className="btn small danger" confirmText="SURE?" onConfirm={() => act('kick', { player_id: p.id }).catch(() => {})}>KICK</ConfirmButton>
        </div>
      ))}</div>
    </div>
  );
}

function GameTab({ state, act }: { state: GameState; act: Act }) {
  const room = state.room;
  const d = splitDeadline(Date.parse(room.deadline_at));
  const [date, setDate] = useState(d.nightDate), [time, setTime] = useState(d.time);
  const setDeadline = (ms: number) => act('update_settings', { deadline_at: new Date(ms).toISOString() }).then(() => toast('Deadline: ' + new Date(ms).toLocaleString())).catch(() => {});
  const toggle = (k: string) => act('update_settings', { settings: { [k]: !(room.settings as any)[k] } }).catch(() => {});
  return (
    <div className="su-night">
      <section className="su-group">
        <h3 className="su-h">The deadline <span className="su-h-meta">now {new Date(Date.parse(room.deadline_at)).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></h3>
        <div className="fields">
          <label className="field"><span>PARTY NIGHT (DATE)</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="field"><span>DEADLINE TIME</span><input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
        </div>
        <div className="srow">
          <button className="btn primary" onClick={() => setDeadline(computeDeadline(date, time))}>SAVE DEADLINE</button>
          <span className="hint grow">Times before 12:00 count as the morning after.</span>
        </div>
        <div className="su-tests">
          <span className="hint">Rehearse the ending:</span>
          <button className="btn small" onClick={() => setDeadline(Date.now() + 65e3)}>TEST: DEADLINE IN 1 MIN</button>
          <button className="btn small" onClick={() => setDeadline(Date.now() + 14 * 60e3 + 40e3)}>TEST: FINAL 15 MIN</button>
          <button className="btn small" onClick={() => setDeadline(computeDeadline('2026-10-10', '01:00'))}>BACK TO 10 OCT 01:00</button>
        </div>
      </section>
      <section className="su-group">
        <h3 className="su-h">The target</h3>
        <div className="fields">
          <label className="field"><span>TARGET BEERS</span><input type="number" min={1} defaultValue={room.target} onBlur={e => act('update_settings', { target: Number(e.target.value) || 100 }).catch(() => {})} /></label>
          <label className="field"><span>TALLY (CORRECTION)</span><input type="number" min={0} defaultValue={room.tally} onBlur={e => { if (Number(e.target.value) !== room.tally) act('update_settings', { tally: Number(e.target.value) || 0 }).catch(() => {}); }} /></label>
        </div>
        <p className="hint">Both save when you leave the box.</p>
      </section>
      <section className="su-group">
        <h3 className="su-h">Scrooge's abilities</h3>
        {([['scrooge_respin', 'Re-spins', 'one per drink level'],
           ['scrooge_swap', 'Swap the victim', 'twice at 8 beers'], ['scrooge_graffiti', 'Wheel graffiti', 'once']] as const).map(([k, l, sub]) => {
          const on = !!(room.settings as any)[k];
          return (
            <div key={k} className="su-switch-row">
              <Mugshot role="scrooge" className="su-mug-xs" />
              <span className="grow su-switch-label">{l} <small>{sub}</small></span>
              <button type="button" role="switch" aria-checked={on} aria-label={`Scrooge: ${l}`} className={'su-switch' + (on ? ' on' : '')} onClick={() => toggle(k)}>
                <span className="su-switch-knob" aria-hidden />{on ? 'ON' : 'OFF'}
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function WheelTab({ state, act }: { state: GameState; act: Act }) {
  const [segs, setSegs] = useState<string[]>(state.room.segments);
  const [add, setAdd] = useState('');
  const save = (next: string[]) => { setSegs(next); act('update_settings', { segments: next.filter(s => s.trim()) }).catch(() => {}); };
  return (
    <div className="su-wheel">
      <h3 className="su-h">The wheel <span className="su-h-meta">{plural(segs.length, 'punishment')}</span></h3>
      <p className="hint">A segment starting with "Safe" logs nothing; one containing "spin again" chains a doubled re-spin.</p>
      {segs.map((s, i) => (
        <div key={i} className="srow su-seg">
          <span className="su-seg-n" aria-hidden>{i + 1}</span>
          <input type="text" className="grow" aria-label={`Punishment ${i + 1}`} defaultValue={s} onBlur={e => { const n = [...segs]; n[i] = e.target.value; if (e.target.value !== s) save(n); }} />
          <button className="btn small danger" aria-label={`Remove punishment ${i + 1}`} disabled={segs.length <= 2} onClick={() => save(segs.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="srow su-seg">
        <span className="su-seg-n" aria-hidden>+</span>
        <input type="text" className="grow" placeholder="New punishment…" aria-label="New punishment" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && add.trim()) { save([...segs, add.trim()]); setAdd(''); } }} />
        <button className="btn green" onClick={() => { if (add.trim()) { save([...segs, add.trim()]); setAdd(''); } }}>+ ADD</button>
      </div>
      <h3 className="su-h">Scrooge graffiti</h3>
      {state.graffiti.length ? state.graffiti.map(g => (
        <div key={g.id} className="srow"><span className="grow graffiti-text">{g.text}</span>
          <button className="btn small danger" onClick={() => act('remove_graffiti', { graffiti_id: g.id }).catch(() => {})}>REMOVE</button></div>
      )) : <p className="su-empty">None yet. The Scrooge scrawls it from their phone.</p>}
    </div>
  );
}

// A role count: big −/+ either side of the number (NN/g steppers: horizontal, greyed at the limits), and the
// number itself takes arrow keys, Home (0) and End (max) once focused.
const STEP_MAX = 20;
function Stepper({ value, label, onChange }: { value: number; label: string; onChange: (n: number) => void }) {
  // which way the number last moved, so it rolls up or down like a counter wheel
  const prev = useRef(value), dir = useRef<'up' | 'down' | ''>('');
  if (prev.current !== value) { dir.current = value > prev.current ? 'up' : 'down'; prev.current = value; }
  const key = (e: KeyboardEvent) => {
    const next = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? value + 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? value - 1
      : e.key === 'Home' ? 0 : e.key === 'End' ? STEP_MAX : null;
    if (next === null) return;
    e.preventDefault(); onChange(next);
  };
  return (
    <span className="su-step">
      <button type="button" aria-label={`fewer ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <span className="su-count" role="spinbutton" tabIndex={0} aria-label={`${label} count`} aria-valuenow={value} aria-valuemin={0} aria-valuemax={STEP_MAX} onKeyDown={key}><span key={value} className={'su-roll ' + dir.current}>{value}</span></span>
      <button type="button" aria-label={`more ${label}`} disabled={value >= STEP_MAX} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

const TEAM_ORDER: Team[] = ['guilty', 'drinkers', 'chaos'];
function RolesTab({ state, act }: { state: GameState; act: Act }) {
  const [counts, setCounts] = useState<Record<string, number>>({ ...state.room.settings.role_counts });
  const total = Object.entries(counts).reduce((a, [k, v]) => a + (MODIFIERS.includes(k as Role) ? 0 : v), 0);
  const set = (r: Role, n: number) => setCounts(c => ({ ...c, [r]: Math.min(STEP_MAX, Math.max(0, n)) }));
  const n = state.players.length;
  const team = (t: Team) => CARD_ROLES.filter(r => ROLES[r].team === t).reduce((a, r) => a + (counts[r] ?? 0), 0);
  const split = { guilty: team('guilty'), drinkers: team('drinkers'), chaos: team('chaos') };
  const pairs = counts.lovebird ?? 0, cursed = counts.cursed ?? 0;
  const saved = state.room.settings.role_counts;
  const dirty = [...CARD_ROLES, ...MODIFIERS].some(r => (counts[r] ?? 0) !== (saved[r] ?? 0));
  const entered = codesEntered(state);

  // Live checks. Each one mirrors something the server or the rules already say; none of them is a new rule.
  // Checks that change while the host is clicking steppers sit in place (the ledger, the modifiers row), so the
  // role tokens never jump under the pointer; only the steady ones go in the list above the tokens.
  const modErr = pairs * 2 > total ? `Not enough cards for ${plural(pairs, 'Lovebird pair')}: that needs ${pairs * 2} cards.`
    : cursed > total ? `Not enough cards for ${cursed} Cursed.` : null;
  const noSaboteurs = total > 0 && !split.guilty;
  const notes: { tone: 'bad' | 'warn' | 'ok' | 'info'; text: string }[] = [];
  if (n && total < n) notes.push({ tone: 'bad', text: `${plural(n - total, 'player')} would get no card. Add ${n - total === 1 ? 'a card' : 'cards'}, or hand out spare codes later.` });
  else if (n && total > n) notes.push({ tone: 'info', text: `${plural(total - n, 'card')} more than the players so far. Fine if more guests are coming.` });
  else if (n && total === n) notes.push({ tone: 'ok', text: 'One card per player.' });
  else notes.push({ tone: 'info', text: 'Nobody has joined yet. Deal for the guests you expect.' });
  if (entered) notes.push({ tone: 'warn', text: `${plural(entered, 'code')} already entered, so the cards are locked. Create a new room to re-deal.` });

  // The deck as a row of card backs in team colours; a marker shows where the players joined so far run out.
  const backs = TEAM_ORDER.flatMap(t => Array.from({ length: split[t] }, (_, k) => ({ t, key: `${t}-${k}` }))).slice(0, 40);
  const missing = Math.max(0, Math.min(40, n) - backs.length);

  const ORDER = [...CARD_ROLES, ...MODIFIERS];
  const token = (r: Role, label = ROLES[r].label, note?: string) => {
    const v = counts[r] ?? 0;
    return (
      <div key={r} className={'su-token' + (v === 0 ? ' off' : '')} style={{ ['--rc' as any]: ROLES[r].color, ['--i' as any]: ORDER.indexOf(r) }}>
        <span className="su-mugwrap" data-n={v > 1 ? `×${v}` : undefined}><Mugshot role={r} className="su-mug" /></span>
        <span className="su-tname" title={r === 'betrayer' ? 'Turns Saboteur if they find the Intruder' : undefined}>{label}{note && <small>{note}</small>}</span>
        <Stepper value={v} label={label} onChange={x => set(r, x)} />
      </div>
    );
  };
  const col = (t: Team) => (
    <section className={'su-col ' + t} style={{ ['--tc' as any]: TEAM_INK[t] }} aria-label={TEAMS[t].label}>
      <h4><span>{TEAMS[t].label}</span><b>{split[t]}</b></h4>
      <div className="su-tokens">{CARD_ROLES.filter(r => ROLES[r].team === t).map(r => token(r, ROLES[r].label, r === 'betrayer' ? 'can defect' : undefined))}</div>
    </section>
  );
  return (
    <div className="roles-setup">
      <div className="su-ledger">
        <div className="su-ledger-main">
          <div className="su-tally" aria-live="polite">
            <span className={'su-tally-n' + (n > total ? ' short' : '')}><b>{total}</b> {total === 1 ? 'card' : 'cards'}</span>
            <span className="su-tally-vs">for</span>
            <span className="su-tally-n"><b>{n}</b> {n === 1 ? 'player' : 'players'}</span>
          </div>
          <div className="su-deck">
            {backs.map((b, i) => <span key={b.key} aria-hidden className={`su-back ${b.t}` + (n && i >= n ? ' extra' : '')} style={{ ['--i' as any]: i }} />)}
            {Array.from({ length: missing }, (_, i) => <span key={'m' + i} aria-hidden className="su-back missing" />)}
            {/* the stamp lands on the deck itself, right after the cards (and the empty slots) it's about */}
            {modErr ? <span key="cant" className="stamp slam su-dirty" title={modErr}>CAN'T DEAL</span>
              : dirty && <span key="dirty" className="stamp slam su-dirty" title="GENERATE CODES saves these counts">NOT DEALT</span>}
          </div>
          <div className="su-split">
            <span className={'guilty' + (noSaboteurs ? ' none' : '')}><b>{split.guilty}</b> {split.guilty === 1 ? 'Saboteur' : 'Saboteurs'}{noSaboteurs && ': nobody works against the group'}</span>
            <span className="vs">vs</span>
            <span className="drinkers"><b>{split.drinkers}</b> {split.drinkers === 1 ? 'Drinker' : 'Drinkers'}</span>
            <span className="vs">and</span>
            <span className="chaos"><b>{split.chaos}</b> Chaos</span>
          </div>
        </div>
        <div className="su-deal">
          <ConfirmButton className="btn primary su-generate" confirmText="REPLACES OLD CODES — TAP AGAIN"
            onConfirm={() => act('generate_cards', { role_counts: counts }).then(() => toast(`${total} role cards generated`)).catch(() => {})}>GENERATE CODES</ConfirmButton>
          <a className="btn" href={`/cards/${state.room.code}`} target="_blank" rel="noreferrer">OPEN PRINT PAGE</a>
        </div>
      </div>
      <ul className="su-notes">{notes.map((x, i) => <li key={i} className={x.tone}>{x.text}</li>)}</ul>
      <div className="su-grid">
        {col('guilty')}
        {col('drinkers')}
        {col('chaos')}
        <section className="su-col mods" style={{ ['--tc' as any]: '#9c8a5a' }} aria-label="Modifiers">
          <h4><span>MODIFIERS</span></h4>
          {modErr ? <p className="su-col-blurb bad" role="alert">▲ {modErr}</p>
            : <p className="su-col-blurb">Printed on top of a random dealt card. They add no cards.</p>}
          <div className="su-tokens">{token('lovebird', 'Lovebird pairs', '2 cards each')}{token('cursed', 'Cursed', '1 card each')}</div>
        </section>
      </div>
      <div className="su-foot">
        <p className="hint su-angel">😇 Angel: tap MAKE ANGEL on a non‑drinker's file.</p>
        <SpareCode act={act} roomCode={state.room.code} />
      </div>
    </div>
  );
}

// A late guest who wasn't dealt a card: one extra single-use code (it works after the deck is locked). THE TV IS IN
// THE ROOM'S VIEW: it never says what a spare deals (the room would learn the late guest's side), and by default it
// never shows the code either. The host reads it on their own phone at /cards/ROOMCODE, which lists unused spares.
// Only a two-tap SHOW HERE ANYWAY puts the code up big, for a host with no phone to hand.
function SpareCode({ act, roomCode }: { act: Act; roomCode: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const make = () => act<{ codes: string[] }>('spare_codes', { n: 1 }).then(r => { setCode(r.codes[0] ?? null); setShown(false); }).catch(() => {});
  const close = () => { setCode(null); setShown(false); };
  return (
    <div className="srow">
      <span className="grow hint">Then read the code on your own phone.</span>
      <ConfirmButton className="btn" confirmText="MAKE A SPARE? TAP AGAIN" onConfirm={make}>SPARE CODE FOR A LATE GUEST</ConfirmButton>
      {code && (
        <Modal title={shown ? 'SPARE CODE' : 'SPARE READY'} className="spare-modal" onClose={close}
          actions={<>
            {!shown && <ConfirmButton className="btn" confirmText="THE ROOM CAN SEE THIS · TAP AGAIN" onConfirm={() => setShown(true)}>SHOW HERE ANYWAY</ConfirmButton>}
            <button className="btn primary" onClick={close}>DONE</button>
          </>}>
          {shown ? <>
            <p className="spare-warn">The room can see this. Show it to the late guest only.</p>
            <div className="spare-code">{code}</div>
          </> : <>
            <p className="spare-warn">SPARE READY</p>
            <p>Open the cards page on YOUR phone to see it: <b>{location.host}/cards/{roomCode}</b></p>
          </>}
          <p className="hint">They join the room, then type it in YOUR FILE. Single use.</p>
        </Modal>
      )}
    </div>
  );
}
