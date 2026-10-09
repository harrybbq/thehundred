-- =====================================================================
-- THE HUNDRED v3 — game rules
--
-- Teams:  DRINKERS  drinker, medic (→ Surgeon), detective (→ Judge Dredd), skank (→ Gobshite), davyjones (→ Kraken), angel (host-assigned, public),
--                   betrayer (until they join the Saboteurs)
--         SABOTEURS intruder, forger (→ Oathbreaker), assassin (→ Ninja), betrayer once teamed up or holding the knife
--         MODIFIERS Lovebird and Cursed sit on top of any card (even a Guilty one); they are not roles of their own
--                   (the Forger can also frame one player for the Detective)
--         CHAOS     scrooge, jester (→ Pennywise) (no side)
-- (the team id for the Saboteurs is still 'guilty' in the data)
--
-- api_exec(uid, action, args) is a thin dispatcher: it authenticates, loads the
-- room (row-locked), snapshots it for host undo, then calls one of the
-- _a_* action groups. get_state(code) is still the only read path.
-- =====================================================================

-- ---------- defaults & small helpers ----------
create or replace function public._default_settings() returns jsonb language sql immutable set search_path = public as $$
  select '{"role_counts":{"intruder":1,"betrayer":1,"forger":1,"medic":1,"detective":1,"lovebird":1,"cursed":1,"skank":1,"scrooge":1,"jester":1,"davyjones":1,"assassin":0,"drinker":3},
           "scrooge_respin":true,"scrooge_swap":true,"scrooge_graffiti":true}'::jsonb
$$;

create or replace function public._no_trial() returns uuid language sql immutable as $$
  select '00000000-0000-0000-0000-000000000000'::uuid
$$;

create or replace function public._roles() returns text[] language sql immutable as $$
  select array['intruder','betrayer','forger','medic','detective','skank','davyjones','scrooge','jester','assassin','drinker']        -- lovebird & cursed = modifiers
$$;

-- Drink level from beers logged on your own phone: 0–3 → 1, 4–7 → 2, 8+ → 3.
create or replace function public._level(p_beers int) returns int language sql immutable as $$
  select case when coalesce(p_beers, 0) >= 8 then 3 when coalesce(p_beers, 0) >= 4 then 2 else 1 end
$$;

create or replace function public._games_done(p_room uuid) returns int language sql stable set search_path = public as $$
  select count(*)::int from games where room_id = p_room and status = 'ended'
$$;

-- LEVELS 1-4 (REPLACES levels 1-3 at 4/8 beers). Beers logged on your phone: 0 → 1, 3 → 2, 6 → 3, 9 → 4.
create or replace function public._blevel(p_beers int) returns int language sql immutable as $$
  select case when coalesce(p_beers, 0) >= 9 then 4 when coalesce(p_beers, 0) >= 6 then 3
              when coalesce(p_beers, 0) >= 3 then 2 else 1 end
$$;
-- The level a player plays at: the drink level alone (3 / 6 / 9 beers). REPLACES the games cap (games finished + 1),
-- which the host dropped on 9 Oct. p_room stays in the signature so every caller is unchanged.
create or replace function public._plevel(p_beers int, p_room uuid) returns int language sql stable set search_path = public as $$
  select _blevel(p_beers)
$$;

-- CAPS (private, on your own phone only): 10 to start, +1 per beer you log, +3 for each host game you played and
-- didn't lose, +3 for each mini-game you played and didn't lose, +5 per level-up, plus bets, minus the shop
-- (a bet takes 5; a win pays your share of the pot; a refund gives the 5 back). Worked out, never stored.
-- The +5 per level-up is for everyone: a Drinker-only bonus would show a bigger pop on a Drinker's phone (a tell).
create or replace function public._caps(p_player uuid) returns int language sql stable set search_path = public as $$
  select (10 + p.beers
    + 5 * (_plevel(p.beers, p.room_id) - 1)
    + 3 * (select count(*) from games g where g.room_id = p.room_id and g.status = 'ended'
             and not (p.id = any (coalesce(g.losers, '{}')))
             and g.ended_at >= p.created_at
             and (g.matchup is null or jsonb_typeof(g.matchup) <> 'array' or jsonb_array_length(g.matchup) = 0
                  or exists (select 1 from jsonb_array_elements(g.matchup) as sd(side), jsonb_array_elements_text(sd.side) as v(id)
                              where v.id = p.id::text)))
    + 3 * (select count(*) from minigames m where m.room_id = p.room_id and m.status = 'done' and p.id = any (m.players)
             and not coalesce(m.result ? 'no_show', false) and not coalesce(m.result -> 'losers' ? p.id::text, false))
    + coalesce((select sum(coalesce(b.payout, 0) - b.stake) from bets b where b.player_id = p.id), 0)
    - coalesce((select sum(x.cost) from shop_buys x where x.player_id = p.id), 0))::int
  from players p where p.id = p_player
$$;

-- Bets settle when their mini-game finishes: the winners share the whole pot in proportion to what they staked
-- (rounded down; nobody right = everyone refunded), and everyone is refunded when it's called off or someone didn't turn up.
-- The Bookie opens once the night's first game is over (when Level 2 opens too): a mini-game called before that takes no bets.
create or replace function public._bookie_on(p_mg uuid) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from minigames m join games g on g.room_id = m.room_id
                  where m.id = p_mg and g.status = 'ended' and g.ended_at <= m.created_at)
$$;
create or replace function public._bets_trg() returns trigger language plpgsql set search_path = public as $$
declare v_win text[]; v_pot int; v_n int; v_w int; v_wst int;
begin
  if new.kind not in ('dodge','plank','jack') or new.status is not distinct from old.status then return null; end if;
  if not exists (select 1 from bets where game_id = new.id and payout is null) then return null; end if;
  if new.status = 'cancelled' or (new.status = 'done' and coalesce(new.result ? 'no_show', false)) then
    update bets set payout = stake where game_id = new.id and payout is null;
    perform _event(new.room_id, 'bets_void', jsonb_build_object('game', new.id));
  elsif new.status = 'done' then
    v_win := case new.kind when 'dodge' then array[case when coalesce((new.result ->> 'dodged')::boolean, false) then 'dodged' else 'hit' end]
                           else array(select jsonb_array_elements_text(coalesce(new.result -> 'losers', '[]'::jsonb))) end;
    select coalesce(sum(stake), 0), count(*), count(*) filter (where option = any (v_win)),
           coalesce(sum(stake) filter (where option = any (v_win)), 0)
      into v_pot, v_n, v_w, v_wst from bets where game_id = new.id and payout is null;
    update bets set payout = case when v_w = 0 then stake when option = any (v_win) then (v_pot::bigint * stake / v_wst)::int else 0 end
     where game_id = new.id and payout is null;
    perform _event(new.room_id, 'bets_settled', jsonb_build_object('game', new.id, 'n', v_n,
      'winners', coalesce((select jsonb_agg(player_id order by id) from bets where game_id = new.id and option = any (v_win)), '[]'::jsonb)));
  end if;
  return null;
end $$;
drop trigger if exists minigames_bets on public.minigames;
create trigger minigames_bets after update of status on public.minigames for each row execute function public._bets_trg();

create or replace function public._team(p_role text, p_allies uuid[], p_knife boolean) returns text language sql immutable as $$
  select case
    when p_role in ('intruder','forger','assassin') or (p_role = 'betrayer' and (cardinality(p_allies) > 0 or p_knife)) then 'guilty'
    when p_role in ('scrooge','jester') then 'chaos'
    else 'drinkers' end
$$;

create or replace function public._is_guilty(p_player uuid) returns boolean language sql stable set search_path = public as $$
  select coalesce((select _team(role, team_with, has_knife) = 'guilty' from player_secrets where player_id = p_player), false)
$$;

-- If no un-caught knife holder is left, the knife passes to a hidden Betrayer.
create or replace function public._pass_knife(p_room uuid) returns void language plpgsql set search_path = public as $$
declare v uuid;
begin
  if exists (select 1 from player_secrets s join players p on p.id = s.player_id
              where s.room_id = p_room and not p.rehab and (s.role = 'intruder' or s.has_knife)) then
    return;
  end if;
  select s.player_id into v from player_secrets s join players p on p.id = s.player_id
   where s.room_id = p_room and s.role = 'betrayer' and not p.rehab and not s.burned and p.public_role is null
   order by random() limit 1;
  if v is not null then
    update player_secrets set has_knife = true, hit_alive = true, last_hit_game = null, guesses_left = 0 where player_id = v;
  end if;
end $$;

-- A Guilty player is caught: public role, rehab (no powers), knife moves on.
-- What they held just before is kept server-side (caught_prev), so a host unexpose can put it back.
create or replace function public._catch(p_room uuid, p_player uuid) returns void language plpgsql set search_path = public as $$
declare v_before uuid[]; v_to uuid;
begin
  v_before := array(select player_id from player_secrets where room_id = p_room and has_knife);
  update players p set public_role = s.role, rehab = true from player_secrets s where p.id = p_player and s.player_id = p.id;
  update player_secrets set caught_prev = jsonb_build_object('has_knife', has_knife, 'hit_alive', hit_alive, 'forge_used', forge_used,
                                                             'frame_used', frame_used, 'last_hit_game', last_hit_game),
                            has_knife = false, hit_alive = false, forge_used = true, frame_used = true where player_id = p_player;
  perform _pass_knife(p_room);
  select player_id into v_to from player_secrets where room_id = p_room and has_knife and not (player_id = any (v_before)) limit 1;
  update player_secrets set caught_prev = caught_prev || jsonb_build_object('knife_to', v_to) where player_id = p_player;
end $$;

-- Publicly link a Lovebird pair (the heart + red string); their roles stay secret. Returns the partner (or null).
create or replace function public._reveal_love(p_player uuid) returns uuid language plpgsql set search_path = public as $$
declare v uuid;
begin
  select partner_id into v from player_secrets where player_id = p_player;
  if v is null then return null; end if;
  update players set love_partner_id = v where id = p_player;
  update players set love_partner_id = p_player where id = v;
  return v;
end $$;

-- Printable cards: role, code, and the modifiers the card carries (Lovebird, Cursed). The main deck only:
-- spare late-guest codes are listed apart (_spares), so the printed deck never changes.
create or replace function public._cards(p_room uuid) returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', substr(code, 1, 3) || '-' || substr(code, 4, 3), 'role', role,
                                               'lovebird', pair_id is not null, 'cursed', cursed) order by slot, code), '[]'::jsonb)
    from role_codes where room_id = p_room and not spare
$$;

-- The host's unused spare codes, same shape as _cards so they print the same: plain-Drinker spares, and the late pile
-- (late = true, any role the deck didn't use). Only the print page shows the roles.
create or replace function public._spares(p_room uuid) returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', substr(code, 1, 3) || '-' || substr(code, 4, 3), 'role', role,
                                               'lovebird', false, 'cursed', false, 'late', late) order by slot, code), '[]'::jsonb)
    from role_codes where room_id = p_room and spare and redeemed_at is null
$$;

