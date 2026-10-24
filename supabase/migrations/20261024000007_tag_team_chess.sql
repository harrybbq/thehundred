-- =====================================================================
-- TAG TEAM CHESS (an app game, up to about 20 minutes): two teams from THE DRAW, one board on the TV, everyone moves
-- from their phone. Which team is white is drawn here, at random, and so is the order inside each team. The move goes
-- round each team: white's player 1, black's player 1, white's player 2, black's player 2... each team loops back to
-- its own player 1 (a team of 3 and a team of 2 each cycle their own list). Classic chess, every rule, checked by the
-- engine (_chess_*, 20261024000003_chess_engine.sql). No conferring (honour system: a sign on the TV and the phones).
--   Chess clocks: 10 minutes a team, running only on that team's turn; run out and that team loses (a flag).
--   30 seconds a move: miss it and a random legal move is played for that player, and the turn passes on as normal.
--   Checkmate or a flag: the whole losing team goes in the punishment queue. Any draw (stalemate, not enough pieces,
--   the fifty-move rule, threefold repetition) or the host's END GAME: nobody does. Then the usual GAME OVER.
-- Phases: intro (the teams and the rules, 15 s; the host's START NOW) -> play -> end (the result, held 20 s; the
-- host's CONTINUE) -> _app_finish.
-- Chess has no secrets, so app_state is the whole game, the same for every viewer. The engine costs ~2 ms a call, so
-- the legal moves are worked out once per move and stored (the view never calls the engine: 17 phones poll it).
-- app_secret only keeps the earlier positions for threefold repetition, since the last capture or pawn move (nothing
-- before one can come round again).
-- Clocks: clock = each side's remaining ms when the current turn started (turn_at); the side to move's clock runs
-- from turn_at. The deadline is turn_at + the 30 s, or + what's left on the clock if that's less; until mirrors it
-- (the TV and phones count down to it). A move is still taken up to 2 s after the deadline (it may have been sent in
-- time), and only then does the tick settle it: a flag if the clock ran out, otherwise a random move.
-- The player to move may also "touch" a piece (a = {touch: 'c4'}): the TV lights up where it can go. Nothing else.
-- =====================================================================

-- the team (move order) playing a side, and the other side
create or replace function public._ttc_roster(st jsonb, p_side text) returns jsonb language sql immutable set search_path = public as $$
  select case p_side when 'w' then st -> 'white' else st -> 'black' end
$$;
create or replace function public._ttc_other(p_side text) returns text language sql immutable set search_path = public as $$
  select case p_side when 'w' then 'b' else 'w' end
$$;

-- the turn's deadline: 30 seconds, or the flag if the side to move has less than that on its clock
create or replace function public._ttc_deadline(st jsonb) returns timestamptz language sql stable set search_path = public as $$
  select (st ->> 'turn_at')::timestamptz
         + make_interval(secs => least((st ->> 'move_ms')::bigint, (st -> 'clock' ->> (st ->> 'turn'))::bigint) / 1000.0)
$$;

create or replace function public._ttc_init(g games, a jsonb) returns void language plpgsql set search_path = public as $$
declare v_w int := case when random() < .5 then 0 else 1 end; v_white jsonb; v_black jsonb; v_fen text := _chess_start();
begin
  -- g.matchup = [teamA, teamB] from THE DRAW (app_start checked they're in the room); colours and the order inside
  -- each team are drawn here. Checked again: app_start's own check lets a missing teams key through (null <> 'array'),
  -- and raising here rolls the whole start back.
  if coalesce(jsonb_typeof(g.matchup), '') <> 'array' then raise exception 'Draw two teams first'; end if;
  if jsonb_array_length(g.matchup) <> 2 then raise exception 'Draw two teams first'; end if;
  if exists (select 1 from jsonb_array_elements(g.matchup) t(side) where coalesce(jsonb_typeof(t.side), '') <> 'array') then
    raise exception 'Draw two teams first';
  end if;
  if exists (select 1 from jsonb_array_elements(g.matchup) t(side) where jsonb_array_length(t.side) = 0) then
    raise exception 'Draw two teams first';
  end if;
  v_white := (select jsonb_agg(x order by random()) from jsonb_array_elements(g.matchup -> v_w) x);
  v_black := (select jsonb_agg(x order by random()) from jsonb_array_elements(g.matchup -> (1 - v_w)) x);
  update games set
    app_secret = jsonb_build_object('history', '[]'::jsonb),
    app_state = jsonb_build_object(
      'phase', 'intro', 'until', now() + interval '15 seconds',
      'white', v_white, 'black', v_black,
      'fen', v_fen, 'legal', to_jsonb(_chess_moves(v_fen)), 'turn', 'w',
      'idx', jsonb_build_object('w', 0, 'b', 0),          -- who plays each side's next move (an index into its team)
      'mover', v_white -> 0,
      'team_ms', 600000, 'move_ms', 30000, 'clock', jsonb_build_object('w', 600000, 'b', 600000), 'turn_at', null,
      'ply', 0, 'moves', '[]'::jsonb, 'check', false, 'material', _chess_material(v_fen), 'touch', null, 'result', null)
   where id = g.id;
end $$;

-- the clocks start: white's first player is on the move
create or replace function public._ttc_begin(p_game uuid) returns void language plpgsql set search_path = public as $$
declare st jsonb;
begin
  select app_state into st from games where id = p_game for update;
  st := st || jsonb_build_object('phase', 'play', 'turn_at', now(), 'touch', null);
  update games set app_state = st || jsonb_build_object('until', _ttc_deadline(st)) where id = p_game;
end $$;

-- the end of the game (the board stays up, held 20 s): checkmate / flag (p_winner wins, the other team loses), a draw
-- or the host's stop (nobody). A clock that was running stops where it is.
create or replace function public._ttc_end(p_game uuid, p_kind text, p_winner text) returns void language plpgsql set search_path = public as $$
declare st jsonb; v_side text; v_left bigint;
begin
  select app_state into st from games where id = p_game for update;
  v_side := st ->> 'turn';
  if st ->> 'phase' = 'play' and st ->> 'turn_at' is not null then
    v_left := greatest(0, (st -> 'clock' ->> v_side)::bigint
                          - (extract(epoch from now() - (st ->> 'turn_at')::timestamptz) * 1000)::bigint);
    if p_kind = 'flag' then v_left := 0; end if;
    st := jsonb_set(st, array['clock', v_side], to_jsonb(v_left));
  end if;
  update games set app_state = st || jsonb_build_object(
      'phase', 'end', 'until', now() + interval '20 seconds', 'mover', null, 'touch', null,
      'result', jsonb_build_object('kind', p_kind, 'winner', p_winner,
                                   'losers', case when p_winner is null then '[]'::jsonb else _ttc_roster(st, _ttc_other(p_winner)) end))
   where id = p_game;
end $$;

-- play a move (already checked against the legal list): the clock, the next player of each team, the new position
-- and its legal moves (worked out once, here), and whether that's the end
create or replace function public._ttc_play(p_game uuid, p_uci text, p_auto boolean) returns void language plpgsql set search_path = public as $$
declare
  g games; st jsonb; v_side text; v_other text; v_fen text; v_new text; v_desc jsonb; v_legal text[]; v_hist jsonb;
  v_clock bigint; v_used bigint; v_idx int; v_moves jsonb; v_status text;
begin
  select * into g from games where id = p_game for update;
  st := g.app_state;
  v_side := st ->> 'turn'; v_other := _ttc_other(v_side); v_fen := st ->> 'fen';
  v_desc := _chess_describe(v_fen, p_uci);                 -- once per move (it's the expensive one)
  v_new := _chess_play(v_fen, p_uci);
  v_legal := _chess_moves(v_new);
  -- the time this turn took; a move in the 2-second grace counts as made on the deadline, a random move as 30 s
  v_clock := (st -> 'clock' ->> v_side)::bigint;
  v_used := case when p_auto then (st ->> 'move_ms')::bigint
                 else (extract(epoch from now() - (st ->> 'turn_at')::timestamptz) * 1000)::bigint end;
  v_used := greatest(0, least(v_used, (st ->> 'move_ms')::bigint, v_clock));
  -- the earlier positions for threefold: a capture or a pawn move (halfmove clock 0) means none can recur
  v_hist := case when split_part(v_new, ' ', 5) = '0' then '[]'::jsonb
                 else coalesce(g.app_secret -> 'history', '[]'::jsonb) || to_jsonb(v_fen) end;
  -- this team's next player; the move list keeps the last 8 (ply counts them all)
  v_idx := ((st -> 'idx' ->> v_side)::int + 1) % jsonb_array_length(_ttc_roster(st, v_side));
  v_moves := coalesce(st -> 'moves', '[]'::jsonb) || (v_desc || jsonb_build_object(
               'ply', (st ->> 'ply')::int + 1, 'side', v_side, 'by', st -> 'mover', 'uci', p_uci, 'auto', p_auto));
  while jsonb_array_length(v_moves) > 8 loop v_moves := v_moves - 0; end loop;
  st := st || jsonb_build_object(
    'fen', v_new, 'legal', to_jsonb(v_legal), 'turn', v_other,
    'idx', jsonb_set(st -> 'idx', array[v_side], to_jsonb(v_idx)),
    'mover', _ttc_roster(st, v_other) -> (st -> 'idx' ->> v_other)::int,
    'clock', jsonb_set(st -> 'clock', array[v_side], to_jsonb(v_clock - v_used)),
    'turn_at', now(), 'ply', (st ->> 'ply')::int + 1, 'moves', v_moves,
    'check', coalesce((v_desc ->> 'check')::boolean, false), 'material', _chess_material(v_new), 'touch', null);
  st := st || jsonb_build_object('until', _ttc_deadline(st));
  update games set app_state = st, app_secret = coalesce(app_secret, '{}'::jsonb) || jsonb_build_object('history', v_hist) where id = p_game;

  v_status := case when cardinality(v_legal) = 0 then (case when (v_desc ->> 'check')::boolean then 'checkmate' else 'stalemate' end)
                   else _chess_status(v_new, array(select jsonb_array_elements_text(v_hist))) end;
  if v_status = 'checkmate' then perform _ttc_end(p_game, 'checkmate', v_side);
  elsif v_status <> 'play' then perform _ttc_end(p_game, v_status, null);
  end if;
end $$;

create or replace function public._ttc_move(g games, me players, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare st jsonb; v_side text; v_uci text; v_sq text;
begin
  select * into g from games where id = g.id for update;  -- one at a time with the tick's random move: re-read, re-check
  st := g.app_state;
  v_side := case when st -> 'white' ? me.id::text then 'w' when st -> 'black' ? me.id::text then 'b' end;
  if v_side is null then raise exception 'You''re not in this game'; end if;
  if st ->> 'phase' = 'intro' then raise exception 'The clocks haven''t started yet'; end if;
  if st ->> 'phase' <> 'play' then raise exception 'The game is over'; end if;
  if a ? 'ply' and (a ->> 'ply') is distinct from (st ->> 'ply') then raise exception 'Too late: the board has moved on'; end if;
  if st ->> 'turn' <> v_side then
    raise exception 'It''s %''s move', case st ->> 'turn' when 'w' then 'white' else 'black' end;
  end if;
  if st ->> 'mover' <> me.id::text then
    raise exception 'It''s %''s move', coalesce((select name from players where id = (st ->> 'mover')::uuid), 'someone else');
  end if;
  if now() > _ttc_deadline(st) + interval '2 seconds' then raise exception 'Too late: time ran out'; end if;

  if a ? 'touch' and not a ? 'uci' then                   -- the piece you're thinking about, for the TV (or none)
    v_sq := lower(a ->> 'touch');
    if v_sq is not null and not exists (select 1 from jsonb_array_elements_text(st -> 'legal') m where left(m, 2) = v_sq) then
      v_sq := null;
    end if;
    if (st ->> 'touch') is not distinct from v_sq then return '{"ok":true,"no_touch":true}'::jsonb; end if;
    update games set app_state = app_state || jsonb_build_object('touch', v_sq) where id = g.id;
    return '{"ok":true}'::jsonb;
  end if;

  v_uci := lower(btrim(coalesce(a ->> 'uci', '')));
  if not (st -> 'legal' ? v_uci) then
    if length(v_uci) = 4 and st -> 'legal' ? (v_uci || 'q') then v_uci := v_uci || 'q';   -- 'e7e8' is a queen
    else raise exception 'Illegal move'; end if;
  end if;
  perform _ttc_play(g.id, v_uci, false);
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._ttc_host(g games, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare v_ph text;
begin
  select * into g from games where id = g.id for update;
  v_ph := g.app_state ->> 'phase';
  case a ->> 'op'
  when 'next' then                                   -- START NOW (the intro) / CONTINUE (the result)
    if v_ph = 'intro' then perform _ttc_begin(g.id);
    elsif v_ph = 'end' then perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'result' -> 'losers'))::uuid[]);
    else raise exception 'The game is on. END GAME stops it';
    end if;
  when 'stop' then                                   -- END GAME: a draw, nobody loses (on the result: it stands)
    if v_ph = 'end' then perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'result' -> 'losers'))::uuid[]);
    else perform _ttc_end(g.id, 'stopped', null);
    end if;
  else raise exception 'Unknown key';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._ttc_tick(g games) returns boolean language plpgsql set search_path = public as $$
