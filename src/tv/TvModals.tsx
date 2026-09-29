// Host modals: settings, games & trials, player detail, expose, reveal-all, curse approval.
import { useState } from 'react';
import type { GameState, Role, Team } from '../lib/types';
import type { Act } from './TvRoom';
import { errText } from '../lib/backend';
import { CARD_ROLES, MODIFIERS, ROLES, TEAMS } from '../lib/roles';

const TEAM_INK: Record<Team, string> = { guilty: 'var(--alarm)', drinkers: 'var(--bone)', chaos: 'var(--synth)' };
import { computeDeadline, fmtClock, splitDeadline } from '../lib/util';
import { Avatar, ConfirmButton, Modal, Polaroid } from '../components/ui';
import { toast } from '../fx/effects';
import { FORMATS, MatchupOverlay, draw, sideNames, type Format } from './Matchups';

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
    <Modal title={<><Avatar url={p.selfie_url} name={p.name} className="title-avatar" /> #{p.seat} {p.name.toUpperCase()}{p.rehab && <span className="stamp" style={{ fontSize: 22 }}>REHAB</span>}</>} onClose={onClose}
      actions={<>
        <ConfirmButton className="btn danger" confirmText="REALLY KICK?" onConfirm={() => act('kick', { player_id: p.id }).then(onClose).catch(() => {})}>KICK</ConfirmButton>
        <button className="btn" onClick={() => act('queue_add', { player_id: p.id }).then(() => { toast(`${p.name} added to the queue`); onClose(); }).catch(() => {})}>+ QUEUE</button>
        <button className="btn danger" disabled={!!state.round} onClick={() => act('call_next', { player_id: p.id }).then(onClose).catch(() => {})}>PUNISH NOW</button>
        <button className="btn primary" onClick={onExpose}>EXPOSE</button>
      </>}>
      <p>🍺 <b>{p.beers}</b> beers logged · ☠ <b>{p.punishments.length}</b> punishments {p.cursed && '· holds the curse'}</p>
      <p>Role: <b>{p.public_role ? `${ROLES[p.public_role].icon} ${ROLES[p.public_role].label}` : p.has_role ? 'secret (code entered ✓)' : 'no code entered yet'}</b></p>
      <div className="srow locker-row">
        <span className="grow">⚓ Davy Jones' Locker{p.locked_until ? `: locked until ${fmtClock(Date.parse(p.locked_until))}` : ''}{p.held ? ' · 1 punishment waiting' : ''}</span>
        {p.locked_until
          ? <button className="btn small" onClick={() => act('unlock', { player_id: p.id }).catch(() => {})}>LET OUT</button>
          : [10, 15, 20, 30].map(m => <button key={m} className="btn small" onClick={() => act('lock', { player_id: p.id, minutes: m }).then(onClose).catch(() => {})}>{m} MIN</button>)}
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
          <button key={r} className="role-choice" style={{ ['--rc' as any]: ROLES[r].color }} onClick={() => go(r)}><span className="ic">{ROLES[r].icon}</span>{ROLES[r].label.toUpperCase()}</button>
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
export function SettingsModal({ state, act, onClose, onExit }: { state: GameState; act: Act; onClose: () => void; onExit: () => void }) {
  const [tab, setTab] = useState<'game' | 'wheel' | 'roles' | 'players' | 'evidence' | 'room'>('game');
  const room = state.room;
  const TABS = { game: 'GAME & DEADLINE', wheel: 'WHEEL', roles: 'ROLES & CARDS', players: 'PLAYERS', evidence: `EVIDENCE (${state.evidence.filter(e => !e.hidden).length})`, room: 'ROOM' } as const;
  return (
    <Modal title="SETUP" wide onClose={onClose} actions={<button className="btn primary" onClick={onClose}>DONE</button>}>
      <div className="tabs">{Object.entries(TABS).map(([k, l]) => <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k as any)}>{l}</button>)}</div>
      {tab === 'game' && <GameTab state={state} act={act} />}
      {tab === 'wheel' && <WheelTab state={state} act={act} />}
      {tab === 'roles' && <RolesTab state={state} act={act} />}
      {tab === 'players' && (
        <div>{state.players.map(p => (
          <div key={p.id} className="srow"><Avatar url={p.selfie_url} name={p.name} /><span className="grow">#{p.seat} {p.name} {p.has_role ? '✓' : ''} {p.rehab ? '(rehab)' : ''}</span>
            <span className="muted">🍺 {p.beers} · ☠ {p.punishments.length}</span>
            <ConfirmButton className="btn small danger" confirmText="SURE?" onConfirm={() => act('kick', { player_id: p.id }).catch(() => {})}>KICK</ConfirmButton></div>
        ))}{!state.players.length && <p className="muted">Nobody has joined yet.</p>}</div>
      )}
      {tab === 'evidence' && (
        <div>
          <p className="hint">Photos guests submit as evidence. They're pinned down both sides of the TV during a Trial. Submitters stay anonymous. Hide anything that shouldn't be on the big screen.</p>
          <div className="ev-admin">{state.evidence.slice().reverse().map(e => (
            <div key={e.id} className={'ev' + (e.hidden ? ' hidden' : '')}>
              <img src={e.image_url} alt="" />
              <span>{e.caption || '—'}</span>
              {!e.hidden ? <button className="btn small danger" onClick={() => act('hide_evidence', { evidence_id: e.id }).catch(() => {})}>HIDE</button> : <span className="muted">HIDDEN</span>}
            </div>
          ))}</div>
          {!state.evidence.length && <p className="muted">No evidence yet.</p>}
        </div>
      )}
      {tab === 'room' && (
        <div>
          <p>Room code <b>{room.code}</b>. Guests join at <b>{location.origin}/join/{room.code}</b></p>
          <div className="srow"><button className="btn" onClick={onExit}>SWITCH / CREATE ROOM</button></div>
        </div>
      )}
    </Modal>
  );
}

