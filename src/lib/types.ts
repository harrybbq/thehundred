// Shapes returned by get_state() (see supabase/migrations/*_v3_logic.sql).
export type Role = 'intruder' | 'betrayer' | 'forger' | 'medic' | 'detective' | 'lovebird' | 'cursed' | 'scrooge' | 'jester' | 'skank' | 'davyjones' | 'assassin' | 'angel' | 'drinker';
export type Team = 'drinkers' | 'guilty' | 'chaos';

export interface Punishment { text: string; kind: 'wheel' | 'penalty' | string; via_love: boolean; at: string }

export interface Player {
  id: string; name: string; selfie_url: string | null; seat: number; beers: number;
  has_role: boolean; public_role: Role | null; love_partner_id: string | null; cursed: boolean; rehab: boolean;
  shivved_by?: string | null;   // THE SHIV: who stabbed them (public); their next punishment counts ×2
  locked_until: string | null;                       // Davy Jones' Locker
  lock_requested: boolean; held: boolean;            // asked the host to be locked up · a punishment is waiting for them
  rejoin_requested?: boolean;                        // host only: a phone that lost its identity wants to come back as them
  rejoin_code?: number | null;                       // host only: the 2-digit number that phone shows
  punishments: Punishment[];
  level?: 1 | 2 | 3 | 4;                             // drink level (public: from beers, capped at games finished + 1)
}

export interface WheelSeg { text: string; graffiti: boolean }
export interface Landing { idx: number; text: string; mult: number; kind: 'normal' | 'safe' | 'again'; spin: number; graffiti: boolean }

export interface Round {
  id: string; victim_id: string | null; original_victim_id: string | null;   // null = host free spin on the whole room
  phase: 'waiting' | 'spinning' | 'revealed' | 'saved';
  reason: string; spin_seq: number; wheel: WheelSeg[] | null; cursed: boolean; forged: boolean;
  revealed_at: string | null; landings: Landing[];
  times: number;                                      // punishment multiplier (Jester's revenge = 3)
  created_at: string;
  spin_at: string;                                    // TAKE IT FOR THEM: nobody spins before this (created_at + 4s)
  stand_in_id: string | null;                         // who stepped in (once per round); original_victim_id keeps the original
  stand_in_for: string | null;                        // who the stand-in took it from (after any Scrooge swap)
}

export interface TrialOutcome {
  result: 'none' | 'guilty' | 'innocent' | 'jester'; accused?: string; role?: Role; accusers?: string[]; votes?: number; total?: number;
  revenge?: string;                                   // Jester: the accuser picked for the ×3 punishment
}

export interface Vote {
  id: string; kind: 'trial' | string; title: string; status: 'open' | 'closed'; options: string[];
  ends_at: string; result: string[] | null; game_id: string | null; outcome: TrialOutcome | null; created_at: string;
  counts: Record<string, number>; voters: number; my_choice: string | null;
  waiting?: string[];                                // the TV only: a Trial waits for these players (who can still vote), never what anyone voted
  waiting_n?: number;                                // how many can still vote (every screen)
}

export interface Game {
  id: string; name: string; status: 'active' | 'ended'; losers: string[];
  slackers: string[]; slacker_beers: number | null; ended_at: string | null;
  matchup: string[][] | null;
  champs: string[]; champ_beers: number | null;      // Biggest Champ (golden ticket)
}

/** Aaron's Plate: one sausage per eater; `dirty` reaches the TV only (and everyone once it's served). */
export interface Plate {
  id: string; n: number; status: 'open' | 'closed'; ends_at: string; eaters: string[];
  picks: Record<string, number>;                    // while open, a phone only gets its own pick
  taken: number[];                                  // which sausages are gone (anyone can see that, not who)
  loser: string | null; dirty: number | null; created_at: string;
}

/** A mini-game: summoned to the TV (dodge, plank, jack) or phone-only (bomb, penny). Secrets stay on the server. */
export type MiniKind = 'dodge' | 'plank' | 'jack' | 'bomb' | 'penny';
export interface MiniGame {
  id: string; kind: MiniKind; status: 'muster' | 'live' | 'done' | 'cancelled';
  players: string[]; ready: string[]; muster_until: string | null; live_at: string | null; ends_at: string | null;
  state: {
    waiting_host?: boolean;                                   // nobody's turned up: the host decides
    guess?: string;                                           // dodge
    order?: string[]; turn?: number; count?: number; last?: { player: string; n: number };   // jack
    holder?: string; from?: string | null; passes?: number;   // bomb
    called?: number;                                          // penny
  };
  result: null | {
    losers: string[]; no_show?: boolean;
    dir?: string; guess?: string | null; dodged?: boolean;    // dodge
    pos?: Record<string, number>; overboard?: string[];       // plank
    pop?: number; popper?: string;                            // jack
    coin?: 'heads' | 'tails'; calls?: Record<string, string>; // penny
  };
  finished_at: string | null;
  mine: number | string | null;                               // your own plank stop / penny call
}

