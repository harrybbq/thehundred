// The in-game phone screen. Full-screen takeovers (in priority order):
// team notice → vote → SPIN (you're the victim). Otherwise: beer button, role,
// context-aware abilities, and always-on reactions (so tapping is never a tell).
import { useEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import type { GameState, Player } from '../lib/types';
import { ROLES } from '../lib/roles';
import { Avatar, ConfirmButton } from '../components/ui';
import { toast } from '../fx/effects';
import { Sound } from '../fx/sound';

type Room = { refresh: () => void; now: () => number; connected: boolean };
const REACTIONS = ['🍺', '😈', '🙏', '😂'];
const RESPIN_WINDOW = 10000;

export function PhoneHome({ backend, state, room }: { backend: Backend; state: GameState; room: Room }) {
  const s = state, me = s.players.find(p => p.id === s.me.player_id)!;
  const sec = s.me.secret;
  const round = s.round;
  const victim = round ? s.players.find(p => p.id === round.victim_id) : null;
  const [picker, setPicker] = useState<null | { title: string; exclude: string[]; confirm: string; onPick: (p: Player) => Promise<void> }>(null);
  const [showRole, setShowRole] = useState(false);
  const [notice, setNotice] = useState<null | { title: string; sub: string; tone: string }>(null);
  const [graffiti, setGraffiti] = useState<string | null>(null);

  const act = async (action: string, args: Record<string, unknown> = {}) => {
    try { const r = await backend.api(action, { room_id: s.room.id, ...args }); room.refresh(); return r; }
    catch (e) { toast('⚠ ' + errText(e), 3500); throw e; }
  };
  const buzz = (ms = 20) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

  // "You're a team now" — shown once per new team-mate (survives refresh)
  const teamKey = `thehundred-team-${s.me.player_id}`;
  useEffect(() => {
    const team = sec?.team ?? [];
    let seen = 0; try { seen = Number(localStorage.getItem(teamKey) || 0); } catch { /* ignore */ }
    if (team.length > seen) {
      try { localStorage.setItem(teamKey, String(team.length)); } catch { /* ignore */ }
      buzz(300);
      setNotice({ title: "🤝 YOU'RE A TEAM NOW", sub: `${team.map(t => t.name).join(' & ')} ${sec?.role === 'intruder' ? 'is your secret Betrayer' : 'is the Intruder'}. You share the win. Act natural.`, tone: 'team' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec?.team?.length]);

  // buzz when it's my turn
  const myTurn = round?.phase === 'waiting' && round.victim_id === me.id;
  const prevTurn = useRef(false);
  useEffect(() => { if (myTurn && !prevTurn.current) buzz(400); prevTurn.current = myTurn; }, [myTurn]);

  // ---------- beer ----------
  const cooldown = s.me.cooldown_until ? Math.max(0, Date.parse(s.me.cooldown_until) - room.now()) : 0;
  const [beerBusy, setBeerBusy] = useState(false);
  const logBeer = async () => {
    Sound.unlock(); buzz(); setBeerBusy(true);
    try { await act('log_beer'); Sound.pop(); } catch { /* toast shown */ } finally { setBeerBusy(false); }
  };

  // ---------- full-screen takeovers ----------
  if (notice) {
    return (
      <div className={'phone takeover ' + notice.tone} onClick={() => setNotice(null)}>
        <div className="to-title">{notice.title}</div><div className="to-sub">{notice.sub}</div><div className="muted">tap to close</div>
      </div>
    );
  }
  const vote = s.vote;
  if (vote && vote.status === 'open' && !vote.my_choice && vote.options.includes(me.id)) {
    const left = Math.max(0, Date.parse(vote.ends_at) - room.now());
    return (
      <div className="phone takeover vote">
        <div className="to-kicker">🗳️ {vote.title.toUpperCase()}</div>
        <div className="to-timer">{Math.ceil(left / 1000)}s</div>
        <div className="p-grid">
          {s.players.filter(p => vote.options.includes(p.id) && p.id !== me.id).map(p => (
            <button key={p.id} className="p-pick" onClick={() => { buzz(); act('cast_vote', { vote_id: vote.id, choice_id: p.id }).catch(() => {}); }}>
              <Avatar url={p.selfie_url} name={p.name} /><span>{p.name}</span>
            </button>
          ))}
        </div>
        <Reactions backend={backend} roomId={s.room.id} />
      </div>
    );
  }
  if (myTurn) {
    return (
      <div className="phone takeover spin">
        <div className="to-kicker">{round!.reason || 'PUNISHMENT TIME'}</div>
        <div className="to-title">YOU'RE FACING THE WHEEL</div>
        {me.cursed && <div className="to-sub">💀 CURSED — IT SPINS TWICE</div>}
        <button className="spin-btn" onClick={() => { Sound.unlock(); buzz(80); act('spin', { round_id: round!.id }).catch(() => {}); }}>SPIN</button>
        <Reactions backend={backend} roomId={s.room.id} />
      </div>
    );
  }

  // ---------- abilities (context-aware) ----------
  const abilities: (JSX.Element | null)[] = [];
  const settings = s.room.settings;
  const waiting = round?.phase === 'waiting';
  if (sec && round && victim) {
    const target = victim.name;
    if (sec.role === 'medic' && waiting && victim.id !== me.id) {
      abilities.push(sec.healed_this_round
        ? <div key="h" className="ab-done">✚ Heal sent to {target}. Shh.</div>
        : sec.heals_left > 0
          ? <ConfirmButton key="h" className="ab-btn heal" confirmText={`TAP AGAIN: HEAL ${target.toUpperCase()}`} onConfirm={() => act('heal', { round_id: round.id }).then(() => { buzz(60); toast('✚ Healed. Keep a straight face.'); }).catch(() => {})}>
              ✚ HEAL {target.toUpperCase()}?<small>{sec.heals_left} LEFT · COVERS THEIR LOVEBIRD TOO</small></ConfirmButton>
          : null);
    }
    if (sec.role === 'intruder' && settings.intruder_fake_heal && waiting && victim.id !== me.id && sec.fake_heals_left > 0) {
      abilities.push(sec.healed_this_round
        ? <div key="f" className="ab-done">🩹 Fake heal planted.</div>
        : <ConfirmButton key="f" className="ab-btn fake" confirmText="TAP AGAIN: FAKE HEAL" onConfirm={() => act('heal', { round_id: round.id, fake: true }).then(() => toast('🩹 They think they are saved…')).catch(() => {})}>
            🩹 FAKE HEAL {target.toUpperCase()}?<small>LOOKS REAL · STILL COUNTS · ONCE</small></ConfirmButton>);
    }
    if (sec.role === 'jester' && settings.jester_swap && waiting && !sec.swap_used) {
      abilities.push(<button key="sw" className="ab-btn jester" onClick={() => setPicker({
        title: `SWAP ${target.toUpperCase()} FOR…`, exclude: [victim.id], confirm: 'SWAP',
        onPick: p => act('jester_swap', { round_id: round.id, player_id: p.id }).then(() => { buzz(60); toast('🃏 Swapped!'); }),
      })}>🔀 SWAP THE VICTIM<small>ONCE PER NIGHT</small></button>);
    }
    if (sec.role === 'jester' && settings.jester_respin && round.phase === 'revealed' && round.revealed_at && sec.respins_left > 0) {
      const left = Date.parse(round.revealed_at) + RESPIN_WINDOW - room.now();
      if (left > 0) abilities.push(
        <ConfirmButton key="rs" className="ab-btn jester hot" confirmText="TAP AGAIN: RE-SPIN!" onConfirm={() => act('jester_respin', { round_id: round.id }).then(() => buzz(60)).catch(() => {})}>
          🔁 FORCE A RE-SPIN · {Math.ceil(left / 1000)}s<small>{sec.respins_left} LEFT TONIGHT</small></ConfirmButton>);
    }
  }
  if (sec?.role === 'jester' && settings.jester_graffiti && !sec.graffiti_used) {
    abilities.push(graffiti === null
      ? <button key="g" className="ab-btn jester" onClick={() => setGraffiti('')}>✍️ WHEEL GRAFFITI<small>ADD YOUR OWN PUNISHMENT · ONCE</small></button>
      : <div key="g" className="ab-form">
          <textarea className="p-input" maxLength={60} rows={2} placeholder="Your punishment (max 60)" value={graffiti} onChange={e => setGraffiti(e.target.value)} />
          <div className="row"><button className="p-btn ghost" onClick={() => setGraffiti(null)}>CANCEL</button>
            <ConfirmButton className="p-btn" disabled={graffiti.trim().length < 3} confirmText="SURE? TAP AGAIN" onConfirm={() => act('jester_graffiti', { text: graffiti }).then(() => { setGraffiti(null); toast('🃏 Your graffiti is on the wheel'); }).catch(() => {})}>SPRAY IT</ConfirmButton></div>
        </div>);
  }
  if (sec?.role === 'betrayer' && sec.guesses_left > 0 && !(sec.team?.length)) {
    abilities.push(<button key="b" className="ab-btn betrayer" onClick={() => setPicker({
      title: 'WHO IS THE INTRUDER?', exclude: [me.id, ...sec.guessed], confirm: 'ACCUSE',
      onPick: async p => {
        const r = await act('betrayer_guess', { player_id: p.id });
        setNotice(r.correct
          ? { title: "🤝 YOU'RE A TEAM NOW", sub: `${r.name} is the Intruder. You share their win. Act natural.`, tone: 'team' }
          : { title: '❌ WRONG', sub: `${p.name} isn't the Intruder. Take a penalty drink. (They weren't told.)`, tone: 'wrong' });
        try { if (r.correct) localStorage.setItem(teamKey, '1'); } catch { /* ignore */ }
      },
    })}>🐍 ACCUSE THE INTRUDER<small>{sec.guesses_left} GUESS{sec.guesses_left > 1 ? 'ES' : ''} LEFT · WRONG = DRINK</small></button>);
  }
  if (me.cursed) {
    abilities.push(s.me.pending_curse_pass
      ? <div key="c" className="ab-done">💀 Waiting for the host to approve your curse pass…</div>
      : <button key="c" className="ab-btn curse" onClick={() => setPicker({
          title: 'PASS THE CURSE TO… (someone you beat)', exclude: [me.id], confirm: 'PASS IT',
          onPick: p => act('request_curse_pass', { player_id: p.id }).then(() => toast('💀 Sent to the host for approval')),
        })}>💀 PASS THE CURSE<small>TO SOMEONE YOU BEAT · HOST APPROVES</small></button>);
  }

  if (picker) return <Picker state={s} {...picker} onClose={() => setPicker(null)} />;

  return (
    <div className="phone home">
      <header className="p-head">
        <Avatar url={me.selfie_url} name={me.name} />
        <div className="p-who"><b>{me.name}</b><span>🍺 {me.beers} · ☠ {me.punishments.length}{me.cursed ? ' · 💀' : ''}</span></div>
        <div className={'p-dot' + (room.connected ? ' on' : '')} title={room.connected ? 'Live' : 'Reconnecting'} />
      </header>

      {round && victim && (
        <div className="p-round">🎡 <b>{victim.id === me.id ? 'YOU' : victim.name}</b> {round.phase === 'waiting' ? (victim.id === me.id ? 'ARE' : 'IS') + ' FACING THE WHEEL' : round.phase === 'saved' ? 'WAS SAVED!' : '— WATCH THE TV'}</div>
      )}
      {s.room.ended && <div className="p-round ended">⏰ TIME'S UP — {s.room.result?.winner === 'group' ? 'THE GROUP WINS 🏆' : 'THE INTRUDER WINS 🗡️'}</div>}

      <button className="beer-btn" disabled={cooldown > 0 || beerBusy || s.room.ended} onClick={logBeer}>
        {cooldown > 0 ? <>🍺 NICE ONE<small>NEXT IN {Math.ceil(cooldown / 1000)}s</small></> : <>+1 I FINISHED A BEER<small>TALLY {s.room.tally} / {s.room.target}</small></>}
      </button>

      {abilities.some(Boolean) && <div className="abilities">{abilities}</div>}

      <RoleBox state={s} act={act} show={showRole} setShow={setShowRole} />

      <Reactions backend={backend} roomId={s.room.id} />
    </div>
  );
}

function RoleBox({ state, act, show, setShow }: { state: GameState; act: (a: string, x?: Record<string, unknown>) => Promise<any>; show: boolean; setShow: (b: boolean) => void }) {
  const sec = state.me.secret;
  const [code, setCode] = useState('');
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(false), 10000); return () => clearTimeout(t); }, [show, setShow]);
  if (!sec) {
    return (
      <form className="role-box enter" onSubmit={e => { e.preventDefault(); act('redeem', { code }).then(r => { setCode(''); setShow(true); toast(`🔓 Role unlocked`); void r; }).catch(() => {}); }}>
        <div className="p-label">🔑 ENTER YOUR ROLE CODE</div>
        <input className="p-input code6" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" autoCapitalize="characters" autoComplete="off" />
        <button className="p-btn" disabled={code.length < 6}>UNLOCK</button>
      </form>
    );
  }
  const R = ROLES[sec.role];
  if (!show) return <button className="role-box closed" onClick={() => setShow(true)}>🔒 TAP TO SEE YOUR ROLE<small>(hide your screen)</small></button>;
  return (
    <div className="role-box open" style={{ ['--rc' as any]: R.color }} onClick={() => setShow(false)}>
      <div className="rb-icon">{R.icon}</div>
      <div className="rb-name">{R.label.toUpperCase()}</div>
      <div className="rb-rules">{R.short}</div>
      <div className="rb-stats">
        {sec.role === 'medic' && <span>✚ {sec.heals_left} heal{sec.heals_left === 1 ? '' : 's'} left</span>}
        {sec.role === 'betrayer' && <span>🐍 {sec.guesses_left} guess{sec.guesses_left === 1 ? '' : 'es'} left</span>}
        {sec.role === 'intruder' && state.room.settings.intruder_fake_heal && <span>🩹 {sec.fake_heals_left} fake heal left</span>}
        {sec.role === 'jester' && <span>🔁 {sec.respins_left} re-spins · 🔀 swap {sec.swap_used ? 'used' : 'ready'} · ✍️ graffiti {sec.graffiti_used ? 'used' : 'ready'}</span>}
        {sec.role === 'lovebird' && <span>💘 {sec.partner ? <>Your partner: <b>{sec.partner.name}</b></> : 'Your partner hasn\'t unlocked their card yet'}</span>}
        {sec.team?.length ? <span>🤝 Team: <b>{sec.team.map(t => t.name).join(' & ')}</b></span> : null}
      </div>
      <div className="muted">tap to hide</div>
    </div>
  );
}

function Picker({ state, title, exclude, confirm, onPick, onClose }: { state: GameState; title: string; exclude: string[]; confirm: string; onPick: (p: Player) => Promise<void>; onClose: () => void }) {
  const [sel, setSel] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="phone takeover picker">
      <div className="to-kicker">{title}</div>
      <div className="p-grid">
        {state.players.filter(p => !exclude.includes(p.id)).map(p => (
          <button key={p.id} className={'p-pick' + (sel?.id === p.id ? ' sel' : '')} onClick={() => setSel(p)}><Avatar url={p.selfie_url} name={p.name} /><span>{p.name}</span></button>
        ))}
      </div>
      <div className="picker-actions">
        <button className="p-btn ghost" onClick={onClose}>CANCEL</button>
        <button className="p-btn" disabled={!sel || busy} onClick={async () => { if (!sel) return; setBusy(true); try { await onPick(sel); onClose(); } catch { setBusy(false); } }}>
          {sel ? `${confirm} ${sel.name.toUpperCase()}` : 'PICK SOMEONE'}</button>
      </div>
    </div>
  );
}

function Reactions({ backend, roomId }: { backend: Backend; roomId: string }) {
  const last = useRef(0);
  return (
    <div className="reactions">
      {REACTIONS.map(e => (
        <button key={e} onClick={() => {
          if (Date.now() - last.current < 350) return;
          last.current = Date.now();
          try { navigator.vibrate?.(15); } catch { /* ignore */ }
          backend.sendReaction(roomId, e);
        }}>{e}</button>
      ))}
    </div>
  );
}
