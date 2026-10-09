do $do$
declare d text;
begin
  d := pg_get_functiondef('_a_games(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position($h$      update rooms set tally = tally + 1 where id = r.id returning * into r;
      insert into beer_log (room_id, player_id) values (r.id, me.id);
      -- SKANK: each beer secretly counts double (triple from level 3); banked, added when time runs out
      if s.role = 'skank' and not s.burned and not me.rehab then
        update player_secrets set skank_bonus = skank_bonus + case when _plevel(v_cnt, r.id) >= 4 then 2 else 1 end where player_id = me.id;
$h$ in d) = 0 then raise exception 'hunk 0 missing _a_games'; end if;
  d := replace(d, $h$      update rooms set tally = tally + 1 where id = r.id returning * into r;
      insert into beer_log (room_id, player_id) values (r.id, me.id);
      -- SKANK: each beer secretly counts double (triple from level 3); banked, added when time runs out
      if s.role = 'skank' and not s.burned and not me.rehab then
        update player_secrets set skank_bonus = skank_bonus + case when _plevel(v_cnt, r.id) >= 4 then 2 else 1 end where player_id = me.id;
$h$, $h$      update rooms set tally = tally + 1 where id = r.id returning * into r;
      insert into beer_log (room_id, player_id) values (r.id, me.id);
      -- SKANK: each beer secretly counts double (triple from level 4); banked, added at the deadline
      if s.role = 'skank' and not s.burned and not me.rehab then
        update player_secrets set skank_bonus = skank_bonus + case when _plevel(v_cnt, r.id) >= 4 then 2 else 1 end where player_id = me.id;
$h$);
  if position($h$    select r.id, l.v, 'Lost ' || x.name from unnest(v_ids) with ordinality as l(v, n) order by l.n;
    perform _event(r.id, 'game_over', jsonb_build_object('game', x.id, 'name', x.name, 'losers', to_jsonb(v_ids)));
    -- After a game the TV shows: the Biggest Champ, then the Biggest Slacker, then the host starts the Trial.
    v_start := (select max(ended_at) from games where room_id = r.id and status = 'ended' and id <> x.id);
$h$ in d) = 0 then raise exception 'hunk 1 missing _a_games'; end if;
  d := replace(d, $h$    select r.id, l.v, 'Lost ' || x.name from unnest(v_ids) with ordinality as l(v, n) order by l.n;
    perform _event(r.id, 'game_over', jsonb_build_object('game', x.id, 'name', x.name, 'losers', to_jsonb(v_ids)));
    -- After a game the TV shows: the Biggest Champ, then the Biggest Slacker, then the host starts the Trial.
    v_start := (select max(ended_at) from games where room_id = r.id and status = 'ended' and id <> x.id);
$h$, $h$    select r.id, l.v, 'Lost ' || x.name from unnest(v_ids) with ordinality as l(v, n) order by l.n;
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
$h$);
  if position($h$    else
      perform _event(r.id, 'slacker', jsonb_build_object('game', x.id, 'players', '[]'::jsonb, 'beers', v_min));
    end if;
    -- this game lifts the level cap (games finished + 1), unless the cap is already off (2 hours before the deadline)
    v_int := _games_done(r.id) + 1;
    if v_int between 2 and 4 and now() < r.deadline_at - interval '2 hours' then
      perform _event(r.id, 'level_cap', jsonb_build_object('cap', v_int));
    end if;

$h$ in d) = 0 then raise exception 'hunk 2 missing _a_games'; end if;
  d := replace(d, $h$    else
      perform _event(r.id, 'slacker', jsonb_build_object('game', x.id, 'players', '[]'::jsonb, 'beers', v_min));
    end if;
    -- this game lifts the level cap (games finished + 1), unless the cap is already off (2 hours before the deadline)
    v_int := _games_done(r.id) + 1;
    if v_int between 2 and 4 and now() < r.deadline_at - interval '2 hours' then
      perform _event(r.id, 'level_cap', jsonb_build_object('cap', v_int));
    end if;

$h$, $h$    else
      perform _event(r.id, 'slacker', jsonb_build_object('game', x.id, 'players', '[]'::jsonb, 'beers', v_min));
    end if;

$h$);
  execute d;
end $do$;
