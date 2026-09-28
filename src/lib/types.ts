// Shapes returned by get_state() (see supabase/migrations/*_logic.sql).
export type Role = 'intruder' | 'betrayer' | 'medic' | 'lovebird' | 'cursed' | 'jester' | 'drinker';

export interface Punishment { text: string; kind: 'wheel' | 'penalty' | 'fake_heal' | string; via_love: boolean; at: string }

export interface Player {
  id: string; name: string; selfie_url: string | null; seat: number; beers: number;
  has_role: boolean; public_role: Role | null; love_partner_id: string | null; cursed: boolean;
  punishments: Punishment[];
}

export interface WheelSeg { text: string; graffiti: boolean }
export interface Landing { idx: number; text: string; mult: number; kind: 'normal' | 'safe' | 'again'; spin: number; graffiti: boolean }

export interface Round {
  id: string; victim_id: string; original_victim_id: string;
  phase: 'waiting' | 'spinning' | 'revealed' | 'saved';
  reason: string; spin_seq: number; wheel: WheelSeg[] | null; cursed: boolean;
  revealed_at: string | null; landings: Landing[];
}

export interface Vote {
  id: string; kind: string; title: string; status: 'open' | 'closed'; options: string[];
  ends_at: string; result: string[] | null; game_id: string | null;
  counts: Record<string, number>; voters: number; my_choice: string | null;
}

export interface GameEvent { id: number; kind: string; payload: Record<string, any>; at: string }

export interface Settings {
  role_counts: Record<Role, number>;
  intruder_fake_heal: boolean; jester_respin: boolean; jester_swap: boolean; jester_graffiti: boolean;
}

export interface Room {
  id: string; code: string; status: 'lobby' | 'live'; tally: number; target: number; deadline_at: string;
  segments: string[]; settings: Settings; ended: boolean; final_tally: number | null;
  result: { winner: 'group' | 'intruder'; betrayer_joined: boolean } | null;
  revealed: boolean;
  reveal: { fake_heals: { player: string; by: string; texts: string[] }[]; teams: { betrayer: string; intruder: string }[] } | null;
  version: number; wheel: WheelSeg[];
}

export interface Secret {
  role: Role; heals_left: number; fake_heals_left: number; guesses_left: number; guessed: string[];
  respins_left: number; swap_used: boolean; graffiti_used: boolean; healed_this_round: boolean;
  partner: { id: string; name: string; selfie_url: string | null } | null;
  team: { id: string; name: string }[] | null;
}

export interface Me {
  user_id: string; is_host: boolean; joined: boolean; player_id: string | null;
  cooldown_until: string | null; pending_curse_pass: boolean; secret: Secret | null;
}

export interface GameState {
  server_now: string;
  error?: 'no_room';
  room: Room;
  players: Player[];
  queue: { id: string; player_id: string; reason: string }[];
  round: Round | null;
  game: { id: string; name: string; status: 'active' | 'ended'; losers: string[] } | null;
  vote: Vote | null;
  curse_passes: { id: string; from_id: string; to_id: string }[];
  graffiti: { id: string; text: string }[];
  events: GameEvent[];
  me: Me;
}
