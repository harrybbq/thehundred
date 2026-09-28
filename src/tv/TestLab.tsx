// Test Lab (host only). Reached from the TV main menu, never from inside a live room,
// so nobody at the party sees it and nothing gets spoiled.
//   TV MOMENTS      every big TV animation, played with pretend players. Nothing touches a room.
//   PRACTICE ROOMS  a throwaway room flagged `practice`, filled with bots. The TV works as normal
//                   and the BOTS dock (below) lets the host be any bot's phone, with the real rules
//                   (the server's lab_* actions only work in practice rooms, and only for the host).
import { useEffect, useMemo, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import type { GameState, Player, Plate, Role, Vote } from '../lib/types';
import { CARD_ROLES, ROLES } from '../lib/roles';
import { useRoom, useTicker } from '../lib/useRoom';
import { sleep } from '../lib/util';
import { showBanner } from '../fx/effects';
import { Sound } from '../fx/sound';
import { Logo } from '../components/ui';
import { BlessedScene, HolyNovaScene, LockerScene, ShameScene, ShurikenScene } from './Scenes';
import { SCROOGE_MS, ScroogeOverlay, type ScroogeFx } from './ScroogeOverlay';
import { JesterRevenge } from './JesterRevenge';
import { PlateOverlay } from './V5Overlays';
import { PlayerGrid } from './PlayerGrid';
import { curseSound } from './TvRoom';
import { PhoneHome } from '../phone/PhoneHome';
import { RoomList, type RoomRow } from './RoomList';

// ---------------------------------------------------------------- pretend faces
const SKIN = ['#f1c7a3', '#d9a07a', '#a86b48', '#7a4a2e', '#f5d6b8', '#c68b63'];
const HAIR = ['#2a1a10', '#6b3b1c', '#c9a227', '#111', '#8a2e1a', '#555'];
const BG = ['#2c6e74', '#5c2a54', '#8a5a1f', '#2d4f2a', '#6e2c2c', '#34406e'];
/** A cartoon selfie as an SVG data URL, so the scenes have photos to work with. */
export function botFace(i: number) {
  const k = (n: number) => (i + n * (2 + Math.floor(i / 6))) % 6;   // 12 different faces before any repeat
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240"><rect width="200" height="240" fill="${BG[k(0)]}"/>`
    + `<ellipse cx="100" cy="250" rx="90" ry="70" fill="${BG[k(3)]}" opacity=".7"/>`
    + `<ellipse cx="100" cy="120" rx="58" ry="70" fill="${SKIN[k(1)]}"/>`
    + `<path d="M42 110 Q48 40 100 42 Q152 40 158 110 Q150 70 100 72 Q56 70 42 110Z" fill="${HAIR[k(2)]}"/>`
    + `<circle cx="78" cy="118" r="7" fill="#111"/><circle cx="122" cy="118" r="7" fill="#111"/>`
    + `<path d="M76 ${150 + (i % 3) * 2} Q100 ${170 - (i % 2) * 12} 124 ${150 + (i % 3) * 2}" stroke="#5a2a1a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const NAMES = ['Aaron', 'Harry', 'Megan', 'Josh', 'Priya', 'Tom', 'Chloe', 'Sam', 'Ellie', 'Dan'];
function fakePlayers(): Player[] {
  return NAMES.map((name, i) => ({
    id: 'p' + i, name, selfie_url: botFace(i), seat: i + 1, beers: (i * 3) % 9, has_role: true, public_role: i === 2 ? 'angel' : null,
    love_partner_id: null, cursed: i === 3, rehab: false, locked_until: null, lock_requested: false, held: false, punishments: [],
  }));
}
const SEGMENTS = ['Down it', 'Finish your drink', 'Waterfall', 'SAFE', 'Shot', 'Two fingers', 'Sing a song', 'Truth or dare'];
function fakeState(players: Player[], extra: Partial<GameState> = {}): GameState {
  const now = new Date().toISOString();
  return {
    server_now: now,
    room: { id: 'lab', code: 'LAB', status: 'live', tally: 62, target: 100, deadline_at: now, segments: SEGMENTS,
      settings: { role_counts: {}, scrooge_respin: true, scrooge_swap: true, scrooge_graffiti: true }, ended: false, final_tally: null,
      result: null, revealed: false, reveal: null, version: 1, wheel: SEGMENTS.map(text => ({ text, graffiti: false })), games_done: 0 },
    players, queue: [], round: null, game: null, vote: null, plate: null, curse_passes: [], graffiti: [], evidence: [], undo: null, events: [],
    me: { user_id: 'host', is_host: true, joined: false, player_id: null, cooldown_until: null, pending_curse_pass: false, evidence_count: 0, secret: null },
    ...extra,
  };
}

// ---------------------------------------------------------------- the menu screen
type Moment = 'nova' | 'blessed' | 'locker' | 'shame' | 'shuriken' | 'swap' | 'respin' | 'graffiti' | 'jester' | 'plate' | 'curse';
const MOMENTS: { id: Moment | 'banners'; label: string; who: string }[] = [
  { id: 'nova', label: 'Holy Nova', who: 'Angel' },
  { id: 'blessed', label: 'Blessed', who: 'Angel' },
  { id: 'locker', label: "Davy Jones' Locker", who: 'Davy Jones' },
  { id: 'shame', label: 'Walk of Shame', who: 'Judge Dredd' },
  { id: 'shuriken', label: 'Shuriken', who: 'Ninja' },
  { id: 'swap', label: 'Swapsies', who: 'Scrooge' },
  { id: 'respin', label: 'Re-spin', who: 'Scrooge' },
  { id: 'graffiti', label: 'Graffiti', who: 'Scrooge' },
  { id: 'jester', label: "Jester's Revenge", who: 'Jester' },
  { id: 'plate', label: "Aaron's Plate", who: 'Skank' },
  { id: 'curse', label: 'Curse pass', who: 'Cursed' },
  { id: 'banners', label: 'Banners', who: 'Cursed · Champ · Game' },
];


export function TestLab({ backend, onOpen, onBack }: { backend: Backend; onOpen: (code: string) => void; onBack: () => void }) {
  const [moment, setMoment] = useState<Moment | null>(null);
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [bots, setBots] = useState(8);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { backend.api<RoomRow[]>('my_rooms').then(r => setRooms(r.filter(x => x.practice))).catch(e => setMsg(errText(e))); }, [backend]);

  const play = async (id: Moment | 'banners') => {
    Sound.unlock();
    if (id !== 'banners') { setMoment(id); return; }
    const ps = fakePlayers();
    await showBanner({ title: 'CURSED', sub: `${ps[3].name.toUpperCase()} HOLDS THE CURSE`, color: '#5c2a54', hold: 2.2, img: ps[3].selfie_url ?? undefined });
    Sound.fanfare();
    await showBanner({ title: 'BIGGEST CHAMP', sub: `${ps[1].name.toUpperCase()} · 6 BEERS · A GOLDEN TICKET`, color: '#c9a227', hold: 2.4, img: ps[1].selfie_url ?? undefined });
    await showBanner({ title: 'NOW PLAYING', sub: 'BEER PONG', color: '#2c6e74', hold: 2 });
  };

  const create = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await backend.api<{ room_id: string; code: string }>('create_room', {
        settings: { practice: true }, deadline_at: new Date(Date.now() + 6 * 3600e3).toISOString(),
      });
      await backend.api('lab_bots', { room_id: r.room_id, n: bots, selfies: Array.from({ length: bots }, (_, i) => botFace(i)) });
      onOpen(r.code);
    } catch (e) { setMsg(errText(e)); setBusy(false); }
  };

  return (
    <div className="center-screen lab-screen">
      <div className="host-card wide lab-card">
        <div className="lab-head"><Logo /><span className="lab-badge">TEST LAB</span></div>
        <p className="muted">Only you can see this. Play any TV moment, or open a practice room full of bots and use their phones yourself.</p>

        <div className="muted lab-h">TV MOMENTS</div>
        <div className="lab-moments">
          {MOMENTS.map(m => (
            <button key={m.id} className="btn lab-moment" onClick={() => play(m.id)}>
              <b>{m.label}</b><span className="muted">{m.who}</span>
            </button>
          ))}
        </div>

        <div className="muted lab-h">PRACTICE ROOMS</div>
        <p className="muted small">A throwaway room with bots. Set the roles up, then hand the bots their cards from the 🤖 BOTS panel and tap through their phones. Everything uses the real rules.</p>
        <div className="row lab-new">
          <div className="stepper">
            <button className="btn" onClick={() => setBots(b => Math.max(2, b - 1))}>−</button>
            <b>{bots} BOTS</b>
            <button className="btn" onClick={() => setBots(b => Math.min(12, b + 1))}>+</button>
          </div>
          <button className="btn-beer" disabled={busy} onClick={create}>+ NEW PRACTICE ROOM</button>
        </div>
        {msg && <p className="err">{msg}</p>}
        {rooms && <RoomList backend={backend} rooms={rooms} onOpen={onOpen} onDeleted={id => setRooms(rs => rs && rs.filter(x => x.id !== id))} />}
        <button className="btn" onClick={onBack}>← BACK</button>
      </div>
      {moment && <MomentPlayer key={moment + Math.random()} moment={moment} onDone={() => setMoment(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- one TV moment with pretend data
function MomentPlayer({ moment, onDone }: { moment: Moment; onDone: () => void }) {
  const players = useMemo(fakePlayers, []);
  const [p0, p1, angel, cursed, p4, p5, p6] = players;
  const scrooge = (fx: ScroogeFx) => <Timed ms={SCROOGE_MS[fx.kind]} onDone={onDone}><ScroogeOverlay fx={fx} /></Timed>;
  switch (moment) {
    case 'nova': return <HolyNovaScene angel={angel} n={10} tally={62} target={100} onDone={onDone} />;
    case 'blessed': return <BlessedScene angel={angel} segments={SEGMENTS} index={3} from="Waterfall" onDone={onDone} />;
    case 'locker': return <LockerScene victim={p4} until={new Date(Date.now() + 20 * 60e3).toISOString()} onDone={onDone} />;
    case 'shuriken': return <ShurikenScene victim={p6} onDone={onDone} />;
    case 'shame': return <ShameScene victim={p5} caption="CAUGHT NURSING A WARM ONE" onDone={onDone} />;
    case 'swap': return scrooge({ kind: 'swap', from: p0, to: p1 });
    case 'respin': return scrooge({ kind: 'respin' });
    case 'graffiti': return scrooge({ kind: 'graffiti', text: 'HARRY DRINKS TWICE' });
    case 'jester': return <FakeJester players={players} onDone={onDone} />;
    case 'plate': return <FakePlate players={players} onDone={onDone} />;
    case 'curse': return <FakeCurse players={players} from={cursed.id} to={p6.id} onDone={onDone} />;
  }
}

function Timed({ ms, onDone, children }: { ms: number; onDone: () => void; children: React.ReactNode }) {
  useEffect(() => { const t = setTimeout(onDone, ms); return () => clearTimeout(t); }, [ms, onDone]);
  return <>{children}</>;
}


function FakeJester({ players, onDone }: { players: Player[]; onDone: () => void }) {
  const jester = players[7];
  const accusers = [players[0].id, players[1].id, players[4].id, players[5].id, players[6].id];
  const base: Vote = { id: 'v', kind: 'trial', title: 'Trial', status: 'closed', options: [], ends_at: new Date().toISOString(), result: null,
    game_id: null, created_at: new Date().toISOString(), counts: {}, voters: 6, my_choice: null,
    outcome: { result: 'jester', accused: jester.id, role: 'jester', accusers, votes: 5, total: 6 } };
  const [vote, setVote] = useState(base);
  // the Jester "picks" on their phone a few seconds in
  const pick = async () => setVote(v => ({ ...v, outcome: { ...v.outcome!, revenge: players[1].id } }));
  useEffect(() => { const t = setTimeout(pick, 6500); return () => clearTimeout(t); }, []);
  const state = fakeState(players, { vote, queue: vote.outcome?.revenge ? [{ id: 'q', player_id: players[1].id, reason: "Jester's revenge", times: 3 }] : [] });
  return <JesterRevenge state={state} vote={vote} act={(async () => { await pick(); }) as any} onClose={onDone} />;
}

function FakePlate({ players, onDone }: { players: Player[]; onDone: () => void }) {
  const eaters = players.slice(0, 8);
  const [plate, setPlate] = useState<Plate>(() => ({ id: 'bbq', n: eaters.length, status: 'open', ends_at: new Date(Date.now() + 12e3).toISOString(),
    eaters: eaters.map(p => p.id), picks: {}, loser: null, dirty: 5, created_at: new Date().toISOString() }));
  useTicker(250);
  // pretend people pick their sausages one at a time
  useEffect(() => {
    let alive = true;
    (async () => {
      const order = [3, 0, 6, 1, 7, 2];
      for (let k = 0; k < order.length && alive; k++) {
        await sleep(1200 + (k % 3) * 400);
        if (!alive) return;
        setPlate(pl => pl.status === 'open' ? { ...pl, picks: { ...pl.picks, [eaters[k].id]: order[k] } } : pl);
      }
    })();
    return () => { alive = false; };
  }, []);
  const act = async () => setPlate(pl => {
    const picks = { ...pl.picks }; const free = [...Array(pl.n).keys()].filter(i => !Object.values(picks).includes(i));
    for (const e of eaters) if (picks[e.id] === undefined) picks[e.id] = free.shift()!;
    return { ...pl, status: 'closed', picks, loser: Object.keys(picks).find(id => picks[id] === pl.dirty) ?? null };
  });
  return <PlateOverlay state={fakeState(players, { plate })} plate={plate} act={act as any} now={Date.now} onClose={onDone} />;
}

function FakeCurse({ players, from, to, onDone }: { players: Player[]; from: string; to: string; onDone: () => void }) {
  const [curse, setCurse] = useState<null | { from: string; to: string; key: number }>(null);
  const [ps, setPs] = useState(players);
  useEffect(() => {
    let alive = true;
    (async () => {
      await sleep(700); if (!alive) return;
      setCurse({ from, to, key: Date.now() }); curseSound();
      await sleep(3600); if (!alive) return;
      setCurse(null); setPs(p => p.map(x => ({ ...x, cursed: x.id === to })));
      await sleep(1500); if (alive) onDone();
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div className="lab-grid-ov tv" onClick={onDone}>
      <section className="panel suspects-panel lab-grid">
        <PlayerGrid players={ps} revealMask={new Set()} onCard={() => {}} onExpose={() => {}} onEmpty={() => {}} curse={curse} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- the BOTS dock (inside a practice room)

export function BotDock({ backend, state }: { backend: Backend; state: GameState }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const bots = state.players.filter(p => p.name.startsWith('Bot '));
  const current = bots.find(b => b.id === sel) ?? bots[0];
  const room_id = state.room.id;

  const run = async (action: string, args: Record<string, unknown> = {}) => {
    setMsg('');
    try { await backend.api(action, { room_id, ...args }); } catch (e) { setMsg(errText(e)); }
  };
  const addBots = () => {
    const n = bots.length;
    return run('lab_bots', { n: 2, selfies: [botFace(n), botFace(n + 1)] });
  };

  if (!open) return <button className="lab-dock-tab" onClick={() => setOpen(true)}>🤖 BOTS</button>;
  return (
    <aside className="lab-dock">
      <div className="lab-dock-head">
        <b>🤖 BOTS</b><span className="lab-badge">PRACTICE</span>
        <button className="key icon" onClick={() => setOpen(false)} title="Hide">✕</button>
      </div>
      <div className="lab-bots">
        {bots.map(b => (
          <button key={b.id} className={'lab-bot' + (b.id === current?.id ? ' on' : '')} onClick={() => setSel(b.id)}>
            {b.selfie_url ? <img src={b.selfie_url} alt="" /> : <i />}<span>{b.name.replace('Bot ', '')}</span>
          </button>
        ))}
        <button className="lab-bot add" onClick={addBots} title="Add 2 bots">+2</button>
      </div>
      <div className="lab-tools">
        <button className="btn" onClick={() => run('lab_deal')} title="Every bot without a card redeems a random unused card from Setup › Roles">DEAL SETUP CARDS</button>
      </div>
      {msg && <p className="err">{msg}</p>}
      {current && <BotPhone key={current.id} backend={backend} bot={current} roomId={room_id} code={state.room.code} version={state.room.version} />}
    </aside>
  );
}

function BotPhone({ backend, bot, roomId, code, version }: { backend: Backend; bot: Player; roomId: string; code: string; version: number }) {
  // A stand-in backend: every call runs as the bot (lab_as), and reads come from lab_state.
  const proxy = useMemo<Backend>(() => ({
    ...backend, kind: 'player',
    api: (action, args = {}) => backend.api('lab_as', { room_id: roomId, player_id: bot.id, action, args }),
    getState: () => backend.api<GameState>('lab_state', { room_id: roomId, player_id: bot.id }),
  }), [backend, bot.id, roomId]);
  const room = useRoom(proxy, code);
  useTicker(500);
  useEffect(() => { room.refresh(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = room.state;
  const role = s?.me.secret?.role;
  const [beers, setBeers] = useState('');
  const [give, setGive] = useState<Role>('medic');

  return (
    <div className="lab-phone-wrap">
      <div className="lab-bot-bar">
        <b>{bot.name}</b>
        <span className="muted">{role ? `${ROLES[role]?.icon ?? ''} ${ROLES[role]?.label ?? role}${s?.me.secret?.evolved ? ' · ' + s.me.secret.evolved : ''} · L${s?.me.secret?.level}` : 'no card'}</span>
      </div>
      <div className="lab-bot-bar">
        {!role && <>
          <select value={give} onChange={e => setGive(e.target.value as Role)}>
            {CARD_ROLES.map(r => <option key={r} value={r}>{ROLES[r].icon} {ROLES[r].label}</option>)}
          </select>
          <button className="btn" onClick={() => backend.api('lab_role', { room_id: roomId, player_id: bot.id, role: give }).then(room.refresh).catch(() => {})}>GIVE CARD</button>
        </>}
        <input className="lab-beers" type="number" min={0} max={99} placeholder={String(bot.beers)} value={beers} onChange={e => setBeers(e.target.value)} />
        <button className="btn" disabled={beers === ''} onClick={() => backend.api('lab_beers', { room_id: roomId, player_id: bot.id, beers: +beers }).then(() => { setBeers(''); room.refresh(); }).catch(() => {})}>SET BEERS</button>
      </div>
      <div className="lab-phone">
        {s && s.me.joined ? <PhoneHome backend={proxy} state={s} room={room} /> : <div className="phone center"><p className="muted">{room.error ?? 'Loading…'}</p></div>}
      </div>
    </div>
  );
}
