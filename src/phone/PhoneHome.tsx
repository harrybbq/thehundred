// The in-game phone (Phone UI v2: design/mockups/PhoneUI.dc.html). Built for drunk thumbs and peek-proof.
// Takeovers, in priority order: notices → mini-games → the Trial vote → Jester's revenge → Aaron's Plate → SPIN.
// Otherwise Home: the NOW strip (what's on the TV + what you do), the tally, the beer key, your level, two tiles that
// look the same on every phone (your file · your moves), and the reactions.
// Every move follows one path: PICK A PLAYER → CHECK (a separate screen, YES arms after 0.6s) → DONE / DIDN'T GO
// THROUGH. Display-size text on that path is the same for every role; the verb ("Heal") only appears at body size.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import type { GameState, Player, Role, Team } from '../lib/types';
import { NO_TRIAL } from '../lib/types';
import { GameTakeover, gameFor, isNetErr, miniRevealEnd } from './PhoneGames';
import { BetPick, BetStake, betAsk, betOutcome, betPickName, betRefused, betResultAt, dodgeTarget, type BetOption } from './Bookie';
import { EVOLVED, HIT_ROLES, LEVEL_BEERS, PERKS, ROLES, TEAMS, levelOf } from '../lib/roles';
import { compressImage, sleep } from '../lib/util';
import { toast } from '../fx/effects';
import { Sound } from '../fx/sound';
import { CapsPop, Check, Clock, Facts, Icon, Key, Photo, PlayerRow, Result, Row, TopBar, buzz, clock, untilText, type Fact, type IconName, type Outcome } from './kit';

type Room = { refresh: () => void; now: () => number; connected: boolean };
type Act = (action: string, args?: Record<string, unknown>) => Promise<any>;
type Notice = { kicker?: string; title: string; sub: string; tone: 'team' | 'wrong' | 'knife' | 'rehab' | 'ok'; facts?: Fact[]; face?: Player; stamp?: string };
type Go = () => Promise<Outcome | void>;
type PickCfg = { title?: string; intro: ReactNode; exclude: string[]; notes?: (p: Player) => string | undefined; include?: string[]; next: (p: Player) => void };
type Screen =
  | { k: 'home' } | { k: 'moves' } | { k: 'file' } | { k: 'code' } | { k: 'evidence' }
  | { k: 'pick'; cfg: PickCfg; back: Screen }
  | { k: 'check'; face?: Player | null; ask: string; cost: ReactNode; yes: string; red?: boolean; go: Go; back: Screen; again?: () => void }
  | { k: 'result'; o: Outcome }
  | { k: 'list'; title: string; intro: ReactNode; items: { key: string; label: string; sub?: string; pick: () => void }[]; back: Screen }
  | { k: 'text'; title: string; intro: ReactNode; placeholder: string; next: (t: string) => void; back: Screen }
  | { k: 'multi'; n: number; intro: ReactNode; exclude: string[]; next: (ids: string[]) => void; back: Screen };
type Move = { key: string; icon: IconName; t: string; s: string; chip: string; info?: boolean; run?: () => void };

const REACTIONS: { e: string; icon: IconName; label: string }[] = [
  { e: '🍺', icon: 'pint', label: 'CHEERS' }, { e: '😈', icon: 'horns', label: 'BOO' }, { e: '🙏', icon: 'hands', label: 'PLEASE' }, { e: '😂', icon: 'laugh', label: 'HA!' },
];
const RESPIN_WINDOW = 10000;
const READ_MS = 3000;
const done = (line: ReactNode, facts?: Fact[]): Outcome => ({ tone: 'ok', kicker: 'IT WORKED', title: 'DONE', line, facts });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const CODE_LATER = 'thehundred-code-later';
// the file hides itself and the moves case closes after this long WITHOUT a touch or a scroll (the Skank and Medic files are long)
const FILE_MS = 25000;
const MOVES_MS = 20000;
// your own result at the end of the night (before the reveal) hides itself after this long
const END_RESULT_MS = 10000;

// The queue rows a mini-game adds for its losers (the server's reasons, v3_logic _mg_finish). While that game's reveal
// is still playing on the TV they stay off the phones, or "X: Walked the plank" would beat the Kraken to it.
const MG_REASON: Partial<Record<string, string>> = { dodge: 'Hit by a throwing star', plank: 'Walked the plank', jack: 'Popped the Jack-in-the-Box', bomb: 'Holding the bomb' };
function spoilsMiniGame(s: GameState, nowMs: number): (q: GameState['queue'][number]) => boolean {
  const g = s.minigame, why = g && MG_REASON[g.kind];
  if (!g || !why || g.status !== 'done' || !g.finished_at || !g.result?.losers.length) return () => false;
  if (nowMs >= miniRevealEnd(g)) return () => false;
  const losers = g.result.losers;
  return q => losers.includes(q.player_id) && q.reason.startsWith(why);
}

