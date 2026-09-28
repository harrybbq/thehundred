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
  add column if not exists burned        boolean not null default false,  -- powers burned by a correct Hit
  add column if not exists frame_used    boolean not null default false,  -- Forger: frame (once a night)
  add column if not exists frame_target  uuid references public.players(id) on delete set null,
  add column if not exists frame_spent   boolean not null default false,  -- a Detective has read the planted file
  -- drink-level powers: uses are counted, the allowance comes from beers logged (level 1/2/3)
  add column if not exists heals_used    int     not null default 0,
  add column if not exists respins_used  int     not null default 0,
  add column if not exists swaps_used    int     not null default 0,
  add column if not exists second_chance_used boolean not null default false,  -- level-3 Hit: one miss forgiven
  add column if not exists hint_ids      uuid[];                                -- level-3 Betrayer hint (3 names)

-- host free spin on the whole room: a round with no victim
alter table public.rounds alter column victim_id drop not null, alter column original_victim_id drop not null;

alter table public.shields add column if not exists forged boolean not null default false;
alter table public.rounds  add column if not exists forged boolean not null default false;
alter table public.games
  add column if not exists slackers      uuid[] not null default '{}',
  add column if not exists slacker_beers int;
alter table public.votes add column if not exists outcome jsonb;
alter table public.games add column if not exists matchup jsonb;
alter table public.role_codes add column if not exists cursed boolean not null default false;   -- Cursed modifier on this card           -- drawn sides: [[player ids], [player ids], …]

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
  framed       boolean not null default false,   -- read GUILTY only because the Forger framed them
  created_at   timestamptz not null default clock_timestamp()
);
alter table public.detective_checks add column if not exists framed boolean not null default false;
alter table public.detective_checks add column if not exists group_ids uuid[] not null default '{}';   -- who was in the reading
alter table public.detective_checks add column if not exists level int not null default 3;

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

-- Skank: hidden bonus beers, added to the tally when time runs out. Jester: one conviction revenge a night.
alter table public.player_secrets
  add column if not exists skank_bonus  int     not null default 0,
  add column if not exists revenge_used boolean not null default false;
-- punishment multiplier (Jester's revenge = ×3), carried from the queue into the round
alter table public.queue  add column if not exists times int not null default 1;
alter table public.rounds add column if not exists times int not null default 1;

-- =====================================================================
-- v5: Davy Jones' Locker, Biggest Champ, evolutions (Surgeon / Sheriff),
-- the Angel, Assassin → Judge Dredd, Aaron's Plate
-- =====================================================================
-- a locked player's punishment waits ('held'); only one can wait
alter table public.queue drop constraint if exists queue_status_check;
alter table public.queue add constraint queue_status_check check (status in ('queued','held','active','done','cancelled'));

alter table public.players
  add column if not exists locked_until      timestamptz,                         -- Davy Jones' Locker (public)
  add column if not exists lock_requested_at timestamptz,                         -- asked the host to be locked up
  add column if not exists dredd_mark        boolean not null default false;      -- Judge Dredd's mark: secret, never sent out

alter table public.player_secrets
  add column if not exists last_lock_game  int,                                   -- Davy Jones
  add column if not exists self_heal_used  boolean not null default false,        -- Surgeon
  add column if not exists last_cite_game  int,                                   -- Sheriff
  add column if not exists nova_used       boolean not null default false,        -- Angel
  add column if not exists bless_used      boolean not null default false,        -- Angel
  add column if not exists target_id       uuid references public.players(id) on delete set null,   -- Assassin
  add column if not exists ninja           boolean not null default false,        -- Assassin → Ninja (target was in the dock)
  add column if not exists last_strike_game int,                                  -- Ninja
  add column if not exists last_shame_game int,
  add column if not exists last_mark_game  int,
  add column if not exists last_bbq_game   int;                                   -- Skank: Aaron's Plate

-- sealed = can't be forged (Surgeon heals, the Champ's golden ticket); golden = the Champ's ticket
alter table public.shields
  add column if not exists sealed boolean not null default false,
  add column if not exists golden boolean not null default false;
alter table public.games
  add column if not exists champs      uuid[] not null default '{}',
  add column if not exists champ_beers int;

-- Aaron's Plate: one sausage per eater, exactly one dirty (lying sideways on the TV)
create table if not exists public.sausage_plates (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  n          int  not null,
  dirty      int  not null,
  eaters     uuid[] not null,
  picks      jsonb not null default '{}'::jsonb,            -- player id → sausage index
  started_by uuid references public.players(id) on delete set null,   -- secret (null = host)
  status     text not null default 'open' check (status in ('open','closed')),
  ends_at    timestamptz not null,
  loser      uuid references public.players(id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.sausage_plates enable row level security;
revoke all on public.sausage_plates from public, anon, authenticated;

-- Davy Jones: while someone is locked, the first punishment queued for them waits ('held');
-- anything more is dropped so they can't all pile on.
create or replace function public._queue_lock() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'queued' and exists (select 1 from players where id = new.player_id and locked_until > now()) then
    if exists (select 1 from queue where player_id = new.player_id and status = 'held') then return null; end if;
    new.status := 'held';
  end if;
  return new;
end $$;
drop trigger if exists queue_lock on public.queue;
create trigger queue_lock before insert on public.queue for each row execute function public._queue_lock();
revoke all on function public._queue_lock() from public, anon, authenticated;
