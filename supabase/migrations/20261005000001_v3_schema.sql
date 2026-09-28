-- =====================================================================
-- THE HUNDRED v3 — schema additions
-- Teams (Drinkers / Guilty / Chaos), Forger, Detective, the Intruder's Hit,
-- rehab + knife handover, Trial votes, automatic Slacker, evidence photos,
-- host undo. Same lock-down rules as v2: RLS on, no client grants.
-- =====================================================================

alter table public.players
  add column if not exists rehab boolean not null default false;          -- caught Guilty: public, powerless

alter table public.player_secrets
  add column if not exists checks_used   int     not null default 0,      -- Detective
  add column if not exists hit_alive     boolean not null default false,  -- Intruder / knife holder streak
  add column if not exists last_hit_game int,                              -- games finished when last Hit landed
  add column if not exists has_knife     boolean not null default false,  -- Betrayer who inherited the knife
  add column if not exists forge_used    boolean not null default false,  -- Forger
  add column if not exists burned        boolean not null default false;  -- powers burned by a correct Hit

alter table public.shields add column if not exists forged boolean not null default false;
alter table public.rounds  add column if not exists forged boolean not null default false;
alter table public.games
  add column if not exists slackers      uuid[] not null default '{}',
  add column if not exists slacker_beers int;
alter table public.votes add column if not exists outcome jsonb;

-- every beer, so the Slacker can be worked out per game
create table if not exists public.beer_log (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid references public.players(id) on delete cascade,   -- null = host +1 on the TV
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists beer_log_room on public.beer_log (room_id, created_at);

create table if not exists public.detective_checks (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  detective_id uuid not null references public.players(id) on delete cascade,
  target_id    uuid not null references public.players(id) on delete cascade,
  guilty       boolean not null,
  viewed       boolean not null default false,
  created_at   timestamptz not null default clock_timestamp()
);

-- evidence photos: the submitter is stored but never shown to anyone
create table if not exists public.evidence (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  image_url  text not null,
  caption    text not null default '',
  hidden     boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

-- host undo: a snapshot of the room taken just before each host action
create table if not exists public.undo_log (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  action     text not null,
  label      text not null,
  snap       jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);

do $$
declare t text;
begin
  foreach t in array array['beer_log','detective_checks','evidence','undo_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
