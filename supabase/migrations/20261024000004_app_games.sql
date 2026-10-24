-- =====================================================================
-- APP GAMES: 5-20 minute games the TV runs itself (The Herd, Odd One Out, Tag Team Chess), picked from GAMES
-- next to the real ones. Each is an ordinary row in games (so GAME OVER, the Champ, the Slacker, the Trial, the
-- levels and the caps all follow exactly as for beer pong), plus what the app needs to run it. Living on the games
-- row, an app game rides the host's undo snapshot for free.
--
-- Each kind lives in its own file and provides five functions (g is the game's row, me the caller, or null for
-- the TV):
--   _<kind>_init(g, a)        set up app_state / app_secret for a new game (the players are in g.matchup)
--   _<kind>_move(g, me, a)    a player's move; raises a plain sentence when it's refused
--   _<kind>_host(g, a)        the host's keys (a ->> 'op'); 'stop' ends the game now with what's been played
--   _<kind>_tick(g)           move on if a deadline has passed; true if anything changed
--   _<kind>_view(g, me, host) what this viewer may see: public facts, plus 'mine' (a phone's own secrets)
-- and ends the game with _app_finish(game_id, losers). Kinds: herd, odd, chess (chess is _ttc_*: _chess_* is the
-- rules engine).
-- =====================================================================

alter table public.games
  add column if not exists app        text,     -- 'herd' | 'odd' | 'chess' (null: a real game)
  add column if not exists app_state  jsonb,    -- public: what the TV and every phone may see
  add column if not exists app_secret jsonb;    -- the server's only: the famous name, the picks before the reveal

-- who an app game is played by: everyone in the room except anyone in Davy Jones' Locker (the Angel plays)
create or replace function public._app_players(p_room uuid) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(id order by seat), '{}') from players
   where room_id = p_room and coalesce(locked_until <= now(), true)
$$;

-- the players of an app game, in seat order (g.matchup holds them: one side, or chess's two teams)
create or replace function public._app_roster(g games) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(p.id order by p.seat), '{}') from players p
   where p.id in (select v.id::uuid from jsonb_array_elements(coalesce(g.matchup, '[]')) as sd(side), jsonb_array_elements_text(sd.side) as v(id))
$$;

-- an app game is over: straight into the usual GAME OVER (losers to the queue, then the Champ, the Slacker, the Trial)
create or replace function public._app_finish(p_game uuid, p_losers uuid[]) returns void language plpgsql set search_path = public as $$
declare g games; r rooms;
begin
  select * into g from games where id = p_game and status = 'active' and app is not null;
  if g.id is null then return; end if;
  select * into r from rooms where id = g.room_id;
  perform _a_games('finish_game', jsonb_build_object('game_id', g.id, 'losers', to_jsonb(coalesce(p_losers, '{}'::uuid[]))),
                   r, null::players, null::player_secrets, null::rounds, true);
end $$;

-- the running app game in a room (one game at a time, like the real ones)
create or replace function public._app_live(p_room uuid) returns games language sql stable set search_path = public as $$
  select * from games where room_id = p_room and status = 'active' and app is not null order by created_at desc limit 1
$$;

