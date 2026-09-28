// Shapes returned by get_state() (see supabase/migrations/*_v3_logic.sql).
export type Role = 'intruder' | 'betrayer' | 'forger' | 'medic' | 'detective' | 'lovebird' | 'cursed' | 'jester' | 'drinker';
export type Team = 'drinkers' | 'guilty' | 'chaos';

export interface Punishment { text: string; kind: 'wheel' | 'penalty' | string; via_love: boolean; at: string }

export interface Player {
  id: string; name: string; selfie_url: string | null; seat: number; beers: number;
  has_role: boolean; public_role: Role | null; love_partner_id: string | null; cursed: boolean; rehab: boolean;
  punishments: Punishment[];
}

export interface WheelSeg { text: string; graffiti: boolean }
export interface Landing { idx: number; text: string; mult: number; kind: 'normal' | 'safe' | 'again'; spin: number; graffiti: boolean }

export interface Round {
  id: string; victim_id: string; original_victim_id: string;
  phase: 'waiting' | 'spinning' | 'revealed' | 'saved';
  reason: string; spin_seq: number; wheel: WheelSeg[] | null; cursed: boolean; forged: boolean;
  revealed_at: string | null; landings: Landing[];
}

export interface TrialOutcome {
  result: 'none' | 'guilty' | 'innocent'; accused?: string; role?: Role; accusers?: string[]; votes?: number; total?: number;
}

export interface Vote {
  id: string; kind: 'trial' | string; title: string; status: 'open' | 'closed'; options: string[];
  ends_at: string; result: string[] | null; game_id: string | null; outcome: TrialOutcome | null; created_at: string;
  counts: Record<string, number>; voters: number; my_choice: string | null;
}

export interface Game {
  id: string; name: string; status: 'active' | 'ended'; losers: string[];
  slackers: string[]; slacker_beers: number | null; ended_at: string | null;
}

export interface GameEvent { id: number; kind: string; payload: Record<string, any>; at: string }

export interface Settings {
  role_counts: Partial<Record<Role, number>>;
  jester_respin: boolean; jester_swap: boolean; jester_graffiti: boolean;
}

export interface Reveal {
  teams: { betrayer: string; intruder: string }[];
  knife: string[];
  guilty: string[];
  checks: { detective: string; target: string; guilty: boolean }[];
  forgeries: { player: string; medic: string; used: boolean }[];
}

export interface Room {
  id: string; code: string; status: 'lobby' | 'live'; tally: number; target: number; deadline_at: string;
  segments: string[]; settings: Settings; ended: boolean; final_tally: number | null;
  result: { winner: 'group' | 'guilty'; betrayer_joined: boolean } | null;
  revealed: boolean; reveal: Reveal | null; version: number; wheel: WheelSeg[]; games_done: number;
}

export interface Secret {
  role: Role; team: Team; burned: boolean; has_knife: boolean;
  heals_left: number; guesses_left: number; guessed: string[];
  respins_left: number; swap_used: boolean; graffiti_used: boolean; healed_this_round: boolean;
  my_heals: { name: string; used: boolean }[] | null;
  hit_alive: boolean; hit_ready: boolean;
  checks_left: number; pending_check: { id: string; name: string } | null; checked: string[] | null;
  forge_used: boolean; forge_ready: boolean;
  partner: { id: string; name: string; selfie_url: string | null } | null;
  allies: { id: string; name: string }[] | null;
}

export interface Me {
  user_id: string; is_host: boolean; joined: boolean; player_id: string | null;
  cooldown_until: string | null; pending_curse_pass: boolean; evidence_count: number; secret: Secret | null;
}

export interface Evidence { id: string; image_url: string; caption: string; hidden: boolean; at: string }

export interface GameState {
  server_now: string;
  error?: 'no_room';
  room: Room;
  players: Player[];
  queue: { id: string; player_id: string; reason: string }[];
  round: Round | null;
  game: Game | null;
  vote: Vote | null;
  curse_passes: { id: string; from_id: string; to_id: string }[];
  graffiti: { id: string; text: string }[];
  evidence: Evidence[];
  undo: { label: string; at: string } | null;
  events: GameEvent[];
  me: Me;
}

export const NO_TRIAL = '00000000-0000-0000-0000-000000000000';
