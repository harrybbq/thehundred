// The in-game phone screen. Full-screen takeovers (in priority order):
// notices (team / knife / rehab / cover blown) → Trial vote → SPIN (you're the victim).
// Otherwise: beer button, context-aware abilities, the confidential role file,
// evidence camera, and always-on reactions (so tapping is never a tell).
import { useEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import type { GameState, Player } from '../lib/types';
import { NO_TRIAL } from '../lib/types';
import { HIT_ROLES, PERKS, ROLES, TEAMS, levelFor, toNextLevel } from '../lib/roles';
import { compressImage } from '../lib/util';
import { ConfirmButton, Polaroid } from '../components/ui';
import { toast } from '../fx/effects';
import { Sound } from '../fx/sound';

type Room = { refresh: () => void; now: () => number; connected: boolean };
type Notice = { kicker?: string; title: string; sub: string; tone: 'team' | 'wrong' | 'knife' | 'rehab' | 'ok' };
type PickerCfg = { title: string; exclude: string[]; confirm: string; onPick: (p: Player) => Promise<void> };
const REACTIONS = ['🍺', '😈', '🙏', '😂'];
const RESPIN_WINDOW = 10000;
const READ_MS = 3000;

export function PhoneHome({ backend, state, room }: { backend: Backend; state: GameState; room: Room }) {
  const s = state, me = s.players.find(p => p.id === s.me.player_id)!;
  const sec = s.me.secret;
  const round = s.round;
  const victim = round ? s.players.find(p => p.id === round.victim_id) : null;
  const [picker, setPicker] = useState<null | PickerCfg>(null);
  const [hitTarget, setHitTarget] = useState<Player | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [notice, setNotice] = useState<null | Notice>(null);
  const [graffiti, setGraffiti] = useState<string | null>(null);
  const [evidence, setEvidence] = useState(false);
  const [readCheck, setReadCheck] = useState<null | { id: string; name: string }>(null);

  const act = async (action: string, args: Record<string, unknown> = {}) => {
    try { const r = await backend.api(action, { room_id: s.room.id, ...args }); room.refresh(); return r; }
    catch (e) { toast('⚠ ' + errText(e), 3500); throw e; }
  };
  const buzz = (ms = 20) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

  // ---------- one-time notices (survive refresh) ----------
  const once = (key: string, n: Notice) => {
    const k = `thehundred-${s.me.player_id}-${key}`;
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch { /* ignore */ }
    buzz(300); setNotice(n);
  };
  const allies = sec?.allies ?? [];
  useEffect(() => {
    if (!sec || !allies.length) return;
    const names = allies.map(a => a.name).join(' & ');
    once('allies-' + allies.map(a => a.id).sort().join(','), sec.role === 'betrayer'
      ? { kicker: 'YOU FOUND THEM', title: "YOU'RE GUILTY NOW", sub: `${names} is the Intruder. You win if the group falls short. You get no Intruder powers. Act natural.`, tone: 'team' }
      : { kicker: 'A NEW ACCOMPLICE', title: 'YOU HAVE A PARTNER', sub: `${names} is on your side now. You win together if the group falls short.`, tone: 'team' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allies.length]);
  useEffect(() => {
    if (sec?.has_knife && sec.role !== 'intruder') once('knife', { kicker: 'THE INTRUDER WAS CAUGHT', title: 'THE KNIFE IS YOURS', sub: "You're Guilty now: stop the group reaching the target. Name someone's secret role to blow their cover. One Hit per game, and your streak lasts until you guess wrong.", tone: 'knife' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec?.has_knife]);
  useEffect(() => {
    if (me.rehab) once('rehab', { kicker: 'CAUGHT', title: "YOU'RE IN REHAB", sub: 'Your powers are gone and you sit out the Trials. If the group hits the target, you still lose. Keep drinking.', tone: 'rehab' });
    else if (sec?.burned) once('burned', { kicker: 'THE KNIFE FOUND YOU', title: 'COVER BLOWN', sub: 'Everyone knows your role now, and your powers are burned. You can still drink, vote and find the Guilty.', tone: 'wrong' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.rehab, sec?.burned]);
  // Drink level up: tell them what their role just unlocked (once per level)
  const lvl = levelFor(me.beers);
  const perkRole = sec && (sec.has_knife && sec.role !== 'intruder' ? 'intruder' : sec.role);
  useEffect(() => {
    if (lvl < 2) return;
    const perk = perkRole ? PERKS[perkRole]?.[lvl - 1] : null;
    once('level-' + lvl, { kicker: `${me.beers} BEERS DOWN`, title: `LEVEL ${lvl}`, tone: 'ok',
      sub: perk && !(sec?.burned || me.rehab) ? `Your powers just got stronger: ${perk}.` : lvl === 3 ? 'Full power. Keep it up.' : 'Every beer you log makes your role stronger.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lvl]);
  // Forger: a heal has been written
  const prevForge = useRef(false);
  useEffect(() => { if (sec?.forge_ready && !prevForge.current) { buzz(120); } prevForge.current = !!sec?.forge_ready; }, [sec?.forge_ready]);

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
      <div className={'phone takeover notice ' + notice.tone} onClick={() => setNotice(null)}>
        {notice.kicker && <div className="to-kicker">{notice.kicker}</div>}
        <div className="to-title">{notice.title}</div><div className="to-sub">{notice.sub}</div><div className="muted to-close">tap to close</div>
      </div>
    );
  }
  if (evidence) return <EvidenceCam backend={backend} act={act} count={s.me.evidence_count} onClose={() => setEvidence(false)} />;
  const vote = s.vote;
  if (vote && vote.status === 'open' && !vote.my_choice && vote.options.includes(me.id) && !me.rehab) {
    const left = Math.max(0, Date.parse(vote.ends_at) - room.now());
    const cast = (id: string) => { buzz(); act('cast_vote', { vote_id: vote.id, choice_id: id }).catch(() => {}); };
    return (
      <div className="phone takeover vote">
        <div className="to-kicker">{vote.title.toUpperCase()}</div>
        <div className="to-timer">{Math.ceil(left / 1000)}s</div>
        <div className="to-hint">Who's Guilty? Wrong accusers drink.</div>
        {vote.kind === 'trial' && <button className="p-btn ghost" onClick={() => cast(NO_TRIAL)}>NO TRIAL. NOT SURE YET.</button>}
        <div className={'p-grid' + (vote.options.length > 10 ? ' many' : '')}>
          {s.players.filter(p => vote.options.includes(p.id) && p.id !== me.id).map(p => (
            <button key={p.id} className="p-pick" onClick={() => cast(p.id)}><Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} /></button>
          ))}
        </div>
        <Reactions backend={backend} roomId={s.room.id} />
      </div>
    );
  }
  if (myTurn) {
    return (
      <div className="phone takeover spin">
        <div className="to-kicker">{(round!.reason || 'PUNISHMENT TIME').toUpperCase()}</div>
        <div className="to-title">YOU'RE FACING<br />THE WHEEL</div>
        {me.cursed && <div className="to-curse">☠ CURSED: IT SPINS TWICE</div>}
        <div className="hazard">
          <div className="lid" /><div className="hinge" />
          <div className="box"><div className="plate">
            <button className="spin-btn" onClick={() => { Sound.unlock(); buzz(80); act('spin', { round_id: round!.id }).catch(() => {}); }}>SPIN</button>
          </div></div>
        </div>
        <Reactions backend={backend} roomId={s.room.id} />
      </div>
    );
  }
  if (hitTarget) {
    return (
      <div className="phone takeover picker">
        <div className="to-kicker">WHAT IS {hitTarget.name.toUpperCase()}?</div>
        <div className="to-hint">Right: their cover's blown and your streak lives. Wrong: your knife is blunt for the rest of the night{sec?.second_chance ? ' (but level 3 forgives one miss)' : ''}.{lvl >= 2 ? ' A miss still tells you if they\'re a Drinker.' : ''}</div>
        <div className="role-picks">
          {HIT_ROLES.map(r => (
            <ConfirmButton key={r} className="role-pick" confirmText={`SURE? ${ROLES[r].label.toUpperCase()}`}
              onConfirm={() => act('hit', { player_id: hitTarget.id, role: r }).then(res => {
                const who = hitTarget.name;
                setHitTarget(null);
                buzz(res.correct ? 200 : 600);
                const clue = res.drinkers === undefined ? '' : res.drinkers ? ` Clue: ${who} IS on the Drinkers team.` : ` Clue: ${who} is NOT on the Drinkers team.`;
                setNotice(res.correct
                  ? r === 'lovebird'
                    ? { kicker: 'DIRECT HIT', title: 'LOVEBIRDS OUTED', sub: `${who} and their partner are on the TV now, both in the punishment queue. Their real roles stay secret. Your knife stays sharp: another Hit after the next game.`, tone: 'knife' }
                    : { kicker: 'DIRECT HIT', title: 'COVER BLOWN', sub: `${who} was the ${ROLES[r].label}. Their powers are burned. Your knife stays sharp: another Hit after the next game.`, tone: 'knife' }
                  : res.second_chance
                    ? { kicker: 'MISSED', title: 'YOUR KNIFE HOLDS', sub: `${who} isn't the ${ROLES[r].label}. Level 3 forgives one miss: guess again.${clue}`, tone: 'knife' }
                    : { kicker: 'MISSED', title: 'YOUR KNIFE IS BLUNT', sub: `${who} isn't the ${ROLES[r].label}. Nobody was told. That's your last Hit tonight.${clue}`, tone: 'wrong' });
              }).catch(() => {})}>
              <span style={{ color: ROLES[r].color }}>{ROLES[r].label.toUpperCase()}</span>
            </ConfirmButton>
          ))}
        </div>
        <button className="p-btn ghost" onClick={() => setHitTarget(null)}>CANCEL</button>
      </div>
    );
  }
  if (picker) return <Picker state={s} {...picker} onClose={() => setPicker(null)} />;

  // ---------- abilities (context-aware) ----------
  const abilities: (JSX.Element | null)[] = [];
  const settings = s.room.settings;
  const waiting = round?.phase === 'waiting';
  const powerless = !sec || sec.burned || me.rehab;
  if (sec && !powerless) {
    // Medic: heal anyone, any time (not yourself)
    if (sec.role === 'medic' && sec.heals_left === 0) {
      const n = toNextLevel(me.beers);
      abilities.push(<div key="h0" className="ab-done">✚ {n ? `No heals left. Your next heal unlocks in ${n} beer${n === 1 ? '' : 's'}.` : 'No heals left tonight.'}</div>);
    }
    if (sec.role === 'medic' && sec.heals_left > 0) {
      const pending = new Set((sec.my_heals ?? []).filter(h => !h.used).map(h => h.name));
      if (round && victim && waiting && victim.id !== me.id && !pending.has(victim.name)) {
        abilities.push(<ConfirmButton key="hv" className="ab-btn heal" confirmText={`TAP AGAIN: HEAL ${victim.name.toUpperCase()}`}
          onConfirm={() => act('heal', { player_id: victim.id }).then(() => { buzz(60); toast('✚ Healed. Keep a straight face.'); }).catch(() => {})}>
          HEAL {victim.name.toUpperCase()}?<small>{sec.heals_left} LEFT · COVERS THEIR LOVEBIRD TOO</small></ConfirmButton>);
      }
      abilities.push(<button key="h" className="ab-btn heal ghosty" onClick={() => setPicker({
        title: 'WHO DO YOU HEAL?', exclude: [me.id], confirm: 'HEAL',
        onPick: p => act('heal', { player_id: p.id }).then(() => { buzz(60); toast(`✚ ${p.name} is covered for their next spin`); }),
      })}>✚ HEAL IN ADVANCE<small>{sec.heals_left} LEFT · THEIR NEXT SPIN IS CANCELLED</small></button>);
    }
    // Forger
    if (sec.role === 'forger' && !sec.forge_used) {
      abilities.push(sec.forge_ready
        ? <ConfirmButton key="fg" className="ab-btn forge" confirmText="TAP AGAIN: FORGE IT" onConfirm={() => act('forge').then(() => { buzz(80); toast('✒ Forged. Someone is in for a nasty surprise.'); }).catch(() => {})}>
            ✒ A HEAL HAS BEEN WRITTEN<small>FORGE IT · ONCE TONIGHT · YOU WON'T LEARN WHOSE</small></ConfirmButton>
        : <div key="fg" className="ab-done">✒ No heal to forge yet. Your phone will buzz when the Medic writes one.</div>);
    }
    if (sec.role === 'forger') {
      if (sec.frame_ready) abilities.push(<button key="fr" className="ab-btn frame" onClick={() => setPicker({
        title: 'WHO DO YOU FRAME?', exclude: [me.id], confirm: 'FRAME',
        onPick: p => act('frame', { player_id: p.id }).then(() => { buzz(60); toast(`✒ Evidence planted on ${p.name}. The Detective will read them as Guilty.`); }),
      })}>🗂 FRAME SOMEONE<small>ONCE · THE DETECTIVE'S NEXT CHECK ON THEM SAYS GUILTY</small></button>);
      else if (sec.frame) abilities.push(<div key="fr" className="ab-done">🗂 {sec.frame.spent ? `The Detective checked ${sec.frame.name}. Your frame worked.` : `${sec.frame.name} is framed. Waiting for the Detective.`}</div>);
    }
    // Detective
    if (sec.role === 'detective') {
      const check = sec.pending_check ?? readCheck;      // stays mounted while it's being read
      if (check) abilities.push(<HoldToRead key="dc" check={check} backend={backend} roomId={s.room.id}
        onStart={() => { setReadCheck(check); setTimeout(() => setReadCheck(null), 9000); }} />);
      else if (sec.checks_left > 0) abilities.push(<button key="dc" className="ab-btn detective" onClick={() => setPicker({
        title: 'INVESTIGATE WHO?', exclude: [me.id], confirm: 'INVESTIGATE',
        onPick: p => act('investigate', { player_id: p.id }).then(() => buzz(60)),
      })}>🔍 INVESTIGATE<small>{sec.checks_left} LEFT · LEVEL {lvl}: {lvl === 3 ? 'EXACT' : `VAGUE, ${4 - lvl} PEOPLE`}</small></button>);
      else abilities.push(<div key="dc" className="ab-done">🔍 No investigations left. You get another when the next game ends.</div>);
    }
    // Intruder / knife holder: the Hit
    if (sec.role === 'intruder' || sec.has_knife) {
      if (sec.hit_ready) abilities.push(<button key="hit" className="ab-btn hit" onClick={() => setPicker({
        title: 'WHOSE COVER DO YOU BLOW?', exclude: [me.id, ...s.players.filter(p => p.public_role).map(p => p.id)], confirm: 'NEXT',
        onPick: async p => { setHitTarget(p); },
      })}>🗡 THE HIT<small>NAME SOMEONE'S SECRET ROLE · ONE PER GAME{sec.second_chance ? ' · 1 MISS FORGIVEN' : ''}</small></button>);
      else if (sec.hit_alive) abilities.push(<div key="hit" className="ab-done">🗡 Knife sharpening. Your next Hit unlocks when the next game ends.</div>);
      else abilities.push(<div key="hit" className="ab-done dim">🗡 Your knife is blunt. No more Hits tonight.</div>);
    }
    // Betrayer: find the Intruder
    if (sec.role === 'betrayer' && !sec.has_knife && !allies.length && sec.guesses_left > 0) {
      abilities.push(<button key="b" className="ab-btn betrayer" onClick={() => setPicker({
        title: 'WHO IS THE INTRUDER?', exclude: [me.id, ...sec.guessed], confirm: 'ACCUSE',
        onPick: async p => {
          const r = await act('betrayer_guess', { player_id: p.id });
          if (!r.correct) setNotice({ kicker: 'WRONG', title: 'TAKE A DRINK', sub: `${p.name} isn't the Intruder. (They weren't told.)`, tone: 'wrong' });
        },
      })}>🐍 ACCUSE THE INTRUDER<small>{sec.guesses_left} GUESS{sec.guesses_left > 1 ? 'ES' : ''} LEFT · WRONG = DRINK</small></button>);
    }
    if (sec.role === 'betrayer' && sec.hint_ready) {
      abilities.push(<ConfirmButton key="bh" className="ab-btn betrayer" confirmText="TAP AGAIN: SHOW THE HINT"
        onConfirm={() => act('betrayer_hint').then(() => buzz(60)).catch(() => {})}>🕵 GET A HINT<small>LEVEL 3 · THE INTRUDER IS ONE OF 3 NAMES</small></ConfirmButton>);
    }
    if (sec.role === 'betrayer' && sec.hint && !sec.has_knife && !allies.length) {
      abilities.push(<div key="bh" className="ab-done">🕵 The Intruder is one of: <b>{sec.hint.join(', ')}</b></div>);
    }
    // Jester
    if (sec.role === 'jester' && round && victim) {
      if (settings.jester_swap && waiting && !sec.swap_used) {
        abilities.push(<button key="sw" className="ab-btn jester" onClick={() => setPicker({
          title: `SWAP ${victim.name.toUpperCase()} FOR…`, exclude: [victim.id], confirm: 'SWAP',
          onPick: p => act('jester_swap', { round_id: round.id, player_id: p.id }).then(() => { buzz(60); toast('🃏 Swapped!'); }),
        })}>🔀 SWAP THE VICTIM<small>{lvl === 3 ? 'TWO PER NIGHT AT LEVEL 3' : 'ONCE PER NIGHT (TWICE AT LEVEL 3)'}</small></button>);
      }
      if (settings.jester_respin && round.phase === 'revealed' && round.revealed_at && sec.respins_left > 0) {
        const left = Date.parse(round.revealed_at) + RESPIN_WINDOW - room.now();
        if (left > 0) abilities.push(
          <ConfirmButton key="rs" className="ab-btn jester hot" confirmText="TAP AGAIN: RE-SPIN!" onConfirm={() => act('jester_respin', { round_id: round.id }).then(() => buzz(60)).catch(() => {})}>
            🔁 FORCE A RE-SPIN · {Math.ceil(left / 1000)}s<small>{sec.respins_left} LEFT TONIGHT</small></ConfirmButton>);
      }
    }
    if (sec.role === 'jester' && settings.jester_graffiti && !sec.graffiti_used) {
      abilities.push(graffiti === null
        ? <button key="g" className="ab-btn jester" onClick={() => setGraffiti('')}>✍ WHEEL GRAFFITI<small>ADD YOUR OWN PUNISHMENT · ONCE</small></button>
        : <div key="g" className="ab-form">
            <textarea className="p-input" maxLength={60} rows={2} placeholder="Your punishment (max 60)" value={graffiti} onChange={e => setGraffiti(e.target.value)} />
            <div className="row"><button className="p-btn ghost" onClick={() => setGraffiti(null)}>CANCEL</button>
              <ConfirmButton className="p-btn" disabled={graffiti.trim().length < 3} confirmText="SURE? TAP AGAIN" onConfirm={() => act('jester_graffiti', { text: graffiti }).then(() => { setGraffiti(null); toast('🃏 Your graffiti is on the wheel'); }).catch(() => {})}>SPRAY IT</ConfirmButton></div>
          </div>);
    }
  }
  if (me.cursed) {
    abilities.push(s.me.pending_curse_pass
      ? <div key="c" className="ab-done">☠ Waiting for the host to approve your curse pass…</div>
      : <button key="c" className="ab-btn curse" onClick={() => setPicker({
          title: 'PASS THE CURSE TO… (someone you beat)', exclude: [me.id], confirm: 'PASS IT',
          onPick: p => act('request_curse_pass', { player_id: p.id }).then(() => toast('☠ Sent to the host for approval')),
        })}>☠ PASS THE CURSE<small>TO SOMEONE YOU BEAT · HOST APPROVES</small></button>);
  }

  const result = s.room.result;
  return (
    <div className="phone home">
      <header className="p-head">
        <Polaroid url={me.selfie_url} name={me.name} tilt="-3deg" />
        <div className="p-who"><b>{me.name.toUpperCase()}</b><span>{me.beers} BEER{me.beers === 1 ? '' : 'S'} · {me.punishments.length} PUN.{me.cursed ? ' · ☠' : ''}{me.rehab ? ' · REHAB' : ''}</span></div>
        <div className={'p-lvl l' + lvl} title="Drink level">LV{lvl}<small>{toNextLevel(me.beers) ? `+${toNextLevel(me.beers)}` : 'MAX'}</small></div>
        <div className={'p-dot' + (room.connected ? ' on' : '')} title={room.connected ? 'Live' : 'Reconnecting'} />
      </header>

      {round && !victim && <div className="p-round">THE WHOLE ROOM IS <b>SPINNING</b>. WATCH THE TV</div>}
      {round && victim && (
        <div className="p-round"><b>{victim.id === me.id ? 'YOU' : victim.name.toUpperCase()}</b> {round.phase === 'waiting' ? (victim.id === me.id ? 'ARE' : 'IS') + ' FACING THE WHEEL' : round.phase === 'saved' ? 'WAS SAVED' : 'IS SPINNING. WATCH THE TV'}</div>
      )}
      {s.room.ended && result && <div className="p-round ended">TIME'S UP · {result.winner === 'group' ? 'THE GROUP WINS' : 'THE GUILTY WIN'}</div>}

      <button className="beer-btn" disabled={cooldown > 0 || beerBusy || s.room.ended} onClick={logBeer}>
        {cooldown > 0 ? <>NICE ONE<small>NEXT IN {Math.ceil(cooldown / 1000)}s</small></> : <>+1 I FINISHED<br />A BEER<small>TALLY {s.room.tally} / {s.room.target}</small></>}
      </button>

      {abilities.some(Boolean) && <div className="abilities">{abilities}</div>}

      <RoleFile state={s} me={me} act={act} show={showRole} setShow={setShowRole} />

      <button className="ev-btn" onClick={() => setEvidence(true)}>📷 SUBMIT EVIDENCE<small>{s.me.evidence_count ? `${s.me.evidence_count} SENT · ` : ''}ANONYMOUS · SHOWN AT THE TRIAL</small></button>

      <Reactions backend={backend} roomId={s.room.id} />
    </div>
  );
}

// ---------- the confidential file ----------
function RoleFile({ state, me, act, show, setShow }: { state: GameState; me: Player; act: (a: string, x?: Record<string, unknown>) => Promise<any>; show: boolean; setShow: (b: boolean) => void }) {
  const sec = state.me.secret;
  const [code, setCode] = useState('');
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(false), 10000); return () => clearTimeout(t); }, [show, setShow]);
  if (!sec) {
    return (
      <form className="file closed enter" onSubmit={e => { e.preventDefault(); act('redeem', { code }).then(() => { setCode(''); setShow(true); }).catch(() => {}); }}>
        <div className="file-tab">FILE: {me.name.toUpperCase()}</div>
        <div className="p-label ink">ENTER THE CODE FROM YOUR CARD</div>
        <input className="p-input code6" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="ABC123" autoCapitalize="characters" autoComplete="off" />
        <button className="p-btn" disabled={code.length < 6}>OPEN MY FILE</button>
      </form>
    );
  }
  const R = ROLES[sec.role], T = TEAMS[sec.team];
  if (!show) {
    return (
      <button className="file closed" onClick={() => setShow(true)}>
        <div className="file-tab">FILE: {me.name.toUpperCase()}</div>
        <div className="conf">CONFIDENTIAL</div>
        <div className="f-tap">Tap to open your file</div>
        <div className="f-hint">(hide your screen)</div>
      </button>
    );
  }
  const heals = sec.my_heals ?? [];
  return (
    <div className="file-open" onClick={() => setShow(false)}>
      <div className="lamp" />
      <div className="dossier">
        <div className="d-head"><span>SUBJECT: {me.name.toUpperCase()}</span><span>FILE {state.room.target}/{String(me.seat).padStart(2, '0')}</span></div>
        <div className="d-role" style={{ color: R.color }}>{R.label.toUpperCase()}{sec.lovebird && <span className="d-love"> ♥ LOVEBIRD</span>}</div>
        <div className="d-team" style={{ ['--tc' as any]: T.color }}>TEAM: <b>{T.label}</b>{sec.role === 'betrayer' && sec.team === 'drinkers' ? ' (for now)' : ''}</div>
        <div className="d-text">{R.short}</div>
        <DrinkLevel role={sec.has_knife && sec.role !== 'intruder' ? 'intruder' : sec.role} beers={me.beers} />
        <div className="d-stats">
          {sec.burned && <span>✕ Cover blown. Powers burned.</span>}
          {me.rehab && <span>✕ In rehab. No powers, no vote.</span>}
          {sec.role === 'medic' && <span>✚ {sec.heals_left} heal{sec.heals_left === 1 ? '' : 's'} left{heals.length ? ` · written: ${heals.map(h => h.name + (h.used ? ' (used)' : '')).join(', ')}` : ''}</span>}
          {sec.role === 'forger' && <span>✒ Forgery {sec.forge_used ? 'used' : 'ready'} · 🗂 frame {sec.frame ? `on ${sec.frame.name}${sec.frame.spent ? ' (read)' : ''}` : sec.frame_ready ? 'ready' : 'used'}</span>}
          {sec.role === 'detective' && <span>🔍 {sec.checks_left} investigation{sec.checks_left === 1 ? '' : 's'} left{sec.checked?.length ? ` · checked: ${sec.checked.join(', ')}` : ''}</span>}
          {sec.role === 'betrayer' && !sec.has_knife && <span>🐍 {sec.guesses_left} guess{sec.guesses_left === 1 ? '' : 'es'} left</span>}
          {(sec.role === 'intruder' || sec.has_knife) && <span>🗡 {sec.has_knife && sec.role !== 'intruder' ? 'You hold the knife. ' : ''}{sec.hit_alive ? (sec.hit_ready ? 'Hit ready' : 'Next Hit after the next game') : 'Knife blunt'}</span>}
          {sec.role === 'jester' && <span>🔁 {sec.respins_left} re-spins · swap {sec.swap_used ? 'used' : 'ready'} · graffiti {sec.graffiti_used ? 'used' : 'ready'}</span>}
          {sec.lovebird && <span>♥ BONUS: LOVEBIRD · {sec.partner ? <>your partner is <b>{sec.partner.name}</b>. You share every punishment.</> : "your partner hasn't opened their file yet."}</span>}
          {sec.allies?.length ? <span>✦ On your side: <b>{sec.allies.map(t => t.name).join(' & ')}</b></span> : null}
        </div>
        <div className="d-foot">tap to hide · closes in 10s</div>
      </div>
    </div>
  );
}

// ---------- Detective: hold to read, three seconds, once ----------
function HoldToRead({ check, backend, roomId, onStart }: { check: { id: string; name: string }; backend: Backend; roomId: string; onStart: () => void }) {
  const [res, setRes] = useState<null | { guilty: boolean; name: string; group?: string[] }>(null);
  const [holding, setHolding] = useState(false);
  const [left, setLeft] = useState(READ_MS);
  const started = useRef(false), t0 = useRef(0), timer = useRef<ReturnType<typeof setInterval>>();
  const end = () => { setHolding(false); clearInterval(timer.current); if (started.current) setRes(null); };
  useEffect(() => () => clearInterval(timer.current), []);
  const down = async () => {
    setHolding(true);
    if (started.current) return;                       // burned already
    started.current = true;
    onStart();
    try {
      const r = await backend.api('view_check', { room_id: roomId, check_id: check.id });
      setRes(r); t0.current = Date.now(); setLeft(READ_MS);
      try { navigator.vibrate?.(40); } catch { /* ignore */ }
      timer.current = setInterval(() => { const l = READ_MS - (Date.now() - t0.current); setLeft(l); if (l <= 0) { clearInterval(timer.current); setRes(null); } }, 100);
    } catch (e) { toast('⚠ ' + errText(e)); setHolding(false); }
  };
  return (
    <button className={'ab-btn detective hold' + (holding ? ' down' : '')}
      onPointerDown={down} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} onContextMenu={e => e.preventDefault()}>
      {res && holding
        ? (res.group && res.group.length > 1
          ? <><span className={'verdict-stamp ' + (res.guilty ? 'g' : 'i')}>{res.guilty ? 'GUILTY' : 'INNOCENT'}</span>
              <small className="group-read">{res.guilty ? `ONE OF THESE ${res.group.length} IS GUILTY` : `NONE OF THESE ${res.group.length} ARE GUILTY`}:<br />{res.group.join(' · ').toUpperCase()} · {Math.max(0, Math.ceil(left / 1000))}s</small></>
          : <><span className={'verdict-stamp ' + (res.guilty ? 'g' : 'i')}>{res.guilty ? 'GUILTY' : 'INNOCENT'}</span><small>{res.name.toUpperCase()} · {Math.max(0, Math.ceil(left / 1000))}s</small></>)
        : started.current
          ? <>FILE BURNED<small>YOU'VE READ IT. IT'S GONE.</small></>
          : <>🔍 HOLD TO READ: {check.name.toUpperCase()}<small>3 SECONDS · ONCE · SHIELD YOUR SCREEN</small></>}
    </button>
  );
}

// ---------- Evidence camera ----------
function EvidenceCam({ backend, act, count, onClose }: { backend: Backend; act: (a: string, x?: Record<string, unknown>) => Promise<any>; count: number; onClose: () => void }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File | null) => {
    if (!f) return;
    try { const b = await compressImage(f, 900, 0.72, false); setPhoto(b); setPreview(URL.createObjectURL(b)); }
    catch { toast("Couldn't read that photo"); }
  };
  const send = async () => {
    if (!photo) return;
    setBusy(true);
    try {
      const url = await backend.uploadSelfie(photo);
      await act('submit_evidence', { image_url: url, caption });
      toast('Evidence filed. It goes up on the TV at the next Trial.');
      onClose();
    } catch (e) { toast('⚠ ' + errText(e)); setBusy(false); }
  };
  return (
    <div className="phone takeover evidence">
      <div className="to-kicker">SUBMIT EVIDENCE</div>
      <div className="to-hint">Caught someone hiding a beer or pouring one away? Snap it. It's pinned up anonymously during the next Trial.{count ? ` You've filed ${count}.` : ''}</div>
      <label className="ev-frame">
        {preview ? <img src={preview} alt="" /> : <span>📷<br />TAP TO SNAP</span>}
        <input type="file" accept="image/*" capture="environment" onChange={e => pick(e.target.files?.[0])} hidden />
      </label>
      <input className="p-input" placeholder="caption (optional)" maxLength={80} value={caption} onChange={e => setCaption(e.target.value)} />
      <div className="picker-actions">
        <button className="p-btn ghost" onClick={onClose}>CANCEL</button>
        <button className="p-btn" disabled={!photo || busy} onClick={send}>{busy ? 'FILING…' : 'FILE IT'}</button>
      </div>
    </div>
  );
}

// ---------- drink level ladder shown in the dossier ----------
function DrinkLevel({ role, beers }: { role: keyof typeof ROLES; beers: number }) {
  const lvl = levelFor(beers), perks = PERKS[role], next = toNextLevel(beers);
  return (
    <div className="d-level">
      <div className="d-lvl-head">DRINK LEVEL {lvl}{next ? ` · ${next} more beer${next === 1 ? '' : 's'} to level ${lvl + 1}` : ' · MAX'}</div>
      {perks && <ol>{perks.map((p, i) => <li key={i} className={i + 1 === lvl ? 'on' : i + 1 < lvl ? 'done' : ''}><b>{i === 0 ? '0–3' : i === 1 ? '4–7' : '8+'}</b> {p}</li>)}</ol>}
    </div>
  );
}

function Picker({ state, title, exclude, confirm, onPick, onClose }: PickerCfg & { state: GameState; onClose: () => void }) {
  const [sel, setSel] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="phone takeover picker">
      <div className="to-kicker">{title}</div>
      <div className="p-grid">
        {state.players.filter(p => !exclude.includes(p.id)).map(p => (
          <button key={p.id} className={'p-pick' + (sel?.id === p.id ? ' sel' : '')} onClick={() => setSel(p)}>
            <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} />
          </button>
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