function GameTab({ state, act }: { state: GameState; act: Act }) {
  const room = state.room;
  const d = splitDeadline(Date.parse(room.deadline_at));
  const [date, setDate] = useState(d.nightDate), [time, setTime] = useState(d.time);
  const setDeadline = (ms: number) => act('update_settings', { deadline_at: new Date(ms).toISOString() }).then(() => toast('Deadline: ' + new Date(ms).toLocaleString())).catch(() => {});
  const toggle = (k: string) => act('update_settings', { settings: { [k]: !(room.settings as any)[k] } }).catch(() => {});
  return (
    <div>
      <div className="fields">
        <label className="field"><span>PARTY NIGHT (DATE)</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label className="field"><span>DEADLINE TIME</span><input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
        <label className="field"><span>TARGET BEERS</span><input type="number" min={1} defaultValue={room.target} onBlur={e => act('update_settings', { target: Number(e.target.value) || 100 }).catch(() => {})} /></label>
        <label className="field"><span>TALLY (CORRECTION)</span><input type="number" min={0} defaultValue={room.tally} onBlur={e => { if (Number(e.target.value) !== room.tally) act('update_settings', { tally: Number(e.target.value) || 0 }).catch(() => {}); }} /></label>
      </div>
      <div className="srow">
        <button className="btn primary" onClick={() => setDeadline(computeDeadline(date, time))}>SAVE DEADLINE</button>
        <span className="hint">Now: {new Date(Date.parse(room.deadline_at)).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Times before 12:00 count as the morning after.</span>
      </div>
      <div className="srow">
        <button className="btn" onClick={() => setDeadline(Date.now() + 65e3)}>TEST: DEADLINE IN 1 MIN</button>
        <button className="btn" onClick={() => setDeadline(Date.now() + 14 * 60e3 + 40e3)}>TEST: FINAL 15 MIN</button>
        <button className="btn" onClick={() => setDeadline(computeDeadline('2026-10-10', '01:00'))}>BACK TO 10 OCT 01:00</button>
      </div>
      <h3>ABILITIES</h3>
      {([['scrooge_respin', 'Scrooge: re-spins (one per drink level)'],
         ['scrooge_swap', 'Scrooge: swap the victim (twice at 8 beers)'], ['scrooge_graffiti', 'Scrooge: wheel graffiti (once)']] as const).map(([k, l]) => (
        <div key={k} className="srow"><span className="grow">{l}</span>
          <button className={'btn small' + ((room.settings as any)[k] ? ' green' : '')} onClick={() => toggle(k)}>{(room.settings as any)[k] ? 'ON' : 'OFF'}</button></div>
      ))}
    </div>
  );
}

function WheelTab({ state, act }: { state: GameState; act: Act }) {
  const [segs, setSegs] = useState<string[]>(state.room.segments);
  const [add, setAdd] = useState('');
  const save = (next: string[]) => { setSegs(next); act('update_settings', { segments: next.filter(s => s.trim()) }).catch(() => {}); };
  return (
    <div>
      <p className="hint">A segment starting with "Safe" logs nothing; one containing "spin again" chains a doubled re-spin.</p>
      {segs.map((s, i) => (
        <div key={i} className="srow">
          <input type="text" className="grow" defaultValue={s} onBlur={e => { const n = [...segs]; n[i] = e.target.value; if (e.target.value !== s) save(n); }} />
          <button className="btn small danger" disabled={segs.length <= 2} onClick={() => save(segs.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="srow">
        <input type="text" className="grow" placeholder="New punishment…" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && add.trim()) { save([...segs, add.trim()]); setAdd(''); } }} />
        <button className="btn green" onClick={() => { if (add.trim()) { save([...segs, add.trim()]); setAdd(''); } }}>+ ADD</button>
      </div>
      <h3>SCROOGE GRAFFITI</h3>
      {state.graffiti.length ? state.graffiti.map(g => (
        <div key={g.id} className="srow"><span className="grow graffiti-text">{g.text}</span>
          <button className="btn small danger" onClick={() => act('remove_graffiti', { graffiti_id: g.id }).catch(() => {})}>REMOVE</button></div>
      )) : <p className="muted">None yet.</p>}
    </div>
  );
}

function RolesTab({ state, act }: { state: GameState; act: Act }) {
  const [counts, setCounts] = useState<Record<string, number>>({ ...state.room.settings.role_counts });
  const total = Object.entries(counts).reduce((a, [k, v]) => a + (MODIFIERS.includes(k as Role) ? 0 : v), 0);
  const set = (r: Role, n: number) => setCounts({ ...counts, [r]: Math.min(20, Math.max(0, n)) });
  const row = (r: Role, label = ROLES[r].label, note?: string) => (
    <div key={r} className={`rc-row${(counts[r] ?? 0) === 0 ? ' off' : ''}`}>
      <span className="rc-ico">{ROLES[r].icon}</span>
      <span className="rc-name">{label}{note && <small>{note}</small>}</span>
      <span className="rc-step">
        <button type="button" aria-label={`fewer ${label}`} onClick={() => set(r, (counts[r] ?? 0) - 1)}>−</button>
        <b>{counts[r] ?? 0}</b>
        <button type="button" aria-label={`more ${label}`} onClick={() => set(r, (counts[r] ?? 0) + 1)}>+</button>
      </span>
    </div>
  );
  const team = (t: Team) => (
    <section className="rc-col" style={{ ['--tc' as any]: TEAM_INK[t] }}>
      <h4>{TEAMS[t].label}</h4>
      {CARD_ROLES.filter(r => ROLES[r].team === t).map(r => row(r, ROLES[r].label, r === 'betrayer' ? 'turns Saboteur if they find the Intruder' : undefined))}
    </section>
  );
  return (
    <div className="roles-setup">
      <p className="hint">One card per player. Saboteurs win if the group falls short; Chaos serves no side. The 😇 Angel isn't a card: tap a player who isn't drinking and choose MAKE ANGEL.</p>
      <div className="rc-grid">
        {team('guilty')}
        {team('drinkers')}
        <div className="rc-stack">
          {team('chaos')}
          <section className="rc-col" style={{ ['--tc' as any]: 'var(--sodium)' }}>
            <h4>MODIFIERS</h4>
            {row('lovebird', 'Lovebird pairs', '2 cards each')}
            {row('cursed', 'Cursed')}
            <p className="rc-note">Printed on top of any dealt card, so they add no cards.</p>
          </section>
        </div>
      </div>
      <div className="srow">
        <b className="grow">{total} cards ({state.players.length} players joined)</b>
        <ConfirmButton className="btn primary" confirmText="REPLACES OLD CODES — TAP AGAIN"
          onConfirm={() => act('generate_cards', { role_counts: counts }).then(() => toast(`${total} role cards generated`)).catch(() => {})}>GENERATE CODES</ConfirmButton>
        <a className="btn" href={`/cards/${state.room.code}`} target="_blank" rel="noreferrer">OPEN PRINT PAGE</a>
      </div>
    </div>
  );
}
