// The TV / host screen for one room. Everything shown here comes from get_state()
// for the host, which never contains secret roles. Animations are driven by the
// public event feed + state diffs, serialised through a small animation queue.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import { useRoom, useTicker } from '../lib/useRoom';
import type { GameEvent, GameState, MiniGame, Player, Role } from '../lib/types';
import { HIT_ROLES, ROLES } from '../lib/roles';
import { Mugshot } from '../components/Mugshot';
import { reduced } from './machineKit';
import { fmtClock, fmtDur, sleep } from '../lib/util';
import { Sound, setSoundEnabled, soundEnabled } from '../fx/sound';
import { bubblesFrom, burst, centerOf, floatEmoji, rain, restartAnim, showBanner, toast } from '../fx/effects';
import { Avatar, Logo, Polaroid } from '../components/ui';
import { PlayerGrid } from './PlayerGrid';
import { RoundOverlay } from './RoundOverlay';
import { VoteOverlay } from './VoteOverlay';
import { Lobby } from './Lobby';
import { ExposeModal, FreeSpinModal, GameModal, LockApproval, PlayerDetail, RevealAllConfirm, SettingsModal } from './TvModals';
import { PlateOverlay } from './AaronsPlate';
import { BlessedScene, HolyNovaScene, LockerScene, preloadClips, ShameScene, ShurikenScene } from './Scenes';
import { sideNames } from './Matchups';
import { ChampTV, SlackerTV } from './Announce';
import { SCROOGE_MS, ScroogeOverlay, type ScroogeFx } from './ScroogeOverlay';
import { BotDock } from './TestLab';
import { MiniGameOverlay, useMiniGameTicker } from './MiniGames';
import { BookieBanner } from './Bookie';
import { BookieOpenScene, SkankScene } from './Announce';
import { SOUND_MS, SoundChip, isSting, playSting } from './Shop';
import type { ShopSound } from '../lib/types';
import { preloadNameCalls } from '../fx/nameCalls';
import { plankRevealMs } from './PlankTV';
import { CURSE_MS } from './CurseFx';
import { NOW_PLAYING_MS, NowPlayingScene } from './NowPlaying';

const FINAL_STRETCH = 15 * 60 * 1000;
const BOOKIE_MS = 3800;
const UNDO_MS = 2 * 60 * 1000;
const NO_MASK = new Set<string>();
export type Act = <T = any>(action: string, args?: Record<string, unknown>) => Promise<T>;

// How long a finished mini-game stays on the TV: 8s, or for Walk the Plank its one-by-one reveal plus a beat
const mgShowMs = (g: MiniGame) => (g.kind === 'plank' && !g.result?.no_show ? Math.max(8000, plankRevealMs(g.players.length) + 2500) : 8000);
/** Is this mini-game on the TV right now (called, live, or still showing how it ended)? */
const mgShowing = (g: MiniGame | null | undefined, t: number) => !!g && (g.status === 'muster' || g.status === 'live'
  || (g.status === 'done' && !!g.finished_at && t - Date.parse(g.finished_at) < mgShowMs(g)));

// Scrooge graffiti already shown on this TV (survives a refresh)
const GKEY = 'thehundred-graffiti-seen';
const graffitiSeen = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch { return []; } })());
const saveGraffitiSeen = () => { try { localStorage.setItem(GKEY, JSON.stringify([...graffitiSeen].slice(-100))); } catch { /* ignore */ } };