/** An app game: one the TV runs itself (GAMES → LET THE TV RUN ONE). It is also the room's active Game row, so it ends
 *  in the usual GAME OVER. The server sends only what this viewer may see: public facts, plus `mine` on a phone. */
export type AppKind = 'herd' | 'odd' | 'chess';
interface AppBase { id: string; name: string; players: string[]; started_at: string; until: string | null }
export interface HerdGame extends AppBase {
  kind: 'herd'; phase: 'intro' | 'ask' | 'reveal' | 'final';
  n: number; of: number;                                    // question n of `of` (0 during the rules)
  q?: { q: string; a: string[] };                           // the question on the board (4 answers)
  answered: string[];                                       // who is in (never what they picked)
  strikes: Record<string, number>;
  last?: { counts: number[]; picks: Record<string, number>; herd: number | null; struck: string[] };   // the latest reveal
  losers?: string[];                                        // final: the most strikes
  mine: { pick: number | null; strikes: number } | null;    // a phone's own pick (while the question is open)
}
export interface OddGame extends AppBase { kind: 'odd'; phase: string; [k: string]: any; mine: any }
/** TAG TEAM CHESS: one board, two teams; each team's move goes round its own players. Chess has no secrets: this is the
 *  whole game (the server works out the legal moves once per move). Clocks: `clock` is each side's ms left when the
 *  current turn started (`turn_at`); the side to move's clock runs from then. `until` is the turn's deadline (30 s,
 *  or the flag if its clock has less), the intro's end, or the result's hold. */
export interface ChessGame extends AppBase {
  kind: 'chess'; phase: 'intro' | 'play' | 'end';
  white: string[]; black: string[];                         // each team in its move order
  fen: string; legal: string[];                             // the position, and every legal move in it (UCI)
  turn: 'w' | 'b'; idx: { w: number; b: number };           // the side to move; who plays each side's next move
  mover: string | null;                                     // whose move it is (null once it's over)
  clock: { w: number; b: number }; turn_at: string | null; team_ms: number; move_ms: number;
  ply: number;                                              // moves played so far (both sides)
  moves: {                                                  // the last 8 moves, oldest first
    ply: number; side: 'w' | 'b'; by: string | null; uci: string; auto: boolean;   // auto: played for them (30 s up)
    piece: string; from: string; to: string; captures: string | null; check: boolean; mate: boolean;
    castle: 'kingside' | 'queenside' | null; promotes: string | null; en_passant: boolean;
  }[];
  check: boolean;                                           // the side to move is in check
  material: { white_took: string; black_took: string; white_adv: number };
  touch: string | null;                                     // the piece the player to move has picked up (for the TV)
  result: { kind: 'checkmate' | 'flag' | 'stalemate' | 'insufficient' | 'fifty' | 'threefold' | 'stopped'; winner: 'w' | 'b' | null; losers: string[] } | null;
  mine: { side: 'w' | 'b'; my_turn: boolean; next_up_in: number } | null;   // a phone in the game: 0 = your move now
}
export type AppGame = HerdGame | OddGame | ChessGame;

export interface GameEvent { id: number; kind: string; payload: Record<string, any>; at: string }

export interface Settings {
  role_counts: Partial<Record<Role, number>>;       // the hand-picked deck (GENERATE CODES); not the deal when random_deal is set
  random_deal?: number | null;                       // PICK AT RANDOM: the deck size; the mix is never sent anywhere
  bookie_announced?: string | null;                  // when THE BOOKIE IS OPEN played (once a night, after the first game)
  practice?: boolean;                                // Test Lab room: bots, host can act as them
  scrooge_respin: boolean; scrooge_swap: boolean; scrooge_graffiti: boolean;
}

export interface Reveal {
  teams: { betrayer: string; intruder: string }[];
  knife: string[];
  guilty: string[];
  checks: { detective: string; target: string; guilty: boolean; framed: boolean; group: string[]; level: number }[];
  frames: { forger: string; target: string; spent: boolean }[];
  forgeries: { player: string; medic: string; used: boolean }[];
}

export interface Room {
  id: string; code: string; status: 'lobby' | 'live'; tally: number; target: number; deadline_at: string;
  segments: string[]; settings: Settings; ended: boolean; final_tally: number | null;
  result: { winner: 'group' | 'guilty'; betrayer_joined: boolean; counted?: number; skank_bonus?: number } | null;
  revealed: boolean; reveal: Reveal | null; version: number; wheel: WheelSeg[]; games_done: number;
  ability_until: string | null;                      // the TV is playing someone's ability: others wait until then
}