declare st jsonb; v_side text; v_uci text;
begin
  select * into g from games where id = g.id for update;
  st := g.app_state;
  if st ->> 'phase' = 'intro' then
    if now() < (st ->> 'until')::timestamptz then return false; end if;
    perform _ttc_begin(g.id);
  elsif st ->> 'phase' = 'end' then
    if now() < (st ->> 'until')::timestamptz then return false; end if;
    perform _app_finish(g.id, array(select jsonb_array_elements_text(st -> 'result' -> 'losers'))::uuid[]);
  else
    -- nothing until 2 s past the deadline: a move sent in time may still be on its way
    if now() < _ttc_deadline(st) + interval '2 seconds' then return false; end if;
    v_side := st ->> 'turn';
    if (st -> 'clock' ->> v_side)::bigint <= (st ->> 'move_ms')::bigint then
      perform _ttc_end(g.id, 'flag', _ttc_other(v_side));          -- the team's clock ran out first: they lose on time
    else
      v_uci := _chess_random(st ->> 'fen');                         -- 30 seconds up: a random legal move for them
      if v_uci is null then perform _ttc_end(g.id, 'stalemate', null);
      else perform _ttc_play(g.id, v_uci, true);
      end if;
    end if;
  end if;
  return true;
end $$;

-- everything is public (chess has no secrets); a phone in the game also gets its side and how soon its turn comes:
-- next_up_in = how many moves (both sides') until it's yours, 0 = it's yours now
create or replace function public._ttc_view(g games, me players, v_host boolean) returns jsonb language plpgsql stable set search_path = public as $$
declare st jsonb := g.app_state; v_side text; v_ros jsonb; v_i int; v_n int; v_k int;
begin
  if me.id is not null and not v_host then
    v_side := case when st -> 'white' ? me.id::text then 'w' when st -> 'black' ? me.id::text then 'b' end;
  end if;
  if v_side is null then return st || jsonb_build_object('mine', null); end if;
  v_ros := _ttc_roster(st, v_side);
  v_n := jsonb_array_length(v_ros);
  select o.n - 1 into v_i from jsonb_array_elements_text(v_ros) with ordinality as o(id, n) where o.id = me.id::text;
  v_k := ((v_i - (st -> 'idx' ->> v_side)::int) % v_n + v_n) % v_n;     -- this team's moves before mine
  return st || jsonb_build_object('mine', jsonb_build_object(
    'side', v_side,
    'my_turn', st ->> 'phase' = 'play' and st ->> 'mover' = me.id::text,
    'next_up_in', 2 * v_k + case when st ->> 'turn' = v_side then 0 else 1 end));
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