create or replace function public._a_app(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; g games; v_kind text; v_ids uuid[]; v_side jsonb; v_res jsonb; v_tick boolean;
  quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
begin
  if p_action = 'app_start' then
    v_kind := a ->> 'kind';
    if v_kind is null or v_kind not in ('herd', 'odd', 'chess') then raise exception 'Pick a game'; end if;
    if r.ended then raise exception 'The night is over'; end if;
    if exists (select 1 from minigames where room_id = r.id and status in ('muster','live')) or not _mg_clear(r.id) then
      raise exception 'The TV is busy. Finish the punishment, the vote, the plate or the mini-game first';
    end if;
    if v_kind = 'chess' then
      -- two teams from THE DRAW (TWO TEAMS: everyone); the engine side of white and black is drawn in _ttc_init
      if jsonb_typeof(a -> 'teams') <> 'array' or jsonb_array_length(a -> 'teams') <> 2
         or exists (select 1 from jsonb_array_elements(a -> 'teams') t(side) where jsonb_typeof(t.side) <> 'array' or jsonb_array_length(t.side) = 0) then
        raise exception 'Draw two teams first';
      end if;
      v_side := a -> 'teams';
      v_ids := array(select v.id::uuid from jsonb_array_elements(v_side) as sd(side), jsonb_array_elements_text(sd.side) as v(id));
      if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'Someone is on both teams'; end if;
    else
      v_ids := case when jsonb_typeof(a -> 'player_ids') = 'array'
                    then array(select distinct x::uuid from jsonb_array_elements_text(a -> 'player_ids') as t(x))
                    else _app_players(r.id) end;
      if cardinality(v_ids) < 3 then raise exception 'Needs at least 3 players'; end if;
      v_side := jsonb_build_array(to_jsonb(v_ids));
    end if;
    if exists (select 1 from unnest(v_ids) u where not (u = any (_app_players(r.id)))) then
      raise exception 'Only players in the room (and out of the Locker) can play';
    end if;
    -- a normal game row (start_game refuses if one is already running), then the app's own set-up
    v_res := _a_games('start_game', jsonb_build_object('name', case v_kind when 'herd' then 'The Herd' when 'odd' then 'Odd One Out'
                                                                           else 'Tag Team Chess' end, 'matchup', v_side),
                      r, me, s, rd, true);
    update games set app = v_kind where id = (v_res ->> 'game_id')::uuid returning * into g;
    if v_kind = 'herd' then perform _herd_init(g, a);
    elsif v_kind = 'odd' then perform _odd_init(g, a);
    else perform _ttc_init(g, a);
    end if;
    perform _event(r.id, 'app_start', jsonb_build_object('game', g.id, 'kind', v_kind));   -- the phones buzz
    return v_res;
  end if;

  g := _app_live(r.id);
  if g.id is null or (a ? 'game_id' and g.id::text <> (a ->> 'game_id')) then
    if p_action = 'app_tick' then return quiet; end if;
    raise exception 'That game is over';
  end if;

  -- (each kind is called from its own branch: a branch only needs its kind's functions when it runs)
  if p_action = 'app_tick' then           -- housekeeping (the TV ticks every second, phones past a deadline): anyone
    if g.app = 'herd' then v_tick := _herd_tick(g);
    elsif g.app = 'odd' then v_tick := _odd_tick(g);
    else v_tick := _ttc_tick(g);
    end if;
    return case when v_tick then res else quiet end;
  elsif p_action = 'app_move' then
    if v_host then raise exception 'That''s for the players'; end if;
    if not (me.id = any (_app_roster(g))) then raise exception 'You''re not in this game'; end if;
    if g.app = 'herd' then res := _herd_move(g, me, a);
    elsif g.app = 'odd' then res := _odd_move(g, me, a);
    else res := _ttc_move(g, me, a);
    end if;
  elsif p_action = 'app_host' then
    if g.app = 'herd' then res := _herd_host(g, a);
    elsif g.app = 'odd' then res := _odd_host(g, a);
    else res := _ttc_host(g, a);
    end if;
  end if;
  return coalesce(res, '{"ok":true}'::jsonb);
end $$;

-- this viewer's view of the running app game (null when there isn't one)
create or replace function public._app_view(p_room uuid, me players, v_host boolean) returns jsonb language plpgsql stable set search_path = public as $$
declare g games; v jsonb;
begin
  g := _app_live(p_room);
  if g.id is null then return null; end if;
  if g.app = 'herd' then v := _herd_view(g, me, v_host);
  elsif g.app = 'odd' then v := _odd_view(g, me, v_host);
  else v := _ttc_view(g, me, v_host);
  end if;
  return jsonb_build_object('id', g.id, 'kind', g.app, 'name', g.name, 'players', to_jsonb(_app_roster(g)), 'started_at', g.created_at)
         || coalesce(v, '{}'::jsonb);
end $$;

-- ---------- privileges (every _ function is server-only) ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like '\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
