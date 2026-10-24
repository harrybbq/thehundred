-- =====================================================================
-- ODD ONE OUT (an app game, about 9 minutes, everyone): 3 rounds. Each round every phone gets the same very famous
-- name, except one: the odd one out's phone only says they're the odd one out. In a random order (the odd one out
-- can go first) everyone says up to 3 words about the name, out loud, 20 seconds each (the speaker's DONE moves it
-- on). Then everyone votes for who they think the odd one out is (never themselves); the vote waits for everyone
-- (the host can end it).
--   Caught (the most votes; a tie that includes them counts): one guess at the name, out loud, and the host judges
--     it on the TV. Wrong: the odd one out loses the round. Right: they pick who loses it instead (anyone else in
--     the game but the Angel).
--   Not caught: whoever the room voted out loses the round (a tie: all of them; nobody voted: nobody).
-- A new name and a new odd one out every round, at random (never by role), and nobody is the odd one out twice in a
-- game until everyone has had a go. The Angel plays but is never the odd one out and never loses a round. At the end
-- every round's losers go in the punishment queue, once for every round they lost.
--
-- Secrets: the name and the odd one out live in app_secret until that round's reveal (caught: the odd one out, then
-- the name at REVEAL THE NAME; not caught: both at once). A phone's `mine` holds only its own card ({famous} or
-- {odd: true}) and its own vote. The ballots never come out: who has voted while it's open, the counts once it closes.
--
-- The board (app_state.phase), each with the deadline the ticks drive:
--   intro    the rules while everyone taps I'M IN (60s, or everyone in, or START ANYWAY)
--   card     a new round: everyone holds to read their card and taps I'VE READ IT (40s, or everyone read)
--   clues    one speaker at a time in a random order, 20s each (DONE or the host's SKIP moves it on)
--   vote     everyone votes on their phone (waits for everyone; END VOTING NOW; a 5 minute backstop)
--   caught   the odd one out is named and says their guess; REVEAL THE NAME once they have (the host only, no
--            deadline: a clock could put the name up before the guess)
--   answer   the name is on the TV: THEY GOT IT / THEY DIDN'T (the host only, no deadline)
--   pick     they named it: they pick who loses the round (45s, then it's picked at random)
--   result   who loses this round (15s, or NEXT ROUND)
--   final    CASE CLOSED: every round, and who goes in the queue (25s, or CONTINUE)
-- Every move of the board bumps app_state.step; the host's keys send the step they were pressed on, so a double tap
-- (or a key pressed on a board that has already moved on) does nothing.
-- =====================================================================

-- the famous people: names everyone at the party will know
create or replace function public._odd_bank() returns jsonb language sql immutable set search_path = public as $$
  select '[
    "David Beckham", "Taylor Swift", "Ed Sheeran", "Adele", "Harry Styles", "Beyonce", "Rihanna", "Lady Gaga",
    "Elton John", "Freddie Mercury", "Madonna", "Elvis Presley", "Dua Lipa", "Stormzy", "Justin Bieber",
    "Britney Spears", "Robbie Williams", "Lewis Capaldi", "Shakira", "Ariana Grande", "Billie Eilish", "Snoop Dogg",
    "Eminem", "David Bowie", "Paul McCartney", "Mick Jagger", "Kylie Minogue", "Cristiano Ronaldo", "Lionel Messi",
    "Wayne Rooney", "Harry Kane", "Marcus Rashford", "Mo Salah", "Peter Crouch", "Gary Lineker", "Erling Haaland",
    "Usain Bolt", "Serena Williams", "Lewis Hamilton", "Andy Murray", "Tyson Fury", "Muhammad Ali", "Michael Jordan",
    "Tom Cruise", "Leonardo DiCaprio", "Brad Pitt", "Keanu Reeves", "The Rock", "Daniel Radcliffe", "Emma Watson",
    "Tom Holland", "Margot Robbie", "Ryan Reynolds", "Jim Carrey", "Mr Bean", "Gordon Ramsay", "David Attenborough",
    "Simon Cowell", "Jeremy Clarkson", "Jamie Oliver", "Kim Kardashian", "Morgan Freeman", "Jackie Chan",
    "Idris Elba", "The Queen", "King Charles", "Prince Harry", "Prince William", "Princess Diana",
    "Winston Churchill", "Albert Einstein", "William Shakespeare", "Napoleon", "Henry VIII", "Isaac Newton",
    "Cleopatra", "Julius Caesar", "Leonardo da Vinci", "Charles Darwin", "Neil Armstrong", "Nelson Mandela",
    "Barack Obama", "Steve Jobs", "Bill Gates", "Oprah Winfrey", "Santa Claus", "Shrek", "Homer Simpson",
    "Mickey Mouse", "SpongeBob", "Harry Potter", "James Bond", "Sherlock Holmes", "Darth Vader", "Batman",
    "Spider-Man", "Super Mario", "Pikachu", "Peppa Pig", "Scooby-Doo", "Paddington Bear", "Winnie the Pooh",
    "Gandalf", "Yoda"
  ]'::jsonb
$$;

-- move the board: patch app_state and bump its step (the caller holds the game's row lock)
create or replace function public._odd_set(p_game uuid, p_patch jsonb) returns void language sql set search_path = public as $$
  update games set app_state = app_state || p_patch || jsonb_build_object('step', coalesce((app_state ->> 'step')::int, 0) + 1)
   where id = p_game
$$;

create or replace function public._odd_angel(p_player uuid) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from players where id = p_player and public_role = 'angel')
$$;

-- who the odd one out may hand the round to: anyone else in the game, but not the Angel or anyone in the Locker now
create or replace function public._odd_targets(g games, p_odd uuid) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(p.id order by p.seat), '{}') from players p
   where p.id = any (_app_roster(g)) and p.id <> p_odd and p.public_role is distinct from 'angel' and coalesce(p.locked_until <= now(), true)