export interface Secret {
  role: Role; team: Team; burned: boolean; has_knife: boolean; level: 1 | 2 | 3 | 4;
  lovebird: boolean;                                  // the Lovebird bonus sits on top of the role
  hint_ready: boolean; hint: string[] | null;
  heals_left: number; guesses_left: number; guessed: string[];
  respins_left: number; swap_used: boolean; graffiti_used: boolean; skank_bonus: number | null; healed_this_round: boolean;
  my_heals: { name: string; used: boolean }[] | null;
  hit_alive: boolean; hit_ready: boolean;
  checks_left: number; pending_check: { id: string; name: string } | null; checked: string[] | null;
  forge_used: boolean; forge_ready: boolean; orders_ready: boolean;   // Oathbreaker: Forged Orders
  frame_ready: boolean; frame: { name: string; spent: boolean } | null;
  partner: { id: string; name: string; selfie_url: string | null } | null;
  evolved: 'surgeon' | 'dredd' | 'ninja' | 'kraken' | 'gobshite' | 'pennywise' | 'oathbreaker' | null;   // the level 4 name
  self_heal_ready: boolean;
  lock_ready: boolean; lock_minutes: number | null;
  prisoner: { name: string; until: string } | null;   // Davy Jones: one prisoner at a time
  nova_ready: boolean; nova_used: boolean; nova_beers: number | null; bless_ready: boolean;
  strike_ready: boolean; shame_ready: boolean;   // Ninja · Judge Dredd
  dodge_ready: boolean; plank_ready: boolean; jack_ready: boolean; bomb_ready: boolean; penny_ready: boolean;   // mini-games
  bbq_ready: boolean;
  allies: { id: string; name: string; role: Role; caught: boolean }[] | null;   // Saboteurs only: the rest of the team
}

export interface Me {
  user_id: string; is_host: boolean; joined: boolean; player_id: string | null;
  rejoin?: { player_id: string; name: string; selfie_url: string | null; at: string; code: number } | null;   // not joined: this phone asked to come back as them
  late_left?: number | null;  // host only: unused cards in the late pile (a count, never the roles)
  cooldown_until: string | null; evidence_count: number; secret: Secret | null;
  curse_targets?: string[];   // cursed only: who you can pass it to right now
  shiv?: { ready: boolean; beers_to_go: number; used_this_game: boolean } | null;   // rehab only: the parole Shiv
  take_it_used?: boolean;                             // TAKE IT FOR THEM: once a night
  level_info?: LevelInfo;                             // your level, and what the next one needs
  caps?: number;                                      // your own bottle caps (never on the TV, never anyone else's)
  shop?: ShopState;                                   // THE CAPS SHOP: your own buys and windows (own phone only)
}

export type ShopItem = 'sound' | 'bribe' | 'graffiti' | 'ticket';
export type ShopSound = 'pulease' | 'relax' | 'one_maybe_two' | 'airhorn' | 'trombone' | 'drumroll';
export interface ShopState {
  bought: Exclude<ShopItem, 'sound'>[];               // the once-a-night items you've bought
  opens_after_game?: boolean;                         // bribe, graffiti and ticket wait for the first game
  graffiti_off?: boolean;                             // the host switched graffiti off
  can_bribe: boolean;                                 // your own wheel just landed (doesn't check your caps)
  bribe_until: string | null;                         // when that window shuts
  sound_ready_at: string | null;                      // the room's soundboard cooldown (may be in the past)
}

export interface LevelInfo {
  level: 1 | 2 | 3 | 4;
  beers_to_next: number | null;                       // beers still needed for the next threshold (null at level 4)
  waiting_on_game: boolean;                           // you have the beers, but the next level opens after the next game
}

/** The bookie: a cap market on a summoned mini-game (dodge, plank, jack). Picks and per-option counts never leave the server. */
export interface Book {
  game_id: string; kind: 'dodge' | 'plank' | 'jack';
  status: 'open' | 'closed' | 'settled' | 'void';
  options: { id: string; label: string; player_id?: string }[];
  n: number;                                          // bets placed (public)
  stake: number;                                      // the smallest bet (5); you choose 5, 10, 20 or all in
  can_bet: boolean;                                   // a spectator with the caps who hasn't bet, while it's open
  mine: { option: string; stake?: number; payout: number | null } | null;
  winning: string[] | null;                           // option ids, once settled
  winners: string[] | null;                           // player ids of the winning bettors, once settled
  settled_at: string | null;
}

export interface Evidence { id: string; image_url: string; caption: string; hidden: boolean; at: string }

export interface GameState {
  server_now: string;
  error?: 'no_room';
  room: Room;
  players: Player[];
  queue: { id: string; player_id: string; reason: string; times: number }[];
  round: Round | null;
  game: Game | null;
  vote: Vote | null;
  plate: Plate | null;
  minigame: MiniGame | null;
  app_games?: boolean;                               // the server runs app games (an older one doesn't say so)
  app?: AppGame | null;                              // the app game running now
  book?: Book | null;
  curse_passes: { id: string; from_id: string; to_id: string }[];
  graffiti: { id: string; text: string }[];
  evidence: Evidence[];
  undo: { label: string; at: string } | null;
  events: GameEvent[];
  me: Me;
}

export const NO_TRIAL = '00000000-0000-0000-0000-000000000000';