-- Deal the main deck from per-role counts (+ 'lovebird' pairs and 'cursed', the modifiers). Shared by GENERATE CODES
-- (picked by hand) and PICK AT RANDOM. Replaces the old deck and the unused late pile (the late pile is shuffled from
-- what the deck leaves out, so it has to be shuffled again); plain-Drinker spare codes are left alone.
create or replace function public._deal_cards(p_room uuid, p_counts jsonb) returns void language plpgsql set search_path = public as $$
declare x record; v_int int; v_id uuid;
begin
  delete from role_codes where room_id = p_room and (not spare or (late and redeemed_at is null));
  for x in select key as role, greatest(0, least(40, (value #>> '{}')::int)) as n from jsonb_each(p_counts) loop
    continue when not (x.role = any (_roles()));
    for i in 1..x.n loop
      perform _new_code(p_room, x.role, null);
    end loop;
  end loop;
  -- Modifiers land on random dealt cards, whatever their role (Guilty included), with a small bias towards
  -- plain Drinker cards: sorting on random() × 0.75 makes each one about 1.4× as likely as any other card.
  -- Lovebird pairs: 2 cards per pair
  v_int := greatest(0, least(20, coalesce((p_counts ->> 'lovebird')::int, 0)));
  if v_int * 2 > (select count(*) from role_codes where room_id = p_room and not spare) then
    raise exception 'Not enough cards for % Lovebird pair(s)', v_int;
  end if;
  for i in 1..v_int loop
    v_id := gen_random_uuid();
    update role_codes set pair_id = v_id
     where id in (select id from role_codes where room_id = p_room and not spare and pair_id is null
                   order by random() * (case when role = 'drinker' then 0.75 else 1 end) limit 2);
  end loop;
  -- Cursed: the bias favours Drinker cards that don't already carry a Lovebird
  v_int := greatest(0, least(20, coalesce((p_counts ->> 'cursed')::int, 0)));
  if v_int > (select count(*) from role_codes where room_id = p_room and not spare) then raise exception 'Not enough cards for % Cursed', v_int; end if;
  update role_codes set cursed = true
   where id in (select id from role_codes where room_id = p_room and not spare
                 order by random() * (case when role = 'drinker' and pair_id is null then 0.75 else 1 end) limit v_int);
end $$;

-- PICK AT RANDOM: a secret but balanced deck for p_n players, as per-role counts. Always exactly one Intruder.
--   extra Saboteurs (Forger / Assassin): 4-7 players none · 8-10 none or one (50/50) · 11-15 one · 16+ both
--   Chaos (Scrooge / Jester):            4-6 none or one · 7-10 one or two · 11+ both
--   Betrayer: 6+ players, 3 decks in 4
--   Medic, Detective, Skank, Davy Jones: each in about 85% of decks, while there's room
--   the rest: plain Drinkers
create or replace function public._random_counts(p_n int) returns jsonb language plpgsql volatile set search_path = public as $$
declare v jsonb := '{"intruder":1}'::jsonb; v_left int := p_n - 1; v_k int; x text;
begin
  v_k := case when p_n <= 7 then 0 when p_n <= 10 then (random() < 0.5)::int when p_n <= 15 then 1 else 2 end;
  for x in select r from unnest(array['forger','assassin']) r order by random() limit least(v_k, v_left) loop
    v := v || jsonb_build_object(x, 1); v_left := v_left - 1;
  end loop;
  v_k := case when p_n <= 6 then (random() < 0.5)::int when p_n <= 10 then 1 + (random() < 0.5)::int else 2 end;
  for x in select r from unnest(array['scrooge','jester']) r order by random() limit least(v_k, v_left) loop
    v := v || jsonb_build_object(x, 1); v_left := v_left - 1;
  end loop;
  if p_n >= 6 and v_left > 0 and random() < 0.75 then v := v || '{"betrayer":1}'::jsonb; v_left := v_left - 1; end if;
  for x in select r from unnest(array['medic','detective','skank','davyjones']) r order by random() loop
    exit when v_left <= 0;
    if random() < 0.85 then v := v || jsonb_build_object(x, 1); v_left := v_left - 1; end if;
  end loop;
  return v || jsonb_build_object('drinker', greatest(0, v_left));
end $$;

-- Server-side spin. Cursed = two spins. "Spin again" chains double (max 2 re-spins); at the max depth the
-- third roll can't land on "spin again" (that would log nothing), so it re-rolls among the other segments.
-- "Safe…" lands but logs nothing.
create or replace function public._landings(p_wheel jsonb, p_cursed boolean) returns jsonb language plpgsql volatile set search_path = public as $$
declare
  out   jsonb := '[]'::jsonb;
  n     int := jsonb_array_length(p_wheel);
  spins int := case when p_cursed then 2 else 1 end;
  depth int; mult int; idx int; t text; k text; v_other int[];
begin
  if n = 0 then raise exception 'The wheel is empty'; end if;
  v_other := array(select (e.n - 1)::int from jsonb_array_elements(p_wheel) with ordinality as e(v, n) where not (e.v ->> 'text') ~* 'spin again');
  for i in 1..spins loop
    mult := 1; depth := 0;
    loop
      idx := floor(random() * n)::int;
      if depth >= 2 and cardinality(v_other) > 0 and (p_wheel -> idx ->> 'text') ~* 'spin again' then
        idx := v_other[1 + floor(random() * cardinality(v_other))::int];
      end if;
      t := p_wheel -> idx ->> 'text';
      k := case when t ~* '^\s*safe\y' then 'safe' when t ~* 'spin again' then 'again' else 'normal' end;
      out := out || jsonb_build_array(jsonb_build_object(
        'idx', idx, 'text', t, 'mult', mult, 'kind', k, 'spin', i,
        'graffiti', coalesce((p_wheel -> idx ->> 'graffiti')::boolean, false)));
      exit when k <> 'again' or depth >= 2;
      mult := mult * 2; depth := depth + 1;
    end loop;
  end loop;
  return out;
end $$;

-- A spin with a punishment multiplier (Jester's revenge = ×3): every landing's ×N is multiplied.
create or replace function public._landings(p_wheel jsonb, p_cursed boolean, p_times int) returns jsonb language sql volatile set search_path = public as $$
  select coalesce(jsonb_agg(e.l || jsonb_build_object('mult', (e.l ->> 'mult')::int * greatest(1, coalesce(p_times, 1))) order by e.n), '[]'::jsonb)
    from jsonb_array_elements(_landings(p_wheel, p_cursed)) with ordinality as e(l, n)
$$;

-- Davy Jones' Locker: lock a player up (no powers, no vote; one punishment waits for them)
create or replace function public._lock(p_room uuid, p_player uuid, p_minutes int) returns void language plpgsql set search_path = public as $$
begin
  update players set locked_until = now() + make_interval(mins => greatest(1, least(120, coalesce(p_minutes, 15)))), lock_requested_at = null
   where id = p_player;
  -- locked while called up (not spun yet): the round is called off and its punishment goes back to the queue, where
  -- the Locker rule below holds it for them. One they were only standing in for (or swapped onto) goes back to its owner.
  update queue set status = 'queued'
   where status = 'active' and id in (select queue_id from rounds where room_id = p_room and victim_id = p_player and phase = 'waiting');
  update rounds set phase = 'cancelled', ended_at = now() where room_id = p_room and victim_id = p_player and phase = 'waiting';
  -- what was already queued for them follows the Locker rule too: the first one waits ('held'), the rest are dropped
  if not exists (select 1 from queue where player_id = p_player and status = 'held') then
    update queue set status = 'held'
     where id = (select id from queue where player_id = p_player and status = 'queued' order by pos limit 1);
  end if;
  update queue set status = 'cancelled' where player_id = p_player and status = 'queued';
  perform _event(p_room, 'locked', jsonb_build_object('player', p_player, 'until', (select locked_until from players where id = p_player)));
end $$;


-- ---------- host undo ----------
create or replace function public._snapshot(p_room uuid) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'room',             (select to_jsonb(x) from rooms x where x.id = p_room),
    'players',          coalesce((select jsonb_agg(to_jsonb(x)) from players x where x.room_id = p_room), '[]'),
    'player_secrets',   coalesce((select jsonb_agg(to_jsonb(x)) from player_secrets x where x.room_id = p_room), '[]'),
    'role_codes',       coalesce((select jsonb_agg(to_jsonb(x)) from role_codes x where x.room_id = p_room), '[]'),
    'punishments',      coalesce((select jsonb_agg(to_jsonb(x)) from punishments x where x.room_id = p_room), '[]'),
    'queue',            coalesce((select jsonb_agg(to_jsonb(x)) from queue x where x.room_id = p_room), '[]'),
    'rounds',           coalesce((select jsonb_agg(to_jsonb(x)) from rounds x where x.room_id = p_room), '[]'),
    'shields',          coalesce((select jsonb_agg(to_jsonb(x)) from shields x where x.room_id = p_room), '[]'),
    'games',            coalesce((select jsonb_agg(to_jsonb(x)) from games x where x.room_id = p_room), '[]'),
    'votes',            coalesce((select jsonb_agg(to_jsonb(x)) from votes x where x.room_id = p_room), '[]'),
    'ballots',          coalesce((select jsonb_agg(to_jsonb(x)) from ballots x where x.room_id = p_room), '[]'),
    'curse_passes',     coalesce((select jsonb_agg(to_jsonb(x)) from curse_passes x where x.room_id = p_room), '[]'),
    'graffiti',         coalesce((select jsonb_agg(to_jsonb(x)) from graffiti x where x.room_id = p_room), '[]'),
    'beer_log',         coalesce((select jsonb_agg(to_jsonb(x)) from beer_log x where x.room_id = p_room), '[]'),
    'evidence',         coalesce((select jsonb_agg(to_jsonb(x)) from evidence x where x.room_id = p_room), '[]'),
    'detective_checks', coalesce((select jsonb_agg(to_jsonb(x)) from detective_checks x where x.room_id = p_room), '[]'),
    'sausage_plates',   coalesce((select jsonb_agg(to_jsonb(x)) from sausage_plates x where x.room_id = p_room), '[]'))
$$;

create or replace function public._restore(p_room uuid, p jsonb) returns void language plpgsql set search_path = public as $$
begin
  delete from ballots where room_id = p_room;       delete from votes where room_id = p_room;
  delete from rounds where room_id = p_room;        delete from games where room_id = p_room;
  delete from graffiti where room_id = p_room;      delete from beer_log where room_id = p_room;
  delete from evidence where room_id = p_room;      delete from detective_checks where room_id = p_room;
  delete from shields where room_id = p_room;       delete from queue where room_id = p_room;
  delete from punishments where room_id = p_room;   delete from curse_passes where room_id = p_room;
  delete from role_codes where room_id = p_room;    delete from player_secrets where room_id = p_room;
  delete from sausage_plates where room_id = p_room;
  delete from players where room_id = p_room;
  insert into players          select * from jsonb_populate_recordset(null::players, p -> 'players');
  insert into player_secrets   select * from jsonb_populate_recordset(null::player_secrets, p -> 'player_secrets');
  insert into role_codes       select * from jsonb_populate_recordset(null::role_codes, p -> 'role_codes');
  insert into punishments      select * from jsonb_populate_recordset(null::punishments, p -> 'punishments');
  insert into queue overriding system value select * from jsonb_populate_recordset(null::queue, p -> 'queue');
  insert into rounds           select * from jsonb_populate_recordset(null::rounds, p -> 'rounds');
  insert into shields          select * from jsonb_populate_recordset(null::shields, p -> 'shields');
  insert into games            select * from jsonb_populate_recordset(null::games, p -> 'games');
  insert into votes            select * from jsonb_populate_recordset(null::votes, p -> 'votes');
  insert into ballots          select * from jsonb_populate_recordset(null::ballots, p -> 'ballots');
  insert into curse_passes     select * from jsonb_populate_recordset(null::curse_passes, p -> 'curse_passes');
  insert into graffiti         select * from jsonb_populate_recordset(null::graffiti, p -> 'graffiti');
  insert into beer_log overriding system value select * from jsonb_populate_recordset(null::beer_log, p -> 'beer_log');
  insert into evidence         select * from jsonb_populate_recordset(null::evidence, p -> 'evidence');
  insert into detective_checks select * from jsonb_populate_recordset(null::detective_checks, p -> 'detective_checks');
  insert into sausage_plates   select * from jsonb_populate_recordset(null::sausage_plates, coalesce(p -> 'sausage_plates', '[]'));
  update rooms x set status = o.status, tally = o.tally, target = o.target, deadline_at = o.deadline_at,
         segments = o.segments, settings = o.settings, ended = o.ended, final_tally = o.final_tally,
         result = o.result, revealed = o.revealed, reveal = o.reveal
    from jsonb_populate_record(null::rooms, p -> 'room') o where x.id = p_room;
end $$;

create or replace function public._undo_label(p_action text, a jsonb) returns text language sql immutable as $$
  select case p_action
    when 'log_beer'       then case when (a ->> 'delta') = '-1' then '−1 beer' else '+1 beer' end
    when 'accept'         then 'Accepted punishment'
    when 'finish_saved'   then 'Saved round'
    when 'cancel_round'   then 'Cancelled punishment'
    when 'call_next'      then 'Called up next victim'
    when 'start_game'     then 'Started game'
    when 'finish_game'    then 'Game over + losers'
    when 'start_vote'     then 'Started trial'
    when 'close_vote'     then 'Trial verdict'
    when 'expose'         then 'Exposed a player'
    when 'unexpose'       then 'Hid a role'
    when 'decide_curse'   then 'Curse pass decision'
    when 'kick'           then 'Kicked a player'
    when 'queue_add'      then 'Added to queue'
    when 'queue_remove'   then 'Removed from queue'
    when 'remove_graffiti' then 'Removed graffiti'
    when 'hide_evidence'  then 'Hid evidence'
    when 'free_spin'      then 'Free spin'
    when 'jester_revenge' then 'Jester''s revenge'
    when 'decide_lock'    then 'Locker decision'
    when 'lock'           then 'Locked a player up'
    when 'unlock'         then 'Let a player out'
    when 'make_angel'     then 'Made an Angel'
    when 'bbq_start'      then 'Started Aaron''s Plate'
    when 'bbq_close'      then 'Dirty sausage result'
    else p_action end
$$;

-- =====================================================================
-- Action groups. Each returns a jsonb result; {"no_touch":true} means the
-- action is secret and must NOT ping other screens.
-- =====================================================================

-- ---------- setup, cards, evidence, undo ----------
create or replace function public._a_setup(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_json jsonb; v_text text; u undo_log; v_int int; v_bool boolean;
begin
  case p_action
  when 'update_settings' then
    if a ? 'segments' and (jsonb_typeof(a -> 'segments') <> 'array' or jsonb_array_length(a -> 'segments') < 2) then
      raise exception 'The wheel needs at least 2 segments';
    end if;
    update rooms set
      target      = greatest(1, coalesce((a ->> 'target')::int, target)),
      deadline_at = coalesce((a ->> 'deadline_at')::timestamptz, deadline_at),
      segments    = coalesce(a -> 'segments', segments),
      settings    = settings || coalesce(a -> 'settings', '{}'::jsonb),
      status      = coalesce(a ->> 'status', status)
    where id = r.id returning * into r;
    if r.ended and r.deadline_at > now() then
      update rooms set ended = false, final_tally = null, result = null where id = r.id;
    end if;
    if a ? 'tally' then update rooms set tally = greatest(0, (a ->> 'tally')::int) where id = r.id; end if;

  when 'generate_cards' then
    if exists (select 1 from role_codes where room_id = r.id and redeemed_at is not null) then
      raise exception 'Someone has already redeemed a code, so the cards are locked. Create a new room to re-deal.';
    end if;
    v_json := coalesce(a -> 'role_counts', r.settings -> 'role_counts');
    perform _deal_cards(r.id, v_json);
    update rooms set settings = jsonb_set(settings, '{role_counts}', v_json) - 'random_deal' where id = r.id;
    res := jsonb_build_object('cards', _cards(r.id));

  -- PICK AT RANDOM: deal a secret deck for n players (see _random_counts), so the host plays blind too. Nothing about
  -- the mix is saved or sent back: settings only learn the deck size (random_deal = n) and the modifiers, which the
  -- host chose. The hand-picked role_counts stay as they were (not the deal), so switching back keeps them.
  when 'random_deal' then
    if exists (select 1 from role_codes where room_id = r.id and redeemed_at is not null) then
      raise exception 'Someone has already redeemed a code, so the cards are locked. Create a new room to re-deal.';
    end if;
    v_int := coalesce((a ->> 'n')::int, 0);
    if v_int < 4 or v_int > 20 then raise exception 'Pick 4 to 20 players'; end if;
    v_json := jsonb_build_object(
      'lovebird', greatest(0, least(20, coalesce((a ->> 'lovebird')::int, (r.settings #>> '{role_counts,lovebird}')::int, 0))),
      'cursed',   greatest(0, least(20, coalesce((a ->> 'cursed')::int,   (r.settings #>> '{role_counts,cursed}')::int, 0))));
    perform _deal_cards(r.id, _random_counts(v_int) || v_json);
    update rooms set settings = jsonb_set(settings, '{role_counts}', coalesce(settings -> 'role_counts', '{}'::jsonb) || v_json)
                                || jsonb_build_object('random_deal', v_int)
     where id = r.id;
    res := jsonb_build_object('n', v_int);

  when 'get_cards' then
    res := jsonb_build_object('cards', _cards(r.id), 'no_touch', true, 'spares', _spares(r.id),
             'redeemed', (select count(*) from role_codes where room_id = r.id and redeemed_at is not null));

  -- Spare codes for late guests: n extra single-use codes, each ALWAYS a plain Drinker (no Lovebird, no Curse).
  -- They work after the deck is locked, redeem through the normal 'redeem', and look like any other code.
  -- They never touch the main deck: generate_cards leaves them alone, and a redeemed spare still locks re-dealing.
  -- Only the new codes come back (no per-role counts), so nothing about the deck leaks.
  when 'spare_codes' then
    if r.ended then raise exception 'The night is over'; end if;
    if r.status not in ('lobby', 'live') then raise exception 'Spare codes only work in a lobby or live room'; end if;
    v_int := coalesce((a ->> 'n')::int, 1);
    if v_int < 1 or v_int > 5 then raise exception 'Make 1 to 5 spare codes at a time'; end if;
    if (select count(*) from role_codes where room_id = r.id and spare and redeemed_at is null) + v_int > 20 then
      raise exception 'Too many unused spare codes already. Use those first';
    end if;
    v_json := coalesce((select jsonb_agg(code) from role_codes where room_id = r.id), '[]'::jsonb);
    for i in 1..v_int loop
      perform _new_code(r.id, 'drinker', null);
    end loop;
    update role_codes set spare = true, cursed = false, pair_id = null
     where room_id = r.id and not (v_json ? code);
    res := jsonb_build_object('codes', coalesce((select jsonb_agg(substr(code, 1, 3) || '-' || substr(code, 4, 3))
                                                   from role_codes where room_id = r.id and not (v_json ? code)), '[]'::jsonb),
                              'no_touch', true);

  -- THE LATE PILE: n sealed spare cards (0-5) shuffled from the roles the deck doesn't use, plus plain Drinkers, so a late
  -- guest can't be cleared just for arriving late. Never the Intruder (always in the main deck), never two Saboteurs
  -- (a late Saboteur already in play counts), never a role anyone already holds, no modifiers. Shuffling again replaces
  -- only the unused late cards; plain spare codes are left alone. Works after the deck is locked. Only a count comes back.
  when 'late_pile' then
    if r.ended then raise exception 'The night is over'; end if;
    if r.status not in ('lobby', 'live') then raise exception 'The late pile only works in a lobby or live room'; end if;
    v_int := coalesce((a ->> 'n')::int, 3);
    if v_int < 0 or v_int > 5 then raise exception 'The late pile holds 0 to 5 cards'; end if;
    if not exists (select 1 from role_codes where room_id = r.id and not spare) then raise exception 'Deal the main deck first'; end if;
    delete from role_codes where room_id = r.id and late and redeemed_at is null;
    v_json := coalesce((select jsonb_agg(code) from role_codes where room_id = r.id), '[]'::jsonb);
    v_bool := exists (select 1 from player_secrets ps where ps.room_id = r.id and ps.role in ('forger','assassin')
                        and exists (select 1 from role_codes c where c.redeemed_by = ps.player_id and c.late));
    for v_text in
      select b from unnest(array(
        select rl from unnest(_roles()) rl
         where rl not in ('intruder', 'drinker')
           and not exists (select 1 from role_codes c where c.room_id = r.id and c.role = rl)
           and not exists (select 1 from player_secrets ps where ps.room_id = r.id and ps.role = rl))
        || array_fill('drinker'::text, array[v_int])) b
      order by random() limit v_int
    loop
      if v_text in ('forger', 'assassin') then
        if v_bool then v_text := 'drinker'; else v_bool := true; end if;
      end if;
      perform _new_code(r.id, v_text, null);
    end loop;
    update role_codes set spare = true, late = true, cursed = false, pair_id = null
     where room_id = r.id and not (v_json ? code);
    res := jsonb_build_object('n', v_int, 'no_touch', true);

  when 'kick' then
    v_id := (a ->> 'player_id')::uuid;
    if not exists (select 1 from players where id = v_id and room_id = r.id) then raise exception 'They''re not in this room'; end if;
    -- tidy up everything that points at them, so nothing is left dangling or stuck
    update player_secrets set partner_id = null, pair_id = null where room_id = r.id and partner_id = v_id;   -- their Lovebird is single again
    update players set love_partner_id = null where room_id = r.id and love_partner_id = v_id;
    -- kicking someone who was facing another player's punishment (a stand-in or a Scrooge swap) hands it back:
    -- the original's queue row goes back in the queue (in its old place), never silently gone
    update queue q set status = case when exists (select 1 from players p where p.id = q.player_id and p.locked_until > now()) then 'held' else 'queued' end
      from rounds rd2
     where rd2.room_id = r.id and rd2.victim_id = v_id and rd2.phase in ('waiting','spinning','revealed','saved')
       and rd2.original_victim_id is distinct from v_id and q.id = rd2.queue_id and q.status = 'active' and q.player_id <> v_id;
    update rounds set phase = 'cancelled', ended_at = now()
     where room_id = r.id and victim_id = v_id and phase in ('waiting','spinning','revealed','saved');
    for x in select * from minigames where room_id = r.id and status in ('muster','live') and v_id = any (players) loop
      update minigames set status = 'cancelled', finished_at = now() where id = x.id;
      if x.refund is not null and x.started_by is not null and x.started_by <> v_id then
        execute format('update player_secrets set %I = null where player_id = $1', x.refund) using x.started_by;
      end if;
      update rooms set ability_until = null where id = r.id;       -- a live game held the stage: free it
      perform _event(r.id, 'mg_cancelled', jsonb_build_object('game', x.id, 'kind', x.kind));
    end loop;
    update players set shivved_by = null where room_id = r.id and shivved_by = v_id;
    update votes set options = array_remove(options, v_id) where room_id = r.id and status = 'open';
    delete from players where id = v_id;               -- their card code stays burned (redeemed_at is kept)
    perform _pass_knife(r.id);                          -- a kicked Intruder's knife goes to the Betrayer

  when 'submit_evidence' then
    if me.id is null then raise exception 'Join the room first'; end if;
    if coalesce(a ->> 'image_url', '') = '' then raise exception 'Take a photo first'; end if;
    -- only a photo uploaded to the anonymous evidence folder (no user id in the path, so it can't be traced
    -- back to whoever filed it), or the mock server's /files/ locally: no outside links on the TV
    if (a ->> 'image_url') !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/selfies/ev/[A-Za-z0-9._-]+$'
       and (a ->> 'image_url') !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/files/[A-Za-z0-9-]+$' then
      raise exception 'Take the photo on this phone';
    end if;
    if (select count(*) from evidence where player_id = me.id) >= 12 then raise exception 'That''s plenty of evidence from you'; end if;
    insert into evidence (room_id, player_id, image_url, caption)
    values (r.id, me.id, a ->> 'image_url', left(regexp_replace(trim(coalesce(a ->> 'caption', '')), '\s+', ' ', 'g'), 80));
    perform _event(r.id, 'evidence', '{}'::jsonb);     -- anonymous: no submitter in the event

  when 'hide_evidence' then
    update evidence set hidden = true where id = (a ->> 'evidence_id')::uuid and room_id = r.id;

  when 'undo' then
    select * into u from undo_log where room_id = r.id and created_at > now() - interval '2 minutes' order by id desc limit 1;
    if u.id is null then raise exception 'Nothing to undo (only the last 2 minutes can be undone)'; end if;
    if u.blocked then raise exception 'Can''t undo that one: the game has moved on since. Fix it by hand'; end if;
    -- phone beers logged since the snapshot survive the undo
    v_json := coalesce((select jsonb_agg(jsonb_build_object('player_id', b.player_id, 'created_at', b.created_at))
                          from beer_log b where b.room_id = r.id and b.player_id is not null and b.created_at > u.created_at), '[]'::jsonb);
    v_text := coalesce((select jsonb_agg(to_jsonb(sc)) from role_codes sc where sc.room_id = r.id and sc.spare and sc.redeemed_at is null), '[]'::jsonb)::text;
    perform _restore(r.id, u.snap);
    insert into role_codes select * from jsonb_populate_recordset(null::role_codes, v_text::jsonb) sc
     where not exists (select 1 from role_codes rc where rc.id = sc.id or rc.code = sc.code);
    insert into beer_log (room_id, player_id, created_at)
    select r.id, (e ->> 'player_id')::uuid, (e ->> 'created_at')::timestamptz from jsonb_array_elements(v_json) e
     where exists (select 1 from players where id = (e ->> 'player_id')::uuid);
    get diagnostics v_int = row_count;
    update players p set beers = p.beers + q.n
      from (select (e ->> 'player_id')::uuid pid, count(*) n from jsonb_array_elements(v_json) e group by 1) q where p.id = q.pid;
    update rooms set tally = tally + v_int where id = r.id;
    update player_secrets ps set skank_bonus = ps.skank_bonus + q.n
      from (select (e ->> 'player_id')::uuid pid, count(*) n from jsonb_array_elements(v_json) e group by 1) q
     where ps.player_id = q.pid and ps.role = 'skank' and not ps.burned;
    delete from undo_log where id = u.id;
    perform _event(r.id, 'undo', jsonb_build_object('label', u.label));
    res := jsonb_build_object('undone', u.label);
  end case;
  return res;
end $$;

-- ---------- roles: redeem, expose, reveal ----------
create or replace function public._a_roles(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_id2 uuid; v_text text; v_json jsonb;
begin
  case p_action
  when 'redeem' then
    if s.player_id is not null then raise exception 'You already have a role'; end if;
    select * into x from role_codes
     where room_id = r.id and code = _norm_code(a ->> 'code') and redeemed_by is null and redeemed_at is null for update;
    if not found then raise exception 'That code isn''t valid or has already been used'; end if;
    insert into player_secrets (player_id, room_id, role, pair_id, heals_left, guesses_left, respins_left, hit_alive)
    values (me.id, r.id, x.role, x.pair_id,
            case when x.role = 'medic'    then 2 else 0 end,
            case when x.role = 'betrayer' then 2 else 0 end,
            case when x.role = 'scrooge'   then 2 else 0 end,
            x.role = 'intruder');
    update role_codes set redeemed_by = me.id, redeemed_at = now() where id = x.id;
    update players set has_role = true, cursed = (cursed or x.cursed or x.role = 'cursed') where id = me.id;
    if x.pair_id is not null then                -- Lovebird bonus: link up once both halves are redeemed
      select c.redeemed_by into v_id from role_codes c where c.pair_id = x.pair_id and c.id <> x.id and c.redeemed_by is not null;
      if v_id is not null then
        update player_secrets set partner_id = v_id  where player_id = me.id;
        update player_secrets set partner_id = me.id where player_id = v_id;
      end if;
    end if;
    if x.cursed or x.role = 'cursed' then           -- the curse is public; the role underneath stays secret
      perform _event(r.id, 'cursed', jsonb_build_object('player', me.id));
    end if;
    res := jsonb_build_object('role', x.role, 'team', _team(x.role, '{}', false));

  when 'expose' then
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    select role, partner_id into v_text, v_id2 from player_secrets where player_id = v_id;
    if v_text is null then
      v_text := a ->> 'role';                 -- never redeemed a code: host picks manually
      if v_text is null then raise exception 'NEEDS_ROLE'; end if;
      if not (v_text = any (_roles())) then raise exception 'Unknown role'; end if;
      update players set public_role = v_text where id = v_id;
    elsif _is_guilty(v_id) then
      perform _catch(r.id, v_id);             -- caught: stamped, rehab, knife moves on
    else
      update players set public_role = v_text where id = v_id;
    end if;
    -- exposing a card also shows its Lovebird bonus (the partner's role stays secret)
    if v_id2 is not null and not exists (select 1 from players where id = v_id and love_partner_id = v_id2) then
      perform _reveal_love(v_id);
      perform _event(r.id, 'lovebirds', jsonb_build_object('a', v_id, 'b', v_id2));
    end if;
    perform _event(r.id, 'exposed', jsonb_build_object('player', v_id, 'role', (select public_role from players where id = v_id),
                                                       'rehab', (select rehab from players where id = v_id)));
    res := jsonb_build_object('role', (select public_role from players where id = v_id));

  when 'unexpose' then
    v_id := (a ->> 'player_id')::uuid;
    update players set love_partner_id = null where room_id = r.id and love_partner_id = v_id;
    update players set public_role = null, love_partner_id = null, rehab = false,
                       rehab_beers = 0, shivs_used = 0, last_shiv_game = null where id = v_id and room_id = r.id;
    -- a caught player un-caught: they get back what the catch took, and a knife that passed on because of
    -- the catch comes back (never two knife holders)
    select caught_prev, role into v_json, v_text from player_secrets where player_id = v_id and room_id = r.id;
    if v_json is not null then
      -- a Betrayer who held a passed-on knife: if an Intruder is back in play meanwhile, the knife is theirs, and this
      -- Betrayer comes back without it
      if v_text is distinct from 'intruder' and coalesce((v_json ->> 'has_knife')::boolean, false)
         and exists (select 1 from player_secrets ps join players p on p.id = ps.player_id
                      where ps.room_id = r.id and ps.player_id <> v_id and ps.role = 'intruder' and not p.rehab) then
        v_json := v_json || '{"has_knife":false,"hit_alive":false}'::jsonb;
      end if;
      -- they held the knife when caught (an Intruder always does): take it back from WHOEVER holds it now, not just
      -- the one it first went to (it may have moved on since, if that Betrayer was caught too). A Betrayer who loses
      -- it gets their guesses back (_pass_knife zeroed them; a guess spends one, so it's 2 less what they've used).
      if v_text = 'intruder' or coalesce((v_json ->> 'has_knife')::boolean, false) then
        update player_secrets set has_knife = false, hit_alive = false, guesses_left = greatest(0, 2 - cardinality(guessed))
         where room_id = r.id and player_id <> v_id and has_knife and role is distinct from 'intruder';
      end if;
      update player_secrets set has_knife = coalesce((v_json ->> 'has_knife')::boolean, has_knife),
                                hit_alive = coalesce((v_json ->> 'hit_alive')::boolean, hit_alive),
                                forge_used = coalesce((v_json ->> 'forge_used')::boolean, forge_used),
                                frame_used = coalesce((v_json ->> 'frame_used')::boolean, frame_used),
                                last_hit_game = (v_json ->> 'last_hit_game')::int,
                                caught_prev = null
       where player_id = v_id;
    end if;

  when 'reveal_all' then
    for x in select p.id, ps.role, ps.partner_id from players p join player_secrets ps on ps.player_id = p.id where p.room_id = r.id loop
      update players set public_role = x.role,
                         love_partner_id = coalesce(x.partner_id, love_partner_id)
       where id = x.id;
    end loop;
    update rooms set revealed = true,
      reveal = jsonb_build_object(
        'teams',     coalesce((select jsonb_agg(jsonb_build_object('betrayer', ps.player_id, 'intruder', t.v))
                                 from player_secrets ps cross join lateral unnest(ps.team_with) as t(v)
                                where ps.room_id = r.id and ps.role = 'betrayer'), '[]'::jsonb),
        'knife',     coalesce((select jsonb_agg(player_id) from player_secrets where room_id = r.id and has_knife), '[]'::jsonb),
        'guilty',    coalesce((select jsonb_agg(player_id) from player_secrets where room_id = r.id
                                  and _team(role, team_with, has_knife) = 'guilty'), '[]'::jsonb),
        'checks',    coalesce((select jsonb_agg(jsonb_build_object('detective', detective_id, 'target', target_id, 'guilty', guilty,
                                                                   'framed', framed, 'group', to_jsonb(group_ids), 'level', level) order by created_at)
                                 from detective_checks where room_id = r.id), '[]'::jsonb),
        'frames',    coalesce((select jsonb_agg(jsonb_build_object('forger', player_id, 'target', frame_target, 'spent', frame_spent))
                                 from player_secrets where room_id = r.id and frame_target is not null), '[]'::jsonb),
        'forgeries', coalesce((select jsonb_agg(jsonb_build_object('player', player_id, 'medic', by_player, 'used', used_at is not null) order by created_at)
                                 from shields where room_id = r.id and forged), '[]'::jsonb),
        'at', now())
    where id = r.id;
    perform _event(r.id, 'reveal_all', '{}'::jsonb);
  end case;
  return res;
end $$;

-- ---------- tally, games, trial ----------
create or replace function public._a_games(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_text text; v_int int; v_ids uuid[];
  v_start timestamptz; v_min int; v_cnt int; v_c1 int; v_c2 int; v_total int; v_out jsonb;
begin
  case p_action
  when 'log_beer' then
    if r.ended or (not v_host and now() >= r.deadline_at) then raise exception 'Time''s up — the tally is frozen'; end if;   -- players stop at the deadline, even before the TV ends the night
    v_int := coalesce((a ->> 'delta')::int, 1);
    if v_host then
      if v_int not in (1, -1) then raise exception 'Bad amount'; end if;
      update rooms set tally = greatest(0, tally + v_int) where id = r.id returning * into r;
      if v_int > 0 then insert into beer_log (room_id, player_id) values (r.id, null); end if;
      perform _event(r.id, case when v_int > 0 then 'beer' else 'unbeer' end, jsonb_build_object('tally', r.tally));
    else
      if v_int <> 1 then raise exception 'Only the host can take beers off'; end if;
      if not me.has_role then raise exception 'Open your card first: type your code in YOUR FILE'; end if;   -- no card, no beers (no sock puppets)
      -- one beer every 3 minutes: plenty for honest drinking, and it stops tap-farming the tally and the level-ups
      if me.last_beer_at is not null and now() - me.last_beer_at < interval '3 minutes' then
        v_min := ceil(180 - extract(epoch from now() - me.last_beer_at))::int;
        raise exception 'Easy! One beer every 3 minutes. Log this one in %', case when v_min > 60 then (v_min / 60) || 'm ' || lpad((v_min % 60)::text, 2, '0') || 's' else v_min || 's' end;
      end if;
      update players set beers = beers + 1, last_beer_at = now(),
                         rehab_beers = rehab_beers + case when rehab then 1 else 0 end   -- toward the Shiv
       where id = me.id returning beers into v_cnt;
      update rooms set tally = tally + 1 where id = r.id returning * into r;
      insert into beer_log (room_id, player_id) values (r.id, me.id);
      -- SKANK: each beer secretly counts double (triple from level 4); banked, added at the deadline
      if s.role = 'skank' and not s.burned and not me.rehab then
        update player_secrets set skank_bonus = skank_bonus + case when _plevel(v_cnt, r.id) >= 4 then 2 else 1 end where player_id = me.id;
      end if;
      perform _event(r.id, 'beer', jsonb_build_object('player', me.id, 'tally', r.tally));
      v_c1 := _plevel(v_cnt - 1, r.id); v_c2 := _plevel(v_cnt, r.id);
      if v_c2 > v_c1 then perform _event(r.id, 'level_up', jsonb_build_object('player', me.id, 'level', v_c2)); end if;
    end if;
    res := jsonb_build_object('tally', r.tally);

  when 'end_check' then
    if not r.ended and now() >= r.deadline_at then
      v_int := coalesce((select sum(skank_bonus) from player_secrets where room_id = r.id), 0)::int;   -- the Skank's hidden beers
      update rooms set ended = true, final_tally = tally + v_int,
        result = jsonb_build_object(
          'winner', case when tally + v_int >= target then 'group' else 'guilty' end,
          'counted', tally, 'skank_bonus', v_int,
          'betrayer_joined', exists (select 1 from player_secrets where room_id = r.id and role = 'betrayer'
                                       and (cardinality(team_with) > 0 or has_knife)))
      where id = r.id;
      perform _event(r.id, 'ended', '{}'::jsonb);
    else
      res := '{"ok":true,"no_touch":true}'::jsonb;
    end if;

  when 'start_game' then
    v_text := left(trim(coalesce(a ->> 'name', '')), 40);
    if v_text = '' then raise exception 'Name the game'; end if;
    if exists (select 1 from games where room_id = r.id and status = 'active') then raise exception 'Finish the current game first'; end if;
    -- optional drawn matchup: [[ids], [ids], …]
    v_out := case when jsonb_typeof(a -> 'matchup') = 'array' then a -> 'matchup' end;
    if v_out is not null and exists (select 1 from jsonb_array_elements(v_out) t(side)
                                      where jsonb_typeof(t.side) <> 'array'
                                         or exists (select 1 from jsonb_array_elements_text(t.side) q(v) where not _in_room(r.id, q.v::uuid))) then
      raise exception 'Unknown player in the matchup';
    end if;
    insert into games (room_id, name, matchup) values (r.id, v_text, v_out) returning id into v_id;
    perform _event(r.id, 'game_start', jsonb_build_object('game', v_id, 'name', v_text));
    res := jsonb_build_object('game_id', v_id);

  when 'finish_game' then
    select * into x from games where id = (a ->> 'game_id')::uuid and room_id = r.id and status = 'active';
    if not found then raise exception 'No game running'; end if;
    v_ids := coalesce((select array_agg(q.v::uuid order by q.n) from (select distinct on (e.v) e.v, e.n
               from jsonb_array_elements_text(coalesce(a -> 'losers', '[]'::jsonb)) with ordinality as e(v, n) order by e.v, e.n) q), '{}');
    if exists (select 1 from unnest(v_ids) as l(v) where not _in_room(r.id, l.v)) then raise exception 'Unknown player'; end if;
    -- the Angel is never punished: silently left off the losers
    v_ids := array(select l.v from unnest(v_ids) with ordinality as l(v, n)
                    where not exists (select 1 from players where id = l.v and public_role = 'angel') order by l.n);
    update games set status = 'ended', losers = v_ids, ended_at = now() where id = x.id;
    insert into queue (room_id, player_id, reason)
    select r.id, l.v, 'Lost ' || x.name from unnest(v_ids) with ordinality as l(v, n) order by l.n;
    perform _event(r.id, 'game_over', jsonb_build_object('game', x.id, 'name', x.name, 'losers', to_jsonb(v_ids)));
    -- THE SKANK HAS BEEN AT WORK: a tease after every game. It carries nothing (no amount, no name) and is decided by
    -- public facts only, never by whether a Skank has entered their code (a late Skank would start it) or been kicked
    -- (that would stop it): it plays whenever a Skank could be in the deck (a random deal, a Skank in the hand-picked
    -- counts, or a late pile) until the Skank is unmasked. So it may play with no Skank in play, and it gives nobody
    -- away. The stash itself goes into the count at the deadline (end_check), where the TV plays it.
    if not exists (select 1 from players where room_id = r.id and public_role = 'skank')
       and (r.settings ? 'random_deal'
            or coalesce((r.settings #>> '{role_counts,skank}')::int, 0) > 0
            or exists (select 1 from role_codes where room_id = r.id and late)) then
      perform _event(r.id, 'skank_work', '{}'::jsonb);
    end if;
    -- After a game the TV shows: the Biggest Champ, then the Biggest Slacker, then the host starts the Trial.
    v_start := (select max(ended_at) from games where room_id = r.id and status = 'ended' and id <> x.id);
    -- Biggest Champ: most beers since the previous game. Reward: a golden ticket (skips their next
    -- punishment; sealed, so the Forger can't touch it). Up to 3 tied champs each get one; a bigger tie crowns nobody.
    with c as (
      select p.id, (select count(*) from beer_log b where b.player_id = p.id and (v_start is null or b.created_at > v_start))::int n
        from players p where p.room_id = r.id and (v_start is null or p.created_at <= v_start) and p.public_role is distinct from 'angel')
    select max(n), count(*), (select array_agg(id) from c where n = (select max(n) from c)) into v_min, v_cnt, v_ids from c;
    if v_cnt >= 2 and cardinality(v_ids) < v_cnt and cardinality(v_ids) <= 3 and v_min > 0 then
      update games set champs = v_ids, champ_beers = v_min where id = x.id;
      insert into shields (room_id, player_id, by_player, fake, sealed, golden) select r.id, w.v, w.v, false, true, true from unnest(v_ids) as w(v);
      perform _event(r.id, 'champ', jsonb_build_object('game', x.id, 'players', to_jsonb(v_ids), 'beers', v_min));
    end if;
    -- Biggest Slacker: fewest beers logged on their phone since the previous game
    -- (late joiners skipped). Everyone tied is punished; if everyone ties, nobody is.
    with c as (
      select p.id, (select count(*) from beer_log b where b.player_id = p.id and (v_start is null or b.created_at > v_start))::int n
        from players p where p.room_id = r.id and (v_start is null or p.created_at <= v_start)
         and p.public_role is distinct from 'angel' and coalesce(p.locked_until <= now(), true))   -- not the Angel, not anyone in the Locker
    select min(n), count(*), (select array_agg(id) from c where n = (select min(n) from c)) into v_min, v_cnt, v_ids from c;
    if v_cnt >= 2 and cardinality(v_ids) < v_cnt then
      update games set slackers = v_ids, slacker_beers = v_min where id = x.id;
      insert into queue (room_id, player_id, reason) select r.id, w.v, 'Biggest Slacker' from unnest(v_ids) as w(v);
      perform _event(r.id, 'slacker', jsonb_build_object('game', x.id, 'players', to_jsonb(v_ids), 'beers', v_min));
    else
      perform _event(r.id, 'slacker', jsonb_build_object('game', x.id, 'players', '[]'::jsonb, 'beers', v_min));
    end if;

  when 'start_vote' then
    if exists (select 1 from votes where room_id = r.id and status = 'open') then raise exception 'A vote is already running'; end if;
    v_ids := array(select id from players where room_id = r.id and not rehab and public_role is distinct from 'angel' order by seat);
    if cardinality(v_ids) < 3 then raise exception 'Need at least 3 players'; end if;
    v_text := coalesce(a ->> 'kind', 'trial');
    insert into votes (room_id, kind, game_id, title, options, ends_at)
    values (r.id, v_text, (a ->> 'game_id')::uuid,
            coalesce(a ->> 'title', case v_text when 'trial' then 'The Trial' else 'Vote' end),
            v_ids, now() + make_interval(secs => least(120, greatest(10, coalesce((a ->> 'seconds')::int, 30)))))
    returning id into v_id;
    perform _event(r.id, 'vote_start', jsonb_build_object('vote', v_id, 'kind', v_text));
    res := jsonb_build_object('vote_id', v_id);

  when 'cast_vote' then
    select * into x from votes where id = (a ->> 'vote_id')::uuid and room_id = r.id;
    if not found or x.status <> 'open' or now() > x.ends_at + interval '2 seconds' then raise exception 'Voting has closed'; end if;
    if not me.has_role then raise exception 'Open your card first: no card, no vote'; end if;
    if me.rehab then raise exception 'You''re in rehab — no vote'; end if;
    if me.locked_until > now() then raise exception 'You''re in Davy Jones'' Locker — no vote'; end if;
    v_id := (a ->> 'choice_id')::uuid;
    -- the Angel can't be accused, but still gets a vote
    if not (me.id = any (x.options) or (me.public_role = 'angel' and me.created_at <= x.created_at)) then
      raise exception 'You joined after this vote started'; end if;
    if not (v_id = any (x.options) or (x.kind = 'trial' and v_id = _no_trial())) then raise exception 'Not an option'; end if;
    if v_id = me.id then raise exception 'You can''t vote for yourself'; end if;
    insert into ballots (vote_id, room_id, voter_id, choice_id) values (x.id, r.id, me.id, v_id) on conflict do nothing;
    if not found then raise exception 'You already voted'; end if;

  when 'close_vote' then
    select * into x from votes where id = (a ->> 'vote_id')::uuid and room_id = r.id and status = 'open';
    if not found then return '{"ok":true,"no_touch":true}'::jsonb; end if;   -- already closed (TV/phones race)
    if not v_host and now() < x.ends_at then raise exception 'The vote is still running'; end if;
    select q.choice_id, q.c into v_id, v_c1 from (select choice_id, count(*)::int c from ballots where vote_id = x.id group by 1) q order by q.c desc limit 1;
    select q.c into v_c2 from (select choice_id, count(*)::int c from ballots where vote_id = x.id group by 1) q order by q.c desc offset 1 limit 1;
    v_total := (select count(*) from ballots where vote_id = x.id);
    -- The Trial needs a clear majority of the votes cast
    if v_id is null or v_id = _no_trial() or v_c1 = coalesce(v_c2, -1) or v_c1 * 2 <= v_total then
      v_out := jsonb_build_object('result', 'none', 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = '{}', outcome = v_out where id = x.id;
    elsif _is_guilty(v_id) then
      perform _catch(r.id, v_id);
      insert into queue (room_id, player_id, reason) values (r.id, v_id, 'Convicted at the Trial');
      v_out := jsonb_build_object('result', 'guilty', 'accused', v_id, 'role', (select public_role from players where id = v_id),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    elsif exists (select 1 from player_secrets ps join players p on p.id = ps.player_id
                   where ps.player_id = v_id and ps.role = 'jester' and not ps.burned and not ps.revenge_used and p.public_role is null) then
      -- JESTER convicted: that's what they wanted. Revealed, and they pick one accuser for a ×3 punishment.
      v_ids := array(select b.voter_id from ballots b where b.vote_id = x.id and b.choice_id = v_id
                       and not exists (select 1 from players where id = b.voter_id and public_role = 'angel'));   -- the Angel is never punished
      update players set public_role = 'jester' where id = v_id;
      update player_secrets set revenge_used = true where player_id = v_id;
      v_out := jsonb_build_object('result', 'jester', 'accused', v_id, 'role', 'jester', 'accusers', to_jsonb(v_ids),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    else
      v_ids := array(select voter_id from ballots where vote_id = x.id and choice_id = v_id);
      insert into punishments (room_id, player_id, text, kind)
      select r.id, w.v, 'Wrong accusation', 'penalty' from unnest(v_ids) as w(v)
       where not exists (select 1 from players where id = w.v and public_role = 'angel');   -- the Angel is never punished
      v_out := jsonb_build_object('result', 'innocent', 'accused', v_id, 'accusers', to_jsonb(v_ids), 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    end if;
    perform _event(r.id, 'vote_result', jsonb_build_object('vote', x.id) || v_out);
    res := v_out;
  end case;
  return res;
end $$;

-- ---------- punishment queue & wheel ----------
create or replace function public._a_wheel(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_found boolean; v_cursed boolean; v_id uuid; v_id2 uuid; v_text text;
  v_int int; v_json jsonb; v_land jsonb; v_force boolean := coalesce((a ->> 'force')::boolean, false);
begin
  case p_action
  when 'queue_add' then
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'The Angel is never punished'; end if;
    insert into queue (room_id, player_id, reason) values (r.id, v_id, coalesce(a ->> 'reason', 'Host''s choice'));

  when 'queue_remove' then
    update queue set status = 'cancelled' where id = (a ->> 'queue_id')::uuid and room_id = r.id and status = 'queued';

  when 'call_next' then
    if rd.id is not null then raise exception 'Finish the current punishment first'; end if;
    if exists (select 1 from minigames where room_id = r.id and status in ('muster','live')) then
      raise exception 'A mini-game is on. Wait for it to finish';
    end if;
    -- out of Davy Jones' Locker: their waiting punishment rejoins the queue (in its old place)
    update queue q set status = 'queued' from players p
     where q.room_id = r.id and q.status = 'held' and p.id = q.player_id and coalesce(p.locked_until <= now(), true);
    if a ? 'player_id' then                                         -- the host's PUNISH NOW
      v_id := (a ->> 'player_id')::uuid;
      if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
      if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'The Angel is never punished'; end if;
      if exists (select 1 from players where id = v_id and locked_until > now()) then raise exception 'They''re in Davy Jones'' Locker'; end if;
      v_text := coalesce(a ->> 'reason', 'Host''s choice');
      insert into queue (room_id, player_id, reason, status) values (r.id, v_id, v_text, 'active') returning id into v_id2;
    else
      -- the next in line who isn't in Davy Jones' Locker
      select q.id, q.player_id, q.reason, q.times into v_id2, v_id, v_text, v_int from queue q join players p on p.id = q.player_id
       where q.room_id = r.id and q.status = 'queued' and coalesce(p.locked_until <= now(), true) order by q.pos limit 1;
      if v_id2 is null then raise exception 'Nobody is in the punishment queue'; end if;
      update queue set status = 'active' where id = v_id2;
    end if;
    if exists (select 1 from players where id = v_id and shivved_by is not null) then   -- shivved: this one counts ×2
      v_int := coalesce(v_int, 1) * 2;
      update players set shivved_by = null where id = v_id;
    end if;
    insert into rounds (room_id, queue_id, victim_id, original_victim_id, reason, times)
    values (r.id, v_id2, v_id, v_id, v_text, greatest(1, coalesce(v_int, 1))) returning id into v_id2;
    perform _event(r.id, 'round_start', jsonb_build_object('round', v_id2, 'player', v_id));
    res := jsonb_build_object('round_id', v_id2);

  -- HOST: spin the wheel right now (special cases) on a player, or on the whole room (no victim).
  -- It skips the queue and ignores heals.
  when 'free_spin' then
    if rd.id is not null then raise exception 'Finish the current punishment first'; end if;
    v_id := nullif(a ->> 'player_id', '')::uuid;
    if v_id is not null and not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'The Angel is never punished'; end if;
    if exists (select 1 from minigames where room_id = r.id and status in ('muster','live')) then
      raise exception 'A mini-game is on. Wait for it to finish';
    end if;
    v_cursed :=coalesce((select cursed from players where id = v_id), false);
    v_json := _wheel(r.id);
    insert into rounds (room_id, victim_id, original_victim_id, reason, phase, wheel, cursed, landings, spin_seq)
    values (r.id, v_id, v_id, coalesce(nullif(left(trim(a ->> 'reason'), 60), ''), 'Host''s spin'), 'spinning', v_json, v_cursed,
            _landings(v_json, v_cursed), 1)
    returning id into v_id2;
    perform _event(r.id, 'round_start', jsonb_build_object('round', v_id2, 'player', v_id, 'free', true));
    res := jsonb_build_object('round_id', v_id2);

  -- TAKE IT FOR THEM: while the round waits, any other player steps in and becomes the victim (the Scrooge swap's
  -- victim change: original_victim_id stays). First tap wins (the room row is locked), once per round, once a night
  -- per player. Never the Angel, never from the Locker; rehab is fine (it's not a power, just a brave drink).
  -- Everything else follows the round: the curse and the Lovebird are read off the NEW victim at spin/accept,
  -- the original victim's heal stays with them for later, and the round's ×times stays as it is.
  when 'take_it' then
    if rd.id is null or rd.phase <> 'waiting' or rd.victim_id is null then raise exception 'Too late — the wheel is already spinning'; end if;
    if r.ended then raise exception 'The night is over'; end if;
    if rd.stand_in_id is not null then raise exception 'Someone already stepped in'; end if;
    -- the phone names who it's stepping in for: a Scrooge swap during the check must not hand over someone else's punishment
    if (a ->> 'for') is distinct from rd.victim_id::text then raise exception 'The punishment moved. Look again'; end if;
    if rd.victim_id = me.id then raise exception 'You''re already facing the wheel'; end if;
    if rd.original_victim_id = me.id then raise exception 'It''s your own punishment'; end if;
    if me.public_role = 'angel' then raise exception 'The Angel is never punished'; end if;
    if me.locked_until > now() then raise exception 'You''re in Davy Jones'' Locker'; end if;
    if not me.has_role then raise exception 'Open your card first: no card, no stepping in'; end if;   -- no sock puppets
    if me.stood_in_at is not null then raise exception 'You already took one for someone tonight'; end if;
    update rounds set victim_id = me.id, stand_in_id = me.id, stand_in_for = rd.victim_id where id = rd.id;
    update players set stood_in_at = now() where id = me.id;
    perform _event(r.id, 'stand_in', jsonb_build_object('round', rd.id, 'from', rd.victim_id, 'to', me.id));

  when 'spin' then
    if rd.id is null or rd.phase <> 'waiting' then raise exception 'Not ready to spin'; end if;
    if not v_host and rd.victim_id is distinct from me.id then raise exception 'It''s not your turn'; end if;
    -- the stand-in window: nobody spins (not even the host) for the first 4 seconds, so anyone can step in
    if now() < rd.created_at + interval '4 seconds' then raise exception 'Anyone stepping in? Spin in a moment'; end if;
    select cursed into v_cursed from players where id = rd.victim_id;
    -- an intact heal beats a forged one
    select * into x from shields where player_id = rd.victim_id and used_at is null and not fake
     order by forged asc, created_at limit 1 for update;
    v_found := found;
    v_json := _wheel(r.id);
    if v_found and not x.forged then
      update shields set used_at = now(), used_round = rd.id where id = x.id;
      update rounds set phase = 'saved', wheel = v_json, cursed = v_cursed, revealed_at = now() where id = rd.id;
      perform _event(r.id, 'saved', jsonb_build_object('player', rd.victim_id, 'golden', x.golden));
    else
      if v_found then update shields set used_at = now(), used_round = rd.id where id = x.id; end if;
      update rounds set phase = 'spinning', wheel = v_json, cursed = v_cursed, forged = v_found,
                        landings = _landings(v_json, v_cursed, rd.times), spin_seq = spin_seq + 1
       where id = rd.id;
      if v_found then perform _event(r.id, 'forged', jsonb_build_object('player', rd.victim_id)); end if;
    end if;

  when 'round_revealed' then
    if rd.phase = 'spinning' and coalesce((a ->> 'spin_seq')::int, rd.spin_seq) = rd.spin_seq then
      update rounds set phase = 'revealed', revealed_at = now() where id = rd.id;
    else
      res := '{"ok":true,"no_touch":true}'::jsonb;
    end if;

  when 'accept' then
    if rd.id is null then raise exception 'Nothing to accept'; end if;
    if rd.phase = 'spinning' and not v_force then raise exception 'Still spinning'; end if;
    if rd.phase not in ('revealed', 'spinning') then raise exception 'Nothing to accept'; end if;
    if rd.phase = 'revealed' and now() < rd.revealed_at + interval '9 seconds' and not v_force then
      raise exception 'Hold on — a few more seconds';
    end if;
    select ps.partner_id into v_id2 from player_secrets ps join players p on p.id = ps.partner_id where ps.player_id = rd.victim_id;   -- null if the partner was kicked
    v_int := 0;
    for v_land in select value from jsonb_array_elements(rd.landings) loop
      continue when v_land ->> 'kind' <> 'normal' or rd.victim_id is null;     -- whole-room spin: nothing to log
      v_text := _landing_text(v_land);
      insert into punishments (room_id, player_id, text) values (r.id, rd.victim_id, v_text);
      if v_id2 is not null then insert into punishments (room_id, player_id, text, via_love) values (r.id, v_id2, v_text, true); end if;
      v_int := v_int + 1;
    end loop;
    if v_int > 0 and v_id2 is not null
       and not exists (select 1 from players where id = rd.victim_id and love_partner_id = v_id2) then
      perform _reveal_love(rd.victim_id);
      perform _event(r.id, 'lovebirds', jsonb_build_object('a', rd.victim_id, 'b', v_id2));
    end if;
    update rounds set phase = 'done', ended_at = now() where id = rd.id;
    update queue set status = 'done' where id = rd.queue_id;
    perform _event(r.id, 'accepted', jsonb_build_object('player', rd.victim_id, 'count', v_int, 'partner', case when v_int > 0 then v_id2 end));

  when 'finish_saved' then
    if rd.phase <> 'saved' then raise exception 'Nothing to finish'; end if;
    update rounds set phase = 'done', ended_at = now() where id = rd.id;
    update queue set status = 'done' where id = rd.queue_id;

  when 'cancel_round' then
    if rd.id is null then raise exception 'No punishment running'; end if;
    update rounds set phase = 'cancelled', ended_at = now() where id = rd.id;
    update queue set status = case when coalesce((a ->> 'requeue')::boolean, false) then 'queued' else 'cancelled' end where id = rd.queue_id;
  end case;
  return res;
end $$;

-- ---------- secret powers ----------
create or replace function public._a_powers(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_id2 uuid; v_text text; v_int int; v_guilty boolean; v_framed boolean;
  v_ids uuid[]; v_out jsonb;
  lvl constant int := _plevel(me.beers, r.id) - 1;        -- 0 = level 1 (pacified), 1 basic, 2 stronger, 3 evolved
  quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
  powerless boolean := coalesce(s.burned, false) or coalesce(me.rehab, false) or coalesce(me.locked_until > now(), false)   -- Locker: no powers
                        or lvl < 1;                                                                                   -- level 1: no powers yet
begin
  case p_action
  -- MEDIC: heal anyone (not yourself) ahead of time. Secret: no ping.
  when 'heal' then
    if s.role is distinct from 'medic' or powerless then raise exception 'You can''t do that'; end if;
    v_id := coalesce((a ->> 'player_id')::uuid, rd.victim_id);
    if v_id is null or not _in_room(r.id, v_id) then raise exception 'Pick someone to heal'; end if;
    if v_id = me.id then
      -- SURGEON (Medic at level 3): one self-heal a night
      if lvl < 3 then raise exception 'You can''t heal yourself (the Surgeon can, at level 4)'; end if;
      if s.self_heal_used then raise exception 'You''ve already healed yourself tonight'; end if;
    elsif s.heals_used >= least(lvl, 2) then                  -- heals: 1, then 2 from level 2 (the Surgeon keeps 2)
      if lvl < 2 then raise exception 'No heals left. Your next heal unlocks at level 3'; end if;
      raise exception 'No heals left tonight';
    end if;
    if rd.id is not null and rd.victim_id = v_id and rd.phase <> 'waiting' then raise exception 'Too late — the wheel is already spinning'; end if;
    if exists (select 1 from shields where by_player = me.id and player_id = v_id and used_at is null and not golden) then raise exception 'They already have your heal'; end if;
    if v_id = me.id then update player_secrets set self_heal_used = true where player_id = me.id;
    else update player_secrets set heals_used = heals_used + 1 where player_id = me.id; end if;
    -- the Surgeon's heals are sealed: the Forger can't touch them
    insert into shields (room_id, player_id, by_player, fake, round_id, sealed) values (r.id, v_id, me.id, false, rd.id, lvl >= 3);
    res := quiet;

  -- FORGER: once a night, secretly cancel the oldest intact heal. Never learns whose.
  when 'forge' then
    if s.role is distinct from 'forger' or powerless then raise exception 'You can''t do that'; end if;
    if lvl < 2 then raise exception 'Forging a heal unlocks at level 3'; end if;
    if s.forge_used then raise exception 'You already forged tonight'; end if;
    select id into v_id from shields where room_id = r.id and used_at is null and not fake and not forged and not sealed order by created_at limit 1 for update;
    if v_id is null then raise exception 'There''s no heal to forge right now'; end if;
    update shields set forged = true where id = v_id;
    update player_secrets set forge_used = true where player_id = me.id;
    res := quiet;

  -- FORGER: once a night, plant evidence on a player. The next Detective check on them reads GUILTY.
  when 'frame' then
    if s.role is distinct from 'forger' or powerless then raise exception 'You can''t do that'; end if;
    if s.frame_used then raise exception 'You already framed someone tonight'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    update player_secrets set frame_used = true, frame_target = v_id where player_id = me.id;
    res := quiet;

  -- OATHBREAKER (the Forger at level 3): once per game, rewrite the name on a punishment waiting in
  -- the queue. The TV shows the ink changing, never who did it.
  when 'forged_orders' then
    if s.role is distinct from 'forger' or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_orders_game is not null and s.last_orders_game >= _games_done(r.id) then raise exception 'One set of forged orders per game'; end if;
    select * into x from queue where id = (a ->> 'queue_id')::uuid and room_id = r.id and status = 'queued';
    if not found then raise exception 'That punishment isn''t waiting any more'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = x.player_id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'The Angel is never punished'; end if;
    if exists (select 1 from players where id = v_id and locked_until > now()) then raise exception 'They''re in Davy Jones'' Locker'; end if;
    update queue set player_id = v_id where id = x.id;
    update player_secrets set last_orders_game = _games_done(r.id) where player_id = me.id;
    perform _event(r.id, 'orders_forged', jsonb_build_object('from', x.player_id, 'to', v_id, 'reason', x.reason));

  -- DETECTIVE: one check per game (1 at the start, +1 per finished game, max 3).
  -- Accuracy follows the drink level: level 1 reads the target plus 2 random others ("one of these 3
  -- is Guilty" / "none of them"), level 2+ the target plus 1 other. (Level 3 evolves into Judge Dredd.)
  when 'investigate' then
    if s.role is distinct from 'detective' or powerless then raise exception 'You can''t do that'; end if;
    if least(3, 1 + _games_done(r.id)) - s.checks_used <= 0 then raise exception 'No investigations left until the next game ends'; end if;
    if exists (select 1 from detective_checks where detective_id = me.id and not viewed) then raise exception 'Read your last file first'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    -- the others are never anyone already exposed (in rehab) or the Angel: they'd give the game away
    v_ids := array[v_id] || array(select id from players where room_id = r.id and id <> v_id and id <> me.id
                                   and not rehab and public_role is distinct from 'angel'
                                   order by random() limit (3 - least(lvl, 2)));   -- Judge Dredd (level 3) reads like level 2
    v_guilty := exists (select 1 from unnest(v_ids) as g(v) where _is_guilty(g.v));
    update player_secrets set frame_spent = true where room_id = r.id and frame_target = v_id and not frame_spent;   -- a frame is read once
    v_framed := found and not v_guilty;
    insert into detective_checks (room_id, detective_id, target_id, guilty, framed, group_ids, level)
    values (r.id, me.id, v_id, v_guilty or v_framed, v_framed, v_ids, lvl) returning id into v_id2;
    update player_secrets set checks_used = checks_used + 1 where player_id = me.id;
    res := quiet || jsonb_build_object('check_id', v_id2);

  -- DETECTIVE: the result is read once (press and hold on the phone). The same Detective can fetch the same
  -- reading again for 15 seconds after the first view (a reply lost on party wifi); after that it's burned.
  when 'view_check' then
    select c.*, p.name into x from detective_checks c join players p on p.id = c.target_id
     where c.id = (a ->> 'check_id')::uuid and c.detective_id = me.id;
    if not found or (x.viewed and (x.viewed_at is null or now() > x.viewed_at + interval '15 seconds')) then
      raise exception 'That file has already been burned';
    end if;
    if not x.viewed then update detective_checks set viewed = true, viewed_at = now() where id = x.id; end if;
    res := quiet || jsonb_build_object('guilty', x.guilty, 'name', x.name, 'level', x.level,
             'group', (select jsonb_agg(p.name order by array_position(x.group_ids, p.id)) from players p where p.id = any (x.group_ids)));

  -- INTRUDER / knife holder: name a player's secret role. Right = their cover is blown
  -- and you keep your streak (max one Hit per game). Wrong = no more Hits tonight.
  when 'hit' then
    if not ((s.role = 'intruder' or s.has_knife) and not powerless) then raise exception 'You can''t do that'; end if;
    if not s.hit_alive then raise exception 'Your knife is blunt — no more hits tonight'; end if;
    v_int := _games_done(r.id);
    if s.last_hit_game is not null and s.last_hit_game >= v_int then raise exception 'One hit per game — wait for the next game to finish'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from players where id = v_id and (public_role is not null or rehab)) then   -- the Cursed can be hit too
      raise exception 'Their cover is already blown';
    end if;
    v_text := lower(coalesce(a ->> 'role', ''));
    -- only real roles can be named: never Drinker, and never a modifier (Lovebird, Cursed)
    if v_text not in ('betrayer','medic','detective','forger','skank','davyjones','scrooge','jester','assassin') then raise exception 'You can''t name that role'; end if;
    if exists (select 1 from player_secrets where player_id = v_id and role = v_text) then
      v_guilty := _is_guilty(v_id);
      update players set public_role = v_text, rehab = v_guilty where id = v_id;
      update player_secrets set burned = true, heals_left = 0, guesses_left = 0, respins_left = 0, swap_used = true,
             graffiti_used = true, forge_used = true, frame_used = true, revenge_used = true, has_knife = false, hit_alive = false where player_id = v_id;
      insert into queue (room_id, player_id, reason) values (r.id, v_id, 'Cover blown by the Intruder');
      update player_secrets set last_hit_game = v_int where player_id = me.id;
      perform _event(r.id, 'hit', jsonb_build_object('player', v_id, 'role', v_text));
      res := jsonb_build_object('correct', true);
    else
      -- level 2+: you learn whether they're on the Drinkers team
      v_out := jsonb_build_object('correct', false);
      if lvl >= 2 then
        v_out := v_out || jsonb_build_object('drinkers',
                   coalesce((select _team(role, team_with, has_knife) = 'drinkers' from player_secrets where player_id = v_id), true));
      end if;
      update player_secrets set hit_alive = false where player_id = me.id;
      res := quiet || v_out;
    end if;

  when 'betrayer_guess' then
    if s.role is distinct from 'betrayer' or powerless then raise exception 'You can''t do that'; end if;
    if s.has_knife then raise exception 'You hold the knife now'; end if;
    if cardinality(s.team_with) > 0 then raise exception 'You already found your partner in crime'; end if;
    if cardinality(s.guessed) >= (case when lvl >= 2 then 3 else 2 end) then raise exception 'No guesses left'; end if;   -- 2, or 3 from level 2
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if v_id = any (s.guessed) then raise exception 'You already accused them'; end if;
    if exists (select 1 from player_secrets ps join players p on p.id = ps.player_id
                where ps.player_id = v_id and ps.role = 'intruder' and not p.rehab) then
      update player_secrets set team_with = array_append(team_with, v_id), guessed = array_append(guessed, v_id),
                                guesses_left = guesses_left - 1 where player_id = me.id;
      update player_secrets set team_with = array_append(team_with, me.id) where player_id = v_id;
      res := jsonb_build_object('correct', true, 'name', (select name from players where id = v_id)) || '{"no_touch":true}'::jsonb;
    else
      update player_secrets set guessed = array_append(guessed, v_id), guesses_left = guesses_left - 1 where player_id = me.id;
      -- the penalty drink is told to their phone ONLY: a public punishment or a TV toast would name the Betrayer
      res := jsonb_build_object('correct', false) || '{"no_touch":true}'::jsonb;
    end if;

  -- BETRAYER at level 3: a hint — the Intruder is one of these 3 (fixed once asked for).
  when 'betrayer_hint' then
    if s.role is distinct from 'betrayer' or powerless or s.has_knife or cardinality(s.team_with) > 0 then raise exception 'You can''t do that'; end if;
    if lvl < 3 then raise exception 'Hints unlock at level 4'; end if;
    if s.hint_ids is null then
      select ps.player_id into v_id from player_secrets ps join players p on p.id = ps.player_id
       where ps.room_id = r.id and ps.role = 'intruder' and not p.rehab limit 1;
      if v_id is null then raise exception 'There''s no Intruder left to find'; end if;
      -- the decoys follow the Detective's rule: never anyone already exposed (in rehab) or the Angel, who are
      -- publicly cleared and would point straight at the Intruder
      v_ids := array(select g.v from unnest(array[v_id] || array(select id from players where room_id = r.id and id <> v_id and id <> me.id
                                                                  and not rehab and public_role is distinct from 'angel'
                                                                  order by random() limit 2)) as g(v) order by random());
      update player_secrets set hint_ids = v_ids where player_id = me.id;
    end if;
    res := quiet;

  when 'scrooge_swap' then
    if s.role is distinct from 'scrooge' or powerless or not _setting(r, 'scrooge_swap') then raise exception 'You can''t do that'; end if;
    if s.swaps_used >= (case when lvl >= 3 then 2 else 1 end) then raise exception 'You already used your swap tonight'; end if;   -- 2nd swap at level 3
    if rd.id is null or rd.phase <> 'waiting' then raise exception 'Too late — the wheel is already spinning'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    if v_id = rd.victim_id then raise exception 'They''re already facing the wheel'; end if;
    if exists (select 1 from players where id = v_id and locked_until > now()) then raise exception 'They''re in Davy Jones'' Locker'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'The Angel is never punished'; end if;
    update rounds set victim_id = v_id where id = rd.id;
    update player_secrets set swap_used = true, swaps_used = swaps_used + 1 where player_id = me.id;
    perform _event(r.id, 'scrooge', jsonb_build_object('kind', 'swap', 'from', rd.victim_id, 'to', v_id));

  when 'scrooge_respin' then
    if s.role is distinct from 'scrooge' or powerless or not _setting(r, 'scrooge_respin') then raise exception 'You can''t do that'; end if;
    if s.respins_used >= lvl then raise exception 'No re-spins left'; end if;             -- re-spins = drink level
    if rd.id is null or rd.phase <> 'revealed' or now() > rd.revealed_at + interval '13 seconds' then raise exception 'Too late to re-spin'; end if;
    update rounds set landings = _landings(rd.wheel, rd.cursed, rd.times), spin_seq = spin_seq + 1, phase = 'spinning',
                      revealed_at = null, forged = false where id = rd.id;
    update player_secrets set respins_used = respins_used + 1 where player_id = me.id;
    perform _event(r.id, 'scrooge', jsonb_build_object('kind', 'respin'));

  when 'scrooge_graffiti' then
    if s.role is distinct from 'scrooge' or powerless or not _setting(r, 'scrooge_graffiti') then raise exception 'You can''t do that'; end if;
    if lvl < 2 then raise exception 'Graffiti unlocks at level 3'; end if;
    if s.graffiti_used then raise exception 'You already used your graffiti tonight'; end if;
    v_text := left(regexp_replace(trim(coalesce(a ->> 'text', '')), '\s+', ' ', 'g'), 60);
    if length(v_text) < 3 then raise exception 'Write a proper punishment'; end if;
    insert into graffiti (room_id, text) values (r.id, v_text);
    update player_secrets set graffiti_used = true where player_id = me.id;
    perform _event(r.id, 'scrooge', jsonb_build_object('kind', 'graffiti', 'text', v_text));

  -- JESTER, after being convicted at a Trial: pick one accuser for a ×3 punishment.
  -- The host can pick at random for them (no player_id) if they dither.
  when 'jester_revenge' then
    select * into x from votes where id = (a ->> 'vote_id')::uuid and room_id = r.id and status = 'closed' and outcome ->> 'result' = 'jester';
    if not found then raise exception 'There''s no revenge to take'; end if;
    if x.outcome ? 'revenge' then raise exception 'The Jester already picked'; end if;
    if not v_host and me.id is distinct from (x.outcome ->> 'accused')::uuid then raise exception 'You can''t do that'; end if;
    v_ids := array(select t.e::uuid from jsonb_array_elements_text(x.outcome -> 'accusers') as t(e));
    if cardinality(v_ids) = 0 then raise exception 'There''s no revenge to take'; end if;
    v_id := nullif(a ->> 'player_id', '')::uuid;
    if v_id is null then
      if not v_host then raise exception 'Pick one of your accusers'; end if;
      -- anyone in Davy Jones' Locker is off limits (unless every accuser is)
      v_ids := coalesce(nullif(array(select u from unnest(v_ids) u where not exists (select 1 from players where id = u and locked_until > now())), '{}'), v_ids);
      v_id := v_ids[1 + floor(random() * cardinality(v_ids))::int];
    elsif not (v_id = any (v_ids)) then
      raise exception 'Pick someone who voted for you';
    elsif exists (select 1 from players where id = v_id and locked_until > now()) then
      raise exception 'They''re in Davy Jones'' Locker — pick someone else';
    end if;
    update votes set outcome = outcome || jsonb_build_object('revenge', v_id) where id = x.id;
    insert into queue (room_id, player_id, reason, times) values (r.id, v_id, 'Jester''s revenge', 3);
    perform _event(r.id, 'jester_revenge', jsonb_build_object('jester', (x.outcome ->> 'accused')::uuid, 'player', v_id));
    res := jsonb_build_object('player', v_id);

  when 'remove_graffiti' then
    update graffiti set active = false where id = (a ->> 'graffiti_id')::uuid and room_id = r.id;

  -- CURSED: beat someone in a game to pass the curse on. No host step: the server checks it. The target must
  -- have lost the most recent game while the cursed player played it and didn't lose (one pass per game).
  when 'request_curse_pass' then
    if not me.cursed then raise exception 'You don''t hold the curse'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if not (v_id = any (_curse_targets(r.id, me.id))) then raise exception 'You can only pass it to someone you beat in the last game'; end if;
    insert into curse_passes (room_id, from_id, to_id, status, decided_at, game_id)
    values (r.id, me.id, v_id, 'approved', now(),
            (select id from games where room_id = r.id and status = 'ended' order by ended_at desc limit 1));
    update players set cursed = false where id = me.id;
    update players set cursed = true  where id = v_id;
    perform _event(r.id, 'curse_passed', jsonb_build_object('from', me.id, 'to', v_id));
  end case;
  return res;
end $$;

-- ---------- v5: Davy Jones' Locker, Sheriff, Angel, Judge Dredd, Aaron's Plate ----------
create or replace function public._a_v5(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_text text; v_int int; v_ids uuid[]; v_json jsonb;
  lvl constant int := _plevel(me.beers, r.id) - 1;        -- 0 = level 1 (pacified), 1 basic, 2 stronger, 3 evolved
  quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
  locked constant boolean := coalesce(me.locked_until > now(), false);
  powerless constant boolean := coalesce(s.burned, false) or coalesce(me.rehab, false) or coalesce(me.locked_until > now(), false)
                                 or lvl < 1;                                                                          -- level 1: no powers yet
  v_games constant int := _games_done(r.id);
begin
  case p_action
  -- DAVY JONES' LOCKER: anyone can ask the host to lock them up for a rest
  when 'request_lock' then
    if locked then raise exception 'You''re already in Davy Jones'' Locker'; end if;
    if me.lock_requested_at is not null then raise exception 'Waiting for the host to decide'; end if;
    update players set lock_requested_at = now() where id = me.id;
    perform _event(r.id, 'lock_request', jsonb_build_object('player', me.id));

  when 'decide_lock' then                                           -- host
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    if coalesce((a ->> 'approve')::boolean, false) then perform _lock(r.id, v_id, coalesce((a ->> 'minutes')::int, 15));
    else update players set lock_requested_at = null where id = v_id; end if;

  -- host: always 15 minutes, the same as the Davy Jones role, so the length never tells who locked them
  -- (any 'minutes' argument is ignored)
  when 'lock' then
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    perform _lock(r.id, v_id, 15);

  when 'unlock' then                                                -- host
    v_id := (a ->> 'player_id')::uuid;
    update players set locked_until = null, lock_requested_at = null where id = v_id and room_id = r.id;
    perform _event(r.id, 'unlocked', jsonb_build_object('player', v_id));

  -- DAVY JONES (role): once per game, lock someone else up for 15 minutes. One prisoner at a time:
  -- not while the last one is still down there (the host can let them out early).
  when 'davy_lock' then
    if s.role is distinct from 'davyjones' or powerless then raise exception 'You can''t do that'; end if;
    if s.last_lock_game is not null and s.last_lock_game >= v_games then raise exception 'One lock per game — wait for the next game to finish'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from players where id = v_id and locked_until > now()) then raise exception 'They''re already in the Locker'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'The Angel doesn''t need saving'; end if;
    if exists (select 1 from players where id = s.lock_target and locked_until > now()) then
      raise exception '% is still in your Locker. One prisoner at a time', (select name from players where id = s.lock_target);
    end if;
    update player_secrets set last_lock_game = v_games, lock_target = v_id where player_id = me.id;
    perform _lock(r.id, v_id, 15);

  -- NINJA (the Assassin at level 3): once per game, a silent strike sends
  -- anyone to the wheel. The TV shows a shuriken, never who threw it. No Trial, so no Jester revenge.
  when 'ninja_strike' then
    if s.role is distinct from 'assassin' or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_strike_game is not null and s.last_strike_game >= v_games then raise exception 'One strike per game — wait for the next game to finish'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'Not the Angel'; end if;
    update player_secrets set last_strike_game = v_games where player_id = me.id;
    insert into queue (room_id, player_id, reason) values (r.id, v_id, 'A shuriken from the shadows');
    perform _event(r.id, 'shuriken', jsonb_build_object('player', v_id));

  -- ANGEL: assigned by the host (a non-drinker), public, can't be hit or tried
  when 'make_angel' then                                            -- host
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    if exists (select 1 from player_secrets where player_id = v_id) then raise exception 'They already have a role card'; end if;
    insert into player_secrets (player_id, room_id, role) values (v_id, r.id, 'angel');
    update players set public_role = 'angel', has_role = true where id = v_id;
    update queue set status = 'cancelled' where player_id = v_id and status in ('queued','held');   -- the Angel is never punished
    perform _event(r.id, 'angel', jsonb_build_object('player', v_id));

  -- ANGEL: Holy Nova adds 10% of the target to the tally, once a night. It can never finish the job.
  when 'holy_nova' then
    if s.role is distinct from 'angel' or locked then raise exception 'You can''t do that'; end if;
    if s.nova_used then raise exception 'Holy Nova is spent for tonight'; end if;
    if r.ended or now() >= r.deadline_at then raise exception 'Time''s up'; end if;
    v_int := greatest(1, round(r.target * 0.10))::int;
    if r.tally + v_int >= r.target then raise exception 'Holy Nova can''t finish the job. The group has to get there themselves'; end if;
    update rooms set tally = tally + v_int where id = r.id returning * into r;
    update player_secrets set nova_used = true where player_id = me.id;
    perform _event(r.id, 'holy_nova', jsonb_build_object('player', me.id, 'n', v_int, 'tally', r.tally));
    res := jsonb_build_object('n', v_int, 'tally', r.tally);

  -- ANGEL: bless one of the host's wheel punishments — it becomes SAFE for good (never the Scrooge's graffiti)
  when 'angel_bless' then
    if s.role is distinct from 'angel' or locked then raise exception 'You can''t do that'; end if;
    if s.bless_used then raise exception 'You''ve already blessed the wheel tonight'; end if;
    v_int := (a ->> 'index')::int;
    if v_int is null or v_int < 0 or v_int >= jsonb_array_length(r.segments) then raise exception 'Pick a punishment on the wheel'; end if;
    v_text := r.segments ->> v_int;
    if v_text ~* '^\s*safe\y' then raise exception 'That one is already safe'; end if;
    update rooms set segments = jsonb_set(segments, array[v_int::text], to_jsonb('Safe (blessed by the Angel)'::text)) where id = r.id;
    update player_secrets set bless_used = true where player_id = me.id;
    perform _event(r.id, 'blessed', jsonb_build_object('player', me.id, 'from', v_text));

  -- JUDGE DREDD (the Detective at level 3): Walk of Shame and the Mark, once per game each
  when 'dredd_shame' then
    if s.role is distinct from 'detective' or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_shame_game is not null and s.last_shame_game >= v_games then raise exception 'One Walk of Shame per game'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from players where id = v_id and locked_until > now()) then raise exception 'They''re in Davy Jones'' Locker'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'Not the Angel'; end if;
    v_text := left(regexp_replace(trim(coalesce(a ->> 'caption', '')), '\s+', ' ', 'g'), 60);
    if length(v_text) < 3 then raise exception 'Write a caption'; end if;
    update player_secrets set last_shame_game = v_games where player_id = me.id;
    insert into punishments (room_id, player_id, text, kind) values (r.id, v_id, 'Walk of Shame: ' || v_text, 'penalty');
    perform _event(r.id, 'shame', jsonb_build_object('player', v_id, 'caption', v_text));

  -- THE SHIV: parole for a caught Saboteur. Every 3 beers logged in rehab earns one, max one per game.
  -- Public: the victim's card shows who shivved them, and their next punishment counts ×2.
  when 'shiv' then
    if not coalesce(me.rehab, false) then raise exception 'Only players in rehab carry a shiv'; end if;
    if locked then raise exception 'Not from Davy Jones'' Locker'; end if;
    if me.last_shiv_game is not null and me.last_shiv_game >= v_games then raise exception 'One shiv per game'; end if;
    if me.rehab_beers < 3 * (me.shivs_used + 1) then
      raise exception '% more beers in rehab for your next shiv', 3 * (me.shivs_used + 1) - me.rehab_beers;
    end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from players where id = v_id and public_role = 'angel') then raise exception 'Not the Angel'; end if;
    if exists (select 1 from players where id = v_id and shivved_by is not null) then raise exception 'They''ve already been shivved'; end if;
    update players set shivs_used = shivs_used + 1, last_shiv_game = v_games where id = me.id;
    update players set shivved_by = me.id where id = v_id;
    perform _event(r.id, 'shiv', jsonb_build_object('player', v_id, 'by', me.id));

  -- THE CAPS SHOP: open to everyone (so buying never hints at a role). Each item is checked here.
  --   sound    5  play a sting on the TV (anonymous; one per room every 45 seconds)
  --   bribe    15 once a night: your own wheel landed, spin it again (the second result stands)
  --   graffiti 20 once a night: write a punishment on the wheel; announced like the Scrooge's, so nobody knows who
  --   ticket   30 once a night: a golden ticket, sealed, that skips your next punishment (like the Biggest Champ's)
  when 'shop' then
    v_text := coalesce(a ->> 'item', '');
    if v_text not in ('sound','bribe','graffiti','ticket') then raise exception 'Not for sale'; end if;
    if not me.has_role then raise exception 'Open your card first: type your code in YOUR FILE'; end if;
    if r.ended then raise exception 'The shop is shut: time''s up'; end if;
    if coalesce(me.locked_until > now(), false) then raise exception 'Not from Davy Jones'' Locker'; end if;
    -- the first hour is quiet: only the soundboard is open until the first game has finished
    if v_text <> 'sound' and _games_done(r.id) = 0 then raise exception 'Opens after the first game'; end if;
    if v_text = 'graffiti' and not _setting(r, 'scrooge_graffiti') then raise exception 'Graffiti is off tonight'; end if;
    v_int := case v_text when 'sound' then 5 when 'bribe' then 15 when 'graffiti' then 20 else 30 end;
    if v_text <> 'sound' and exists (select 1 from shop_buys where player_id = me.id and item = v_text) then
      raise exception 'Once a night: you already bought that';
    end if;
    if v_text = 'bribe' and (rd.id is null or rd.victim_id is distinct from me.id or rd.phase <> 'revealed'
                             or now() > rd.revealed_at + interval '13 seconds') then
      raise exception 'Only straight after your own wheel lands';
    end if;
    if _caps(me.id) < v_int then raise exception 'You need % caps', v_int; end if;
    if v_text = 'sound' then
      if coalesce(a ->> 'sound', '') not in ('pulease','relax','one_maybe_two','airhorn','trombone','drumroll') then raise exception 'Pick a sound'; end if;
      if exists (select 1 from events where room_id = r.id and kind = 'soundboard' and created_at > now() - interval '45 seconds') then
        raise exception 'The soundboard is cooling down. Try again in a moment';
      end if;
      perform _event(r.id, 'soundboard', jsonb_build_object('sound', a ->> 'sound'));
    elsif v_text = 'bribe' then
      update rounds set landings = _landings(rd.wheel, rd.cursed, rd.times), spin_seq = spin_seq + 1, phase = 'spinning',
                        revealed_at = null, forged = false where id = rd.id;
      perform _event(r.id, 'bribe', jsonb_build_object('player', me.id));
    elsif v_text = 'graffiti' then
      v_text := left(regexp_replace(trim(coalesce(a ->> 'text', '')), '\s+', ' ', 'g'), 60);
      if length(v_text) < 3 then raise exception 'Write a proper punishment'; end if;
      insert into graffiti (room_id, text) values (r.id, v_text);
      perform _event(r.id, 'scrooge', jsonb_build_object('kind', 'graffiti', 'text', v_text));   -- the same as the Scrooge's
      v_text := 'graffiti';
    else
      insert into shields (room_id, player_id, by_player, fake, sealed, golden) values (r.id, me.id, me.id, false, true, true);
      res := quiet;                                                   -- nobody is told; it shows when it saves you
    end if;
    insert into shop_buys (room_id, player_id, item, cost) values (r.id, me.id, v_text, v_int);

  -- AARON'S PLATE: one sausage each, one dirty (lying sideways on the TV). Started by the Skank
  -- (once per game, from level 2) or the host (any time); the TV never says who. The Skank eats too.
  when 'bbq_start' then
    if not v_host then
      if s.role is distinct from 'skank' or lvl < 2 or powerless then raise exception 'You can''t do that'; end if;   -- unlocks at level 3
      if s.last_bbq_game is not null and s.last_bbq_game >= v_games then raise exception 'One BBQ per game — wait for the next game to finish'; end if;
    end if;
    if exists (select 1 from sausage_plates where room_id = r.id and status = 'open') then raise exception 'The grill is already on'; end if;
    if rd.id is not null then raise exception 'Wait for the current punishment to finish'; end if;
    if exists (select 1 from votes where room_id = r.id and status = 'open') then raise exception 'Wait for the vote to finish'; end if;
    v_ids := array(select id from players where room_id = r.id and coalesce(locked_until <= now(), true)
                     and public_role is distinct from 'angel' order by seat);
    if cardinality(v_ids) < 2 then raise exception 'Need at least 2 hungry players'; end if;
    insert into sausage_plates (room_id, n, dirty, eaters, started_by, ends_at)
    values (r.id, cardinality(v_ids), floor(random() * cardinality(v_ids))::int, v_ids, me.id, now() + interval '25 seconds')
    returning id into v_id;
    if not v_host then update player_secrets set last_bbq_game = v_games where player_id = me.id; end if;
    perform _event(r.id, 'bbq_start', jsonb_build_object('plate', v_id));
    res := jsonb_build_object('plate_id', v_id);

  when 'bbq_pick' then
    select * into x from sausage_plates where id = (a ->> 'plate_id')::uuid and room_id = r.id;
    if not found or x.status <> 'open' or now() > x.ends_at + interval '2 seconds' then raise exception 'The plate''s gone'; end if;
    if not (me.id = any (x.eaters)) then raise exception 'You''re not at this BBQ'; end if;
    if x.picks ? me.id::text then raise exception 'You already took one'; end if;
    v_int := (a ->> 'index')::int;
    if v_int is null or v_int < 0 or v_int >= x.n then raise exception 'No such sausage'; end if;
    if exists (select 1 from jsonb_each_text(x.picks) e where e.value::int = v_int) then raise exception 'Someone beat you to that one'; end if;
    update sausage_plates set picks = picks || jsonb_build_object(me.id::text, v_int) where id = x.id;

  when 'bbq_close' then
    select * into x from sausage_plates where id = (a ->> 'plate_id')::uuid and room_id = r.id and status = 'open';
    if not found then return quiet; end if;                                  -- already served (TV/phones race)
    if not v_host and now() < x.ends_at then raise exception 'Still grilling'; end if;
    v_json := x.picks;
    -- anyone who didn't pick gets a random leftover
    for v_id in select e from unnest(x.eaters) e where not (v_json ? e::text) and exists (select 1 from players where id = e) loop
      select i into v_int from generate_series(0, x.n - 1) i
       where not exists (select 1 from jsonb_each_text(v_json) q where q.value::int = i) order by random() limit 1;
      v_json := v_json || jsonb_build_object(v_id::text, v_int);
    end loop;
    v_id := (select q.key::uuid from jsonb_each_text(v_json) q where q.value::int = x.dirty
              and exists (select 1 from players where id = q.key::uuid) limit 1);
    update sausage_plates set picks = v_json, status = 'closed', loser = v_id where id = x.id;
    if v_id is not null then insert into queue (room_id, player_id, reason) values (r.id, v_id, 'Ate the dirty sausage'); end if;
    perform _event(r.id, 'bbq_result', jsonb_build_object('plate', x.id, 'loser', v_id));
  end case;
  return res;
end $$;

-- =====================================================================
-- api_exec: authenticate, load, snapshot (host undo), dispatch
-- =====================================================================
create or replace function public.api_exec(p_uid uuid, p_action text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_anon boolean;
begin
  if p_uid is null then raise exception 'Not signed in'; end if;
  select coalesce(u.is_anonymous, false) into v_anon from auth.users u where u.id = p_uid;
  if not found then raise exception 'Unknown user'; end if;
  return _exec(p_uid, v_anon, p_action, p_args);
end $$;

-- The real dispatcher. api_exec authenticates and calls this; the Test Lab calls it again "as" a bot.
-- ---------- MINI-GAMES ----------
-- Summoned (dodge, plank, jack): the players are called to the TV and tap I'M HERE; the game goes live once
-- they all have and the TV is free. After 90s the host decides: start anyway (no-shows lose) or call it off
-- (the starter gets their ability back). Phone-only (bomb, penny) go straight to live.
-- The TV ticks mg_tick every second while a game is on, which moves deadlines along.

-- who can be pulled into a game: not the Angel, not anyone in Davy Jones' Locker
create or replace function public._mg_eligible(p_room uuid) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(id order by seat), '{}') from players
   where room_id = p_room and public_role is distinct from 'angel' and coalesce(locked_until <= now(), true)
$$;

-- is the TV free for a game to start?
create or replace function public._mg_clear(p_room uuid) returns boolean language sql stable set search_path = public as $$
  select not exists (select 1 from rounds where room_id = p_room and phase in ('waiting','spinning','revealed','saved'))
     and not exists (select 1 from votes where room_id = p_room and status = 'open')
     and not exists (select 1 from sausage_plates where room_id = p_room and status = 'open')
     and coalesce((select ability_until <= now() from rooms where id = p_room), true)
$$;

create or replace function public._mg_live(p_id uuid) returns void language plpgsql set search_path = public as $$
declare g minigames;
begin
  update minigames set status = 'live', live_at = now() + interval '4 seconds',       -- 3, 2, 1 on the TV
         ends_at = now() + case kind when 'dodge' then interval '10 seconds' when 'plank' then interval '14 seconds'
                                     when 'jack' then interval '19 seconds' else interval '14 seconds' end
   where id = p_id and status = 'muster' returning * into g;
  if g.id is null then return; end if;
  update rooms set ability_until = now() + interval '10 minutes' where id = g.room_id;   -- the stage is the game's until it ends
  perform _event(g.room_id, 'mg_live', jsonb_build_object('game', g.id, 'kind', g.kind));
end $$;

-- end a game: losers go to the wheel (Penny Drop: a drink each), the TV gets a short break
create or replace function public._mg_finish(p_id uuid, p_losers uuid[], p_result jsonb) returns void language plpgsql set search_path = public as $$
declare g minigames; v uuid;
begin
  update minigames set status = 'done', finished_at = now(),
         result = coalesce(p_result, '{}'::jsonb) || jsonb_build_object('losers', to_jsonb(coalesce(p_losers, '{}')))
   where id = p_id and status in ('muster','live') returning * into g;
  if g.id is null then return; end if;
  foreach v in array coalesce(p_losers, '{}') loop
    continue when not exists (select 1 from players where id = v);
    if g.kind = 'penny' then
      insert into punishments (room_id, player_id, text, kind) values (g.room_id, v, 'Penny Drop: called it wrong', 'penalty');
    else
      insert into queue (room_id, player_id, reason) values (g.room_id, v, case g.kind
        when 'dodge' then 'Hit by a throwing star' when 'plank' then 'Walked the plank'
        when 'jack' then 'Popped the Jack-in-the-Box' else 'Holding the bomb' end
        || case when g.result ? 'no_show' then ' (no-show)' else '' end);
    end if;
  end loop;
  update rooms set ability_until = now() + interval '6 seconds' where id = g.room_id;
  perform _event(g.room_id, 'mg_done', jsonb_build_object('game', g.id, 'kind', g.kind, 'losers', to_jsonb(coalesce(p_losers, '{}'))));
end $$;

-- settle a game from what's been played so far (deadlines, or everyone's in)
create or replace function public._mg_settle(p_id uuid) returns void language plpgsql set search_path = public as $$
declare g minigames; v uuid; v_pos numeric; v_min numeric; v_over uuid[] := '{}'; v_low uuid[] := '{}'; v_pos_all jsonb := '{}';
        v_coin text; v_calls jsonb; v_losers uuid[] := '{}';
begin
  select * into g from minigames where id = p_id;
  if g.kind = 'dodge' then
    perform _mg_finish(g.id, case when g.state ->> 'guess' = g.secret ->> 'dir' then '{}'::uuid[] else g.players end,
                       jsonb_build_object('dir', g.secret ->> 'dir', 'guess', g.state ->> 'guess', 'dodged', g.state ->> 'guess' = g.secret ->> 'dir'));
  elsif g.kind = 'plank' then
    foreach v in array g.players loop
      v_pos := coalesce((g.secret -> 'pos' ->> v::text)::numeric, 110);           -- never stopped: straight off the end
      v_pos_all := v_pos_all || jsonb_build_object(v::text, v_pos);
      if v_pos > 100 then v_over := v_over || v; end if;
    end loop;
    if cardinality(v_over) = 0 then
      select min((value)::numeric) into v_min from jsonb_each_text(v_pos_all);
      select coalesce(array_agg(key::uuid), '{}') into v_low from jsonb_each_text(v_pos_all) where value::numeric = v_min;
    end if;
    perform _mg_finish(g.id, case when cardinality(v_over) > 0 then v_over else v_low end,
                       jsonb_build_object('pos', v_pos_all, 'overboard', to_jsonb(v_over)));
  elsif g.kind = 'penny' then
    v_coin := g.secret ->> 'coin'; v_calls := coalesce(g.secret -> 'calls', '{}');
    foreach v in array g.players loop
      if coalesce(v_calls ->> v::text, '') <> v_coin then v_losers := v_losers || v; end if;
    end loop;
    perform _mg_finish(g.id, v_losers, jsonb_build_object('coin', v_coin, 'calls', v_calls));
  elsif g.kind = 'bomb' then
    perform _mg_finish(g.id, array[(g.state ->> 'holder')::uuid], jsonb_build_object('passes', g.state -> 'passes'));
  end if;
end $$;

-- one crank of the Jack-in-the-Box by whoever's turn it is
create or replace function public._mg_crank(p_id uuid, p_n int) returns void language plpgsql set search_path = public as $$
declare g minigames; v_turn int; v_who uuid; v_count int; v_order jsonb;
begin
  select * into g from minigames where id = p_id for update;
  v_order := g.state -> 'order'; v_turn := (g.state ->> 'turn')::int; v_who := (v_order ->> v_turn)::uuid;
  v_count := (g.state ->> 'count')::int + p_n;
  if v_count >= (g.secret ->> 'pop')::int then
    update minigames set state = state || jsonb_build_object('count', v_count, 'last', jsonb_build_object('player', v_who, 'n', p_n)) where id = g.id;
    perform _mg_finish(g.id, array[v_who], jsonb_build_object('pop', (g.secret ->> 'pop')::int, 'count', v_count, 'popper', v_who));
  else
    update minigames set ends_at = now() + interval '15 seconds',
           state = state || jsonb_build_object('count', v_count, 'turn', (v_turn + 1) % jsonb_array_length(v_order),
                                               'last', jsonb_build_object('player', v_who, 'n', p_n))
     where id = g.id;
  end if;
end $$;

create or replace function public._a_mini(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; g minigames; v_id uuid; v_ids uuid[]; v_text text; v_int int; v_elig uuid[];
  lvl constant int := _plevel(me.beers, r.id) - 1;        -- 0 = level 1 (pacified), 1 basic, 2 stronger, 3 evolved
  quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
  powerless constant boolean := coalesce(s.burned, false) or coalesce(me.rehab, false) or coalesce(me.locked_until > now(), false)
                                 or lvl < 1;                                                                          -- level 1: no powers yet
  v_games constant int := _games_done(r.id);
begin
  -- ---- starting a game ----
  if p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start') then
    if exists (select 1 from minigames where room_id = r.id and status in ('muster','live')) then raise exception 'A game is already on. Wait for it to finish'; end if;
    if exists (select 1 from sausage_plates where room_id = r.id and status = 'open') then raise exception 'Wait for Aaron''s Plate to finish'; end if;
    v_elig := _mg_eligible(r.id);
  end if;

  case p_action
  -- ASSASSIN (below level 3): once per game, throw at someone. They're summoned to the TV and have to read where it's coming from.
  when 'dodge_throw' then
    if s.role is distinct from 'assassin' or lvl >= 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_strike_game is not null and s.last_strike_game >= v_games then raise exception 'One throw per game'; end if;
    v_id := (a ->> 'player_id')::uuid; v_text := a ->> 'dir';
    if v_text is null or v_text not in ('left','right','high') then raise exception 'Pick where to throw'; end if;
    if v_id is null or v_id = me.id or not (v_id = any (v_elig)) then raise exception 'Pick someone else'; end if;
    update player_secrets set last_strike_game = v_games where player_id = me.id;
    insert into minigames (room_id, kind, started_by, refund, players, muster_until, secret)
    values (r.id, 'dodge', me.id, 'last_strike_game', array[v_id], now() + interval '90 seconds', jsonb_build_object('dir', v_text))
    returning * into g;

  -- THE KRAKEN: once per game, three players walk the plank
  when 'plank_start' then
    if s.role is distinct from 'davyjones' or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_plank_game is not null and s.last_plank_game >= v_games then raise exception 'One plank per game'; end if;
    v_ids := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(a -> 'player_ids', '[]')) as t(x));
    if cardinality(v_ids) <> 3 then raise exception 'Pick 3 players'; end if;
    if me.id = any (v_ids) or exists (select 1 from unnest(v_ids) u where not (u = any (v_elig))) then raise exception 'Pick 3 other players (not the Angel or anyone in the Locker)'; end if;
    update player_secrets set last_plank_game = v_games where player_id = me.id;
    insert into minigames (room_id, kind, started_by, refund, players, muster_until)
    values (r.id, 'plank', me.id, 'last_plank_game', v_ids, now() + interval '90 seconds')
    returning * into g;

  -- PENNYWISE: once per game, four players take turns cranking the Jack-in-the-Box (it pops somewhere from 8 to 20)
  when 'jack_start' then
    if s.role is distinct from 'jester' or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_jack_game is not null and s.last_jack_game >= v_games then raise exception 'One Jack-in-the-Box per game'; end if;
    v_ids := array(select distinct x::uuid from jsonb_array_elements_text(coalesce(a -> 'player_ids', '[]')) as t(x));
    if cardinality(v_ids) <> 4 then raise exception 'Pick 4 players'; end if;
    if exists (select 1 from unnest(v_ids) u where not (u = any (v_elig))) then raise exception 'Pick 4 players (not the Angel or anyone in the Locker)'; end if;
    v_ids := array(select u from unnest(v_ids) u order by random());
    update player_secrets set last_jack_game = v_games where player_id = me.id;
    insert into minigames (room_id, kind, started_by, refund, players, muster_until, secret, state)
    values (r.id, 'jack', me.id, 'last_jack_game', v_ids, now() + interval '90 seconds',
            jsonb_build_object('pop', 8 + floor(random() * 13)::int), jsonb_build_object('order', to_jsonb(v_ids), 'turn', 0, 'count', 0))
    returning * into g;

  -- THE BOMB (the Intruder / knife holder at level 3): a hot potato on everyone's phone; the fuse is secret
  when 'bomb_start' then
    if not ((s.role = 'intruder' or s.has_knife) and not s.burned and not me.rehab) or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_bomb_game is not null and s.last_bomb_game >= v_games then raise exception 'One bomb per game'; end if;
    if cardinality(v_elig) < 3 then raise exception 'Need at least 3 players'; end if;
    update player_secrets set last_bomb_game = v_games where player_id = me.id;
    insert into minigames (room_id, kind, status, started_by, players, live_at, secret, state)
    values (r.id, 'bomb', 'live', me.id, v_elig, now(),
            jsonb_build_object('fuse_at', now() + make_interval(secs => 20 + floor(random() * 21)::int)),
            jsonb_build_object('holder', v_elig[1 + floor(random() * cardinality(v_elig))::int], 'from', null, 'passes', 0))
    returning * into g;

  -- PENNY DROP (the Scrooge at level 3): everyone calls the coin on their phone; wrong (or silent) callers drink
  when 'penny_start' then
    if s.role is distinct from 'scrooge' or lvl < 3 or powerless then raise exception 'You can''t do that'; end if;
    if s.last_penny_game is not null and s.last_penny_game >= v_games then raise exception 'One Penny Drop per game'; end if;
    update player_secrets set last_penny_game = v_games where player_id = me.id;
    insert into minigames (room_id, kind, status, started_by, players, live_at, ends_at, secret, state)
    values (r.id, 'penny', 'live', me.id, v_elig, now() + interval '3 seconds', now() + interval '13 seconds',
            jsonb_build_object('coin', case when random() < .5 then 'heads' else 'tails' end, 'calls', '{}'::jsonb), jsonb_build_object('called', 0))
    returning * into g;

  -- ---- playing ----
  when 'mg_ready' then
    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.status <> 'muster' then return quiet; end if;
    if not (me.id = any (g.players)) then raise exception 'You''re not in this one'; end if;
    if not (me.id = any (g.ready)) then update minigames set ready = ready || me.id where id = g.id returning * into g; end if;
    if cardinality(g.ready) = cardinality(g.players) and _mg_clear(r.id) then perform _mg_live(g.id); end if;
    return res;

  when 'mg_move' then
    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.status <> 'live' then raise exception 'That game is over'; end if;
    if not (me.id = any (g.players)) then raise exception 'You''re not in this one'; end if;
    if now() < g.live_at then raise exception 'Wait for GO'; end if;
    if g.kind = 'dodge' then
      v_text := a ->> 'dir';
      if v_text is null or v_text not in ('left','right','high') then raise exception 'Left, right or high'; end if;
      if g.state ? 'guess' then return quiet; end if;
      update minigames set state = state || jsonb_build_object('guess', v_text) where id = g.id;
      perform _mg_settle(g.id);
    elsif g.kind = 'plank' then
      if g.secret -> 'pos' ? me.id::text then return quiet; end if;
      if now() > g.ends_at + interval '1 second' then raise exception 'Too late'; end if;
      -- THE SERVER KEEPS THE CLOCK. The marker is where the time since GO puts it, on the phone's own curve
      -- (110 × (t / 5.2s)^1.7). The phone's figure is only believed inside the last second (the trip over party wifi):
      -- nobody can claim a spot the marker hasn't reached yet, or one it left long ago.
      v_int := greatest(0, (extract(epoch from now() - g.live_at) * 1000)::int);
      update minigames set secret = jsonb_set(secret, '{pos}', coalesce(secret -> 'pos', '{}') || jsonb_build_object(me.id::text,
               round(least(least(110, 110 * power(v_int / 5200.0, 1.7)),
                           greatest(least(110, 110 * power(greatest(0, v_int - 1000) / 5200.0, 1.7)),
                                    coalesce((a ->> 'pos')::numeric, 110))), 1)))
       where id = g.id returning * into g;
      -- quiet, and nothing public: nobody learns who has stopped, or when, until the reveal
      if (select count(*) from jsonb_object_keys(g.secret -> 'pos')) = cardinality(g.players) then perform _mg_settle(g.id); return res; end if;
      return quiet;
    elsif g.kind = 'jack' then
      if (g.state -> 'order' ->> (g.state ->> 'turn')::int)::uuid <> me.id then raise exception 'Not your turn'; end if;
      v_int := (a ->> 'n')::int;
      if v_int is null or v_int not between 1 and 3 then raise exception 'Crank 1, 2 or 3 times'; end if;
      perform _mg_crank(g.id, v_int);
    elsif g.kind = 'bomb' then
      if now() >= (g.secret ->> 'fuse_at')::timestamptz then perform _mg_settle(g.id); return res; end if;
      if (g.state ->> 'holder')::uuid <> me.id then raise exception 'You''re not holding it'; end if;
      v_id := (a ->> 'to')::uuid;
      if v_id is null or v_id = me.id or not (v_id = any (g.players)) then raise exception 'Pass it to someone else'; end if;
      if v_id::text = g.state ->> 'from' and cardinality(g.players) > 2 then raise exception 'No passing it straight back'; end if;
      update minigames set state = state || jsonb_build_object('holder', v_id, 'from', me.id, 'passes', (state ->> 'passes')::int + 1) where id = g.id;
    elsif g.kind = 'penny' then
      v_text := a ->> 'call';
      if v_text is null or v_text not in ('heads','tails') then raise exception 'Heads or tails'; end if;
      if now() > g.ends_at then raise exception 'Too late'; end if;
      if g.secret -> 'calls' ? me.id::text then return quiet; end if;
      update minigames set secret = jsonb_set(secret, '{calls}', secret -> 'calls' || jsonb_build_object(me.id::text, v_text)),
             state = state || jsonb_build_object('called', (state ->> 'called')::int + 1)
       where id = g.id returning * into g;
      if (g.state ->> 'called')::int = cardinality(g.players) then perform _mg_settle(g.id); end if;
    end if;
    return res;

  -- deadlines: the TV calls this every second while a game is on
  when 'mg_tick' then
    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.status not in ('muster','live') then return quiet; end if;
    if g.status = 'muster' then
      if cardinality(g.ready) = cardinality(g.players) and _mg_clear(r.id) then perform _mg_live(g.id); return res; end if;
      if now() > g.muster_until and not coalesce((g.state ->> 'waiting_host')::boolean, false) then
        update minigames set state = state || '{"waiting_host":true}'::jsonb where id = g.id; return res;
      end if;
      return quiet;
    end if;
    if g.kind = 'bomb' then
      if now() >= (g.secret ->> 'fuse_at')::timestamptz then perform _mg_settle(g.id); return res; end if;
      return quiet;
    end if;
    if now() <= g.ends_at then return quiet; end if;
    if g.kind = 'jack' then perform _mg_crank(g.id, 1);      -- too slow: it cranks once for you
    else perform _mg_settle(g.id); end if;
    return res;

  -- the host, when someone doesn't turn up: start anyway (no-shows lose) or call it off (the ability comes back)
  -- BETTING: a spectator puts caps on the outcome (5 or more, up to all they have) while the game is being called
  -- to the TV (closes at GO)
  when 'bet' then
    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.kind not in ('dodge','plank','jack') then raise exception 'No bets on that'; end if;
    if not _bookie_on(g.id) then raise exception 'Betting opens after the first game'; end if;
    if g.status <> 'muster' or (g.muster_until is not null and now() > g.muster_until) or r.ended then raise exception 'Bets are closed'; end if;
    if not me.has_role then raise exception 'Open your card first: type your code in YOUR FILE'; end if;
    if me.id = any (g.players) then raise exception 'You''re in this one'; end if;
    if exists (select 1 from bets where game_id = g.id and player_id = me.id) then raise exception 'You already bet'; end if;
    v_text := a ->> 'option';
    if v_text is null or not (case when g.kind = 'dodge' then v_text in ('dodged','hit')
                                   else v_text in (select u::text from unnest(g.players) u) end) then raise exception 'Pick one of the options'; end if;
    v_int := coalesce((a ->> 'stake')::int, 5);
    if v_int < 5 then raise exception 'The smallest bet is 5 caps'; end if;
    if _caps(me.id) < 5 then raise exception 'You need 5 caps'; end if;
    if v_int > _caps(me.id) then raise exception 'You only have % caps', _caps(me.id); end if;
    insert into bets (room_id, game_id, player_id, option, stake) values (r.id, g.id, me.id, v_text, v_int);
    perform _event(r.id, 'bet_placed', jsonb_build_object('game', g.id, 'n', (select count(*) from bets where game_id = g.id)));
    return res;

  when 'mg_decide' then
    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.status <> 'muster' then return quiet; end if;
    if coalesce((a ->> 'start')::boolean, false) then
      -- START ANYWAY still waits for the TV, like mg_ready: never over a wheel, a vote or Aaron's Plate
      if not _mg_clear(r.id) then raise exception 'The TV is busy. Finish the punishment, the vote or the plate first'; end if;
      v_ids := array(select u from unnest(g.players) u where not (u = any (g.ready)));
      if cardinality(v_ids) = 0 then perform _mg_live(g.id);
      else perform _mg_finish(g.id, v_ids, '{"no_show":true}'::jsonb); end if;
    else
      update minigames set status = 'cancelled', finished_at = now() where id = g.id;
      if g.refund is not null and g.started_by is not null then
        execute format('update player_secrets set %I = null where player_id = $1', g.refund) using g.started_by;
      end if;
      perform _event(r.id, 'mg_cancelled', jsonb_build_object('game', g.id, 'kind', g.kind));
    end if;
    return res;
  end case;

  -- a new game: announce it (summoned games call their players to the TV)
  perform _event(r.id, case when g.status = 'live' then 'mg_live' else 'mg_muster' end,
                 jsonb_build_object('game', g.id, 'kind', g.kind, 'players', to_jsonb(g.players)));
  return jsonb_build_object('game_id', g.id);
end $$;

-- Public abilities (the ones the TV plays) share one stage. Each holds it for its animation plus a
-- ~3 second break; null = not a public ability. Secret abilities never take part, so a blocked press
-- can't reveal that someone quietly used a power.
-- Who the cursed player may pass the curse to: the losers of the most recent finished game, if the cursed
-- player played it (on a drawn side, or, with no matchup, simply not among the losers) and didn't lose,
-- and nobody has passed the curse on that game yet. Never the Angel or someone already cursed.
create or replace function public._curse_targets(p_room uuid, p_me uuid) returns uuid[] language sql stable set search_path = public as $$
  with g as (select * from games where room_id = p_room and status = 'ended' order by ended_at desc limit 1)
  select coalesce((
    select array(select l from unnest(g.losers) as l
                  where l <> p_me and exists (select 1 from players p where p.id = l and not p.cursed and p.public_role is distinct from 'angel'))
      from g
     where not (p_me = any (g.losers))
       and (g.matchup is null or jsonb_typeof(g.matchup) <> 'array' or exists (
             select 1 from jsonb_array_elements(g.matchup) as sd(side), jsonb_array_elements_text(sd.side) as v(id) where v.id = p_me::text))
       and not exists (select 1 from curse_passes c where c.game_id = g.id)), '{}')
$$;

create or replace function public._ability_hold(p_action text) returns interval language sql immutable as $$
  select case p_action
    when 'hit'            then interval '9 seconds'
    when 'scrooge_swap'   then interval '7 seconds'
    when 'scrooge_respin' then interval '7 seconds'
    when 'ninja_strike'   then interval '8 seconds'
    when 'dredd_shame'    then interval '12 seconds'
    when 'holy_nova'      then interval '13 seconds'
    when 'angel_bless'    then interval '12 seconds'
    when 'davy_lock'      then interval '11 seconds'
    when 'bbq_start'      then interval '30 seconds'
    when 'forged_orders'  then interval '7 seconds'
    when 'request_curse_pass' then interval '6 seconds'   -- the curse-pass animation
    when 'shiv'           then interval '6 seconds'
    when 'dodge_throw'    then interval '4 seconds'      -- summoned games: the call to the TV (the game holds the stage once live)
    when 'plank_start'    then interval '4 seconds'
    when 'jack_start'     then interval '4 seconds'
    when 'bomb_start'     then interval '50 seconds'     -- phone-only games are live straight away
    when 'penny_start'    then interval '20 seconds'
  end
$$;

create or replace function public._exec(p_uid uuid, p_anon boolean, p_action text, p_args jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
  v_anon boolean := p_anon; v_host boolean; r rooms; me players; s player_secrets; rd rounds;
  res jsonb; v_id uuid; v_code text; v_text text; x record;
begin

  -- ---- no room membership needed ----
  if p_action = 'create_room' then
    if v_anon then raise exception 'Host login required'; end if;
    loop
      v_code := _rand_code(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ');
      exit when not exists (select 1 from rooms where code = v_code);
    end loop;
    insert into rooms (code, host_id, deadline_at, segments, settings, target)
    values (v_code, p_uid, coalesce((a ->> 'deadline_at')::timestamptz, now() + interval '5 hours'),
            coalesce(a -> 'segments', _default_segments()), _default_settings() || coalesce(a -> 'settings', '{}'::jsonb),
            coalesce((a ->> 'target')::int, 100))
    returning * into r;
    return jsonb_build_object('room_id', r.id, 'code', r.code);

  elsif p_action = 'my_rooms' then
    if v_anon then raise exception 'Host login required'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object('id', ro.id, 'code', ro.code, 'created_at', ro.created_at,
                       'players', (select count(*) from players p where p.room_id = ro.id),
                       'practice', coalesce((ro.settings ->> 'practice')::boolean, false)) order by ro.created_at desc)
                       from rooms ro where ro.host_id = p_uid), '[]'::jsonb);

  elsif p_action = 'delete_room' then                  -- host only: the room and everything in it goes (all tables cascade)
    if v_anon then raise exception 'Host login required'; end if;
    begin v_id := (a ->> 'room_id')::uuid; exception when others then raise exception 'Room not found'; end;
    delete from rooms where id = v_id and host_id = p_uid;
    if not found then raise exception 'Room not found'; end if;
    return '{"ok":true}'::jsonb;

  elsif p_action = 'join' then
    select * into r from rooms where code = upper(trim(a ->> 'code')) for update;
    if not found then raise exception 'No room with that code'; end if;
    v_text := left(regexp_replace(trim(coalesce(a ->> 'name', '')), '\s+', ' ', 'g'), 20);
    if v_text = '' then raise exception 'Enter your name'; end if;
    -- a selfie must be one this phone uploaded (its own storage folder; the mock server's /files/ locally)
    if nullif(a ->> 'selfie_url', '') is not null
       and (a ->> 'selfie_url') !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/selfies/' || p_uid::text || '/[A-Za-z0-9._-]+$')
       and (a ->> 'selfie_url') !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/files/[A-Za-z0-9-]+$' then
      raise exception 'Take your selfie on this phone';
    end if;
    select * into me from players where room_id = r.id and user_id = p_uid;
    if exists (select 1 from players where room_id = r.id and lower(name) = lower(v_text) and id is distinct from me.id) then
      raise exception 'Someone already has that name — add an initial';
    end if;
    if me.id is not null then
      update players set name = v_text, selfie_url = coalesce(nullif(a ->> 'selfie_url', ''), selfie_url) where id = me.id;
    else
      insert into players (room_id, user_id, name, selfie_url, seat)
      values (r.id, p_uid, v_text, nullif(a ->> 'selfie_url', ''), coalesce((select max(seat) from players where room_id = r.id), 0) + 1)
      returning * into me;
      perform _event(r.id, 'joined', jsonb_build_object('player', me.id));
      update undo_log set blocked = true where room_id = r.id and not blocked;   -- an undo would wipe them out again
    end if;
    perform _touch(r.id);
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'player_id', me.id);
  end if;

  -- ---- everything else acts on a room ----
  begin v_id := (a ->> 'room_id')::uuid; exception when others then raise exception 'Room not found'; end;
  select * into r from rooms where id = v_id for update;          -- serialises all actions per room
  if not found then raise exception 'Room not found'; end if;
  v_host := (r.host_id = p_uid and not v_anon);
  select * into me from players where room_id = r.id and user_id = p_uid;
  if not v_host and me.id is null then raise exception 'Join the room first'; end if;
  select * into s from player_secrets where player_id = me.id;
  select * into rd from rounds where room_id = r.id and phase in ('waiting','spinning','revealed','saved') order by created_at desc limit 1;
  if a ? 'round_id' and (rd.id is null or rd.id <> (a ->> 'round_id')::uuid) then raise exception 'That punishment is already over'; end if;

  -- ---- TEST LAB: host only, practice rooms only. Bots are players with no login; the host acts as them. ----
  if p_action like 'lab\_%' then
    if not v_host then raise exception 'Only the host can do that'; end if;
    if not coalesce((r.settings ->> 'practice')::boolean, false) then raise exception 'Test tools only work in a practice room'; end if;
    if p_action = 'lab_bots' then
      for i in 1..greatest(1, least(12, coalesce((a ->> 'n')::int, 6))) loop
        insert into players (room_id, user_id, name, selfie_url, seat)
        values (r.id, gen_random_uuid(), 'Bot ' || ((select count(*) from players where room_id = r.id and name like 'Bot %') + 1),
                nullif(left(a -> 'selfies' ->> (i - 1), 8000), ''),
                coalesce((select max(seat) from players where room_id = r.id), 0) + 1);
      end loop;
      perform _touch(r.id);
      return '{"ok":true}'::jsonb;
    elsif p_action = 'lab_deal' then                    -- every bot without a role redeems a random unused card
      for x in select p.user_id from players p where p.room_id = r.id and p.name like 'Bot %'
                  and not exists (select 1 from player_secrets ps where ps.player_id = p.id) order by p.seat loop
        select code into v_code from role_codes where room_id = r.id and redeemed_at is null order by random() limit 1;
        exit when v_code is null;
        perform _exec(x.user_id, true, 'redeem', jsonb_build_object('room_id', r.id, 'code', v_code));
      end loop;
      perform _touch(r.id);
      return '{"ok":true}'::jsonb;
    end if;
    select * into me from players where id = (a ->> 'player_id')::uuid and room_id = r.id;
    if me.id is null then raise exception 'No such player'; end if;
    if p_action = 'lab_state' then return _state(me.user_id, r.code); end if;
    if p_action = 'lab_role' then                       -- hand this player a fresh card of any role
      v_text := a ->> 'role';
      if v_text is null or not (v_text = any (_roles())) then raise exception 'Unknown role'; end if;
      if exists (select 1 from player_secrets where player_id = me.id) then raise exception 'They already have a card'; end if;
      perform _new_code(r.id, v_text, null);
      select code into v_code from role_codes where room_id = r.id and redeemed_at is null and role = v_text limit 1;
      return _exec(me.user_id, true, 'redeem', jsonb_build_object('room_id', r.id, 'code', v_code));
    end if;
    if p_action = 'lab_beers' then                      -- jump a player to any drink level
      update players set beers = greatest(0, least(99, coalesce((a ->> 'beers')::int, 0))), last_beer_at = null where id = me.id;
      perform _touch(r.id);
      return '{"ok":true}'::jsonb;
    end if;
    if p_action = 'lab_as' then                         -- run any player action as this player, with the real rules
      v_text := a ->> 'action';
      if v_text is null or v_text like 'lab\_%' or v_text in ('create_room', 'my_rooms', 'join') then raise exception 'Not allowed'; end if;
      return _exec(me.user_id, true, v_text, coalesce(a -> 'args', '{}'::jsonb) || jsonb_build_object('room_id', r.id));
    end if;
    raise exception 'Unknown action %', p_action;
  end if;

  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide') and not v_host then
    raise exception 'Only the host can do that';
  end if;
  if p_action in ('redeem','heal','forge','frame','investigate','view_check','hit','scrooge_swap','scrooge_respin','scrooge_graffiti',
                  'betrayer_guess','betrayer_hint','request_curse_pass','cast_vote','submit_evidence','request_lock','davy_lock','take_it',
                  'ninja_strike','holy_nova','angel_bless','dredd_shame','shiv','bbq_pick','forged_orders','bet','shop',
                  'dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move') and me.id is null then
    raise exception 'Join the room first';
  end if;

  -- one TV moment at a time: the first public ability wins, the rest are told they missed out (nothing spent)
  if not v_host and _ability_hold(p_action) is not null and r.ability_until > now() then
    raise exception 'BUSY:%', ceil(extract(epoch from r.ability_until - now()))::int;
  end if;

  -- host undo: snapshot the room before any undoable host action
  if v_host and (p_action in ('accept','finish_saved','cancel_round','call_next','start_game','finish_game','start_vote','close_vote',
                              'expose','unexpose','kick','queue_add','queue_remove','remove_graffiti','hide_evidence','free_spin',
                              'jester_revenge','decide_lock','lock','unlock','make_angel','bbq_start','bbq_close')
                 or (p_action = 'log_beer' and me.id is null)) then
    insert into undo_log (room_id, action, label, snap) values (r.id, p_action, _undo_label(p_action, a), _snapshot(r.id));
    delete from undo_log where room_id = r.id and id not in (select id from undo_log where room_id = r.id order by id desc limit 10);
  end if;

  res := case
    when p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','kick','submit_evidence','hide_evidence','undo')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
      then _a_roles(p_action, a, r, me, s, rd, v_host)
    when p_action in ('log_beer','end_check','start_game','finish_game','start_vote','cast_vote','close_vote')
      then _a_games(p_action, a, r, me, s, rd, v_host)
    when p_action in ('queue_add','queue_remove','call_next','free_spin','spin','take_it','round_revealed','accept','finish_saved','cancel_round')
      then _a_wheel(p_action, a, r, me, s, rd, v_host)
    when p_action in ('heal','forge','frame','investigate','view_check','hit','betrayer_guess','betrayer_hint','scrooge_swap','scrooge_respin',
                      'scrooge_graffiti','remove_graffiti','request_curse_pass','jester_revenge','forged_orders')
      then _a_powers(p_action, a, r, me, s, rd, v_host)
    when p_action in ('request_lock','decide_lock','lock','unlock','davy_lock','ninja_strike','make_angel','holy_nova','angel_bless',
                      'dredd_shame','shiv','shop','bbq_start','bbq_pick','bbq_close')
      then _a_v5(p_action, a, r, me, s, rd, v_host)
    when p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','mg_tick','mg_decide','bet')
      then _a_mini(p_action, a, r, me, s, rd, v_host)
  end;
  if res is null then raise exception 'Unknown action %', p_action; end if;
  -- the stage hold only when a TV moment actually plays: a quiet move (a missed Hit) must look like nothing happened.
  -- The host's own Aaron's Plate / lock hold the stage just the same, so the hold never tells who started one.
  if (not v_host or p_action in ('bbq_start','lock')) and not coalesce((res ->> 'no_touch')::boolean, false)
     and _ability_hold(case when p_action = 'lock' then 'davy_lock' else p_action end) is not null then
    update rooms set ability_until = now() + _ability_hold(case when p_action = 'lock' then 'davy_lock' else p_action end) where id = r.id;
  end if;
  -- once a player has made a move, the host can't undo past it: a restore would erase Hits, heals, votes and checks and
  -- hand spent moves back (phone beers are the exception: undo carries them over). The mark is hidden: the TV's UNDO
  -- key doesn't change, so a quiet secret move stays invisible.
  -- mg_tick is housekeeping (phones tick too, so a game settles even if the TV sleeps), not a move
  -- bet: bets live outside the undo snapshot and caps are worked out from what happened, so a bet never blocks undo
  if not v_host and p_action not in ('log_beer', 'mg_tick', 'bet') then update undo_log set blocked = true where room_id = r.id and not blocked; end if;
  if not coalesce((res ->> 'no_touch')::boolean, false) then perform _touch(r.id); end if;
  return res - 'no_touch';
end $$;

-- =====================================================================
-- get_state: public room data + ONLY the caller's own secrets.
-- The host/TV view never contains a hidden role.
-- =====================================================================
-- The state as seen by one user (the Test Lab reads a bot's phone through this).
create or replace function public._state(p_uid uuid, p_code text)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  uid uuid := p_uid; r rooms; me players; s player_secrets; rd rounds; vt votes;
  v_anon boolean; v_host boolean; v_games int; v_knife boolean; v_lvl int; v_pac boolean; v_bl int; v_mg minigames;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then return jsonb_build_object('error', 'no_room', 'server_now', now()); end if;
  select coalesce(is_anonymous, false) into v_anon from auth.users where id = uid;
  v_host := r.host_id = uid and not coalesce(v_anon, true);
  select * into me from players where room_id = r.id and user_id = uid;
  if not v_host and me.id is null then
    return jsonb_build_object('server_now', now(), 'room', jsonb_build_object('id', r.id, 'code', r.code),
                              'me', jsonb_build_object('user_id', uid, 'is_host', false, 'joined', false));
  end if;
  select * into s  from player_secrets where player_id = me.id;
  select * into rd from rounds where room_id = r.id and phase in ('waiting','spinning','revealed','saved') order by created_at desc limit 1;
  select * into vt from votes where room_id = r.id order by created_at desc limit 1;
  v_games := _games_done(r.id);
  v_knife := s.player_id is not null and (s.role = 'intruder' or s.has_knife) and not s.burned and not me.rehab;
  v_lvl := _plevel(me.beers, r.id) - 1;                  -- the old 1-3 scale for the power flags; 0 = level 1 (pacified)
  v_pac := v_lvl < 1;
  v_bl := _blevel(me.beers);
  select * into v_mg from minigames g where g.room_id = r.id order by g.created_at desc limit 1;

  return jsonb_build_object(
    'server_now', now(),
    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'status', r.status, 'tally', r.tally, 'target', r.target,
      'deadline_at', r.deadline_at, 'segments', r.segments, 'settings', r.settings, 'ended', r.ended,
      'final_tally', r.final_tally, 'result', r.result, 'revealed', r.revealed, 'reveal', r.reveal,
      'version', r.version, 'wheel', _wheel(r.id), 'games_done', v_games,
      'ability_until', case when r.ability_until > now() then r.ability_until end),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'selfie_url', p.selfie_url, 'seat', p.seat, 'beers', p.beers, 'level', _plevel(p.beers, r.id),
        'has_role', p.has_role, 'public_role', p.public_role, 'love_partner_id', p.love_partner_id,
        'cursed', p.cursed, 'rehab', p.rehab, 'shivved_by', p.shivved_by,
        'locked_until', case when p.locked_until > now() then p.locked_until end,
        'lock_requested', p.lock_requested_at is not null,
        'held', exists (select 1 from queue q where q.player_id = p.id and q.status = 'held'),
        'punishments', coalesce((select jsonb_agg(jsonb_build_object('text', pu.text, 'kind', pu.kind, 'via_love', pu.via_love,
                                   'at', pu.created_at) order by pu.created_at) from punishments pu where pu.player_id = p.id), '[]'::jsonb)
      ) order by p.seat) from players p where p.room_id = r.id), '[]'::jsonb),
    'queue', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'player_id', q.player_id, 'reason', q.reason, 'times', q.times) order by q.pos)
                         from queue q join players qp on qp.id = q.player_id
                        where q.room_id = r.id and (q.status = 'queued' or (q.status = 'held' and coalesce(qp.locked_until <= now(), true)))), '[]'::jsonb),
    'round', case when rd.id is null then null else jsonb_build_object(
      'id', rd.id, 'victim_id', rd.victim_id, 'original_victim_id', rd.original_victim_id, 'phase', rd.phase,
      'reason', rd.reason, 'times', rd.times, 'spin_seq', rd.spin_seq, 'wheel', rd.wheel, 'cursed', rd.cursed, 'revealed_at', rd.revealed_at,
      'forged', rd.forged and rd.phase in ('spinning','revealed'),
      'created_at', rd.created_at, 'spin_at', rd.created_at + interval '4 seconds', 'stand_in_id', rd.stand_in_id, 'stand_in_for', rd.stand_in_for,
      'landings', case when rd.phase in ('spinning','revealed') then rd.landings else '[]'::jsonb end) end,
    'game', (select jsonb_build_object('id', g.id, 'name', g.name, 'status', g.status, 'losers', to_jsonb(g.losers),
                                       'slackers', to_jsonb(g.slackers), 'slacker_beers', g.slacker_beers, 'ended_at', g.ended_at,
                                       'matchup', g.matchup, 'champs', to_jsonb(g.champs), 'champ_beers', g.champ_beers)
               from games g where g.room_id = r.id order by g.created_at desc limit 1),
    'vote', case when vt.id is null then null else jsonb_build_object(
      'id', vt.id, 'kind', vt.kind, 'title', vt.title, 'status', vt.status, 'options', to_jsonb(vt.options),
      'ends_at', vt.ends_at, 'result', to_jsonb(vt.result), 'game_id', vt.game_id, 'outcome', vt.outcome, 'created_at', vt.created_at,
      -- per-suspect counts only once the vote has closed: live, the room can see who's tapping, so running counts
      -- would give ballots away (while it's open everyone gets the total only)
      'counts', case when vt.status = 'open' then '{}'::jsonb else coalesce((select jsonb_object_agg(q.choice_id, q.c) from
                           (select choice_id, count(*) c from ballots where vote_id = vt.id group by choice_id) q), '{}'::jsonb) end,
      'voters', (select count(*) from ballots where vote_id = vt.id),
      'my_choice', (select choice_id from ballots where vote_id = vt.id and voter_id = me.id)) end,
    -- Aaron's Plate: which sausage is dirty only goes to the TV (and to everyone once it's served);
    -- while it's open, phones only see which sausages are taken and their own pick, never who took which
    'plate', (select jsonb_build_object('id', sp.id, 'n', sp.n, 'status', sp.status, 'ends_at', sp.ends_at, 'eaters', to_jsonb(sp.eaters),
                                        'picks', case when v_host or sp.status = 'closed' then sp.picks
                                                      else jsonb_strip_nulls(jsonb_build_object(me.id::text, sp.picks -> (me.id::text))) end,
                                        'taken', coalesce((select jsonb_agg(value::int) from jsonb_each_text(sp.picks)), '[]'::jsonb),
                                        'loser', sp.loser, 'created_at', sp.created_at,
                                        'dirty', case when v_host or sp.status = 'closed' then sp.dirty end)
                from sausage_plates sp where sp.room_id = r.id order by sp.created_at desc limit 1),
    'minigame', (select jsonb_build_object('id', g.id, 'kind', g.kind, 'status', g.status, 'players', to_jsonb(g.players),
                                          'ready', to_jsonb(g.ready), 'muster_until', g.muster_until, 'live_at', g.live_at,
                                          'ends_at', case when g.kind <> 'bomb' then g.ends_at end, 'state', g.state, 'result', g.result,
                                          'finished_at', g.finished_at,
                                          'mine', case g.kind when 'plank' then g.secret -> 'pos' -> (me.id::text)
                                                              when 'penny' then g.secret -> 'calls' -> (me.id::text) end)
                   from minigames g where g.room_id = r.id and (g.status in ('muster','live') or g.finished_at > now() - interval '25 seconds')
                  order by g.created_at desc limit 1),
    -- THE BOOKIE: only the count while it's open; picks never leave the server except your own (and, once settled,
    -- who called it). The host/TV gets the same object without 'mine'.
    'book', case when v_mg.id is not null and v_mg.kind in ('dodge','plank','jack') and _bookie_on(v_mg.id)
                  and (v_mg.status in ('muster','live') or v_mg.finished_at > now() - interval '45 seconds') then jsonb_build_object(
      'game_id', v_mg.id, 'kind', v_mg.kind, 'stake', 5,                      -- the smallest bet
      'status', case when v_mg.status = 'muster' and (v_mg.muster_until is null or now() <= v_mg.muster_until) then 'open'
                     when v_mg.status in ('muster','live') then 'closed'
                     when v_mg.status = 'cancelled' or coalesce(v_mg.result ? 'no_show', false) then 'void'
                     else 'settled' end,
      'options', case when v_mg.kind = 'dodge' then '[{"id":"dodged","label":"DODGES IT"},{"id":"hit","label":"TAKES THE HIT"}]'::jsonb
                      else coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.name, 'player_id', p.id)
                                                       order by array_position(case when v_mg.kind = 'jack'
                                                         then array(select jsonb_array_elements_text(coalesce(v_mg.state -> 'order', to_jsonb(v_mg.players))))::uuid[]
                                                         else v_mg.players end, p.id))
                                       from players p where p.id = any (v_mg.players)), '[]'::jsonb) end,
      'n', (select count(*) from bets b where b.game_id = v_mg.id),
      'can_bet', not v_host and me.id is not null and me.has_role and not r.ended and v_mg.status = 'muster'
                 and (v_mg.muster_until is null or now() <= v_mg.muster_until) and not (me.id = any (v_mg.players))
                 and not exists (select 1 from bets b where b.game_id = v_mg.id and b.player_id = me.id) and _caps(me.id) >= 5,
      'mine', case when v_host or me.id is null then null else
                (select jsonb_build_object('option', b.option, 'stake', b.stake, 'payout', b.payout) from bets b where b.game_id = v_mg.id and b.player_id = me.id) end,
      'winning', case when v_mg.status = 'done' and not coalesce(v_mg.result ? 'no_show', false) then
                   case when v_mg.kind = 'dodge' then jsonb_build_array(case when coalesce((v_mg.result ->> 'dodged')::boolean, false) then 'dodged' else 'hit' end)
                        else coalesce(v_mg.result -> 'losers', '[]'::jsonb) end end,
      'winners', case when v_mg.status = 'done' and not coalesce(v_mg.result ? 'no_show', false) then
                   (select coalesce(jsonb_agg(b.player_id order by b.id), '[]'::jsonb) from bets b where b.game_id = v_mg.id
                       and b.option = any (case when v_mg.kind = 'dodge'
                                                then array[case when coalesce((v_mg.result ->> 'dodged')::boolean, false) then 'dodged' else 'hit' end]
                                                else array(select jsonb_array_elements_text(coalesce(v_mg.result -> 'losers', '[]'::jsonb))) end)) end,
      'settled_at', case when v_mg.status in ('done','cancelled') then v_mg.finished_at end) end,
    'curse_passes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'from_id', c.from_id, 'to_id', c.to_id) order by c.created_at)
                                from curse_passes c where c.room_id = r.id and c.status = 'pending'), '[]'::jsonb),
    'graffiti', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'text', g.text) order by g.created_at)
                            from graffiti g where g.room_id = r.id and g.active), '[]'::jsonb),
    -- evidence photos only go to the TV/host, and never say who took them
    'evidence', case when v_host then coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'image_url', e.image_url, 'caption', e.caption,
                                 'hidden', e.hidden, 'at', e.created_at) order by e.created_at)
                                 from evidence e where e.room_id = r.id), '[]'::jsonb) else '[]'::jsonb end,
    'undo', case when v_host then (select jsonb_build_object('label', u.label, 'at', u.created_at) from undo_log u
                                    where u.room_id = r.id and u.created_at > now() - interval '2 minutes' order by u.id desc limit 1) end,
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'payload', e.payload, 'at', e.created_at) order by e.id)
                          from (select * from events where room_id = r.id order by id desc limit 40) e), '[]'::jsonb),
    'me', jsonb_build_object(
      'user_id', uid, 'is_host', v_host, 'joined', me.id is not null, 'player_id', me.id,
      'late_left', case when v_host then (select count(*) from role_codes c where c.room_id = r.id and c.late and c.redeemed_at is null) end,   -- a count, never the roles
      'cooldown_until', me.last_beer_at + interval '3 minutes',
      'curse_targets', case when me.cursed then to_jsonb(_curse_targets(r.id, me.id)) else '[]'::jsonb end,
      -- THE SHIV (rehab only): ready now, or how many more rehab beers until the next one
      'shiv', case when me.rehab then jsonb_build_object(
        'ready', me.rehab_beers >= 3 * (me.shivs_used + 1) and (me.last_shiv_game is null or me.last_shiv_game < v_games),
        'beers_to_go', greatest(0, 3 * (me.shivs_used + 1) - me.rehab_beers),
        'used_this_game', coalesce(me.last_shiv_game >= v_games, false)) end,
      'evidence_count', (select count(*) from evidence where player_id = me.id),
      'take_it_used', me.stood_in_at is not null,                -- TAKE IT FOR THEM: once a night
      'caps', case when me.id is not null then _caps(me.id) end, -- your own caps only
      'shop', case when me.id is not null then jsonb_build_object(
        'bought', coalesce((select jsonb_agg(distinct x.item) from shop_buys x where x.player_id = me.id and x.item <> 'sound'), '[]'::jsonb),
        'opens_after_game', v_games = 0,                          -- bribe, graffiti and ticket wait for the first game
        'graffiti_off', not _setting(r, 'scrooge_graffiti'),
        'can_bribe', rd.id is not null and rd.victim_id = me.id and rd.phase = 'revealed' and now() <= rd.revealed_at + interval '13 seconds'
                     and not exists (select 1 from shop_buys x where x.player_id = me.id and x.item = 'bribe'),
        'bribe_until', case when rd.victim_id = me.id and rd.phase = 'revealed' then rd.revealed_at + interval '13 seconds' end,
        'sound_ready_at', (select max(e.created_at) + interval '45 seconds' from events e where e.room_id = r.id and e.kind = 'soundboard')) end,
      'level_info', case when me.id is not null then jsonb_build_object('level', v_lvl + 1,
                      'beers_to_next', case when v_lvl + 1 >= 4 then null else greatest(0, (v_lvl + 1) * 3 - me.beers) end,
                      'waiting_on_game', v_bl > v_lvl + 1) end,
      'secret', case when s.player_id is null then null else jsonb_build_object(
        'role', s.role, 'team', _team(s.role, s.team_with, s.has_knife), 'burned', s.burned, 'has_knife', s.has_knife,
        'lovebird', s.pair_id is not null,
        'level', v_lvl + 1,
        'heals_left', case when s.role = 'medic' and not (s.burned or v_pac) then greatest(0, least(v_lvl, 2) - s.heals_used) else 0 end,
        'evolved', case when v_lvl < 3 then null
                        else case s.role when 'medic' then 'surgeon' when 'detective' then 'dredd' when 'assassin' then 'ninja'
                                         when 'davyjones' then 'kraken' when 'skank' then 'gobshite' when 'jester' then 'pennywise'
                                         when 'forger' then 'oathbreaker' end end,
        'self_heal_ready', s.role = 'medic' and v_lvl >= 3 and not s.self_heal_used and not (s.burned or v_pac) and not me.rehab,
        'lock_ready', s.role = 'davyjones' and not (s.burned or v_pac) and not me.rehab and (s.last_lock_game is null or s.last_lock_game < v_games)
                      and not exists (select 1 from players p where p.id = s.lock_target and p.locked_until > now()),
        'prisoner', case when s.role = 'davyjones' then (select jsonb_build_object('name', p.name, 'until', p.locked_until)
                                                          from players p where p.id = s.lock_target and p.locked_until > now()) end,
        'lock_minutes', case when s.role = 'davyjones' then 15 end,
        'nova_ready', s.role = 'angel' and not s.nova_used and not r.ended and r.tally + greatest(1, round(r.target * 0.10))::int < r.target,
        'nova_used', s.nova_used,
        'nova_beers', case when s.role = 'angel' then greatest(1, round(r.target * 0.10))::int end,
        'bless_ready', s.role = 'angel' and not s.bless_used,
        'dodge_ready', s.role = 'assassin' and v_lvl < 3 and not (s.burned or v_pac) and not me.rehab and (s.last_strike_game is null or s.last_strike_game < v_games),
        'plank_ready', s.role = 'davyjones' and v_lvl >= 3 and not (s.burned or v_pac) and not me.rehab and (s.last_plank_game is null or s.last_plank_game < v_games),
        'jack_ready', s.role = 'jester' and v_lvl >= 3 and not (s.burned or v_pac) and not me.rehab and (s.last_jack_game is null or s.last_jack_game < v_games),
        'bomb_ready', v_knife and v_lvl >= 3 and (s.last_bomb_game is null or s.last_bomb_game < v_games),
        'penny_ready', s.role = 'scrooge' and v_lvl >= 3 and not (s.burned or v_pac) and not me.rehab and (s.last_penny_game is null or s.last_penny_game < v_games),
        'strike_ready', s.role = 'assassin' and v_lvl >= 3 and not (s.burned or v_pac) and not me.rehab and (s.last_strike_game is null or s.last_strike_game < v_games),
        'shame_ready', s.role = 'detective' and v_lvl >= 3 and not (s.burned or v_pac) and not me.rehab and (s.last_shame_game is null or s.last_shame_game < v_games),
        'bbq_ready', s.role = 'skank' and v_lvl >= 2 and not (s.burned or v_pac) and not me.rehab and (s.last_bbq_game is null or s.last_bbq_game < v_games),
        'guesses_left', case when s.role = 'betrayer' and not (s.burned or v_pac) and not s.has_knife and cardinality(s.team_with) = 0
                             then greatest(0, (case when v_lvl >= 2 then 3 else 2 end) - cardinality(s.guessed)) else 0 end,
        'guessed', to_jsonb(s.guessed),
        'respins_left', case when s.role = 'scrooge' and not (s.burned or v_pac) then greatest(0, v_lvl - s.respins_used) else 0 end,
        'swap_used', s.swaps_used >= (case when v_lvl >= 3 then 2 else 1 end) or s.burned or v_pac,
        'graffiti_used', s.graffiti_used,
        'skank_bonus', case when s.role = 'skank' then s.skank_bonus end,
        'hint_ready', s.role = 'betrayer' and v_lvl >= 3 and s.hint_ids is null and not (s.burned or v_pac) and not me.rehab
                      and not s.has_knife and cardinality(s.team_with) = 0,
        'hint', case when s.role = 'betrayer' and s.hint_ids is not null then
                  (select jsonb_agg(p.name order by array_position(s.hint_ids, p.id)) from players p where p.id = any (s.hint_ids)) end,
        'healed_this_round', rd.id is not null and exists (select 1 from shields sh where sh.by_player = me.id
                                                             and sh.player_id = rd.victim_id and sh.used_at is null and not sh.golden),
        'my_heals', case when s.role = 'medic' then coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'used', sh.used_at is not null) order by sh.created_at)
                                  from shields sh join players p on p.id = sh.player_id where sh.by_player = me.id and not sh.fake and not sh.golden), '[]'::jsonb) end,
        'hit_alive', v_knife and s.hit_alive,
        'hit_ready', v_knife and not v_pac and s.hit_alive and (s.last_hit_game is null or s.last_hit_game < v_games),
        'checks_left', case when s.role = 'detective' and not (s.burned or v_pac) and not me.rehab
                            then greatest(0, least(3, 1 + v_games) - s.checks_used) else 0 end,
        'pending_check', (select jsonb_build_object('id', c.id, 'name', p.name) from detective_checks c join players p on p.id = c.target_id
                           where c.detective_id = me.id and not c.viewed limit 1),
        'checked', (select jsonb_agg(p.name order by c.created_at) from detective_checks c join players p on p.id = c.target_id
                     where c.detective_id = me.id),
        'forge_used', s.forge_used,
        'orders_ready', s.role = 'forger' and v_lvl >= 3 and not (s.burned or v_pac) and not me.rehab
                        and (s.last_orders_game is null or s.last_orders_game < v_games),
        'forge_ready', s.role = 'forger' and v_lvl >= 2 and not s.forge_used and not (s.burned or v_pac) and not me.rehab
                       and exists (select 1 from shields sh where sh.room_id = r.id and sh.used_at is null and not sh.fake and not sh.forged and not sh.sealed),
        'frame_ready', s.role = 'forger' and not s.frame_used and not (s.burned or v_pac) and not me.rehab,
        'frame', case when s.role = 'forger' and s.frame_target is not null then
                   (select jsonb_build_object('name', p.name, 'spent', s.frame_spent) from players p where p.id = s.frame_target) end,
        'partner', (select jsonb_build_object('id', p.id, 'name', p.name, 'selfie_url', p.selfie_url) from players p where p.id = s.partner_id),
        -- the Saboteurs know each other (with roles); a Betrayer only once they've joined (found the Intruder or hold the knife)
        'allies', case when _team(s.role, s.team_with, s.has_knife) = 'guilty' then
                    (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'role', ps.role, 'caught', p.rehab) order by p.seat)
                       from player_secrets ps join players p on p.id = ps.player_id
                      where ps.room_id = r.id and ps.player_id <> me.id and _team(ps.role, ps.team_with, ps.has_knife) = 'guilty') end
      ) end)
  );
end $$;

create or replace function public.get_state(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select _state(auth.uid(), p_code)
$$;

-- ---------- privileges ----------
revoke all on function public.api_exec(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_state(text) from public, anon;
grant execute on function public.get_state(text) to authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like '\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
do $$ begin
  execute 'grant execute on function public.api_exec(uuid, text, jsonb) to service_role';
exception when undefined_object then null; end $$;