$$;

-- every round's losers in order, once for each round they lost (the Angel never)
create or replace function public._odd_losses(g games) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(l.v::uuid order by r.i, l.j), '{}')
    from jsonb_array_elements(coalesce(g.app_state -> 'rounds', '[]')) with ordinality as r(x, i),
         jsonb_array_elements_text(coalesce(r.x -> 'losers', '[]')) with ordinality as l(v, j)
   where not _odd_angel(l.v::uuid)
$$;

-- the next round onto the board: a fresh name, a fresh odd one out (or, after the last round, CASE CLOSED)
create or replace function public._odd_round(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; st jsonb; sec jsonb; v_names jsonb; v_used jsonb; v_name text; v_pool uuid[]; v_done uuid[]; v_odd uuid;
begin
  select * into g from games where id = p_game for update;
  st := g.app_state; sec := coalesce(g.app_secret, '{}');
  if (st ->> 'n')::int >= (st ->> 'of')::int then perform _odd_final(g.id); return; end if;
  -- a name this room hasn't had (this game's, then every earlier Odd One Out); once they're all used, just not this game's
  v_names := coalesce(sec -> 'names', '[]');
  v_used := v_names || coalesce((select jsonb_agg(r.x ->> 'famous') from games og, jsonb_array_elements(coalesce(og.app_state -> 'rounds', '[]')) as r(x)
                                  where og.room_id = g.room_id and og.app = 'odd' and og.id <> g.id), '[]');
  select b.n into v_name from jsonb_array_elements_text(_odd_bank()) as b(n) where not (v_used ? b.n) order by random() limit 1;
  if v_name is null then
    select b.n into v_name from jsonb_array_elements_text(_odd_bank()) as b(n) where not (v_names ? b.n) order by random() limit 1;
  end if;
  -- the odd one out: anyone playing but the Angel, at random; nobody twice until everyone has had a go
  v_pool := array(select p.id from players p where p.id = any (_app_roster(g)) and p.public_role is distinct from 'angel');
  v_done := array(select x::uuid from jsonb_array_elements_text(coalesce(sec -> 'used_odd', '[]')) as t(x));
  if not exists (select 1 from unnest(v_pool) u where not (u = any (v_done))) then v_done := '{}'; end if;
  select u into v_odd from unnest(v_pool) u where not (u = any (v_done)) order by random() limit 1;
  if v_odd is null or v_name is null then perform _odd_final(g.id); return; end if;   -- (can't happen with 3 players)
  update games set app_secret = jsonb_build_object('famous', v_name, 'odd', v_odd, 'votes', '{}'::jsonb,
                                                   'used_odd', to_jsonb(v_done || v_odd), 'names', v_names || to_jsonb(v_name))
   where id = g.id;
  perform _odd_set(g.id, jsonb_build_object('phase', 'card', 'until', now() + interval '40 seconds', 'n', (st ->> 'n')::int + 1,
                                            'here', '[]'::jsonb, 'read', '[]'::jsonb, 'order', '[]'::jsonb, 'turn', 0,
                                            'voted', '[]'::jsonb, 'last', null));
end $$;

-- the clues: everyone in a random order (no head start: the odd one out can be first)
create or replace function public._odd_clues(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_set(g.id, jsonb_build_object('phase', 'clues', 'until', now() + interval '20 seconds', 'turn', 0,
                                            'order', (select jsonb_agg(u::text order by random()) from unnest(_app_roster(g)) u)));
end $$;

-- the next speaker, or (after the last one) the vote
create or replace function public._odd_turn(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; v_t int;
begin
  select * into g from games where id = p_game for update;
  v_t := (g.app_state ->> 'turn')::int + 1;
  if v_t >= jsonb_array_length(coalesce(g.app_state -> 'order', '[]')) then
    perform _odd_set(g.id, jsonb_build_object('phase', 'vote', 'until', now() + interval '5 minutes', 'voted', '[]'::jsonb));
  else
    perform _odd_set(g.id, jsonb_build_object('turn', v_t, 'until', now() + interval '20 seconds'));
  end if;
end $$;

-- the round is settled: on the board, and into the record for CASE CLOSED
create or replace function public._odd_result(p_game uuid, p_last jsonb) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_set(g.id, jsonb_build_object('phase', 'result', 'until', now() + interval '15 seconds', 'last', p_last,
    'rounds', coalesce(g.app_state -> 'rounds', '[]') || jsonb_build_array(jsonb_build_object(
      'n', (g.app_state ->> 'n')::int, 'famous', p_last -> 'famous', 'odd', p_last -> 'odd', 'outcome', p_last -> 'outcome',
      'accused', p_last -> 'tops', 'picked', p_last -> 'picked', 'losers', p_last -> 'losers'))));
end $$;

-- how many of these player ids (a jsonb array) are still in the game
create or replace function public._odd_in(g games, p_ids jsonb) returns int language sql stable set search_path = public as $$
  select count(*)::int from jsonb_array_elements_text(coalesce(p_ids, '[]')) x(id) where x.id::uuid = any (_app_roster(g))
$$;

-- the vote closes: the counts come out (never the ballots); caught, or the room got it wrong
create or replace function public._odd_close(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; sec jsonb; v_odd uuid; v_counts jsonb; v_max int; v_total int; v_tops uuid[]; v_last jsonb;
begin
  select * into g from games where id = p_game for update;
  sec := g.app_secret; v_odd := (sec ->> 'odd')::uuid;
  if not (v_odd = any (_app_roster(g))) then          -- the odd one out was kicked mid-round: nobody loses this one
    perform _odd_result(g.id, jsonb_build_object('odd', v_odd, 'counts', '{}'::jsonb, 'tops', '[]'::jsonb, 'total', 0,
                                                 'famous', sec ->> 'famous', 'outcome', 'escaped', 'losers', '[]'::jsonb));
    return;
  end if;
  select coalesce(jsonb_object_agg(q.t, q.c), '{}'::jsonb), coalesce(max(q.c), 0), coalesce(sum(q.c), 0)::int into v_counts, v_max, v_total
    from (select value as t, count(*)::int as c from jsonb_each_text(coalesce(sec -> 'votes', '{}')) group by value) q;
  v_tops := array(select p.id from players p where p.id = any (_app_roster(g)) and v_max > 0 and (v_counts ->> p.id::text)::int = v_max order by p.seat);
  v_last := jsonb_build_object('odd', v_odd, 'counts', v_counts, 'tops', to_jsonb(v_tops), 'total', v_total);
  if v_odd = any (v_tops) then
    -- caught (a tie that includes them counts): the odd one out comes out now; the name waits for their guess, and
    -- only the host knows when that's been said (no deadline: the name never goes up before the guess)
    perform _odd_set(g.id, jsonb_build_object('phase', 'caught', 'until', null, 'last', v_last));
  else
    -- got away with it: whoever the room voted out loses the round (all of them on a tie; nobody voted, nobody)
    perform _odd_result(g.id, v_last || jsonb_build_object('famous', sec ->> 'famous', 'outcome', 'escaped',
      'losers', to_jsonb(array(select u from unnest(v_tops) with ordinality as t(u, k) where not _odd_angel(u) order by k))));
  end if;
end $$;

-- REVEAL THE NAME: after the odd one out's guess, the name goes up for the host to judge
create or replace function public._odd_reveal(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_set(g.id, jsonb_build_object('phase', 'answer', 'until', null,
                                            'last', coalesce(g.app_state -> 'last', '{}') || jsonb_build_object('famous', g.app_secret ->> 'famous')));
end $$;

-- THEY GOT IT / THEY DIDN'T
create or replace function public._odd_judge(p_game uuid, p_right boolean) returns void language plpgsql set search_path = public as $$
declare g games; v_last jsonb;
begin
  select * into g from games where id = p_game for update;
  v_last := coalesce(g.app_state -> 'last', '{}') || jsonb_build_object('right', p_right);
  if p_right then
    perform _odd_set(g.id, jsonb_build_object('phase', 'pick', 'until', now() + interval '45 seconds', 'last', v_last));
  else
    perform _odd_result(g.id, v_last || jsonb_build_object('outcome', 'wrong', 'losers', jsonb_build_array(v_last -> 'odd')));
  end if;
end $$;

-- they named it: the one they picked loses the round (p_random: they didn't pick in time)
create or replace function public._odd_pick(p_game uuid, p_target uuid, p_random boolean) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_result(g.id, coalesce(g.app_state -> 'last', '{}') || jsonb_build_object('outcome', 'named', 'picked', p_target, 'random', p_random,
    'losers', case when p_target is null then '[]'::jsonb else jsonb_build_array(p_target) end));
end $$;

-- CASE CLOSED: the rounds played (an unfinished round doesn't count)
create or replace function public._odd_final(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; v_all uuid[];
begin
  select * into g from games where id = p_game for update;
  v_all := _odd_losses(g);
  perform _odd_set(g.id, jsonb_build_object('phase', 'final', 'until', now() + interval '25 seconds',
    'losers', to_jsonb(array(select u from (select distinct on (u) u, k from unnest(v_all) with ordinality as t(u, k) order by u, k) d order by d.k)),
    'losses', coalesce((select jsonb_object_agg(u, c) from (select u::text, count(*)::int as c from unnest(v_all) u group by u) q), '{}'::jsonb)));
end $$;

-- over: the usual GAME OVER (once per loser), then one more queue row for every extra round someone lost
create or replace function public._odd_finish(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; v_all uuid[]; v_once uuid[];
begin
  select * into g from games where id = p_game for update;
  if g.id is null or g.status <> 'active' then return; end if;
  v_all := _odd_losses(g);
  v_once := array(select u from (select distinct on (u) u, k from unnest(v_all) with ordinality as t(u, k) order by u, k) d order by d.k);
  perform _app_finish(g.id, v_once);
  if (select status from games where id = g.id) = 'ended' then
    insert into queue (room_id, player_id, reason)
    select g.room_id, x.u, 'Lost Odd One Out'
      from (select t.u, min(t.k) as k, count(*) as c from unnest(v_all) with ordinality as t(u, k) group by t.u) x,
           generate_series(2, x.c::int) as s(i)
     where not _odd_angel(x.u)
     order by x.k, s.i;
  end if;
end $$;

create or replace function public._odd_init(g games, a jsonb) returns void language plpgsql set search_path = public as $$
begin
  update games set
    app_secret = jsonb_build_object('votes', '{}'::jsonb, 'used_odd', '[]'::jsonb, 'names', '[]'::jsonb),
    app_state = jsonb_build_object('phase', 'intro', 'until', now() + interval '60 seconds', 'step', 0, 'n', 0, 'of', 3,
                                   'here', '[]'::jsonb, 'read', '[]'::jsonb, 'order', '[]'::jsonb, 'turn', 0, 'voted', '[]'::jsonb,
                                   'last', null, 'rounds', '[]'::jsonb)
   where id = g.id;
end $$;

-- a player's move: {op: 'here'} I'M IN ; {op: 'read'} I'VE READ IT ; {op: 'done', turn} DONE (the speaker only) ;
-- {op: 'vote', player_id} ; {op: 'pick', player_id} (the odd one out, once they've named it)
create or replace function public._odd_move(g games, me players, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare st jsonb := g.app_state; sec jsonb := coalesce(g.app_secret, '{}'); v_ph text := g.app_state ->> 'phase'; v_t uuid; v_late boolean;
        quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
begin
  v_late := (st ->> 'until') is not null and now() > (st ->> 'until')::timestamptz + interval '2 seconds';
  begin v_t := (a ->> 'player_id')::uuid; exception when others then v_t := null; end;
  case a ->> 'op'
  when 'here' then                                   -- I'M IN (the rules): everyone in, the first round starts
    if v_ph <> 'intro' then return quiet; end if;
    if not (st -> 'here' ? me.id::text) then
      update games set app_state = jsonb_set(app_state, '{here}', (app_state -> 'here') || to_jsonb(me.id::text)) where id = g.id returning * into g;
    end if;
    if _odd_in(g, g.app_state -> 'here') >= cardinality(_app_roster(g)) then perform _odd_round(g.id); end if;
  when 'read' then                                   -- I'VE READ IT: everyone has, the clues start
    if v_ph <> 'card' then return quiet; end if;
    if not (st -> 'read' ? me.id::text) then
      update games set app_state = jsonb_set(app_state, '{read}', (app_state -> 'read') || to_jsonb(me.id::text)) where id = g.id returning * into g;
    end if;
    if _odd_in(g, g.app_state -> 'read') >= cardinality(_app_roster(g)) then perform _odd_clues(g.id); end if;
  when 'done' then                                   -- DONE: only the speaker, only on their own turn
    -- a DONE that crossed with the clock (the turn or the clues already moved on): nothing to do, nothing to say
    if a ? 'turn' and (v_ph <> 'clues' or (a ->> 'turn') is distinct from (st ->> 'turn')) then return quiet; end if;
    if v_ph <> 'clues' then raise exception 'The clues are over'; end if;
    if (st -> 'order' ->> (st ->> 'turn')::int) is distinct from me.id::text
       or (a ? 'turn' and (a ->> 'turn') is distinct from (st ->> 'turn')) then
      raise exception 'It''s not your turn';
    end if;
    perform _odd_turn(g.id);
  when 'vote' then
    if v_ph <> 'vote' or v_late then raise exception 'Too late: the vote has closed'; end if;
    if v_t is null or not (v_t = any (_app_roster(g))) then raise exception 'Pick someone in the game'; end if;
    if v_t = me.id then raise exception 'You can''t vote for yourself'; end if;
    if sec -> 'votes' ? me.id::text then raise exception 'You already voted'; end if;
    update games set app_secret = jsonb_set(app_secret, '{votes}', coalesce(app_secret -> 'votes', '{}') || jsonb_build_object(me.id::text, v_t)),
                     app_state = jsonb_set(app_state, '{voted}', (app_state -> 'voted') || to_jsonb(me.id::text))
     where id = g.id returning * into g;
    -- everyone's in: no need to wait
    if _odd_in(g, g.app_state -> 'voted') >= cardinality(_app_roster(g)) then perform _odd_close(g.id); end if;
  when 'pick' then
    if v_ph <> 'pick' or v_late then raise exception 'Too late to pick'; end if;
    if (sec ->> 'odd') is distinct from me.id::text then raise exception 'Only the odd one out picks'; end if;
    if v_t is null or not (v_t = any (_odd_targets(g, me.id))) then raise exception 'Pick someone else in the game (not the Angel)'; end if;
    perform _odd_pick(g.id, v_t, false);
  else raise exception 'Unknown move';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

-- the host's keys: {op: 'next', step} moves the board on (START ANYWAY, START THE CLUES, SKIP, END VOTING NOW,
-- REVEAL THE NAME, NEXT ROUND, CONTINUE) ; {op: 'judge', right, step} THEY GOT IT / THEY DIDN'T ; {op: 'stop'}
create or replace function public._odd_host(g games, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare v_ph text := g.app_state ->> 'phase';
begin
  -- a doubled tap, or a key pressed on a board that has already moved on: nothing
  if a ? 'step' and (a ->> 'step') is distinct from (g.app_state ->> 'step') then return '{"ok":true,"no_touch":true}'::jsonb; end if;
  case a ->> 'op'
  when 'next' then
    if v_ph in ('intro', 'result') then perform _odd_round(g.id);
    elsif v_ph = 'card' then perform _odd_clues(g.id);
    elsif v_ph = 'clues' then perform _odd_turn(g.id);
    elsif v_ph = 'vote' then perform _odd_close(g.id);
    elsif v_ph = 'caught' then perform _odd_reveal(g.id);
    elsif v_ph = 'final' then perform _odd_finish(g.id);
    elsif v_ph = 'answer' then raise exception 'Did they get it? Tap THEY GOT IT or THEY DIDN''T';
    else raise exception 'The odd one out is picking';
    end if;
  when 'judge' then
    if v_ph <> 'answer' then raise exception 'Nothing to judge'; end if;
    if jsonb_typeof(a -> 'right') is distinct from 'boolean' then raise exception 'Did they get it?'; end if;
    perform _odd_judge(g.id, (a ->> 'right')::boolean);
  when 'stop' then                                   -- end it now: the rounds played so far decide (the open one doesn't count)
    if v_ph = 'final' then perform _odd_finish(g.id); else perform _odd_final(g.id); end if;
  else raise exception 'Unknown key';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._odd_tick(g games) returns boolean language plpgsql set search_path = public as $$
declare v_ph text := g.app_state ->> 'phase';
begin
  -- (REVEAL THE NAME and THEY GOT IT / THEY DIDN'T are the host's alone: a null until never moves on by itself)
  -- in the vote and the pick a phone gets 2 seconds' grace after the deadline (_odd_move): the tick waits it out, so a
  -- pick sent in time is never beaten by the random one
  if (g.app_state ->> 'until') is null
     or now() < (g.app_state ->> 'until')::timestamptz + (case when v_ph in ('vote', 'pick') then interval '2 seconds' else interval '0' end) then
    return false;
  end if;
  if v_ph in ('intro', 'result') then perform _odd_round(g.id);
  elsif v_ph = 'card' then perform _odd_clues(g.id);
  elsif v_ph = 'clues' then perform _odd_turn(g.id);
  elsif v_ph = 'vote' then perform _odd_close(g.id);
  elsif v_ph = 'pick' then                           -- they didn't pick in time: picked at random for them
    perform _odd_pick(g.id, (select u from unnest(_odd_targets(g, (g.app_secret ->> 'odd')::uuid)) u order by random() limit 1), true);
  elsif v_ph = 'final' then perform _odd_finish(g.id);
  else return false;
  end if;
  return true;
end $$;

-- the board is public as it stands (nothing secret is written to it before its reveal); a phone in the game also gets
-- its own card while the round is open, and its own vote
create or replace function public._odd_view(g games, me players, v_host boolean) returns jsonb language sql stable set search_path = public as $$
  select g.app_state
         || jsonb_build_object('mine', case when me.id is not null and not v_host and me.id = any (_app_roster(g)) then
              jsonb_strip_nulls(
                case when g.app_state ->> 'phase' in ('card', 'clues', 'vote', 'caught', 'answer', 'pick') then
                  case when g.app_secret ->> 'odd' = me.id::text then jsonb_build_object('odd', true)
                       else jsonb_build_object('famous', g.app_secret ->> 'famous') end
                else '{}'::jsonb end
                || jsonb_build_object('vote', g.app_secret -> 'votes' -> (me.id::text))) end)
$$;

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