export function PhoneHome({ backend, state, room }: { backend: Backend; state: GameState; room: Room }) {
  const s = state, me = s.players.find(p => p.id === s.me.player_id)!;
  const sec = s.me.secret;
  const round = s.round;
  const victim = round ? s.players.find(p => p.id === round.victim_id) : null;
  const [screen, setScreenRaw] = useState<Screen>(() => {
    let later = false; try { later = !!localStorage.getItem(CODE_LATER); } catch { /* ignore */ }
    return !s.me.secret && !later ? { k: 'code' } : { k: 'home' };
  });
  const [notices, setNotices] = useState<Notice[]>([]);            // a queue: two at once never hide each other
  const notice = notices[0] ?? null;
  const [busy, setBusy] = useState(false);
  const [readCheck, setReadCheck] = useState<null | { id: string; name: string }>(null);
  const [nowSheet, setNowSheet] = useState(false);
  // the Trial / Jester's revenge check lives apart from the move path, so a YES there can never fire a move
  type VCheck = { face?: Player | null; ask: string; cost: ReactNode; yes: string; red?: boolean; tag?: string; go: () => Promise<unknown> };
  const [vcheck, setVcheck] = useState<VCheck | null>(null);
  const [ballotSeen, setBallotSeen] = useState<string | null>(null); // the sealed-ballot / sit-out screen was dismissed for this vote
  const [takeSkipped, setTakeSkipped] = useState<string | null>(null); // TAKE IT FOR THEM: NOT ME was tapped for this round
  const [touchedAt, setTouchedAt] = useState(() => Date.now());      // the last touch/scroll on the file or the moves case
  const setScreen = (x: Screen) => { setScreenRaw(x); setTouchedAt(Date.now()); window.scrollTo(0, 0); };
  const home = () => setScreen({ k: 'home' });

  const act: Act = async (action, args = {}) => { const r = await backend.api(action, { room_id: s.room.id, ...args }); room.refresh(); return r; };
  // run a move: DONE, or DIDN'T GO THROUGH (in plain words), or THE TV IS BUSY (nothing was used)
  const run = async (go: Go, again?: () => void) => {
    setBusy(true);
    try { const o = await go(); setScreen({ k: 'result', o: o ?? done('It went through.') }); }
    catch (e) {
      const m = errText(e), b = /^BUSY:(\d+)$/.exec(m);
      buzz(200);
      setScreen({ k: 'result', o: b
        ? { tone: 'wait', kicker: 'HOLD ON', title: 'THE TV IS BUSY', line: "Someone else's move is on. Nothing was used.", facts: [{ icon: 'clock', text: `Try again in ${b[1]} seconds` }], back: 'BACK TO HOME' }
        : { tone: 'no', kicker: 'NOTHING HAPPENED', title: "DIDN'T GO THROUGH", line: m, facts: [{ icon: 'check', text: "Your move wasn't used" }], again } });
    } finally { setBusy(false); }
  };
  const check = (x: Omit<Extract<Screen, { k: 'check' }>, 'k'>) => setScreen({ k: 'check', ...x });

  // ---------- one-time notices (survive refresh) ----------
  // `secret` notices never buzz: a phone buzzing at the same moment as a secret change (the Betrayer joining the
  // Saboteurs, the knife passing, a file evolving) would point at its owner for anyone watching
  const once = (key: string, n: Notice, secret = false) => {
    const k = `thehundred-${s.me.player_id}-${key}`;
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch { /* ignore */ }
    if (!secret) buzz(300);
    setNotices(q => [...q, n]);
  };
  const fileChanged: Fact[] = [{ icon: 'lock', text: 'Open your file to see what\'s new', small: 'Somewhere nobody can see your screen' }];
  const allies = sec?.allies ?? [];
  useEffect(() => {
    if (!sec || !allies.length) return;
    const facts: Fact[] = allies.map(a => ({ icon: 'users', text: a.name, small: `${ROLES[a.role]?.label ?? a.role}${a.caught ? ' · caught' : ''}` }));
    const intruder = allies.find(a => a.role === 'intruder');
    once('allies-' + allies.map(a => a.id).sort().join(','), sec.role === 'betrayer'
      ? { kicker: 'YOU\'RE IN', title: "YOU'RE A SABOTEUR NOW", sub: `${intruder ? `${intruder.name} is the Intruder. ` : ''}You win if the group falls short. You get no Intruder powers. Act natural.`, tone: 'team', facts }
      : { kicker: 'THE SABOTEURS', title: 'YOUR TEAM', sub: 'You win together if the group falls short. Don\'t give each other away.', tone: 'team', facts }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allies.length]);
  useEffect(() => {
    if (sec?.has_knife && sec.role !== 'intruder') once('knife', { kicker: 'THE INTRUDER WAS CAUGHT', title: 'THE KNIFE IS YOURS', tone: 'knife', sub: "You're a Saboteur now: stop the group reaching the target.",
      facts: [{ icon: 'blade', text: 'Name someone\'s secret role', small: 'Right: their cover is blown. One Hit per game.' }, { icon: 'check', text: 'Your streak lasts until you guess wrong' }] }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec?.has_knife]);
  useEffect(() => {
    if (me.rehab) once('rehab', { kicker: 'CAUGHT AT THE TRIAL', title: "YOU'RE IN REHAB", sub: 'Out of the fight. Not out of the game.', tone: 'rehab',
      facts: [{ icon: 'cross', text: 'Your powers are off' }, { icon: 'gavel', text: 'You sit out the Trials' }, { icon: 'blade', text: '3 beers = THE SHIV', small: 'Stab anyone: their next punishment counts double.', hot: true }] });
    else if (sec?.burned) once('burned', { kicker: 'THE KNIFE FOUND YOU', title: 'COVER BLOWN', sub: 'Everyone knows your role now.', tone: 'wrong',
      facts: [{ icon: 'cross', text: 'Your powers are burned' }, { icon: 'check', text: 'You can still drink, vote and find the Saboteurs' }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.rehab, sec?.burned]);
  // levels and evolutions: private. The notice never says what changed; the file does.
  // the server decides the level (beers, capped by games played): never worked out here from beers
  const lvl = s.me.level_info?.level ?? sec?.level ?? levelOf(me);
  useEffect(() => {
    if (lvl < 2) return;
    once('level-' + lvl, { kicker: 'LEVEL UP', title: `LEVEL ${lvl}`, tone: 'ok', sub: 'Your file has changed.', facts: fileChanged });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lvl]);
  useEffect(() => {
    const ev = sec?.evolved;
    if (!ev || sec?.burned || me.rehab) return;
    once('evolved-' + ev, { kicker: 'LEVEL 4', title: 'YOUR FILE HAS CHANGED', tone: 'ok', sub: 'Something new is in your file.', facts: fileChanged }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec?.evolved]);
  const locked = !!me.locked_until && Date.parse(me.locked_until) > room.now();
  // private verdict notices, once per vote (a GUILTY call is silent: who voted for the accused is never public)
  const vo = s.vote?.status === 'closed' && s.vote.kind === 'trial' ? s.vote : null;
  useEffect(() => {
    const o = vo?.outcome; if (!vo || !o) return;
    const accP = s.players.find(p => p.id === o.accused), acc = accP?.name ?? 'They';
    const tell = () => {
      if (o.result === 'innocent' && (o.accusers ?? []).includes(me.id))
        once('verdict-' + vo.id, { kicker: 'WRONG ACCUSATION', title: 'YOU DRINK', tone: 'wrong', sub: `${acc} was innocent, and you voted for them.`, face: accP, stamp: 'NOT GUILTY' });
      else if (o.result === 'guilty' && vo.my_choice === o.accused)
        once('verdict-' + vo.id, { kicker: 'GUILTY', title: 'YOU CALLED IT', tone: 'ok', sub: `You accused ${acc}. Nothing to drink. Keep hunting.` }, true);
      else if (o.result === 'none' && vo.my_choice)
        once('verdict-' + vo.id, { kicker: 'THE VERDICT', title: 'NO VERDICT', tone: 'ok', sub: 'No clear majority. Nobody drinks for this one.' }, true);
    };
    // wait for the TV: its tally runs ~0.5s a row, then the stamp lands (phones buzzing early would spoil the verdict)
    const rows = Math.min(7, Object.keys(vo.counts).length) + 1;
    const t = setTimeout(tell, 300 + rows * 520 + 1500 + 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vo?.id, vo?.outcome?.result]);
  useEffect(() => {
    if (locked) once('locked-' + me.locked_until, { kicker: "DAVY JONES' LOCKER", title: 'SLEEPING WITH THE FISHES', tone: 'ok', sub: 'Rest up. Drink some water.',
      facts: [{ icon: 'shield', text: 'No punishments', small: me.held ? 'One is waiting for when you\'re out' : undefined }, { icon: 'cross', text: 'No moves, no vote' }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);
  const myTurn = round?.phase === 'waiting' && round.victim_id === me.id;
  // TAKE IT FOR THEM: the one who was let off hears who stepped in (public: the TV says it too)
  const stoodIn = round?.stand_in_id && round.stand_in_for === me.id && round.stand_in_id !== me.id ? s.players.find(p => p.id === round.stand_in_id) : null;
  useEffect(() => {
    if (stoodIn && round) once('standin-' + round.id, { kicker: 'SAVED BY A MATE', title: `${stoodIn.name.toUpperCase()} TOOK IT FOR YOU`, tone: 'ok', face: stoodIn,
      sub: `${stoodIn.name} is facing the wheel for you. Buy them a drink.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stoodIn?.id, round?.id]);
  const prevTurn = useRef(false);
  useEffect(() => { if (myTurn && !prevTurn.current) buzz(400); prevTurn.current = myTurn; }, [myTurn]);
  // a takeover (the Trial, the Jester's revenge, your spin) drops whatever move was half done: no stale check afterwards
  const takeover = `${s.vote?.status === 'open' ? s.vote.id : ''}|${s.vote?.outcome?.result === 'jester' ? 'j' : ''}|${myTurn}`;
  const lastTakeover = useRef(takeover);
  useEffect(() => {
    if (lastTakeover.current === takeover) return;
    lastTakeover.current = takeover; setVcheck(null);
    if (!['home', 'file', 'code'].includes(screen.k)) setScreenRaw({ k: 'home' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeover]);
  // the file and the moves case close by themselves; any touch or scroll starts the countdown again (shown live in the chip)
  const idleMs = screen.k === 'file' ? FILE_MS : screen.k === 'moves' ? MOVES_MS : 0;
  const poke = () => setTouchedAt(t => (Date.now() - t > 400 ? Date.now() : t));
  useEffect(() => {
    if (!idleMs) return;
    const t = setTimeout(home, Math.max(0, touchedAt + idleMs - Date.now()));
    window.addEventListener('scroll', poke, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('scroll', poke); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, touchedAt, idleMs]);
  const idleLeft = Math.max(0, Math.ceil((touchedAt + idleMs - Date.now()) / 1000));
  const idleChip = (verb: string) => <span className={'pu-chip' + (idleLeft <= 5 ? ' red' : '')} aria-live="off"><Icon n="clock" />{verb} {idleLeft}s</span>;

  // ---------- caps (your own only) ----------
  // The server pays caps the moment a mini-game or a bet settles, which is while the TV is still playing the reveal.
  // So the number on this phone (and its "+3 CAPS" pop) waits until the reveal is over, or it would give the result away.
  const book = s.book ?? null;
  const capsReal = s.me.caps;
  const capsHold = Math.max(miniRevealEnd(s.minigame), book?.status === 'settled' ? betResultAt(s, book) : 0);
  const capsHeld = room.now() < capsHold;
  const [capsShown, setCapsShown] = useState<number | undefined>(capsReal);
  const [capsPop, setCapsPop] = useState<null | { d: number; k: number }>(null);
  useEffect(() => {
    if (capsReal === undefined || capsHeld) return;
    if (capsShown === undefined) { setCapsShown(capsReal); return; }
    if (capsReal !== capsShown) { setCapsPop({ d: capsReal - capsShown, k: Date.now() }); setCapsShown(capsReal); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capsReal, capsHeld]);
  useEffect(() => { if (!capsPop) return; const t = setTimeout(() => setCapsPop(null), 2600); return () => clearTimeout(t); }, [capsPop]);

  // ---------- the bookie: bets on a summoned mini-game ----------
  type BetStep = { k: 'stake'; game: string; opt: BetOption; face: Player | null } | { k: 'check'; game: string; opt: BetOption; face: Player | null; ask: string; stake: number } | { k: 'result'; o: Outcome };
  const [betStep, setBetStep] = useState<BetStep | null>(null);
  const [betSkip, setBetSkip] = useState<string | null>(null);
  const betKey = (k: string, game: string) => `thehundred-${s.me.player_id}-${k}-${game}`;
  const lsHas = (k: string) => { try { return !!localStorage.getItem(k); } catch { return false; } };
  const lsSet = (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* ignore */ } };
  const skippedBet = (game: string) => betSkip === game || lsHas(betKey('nobet', game));
  // how your bet went: latched when it settles (the market only stays on the wire ~30s), shown after the TV's reveal
  const [betDone, setBetDone] = useState<null | { game: string; o: Outcome; at: number }>(null);
  useEffect(() => {
    if (!book?.mine || (book.status !== 'settled' && book.status !== 'void') || lsHas(betKey('betres', book.game_id))) return;
    setBetDone({ game: book.game_id, o: betOutcome(book), at: book.status === 'void' ? 0 : betResultAt(s, book) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.game_id, book?.status, !!book?.mine]);

  // ---------- beer ----------
  const stageLeft = s.room.ability_until ? Math.max(0, Date.parse(s.room.ability_until) - room.now()) : 0;
  const mmss = (ms: number) => { const t = Math.ceil(ms / 1000); return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `${t}s`; };
  const cooldown = s.me.cooldown_until ? Math.max(0, Date.parse(s.me.cooldown_until) - room.now()) : 0;
  const coolTotal = useRef(20000);
  useEffect(() => { if (cooldown > coolTotal.current) coolTotal.current = cooldown; }, [cooldown]);
  const [beerBusy, setBeerBusy] = useState(false);
  const logBeer = async () => {
    if (beerBusy) return;
    Sound.unlock(); buzz(); setBeerBusy(true);
    try { await act('log_beer'); Sound.pop(); } catch (e) { toast(errText(e), 3500); } finally { setBeerBusy(false); }
  };

  const sub = s.room.ended ? `TIME'S UP · ${plural(me.beers, 'BEER').toUpperCase()}` : me.rehab ? 'IN REHAB' : locked ? 'IN THE LOCKER' : `LV${lvl} · ${plural(me.beers, 'BEER').toUpperCase()}`;
  const shell = (children: ReactNode, tone = '') => (
    <div className={'pu-app ' + tone} onPointerDown={idleMs ? poke : undefined}>
      <TopBar me={me} sub={sub} subTone={me.rehab ? 'red' : locked ? 'sea' : ''} room={s.room.code} live={room.connected} caps={capsShown} />
      {capsPop && <CapsPop key={capsPop.k} delta={capsPop.d} />}
      {children}
    </div>
  );

  // ---------- full-screen takeovers ----------
  // your own spin and an open vote come first; notices wait for them (a drunk thumb must never be stuck behind a notice)
  const voteOpen = !!s.vote && s.vote.status === 'open' && Date.parse(s.vote.ends_at) > room.now();
  const mustVote = voteOpen && !s.vote!.my_choice && (s.vote!.options.includes(me.id) || me.public_role === 'angel') && !me.rehab && !locked;
  const mustAvenge = !!s.vote && s.vote.status === 'closed' && s.vote.outcome?.result === 'jester' && s.vote.outcome.accused === me.id && !s.vote.outcome.revenge;
  const mg = gameFor(s, me.id, room.now());
  const spinWait = round?.phase === 'waiting' && round.spin_at ? Math.max(0, Math.ceil((Date.parse(round.spin_at) - room.now()) / 1000)) : 0;
  const mustEat = !!s.plate && s.plate.status === 'open' && s.plate.eaters.includes(me.id) && s.plate.picks[me.id] === undefined && Date.parse(s.plate.ends_at) > room.now() - 1500;
  if (notice && !myTurn && !mustVote && !mustAvenge && !mg && !mustEat) {
    const red = notice.tone === 'wrong' || notice.tone === 'rehab';                 // (not the knife: that one is secret)
    const [first, ...rest] = notice.title.split(' ');
    return shell(<>
      {red && <div className="pu-tape" />}
      <div className={'pu-kick ' + (red ? 'pu-c-red' : 'pu-c-sodium') + (notice.face ? ' pu-center' : '')} style={{ marginTop: 8 }}>{notice.kicker}</div>
      {notice.face && <>
        <div className="pu-tr-accuse" style={{ width: 150 }}><Photo p={notice.face} /><div className="cap" style={{ fontSize: Math.min(22, Math.floor(140 / (Math.max(1, notice.face.name.length) * .62))) }}>{notice.face.name}</div></div>
        {notice.stamp && <div className="pu-tr-tilt" style={{ marginTop: -118, marginBottom: 56, position: 'relative', zIndex: 2 }}><div className="pu-tr-stamp" style={{ ['--sc' as any]: '#7fe3d0' }}>{notice.stamp}</div></div>}
      </>}
      <div className={'pu-hero' + (notice.face ? ' pu-center' : '')}>{notice.tone === 'rehab' || notice.face ? <>{first} {rest.slice(0, -1).join(' ')}<br /><span className="pu-c-red">{rest.slice(-1)}</span></> : notice.title}</div>
      <div className={'pu-body pu-c-bone2' + (notice.face ? ' pu-center' : '')}>{notice.sub}</div>
      {notice.facts && <Facts facts={notice.facts} />}
      <div className="pu-keys"><Key lg className="pu-ok" onClick={() => setNotices(q => q.slice(1))}>GOT IT</Key></div>
    </>, `pu-notice pu-n-${notice.tone}` + (red ? ' pu-red' : ''));
  }
  if (mg) return <GameTakeover s={s} g={mg} me={me} act={act} backend={backend} clock={room.now} caps={capsShown} />;

  const vote = s.vote;
  const canVote = vote && (vote.options.includes(me.id) || me.public_role === 'angel');
  if (vote && voteOpen && !vote.my_choice && canVote && !me.rehab && !locked) {
    const left = Math.max(0, Date.parse(vote.ends_at) - room.now());
    const row = <Row title={<span className="red">THE TRIAL</span>} sub={`${vote.voters ?? 0} of ${vote.options.length} voted`} slot={<span className={'pu-clock' + (left <= 10e3 ? ' danger' : '')}>{clock(left)}</span>} />;
    const cast = (id: string) => act('cast_vote', { vote_id: vote.id, choice_id: id }).then(() => { buzz(60); setVcheck(null); });
    if (vcheck) return shell(<div className="pu-voting" style={{ display: 'contents' }}>{row}<Check face={vcheck.face} question={vcheck.ask} cost={vcheck.cost} yes={vcheck.yes} red={vcheck.red} tag={vcheck.tag} busy={busy} noLabel="NO, PICK AGAIN"
      onNo={() => setVcheck(null)} onYes={() => { setBusy(true); vcheck.go().catch(e => toast(errText(e), 3500)).finally(() => setBusy(false)); }} /></div>, 'pu-voting pu-red');
    const pickVote = (p: Player) => setVcheck({ face: p, tag: vote.kind === 'trial' ? 'ACCUSED' : undefined, ask: `VOTE FOR ${p.name.toUpperCase()}?`, cost: `If ${p.name} is innocent, you drink. You can't change it after YES.`, yes: `YES, VOTE ${p.name.toUpperCase()}`, red: true, go: () => cast(p.id) });
    const suspects = s.players.filter(p => vote.options.includes(p.id) && p.id !== me.id);
    const long = suspects.some(p => p.name.length > 9);                // long names get one column, so they're never cut
    return shell(<>
      {row}
      <div className="pu-h1">{vote.kind === 'trial' ? "Who's a Saboteur?" : vote.title}</div>
      <div className={(long ? 'pu-list' : 'pu-grid2') + ' pu-vote'}>{suspects.map(p => <PlayerRow key={p.id} p={p} onPick={() => pickVote(p)} />)}</div>
      {/* NOT SURE: a footer that never scrolls away */}
      <div className="pu-tr-foot">
        {vote.kind === 'trial' && <Key variant="ghost" className="pu-notrial" onClick={() => setVcheck({ ask: 'NO TRIAL?', cost: "You're not sure yet. You can't change it after YES.", yes: 'YES, NO TRIAL', go: () => cast(NO_TRIAL) })}>Not sure yet: NO TRIAL</Key>}
        <div className="pu-small pu-center" style={{ fontSize: 16 }}>Not voting is fine. Nothing happens to you.</div>
      </div>
    </>, 'pu-voting');
  }
  // the vote is open and this phone is done with it: the sealed ballot (your own pick only), or why you sit it out
  if (vote && voteOpen && vote.kind === 'trial' && ballotSeen !== vote.id && (vote.my_choice || me.rehab || locked)) {
    const left = Math.max(0, Date.parse(vote.ends_at) - room.now());
    const mine = vote.my_choice ? s.players.find(p => p.id === vote.my_choice) : null;
    const total = Math.max(vote.voters ?? 0, vote.options.length);
    const back = <div className="pu-keys"><Key variant="steel" icon="back" className="pu-ok" onClick={() => setBallotSeen(vote.id)}>BACK TO HOME</Key></div>;
    if (!vote.my_choice) return shell(<>
      <Row title={<span className="red">THE TRIAL</span>} sub="You sit this one out" slot={<span className={'pu-clock' + (left <= 10e3 ? ' danger' : '')}>{clock(left)}</span>} />
      <div className="pu-verdict wait" style={{ marginTop: 22 }}><Icon n="lock" /></div>
      <div className="pu-kick pu-center pu-c-sodium" style={{ marginTop: 14 }}>THE TRIAL IS ON</div>
      <div className="pu-display pu-center">NO VOTE<br />THIS TIME</div>
      <div className="pu-body pu-center pu-c-bone2">{me.rehab ? 'You’re in rehab.' : 'You’re in Davy Jones’ Locker.'} You can still watch the TV and drink.</div>
      {back}
    </>, 'pu-sitout');
    return shell(<>
      <Row title={<span className="red">THE TRIAL</span>} sub="Your ballot is in" slot={<span className={'pu-clock' + (left <= 10e3 ? ' danger' : '')}>{clock(left)}</span>} />
      <div className="pu-tr-env"><div className="seal"><Icon n="gavel" /></div><div className="lbl">BALLOT · SEALED</div></div>
      <div className="pu-display pu-center" style={{ marginTop: 4 }}>VOTE CAST</div>
      <div className="pu-tr-mine">{mine ? <><span className="pf"><Photo p={mine} /></span><span className="tx">You accused<b>{mine.name.toUpperCase()}</b></span></>
        : <span className="tx">You voted<b>NO TRIAL</b></span>}</div>
      <div className="pu-tr-count"><span className="pu-small" style={{ color: 'var(--bone)' }}>{vote.voters ?? 0} of {total} in</span>
        <span className="pu-tr-slips">{Array.from({ length: Math.min(total, 14) }, (_, i) => <i key={i} className={i < (vote.voters ?? 0) ? '' : 'o'} />)}</span></div>
      <div className="pu-small pu-center">Watch the TV for the tally.</div>
      {back}
    </>, 'pu-ballot');
  }
  // JESTER convicted: pick one of your accusers for a ×3 punishment
  const jo = vote?.outcome;
  if (vote && vote.status === 'closed' && jo?.result === 'jester' && jo.accused === me.id && !jo.revenge) {
    if (vcheck) return shell(<Check face={vcheck.face} question={vcheck.ask} cost={vcheck.cost} yes={vcheck.yes} red busy={busy} noLabel="NO, PICK AGAIN"
      onNo={() => setVcheck(null)} onYes={() => { setBusy(true); vcheck.go().catch(e => toast(errText(e), 3500)).finally(() => setBusy(false)); }} />, 'pu-red pu-jester-rev');
    const accusers = s.players.filter(p => (jo.accusers ?? []).includes(p.id));
    return shell(<>
      <Row title={<span className="red">THEY FELL FOR IT</span>} sub="Jester's revenge" />
      <div className="pu-h1">Who takes the ×3?</div>
      <div className="pu-small">Pick one of the people who voted for you. They take a triple punishment.</div>
      <div className="pu-grid2 pu-jester">{accusers.map(p => <PlayerRow key={p.id} p={p} onPick={() => setVcheck({ face: p, ask: `GIVE ${p.name.toUpperCase()} THE ×3?`, cost: 'They take a triple punishment. Can\'t be undone.', yes: `YES, ${p.name.toUpperCase()}`, red: true,
        go: () => act('jester_revenge', { vote_id: vote.id, player_id: p.id }).then(() => { buzz(120); setVcheck(null); }) })} />)}</div>
    </>, 'pu-red pu-jester-rev');
  }
  // AARON'S PLATE: grab a sausage (only the TV shows the tell)
  const plate = s.plate;
  if (plate && plate.status === 'open' && plate.eaters.includes(me.id) && plate.picks[me.id] === undefined && Date.parse(plate.ends_at) > room.now() - 1500) {
    const taken = new Set(plate.taken ?? Object.values(plate.picks));
    return shell(<>
      <Row title="AARON'S PLATE" slot={(() => { const n = Math.max(0, Math.ceil((Date.parse(plate.ends_at) - room.now()) / 1000)); return <Clock text={String(n)} danger={n <= 5} />; })()} />
      <div className="pu-h1">Grab a sausage</div>
      <div className="pu-small">One of them fell on the balcony. <b style={{ color: 'var(--bone)' }}>Look at the TV.</b> Aaron swears it's fine.</div>
      <div className="pu-bbq">{Array.from({ length: plate.n }, (_, i) => (
        <button key={i} className="pu-bbq-pick" disabled={taken.has(i)} onClick={() => { buzz(40); act('bbq_pick', { plate_id: plate.id, index: i }).then(() => toast(`Sausage #${i + 1}. Bon appétit.`)).catch(e => toast(errText(e))); }}>
          #{i + 1}{taken.has(i) && <small>TAKEN</small>}</button>
      ))}</div>
      <div className="pu-small pu-center" style={{ marginTop: 'auto' }}>Tap one. It's yours at once.</div>
    </>, 'pu-plate');
  }
  if (myTurn) {
    return shell(<>
      <div className="pu-kick pu-center" style={{ marginTop: 8 }}>{round!.reason || 'Punishment time'}</div>
      <div className="pu-hero pu-center">YOUR TURN<br />TO SPIN</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {me.cursed && <span className="pu-chip red"><Icon n="skull" />CURSED · IT SPINS TWICE</span>}
        {round!.times > 1 && <span className="pu-chip red"><Icon n="bolt" />×{round!.times} · {round!.reason === "Jester's revenge" ? "JESTER'S REVENGE" : 'MULTIPLIED'}</span>}
      </div>
      <div className="pu-hz"><div className="pu-hz-plate">
        {/* the stand-in window: nobody can spin for 4 seconds (the server holds it too). A different class from
            .spin-btn, so nothing taps a locked key */}
        {spinWait > 0
          ? <button className="pu-bigred spin-locked" disabled aria-label={`Spin unlocks in ${spinWait} seconds`}>{spinWait}</button>
          : <button className="pu-bigred spin-btn" onClick={() => { Sound.unlock(); buzz(80); act('spin', { round_id: round!.id }).catch(e => toast(errText(e))); }}>SPIN</button>}
      </div></div>
      {spinWait > 0
        ? <div className="pu-body pu-center spin-wait" style={{ marginTop: 'auto' }}>Anyone stepping in? SPIN unlocks in {spinWait}s.</div>
        : <div className="pu-body pu-center" style={{ marginTop: 'auto' }}>Press SPIN. The wheel turns on the TV.</div>}
      <div className="pu-small pu-center">No rush. The host can spin for you.</div>
    </>, 'pu-red');
  }
  // TAKE IT FOR THEM: while a round waits, every phone that can step in gets one big key. Only from Home (never over a
  // must-act screen or a half-done move); never for the one at the wheel, the one just let off, the Angel, the Locker,
  // a phone with no card, or anyone who already took one tonight.
  const canTake = !!round && round.phase === 'waiting' && !!victim && !round.stand_in_id && victim.id !== me.id && round.original_victim_id !== me.id
    && !s.me.take_it_used && me.public_role !== 'angel' && !locked && me.has_role && !s.room.ended;
  const takeOpen = canTake && takeSkipped !== round!.id;
  // the check names the victim this phone saw: if the Scrooge swaps them meanwhile, the server refuses YES
  const takeFor = () => {
    const v = victim!, rid = round!.id;
    buzz(40);
    check({ face: v, ask: `TAKE ${v.name.toUpperCase()}'S PUNISHMENT?`, red: true, yes: "YES, I'LL TAKE IT",
      cost: `You face the wheel instead of ${v.name}. Once a night. Can't be undone.`, back: { k: 'home' },
      go: () => act('take_it', { round_id: rid, for: v.id }).then(() => { buzz(200); return done(`You're at the wheel for ${v.name}. Hit SPIN.`); }) });
  };
  if (takeOpen && spinWait > 0 && screen.k === 'home') {
    const vn = victim!.name, VN = vn.toUpperCase();
    return shell(<>
      <Row title={<span className="red">ANYONE STEPPING IN?</span>} slot={<Clock text={`${spinWait}s`} danger={spinWait <= 2} />} />
      <div className="pu-bigface"><Photo p={victim} /><div className="cap">{vn}</div></div>
      <div className="pu-display pu-center take-ask" style={{ marginTop: 8 }}>TAKE IT FOR {VN}?</div>
      <div className="pu-body pu-center pu-c-bone2">Once a night. {vn} can spin in {spinWait}s.</div>
      <div className="pu-keys">
        <Key lg variant="red" icon="shield" className="take-it" onClick={takeFor}>I'LL TAKE IT</Key>
        <Key variant="ghost" className="take-skip" onClick={() => setTakeSkipped(round!.id)}>NOT ME</Key>
      </div>
    </>, 'pu-take');
  }

  // THE BOOKIE: after every other takeover, and only from Home (never over a half-done move). Its own steps, apart from
  // the move path, so a YES here can never fire a move.
  if (betStep?.k === 'result') return shell(<Result key="bet-in" o={betStep.o} onDone={() => setBetStep(null)} />);
  if (betStep?.k === 'stake') {
    const st = betStep;
    if (!book || book.game_id !== st.game || book.status !== 'open') return shell(<Result key="bet-late" o={betRefused('Bets are closed')} onDone={() => setBetStep(null)} />);
    return shell(<BetStake pick={betPickName(s, book, st.opt)} caps={s.me.caps ?? 0} min={book.stake || 5}
      onBack={() => setBetStep(null)}
      onStake={n => { buzz(30); setBetStep({ k: 'check', game: st.game, opt: st.opt, face: st.face, stake: n, ask: betAsk(s, book, st.opt, n) }); }} />, 'pu-bet');
  }
  if (betStep?.k === 'check') {
    const st = betStep;
    return shell(<>
      <Row onBack={() => setBetStep(null)} title="THE BOOKIE" center slot={<span style={{ width: 64 }} />} />
      <Check face={st.face} question={st.ask} cost={`Winners share the pot. Wrong and the ${st.stake} caps are gone. Can't be undone.`} yes={`YES, BET ${st.stake}`}
        busy={busy} noLabel="NO, PICK AGAIN" onNo={() => setBetStep(null)}
        onYes={() => {
          setBusy(true);
          act('bet', { game_id: st.game, option: st.opt.id, stake: st.stake })
            .then(() => { buzz(60); setBetStep({ k: 'result', o: { tone: 'ok', kicker: 'BET IN', title: 'WATCH THE TV', line: `${st.stake} caps on ${st.opt.label}. How it went comes up here after the TV shows it.`, back: 'OK', count: 5 } }); })
            .catch(e => { buzz(200); setBetStep({ k: 'result', o: betRefused(errText(e)) }); })
            .finally(() => setBusy(false));
        }} />
    </>);
  }
  if (betDone && room.now() >= betDone.at && screen.k === 'home') {
    const b = betDone;
    return shell(<Result key={'bet-' + b.game} o={b.o} onDone={() => { lsSet(betKey('betres', b.game)); setBetDone(null); }} />);
  }
  if (book && book.status === 'open' && book.can_bet && !skippedBet(book.game_id) && screen.k === 'home' && !s.room.ended) {
    const bk = book;
    return shell(<BetPick s={s} book={bk} caps={capsShown}
      onPick={o => { buzz(30); setBetStep({ k: 'stake', game: bk.game_id, opt: o,
        face: o.player_id ? s.players.find(p => p.id === o.player_id) ?? null : dodgeTarget(s, bk) }); }}
      onSkip={() => { lsSet(betKey('nobet', bk.game_id)); setBetSkip(bk.game_id); }} />, 'pu-bet');
  }

  // ---------- the move path ----------
  if (screen.k === 'result') return shell(<Result o={screen.o} onDone={home} />);
  if (screen.k === 'check') return shell(<>
    <Row onBack={() => setScreen(screen.back)} title="CHECK" center slot={<span style={{ width: 64 }} />} />
    <Check face={screen.face} question={screen.ask} cost={screen.cost} yes={screen.yes} red={screen.red} busy={busy} onNo={() => setScreen(screen.back)} onYes={() => run(screen.go, screen.again)} />
  </>);
  if (screen.k === 'pick') {
    const c = screen.cfg;
    const people = s.players.filter(p => (c.include ? c.include.includes(p.id) : !c.exclude.includes(p.id)));
    return shell(<>
      <Row onBack={() => setScreen(screen.back)} title={c.title ?? 'PICK A PLAYER'} center slot={<span style={{ width: 64 }} />} />
      <div className="pu-small pu-center">{c.intro}</div>
      <div className="pu-grid2 pu-picker">{people.map(p => <PlayerRow key={p.id} p={p} note={c.notes?.(p)} onPick={() => c.next(p)} />)}</div>
    </>);
  }
  if (screen.k === 'list') return shell(<>
    <Row onBack={() => setScreen(screen.back)} title={screen.title} center slot={<span style={{ width: 64 }} />} />
    <div className="pu-small pu-center">{screen.intro}</div>
    <div className="pu-list">{screen.items.map(it => (
      <button key={it.key} type="button" className="pu-mrow pu-choice" onClick={it.pick}><div className="mt"><b>{it.label}</b>{it.sub && <span>{it.sub}</span>}</div></button>
    ))}</div>
  </>);
  if (screen.k === 'text') return <TextStep key={screen.title} shell={shell} {...screen} onBack={() => setScreen(screen.back)} />;
  if (screen.k === 'multi') return <MultiStep shell={shell} state={s} {...screen} onBack={() => setScreen(screen.back)} />;
  if (screen.k === 'evidence') return shell(<EvidenceStep backend={backend} act={act} count={s.me.evidence_count} onBack={home} onDone={() => setScreen({ k: 'result', o: done('Evidence filed. It goes up on the TV at the next Trial. Nobody sees it was you.') })} />);
  if (screen.k === 'code') return shell(<CodeStep act={act} onLater={() => { try { localStorage.setItem(CODE_LATER, '1'); } catch { /* ignore */ } home(); }} onOpened={() => setScreen({ k: 'file' })} />);
  if (screen.k === 'file') {
    if (!sec) return shell(<div className="pu-body pu-center" style={{ marginTop: 80 }}>Opening your file…</div>);   // the redeem landed; the state is on its way
    return shell(<RoleFile state={s} me={me} onHide={home} chip={idleChip('HIDES IN')} />);
  }

  // ---------- your moves: neutral steel rows for every role ----------
  const settings = s.room.settings;
  const waiting = round?.phase === 'waiting';
  const powerless = !sec || sec.burned || me.rehab || locked;
  // Level 1 is pacified: no active power for anyone (the server refuses them too). Passives carry on.
  const pacified = !!sec && sec.role !== 'angel' && lvl < 2;
  const perkRole0: Role | null = sec ? (sec.has_knife && sec.role !== 'intruder' ? 'intruder' : sec.role) : null;
  const noAngel = s.players.filter(p => p.public_role === 'angel').map(p => p.id);
  const inLocker = s.players.filter(p => p.locked_until && Date.parse(p.locked_until) > room.now()).map(p => p.id);
  const lockerNote = (p: Player) => (inLocker.includes(p.id) ? 'IN THE LOCKER' : p.public_role === 'angel' ? 'THE ANGEL' : undefined);
  const moves: Move[] = [];
  const toMoves: Screen = { k: 'moves' };
  // pick → check → go
  const pickThen = (intro: ReactNode, exclude: string[], cost: (p: Player) => ReactNode, go: (p: Player) => Promise<Outcome | void>, notes: (p: Player) => string | undefined = () => undefined, red = false) => {
    const again = () => setScreen({ k: 'pick', cfg, back: toMoves });
    const cfg: PickCfg = { intro, exclude, notes, next: p => check({ face: p, ask: `USE IT ON ${p.name.toUpperCase()}?`, cost: cost(p), yes: 'YES, USE IT', red, go: () => go(p), back: { k: 'pick', cfg, back: toMoves }, again }) };
    again();
  };
  const confirm = (ask: string, cost: ReactNode, go: Go, face?: Player | null) => check({ face, ask, cost, yes: 'YES, USE IT', go, back: toMoves });
  if (sec && !powerless && pacified && perkRole0 && PERKS[perkRole0]?.[0].startsWith('No powers yet')) {
    moves.push(perkRole0 === 'intruder'
      ? { key: 'level1', icon: 'pint', t: 'Slow the room down', s: 'Talk them out of the next beer. Keep them nursing it. Powers at Level 2', chip: 'LEVEL 1', info: true }
      : { key: 'level1', icon: 'lock', t: 'No powers yet', s: 'Your first one unlocks at Level 2', chip: 'LEVEL 1', info: true });
  }
  if (sec && !powerless && !pacified) {
    if (sec.role === 'medic' && sec.heals_left > 0) {
      const pending = new Set((sec.my_heals ?? []).filter(h => !h.used).map(h => h.name));
      const left = sec.heals_left;
      if (round && victim && waiting && victim.id !== me.id && !pending.has(victim.name)) {
        moves.push({ key: 'heal-now', icon: 'plus', t: 'Heal the one at the wheel', s: `${victim.name} · right now`, chip: `${left} LEFT`,
          run: () => confirm(`USE IT ON ${victim.name.toUpperCase()}?`, `Heal: ${victim.name}'s punishment is cancelled (their Lovebird's too). Uses 1 of your ${left}. Can't be undone.`,
            () => act('heal', { player_id: victim.id }).then(() => done(`${victim.name} is healed. Nobody is told it was you.`, [{ icon: 'check', text: `${left - 1} left` }])), victim) });
      }
      moves.push({ key: 'heal', icon: 'plus', t: 'Heal someone', s: 'Cancels their next punishment', chip: `${left} LEFT`,
        run: () => pickThen("Heal: cancels their next punishment. You'll check before it's used.", [me.id],
          p => `Heal: ${p.name}'s next punishment is cancelled. Uses 1 of your ${left}. Can't be undone.`,
          p => act('heal', { player_id: p.id }).then(() => { buzz(60); return done(`${p.name} is healed: their next punishment is cancelled. Nobody is told it was you.`, [{ icon: 'check', text: `${left - 1} left`, small: sec.evolved === 'surgeon' ? "Your heals can't be forged" : undefined }]); }),
          p => (pending.has(p.name) ? 'HEALED ALREADY' : undefined)) });
    }
    if (sec.role === 'medic') {
      if (sec.self_heal_ready) moves.push({ key: 'heal-self', icon: 'plus', t: 'Heal yourself', s: "Once · can't be forged", chip: 'READY',
        run: () => confirm('USE IT ON YOU?', "Heal: your next punishment is cancelled. Once. Can't be undone.", () => act('heal', { player_id: me.id }).then(() => done('Your next punishment is cancelled.')), me) });
      else if (lvl < 4) moves.push({ key: 'heal-self', icon: 'lock', t: 'Heal yourself', s: 'Unlocks at Level 4 (9 beers)', chip: 'LEVEL 4', info: true });
    }
    if (sec.role === 'forger' && !sec.forge_used && lvl < 3) moves.push({ key: 'forge', icon: 'lock', t: 'Forge a heal', s: 'Unlocks at Level 3 (6 beers)', chip: 'LEVEL 3', info: true });
    else if (sec.role === 'forger' && !sec.forge_used) {
      moves.push(sec.forge_ready
        ? { key: 'forge', icon: 'pen', t: 'Forge the heal', s: 'A heal was just written', chip: 'READY',
            run: () => confirm('USE IT?', "Forge: the heal that was just written won't work. Once tonight. You won't learn whose.", () => act('forge').then(() => done('Forged. Someone is in for a nasty surprise.'))) }
        : { key: 'forge', icon: 'pen', t: 'Forge a heal', s: 'Your phone buzzes when a heal is written', chip: 'WAITING', info: true });
    }
    if (sec.role === 'forger' && sec.frame_ready) moves.push({ key: 'frame', icon: 'search', t: 'Frame someone', s: "The Detective's next check on them says Saboteur", chip: 'ONCE',
      run: () => pickThen("Frame: the Detective's next check on them reads Saboteur.", [me.id], p => `Frame: the Detective's next check on ${p.name} says Saboteur. Once. Can't be undone.`,
        p => act('frame', { player_id: p.id }).then(() => done(`Evidence planted on ${p.name}.`))) });
    if (sec.role === 'forger' && sec.orders_ready) {
      const nameOf = (id: string) => s.players.find(p => p.id === id)?.name ?? '?';
      const queued = s.queue.filter(q => !spoilsMiniGame(s, room.now())(q));
      moves.push(queued.length
        ? { key: 'orders', icon: 'pen', t: 'Forged orders', s: 'Rewrite the name on a waiting punishment', chip: 'ONCE',
            run: () => setScreen({ k: 'list', title: 'PICK ONE', intro: 'Pick a punishment waiting in the queue. Next you choose whose name goes on it.', back: toMoves,
              items: queued.map(q => ({ key: q.id, label: `${nameOf(q.player_id)}: ${q.reason}${q.times > 1 ? ` ×${q.times}` : ''}`,
                pick: () => pickThen(`Whose name goes on ${nameOf(q.player_id)}'s punishment?`, [q.player_id, ...inLocker, ...noAngel],
                  p => `Forged orders: ${nameOf(q.player_id)}'s "${q.reason}" goes to ${p.name}. The TV never says who. Can't be undone.`,
                  p => act('forged_orders', { queue_id: q.id, player_id: p.id }).then(() => done(`Signed, sealed: ${p.name} takes it now.`))) })) }) }
        : { key: 'orders', icon: 'pen', t: 'Forged orders', s: 'Nothing is waiting in the queue yet', chip: 'WAITING', info: true });
    }
    if (sec.role === 'detective') {
      if (!(sec.pending_check ?? readCheck) && sec.checks_left > 0) moves.push({ key: 'investigate', icon: 'search', t: 'Investigate someone', s: lvl <= 2 ? 'A vague reading, 3 people' : 'A reading, 2 people', chip: `${sec.checks_left} LEFT`,
        run: () => pickThen("Investigate: you'll get a reading to hold and read.", [me.id], p => `Investigate: a reading on ${p.name} and others. Uses 1 of your ${sec.checks_left}.`,
          p => act('investigate', { player_id: p.id }).then(() => done('Your reading is ready. Open your moves somewhere private and hold to read it.'))) });
      if (sec.evolved === 'dredd' && sec.shame_ready) moves.push({ key: 'shame', icon: 'gavel', t: 'Walk of shame', s: 'On the TV, with your caption', chip: 'ONCE',
        run: () => setScreen({ k: 'pick', back: toMoves, cfg: { intro: 'Walk of shame: their photo on the TV with your caption. They drink.', exclude: [me.id, ...inLocker, ...noAngel], notes: lockerNote,
          next: p => setScreen({ k: 'text', title: 'TYPE IT', intro: `What the TV shows under ${p.name}'s photo.`, placeholder: 'e.g. Spilled a whole pint', back: toMoves,
            next: t => confirm(`USE IT ON ${p.name.toUpperCase()}?`, `Walk of shame: "${t}" under ${p.name}'s photo. They drink.`, () => act('dredd_shame', { player_id: p.id, caption: t }).then(() => done('It\'s on the TV.')), p) }) } }) });
    }
    if (sec.role === 'davyjones' && sec.lock_ready) moves.push({ key: 'lock', icon: 'anchor', t: 'The Locker', s: `Safe from the wheel for ${sec.lock_minutes} min`, chip: 'ONCE',
      run: () => pickThen(`The Locker: ${sec.lock_minutes} min safe from the wheel, but no powers or vote.`, [me.id, ...inLocker, ...noAngel], p => `The Locker: ${p.name} sleeps with the fishes for ${sec.lock_minutes} min. Can't be undone.`,
        p => act('davy_lock', { player_id: p.id }).then(() => done(`${p.name} is sleeping with the fishes.`)), lockerNote) });
    if (sec.role === 'davyjones' && sec.plank_ready) moves.push({ key: 'plank', icon: 'anchor', t: 'Walk the plank', s: 'Pick 3 · furthest from the edge drinks', chip: 'ONCE',
      run: () => setScreen({ k: 'multi', n: 3, intro: 'Walk the plank: pick 3. They inch along a plank on their phones.', exclude: [me.id, ...inLocker, ...noAngel], back: toMoves,
        next: ids => confirm('USE IT ON THESE 3?', `Walk the plank: ${ids.map(i => s.players.find(p => p.id === i)?.name).join(', ')} are called to the TV.`, () => act('plank_start', { player_ids: ids }).then(() => done('They\'re being called to the TV.'))) }) });
    if (sec.role === 'assassin' && sec.dodge_ready) moves.push({ key: 'dodge', icon: 'star', t: 'Dodge', s: 'They guess where it comes from', chip: 'ONCE',
      run: () => setScreen({ k: 'pick', back: toMoves, cfg: { intro: 'Dodge: they are called to the TV and guess where it comes from.', exclude: [me.id, ...inLocker, ...noAngel], notes: lockerNote,
        next: p => setScreen({ k: 'list', title: 'PICK ONE', intro: `${p.name} has to guess this. Right and it misses.`, back: toMoves,
          items: [['left', 'From the left'], ['high', 'From above'], ['right', 'From the right']].map(([dir, label]) => ({ key: dir, label,
            pick: () => confirm(`USE IT ON ${p.name.toUpperCase()}?`, `Dodge: thrown ${label.toLowerCase()}. ${p.name} is called to the TV. The TV never shows who threw it.`,
              () => act('dodge_throw', { player_id: p.id, dir }).then(() => done(`Thrown. ${p.name} is being called to the TV.`)), p) })) }) } }) });
    if (sec.role === 'assassin' && sec.strike_ready) moves.push({ key: 'strike', icon: 'star', t: 'Shuriken', s: 'Silent · straight to the wheel', chip: 'ONCE',
      run: () => pickThen('Shuriken: silent, straight to the wheel.', [me.id, ...noAngel], p => `Shuriken: ${p.name} goes straight to the wheel. Nobody sees who. Can't be undone.`,
        p => act('ninja_strike', { player_id: p.id }).then(() => done(`${p.name} is off to the wheel. Nobody saw a thing.`)), p => (p.public_role === 'angel' ? 'THE ANGEL' : undefined)) });
    if (sec.role === 'jester' && sec.jack_ready) moves.push({ key: 'jack', icon: 'users', t: 'Jack-in-the-box', s: 'Pick 4 · whoever pops it drinks', chip: 'ONCE',
      run: () => setScreen({ k: 'multi', n: 4, intro: 'Jack-in-the-box: pick 4 (you can pick yourself). They take turns cranking.', exclude: [...inLocker, ...noAngel], back: toMoves,
        next: ids => confirm('USE IT ON THESE 4?', `Jack-in-the-box: ${ids.map(i => s.players.find(p => p.id === i)?.name).join(', ')} are called to the TV.`, () => act('jack_start', { player_ids: ids }).then(() => done('They\'re being called to the TV.'))) }) });
    if (sec.bomb_ready) moves.push({ key: 'bomb', icon: 'flame', t: 'The bomb', s: 'A hot potato on every phone · secret fuse', chip: 'ONCE',
      run: () => confirm('USE IT?', 'The bomb: it lands on a phone and gets passed around. Whoever holds it when it goes off loses. Once per game.', () => act('bomb_start').then(() => done('The fuse is lit.'))) });
    if (sec.role === 'scrooge' && sec.penny_ready) moves.push({ key: 'penny', icon: 'star', t: 'Penny drop', s: 'Everyone calls your coin · wrong ones drink', chip: 'ONCE',
      run: () => confirm('USE IT?', 'Penny drop: everyone calls heads or tails on their phone. Wrong, or silent, and they drink. Once per game.', () => act('penny_start').then(() => done('The coin is spinning.'))) });
    if (sec.role === 'skank' && sec.bbq_ready) moves.push({ key: 'bbq', icon: 'flame', t: "Aaron's plate", s: 'Everyone grabs a sausage · one is dirty', chip: 'ONCE',
      run: () => confirm('USE IT?', "Aaron's plate: everyone grabs a sausage on their phone. Whoever gets the dirty one drinks. Once per game.", () => act('bbq_start').then(() => done('The BBQ is lit.'))) });
    if ((sec.role === 'intruder' || sec.has_knife) && sec.hit_ready) moves.push({ key: 'hit', icon: 'blade', t: 'The hit', s: "Name someone's secret role", chip: 'ONCE',
      run: () => setScreen({ k: 'pick', back: toMoves, cfg: { intro: "The hit: name their secret role. Right and their cover's blown.", exclude: [me.id, ...s.players.filter(p => p.public_role).map(p => p.id)],
        next: p => setScreen({ k: 'list', title: 'PICK ONE', intro: `Your guess for ${p.name}. Wrong and your knife goes blunt.`, back: toMoves,
          items: HIT_ROLES.map(r => ({ key: r, label: ROLES[r].label,
            pick: () => check({ face: p, ask: `USE IT ON ${p.name.toUpperCase()}?`, cost: `The hit: you say ${p.name} is the ${ROLES[r].label}. Wrong: your knife is blunt for the night.`, yes: 'YES, USE IT', red: true, back: toMoves,
              go: () => act('hit', { player_id: p.id, role: r }).then(res => {
                const clue = res.drinkers === undefined ? '' : res.drinkers ? ` Clue: ${p.name} IS on the Drinkers team.` : ` Clue: ${p.name} is NOT on the Drinkers team.`;
                return res.correct ? done(`${p.name} was the ${ROLES[r].label}. Their powers are burned. Your knife stays sharp.`)
                  : { tone: 'no', kicker: 'NOT THIS TIME', title: "DIDN'T GO THROUGH", line: `${p.name} isn't the ${ROLES[r].label}. Nobody was told. That's your last hit tonight.${clue}` } as Outcome;
              }) }) })) }) } }) });
    if (sec.role === 'betrayer' && !sec.has_knife && !allies.length && sec.guesses_left > 0) moves.push({ key: 'accuse', icon: 'search', t: 'Find the Intruder', s: 'Wrong = drink', chip: `${sec.guesses_left} LEFT`,
      run: () => pickThen('Find the Intruder: you name who you think it is. Wrong and you drink.', [me.id, ...sec.guessed], p => `Accuse: you say ${p.name} is the Intruder. Wrong and you drink. They're never told.`,
        async p => { const r = await act('betrayer_guess', { player_id: p.id }); return r.correct ? done('You found them. Welcome to the Saboteurs.') : { tone: 'no', kicker: 'NOT THIS TIME', title: "DIDN'T GO THROUGH", line: `${p.name} isn't the Intruder. Take a drink. They weren't told.` } as Outcome; },
        p => (sec.guessed.includes(p.id) ? 'GUESSED ALREADY' : undefined)) });
    if (sec.role === 'betrayer' && sec.hint_ready) moves.push({ key: 'hint', icon: 'search', t: 'Get a hint', s: 'The Intruder is one of 3 names', chip: 'READY',
      run: () => confirm('USE IT?', 'Hint: your file shows 3 names. One of them is the Intruder.', () => act('betrayer_hint').then(() => done('The 3 names are in your file.'))) });
    if (sec.role === 'betrayer' && sec.hint && !sec.has_knife && !allies.length) moves.push({ key: 'hint-read', icon: 'info', t: 'The Intruder is one of', s: sec.hint.join(', '), chip: 'HINT', info: true });
    if (sec.role === 'scrooge' && round && victim && settings.scrooge_swap && waiting && !sec.swap_used) moves.push({ key: 'swap', icon: 'swap', t: 'Swap the one at the wheel', s: `${victim.name} gets away`, chip: lvl >= 4 ? '2 A NIGHT' : 'ONCE',
      run: () => pickThen(`Swap: someone else takes ${victim.name}'s place at the wheel.`, [victim.id], p => `Swap: ${p.name} takes ${victim.name}'s place at the wheel. Can't be undone.`,
        p => act('scrooge_swap', { round_id: round.id, player_id: p.id }).then(() => done(`Swapped. ${p.name} is at the wheel now.`))) });
    if (sec.role === 'scrooge' && round && settings.scrooge_respin && round.phase === 'revealed' && round.revealed_at && sec.respins_left > 0) {
      const left = Date.parse(round.revealed_at) + RESPIN_WINDOW - room.now();
      if (left > 0) moves.push({ key: 'respin', icon: 'wheel', t: 'Spin it again', s: `${sec.respins_left} left tonight`, chip: `${Math.ceil(left / 1000)}s`,
        run: () => confirm('USE IT?', 'Re-spin: the wheel spins again, right now.', () => act('scrooge_respin', { round_id: round.id }).then(() => done('Spinning again.'))) });
    }
    if (sec.role === 'scrooge' && settings.scrooge_graffiti && !sec.graffiti_used && lvl >= 3) moves.push({ key: 'graffiti', icon: 'pen', t: 'Wheel graffiti', s: 'Add your own punishment', chip: 'ONCE',
      run: () => setScreen({ k: 'text', title: 'TYPE IT', intro: 'It goes on the wheel for the rest of the night. Max 60 letters.', placeholder: 'e.g. Lick the floor', back: toMoves,
        next: t => confirm('USE IT?', `Graffiti: "${t}" goes on the wheel. Once. Can't be undone.`, () => act('scrooge_graffiti', { text: t }).then(() => done('Your graffiti is on the wheel.'))) }) });
  }
  if (sec?.role === 'angel' && !locked) {
    if (sec.nova_ready) moves.push({ key: 'nova', icon: 'star', t: 'Holy nova', s: `+${sec.nova_beers} beers for the group`, chip: 'ONCE',
      run: () => confirm('USE IT?', `Holy nova: +${sec.nova_beers} beers go on the tally. Once a night.`, () => act('holy_nova').then(() => done(`+${sec.nova_beers} on the tally.`))) });
    else if (!sec.nova_used) moves.push({ key: 'nova', icon: 'star', t: 'Holy nova', s: `Only while the tally is more than ${sec.nova_beers} short`, chip: 'WAITING', info: true });
    if (sec.bless_ready) moves.push({ key: 'bless', icon: 'shield', t: 'Bless the wheel', s: 'One punishment becomes SAFE for good', chip: 'ONCE',
      run: () => setScreen({ k: 'list', title: 'BLESS WHICH?', intro: 'It turns into SAFE for the rest of the night.', back: toMoves,
        items: s.room.segments.map((t, i) => ({ t, i })).filter(x => !/^\s*safe\b/i.test(x.t)).map(({ t, i }) => ({ key: String(i), label: t,
          pick: () => confirm('USE IT?', `Bless: "${t}" becomes SAFE for the rest of the night.`, () => act('angel_bless', { index: i }).then(() => done('Blessed. It\'s SAFE now.'))) })) }) });
  }
  if (sec?.role === 'skank') moves.push({ key: 'skank', icon: 'pint', t: `Your beers count ${lvl >= 4 ? 'triple' : 'double'}`, s: `Hidden bonus so far: +${sec.skank_bonus ?? 0}${sec.burned ? ' (frozen)' : ''}`, chip: 'SECRET', info: true });
  if (sec?.role === 'jester' && me.public_role !== 'jester' && !sec.burned) moves.push({ key: 'jester', icon: 'info', t: 'Act shifty', s: 'Convicted at a Trial? You pick who takes ×3', chip: 'WAITING', info: true });
  const curseTargets = s.me.curse_targets ?? [];
  if (me.cursed && !locked && curseTargets.length) moves.push({ key: 'curse', icon: 'skull', t: 'Pass the curse', s: 'To someone you just beat', chip: 'ONCE',
    run: () => setScreen({ k: 'pick', back: toMoves, cfg: { intro: 'Pass the curse to someone you just beat.', exclude: [], include: curseTargets,
      next: p => check({ face: p, ask: `PASS IT TO ${p.name.toUpperCase()}?`, cost: `The curse: ${p.name}'s spins are doubled from now on. Can't be undone.`, yes: 'YES, PASS IT', back: toMoves,
        go: () => act('request_curse_pass', { player_id: p.id }).then(() => done(`The curse is ${p.name}'s problem now.`)) }) } }) });
  const shiv = me.rehab ? s.me.shiv : null;
  if (shiv && !locked) {
    if (shiv.ready) moves.push({ key: 'shiv', icon: 'blade', t: 'The shiv', s: 'On the TV · their next punishment ×2', chip: 'ONCE',
      run: () => pickThen('The shiv: their next punishment counts double.', [me.id, ...s.players.filter(p => p.public_role === 'angel' || p.shivved_by).map(p => p.id)],
        p => `The shiv: ${p.name}'s next punishment counts double. It shows on the TV. Can't be undone.`, p => act('shiv', { player_id: p.id }).then(() => done(`${p.name} is shivved.`)), p => (p.shivved_by ? 'SHIVVED ALREADY' : lockerNote(p)), true) });
    else moves.push({ key: 'shiv', icon: 'blade', t: 'The shiv', s: shiv.used_this_game && shiv.beers_to_go === 0 ? 'Used this game. Ready after the next game.' : `${plural(shiv.beers_to_go, 'more beer')} in rehab earns one`, chip: 'WAITING', info: true });
  }
  moves.push({ key: 'evidence', icon: 'camera', t: 'Evidence', s: `Snap a cheat · anonymous${s.me.evidence_count ? ` · ${s.me.evidence_count} sent` : ''}`, chip: 'READY', run: () => setScreen({ k: 'evidence' }) });
  if (!locked && me.public_role !== 'angel' && sec) moves.push(me.lock_requested
    ? { key: 'rest', icon: 'anchor', t: 'Ask for a rest', s: 'Asked the host. Hang on.', chip: 'SENT', info: true }
    : { key: 'rest', icon: 'anchor', t: 'Ask for a rest', s: 'The host puts you in the Locker', chip: 'READY',
        run: () => confirm('ASK THE HOST?', "A rest in Davy Jones' Locker: no punishments, no moves, no vote for a while. The host decides.", () => act('request_lock').then(() => done('Sent to the host.'))) });

  if (screen.k === 'moves') {
    const check0 = sec?.role === 'detective' && !powerless ? sec.pending_check ?? readCheck : null;
    const wait = Math.ceil(stageLeft / 1000);
    return shell(<>
      <Row title="YOUR MOVES" slot={idleChip('CLOSES IN')} />
      {check0 && <HoldToRead key={check0.id} check={check0} backend={backend} roomId={s.room.id} onStart={() => { setReadCheck(check0); setTimeout(() => setReadCheck(null), 9000); }} />}
      {wait > 0 && <Facts facts={[{ icon: 'tv', text: "Someone's move is on the TV", small: `Yours can go in ${wait}s` }]} />}
      <div className="pu-list">{moves.map(m => (
        <button key={m.key} type="button" data-move={m.key} className={'pu-mrow' + (m.info ? ' info' : '')} disabled={!m.run}
          onClick={() => { if (!m.run) return; if (wait > 0 && !['evidence', 'rest'].includes(m.key)) setScreen({ k: 'result', o: { tone: 'wait', kicker: 'HOLD ON', title: 'THE TV IS BUSY', line: "Someone else's move is on. Nothing was used.", facts: [{ icon: 'clock', text: `Try again in ${wait} seconds` }], back: 'BACK TO HOME' } }); else m.run(); }}>
          <div className="mi"><Icon n={m.icon} /></div>
          <div className="mt"><b>{m.t}</b><span>{m.s}</span></div>
          <span className="pu-chip">{wait > 0 && m.run && !['evidence', 'rest'].includes(m.key) ? `WAIT ${wait}s` : m.chip}</span>
        </button>
      ))}</div>
      <div className="pu-keys"><Key lg variant="steel" icon="lock" onClick={home}>CLOSE THE CASE</Key></div>
    </>);
  }

  // ---------- home ----------
  const result = s.room.result;
  const mgName = s.minigame && (s.minigame.status === 'live' || s.minigame.status === 'muster') ? s.minigame.kind : null;
  const now: { icon: IconName; k: string; t: string; d: string; red?: boolean } =
    s.room.ended && result ? { icon: 'star', k: "Time's up", t: result.winner === 'group' ? 'The group wins' : 'The Saboteurs win', d: 'Look at the TV.' }
    : round && victim ? { icon: 'wheel', k: 'Now on the TV', t: `${victim.name} ${round.phase === 'waiting' ? 'is facing the wheel' : round.phase === 'saved' ? 'was saved' : 'is spinning'}`, d: 'You: just drink.' }
    : round ? { icon: 'wheel', k: 'Now on the TV', t: 'The whole room is spinning', d: 'You: watch the TV.' }
    : vote && vote.status === 'open' ? { icon: 'gavel', k: 'Now on the TV', t: 'The Trial is on', d: me.rehab || locked ? 'You: sit this one out.' : 'You: vote on your phone.', red: true }
    : mgName ? { icon: 'tv', k: 'Now on the TV', t: 'A mini-game is on', d: 'You: watch the TV.' }
    : stageLeft > 0 ? { icon: 'tv', k: 'Now on the TV', t: "Someone's move is on", d: 'You: just drink.' }
    : s.game?.status === 'active' ? { icon: 'users', k: 'Now', t: s.game.name, d: 'You: play, and drink.' }
    : { icon: 'tv', k: 'Now', t: 'Nothing on the TV', d: 'You: just drink.' };
  const toGo = Math.max(0, s.room.target - s.room.tally);
  const tLeft = Math.max(0, Date.parse(s.room.deadline_at) - room.now());
  // the level strip: beers to the next level, or (when the beers are there but the game cap holds you) the next game
  const li = s.me.level_info;
  const next = lvl >= 4 ? null : li ? li.beers_to_next : Math.max(0, LEVEL_BEERS[lvl] - me.beers);
  const waitGame = lvl < 4 && !!li?.waiting_on_game;
  const lvlFrom = LEVEL_BEERS[lvl - 1], lvlTo = LEVEL_BEERS[Math.min(3, lvl)];
  const lvlPct = lvl >= 4 || waitGame || !next ? 1 : Math.max(0, Math.min(1, (me.beers - lvlFrom) / Math.max(1, lvlTo - lvlFrom)));
  const beer = (
    <button type="button" className={'pu-key pu-beer' + (cooldown > 0 ? ' cool' : '')} disabled={cooldown > 0 || beerBusy || s.room.ended} onClick={logBeer}>
      <span className="pu-glass"><Icon n={cooldown > 0 ? 'check' : 'pint'} /></span>
      <span><span className="l1">{cooldown > 0 ? 'LOGGED' : <>I FINISHED<br />A BEER</>}</span><span className="l2">{cooldown > 0 ? `NEXT IN ${mmss(cooldown)}` : locked ? 'STILL COUNTS' : '+1 TO THE ROOM'}</span></span>
      {cooldown > 0 && <span className="pu-cool-bar"><i style={{ transform: `scaleX(${Math.min(1, cooldown / coolTotal.current)})` }} /></span>}
    </button>
  );
  const dock = <div className="pu-dock"><Reactions backend={backend} roomId={s.room.id} /></div>;
  // the night is over: your side's result, your own role, your beers, the final tally. No level nag, no beer key.
  if (s.room.ended) return shell(<><EndOfNight s={s} me={me} />{dock}</>);
  if (locked) {
    const until = Date.parse(me.locked_until!);
    return shell(<>
      <div className="pu-locker">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="pu-port"><Icon n="anchor" /></div>
          <div><div className="pu-kick pu-c-sea" style={{ fontSize: 16 }}>DAVY JONES' LOCKER</div><div className="pu-h2" style={{ marginTop: 4 }}>Sleeping with<br />the fishes</div></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '12px 0' }}>
          <Clock sea big text={clock(until - room.now())} />
          <div className="pu-small" style={{ color: '#e6f8ff' }}>left<br />out at {new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <Facts facts={[{ icon: 'shield', text: 'No punishments', small: me.held ? "1 is waiting when you're out" : undefined }, { icon: 'cross', text: 'No moves, no vote' }]} />
      </div>
      {beer}
      {dock}
    </>, 'pu-sea');
  }
  return shell(<>
    <button type="button" className={'pu-now' + (now.red ? ' red' : '') + (s.room.ended ? ' ended' : '')} onClick={() => setNowSheet(true)}>
      <span className="nb"><Icon n={now.icon} /></span>
      <span><span className="nk"><span className="pu-lamp" />{now.k}</span><span className="nt" style={{ display: 'block' }}>{now.t}</span><span className="nd" style={{ display: 'block' }}>{now.d}</span></span>
    </button>
    {takeOpen && (
      <div className="pu-take-mini">
        <Key variant="red" icon="shield" className="take-it" onClick={takeFor}>TAKE IT FOR {victim!.name.toUpperCase()}</Key>
        <Key variant="ghost" className="take-skip" onClick={() => setTakeSkipped(round!.id)}>NOT ME</Key>
      </div>
    )}
    <div className="pu-card pu-tally">
      <Clock big text={String(s.room.tally)} of={`/${s.room.target}`} />
      <div className="pu-tally-r"><span className="big">{toGo ? `${toGo} TO GO` : 'TARGET HIT'}</span><span className="sm">{s.room.ended ? 'Time\'s up' : untilText(tLeft, s.room.deadline_at)}</span></div>
      <div className="pu-leds">{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.round(20 * Math.min(1, s.room.tally / Math.max(1, s.room.target))) ? 'on' : ''} />)}</div>
    </div>
    {beer}
    <div className="pu-card pu-lvl">
      <div className="pu-lvl-top"><b>LEVEL {lvl}</b><span className="nx">{lvl >= 4 ? 'MAX LEVEL'
        : waitGame || !next ? <><span className="pu-c-sodium">Level {lvl + 1}</span> after the next game</>
        : <>{plural(next, 'more beer')} → <span className="pu-c-sodium">Level {lvl + 1}</span></>}</span></div>
      <div className="pu-bar"><i style={{ width: `${Math.round(lvlPct * 100)}%` }} /></div>
    </div>
    <div className="pu-tiles">
      <button type="button" className="pu-tile pu-tile-file file-tile" onClick={() => setScreen(sec ? { k: 'file' } : { k: 'code' })}>
        <span className="tab" /><span className="pu-stamp">CONFIDENTIAL</span>
        <span className="pu-h2">YOUR FILE</span><span className="how"><Icon n="tap" />{sec ? 'Tap to open' : 'Enter your code'}</span>
      </button>
      <button type="button" className="pu-tile pu-tile-moves moves-tile" onClick={() => setScreen({ k: 'moves' })}>
        <span className="latch"><Icon n="lock" /></span>
        <span className="pu-h2">YOUR MOVES</span><span className="how"><Icon n="tap" />Tap to open</span>
      </button>
    </div>
    {dock}
    {nowSheet && <NowSheet s={s} now={now} nowMs={room.now()} onClose={() => setNowSheet(false)} />}
  </>);
}

// ---------- end of the night ----------
// Only YOUR side and YOUR role (from your own secret). Other players' roles appear only after the host's REVEAL ALL.
// Until then the big line is the GROUP's result, the same on every phone: a glance at "YOU LOST" when the group won
// would out a Saboteur. Your own result (won/lost, role, team) sits behind a cover you tap, and it covers itself
// again after END_RESULT_MS. After the reveal everyone knows, so YOU WON / YOU LOST goes up openly.
function EndOfNight({ s, me }: { s: GameState; me: Player }) {
  const res = s.room.result, sec = s.me.secret;
  const final = s.room.final_tally ?? s.room.tally, target = s.room.target;
  const side: Team | null = !sec ? null : sec.team === 'chaos' ? 'chaos'
    : sec.team === 'guilty' || sec.has_knife || (sec.role === 'betrayer' && (sec.allies?.length ?? 0) > 0) ? 'guilty' : 'drinkers';
  const won = res && side && side !== 'chaos' ? (res.winner === 'group') === (side === 'drinkers') : null;
  const revealed = !!s.room.revealed;
  const [openAt, setOpenAt] = useState<number | null>(null);
  useEffect(() => { if (openAt === null) return; const t = setTimeout(() => setOpenAt(null), Math.max(0, openAt + END_RESULT_MS - Date.now())); return () => clearTimeout(t); }, [openAt]);
  const tone = won === true ? 'ok' : won === false ? 'no' : 'wait';
  const groupTitle = !res ? "TIME'S UP" : res.winner === 'group' ? 'THE GROUP WINS' : 'THE SABOTEURS WIN';
  const mine = won === true ? 'YOU WON' : won === false ? 'YOU LOST' : side === 'chaos' ? 'NO SIDE' : null;
  const line = !res ? 'The TV is counting the last beers.'
    : res.winner === 'group' ? 'The group hit the target. The Drinkers win.' : 'The group fell short. The Saboteurs win.';
  const short = Math.max(0, target - final);
  const roleFact: Fact[] = sec ? [{ icon: 'lock', text: `You were the ${sec.evolved ? EVOLVED[sec.evolved] : ROLES[sec.role].label}`, small: `Team: ${TEAMS[side ?? sec.team].label}${side === 'chaos' ? ' · you played for chaos' : ''}` }] : [];
  const beerFact: Fact = { icon: 'pint', text: `${plural(me.beers, 'beer')} tonight`, small: `You finished on Level ${s.me.level_info?.level ?? levelOf(me)}` };
  const rv = revealed ? s.room.reveal : null;
  const nm = (id: string) => s.players.find(p => p.id === id)?.name ?? '?';
  const roleOf = (id: string) => s.players.find(p => p.id === id)?.public_role;
  // before the reveal the top of the screen looks the same on every phone
  const heroTone = revealed ? tone : 'wait';
  const left = openAt === null ? 0 : Math.max(0, Math.ceil((openAt + END_RESULT_MS - Date.now()) / 1000));
  return (<>
    <div className={'pu-verdict ' + heroTone} style={{ marginTop: 16 }}><Icon n={heroTone === 'ok' ? 'check' : heroTone === 'no' ? 'cross' : 'star'} /></div>
    <div className={'pu-kick pu-center ' + (heroTone === 'ok' ? 'pu-c-green' : heroTone === 'no' ? 'pu-c-red' : 'pu-c-sodium')} style={{ marginTop: 16 }}>END OF THE NIGHT</div>
    <div className="pu-hero pu-center">{revealed ? (mine ?? groupTitle) : groupTitle}</div>
    <div className="pu-body pu-center pu-c-bone2">{line}</div>
    <div className="pu-card pu-tally pu-end-tally">
      <Clock big text={String(final)} of={`/${target}`} />
      <div className="pu-tally-r"><span className="big">{short ? `${short} SHORT` : 'TARGET HIT'}</span><span className="sm">The final tally</span></div>
    </div>
    {revealed || !sec ? <Facts facts={[...roleFact, beerFact]} /> : <>
      {openAt === null ? (
        <button type="button" className="pu-tile pu-tile-file file-tile pu-end-cover" style={{ width: '100%', boxSizing: 'border-box' }} onClick={() => { buzz(); setOpenAt(Date.now()); }}>
          <span className="tab" /><span className="pu-stamp">CONFIDENTIAL</span>
          <span className="pu-h2">YOUR RESULT</span><span className="how"><Icon n="tap" />Tap to open · hide it from the room</span>
        </button>
      ) : (
        <div className="pu-card pu-end-mine" onClick={() => setOpenAt(null)}>
          <div className="pu-label" style={{ display: 'flex', justifyContent: 'space-between' }}><span>YOUR RESULT</span><span className={'pu-chip' + (left <= 3 ? ' red' : '')}><Icon n="clock" />HIDES IN {left}s</span></div>
          <div className={'pu-display ' + (tone === 'ok' ? 'pu-c-green' : tone === 'no' ? 'pu-c-red' : 'pu-c-sodium')} style={{ margin: '8px 0' }}>{mine ?? groupTitle}</div>
          <Facts facts={roleFact} />
          <div className="pu-small pu-center">Tap to hide</div>
        </div>
      )}
      <Facts facts={[beerFact]} />
    </>}
    {rv ? <>
      <div className="pu-label" style={{ marginTop: 4 }}>THE SABOTEURS WERE</div>
      <Facts facts={rv.guilty.length ? rv.guilty.map(id => ({ icon: 'blade' as IconName, text: nm(id), small: ROLES[roleOf(id) ?? 'drinker']?.label })) : [{ icon: 'check', text: 'Nobody' }]} />
    </> : <div className="pu-small pu-center">Everyone's roles go up on the TV at the reveal.</div>}
  </>);
}

// ---------- the NOW sheet: what's on the TV, who's queued, who's drinking ----------
function NowSheet({ s, now, nowMs, onClose }: { s: GameState; now: { t: string; d: string }; nowMs: number; onClose: () => void }) {
  const [tab, setTab] = useState<'tv' | 'queue' | 'beers'>('tv');
  const name = (id: string) => s.players.find(p => p.id === id)?.name ?? '?';
  const spoils = spoilsMiniGame(s, nowMs);
  const queue = s.queue.filter(q => !spoils(q));
  return (
    <div className="pu-sheet" onClick={onClose}>
      <div className="pu-sheet-in" onClick={e => e.stopPropagation()}>
        <div className="pu-tabs">
          {(['tv', 'queue', 'beers'] as const).map(t => <button key={t} type="button" className={'pu-tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t === 'tv' ? 'TV' : t === 'queue' ? 'QUEUE' : 'BEERS'}</button>)}
        </div>
        <div className="pu-card">
          {tab === 'tv' && <div className="pu-frow"><div className="tx">{now.t}<small>{now.d}</small></div></div>}
          {tab === 'queue' && (queue.length ? queue.map((q, i) => <div key={q.id} className="pu-frow"><span className="tm">{i + 1}</span><div className="tx">{name(q.player_id)}<small>{q.reason}{q.times > 1 ? ` ×${q.times}` : ''}</small></div></div>)
            : <div className="pu-frow"><div className="tx">Nobody is waiting for the wheel.</div></div>)}
          {tab === 'beers' && [...s.players].sort((a, b) => b.beers - a.beers).map(p => <div key={p.id} className="pu-frow"><span className="tm">{p.beers}</span><div className="tx">{p.name}</div></div>)}
        </div>
        <Key lg variant="steel" onClick={onClose}>CLOSE</Key>
      </div>
    </div>
  );
}

// ---------- the confidential file ----------
function RoleFile({ state, me, onHide, chip }: { state: GameState; me: Player; onHide: () => void; chip: ReactNode }) {
  const sec = state.me.secret!;
  const R = ROLES[sec.role], T = TEAMS[sec.team];
  const perkRole: Role = sec.has_knife && sec.role !== 'intruder' ? 'intruder' : sec.role;
  const perks = PERKS[perkRole], lvl = state.me.level_info?.level ?? sec.level ?? levelOf(me);
  const waitGame = !!state.me.level_info?.waiting_on_game;
  const heals = sec.my_heals ?? [];
  const lines: string[] = [];
  if (sec.burned) lines.push('Cover blown. Powers burned.');
  if (me.rehab) lines.push('In rehab. No powers, no vote. Every 3 beers earns a shiv.');
  if (sec.role === 'medic') lines.push(`${plural(sec.heals_left, 'heal')} left${heals.length ? ` · written: ${heals.map(h => h.name + (h.used ? ' (used)' : '')).join(', ')}` : ''}`);
  if (sec.role === 'forger') lines.push(`Forgery ${sec.forge_used ? 'used' : 'ready'} · frame ${sec.frame ? `on ${sec.frame.name}${sec.frame.spent ? ' (read)' : ''}` : sec.frame_ready ? 'ready' : 'used'}`);
  if (sec.role === 'detective') lines.push(`${plural(sec.checks_left, 'investigation')} left${sec.checked?.length ? ` · checked: ${sec.checked.join(', ')}` : ''}`);
  if (sec.role === 'betrayer' && !sec.has_knife) lines.push(`${sec.guesses_left} guess${sec.guesses_left === 1 ? '' : 'es'} left${sec.hint ? ` · the Intruder is one of: ${sec.hint.join(', ')}` : ''}`);
  if (sec.role === 'intruder' || sec.has_knife) lines.push(`${sec.has_knife && sec.role !== 'intruder' ? 'You hold the knife. ' : ''}${sec.hit_alive ? (sec.hit_ready ? 'Hit ready' : 'Next hit after the next game') : 'Knife blunt'}`);
  if (sec.role === 'skank') lines.push(`Hidden bonus: +${sec.skank_bonus ?? 0} beers`);
  if (sec.role === 'jester') lines.push(`Revenge ${me.public_role === 'jester' || sec.burned ? 'spent' : 'waiting for a conviction'}`);
  if (sec.role === 'davyjones') lines.push(sec.prisoner ? `${sec.prisoner.name} is in your Locker until ${new Date(sec.prisoner.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Locker ${sec.lock_ready ? `ready (${sec.lock_minutes} min)` : 'used this game'}`);
  if (sec.role === 'angel') lines.push(`Holy nova ${sec.nova_used ? 'spent' : 'ready'} · blessing ${sec.bless_ready ? 'ready' : 'used'}`);
  if (sec.role === 'scrooge') lines.push(`${sec.respins_left} re-spins · swap ${sec.swap_used ? 'used' : 'ready'} · graffiti ${sec.graffiti_used ? 'used' : 'ready'}`);
  if (sec.lovebird) lines.push(`LOVEBIRD · ${sec.partner ? `your partner is ${sec.partner.name}. You share every punishment.` : "your partner hasn't opened their file yet."}`);
  if (me.cursed) lines.push('CURSED · everyone sees the skull, not your role. Your spins are doubled.');
  if (sec.allies?.length) lines.push(`Your team: ${sec.allies.map(t => `${t.name} (${ROLES[t.role]?.label ?? t.role}${t.caught ? ', caught' : ''})`).join(', ')}`);
  return (<>
    <Row title="YOUR FILE" slot={chip} />
    <div className="pu-dossier">
      <div className="pu-d-head"><span>SUBJECT: {me.name.toUpperCase()}</span><span>FILE {state.room.target}/{String(me.seat).padStart(2, '0')}</span></div>
      <div className="pu-d-role">{sec.evolved ? EVOLVED[sec.evolved] : R.label.toUpperCase()}</div>
      <div className="pu-d-stamp">TOP SECRET</div>
      <div className="pu-d-team" style={{ color: T.color }}>TEAM: {T.label}{sec.role === 'betrayer' && sec.team === 'drinkers' ? ' (FOR NOW)' : ''}</div>
      <div className="pu-d-p">{T.blurb}</div>
      <div className="pu-d-h">WHAT YOU DO</div>
      <div className="pu-d-p">{R.short}</div>
      {perks && <>
        <div className="pu-d-h">YOUR POWERS BY LEVEL</div>
        {perks.map((p, i) => { const L = i + 1, st = L < lvl ? 'done' : L === lvl ? 'now' : 'later';
          return <div key={i} className={'pu-lrow ' + st}><span className="lb">L{L}</span><span className="lt">{p}</span><span className="ls">{st === 'done' ? 'DONE' : st === 'now' ? '◀ NOW' : waitGame && L === lvl + 1 ? 'NEXT GAME' : `${LEVEL_BEERS[i]} BEERS`}</span></div>; })}
      </>}
      {lines.length > 0 && <><div className="pu-d-h">ON FILE</div><div className="pu-d-list">{lines.map((l, i) => <div key={i}>· {l}</div>)}</div></>}
    </div>
    <div className="pu-keys"><Key lg variant="steel" icon="eyeoff" onClick={onHide}>HIDE MY FILE</Key></div>
  </>);
}

// ---------- step 3: the code from your card ----------
function CodeStep({ act, onLater, onOpened }: { act: Act; onLater: () => void; onOpened: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const open = () => { if (busy) return; setBusy(true); setMsg(''); act('redeem', { code }).then(() => { buzz(80); onOpened(); }).catch(e => { setMsg(errText(e)); setBusy(false); }); };
  return (<>
    <div className="pu-h1" style={{ marginTop: 8 }}>Open your envelope</div>
    <div className="pu-small">Your card has a 6-character code. Type it to unlock your secret file.</div>
    <div className="pu-envelope"><div className="rc">ROLE CARD<div className="cd">• • • • • •</div></div></div>
    <div className="pu-boxes">
      {Array.from({ length: 6 }, (_, i) => <div key={i} className={'pu-lbox sm' + (i === code.length ? ' cur' : '')}>{code[i] ?? (i === code.length ? <span className="caret" /> : '')}</div>)}
      <input className="code6" aria-label="Your card code" value={code} autoCapitalize="characters" autoComplete="off" autoFocus
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) open(); }} />
    </div>
    <Facts facts={[{ icon: 'eyeoff', text: 'Tilt your screen away.', small: 'Only you should see this.' }]} />
    {msg && <div className="pu-body pu-c-red pu-center">{msg}</div>}
    <div className="pu-keys">
      <Key lg disabled={code.length < 6 || busy} className="pu-open" onClick={open}>{code.length < 6 ? <>OPEN <span className="pu-why">({6 - code.length} more)</span></> : busy ? 'OPENING…' : 'OPEN MY FILE'}</Key>
      <Key variant="ghost" onClick={onLater}>No card yet? Later</Key>
    </div>
  </>);
}

function TextStep({ shell, title, intro, placeholder, next, onBack }: { shell: (c: ReactNode) => JSX.Element; title: string; intro: ReactNode; placeholder: string; next: (t: string) => void; onBack: () => void }) {
  const [t, setT] = useState('');
  return shell(<>
    <Row onBack={onBack} title={title} center slot={<span style={{ width: 64 }} />} />
    <div className="pu-small">{intro}</div>
    <textarea className="pu-field pu-text" maxLength={60} rows={3} placeholder={placeholder} value={t} onChange={e => setT(e.target.value)} />
    <div className="pu-keys"><Key lg disabled={t.trim().length < 3} onClick={() => next(t.trim())}>{t.trim().length < 3 ? <>NEXT <span className="pu-why">(type a bit more)</span></> : 'NEXT'}</Key></div>
  </>);
}

function MultiStep({ shell, state, n, intro, exclude, next, onBack }: { shell: (c: ReactNode) => JSX.Element; state: GameState; n: number; intro: ReactNode; exclude: string[]; next: (ids: string[]) => void; onBack: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel(x => (x.includes(id) ? x.filter(y => y !== id) : x.length < n ? [...x, id] : x));
  return shell(<>
    <Row onBack={onBack} title="PICK PLAYERS" center slot={<span style={{ width: 64 }} />} />
    <div className="pu-small pu-center">{intro}</div>
    <div className="pu-grid2 pu-picker">{state.players.filter(p => !exclude.includes(p.id)).map(p => <PlayerRow key={p.id} p={p} sel={sel.includes(p.id)} onPick={() => toggle(p.id)} />)}</div>
    <div className="pu-keys"><Key lg disabled={sel.length !== n} onClick={() => next(sel)}>{sel.length === n ? 'NEXT' : <>NEXT <span className="pu-why">(pick {n - sel.length} more)</span></>}</Key></div>
  </>);
}

// ---------- Detective: hold to read, three seconds, once (kept on purpose: the one press-and-hold) ----------
// Drunk-proofed: nothing burns until the finger has stayed down for ARM_MS (a tap or a wobble does nothing), the finger is
// captured (sliding off the button doesn't let go), and the 3 seconds only run WHILE it's held: let go and the reading
// hides, press again and it carries on where it stopped.
const ARM_MS = 450;
function HoldToRead({ check, backend, roomId, onStart }: { check: { id: string; name: string }; backend: Backend; roomId: string; onStart: () => void }) {
  const [res, setRes] = useState<null | { guilty: boolean; name: string; group?: string[] }>(null);
  const [holding, setHolding] = useState(false);
  const [arm, setArm] = useState(0);                                   // 0..1 while arming
  const [used, setUsed] = useState(0);                                 // ms of reading time spent (only while held)
  const [phase, setPhase] = useState<'idle' | 'arming' | 'opening' | 'open' | 'gone'>('idle');
  const since = useRef(0), raf = useRef(0), phaseRef = useRef(phase), usedRef = useRef(0), held = useRef(false);
  phaseRef.current = phase;
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stopLoop = () => cancelAnimationFrame(raf.current);
  const startLoop = () => { stopLoop(); raf.current = requestAnimationFrame(loop); };
  useEffect(() => stopLoop, []);
  const loop = () => {
    const now = performance.now();
    if (phaseRef.current === 'arming') {
      const k = Math.min(1, (now - since.current) / ARM_MS);
      setArm(k);
      if (k >= 1) { open(); return; }
    } else if (phaseRef.current === 'open') {
      const u = usedRef.current + (now - since.current);
      setUsed(u);
      if (u >= READ_MS) { usedRef.current = READ_MS; setRes(null); setPhase('gone'); return; }
    }
    raf.current = requestAnimationFrame(loop);
  };
  // The server hands the same reading back to the same detective for 15s after the first view, so a reading lost to
  // a dropped connection isn't lost: retry while the finger is still down (and a fresh press later retries too).
  const gen = useRef(0);
  const open = async () => {
    setPhase('opening'); phaseRef.current = 'opening'; onStart();
    const mine = ++gen.current;
    const giveUp = (msg?: string) => { if (msg) toast(msg); setPhase('idle'); phaseRef.current = 'idle'; setArm(0); setHolding(false); };
    for (const wait of [500, 1000, 2000, 3000, 0]) {
      try {
        const r = await backend.api('view_check', { room_id: roomId, check_id: check.id });   // this burns it
        if (mine !== gen.current) return;
        setRes(r); buzz(40); since.current = performance.now(); setPhase('open'); phaseRef.current = 'open';
        if (held.current) startLoop();                                 // let go while it was opening: it waits for the next press
        return;
      } catch (e) {
        if (mine !== gen.current) return;
        if (!isNetErr(e) || !wait) { giveUp(isNetErr(e) ? 'No signal. Hold again to read it.' : errText(e)); return; }
        await sleep(wait);
        if (mine !== gen.current) return;
        if (!held.current) { giveUp(); return; }                       // let go while we waited: the next press tries again
      }
    }
  };
  const down = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    held.current = true; setHolding(true); since.current = performance.now();
    if (phaseRef.current === 'idle') { setPhase('arming'); phaseRef.current = 'arming'; startLoop(); }
    else if (phaseRef.current === 'open') startLoop();
  };
  const up = () => {
    held.current = false; setHolding(false); stopLoop();
    if (phaseRef.current === 'arming') { setPhase('idle'); setArm(0); }                     // let go too soon: nothing used
    else if (phaseRef.current === 'open') { usedRef.current += performance.now() - since.current; setUsed(usedRef.current); }
  };
  const left = Math.max(0, READ_MS - used);
  const showing = phase === 'open' && holding && res;
  return (
    <button type="button" className={'pu-hold' + (holding ? ' down' : '')} onPointerDown={down} onPointerUp={up} onPointerCancel={up}
      onContextMenu={e => e.preventDefault()}>
      {phase === 'arming' && !still && <i className="pu-hold-arm" style={{ transform: `scaleX(${arm})` }} />}
      {showing
        ? <><span className={'v ' + (res.guilty ? 'g' : 'i')}>{res.guilty ? 'SABOTEUR' : 'INNOCENT'}</span>
            <small>{res.group && res.group.length > 1 ? `${res.guilty ? 'One of these' : 'None of these'} ${res.group.length}: ${res.group.join(', ')}` : res.name} · {Math.max(0, Math.ceil(left / 1000))}s</small></>
        : phase === 'gone'
          ? <><span className="v">GONE</span><small>You've read it. It's burned.</small></>
          : phase === 'open'
            ? <><span className="v">HOLD AGAIN</span><small>{Math.ceil(left / 1000)}s of your reading left. It only runs while you hold.</small></>
            : phase === 'arming' || phase === 'opening'
              ? <><span className="v">KEEP HOLDING…</span><small>Shield your screen.</small></>
              : <><span className="v">HOLD TO READ</span><small>Press and keep holding · 3 seconds · once. Shield your screen.</small></>}
    </button>
  );
}

// ---------- evidence ----------
// Evidence, built for drunk thumbs (approved mockup: design/mockups/TrialPhone.dc.html): 1 the whole top half is one camera
// button; 2 a one-tap caption (typing is optional), with the exhibit previewed as the TV will show it; then FILED.
const EV_CHIPS = ['POURING IT AWAY', 'HIDING A FULL ONE', 'FAKE SIPPING', "THAT'S NOT BEER"];
function EvidenceStep({ backend, act, count, onBack, onDone }: { backend: Backend; act: Act; count: number; onBack: () => void; onDone: () => void }) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [chip, setChip] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const caption = typed.trim() || (chip ? chip[0] + chip.slice(1).toLowerCase() : '');
  const pick = async (f?: File | null) => {
    if (!f) return;
    try { const b = await compressImage(f, 900, 0.72, false); setPhoto(b); setPreview(URL.createObjectURL(b)); setMsg(''); }
    catch { setMsg("Couldn't read that photo. Try another."); }
  };
  const send = async () => {
    if (!photo || busy) return;
    setBusy(true);
    try { const url = await backend.uploadEvidence(photo); await act('submit_evidence', { image_url: url, caption }); onDone(); }
    catch (e) { setMsg(errText(e)); setBusy(false); }
  };
  const steps = <span className="pu-tr-steps"><i className="on" /><i className={step === 2 ? 'on' : ''} /></span>;
  const [ready, setReady] = useState(false);                        // FILE IT wakes 0.7s after NEXT: a double tap can't file it
  useEffect(() => { if (step !== 2) return; setReady(false); const t = setTimeout(() => setReady(true), 700); return () => clearTimeout(t); }, [step]);
  if (step === 1) return (<>
    <Row onBack={onBack} title={<>EVIDENCE<small>Step 1 of 2</small></>} slot={steps} />
    <label className="pu-tr-snap pu-ev">
      {preview ? <img src={preview} alt="" /> : <>
        <span className="corner" style={{ left: 14, top: 14, borderRight: 0, borderBottom: 0 }} /><span className="corner" style={{ right: 14, top: 14, borderLeft: 0, borderBottom: 0 }} />
        <span className="corner" style={{ left: 14, bottom: 14, borderRight: 0, borderTop: 0 }} /><span className="corner" style={{ right: 14, bottom: 14, borderLeft: 0, borderTop: 0 }} />
        <div><div className="lens"><Icon n="camera" /></div><div className="t">TAP TO SNAP</div></div>
      </>}
      <input type="file" accept="image/*" capture="environment" onChange={e => pick(e.target.files?.[0])} hidden />
    </label>
    <Facts facts={[{ icon: 'eyeoff', text: 'Nobody sees it was you', small: `It goes up on the TV at the next Trial${count ? ` · you've filed ${count}` : ''}` }]} />
    {msg && <div className="pu-body pu-c-red">{msg}</div>}
    <div className="pu-keys"><Key lg disabled={!photo} onClick={() => setStep(2)}>{photo ? 'NEXT' : <>NEXT <span className="pu-why">(snap it first)</span></>}</Key></div>
  </>);
  return (<>
    <Row onBack={() => setStep(1)} title={<>EVIDENCE<small>Step 2 of 2</small></>} slot={steps} />
    <div className="pu-tr-pol" style={{ width: 250 }}><div className="pu-tr-pin" /><div className="tag">EXHIBIT</div><div className="ph">{preview && <img src={preview} alt="" />}</div><div className="cap">{caption || '\u00a0'}</div></div>
    <div className="pu-tr-chips">{EV_CHIPS.map(c => <button key={c} type="button" className={'pu-tr-chip' + (chip === c && !typed.trim() ? ' sel' : '')} onClick={() => { setChip(chip === c ? null : c); setTyped(''); }}>{c}</button>)}</div>
    <input className="pu-field" style={{ textTransform: 'none' }} placeholder="or type your own (optional)" maxLength={80} value={typed} onChange={e => setTyped(e.target.value)} />
    {msg && <div className="pu-body pu-c-red">{msg}</div>}
    <div className="pu-keys"><Key lg disabled={busy || !ready} onClick={send}>{busy ? 'FILING…' : 'FILE IT'}</Key></div>
  </>);
}

function Reactions({ backend, roomId }: { backend: Backend; roomId: string }) {
  const last = useRef(0);
  return <>{REACTIONS.map(r => (
    <button key={r.e} type="button" className="pu-rkey" aria-label={r.label} onClick={() => {
      if (Date.now() - last.current < 350) return;
      last.current = Date.now(); buzz(15); backend.sendReaction(roomId, r.e);
    }}><Icon n={r.icon} /><span>{r.label}</span></button>
  ))}</>;
}
