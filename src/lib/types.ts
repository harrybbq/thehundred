// Shapes returned by get_state() (see supabase/migrations/*_v3_logic.sql).
export type Role = 'intruder' | 'betrayer' | 'forger' | 'medic' | 'detective' | 'lovebird' | 'cursed' | 'scrooge' | 'jester' | 'skank' | 'davyjones' | 'assassin' | 'angel' | 'drinker';
export type Team = 'drinkers' | 'guilty' | 'chaos';

export interface Punishment { text: string; kind: 'wheel' | 'penalty' | string; via_love: boolean; at: string }

export interface Player {
  id: string; name: string; selfie_url: string | null; seat: number; beers: number;
  has_role: boolean; public_role: Role | null; love_partner_id: string | null; cursed: boolean; rehab: boolean;
  locked_until: string | null;                       // Davy Jones' Locker
  lock_requested: boolean; held: boolean;            // asked the host to be locked up · a punishment is waiting for them
  punishments: Punishment[];
}

export interface WheelSeg { text: string; graffiti: boolean }
export interface Landing { idx: number; text: string; mult: number; kind: 'normal' | 'safe' | 'again'; spin: number; graffiti: boolean }

export interface Round {
  id: string; victim_id: string | null; original_victim_id: string | null;   // null = host free spin on the whole room
  phase: 'waiting' | 'spinning' | 'revealed' | 'saved';
  reason: string; spin_seq: number; wheel: WheelSeg[] | null; cursed: boolean; forged: boolean;
  revealed_at: string | null; landings: Landing[];
  times: number;                                      // punishment multiplier (Jester's revenge = 3)
}

export interface TrialOutcome {
  result: 'none' | 'guilty' | 'innocent' | 'jester'; accused?: string; role?: Role; accusers?: string[]; votes?: number; total?: number;
  revenge?: string;                                   // Jester: the accuser picked for the ×3 punishment
}

export interface Vote {
  id: string; kind: 'trial' | string; title: string; status: 'open' | 'closed'; options: string[];
  ends_at: string; result: string[] | null; game_id: string | null; outcome: TrialOutcome | null; created_at: string;
  counts: Record<string, number>; voters: number; my_choice: string | null;
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
    stopped?: string[];                                       // plank: who has stopped
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

export interface GameEvent { id: number; kind: string; payload: Record<string, any>; at: string }

export interface Settings {
  role_counts: Partial<Record<Role, number>>;
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
  role: Role; team: Team; burned: boolean; has_knife: boolean; level: 1 | 2 | 3;
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
  evolved: 'surgeon' | 'dredd' | 'ninja' | 'kraken' | 'gobshite' | 'pennywise' | 'oathbreaker' | null;   // the level 3 name
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
  cooldown_until: string | null; evidence_count: number; secret: Secret | null;
  curse_targets?: string[];   // cursed only: who you can pass it to right now
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
  curse_passes: { id: string; from_id: string; to_id: string }[];
  graffiti: { id: string; text: string }[];
  evidence: Evidence[];
  undo: { label: string; at: string } | null;
  events: GameEvent[];
  me: Me;
}

export const NO_TRIAL = '00000000-0000-0000-0000-000000000000';
