// Host modals: settings, games/votes, player detail, expose, reveal-all, curse approval.
import { useState } from 'react';
import type { GameState, Role } from '../lib/types';
import type { Act } from './TvRoom';
import { errText } from '../lib/backend';
import { ROLE_ORDER, ROLES } from '../lib/roles';
import { computeDeadline, fmtClock, splitDeadline } from '../lib/util';
import { Avatar, ConfirmButton, Modal } from '../components/ui';
import { toast } from '../fx/effects';

const GAME_IDEAS = ['Beer Pong', 'Flip Cup', 'Kings', 'Ring of Fire', 'Darts', 'Quiz', 'Arm Wrestle', 'Rock Paper Scissors'];

// ---------------- games & votes ----------------
export function GameModal({ state, act, onClose }: { state: GameState; act: Act; onClose: () => void }) {
  const game = state.game;
  const [name, setName] = useState('');
  const [losers, setLosers] = useState<string[]>([]);
  const [step, setStep] = useState<'main' | 'afterGame'>('main');
  const active = game?.status === 'active';
  const voteOpen = state.vote?.status === 'open';

  if (step === 'afterGame') {
    return (
      <Modal title="🗳️ BIGGEST SLACKER?" onClose={onClose}
        actions={<><button className="btn" onClick={onClose}>SKIP</button>
          <button className="btn pink" onClick={() => act('start_vote', { kind: 'slacker', game_id: game?.id }).then(onClose).catch(() => {})}>START 30s VOTE</button></>}>
        <p>Everyone votes on their phone for who slacked the hardest. Ties: all tied players are punished.</p>
      </Modal>
    );
  }
  if (active) {
    return (
      <Modal title={`🏁 ${game!.name.toUpperCase()} — WHO LOST?`} wide onClose={onClose}
        actions={<><button className="btn" onClick={onClose}>CANCEL</button>
          <button className="btn danger" onClick={() => act('finish_game', { game_id: game!.id, losers }).then(() => setStep('afterGame')).catch(() => {})}>
            CONFIRM {losers.length} LOSER{losers.length === 1 ? '' : 'S'}</button></>}>
        <p className="muted">Tap every loser. They go straight into the punishment queue.</p>
        <div className="pick-grid">
          {state.players.map(p => (
            <button key={p.id} className={'pick' + (losers.includes(p.id) ? ' sel' : '')} onClick={() => setLosers(l => l.includes(p.id) ? l.filter(x => x !== p.id) : [...l, p.id])}>
              <Avatar url={p.selfie_url} name={p.name} /> {p.name}
            </button>
          ))}
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="🎮 GAMES" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>CLOSE</button>
        <button className="btn pink" disabled={voteOpen} onClick={() => act('start_vote', { kind: 'slacker', game_id: game?.id }).then(onClose).catch(() => {})}>🗳️ SLACKER VOTE</button>
        <button className="btn primary" disabled={!name.trim()} onClick={() => act('start_game', { name }).then(onClose).catch(() => {})}>START GAME</button></>}>
      <p className="muted">Name the game. When it ends, tap GAME OVER and pick the loser(s).</p>
      <input type="text" placeholder="e.g. Beer Pong" value={name} onChange={e => setName(e.target.value)} maxLength={40} autoFocus />
      <div className="chips">{GAME_IDEAS.map(g => <button key={g} className="chip" onClick={() => setName(g)}>{g}</button>)}</div>
    </Modal>
  );
}