export function TvRoom({ backend, code, onExit }: { backend: Backend; code: string; onExit: () => void }) {
  const { state, error, connected, refresh, now } = useRoom(backend, code, floatEmoji);
  useTicker(250);
  useEffect(() => { preloadClips(); preloadNameCalls().catch(() => {}); }, []);   // the film clips and the summons name clips, buffered well before they're needed

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
  type Scene = { done: () => void } & ({ kind: 'nova'; player: string; n: number; tally: number } | { kind: 'shame'; player: string; caption: string }
    | { kind: 'locker'; player: string; until: string | null } | { kind: 'blessed'; player: string; from: string; index: number } | { kind: 'shuriken'; player: string }
    | { kind: 'bookieOpen' } | { kind: 'skank'; tease?: boolean; n?: number; from?: number; to?: number });
  const [scene, setSceneState] = useState<null | Scene>(null);
  /** Show a full-screen scene and wait until it says it's finished (clip scenes vary in length). */
  const playScene = (sc: Omit<Scene, 'done'> & Record<string, unknown>) => new Promise<void>(res => {
    const safety = setTimeout(() => res(), 20000);
    setSceneState({ ...sc, done: () => { clearTimeout(safety); res(); } } as Scene);
  }).then(() => setSceneState(null));
  const [curse, setCurse] = useState<null | { from: string; to: string; key: number }>(null);
  const [plateDone, setPlateDone] = useState<string | null>(null);         // dismissed Aaron's Plate
  const [slacker, setSlacker] = useState<null | { game: string; players: string[]; beers: number | null }>(null);
  const [champ, setChamp] = useState<null | { players: string[]; beers: number; done: () => void }>(null);
  const [nowPlaying, setNowPlaying] = useState<null | { name: string; key: number; done: () => void }>(null);   // the NOW PLAYING marquee
  // NEXT UP keeps the wheel going: once the host starts it, each finished punishment calls the next one until the queue is empty
  const [chain, setChain] = useState(false);
  const [bigOverlay, setBigOverlay] = useState<null | 'win' | 'end'>(null);
  const [reveal, setReveal] = useState<null | { animate: boolean }>(null);
  const [bookie, setBookie] = useState<null | { winners: string[]; key: number }>(null);   // THE BOOKIE: who called it
  const [sting, setSting] = useState<null | { sound: ShopSound; key: number }>(null);     // THE CAPS SHOP: the soundboard chip
  useEffect(() => { if (!sting) return; const t = setTimeout(() => setSting(null), SOUND_MS); return () => clearTimeout(t); }, [sting]);

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
        await showBanner({ title: `LEVEL ${p.level}`, sub: `${pName(s, p.player).toUpperCase()} ${p.level >= 4 ? 'IS AT FULL POWER' : 'POWERS UP'}`, color: '#ff8a1e', hold: 2.4, img: pImg(s, p.player) });
      }); break;
      case 'level_cap': enqueue(async () => {                 // a game finished: the next level opens for everyone (names nobody)
        Sound.fanfare();
        await showBanner({ title: `LEVEL ${p.cap} UNLOCKED`, sub: 'THE NEXT LEVEL IS OPEN', color: '#ff8a1e', hold: 2.8 });
      }); break;
      case 'bet_placed': break;                              // the WANTED screen shows the count from the state
      case 'bets_void': toast('The bookie is off: everyone gets their caps back', 3500); break;
      case 'bets_settled': {
        // only once the game's own reveal is over (never on top of it), and only if anyone bet at all
        if (!p.n) break;
        const g = s.minigame && s.minigame.id === p.game ? s.minigame : null;
        const kind = g?.kind ?? s.book?.kind;
        const wait = g?.finished_at ? Date.parse(g.finished_at) + mgShowMs(g) - now() : kind === 'plank' ? 16000 : 8000;
        const winners = (p.winners as string[] | undefined) ?? [];
        setTimeout(() => enqueue(async () => {
          setBookie({ winners, key: ev.id });
          Sound.pop();
          await sleep(BOOKIE_MS);
          setBookie(null);
        }), Math.max(0, wait) + 400);
        break;
      }
      // THE CAPS SHOP. The soundboard plays at once (never queued behind a scene): a sound and a corner chip, no name.
      case 'soundboard':
        if (!isSting(p.sound)) break;
        playSting(p.sound);
        setSting({ sound: p.sound, key: ev.id });
        break;
      // a bribe: the one at the wheel paid off their own spin (public: they're already on the TV). The round goes back to
      // spinning with a new spin_seq, so RoundOverlay plays the re-spin after this banner (no Scrooge scene).
      case 'bribe': enqueue(async () => {
        Sound.coinDrop();
        await showBanner({ title: 'BRIBED!', sub: `${pName(s, p.player).toUpperCase()} PAYS OFF THE WHEEL`, color: '#c99a45', hold: 2.2, img: pImg(s, p.player) });
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
      case 'stand_in': enqueue(async () => {                  // TAKE IT FOR THEM (public): someone steps in for the one at the wheel
        Sound.fanfare();
        await showBanner({ title: `${pName(s, p.to).toUpperCase()} STEPS IN`, sub: `FOR ${pName(s, p.from).toUpperCase()}`, color: '#2c6e74', hold: 2.8, img: pImg(s, p.to) });
      }); break;
      case 'hit': enqueue(async () => {
        setHit({ player: p.player, role: p.role, partner: p.partner });
        Sound.siren();
        await sleep(5200);
        setHit(null);
      }); break;
      case 'jester_revenge': break;     // the Trial overlay plays Jester's Revenge
      case 'locked': enqueue(() => playScene({ kind: 'locker', player: p.player, until: p.until ?? null })); break;
      case 'unlocked': toast(`⚓ ${pName(s, p.player)} is back from Davy Jones' Locker`, 4000); break;
      case 'lock_request': Sound.beep(); break;
      case 'shuriken': enqueue(() => playScene({ kind: 'shuriken', player: p.player })); break;
      case 'orders_forged': enqueue(async () => {                // the Oathbreaker: the name on a waiting punishment is rewritten
        Sound.scratch();
        await showBanner({ title: 'FORGED ORDERS', sub: `“${String(p.reason).toUpperCase()}”: ${pName(s, p.from).toUpperCase()} ✕ → ${pName(s, p.to).toUpperCase()}`, color: '#5c2a54', hold: 3.4, img: pImg(s, p.to) });
      }); break;
      case 'cited': enqueue(async () => {                     // older rooms (the Sheriff is gone)
        Sound.gavel();
        await showBanner({ title: 'CITED BY THE SHERIFF', sub: `${pName(s, p.player).toUpperCase()}: SLACKING. STRAIGHT TO THE WHEEL`, color: '#2a4d69', hold: 3, img: pImg(s, p.player) });
      }); break;
      case 'angel': enqueue(async () => {
        Sound.heal();
        await showBanner({ title: 'AN ANGEL WALKS AMONG US', sub: `${pName(s, p.player).toUpperCase()} WATCHES OVER THE DRINKERS`, color: '#c9a227', hold: 3, img: pImg(s, p.player) });
      }); break;
      case 'holy_nova': enqueue(() => playScene({ kind: 'nova', player: p.player, n: p.n, tally: p.tally })); break;
      case 'blessed': {
        const index = s.room.segments.findIndex(t => t === 'Safe (blessed by the Angel)');
        if (index >= 0) enqueue(() => playScene({ kind: 'blessed', player: p.player, from: String(p.from), index }));
        else enqueue(async () => { Sound.heal(); await showBanner({ title: 'BLESSED', sub: `“${String(p.from).toUpperCase()}” IS SAFE FOR THE REST OF THE NIGHT`, color: '#c9a227', hold: 3.2 }); });
        break;
      }
      case 'shiv': enqueue(async () => {                      // parole: a caught Saboteur stabs someone (public)
        Sound.scratch();
        await showBanner({ title: 'SHIVVED', sub: `${pName(s, p.by).toUpperCase()} GOT ${pName(s, p.player).toUpperCase()} IN THE YARD. THEIR NEXT PUNISHMENT COUNTS DOUBLE`, color: '#6e1414', hold: 3.4, img: pImg(s, p.player) });
      }); break;
      case 'shame': enqueue(() => playScene({ kind: 'shame', player: p.player, caption: p.caption })); break;
      case 'skank_work': enqueue(async () => {                 // THE SKANK HAS BEEN AT WORK: a tease before the Champ (no amount, never who)
        await sleep(1100);                                       // let the GAME OVER banner fade out first
        document.getElementById('bannerLayer')?.replaceChildren();
        await playScene({ kind: 'skank', tease: true });
      }); break;
      case 'champ': enqueue(async () => {                       // shown in full before the Slacker
        await sleep(1100);                                       // let the GAME OVER banner fade out first
        document.getElementById('bannerLayer')?.replaceChildren();
        await new Promise<void>(res => { const t = setTimeout(res, 6500); setChamp({ players: p.players ?? [], beers: p.beers ?? 0, done: () => { clearTimeout(t); res(); } }); });
        setChamp(null);
      }); break;
      case 'curse_passed': enqueue(async () => {             // CurseFx (on the board) plays its own sound on its beats
        setCurse({ from: p.from, to: p.to, key: ev.id });
        await sleep(CURSE_MS);
        setCurse(null);
      }); break;
      case 'game_start': enqueue(() => new Promise<void>(res => {   // the marquee, then its name flies up into the top-bar chip
        const safety = setTimeout(res, NOW_PLAYING_MS + 3000);
        setNowPlaying({ name: String(p.name ?? ''), key: ev.id, done: () => { clearTimeout(safety); res(); } });
      }).then(() => setNowPlaying(null))); break;
      case 'game_over': enqueue(async () => {
        Sound.thud();
        const losers = (p.losers as string[]).map(id => pName(s, id).toUpperCase()).join(', ');
        await showBanner({ title: 'GAME OVER', sub: losers ? `LOST: ${losers}` : 'NO LOSERS?', color: '#c2371f', hold: 3 });
      }); break;
      case 'slacker': enqueue(async () => {
        await sleep(1100);                                       // after the GAME OVER banner / the Champ
        document.getElementById('bannerLayer')?.replaceChildren();
        setSlacker({ game: p.game, players: p.players ?? [], beers: p.beers ?? null });
      }); break;
      case 'ended': {
        Sound.alarm();
        const res = s.room.result;
        if (res?.skank_bonus) enqueue(async () => {              // time's up: the Skank's stash goes into the count first
          await sleep(600);
          await playScene({ kind: 'skank', n: res.skank_bonus, from: res.counted ?? 0, to: s.room.final_tally ?? (res.counted ?? 0) + (res.skank_bonus ?? 0) });
          setBigOverlay('end');
        });
        else setTimeout(() => setBigOverlay('end'), 600);
      } break;
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
    // ask again every 2s until the server agrees the night is over (this laptop's clock can run a little ahead of it)
    if (remaining <= 0 && !endingRef.current) { endingRef.current = true; act('end_check').catch(() => {}).finally(() => setTimeout(() => { endingRef.current = false; }, 2000)); }
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

  // mini-games: keep deadlines moving while one is on (the server answers quietly when there's nothing to do)
  useMiniGameTicker(state?.minigame, id => { backend.api('mg_tick', { room_id: state?.room.id, game_id: id }).catch(() => {}); });

  // NEXT UP chain: when the stage is clear (no punishment, vote, plate, mini-game or animation), call the next one
  const mgOn = mgShowing(state?.minigame, now());        // a finished game's reveal still holds the stage too
  const stageClear = !!state && !state.error && !state.round && state.vote?.status !== 'open' && state.plate?.status !== 'open'
    && !mgOn && !scene && !champ && !slacker && !state.room.ended;
  const queued = state?.queue.length ?? 0;
  // THE BOOKIE IS OPEN: once a night, after the first game's whole aftermath (game over, Level 2, the Champ, the Slacker,
  // the Trial, the wheel) has cleared the stage. It waits for an empty punishment queue (or 45 s of quiet if the host
  // leaves some queued), then stamps T0 = server time + 2 s in settings.bookie_announced (a refresh never replays it,
  // and every phone keys its toast and cards off the same T0) and plays the scene from T0. A local flag as well, since a
  // host UNDO restores the room row and could drop the setting.
  const bookieAt = state?.room.settings.bookie_announced ?? null;
  const gamesDone = state?.room.games_done ?? 0;
  const bookieKey = `thehundred-bookie-open-${state?.room.id}`;
  const clearRef = useRef(stageClear); clearRef.current = stageClear;
  useEffect(() => {
    if (!state || state.error || bookieAt || gamesDone < 1 || !stageClear) return;
    try { if (localStorage.getItem(bookieKey)) return; } catch { /* ignore */ }
    const t = setTimeout(() => enqueue(async () => {
      if (!clearRef.current) return;                          // something started while it waited: try again later
      const t0 = now() + 2000;
      try { await act('update_settings', { settings: { bookie_announced: new Date(t0).toISOString() } }); } catch { return; }
      try { localStorage.setItem(bookieKey, '1'); } catch { /* ignore */ }
      await sleep(Math.max(0, t0 - now()));
      await playScene({ kind: 'bookieOpen' });
    }), queued ? 45000 : 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageClear, queued, gamesDone, bookieAt]);
  // the explainer never holds the stage against the game: a spin, a vote, a mini-game or the Plate ends it at once
  const bookieBlocked = !!state && (!!state.round || state.vote?.status === 'open' || mgOn || state.plate?.status === 'open');
  useEffect(() => { if (scene?.kind === 'bookieOpen' && bookieBlocked) scene.done(); }, [scene, bookieBlocked]);
  useEffect(() => {
    if (!chain || !stageClear) return;
    if (!queued) { setChain(false); return; }
    let live = true;
    const t = setTimeout(() => {
      enqueue(async () => {                                   // after any animation still playing
        if (!live) return;
        await act('call_next').catch(() => setChain(false));
      });
    }, 1800);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, stageClear, queued]);

  if (!state) return <div className="center-screen"><Logo className="big" /><p className="muted">{error ?? 'Connecting…'}</p></div>;
  if (state.error === 'no_room' || !state.me.is_host) {
    return <div className="center-screen"><div className="host-card"><p>Room {code} not found (or it isn't yours).</p><button className="btn primary" onClick={onExit}>BACK</button></div></div>;
  }

  const s = state, room = s.room;
  const tally = room.ended ? room.final_tally ?? room.tally : room.tally;
  const left = room.target - tally;
  const danger = !room.ended && remaining <= FINAL_STRETCH;
  const game = s.game;
  const undoable = s.undo && now() - Date.parse(s.undo.at) < UNDO_MS ? s.undo : null;
  const clockText = (() => {                                        // H:MM:SS, hours may run past 24 (the segment display has no 'd')
    const t = room.ended ? 0 : Math.max(0, Math.floor(remaining / 1000)), p2 = (v: number) => String(v).padStart(2, '0');
    return t >= 86400 ? `${Math.floor(t / 86400)}D ${p2(Math.floor(t / 3600) % 24)}:${p2(Math.floor(t / 60) % 60)}` : `${Math.floor(t / 3600)}:${p2(Math.floor(t / 60) % 60)}:${p2(t % 60)}`;
  })();
  const pace = paceOf(left, remaining, s.players.filter(p => p.public_role !== 'angel').length, !!room.ended, room.result?.winner === 'group');

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
    <div className="tv">
      <div id="app" className="tv-app">
        <div className={'bd' + (danger ? ' final' : '')}>
          <div className="tex" />
          {/* TOP BAR: brand · now playing · the host's quiet keys */}
          <header className="topbar">
            <div className="brand">
              <Logo />
              <div className="room-line">{room.settings.practice && <span className="lab-badge">PRACTICE</span>}ROOM <b>{room.code}</b> · NOW <b>{fmtClock(now())}</b>{!connected && <span className="offline"> · RECONNECTING…</span>}</div>
            </div>
            <div className="np-wrap">
              {game?.status === 'active' && (
                <div className="nowplaying is-green"><span className="mk-lamp" /><span className="np-k">NOW PLAYING</span><span className="np-g">{game.name.toUpperCase()}</span>
                  {game.matchup && game.matchup.length > 1 && <span className="np-mu">{game.matchup.map(sd => sideNames(s, sd)).join(' vs ')}</span>}</div>
              )}
            </div>
            <nav className="hostkeys" aria-label="Host controls">
              <button className="hk" onClick={onExit} title="Back to the main menu (the game keeps running)">⌂ MENU</button>
              <button className={'hk undo' + (undoable ? '' : ' off')} disabled={!undoable} onClick={undo} title={undoable ? `Undo: ${undoable.label}` : 'Nothing to undo'}>↶ UNDO</button>
              <button className="hk" onClick={() => setShowLobby(true)} title="Join info / QR">JOIN</button>
              <button className="hk" onClick={() => room.revealed ? setReveal({ animate: false }) : setModal({ kind: 'revealAll' })} title="End of night: reveal all">REVEAL</button>
              <button className="hk icon" onClick={toggleFs} title="Fullscreen (F)">⛶</button>
              <button className="hk icon" onClick={() => { setSoundEnabled(!soundEnabled()); toast(soundEnabled() ? 'Sound on' : 'Sound off'); }}>{soundEnabled() ? '🔊' : '🔇'}</button>
              <button className="hk icon" onClick={() => setModal({ kind: 'settings' })} title="Setup">⚙</button>
            </nav>
          </header>

          {/* THE COUNTER: the goal, the tally, the rack of 100, the clock and the pace, then the host's touch keys */}
          <section className={'steel console tally-panel' + (room.ended ? ' frozen' : '')} aria-label="Beers">
            <div className="dith" />
            <div className="cn">
              <div className="goal">{room.target} BEERS BY <b>{fmtClock(deadline)}</b></div>
              <div className="blk b-tally">
                <div className="kick"><span>BEERS DOWN</span>{room.ended && <span className="tag">FINAL</span>}</div>
                <div className={'tally' + (tally >= room.target ? ' won' : '')}><span id="tallyNum">{tally}</span><span className="tally-target">/{room.target}</span></div>
              </div>
              <div className="blk b-rack">
                <div className="rack" id="cellbar">
                  {[0, 1, 2, 3].map(r => {
                    const cols = Math.ceil(room.target / 4), q = Math.min(room.target, (r + 1) * cols);
                    return (
                      <div key={r} className="rrow">
                        <div className="cells">
                          {Array.from({ length: Math.max(0, Math.min(cols, room.target - r * cols)) }, (_, c) => {
                            const i = r * cols + c, on = i < tally, bonus = tally > room.target && i >= room.target - (tally - room.target);
                            return <div key={c} className={'cell' + (on ? ' on' : '') + (on && (i + 1) % 10 === 0 ? ' ten' : '') + (bonus ? ' bonus' : '') + ((c + 1) % 5 === 0 && c < cols - 1 ? ' g5' : '')} />;
                          })}
                        </div>
                        <span className={'rq' + (tally >= q ? ' hit' : '')}>{q}</span>
                      </div>
                    );
                  })}
                </div>
                <div className={'togo' + (left <= 0 ? ' won' : '')}>{left > 0 ? <><em>{left}</em> TO GO</> : left === 0 ? <><em>TARGET</em> HIT</> : <>SMASHED · <em>+{-left}</em> BONUS</>}</div>
              </div>
              <div className="blk b-clock">
                <div className="kick"><span>{room.ended ? "TIME'S UP" : danger ? 'FINAL STRETCH' : 'TIME LEFT'}</span></div>
                <div id="clock" className={room.ended || danger ? 'danger' : ''}>{clockText}</div>
                <div className={'pace ' + pace.lamp} style={{ ['--pc' as any]: pace.color }}>
                  <span className="mk-lamp" />
                  <div className="pace-t"><div className="pace-b">{pace.big}<em>{pace.em}</em></div><div className="pace-s"><b>{pace.word}</b><span className="pace-x">{pace.small}</span></div></div>
                </div>
              </div>
              <div className="dock">
                <div className="dkrow1">
                  <button className="dk btn-minus" onClick={() => addBeer(-1)} title="Host only">−1</button>
                  <button className="dk btn-beer" onClick={() => addBeer(1)}>+1 BEER <small>SPACE</small></button>
                </div>
                <div className="dkrow">
                  <button className={'dk btn-game' + (game?.status === 'active' ? ' is-green' : '')} onClick={() => setModal({ kind: 'game' })}>
                    {game?.status === 'active' && <span className="mk-lamp" />}<b>{game?.status === 'active' ? 'END GAME' : 'GAMES'}</b><small>{game?.status === 'active' ? game.name.toUpperCase() : 'START · VOTE'}</small>
                  </button>
                  <button className={'dk btn-wheel' + (chain ? ' on' : '') + (s.queue.length ? ' is-red' : '')} disabled={!chain && (!!s.round || !s.queue.length)}
                    onClick={() => { if (chain) { setChain(false); return; } setChain(true); act('call_next').catch(() => setChain(false)); }}>
                    {s.queue.length > 0 && <span className="mk-lamp" />}<b>{chain ? 'STOP' : 'NEXT UP'}</b><small>{chain ? `${s.queue.length} MORE` : s.queue.length ? `${s.queue.length} IN QUEUE` : 'QUEUE EMPTY'}</small>
                  </button>
                  <button className="dk btn-free" disabled={!!s.round} onClick={() => setModal({ kind: 'spin' })} title="Spin the wheel now (special cases)"><b>FREE</b><small>SPIN</small></button>
                </div>
              </div>
            </div>
          </section>

          {/* THE SUSPECTS */}
          <section className="steel suspects suspects-panel" aria-label="Suspects">
            <div className="sp-head">
              <div className="sp-title">SUSPECTS</div>
              <div className="sp-id"><b>{s.players.filter(p => p.public_role).length}</b> / {s.players.length} IDENTIFIED</div>
              {s.queue.length > 0 && <QueueStrip state={s} />}
            </div>
            <PlayerGrid players={s.players} revealMask={NO_MASK} onCard={id => setModal({ kind: 'detail', id })}
              onEmpty={() => setShowLobby(true)} champs={s.game?.champs ?? []} now={now()} curse={curse} />
          </section>
        </div>
      </div>

      {s.round && <RoundOverlay key={s.round.id} state={s} round={s.round} act={act} enqueue={enqueue} now={now} chain={chain} onStopChain={() => setChain(false)} />}
      {s.vote && <VoteOverlay key={s.vote.id} state={s} vote={s.vote} act={act} now={now} />}
      {champ && <ChampOverlay state={s} champ={champ} />}
      {slacker && !champ && !s.round && !(s.vote?.status === 'open') && (
        <SlackerOverlay state={s} slacker={slacker} onClose={() => setSlacker(null)}
          onTrial={() => act('start_vote', { kind: 'trial', game_id: slacker.game }).then(() => setSlacker(null)).catch(() => {})} />
      )}
      {(room.status === 'lobby' || showLobby) && !s.round && (
        <Lobby state={s} act={act} onClose={() => { setShowLobby(false); if (room.status === 'lobby') act('update_settings', { status: 'live' }).catch(() => {}); }}
          onSettings={() => setModal({ kind: 'settings' })} onMenu={onExit} />
      )}
      {!modal && s.players.some(p => p.lock_requested) && <LockApproval state={s} player={s.players.find(p => p.lock_requested)!.id} act={act} />}
      {s.plate && plateDone !== s.plate.id && (s.plate.status === 'open' || now() - Date.parse(s.plate.ends_at) < 120e3) && !s.round && (
        <PlateOverlay key={s.plate.id} state={s} plate={s.plate} act={act} now={now} onClose={() => setPlateDone(s.plate!.id)} />
      )}
      {s.minigame && mgShowing(s.minigame, now()) && (
        <MiniGameOverlay key={s.minigame.id} state={s} g={s.minigame} act={act} now={now} />
      )}
      {scene?.kind === 'nova' && <HolyNovaScene angel={s.players.find(p => p.id === scene.player)} n={scene.n} tally={scene.tally} target={room.target} onDone={scene.done} />}
      {scene?.kind === 'shame' && <ShameScene victim={s.players.find(p => p.id === scene.player)} caption={scene.caption} onDone={scene.done} />}
      {scene?.kind === 'locker' && <LockerScene victim={s.players.find(p => p.id === scene.player)} until={scene.until} onDone={scene.done} />}
      {scene?.kind === 'bookieOpen' && <BookieOpenScene onDone={scene.done} />}
      {scene?.kind === 'skank' && <SkankScene tease={scene.tease} n={scene.n} from={scene.from} to={scene.to} onDone={scene.done} />}
      {scene?.kind === 'shuriken' && <ShurikenScene victim={s.players.find(p => p.id === scene.player)} onDone={scene.done} />}
      {nowPlaying && <NowPlayingScene key={nowPlaying.key} name={nowPlaying.name} onDone={nowPlaying.done} />}
      {scene?.kind === 'blessed' && <BlessedScene angel={s.players.find(p => p.id === scene.player)} segments={s.room.segments} index={scene.index} from={scene.from} onDone={scene.done} />}

      {bookie && <BookieBanner key={bookie.key} winners={bookie.winners.map(id => s.players.find(p => p.id === id)).filter((p): p is Player => !!p)} />}
      {scrooge && <ScroogeOverlay key={scrooge.n} fx={scrooge.fx} />}
      {sting && <SoundChip key={sting.key} sound={sting.sound} />}
      {room.settings.practice && <BotDock backend={backend} state={s} />}
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

// ---------- after each game: the Biggest Champ (a few seconds), then the Slacker, then the Trial ----------
// (the scenes themselves are in Announce.tsx, from design/mockups/Champ.dc.html and Slacker.dc.html)
function ChampOverlay({ state, champ }: { state: GameState; champ: { players: string[]; beers: number; done: () => void } }) {
  const ps = champ.players.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
  return <ChampTV champs={ps} beers={champ.beers} onDone={champ.done} />;
}

function SlackerOverlay({ state, slacker, onClose, onTrial }: { state: GameState; slacker: { players: string[]; beers: number | null }; onClose: () => void; onTrial: () => void }) {
  const ps = slacker.players.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
  return <SlackerTV slackers={ps} beers={slacker.beers} onTrial={onTrial} onSkip={onClose} />;
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
      {/* the roles a Hit can name (a fixed list, nothing secret): the one the knife found is lit */}
      <div className="hit-lineup">
        {HIT_ROLES.map(r => (
          <div key={r} className={'hit-role' + (r === hit.role ? ' on' : '')} style={{ ['--rc' as any]: ROLES[r].color }}>
            <Mugshot role={r} className="hr-mug" />
            <span className="hr-name">{ROLES[r].label.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Columns for a grid of n polaroids that keeps them as big as possible in a box of the given aspect (w/h). */
function gridCols(n: number, aspect: number) {
  let best = 1, bestSize = 0;
  for (let c = 1; c <= Math.max(1, n); c++) {
    const rows = Math.ceil(n / c), size = Math.min(aspect / c, 1 / (rows * 1.3));   // a polaroid is ~1.3x taller than wide
    if (size > bestSize) { bestSize = size; best = c; }
  }
  return best;
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
      <div className="crowd" style={{ ['--per' as any]: state.players.length <= 9 ? Math.max(1, state.players.length) : Math.ceil(state.players.length / 2) }}>
        {state.players.map((p, i) => <Polaroid key={p.id} url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} style={{ marginTop: i % 2 ? 0 : 10 }} />)}
      </div>
      <div className="bo-actions">{actions.map(a => <button key={a.label} className={'big-btn ' + a.cls} onClick={a.on}>{a.label}</button>)}</div>
    </div>
  );
}

// ---------- end of night: every role stamped, then the case file ----------
function RevealOverlay({ state, animate, onClose }: { state: GameState; animate: boolean; onClose: () => void }) {
  const r = state.room.reveal!;
  const ps = state.players.filter(p => p.public_role);
  const still = animate && reduced();                       // reduced motion: the settled frame straight away
  const [shown, setShown] = useState(animate && !still ? 0 : ps.length);
  const [file, setFile] = useState(!animate || still);
  useEffect(() => {
    if (still) Sound.fanfare();                             // the sound beat still plays
    if (!animate || still) return;
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
  const room = state.room, res = room.result;
  const score = room.final_tally ?? room.tally;
  const cols = gridCols(ps.length, 1.45), rows = Math.max(1, Math.ceil(ps.length / Math.max(1, cols)));
  const pager = useFindingsPager(file);
  return (
    <div className="overlay reveal-ov">
      <button className="key close-x" onClick={onClose}>✕</button>
      <div className="reveal-left">
        {res
          ? <div className={'rv-verdict ' + (res.winner === 'group' ? 'group' : 'guilty')}>{res.winner === 'group' ? 'THE GROUP WINS' : 'THE SABOTEURS WIN'} · {score} / {room.target}</div>
          : <div className="kicker">END OF NIGHT</div>}
        <div className="ttl">ALL REVEALED</div>
        <div className="reveal-grid" style={{ ['--cols' as any]: cols, ['--rows' as any]: rows }}>
          {ps.map((p, i) => {
            const R = ROLES[p.public_role!];
            return (
              <div key={p.id} className="cell-r">
                <Polaroid url={p.selfie_url} name={p.name} caption={p.name.toUpperCase()} pin />
                {i < shown && <div className={'stamp' + (still ? '' : ' slam')} style={{ ['--sc' as any]: R.color }}>{R.label.toUpperCase()}{p.love_partner_id ? ' ♥' : ''}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {file && (
        <div className="casefile" style={still ? undefined : { animation: 'modalIn .5s cubic-bezier(.2,1.3,.4,1)' }}>
          <div className="tabl">CASE {state.room.target}</div>
          <div className="hdr"><span>FINDINGS</span><span className="stamp" style={{ fontSize: 30 }}>SOLVED</span></div>
          <div className="findings" ref={pager.view}>
           <div className="findings-track" ref={pager.track}>
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
              Skank <b>{nm(p.id)}</b>{state.room.result?.skank_bonus ? <> secretly added <b>+{state.room.result?.skank_bonus}</b> beers to the count</> : ' was quietly doubling every beer'}</div>)}
           </div>
          </div>
          <div className="cf-foot">
            {pager.pages > 1 && (
              <div className="cf-pages" aria-label={`page ${pager.page + 1} of ${pager.pages}`}>
                <span className="cf-pg">PAGE {pager.page + 1} / {pager.pages}</span>
                <span className="cf-timer"><i key={pager.page} style={{ animationDuration: FINDINGS_PAGE_MS + 'ms' }} /></span>
              </div>
            )}
            <button className="close" onClick={onClose}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

// The case file never scrolls (nobody can scroll a TV): the findings are split into pages that fit the
// paper, and the pages turn by themselves. Every finding stays in the DOM (the off-page ones are faded out),
// the track moves by transform, and reduced motion swaps pages with no transition.
const FINDINGS_PAGE_MS = 8000;
function useFindingsPager(on: boolean) {
  const view = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  const [starts, setStarts] = useState<number[]>([0]);
  const [page, setPage] = useState(0);
  const pageOf = useRef<number[]>([]), curRef = useRef(0);
  const paint = () => {
    const t = track.current; if (!t) return;
    const i0 = curRef.current;
    (Array.from(t.children) as HTMLElement[]).forEach((el, i) => el.classList.toggle('off', (pageOf.current[i] ?? 0) !== i0));
  };
  useLayoutEffect(() => {
    if (!on) return;
    const v = view.current, t = track.current; if (!v || !t) return;
    const measure = () => {
      const H = v.clientHeight, out = [0], of: number[] = [];
      let start = 0;
      for (const el of Array.from(t.children) as HTMLElement[]) {
        const top = el.offsetTop, bottom = top + el.offsetHeight;
        if (bottom - start > H && top > start) { start = top; out.push(start); }
        of.push(out.length - 1);
      }
      pageOf.current = of; paint();
      setStarts(prev => (prev.length === out.length && prev.every((x, i) => x === out[i]) ? prev : out));
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(v); ro.observe(t);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [on]);
  const pages = starts.length, cur = Math.min(page, pages - 1);
  useEffect(() => {
    if (!on || pages <= 1) return;
    const id = setInterval(() => setPage(p => (p + 1) % pages), FINDINGS_PAGE_MS);
    return () => clearInterval(id);
  }, [on, pages]);
  useLayoutEffect(() => {
    const t = track.current; if (!t) return;
    curRef.current = cur;
    t.style.transform = `translateY(${-starts[cur]}px)`;
    paint();
  });
  return { view, track, page: cur, pages };
}

// ---------- the board's UP NEXT strip and pace ----------
/** UP NEXT: as many chips as fit, then +N (a chip is never clipped). */
function QueueStrip({ state }: { state: GameState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(state.queue.length);
  const key = state.queue.map(q => q.id + q.times).join(',');
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      const items = [...el.querySelectorAll<HTMLElement>('.q-item')];
      items.forEach(i => { i.style.display = ''; });
      let n = items.length;
      while (n > 1 && el.scrollWidth > el.clientWidth + 1) { n--; items[n].style.display = 'none'; }
      setShown(n);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  return (
    <div className="queue" ref={ref}>
      <span className="q-label">UP NEXT ▸</span>
      {state.queue.map((q, k) => {
        const p = state.players.find(x => x.id === q.player_id);
        return p ? <span key={q.id} className={'q-item' + (k === 0 ? ' first' : '')}><Avatar url={p.selfie_url} name={p.name} /><span className="qn">{p.name.toUpperCase()}</span>{q.times > 1 && <b className="q-x">×{q.times}</b>}</span> : null;
      })}
      {shown < state.queue.length && <span className="q-more">+{state.queue.length - shown}</span>}
    </div>
  );
}

/** The pace: one beer every m:ss to make the target, and a lamp (public numbers only: tally, target, time, player count). */
function paceOf(left: number, remainingMs: number, drinkers: number, ended: boolean, won: boolean) {
  const pad = (v: number) => String(v).padStart(2, '0');
  if (ended) return won ? { lamp: 'is-green', color: '#8dff9a', big: 'TARGET ', em: 'HIT', word: '', small: 'THE GROUP WINS' }
    : { lamp: 'is-red', color: '#ff6a50', big: 'SHORT BY ', em: String(left), word: '', small: 'THE SABOTEURS WIN' };
  if (left <= 0) return { lamp: 'is-green', color: '#8dff9a', big: 'TARGET ', em: 'HIT', word: '', small: 'EVERY BEER NOW IS A BONUS' };
  if (remainingMs > 12 * 3600e3) return { lamp: 'is-amber', color: '#ffb866', big: 'PACE CHECK ', em: 'ON THE NIGHT', word: '', small: 'IN THE LAST 12 HOURS' };
  const rem = Math.max(1, remainingMs / 1000), perHour = left / (rem / 3600), each = perHour / Math.max(1, drinkers), every = Math.max(1, Math.round(rem / left));
  const lamp = each <= 1.5 ? 'is-green' : each <= 2.5 ? 'is-amber' : 'is-red';
  return { lamp, color: ({ 'is-green': '#8dff9a', 'is-amber': '#ffb866', 'is-red': '#ff6a50' } as Record<string, string>)[lamp],
    big: 'ONE BEER EVERY ', em: every >= 3600 ? `${Math.floor(every / 3600)}h ${pad(Math.floor(every % 3600 / 60))}m` : `${Math.floor(every / 60)}:${pad(every % 60)}`,
    word: ({ 'is-green': 'CRUISING', 'is-amber': 'KEEP IT UP', 'is-red': 'DRINK FASTER' } as Record<string, string>)[lamp],
    small: ` · ${each.toFixed(1)} EACH AN HOUR` };
}
