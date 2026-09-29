// The in-game phone screen. Full-screen takeovers (in priority order):
// notices (team / knife / rehab / cover blown) → Trial vote → SPIN (you're the victim).
// Otherwise: beer button, context-aware abilities, the confidential role file,
// evidence camera, and always-on reactions (so tapping is never a tell).
import { useEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import type { GameState, Player } from '../lib/types';
import { NO_TRIAL } from '../lib/types';
import { GameTakeover, MultiPicker, ThrowPicker, gameFor } from './PhoneGames';
import { EVOLVED, HIT_ROLES, PERKS, ROLES, TEAMS, levelFor, toNextLevel } from '../lib/roles';
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
  const [blessing, setBlessing] = useState(false);
  const [shame, setShame] = useState<null | { player: Player; caption: string }>(null);
  const [orders, setOrders] = useState(false);
  const [throwAt, setThrowAt] = useState<Player | null>(null);          // Assassin: Dodge
  const [multi, setMulti] = useState<null | { title: string; n: number; exclude: string[]; confirm: string; onPick: (ids: string[]) => Promise<void> }>(null);

  const act = async (action: string, args: Record<string, unknown> = {}) => {
    try { const r = await backend.api(action, { room_id: s.room.id, ...args }); room.refresh(); return r; }
    catch (e) {
      const busy = /^BUSY:(\d+)$/.exec(errText(e));
      if (busy) {                           // someone else's ability got the TV first; ours wasn't used
        buzz(200);
        setNotice({ kicker: 'TOO SLOW', title: 'SOMEONE BEAT YOU TO IT', tone: 'wrong',
          sub: `Another ability is playing on the TV right now. Yours wasn't used, so nothing's lost. Try again in ${busy[1]} seconds.` });
      } else toast('⚠ ' + errText(e), 3500);
      throw e;
    }
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
      ? { kicker: 'YOU FOUND THEM', title: "YOU'RE A SABOTEUR NOW", sub: `${names} is the Intruder. You win if the group falls short. You get no Intruder powers. Act natural.`, tone: 'team' }
      : { kicker: 'A NEW ACCOMPLICE', title: 'YOU HAVE A PARTNER', sub: `${names} is on your side now. You win together if the group falls short.`, tone: 'team' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allies.length]);
  useEffect(() => {
    if (sec?.has_knife && sec.role !== 'intruder') once('knife', { kicker: 'THE INTRUDER WAS CAUGHT', title: 'THE KNIFE IS YOURS', sub: "You're a Saboteur now: stop the group reaching the target. Name someone's secret role to blow their cover. One Hit per game, and your streak lasts until you guess wrong.", tone: 'knife' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec?.has_knife]);
  useEffect(() => {
    if (me.rehab) once('rehab', { kicker: 'CAUGHT', title: "YOU'RE IN REHAB", sub: 'Your powers are gone and you sit out the Trials. If the group hits the target, you still lose. Keep drinking.', tone: 'rehab' });
    else if (sec?.burned) once('burned', { kicker: 'THE KNIFE FOUND YOU', title: 'COVER BLOWN', sub: 'Everyone knows your role now, and your powers are burned. You can still drink, vote and find the Saboteurs.', tone: 'wrong' });
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
  // Evolutions (level 3; the Assassin once their target is in the dock)
  useEffect(() => {
    const ev = sec?.evolved;
    if (!ev || sec?.burned || me.rehab) return;
    const EV: Record<string, Notice> = {
      surgeon: { kicker: 'YOU EVOLVED', title: 'SURGEON', sub: 'You can heal yourself once, and nobody can forge your heals any more. (You keep 2 heals.)', tone: 'team' },
      dredd: { kicker: 'YOU EVOLVED', title: 'JUDGE DREDD', sub: 'I AM THE LAW. Once per game each: a Walk of Shame on the TV, and a secret Mark that doubles someone\'s next punishment. Your readings cover 2 people.', tone: 'team' },
      ninja: { kicker: 'YOU EVOLVED', title: 'NINJA', sub: 'Once per game, throw a silent shuriken: anyone you pick goes straight to the wheel, no dodging. The TV never shows who threw it.', tone: 'knife' },
      kraken: { kicker: 'YOU EVOLVED', title: 'THE KRAKEN', sub: 'Once per game, Walk the Plank: pick 3 players and they inch along a plank on their phones. Whoever lands furthest from the edge, or goes overboard, drinks.', tone: 'team' },
      gobshite: { kicker: 'YOU EVOLVED', title: 'THE GOBSHITE', sub: 'Every beer you log now secretly counts TRIPLE for the team. Keep it quiet.', tone: 'team' },
      pennywise: { kicker: 'YOU EVOLVED', title: 'PENNYWISE', sub: 'Once per game, Jack-in-the-Box: 4 players take turns cranking it on their phones. Whoever makes it pop drinks. We all float down here.', tone: 'knife' },
      oathbreaker: { kicker: 'YOU EVOLVED', title: 'OATHBREAKER', sub: 'Once per game, Forged Orders: pick a punishment waiting in the queue and rewrite the name on it. The TV never says who.', tone: 'knife' },
    };
    if (EV[ev]) once('evolved-' + ev, EV[ev]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec?.evolved]);
  const locked = !!me.locked_until && Date.parse(me.locked_until) > room.now();
  useEffect(() => {
    if (locked) once('locked-' + me.locked_until, { kicker: 'ARRR', title: "DAVY JONES' LOCKER", sub: 'You\'re sleeping with the fishes: no punishments (one can wait for you), no powers, no vote. Drink some water.', tone: 'ok' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);
  // Forger: a heal has been written
  const prevForge = useRef(false);
  useEffect(() => { if (sec?.forge_ready && !prevForge.current) { buzz(120); } prevForge.current = !!sec?.forge_ready; }, [sec?.forge_ready]);

  // buzz when it's my turn
  const myTurn = round?.phase === 'waiting' && round.victim_id === me.id;
  const prevTurn = useRef(false);
  useEffect(() => { if (myTurn && !prevTurn.current) buzz(400); prevTurn.current = myTurn; }, [myTurn]);

  // ---------- beer ----------
  const stageLeft = s.room.ability_until ? Math.max(0, Date.parse(s.room.ability_until) - room.now()) : 0;
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
  // a mini-game you're in takes the whole phone
  const mg = gameFor(s, me.id, room.now());
  if (mg) return <GameTakeover s={s} g={mg} me={me} act={act} clock={room.now} />;
  if (evidence) return <EvidenceCam backend={backend} act={act} count={s.me.evidence_count} onClose={() => setEvidence(false)} />;
  const vote = s.vote;
  if (vote && vote.status === 'open' && !vote.my_choice && vote.options.includes(me.id) && !me.rehab && !locked && me.public_role !== 'angel') {
    const left = Math.max(0, Date.parse(vote.ends_at) - room.now());
    const cast = (id: string) => { buzz(); act('cast_vote', { vote_id: vote.id, choice_id: id }).catch(() => {}); };
    return (
      <div className="phone takeover vote">
        <div className="to-kicker">{vote.title.toUpperCase()}</div>
        <div className="to-timer">{Math.ceil(left / 1000)}s</div>
        <div className="to-hint">Who's a Saboteur? Wrong accusers drink.</div>
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
  // JESTER convicted at the Trial: pick one of your accusers for a ×3 punishment
  const jo = vote?.outcome;
  if (vote && vote.status === 'closed' && jo?.result === 'jester' && jo.accused === me.id && !jo.revenge) {
    const accusers = s.players.filter(p => (jo.accusers ?? []).includes(p.id));
    return (
      <div className="phone takeover vote jester">
        <div className="to-kicker">🃏 THEY FELL FOR IT</div>
        <div className="to-title">JESTER'S<br />REVENGE</div>
        <div className="to-hint">Pick one of the people who voted for you. They take a ×3 punishment.</div>
        <div className={'p-grid' + (accusers.length > 10 ? ' many' : '')}>
          {accusers.map(p => (
            <ConfirmButton key={p.id} className="p-pick" confirmText={`${p.name.toUpperCase()}? TAP AGAIN`}
              onConfirm={() => act('jester_revenge', { vote_id: vote.id, player_id: p.id }).then(() => { buzz(120); toast(`🃏 ${p.name} takes the ×3`); }).catch(() => {})}>
              <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} /></ConfirmButton>
          ))}
        </div>
      </div>
    );
  }
  // AARON'S PLATE: grab a sausage (only the TV shows which one is lying sideways)
  const plate = s.plate;
  if (plate && plate.status === 'open' && plate.eaters.includes(me.id) && plate.picks[me.id] === undefined && Date.parse(plate.ends_at) > room.now() - 1500) {
    const taken = new Map(Object.entries(plate.picks).map(([pid, i]) => [i, s.players.find(p => p.id === pid)?.name ?? '?']));
    return (
      <div className="phone takeover bbq">
        <div className="to-kicker">🌭 AARON'S PLATE · {Math.max(0, Math.ceil((Date.parse(plate.ends_at) - room.now()) / 1000))}s</div>
        <div className="to-title">GRAB A<br />SAUSAGE</div>
        <div className="to-hint">One of them fell on the balcony. <b>Look at the TV.</b> Aaron swears it's fine.</div>
        <div className="bbq-picks">
          {Array.from({ length: plate.n }, (_, i) => (
            <button key={i} className="bbq-pick" disabled={taken.has(i)}
              onClick={() => { buzz(40); act('bbq_pick', { plate_id: plate.id, index: i }).then(() => toast(`🌭 Sausage #${i + 1}. Bon appétit.`)).catch(() => {}); }}>
              <span className="n">#{i + 1}</span><span className="sz" />{taken.has(i) && <small>{taken.get(i)}</small>}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (myTurn) {
    return (
      <div className="phone takeover spin">
        <div className="to-kicker">{(round!.reason || 'PUNISHMENT TIME').toUpperCase()}</div>
        <div className="to-title">YOU'RE FACING<br />THE WHEEL</div>
        {me.cursed && <div className="to-curse">☠ CURSED: IT SPINS TWICE</div>}
        {round!.times > 1 && <div className="to-curse">{round!.reason === "Jester's revenge" ? "🃏 JESTER'S REVENGE" : '⚖ MARKED'}: EVERYTHING ×{round!.times}</div>}
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
        <div className="to-hint">Right: their cover's blown and your streak lives. Wrong: your knife is blunt for the rest of the night.{lvl >= 2 ? ' A miss still tells you if they\'re a Drinker.' : ''}</div>
        <div className="role-picks">
          {HIT_ROLES.map(r => (
            <ConfirmButton key={r} className="role-pick" confirmText={`SURE? ${ROLES[r].label.toUpperCase()}`}
              onConfirm={() => act('hit', { player_id: hitTarget.id, role: r }).then(res => {
                const who = hitTarget.name;
                setHitTarget(null);
                buzz(res.correct ? 200 : 600);
                const clue = res.drinkers === undefined ? '' : res.drinkers ? ` Clue: ${who} IS on the Drinkers team.` : ` Clue: ${who} is NOT on the Drinkers team.`;
                setNotice(res.correct
                  ? { kicker: 'DIRECT HIT', title: 'COVER BLOWN', sub: `${who} was the ${ROLES[r].label}. Their powers are burned. Your knife stays sharp: another Hit after the next game.`, tone: 'knife' }
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
  if (blessing) {
    return (
      <div className="phone takeover picker">
        <div className="to-kicker">😇 BLESS THE WHEEL</div>
        <div className="to-hint">The punishment you bless turns into SAFE for the rest of the night. (Not the Scrooge's graffiti.)</div>
        <div className="bless-list">
          {s.room.segments.map((t, i) => /^\s*safe\b/i.test(t) ? null : (
            <ConfirmButton key={i} className="p-btn ghost" confirmText={`BLESS “${t.toUpperCase()}”?`}
              onConfirm={() => act('angel_bless', { index: i }).then(() => { setBlessing(false); buzz(80); toast('😇 Blessed. It\'s SAFE now.'); }).catch(() => {})}>{t}</ConfirmButton>
          ))}
        </div>
        <button className="p-btn ghost" onClick={() => setBlessing(false)}>CANCEL</button>
      </div>
    );
  }
  if (throwAt) return <ThrowPicker target={throwAt} onClose={() => setThrowAt(null)}
    onThrow={dir => act('dodge_throw', { player_id: throwAt.id, dir }).then(() => { buzz(80); toast(`✴ Thrown. ${throwAt.name} is being called to the TV.`); })} />;
  if (multi) return <MultiPicker state={s} {...multi} onClose={() => setMulti(null)} />;
  if (orders) {
    const nameOf = (id: string) => s.players.find(p => p.id === id)?.name ?? '?';
    return (
      <div className="phone takeover picker">
        <div className="to-kicker">🖋 FORGED ORDERS · WHICH PUNISHMENT?</div>
        <div className="to-hint">Pick a punishment waiting in the queue. Next you choose whose name goes on it. The TV shows the ink change, never who did it.</div>
        <div className="p-grid">
          {s.queue.map(q => (
            <button key={q.id} className="p-pick" onClick={() => {
              setOrders(false);
              setPicker({
                title: `${nameOf(q.player_id).toUpperCase()}'S "${q.reason.toUpperCase()}" GOES TO…`,
                exclude: [q.player_id, ...s.players.filter(p => p.locked_until || p.public_role === 'angel').map(p => p.id)], confirm: 'FORGE IT',
                onPick: p => act('forged_orders', { queue_id: q.id, player_id: p.id }).then(() => { buzz(80); toast(`🖋 Signed, sealed: ${p.name} takes it now.`); }),
              });
            }}><b>{nameOf(q.player_id)}</b><small>{q.reason}{q.times > 1 ? ` ×${q.times}` : ''}</small></button>
          ))}
        </div>
        <button className="p-btn ghost" onClick={() => setOrders(false)}>CANCEL</button>
      </div>
    );
  }
  if (shame) {
    return (
      <div className="phone takeover picker">
        <div className="to-kicker">⚖ WALK OF SHAME · {shame.player.name.toUpperCase()}</div>
        <div className="to-hint">Write the caption the TV shows under their photo. They drink.</div>
        <textarea className="p-input" maxLength={60} rows={2} placeholder="e.g. Spilled a whole pint" value={shame.caption} onChange={e => setShame({ ...shame, caption: e.target.value })} />
        <div className="row">
          <button className="p-btn ghost" onClick={() => setShame(null)}>CANCEL</button>
          <ConfirmButton className="p-btn" disabled={shame.caption.trim().length < 3} confirmText="SHAME THEM? TAP AGAIN"
            onConfirm={() => act('dredd_shame', { player_id: shame.player.id, caption: shame.caption }).then(() => { setShame(null); buzz(120); }).catch(() => {})}>SHAME!</ConfirmButton>
        </div>
      </div>
    );
  }

  // ---------- abilities (context-aware) ----------
  const abilities: (JSX.Element | null)[] = [];
  const settings = s.room.settings;
  const waiting = round?.phase === 'waiting';
  const powerless = !sec || sec.burned || me.rehab || locked;
  if (sec && !powerless) {
    // Medic: heal anyone, any time (not yourself)
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
      })}>✚ HEAL IN ADVANCE<small>{sec.heals_left} LEFT · THEIR NEXT SPIN IS CANCELLED{sec.evolved === 'surgeon' ? ' · CAN\'T BE FORGED' : ''}</small></button>);
    }
    if (sec.role === 'medic' && sec.self_heal_ready) {
      abilities.push(<ConfirmButton key="hs" className="ab-btn heal" confirmText="TAP AGAIN: HEAL YOURSELF"
        onConfirm={() => act('heal', { player_id: me.id }).then(() => { buzz(60); toast('✚ Scrubbed in. Your next spin is cancelled.'); }).catch(() => {})}>
        🩺 SURGEON: HEAL YOURSELF<small>ONCE · CAN'T BE FORGED</small></ConfirmButton>);
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
        onPick: p => act('frame', { player_id: p.id }).then(() => { buzz(60); toast(`✒ Evidence planted on ${p.name}. The Detective will read them as a Saboteur.`); }),
      })}>🗂 FRAME SOMEONE<small>ONCE · THE DETECTIVE'S NEXT CHECK ON THEM SAYS SABOTEUR</small></button>);
    }
    // Detective
    if (sec.role === 'detective') {
      const check = sec.pending_check ?? readCheck;      // stays mounted while it's being read
      if (check) abilities.push(<HoldToRead key="dc" check={check} backend={backend} roomId={s.room.id}
        onStart={() => { setReadCheck(check); setTimeout(() => setReadCheck(null), 9000); }} />);
      else if (sec.checks_left > 0) abilities.push(<button key="dc" className="ab-btn detective" onClick={() => setPicker({
        title: 'INVESTIGATE WHO?', exclude: [me.id], confirm: 'INVESTIGATE',
        onPick: p => act('investigate', { player_id: p.id }).then(() => buzz(60)),
      })}>🔍 INVESTIGATE<small>{sec.checks_left} LEFT · LEVEL {lvl}: {lvl === 1 ? 'VAGUE, 3 PEOPLE' : '2 PEOPLE'}</small></button>);
      // Judge Dredd (level 3)
      if (sec.evolved === 'dredd') {
        if (sec.shame_ready) abilities.push(<button key="sh" className="ab-btn dredd" onClick={() => setPicker({
          title: 'WHO TAKES THE WALK OF SHAME?', exclude: [me.id, ...s.players.filter(p => p.locked_until || p.public_role === 'angel').map(p => p.id)], confirm: 'NEXT',
          onPick: async p => { setShame({ player: p, caption: '' }); },
        })}>⚖ WALK OF SHAME<small>ONCE PER GAME · ON THE TV, WITH YOUR CAPTION</small></button>);
        if (sec.mark_ready) abilities.push(<button key="mk" className="ab-btn dredd" onClick={() => setPicker({
          title: 'WHO DO YOU MARK?', exclude: [me.id, ...s.players.filter(p => p.public_role === 'angel').map(p => p.id)], confirm: 'MARK',
          onPick: p => act('dredd_mark', { player_id: p.id }).then(() => { buzz(60); toast(`⚖ ${p.name} is marked. Their next punishment counts double.`); }),
        })}>🎯 THE MARK<small>ONCE PER GAME · SECRET · THEIR NEXT PUNISHMENT ×2</small></button>);
      }
    }
    // Davy Jones: lock someone up to protect them
    if (sec.role === 'davyjones' && sec.lock_ready) {
      abilities.push(<button key="dj" className="ab-btn davy" onClick={() => setPicker({
            title: `DRAG WHO TO THE LOCKER? (${sec.lock_minutes} MIN)`, exclude: [me.id, ...s.players.filter(p => p.locked_until || p.public_role === 'angel').map(p => p.id)], confirm: 'LOCK UP',
            onPick: p => act('davy_lock', { player_id: p.id }).then(() => { buzz(80); toast(`⚓ ${p.name} is sleeping with the fishes`); }),
          })}>⚓ DAVY JONES' LOCKER<small>ONCE PER GAME · {sec.lock_minutes} MIN · SAFE FROM THE WHEEL, BUT NO POWERS</small></button>);
    }
    // Assassin (below level 3): Dodge
    if (sec.role === 'assassin' && sec.dodge_ready) {
      abilities.push(<button key="dg" className="ab-btn ninja" onClick={() => setPicker({
        title: 'THROW AT WHO?', exclude: [me.id, ...s.players.filter(p => p.locked_until || p.public_role === 'angel').map(p => p.id)], confirm: 'NEXT',
        onPick: async p => { setThrowAt(p); },
      })}>✴ DODGE<small>ONCE PER GAME · THEY'RE CALLED TO THE TV AND GUESS WHERE IT'S COMING FROM</small></button>);
    }
    // The Kraken: Walk the Plank
    if (sec.role === 'davyjones' && sec.plank_ready) {
      abilities.push(<button key="pk" className="ab-btn davy" onClick={() => setMulti({
        title: 'WHO WALKS THE PLANK?', n: 3, exclude: [me.id, ...s.players.filter(p => p.locked_until || p.public_role === 'angel').map(p => p.id)], confirm: 'MAKE THEM WALK',
        onPick: ids => act('plank_start', { player_ids: ids }).then(() => { buzz(80); toast('🏴‍☠️ They\'re being called to the TV'); }),
      })}>🏴‍☠️ WALK THE PLANK<small>ONCE PER GAME · PICK 3 · FURTHEST FROM THE EDGE DRINKS</small></button>);
    }
    // Pennywise: Jack-in-the-Box (you can put yourself in it)
    if (sec.role === 'jester' && sec.jack_ready) {
      abilities.push(<button key="jk" className="ab-btn jester" onClick={() => setMulti({
        title: 'WHO PLAYS JACK-IN-THE-BOX?', n: 4, exclude: s.players.filter(p => p.locked_until || p.public_role === 'angel').map(p => p.id), confirm: 'WIND IT UP',
        onPick: ids => act('jack_start', { player_ids: ids }).then(() => { buzz(80); toast('🤡 They\'re being called to the TV'); }),
      })}>🤡 JACK-IN-THE-BOX<small>ONCE PER GAME · PICK 4 · WHOEVER POPS IT DRINKS</small></button>);
    }
    // The Intruder / knife holder at level 3: the bomb
    if (sec.bomb_ready) {
      abilities.push(<ConfirmButton key="bm" className="ab-btn hit" confirmText="TAP AGAIN: LIGHT THE FUSE"
        onConfirm={() => act('bomb_start').then(() => buzz(120)).catch(() => {})}>💣 THE BOMB<small>ONCE PER GAME · A HOT POTATO ON EVERY PHONE · SECRET FUSE</small></ConfirmButton>);
    }
    // The Scrooge at level 3: Penny Drop
    if (sec.role === 'scrooge' && sec.penny_ready) {
      abilities.push(<ConfirmButton key="pd" className="ab-btn scrooge" confirmText="TAP AGAIN: FLIP IT"
        onConfirm={() => act('penny_start').then(() => buzz(80)).catch(() => {})}>🪙 PENNY DROP<small>ONCE PER GAME · EVERYONE CALLS YOUR COIN · WRONG ONES DRINK</small></ConfirmButton>);
    }
    // Ninja (the Assassin at level 3)
    if (sec.role === 'assassin' && sec.strike_ready) {
      abilities.push(<button key="nj" className="ab-btn ninja" onClick={() => setPicker({
        title: 'THROW THE SHURIKEN AT WHO?', exclude: [me.id, ...s.players.filter(p => p.public_role === 'angel').map(p => p.id)], confirm: 'THROW',
        onPick: p => act('ninja_strike', { player_id: p.id }).then(() => { buzz(80); toast(`✴ ${p.name} is off to the wheel. Nobody saw a thing.`); }),
      })}>✴ SHURIKEN<small>ONCE PER GAME · SILENT · STRAIGHT TO THE WHEEL</small></button>);
    }
    // Oathbreaker (the Forger at level 3): Forged Orders
    if (sec.role === 'forger' && sec.orders_ready) {
      abilities.push(s.queue.length
        ? <button key="fo" className="ab-btn forge" onClick={() => setOrders(true)}>🖋 FORGED ORDERS<small>ONCE PER GAME · REWRITE THE NAME ON A WAITING PUNISHMENT</small></button>
        : <div key="fo" className="ab-done">🖋 Forged Orders ready: nothing is waiting in the queue yet.</div>);
    }
    // Skank: Aaron's Plate
    if (sec.role === 'skank' && sec.bbq_ready) {
      abilities.push(<ConfirmButton key="bbq" className="ab-btn bbq" confirmText="TAP AGAIN: FIRE UP THE BBQ"
        onConfirm={() => act('bbq_start').then(() => buzz(80)).catch(() => {})}>🌭 AARON'S PLATE<small>ONCE PER GAME · EVERYONE GRABS A SAUSAGE · ONE IS DIRTY</small></ConfirmButton>);
    }
    // Intruder / knife holder: the Hit
    if (sec.role === 'intruder' || sec.has_knife) {
      if (sec.hit_ready) abilities.push(<button key="hit" className="ab-btn hit" onClick={() => setPicker({
        title: 'WHOSE COVER DO YOU BLOW?', exclude: [me.id, ...s.players.filter(p => p.public_role).map(p => p.id)], confirm: 'NEXT',
        onPick: async p => { setHitTarget(p); },
      })}>🗡 THE HIT<small>NAME SOMEONE'S SECRET ROLE · ONE PER GAME</small></button>);
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
    // Scrooge
    if (sec.role === 'scrooge' && round && victim) {
      if (settings.scrooge_swap && waiting && !sec.swap_used) {
        abilities.push(<button key="sw" className="ab-btn scrooge" onClick={() => setPicker({
          title: `SWAP ${victim.name.toUpperCase()} FOR…`, exclude: [victim.id], confirm: 'SWAP',
          onPick: p => act('scrooge_swap', { round_id: round.id, player_id: p.id }).then(() => { buzz(60); toast('🎩 Swapped!'); }),
        })}>🔀 SWAP THE VICTIM<small>{lvl === 3 ? 'TWO PER NIGHT AT LEVEL 3' : 'ONCE PER NIGHT (TWICE AT LEVEL 3)'}</small></button>);
      }
      if (settings.scrooge_respin && round.phase === 'revealed' && round.revealed_at && sec.respins_left > 0) {
        const left = Date.parse(round.revealed_at) + RESPIN_WINDOW - room.now();
        if (left > 0) abilities.push(
          <ConfirmButton key="rs" className="ab-btn scrooge hot" confirmText="TAP AGAIN: RE-SPIN!" onConfirm={() => act('scrooge_respin', { round_id: round.id }).then(() => buzz(60)).catch(() => {})}>
            🔁 FORCE A RE-SPIN · {Math.ceil(left / 1000)}s<small>{sec.respins_left} LEFT TONIGHT</small></ConfirmButton>);
      }
    }
    if (sec.role === 'scrooge' && settings.scrooge_graffiti && !sec.graffiti_used) {
      abilities.push(graffiti === null
        ? <button key="g" className="ab-btn scrooge" onClick={() => setGraffiti('')}>✍ WHEEL GRAFFITI<small>ADD YOUR OWN PUNISHMENT · ONCE</small></button>
        : <div key="g" className="ab-form">
            <textarea className="p-input" maxLength={60} rows={2} placeholder="Your punishment (max 60)" value={graffiti} onChange={e => setGraffiti(e.target.value)} />
            <div className="row"><button className="p-btn ghost" onClick={() => setGraffiti(null)}>CANCEL</button>
              <ConfirmButton className="p-btn" disabled={graffiti.trim().length < 3} confirmText="SURE? TAP AGAIN" onConfirm={() => act('scrooge_graffiti', { text: graffiti }).then(() => { setGraffiti(null); toast('🎩 Your graffiti is on the wheel'); }).catch(() => {})}>SPRAY IT</ConfirmButton></div>
          </div>);
    }
  }
  if (sec?.role === 'angel' && !locked) {
    if (sec.nova_ready) abilities.push(<ConfirmButton key="nv" className="ab-btn angel" confirmText="TAP AGAIN: HOLY NOVA!" onConfirm={() => act('holy_nova').then(() => buzz(200)).catch(() => {})}>
          ✨ HOLY NOVA<small>+{sec.nova_beers} BEERS FOR THE GROUP · ONCE A NIGHT</small></ConfirmButton>);
    else if (!sec.nova_used) abilities.push(<div key="nv" className="ab-done">✨ Holy Nova can't finish the job: it only works while the tally is more than {sec.nova_beers} short.</div>);
    if (sec.bless_ready) abilities.push(<button key="bl" className="ab-btn angel" onClick={() => setBlessing(true)}>😇 BLESS THE WHEEL<small>ONE PUNISHMENT BECOMES SAFE · FOR GOOD</small></button>);
  }
  if (sec?.role === 'skank') {
    abilities.push(<div key="sk" className="ab-done">🧌 Every beer you log counts {sec.level >= 3 ? 'triple' : 'double'} for the team. Hidden bonus so far: <b>+{sec.skank_bonus ?? 0}</b>{sec.burned ? ' (frozen: your cover is blown)' : ''}. It's added when time runs out.</div>);
  }
  if (sec?.role === 'jester' && me.public_role !== 'jester' && !sec.burned) {
    abilities.push(<div key="jr" className="ab-done">🃏 Act shifty. If a Trial convicts you, you pick one of your accusers to take a ×3 punishment.</div>);
  }
  if (locked) {
    abilities.unshift(<div key="lk" className="ab-done locker">⚓ You're in Davy Jones' Locker until <b>{new Date(me.locked_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>. No punishments{me.held ? ' (one is waiting for you)' : ''}, no powers, no vote. Rest up.</div>);
  } else if (me.public_role !== 'angel' && sec) {
    abilities.push(me.lock_requested
      ? <div key="lk" className="ab-done">⚓ Asked the host for a rest in Davy Jones' Locker…</div>
      : <ConfirmButton key="lk" className="ab-btn davy ghosty" confirmText="TAP AGAIN: ASK THE HOST" onConfirm={() => act('request_lock').then(() => toast('⚓ Sent to the host')).catch(() => {})}>
          ⚓ TOO PISHED? DAVY JONES' LOCKER<small>ASK THE HOST FOR A REST · NO PUNISHMENTS, NO POWERS</small></ConfirmButton>);
  }
  if (me.cursed && !locked) {
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
      {s.room.ended && result && <div className="p-round ended">TIME'S UP · {result.winner === 'group' ? 'THE GROUP WINS' : 'THE SABOTEURS WIN'}</div>}

      <button className="beer-btn" disabled={cooldown > 0 || beerBusy || s.room.ended} onClick={logBeer}>
        {cooldown > 0 ? <>NICE ONE<small>NEXT IN {Math.ceil(cooldown / 1000)}s</small></> : <>+1 I FINISHED<br />A BEER<small>TALLY {s.room.tally} / {s.room.target}</small></>}
      </button>

      {abilities.some(Boolean) && <div className="abilities">
        {stageLeft > 0 && <div className="ab-busy">📺 Someone's ability is on the TV. Yours can go in <b>{Math.ceil(stageLeft / 1000)}s</b></div>}
        {abilities}
      </div>}

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
        <div className="d-role" style={{ color: R.color }}>{sec.evolved ? EVOLVED[sec.evolved] : R.label.toUpperCase()}{sec.lovebird && <span className="d-love"> ♥ LOVEBIRD</span>}{me.cursed && <span className="d-love curse"> ☠ CURSED</span>}</div>
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
          {sec.role === 'skank' && <span>🧌 Hidden bonus: +{sec.skank_bonus ?? 0} beers</span>}
          {sec.role === 'jester' && <span>🃏 Revenge {me.public_role === 'jester' || sec.burned ? 'spent' : 'waiting for a conviction'}</span>}
          {sec.evolved && <span>✦ Evolved from the {R.label}: {PERKS[sec.role]?.[2] ?? ''}</span>}
          {sec.role === 'davyjones' && <span>⚓ {sec.prisoner
            ? <><b>{sec.prisoner.name}</b> is in your Locker until {new Date(sec.prisoner.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. One prisoner at a time.</>
            : `Lock ${sec.lock_ready ? `ready (${sec.lock_minutes} min)` : 'used this game'}`}</span>}
          {sec.role === 'forger' && sec.evolved === 'oathbreaker' && <span>🖋 Forged Orders {sec.orders_ready ? 'ready' : 'used this game'}</span>}
          {sec.role === 'angel' && <span>✨ Holy Nova {sec.nova_used ? 'spent' : 'ready'} · 😇 blessing {sec.bless_ready ? 'ready' : 'used'}</span>}
          {sec.role === 'skank' && <span>🌭 Aaron's Plate {sec.bbq_ready ? 'ready' : 'used this game'}</span>}
          {sec.role === 'scrooge' && <span>🔁 {sec.respins_left} re-spins · swap {sec.swap_used ? 'used' : 'ready'} · graffiti {sec.graffiti_used ? 'used' : 'ready'}</span>}
          {sec.lovebird && <span>♥ MODIFIER: LOVEBIRD · {sec.partner ? <>your partner is <b>{sec.partner.name}</b>. You share every punishment.</> : "your partner hasn't opened their file yet."}</span>}
          {me.cursed && <span>☠ MODIFIER: CURSED · everyone sees the skull, not your role. Your spins are doubled. Beat someone in a game to pass it on.</span>}
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
          ? <><span className={'verdict-stamp ' + (res.guilty ? 'g' : 'i')}>{res.guilty ? 'SABOTEUR' : 'INNOCENT'}</span>
              <small className="group-read">{res.guilty ? `ONE OF THESE ${res.group.length} IS A SABOTEUR` : `NONE OF THESE ${res.group.length} IS A SABOTEUR`}:<br />{res.group.join(' · ').toUpperCase()} · {Math.max(0, Math.ceil(left / 1000))}s</small></>
          : <><span className={'verdict-stamp ' + (res.guilty ? 'g' : 'i')}>{res.guilty ? 'SABOTEUR' : 'INNOCENT'}</span><small>{res.name.toUpperCase()} · {Math.max(0, Math.ceil(left / 1000))}s</small></>)
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