// ---------------- player detail ----------------
export function PlayerDetail({ state, id, act, onClose, onExpose }: { state: GameState; id: string; act: Act; onClose: () => void; onExpose: () => void }) {
  const p = state.players.find(x => x.id === id);
  if (!p) return null;
  return (
    <Modal title={<><Avatar url={p.selfie_url} name={p.name} className="title-avatar" /> #{p.seat} {p.name.toUpperCase()}</>} onClose={onClose}
      actions={<>
        <ConfirmButton className="btn danger" confirmText="REALLY KICK?" onConfirm={() => act('kick', { player_id: p.id }).then(onClose).catch(() => {})}>KICK</ConfirmButton>
        <button className="btn" onClick={() => act('queue_add', { player_id: p.id }).then(() => { toast(`${p.name} added to the queue`); onClose(); }).catch(() => {})}>+ QUEUE</button>
        <button className="btn pink" disabled={!!state.round} onClick={() => act('call_next', { player_id: p.id }).then(onClose).catch(() => {})}>🎡 PUNISH NOW</button>
        <button className="btn primary" onClick={onExpose}>EXPOSE</button>
      </>}>
      <p>🍺 <b>{p.beers}</b> beers logged · ☠ <b>{p.punishments.length}</b> punishments {p.cursed && '· 💀 holds the curse'}</p>
      <p>Role: <b>{p.public_role ? `${ROLES[p.public_role].icon} ${ROLES[p.public_role].label}` : p.has_role ? 'secret (code entered ✓)' : 'no code entered yet'}</b></p>
      {p.punishments.length > 0 && <ul className="log-list">{p.punishments.map((l, i) => <li key={i}><span>{l.via_love ? '💘 ' : '☠ '}{l.text}</span><span className="muted">{fmtClock(Date.parse(l.at))}</span></li>)}</ul>}
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
        <div className="role-grid">{ROLE_ORDER.map(r => (
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
    </Modal>
  );
}

// ---------------- reveal all ----------------
export function RevealAllConfirm({ state, act, onClose, onShowSummary }: { state: GameState; act: Act; onClose: () => void; onShowSummary: () => void }) {
  return (
    <Modal title="🎭 END OF NIGHT: REVEAL ALL" onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>CANCEL</button>
        {state.room.revealed && <button className="btn" onClick={onShowSummary}>SHOW SUMMARY</button>}
        <ConfirmButton className="btn pink" confirmText="SURE? TAP AGAIN" onConfirm={() => act('reveal_all').then(onClose).catch(() => {})}>🎭 REVEAL EVERYONE</ConfirmButton></>}>
      <p>Stamps every player's real role one by one, links the Lovebirds, and shows any <b>fake heals</b> and whether the <b>Betrayer</b> joined the Intruder.</p>
      {!state.room.ended && <p className="muted">The deadline hasn't passed yet. You can still reveal now if the night's over.</p>}
      {state.players.some(p => !p.has_role) && <p className="muted">Players without a code: {state.players.filter(p => !p.has_role).map(p => p.name).join(', ')} (they stay hidden).</p>}
    </Modal>
  );
}

// ---------------- curse pass approval ----------------
export function CurseApproval({ state, pass, act }: { state: GameState; pass: { id: string; from_id: string; to_id: string }; act: Act }) {
  const from = state.players.find(p => p.id === pass.from_id), to = state.players.find(p => p.id === pass.to_id);
  return (
    <Modal title="💀 PASS THE CURSE?" className="curse-modal"
      actions={<><button className="btn" onClick={() => act('decide_curse', { pass_id: pass.id, approve: false }).catch(() => {})}>REJECT</button>
        <button className="btn pink" onClick={() => act('decide_curse', { pass_id: pass.id, approve: true }).catch(() => {})}>APPROVE</button></>}>
      <div className="curse-pass">
        <div><Avatar url={from?.selfie_url} name={from?.name ?? '?'} /><b>{from?.name}</b></div>
        <div className="curse-arrow">💀 →</div>
        <div><Avatar url={to?.selfie_url} name={to?.name ?? '?'} /><b>{to?.name}</b></div>
      </div>
      <p>Did <b>{from?.name}</b> beat <b>{to?.name}</b> in a game?</p>
    </Modal>
  );
}

// ---------------- settings ----------------
export function SettingsModal({ state, act, onClose, onExit }: { state: GameState; act: Act; onClose: () => void; onExit: () => void }) {
  const [tab, setTab] = useState<'game' | 'wheel' | 'roles' | 'players' | 'room'>('game');
  const room = state.room;
  const TABS = { game: 'GAME & DEADLINE', wheel: 'WHEEL', roles: 'ROLES & CARDS', players: 'PLAYERS', room: 'ROOM' } as const;
  return (
    <Modal title="⚙ SETUP" wide onClose={onClose} actions={<button className="btn primary" onClick={onClose}>DONE</button>}>
      <div className="tabs">{Object.entries(TABS).map(([k, l]) => <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k as any)}>{l}</button>)}</div>
      {tab === 'game' && <GameTab state={state} act={act} />}
      {tab === 'wheel' && <WheelTab state={state} act={act} />}
      {tab === 'roles' && <RolesTab state={state} act={act} />}
      {tab === 'players' && (
        <div>{state.players.map(p => (
          <div key={p.id} className="srow"><Avatar url={p.selfie_url} name={p.name} /><span className="grow">#{p.seat} {p.name} {p.has_role ? '✓' : ''}</span>
            <span className="muted">🍺 {p.beers} · ☠ {p.punishments.length}</span>
            <ConfirmButton className="btn small danger" confirmText="SURE?" onConfirm={() => act('kick', { player_id: p.id }).catch(() => {})}>KICK</ConfirmButton></div>
        ))}{!state.players.length && <p className="muted">Nobody has joined yet.</p>}</div>
      )}
      {tab === 'room' && (
        <div>
          <p>Room code <b>{room.code}</b>. Guests join at <b>{location.origin}/join/{room.code}</b></p>
          <div className="srow"><button className="btn" onClick={onExit}>↩ SWITCH / CREATE ROOM</button></div>
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
        <button className="btn" onClick={() => setDeadline(Date.now() + 65e3)}>⏱ TEST: DEADLINE IN 1 MIN</button>
        <button className="btn" onClick={() => setDeadline(Date.now() + 14 * 60e3 + 40e3)}>🔴 TEST: FINAL 15 MIN</button>
        <button className="btn" onClick={() => setDeadline(computeDeadline('2026-10-10', '01:00'))}>↺ BACK TO 10 OCT 01:00</button>
      </div>
      <h3>ABILITIES</h3>
      {([['intruder_fake_heal', '🗡️ Intruder: one fake heal per night'], ['jester_respin', '🃏 Jester: re-spin (2 per night)'],
         ['jester_swap', '🃏 Jester: swap victim (once)'], ['jester_graffiti', '🃏 Jester: wheel graffiti (once)']] as const).map(([k, l]) => (
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
      <h3>🃏 JESTER GRAFFITI</h3>
      {state.graffiti.length ? state.graffiti.map(g => (
        <div key={g.id} className="srow"><span className="grow graffiti-text">{g.text}</span>
          <button className="btn small danger" onClick={() => act('remove_graffiti', { graffiti_id: g.id }).catch(() => {})}>REMOVE</button></div>
      )) : <p className="muted">None yet.</p>}
    </div>
  );
}

function RolesTab({ state, act }: { state: GameState; act: Act }) {
  const [counts, setCounts] = useState<Record<string, number>>({ ...state.room.settings.role_counts });
  const total = Object.entries(counts).reduce((a, [k, v]) => a + (k === 'lovebird' ? v * 2 : v), 0);
  return (
    <div>
      <p className="hint">How many of each role are in play. Lovebirds are counted in <b>pairs</b>. Then print one card per envelope.</p>
      <div className="fields">
        {ROLE_ORDER.map(r => (
          <label key={r} className="field"><span>{ROLES[r].icon} {ROLES[r].label.toUpperCase()}{r === 'lovebird' ? ' PAIRS' : ''}</span>
            <input type="number" min={0} max={20} value={counts[r] ?? 0} onChange={e => setCounts({ ...counts, [r]: Math.max(0, Number(e.target.value) || 0) })} /></label>
        ))}
      </div>
      <div className="srow">
        <b className="grow">{total} cards ({state.players.length} players joined)</b>
        <ConfirmButton className="btn primary" confirmText="REPLACES OLD CODES — TAP AGAIN"
          onConfirm={() => act('generate_cards', { role_counts: counts }).then(() => toast(`${total} role cards generated`)).catch(() => {})}>GENERATE CODES</ConfirmButton>
        <a className="btn" href={`/cards/${state.room.code}`} target="_blank" rel="noreferrer">🖨 OPEN PRINT PAGE</a>
      </div>
    </div>
  );
}
