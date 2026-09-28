-- =====================================================================
-- THE HUNDRED — schema
-- Security model: clients NEVER read these tables directly. RLS is on with
-- no policies, and table privileges are revoked from anon/authenticated.
-- All reads go through get_state() (a per-user view: public data + ONLY the
-- caller's own secrets). All writes go through the `api` Edge Function,
-- which calls api_exec() (executable by service_role only).
-- =====================================================================

create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  host_id     uuid not null,
  status      text not null default 'lobby' check (status in ('lobby','live')),
  tally       int  not null default 0,
  target      int  not null default 100 check (target > 0),
  deadline_at timestamptz not null,
  segments    jsonb not null,
  settings    jsonb not null,
  ended       boolean not null default false,
  final_tally int,
  result      jsonb,
  revealed    boolean not null default false,
  reveal      jsonb,
  version     bigint not null default 0,
  created_at  timestamptz not null default now()
);

create table public.players (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  user_id         uuid not null,
  name            text not null,
  selfie_url      text,
  seat            int  not null,
  beers           int  not null default 0,
  last_beer_at    timestamptz,
  has_role        boolean not null default false,   -- public tick: a code was redeemed (never the role)
  public_role     text,                             -- set only by exposure / end-of-night reveal
  love_partner_id uuid,                             -- public only once the pair is revealed
  cursed          boolean not null default false,   -- the curse is public
  created_at      timestamptz not null default now(),
  unique (room_id, user_id)
);
create index on public.players (room_id);

-- Secret per-player state. Only ever returned to its owner by get_state().
create table public.player_secrets (
  player_id       uuid primary key references public.players(id) on delete cascade,
  room_id         uuid not null references public.rooms(id) on delete cascade,
  role            text not null,
  pair_id         uuid,
  partner_id      uuid,
  heals_left      int not null default 0,
  fake_heals_left int not null default 0,
  guesses_left    int not null default 0,
  guessed         uuid[] not null default '{}',
  team_with       uuid[] not null default '{}',
  respins_left    int not null default 0,
  swap_used       boolean not null default false,
  graffiti_used   boolean not null default false
);

create table public.role_codes (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  code        text not null unique,
  role        text not null,
  pair_id     uuid,
  slot        int  not null,
  redeemed_by uuid references public.players(id) on delete set null,
  redeemed_at timestamptz
);
create index on public.role_codes (room_id);

create table public.punishments (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  text       text not null,
  kind       text not null default 'wheel',
  via_love   boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index on public.punishments (room_id);

create table public.queue (
  id         uuid primary key default gen_random_uuid(),
  pos        bigint generated always as identity,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  reason     text not null default '',
  status     text not null default 'queued' check (status in ('queued','active','done','cancelled')),
  created_at timestamptz not null default now()
);
create index on public.queue (room_id);

create table public.rounds (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms(id) on delete cascade,
  queue_id           uuid,
  victim_id          uuid not null,
  original_victim_id uuid not null,
  reason             text not null default '',
  phase              text not null default 'waiting'
                     check (phase in ('waiting','spinning','revealed','saved','done','cancelled')),
  landings           jsonb not null default '[]',
  spin_seq           int not null default 0,
  wheel              jsonb,
  cursed             boolean not null default false,
  revealed_at        timestamptz,
  created_at         timestamptz not null default clock_timestamp(),
  ended_at           timestamptz
);
create index on public.rounds (room_id);

-- Heals (real = Medic, fake = Intruder). Secret. A shield sits on the player it
-- was cast on until they next press SPIN (so after a Jester swap it stays with
-- the original victim).
create table public.shields (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  by_player  uuid not null references public.players(id) on delete cascade,
  fake       boolean not null default false,
  round_id   uuid,
  used_round uuid,
  used_at    timestamptz,
  owed       jsonb,           -- fake heals: the landings secretly owed, revealed at end of night
  created_at timestamptz not null default clock_timestamp()
);
create index on public.shields (room_id);

create table public.games (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  name       text not null,
  status     text not null default 'active' check (status in ('active','ended')),
  losers     uuid[] not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  ended_at   timestamptz
);
create index on public.games (room_id);

-- Generic votes: `kind` decides the title default and what happens on close.
create table public.votes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  kind       text not null,
  game_id    uuid,
  title      text not null,
  status     text not null default 'open' check (status in ('open','closed')),
  options    uuid[] not null,
  ends_at    timestamptz not null,
  result     uuid[],
  created_at timestamptz not null default clock_timestamp()
);
create index on public.votes (room_id);

create table public.ballots (
  vote_id    uuid not null references public.votes(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  voter_id   uuid not null references public.players(id) on delete cascade,
  choice_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (vote_id, voter_id)
);

create table public.curse_passes (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  from_id    uuid not null references public.players(id) on delete cascade,
  to_id      uuid not null references public.players(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Jester graffiti. Deliberately has NO author column (the author is only
-- recorded as player_secrets.graffiti_used).
create table public.graffiti (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  text       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default clock_timestamp()
);

-- Public event feed that drives TV animations (payloads never contain secrets).
create table public.events (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);
create index on public.events (room_id, id desc);

-- Lock everything down.
do $$
declare t text;
begin
  foreach t in array array['rooms','players','player_secrets','role_codes','punishments','queue','rounds',
                           'shields','games','votes','ballots','curse_passes','graffiti','events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
