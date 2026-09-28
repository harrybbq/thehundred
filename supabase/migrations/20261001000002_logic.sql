-- =====================================================================
-- THE HUNDRED — game rules (server-authoritative)
--
--  get_state(code)            → what the CALLER may see (public + own secrets)
--  api_exec(uid, action, args)→ every mutation, validated here in one
--                                transaction with the room row locked.
--                                Only service_role may call it (via the
--                                `api` Edge Function, which supplies the
--                                verified user id).
-- =====================================================================

-- ---------- small helpers ----------
create or replace function public._default_segments() returns jsonb language sql immutable as $$
  select '["Finish your drink","Waterfall (you start)","30-second speech on a topic the room picks",
           "Wear the hat of shame for 30 mins","Sing a chorus the room picks",
           "Room writes a text from your phone (within reason)","Swap drinks with the person on your left",
           "Take the next person''s punishment","Safe","Spin again, doubled"]'::jsonb
$$;

create or replace function public._default_settings() returns jsonb language sql immutable as $$
  select '{"role_counts":{"intruder":1,"betrayer":1,"medic":1,"lovebird":1,"cursed":1,"jester":1,"drinker":4},
           "intruder_fake_heal":false,"jester_respin":true,"jester_swap":true,"jester_graffiti":true}'::jsonb
$$;

create or replace function public._norm_code(t text) returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public._rand_code(n int, alphabet text) returns text language plpgsql volatile as $$
declare s text := '';
begin
  for i in 1..n loop
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return s;
end $$;

create or replace function public._setting(r public.rooms, k text) returns boolean language sql immutable as $$
  select coalesce((r.settings ->> k)::boolean, (public._default_settings() ->> k)::boolean, false)
$$;

-- Bump the room version and ping everyone listening on the room channel.
-- The ping carries no data: clients re-fetch get_state(), which filters per user.
create or replace function public._touch(p_room uuid) returns void language plpgsql as $$
declare v bigint;
begin
  update public.rooms set version = version + 1 where id = p_room returning version into v;
  begin
    perform realtime.send(jsonb_build_object('v', v), 'changed', 'room:' || p_room::text, false);
  exception when others then null;  -- realtime unavailable: clients also poll
  end;
end $$;

create or replace function public._event(p_room uuid, p_kind text, p_payload jsonb) returns void language sql as $$
  insert into public.events (room_id, kind, payload) values (p_room, p_kind, coalesce(p_payload, '{}'::jsonb))
$$;

-- Current wheel: host segments + active Jester graffiti (flagged).
create or replace function public._wheel(p_room uuid) returns jsonb language sql stable as $$
  select coalesce((select jsonb_agg(jsonb_build_object('text', e.s, 'graffiti', false) order by e.n)
                     from public.rooms r cross join lateral jsonb_array_elements_text(r.segments) with ordinality as e(s, n)
                    where r.id = p_room), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('text', g.text, 'graffiti', true) order by g.created_at)
                     from public.graffiti g where g.room_id = p_room and g.active), '[]'::jsonb)
$$;

-- Server-side spin. Cursed = two spins. "Spin again" chains double (max 2 re-spins).
-- "Safe…" lands but logs nothing.
create or replace function public._landings(p_wheel jsonb, p_cursed boolean) returns jsonb language plpgsql volatile as $$
declare
  out   jsonb := '[]'::jsonb;
  n     int := jsonb_array_length(p_wheel);
  spins int := case when p_cursed then 2 else 1 end;
  depth int; mult int; idx int; t text; k text;
begin
  if n = 0 then raise exception 'The wheel is empty'; end if;
  for i in 1..spins loop
    mult := 1; depth := 0;
    loop
      idx := floor(random() * n)::int;
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

create or replace function public._landing_text(l jsonb) returns text language sql immutable as $$
  select (l ->> 'text') || case when (l ->> 'mult')::int > 1 then ' ×' || (l ->> 'mult') else '' end
$$;

create or replace function public._new_code(p_room uuid, p_role text, p_pair uuid) returns void language plpgsql as $$
declare c text;
begin
  loop
    c := public._rand_code(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    exit when not exists (select 1 from public.role_codes where code = c);
  end loop;
  insert into public.role_codes (room_id, code, role, pair_id, slot)
  values (p_room, c, p_role, p_pair, floor(random() * 1000000)::int);
end $$;

create or replace function public._cards(p_room uuid) returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', substr(code, 1, 3) || '-' || substr(code, 4, 3), 'role', role)
                            order by slot, code), '[]'::jsonb)
    from public.role_codes where room_id = p_room
$$;

create or replace function public._in_room(p_room uuid, p_player uuid) returns boolean language sql stable as $$
  select exists (select 1 from public.players where id = p_player and room_id = p_room)
$$;

-- =====================================================================
-- api_exec: every action
-- =====================================================================
create or replace function public.api_exec(p_uid uuid, p_action text, p_args jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a        jsonb := coalesce(p_args, '{}'::jsonb);
  v_anon   boolean;
  v_host   boolean;
  r        rooms;
  me       players;
  s        player_secrets;
  rd       rounds;
  res      jsonb := '{"ok":true}'::jsonb;
  v_touch  boolean := true;
  x        record;
  v_found  boolean;
  v_cursed boolean;
  v_id     uuid;
  v_id2    uuid;
  v_code   text;
  v_text   text;
  v_int    int;
  v_json   jsonb;
  v_land   jsonb;
  v_ids    uuid[];
  v_force  boolean := coalesce((a ->> 'force')::boolean, false);
begin
  if p_uid is null then raise exception 'Not signed in'; end if;
  select coalesce(u.is_anonymous, false) into v_anon from auth.users u where u.id = p_uid;
  if not found then raise exception 'Unknown user'; end if;

  -- ---------------- actions that don't need an existing room membership ----------------
  if p_action = 'create_room' then
    if v_anon then raise exception 'Host login required'; end if;
    loop
      v_code := _rand_code(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ');
      exit when not exists (select 1 from rooms where code = v_code);
    end loop;
    insert into rooms (code, host_id, deadline_at, segments, settings, target)
    values (v_code, p_uid,
            coalesce((a ->> 'deadline_at')::timestamptz, now() + interval '5 hours'),
            coalesce(a -> 'segments', _default_segments()),
            _default_settings() || coalesce(a -> 'settings', '{}'::jsonb),
            coalesce((a ->> 'target')::int, 100))
    returning * into r;
    return jsonb_build_object('room_id', r.id, 'code', r.code);

  elsif p_action = 'my_rooms' then
    if v_anon then raise exception 'Host login required'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object('id', ro.id, 'code', ro.code, 'created_at', ro.created_at,
                                   'players', (select count(*) from players p where p.room_id = ro.id)) order by ro.created_at desc)
                       from rooms ro where ro.host_id = p_uid), '[]'::jsonb);

  elsif p_action = 'join' then
    select * into r from rooms where code = upper(trim(a ->> 'code')) for update;
    if not found then raise exception 'No room with that code'; end if;
    v_text := left(regexp_replace(trim(coalesce(a ->> 'name', '')), '\s+', ' ', 'g'), 20);
    if v_text = '' then raise exception 'Enter your name'; end if;
    select * into me from players where room_id = r.id and user_id = p_uid;
    if found then
      update players set name = v_text, selfie_url = coalesce(nullif(a ->> 'selfie_url', ''), selfie_url) where id = me.id;
    else
      if exists (select 1 from players where room_id = r.id and lower(name) = lower(v_text)) then
        raise exception 'Someone already has that name — add an initial';
      end if;
      insert into players (room_id, user_id, name, selfie_url, seat)
      values (r.id, p_uid, v_text, nullif(a ->> 'selfie_url', ''),
              coalesce((select max(seat) from players where room_id = r.id), 0) + 1)
      returning * into me;
      perform _event(r.id, 'joined', jsonb_build_object('player', me.id));
    end if;
    perform _touch(r.id);
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'player_id', me.id);
  end if;

  -- ---------------- everything else acts on a room ----------------
  begin
    v_id := (a ->> 'room_id')::uuid;
  exception when others then raise exception 'Room not found';
  end;
  select * into r from rooms where id = v_id for update;   -- serialises all actions per room
  if not found then raise exception 'Room not found'; end if;
  v_host := (r.host_id = p_uid and not v_anon);
  select * into me from players where room_id = r.id and user_id = p_uid;
  if not v_host and me.id is null then raise exception 'Join the room first'; end if;
  select * into s from player_secrets where player_id = me.id;
  select * into rd from rounds where room_id = r.id and phase in ('waiting','spinning','revealed','saved')
   order by created_at desc limit 1;
  if a ? 'round_id' and (rd.id is null or rd.id <> (a ->> 'round_id')::uuid) then
    raise exception 'That punishment is already over';
  end if;

  -- host-only actions
  if p_action in ('update_settings','generate_cards','get_cards','start_game','finish_game','start_vote',
                  'queue_add','queue_remove','call_next','round_revealed','accept','finish_saved','cancel_round',
                  'decide_curse','remove_graffiti','expose','unexpose','reveal_all','kick')
     and not v_host then
    raise exception 'Only the host can do that';
  end if;
  -- player-only actions
  if p_action in ('redeem','heal','jester_swap','jester_respin','jester_graffiti','betrayer_guess',
                  'request_curse_pass','cast_vote') and me.id is null then
    raise exception 'Join the room first';
  end if;

  case p_action

  -- ======================= SETTINGS / CARDS =======================
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
    if a ? 'tally' then
      update rooms set tally = greatest(0, (a ->> 'tally')::int) where id = r.id;
    end if;

  when 'generate_cards' then
    if exists (select 1 from role_codes where room_id = r.id and redeemed_by is not null) then
      raise exception 'Someone has already redeemed a code, so the cards are locked. Create a new room to re-deal.';
    end if;
    v_json := coalesce(a -> 'role_counts', r.settings -> 'role_counts');
    delete from role_codes where room_id = r.id;
    for x in select key as role, greatest(0, least(40, (value #>> '{}')::int)) as n from jsonb_each(v_json) loop
      continue when x.role not in ('intruder','betrayer','medic','lovebird','cursed','jester','drinker');
      for i in 1..x.n loop
        if x.role = 'lovebird' then        -- lovebird count = number of PAIRS
          v_id := gen_random_uuid();
          perform _new_code(r.id, 'lovebird', v_id);
          perform _new_code(r.id, 'lovebird', v_id);
        else
          perform _new_code(r.id, x.role, null);
        end if;
      end loop;
    end loop;
    update rooms set settings = jsonb_set(settings, '{role_counts}', v_json) where id = r.id;
    res := jsonb_build_object('cards', _cards(r.id));

  when 'get_cards' then
    v_touch := false;
    res := jsonb_build_object('cards', _cards(r.id),
             'redeemed', (select count(*) from role_codes where room_id = r.id and redeemed_by is not null));

  -- ======================= ROLES =======================
  when 'redeem' then
    if s.player_id is not null then raise exception 'You already have a role'; end if;
    select * into x from role_codes
     where room_id = r.id and code = _norm_code(a ->> 'code') and redeemed_by is null for update;
    if not found then raise exception 'That code isn''t valid or has already been used'; end if;
    insert into player_secrets (player_id, room_id, role, pair_id, heals_left, fake_heals_left, guesses_left, respins_left)
    values (me.id, r.id, x.role, x.pair_id,
            case when x.role = 'medic'    then 2 else 0 end,
            case when x.role = 'intruder' then 1 else 0 end,
            case when x.role = 'betrayer' then 2 else 0 end,
            case when x.role = 'jester'   then 2 else 0 end);
    update role_codes set redeemed_by = me.id, redeemed_at = now() where id = x.id;
    update players set has_role = true, cursed = (cursed or x.role = 'cursed') where id = me.id;
    if x.role = 'lovebird' then
      select c.redeemed_by into v_id from role_codes c
       where c.pair_id = x.pair_id and c.id <> x.id and c.redeemed_by is not null;
      if v_id is not null then
        update player_secrets set partner_id = v_id  where player_id = me.id;
        update player_secrets set partner_id = me.id where player_id = v_id;
      end if;
    elsif x.role = 'cursed' then
      perform _event(r.id, 'cursed', jsonb_build_object('player', me.id));
    end if;
    res := jsonb_build_object('role', x.role);

  when 'expose' then
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    select role, partner_id into v_text, v_id2 from player_secrets where player_id = v_id;
    if v_text is null then
      v_text := a ->> 'role';     -- player never redeemed a code: host picks manually
      if v_text is null then raise exception 'NEEDS_ROLE'; end if;
      if v_text not in ('intruder','betrayer','medic','lovebird','cursed','jester','drinker') then
        raise exception 'Unknown role';
      end if;
    end if;
    update players set public_role = v_text where id = v_id;
    if v_text = 'lovebird' and v_id2 is not null then
      update players set public_role = 'lovebird', love_partner_id = v_id where id = v_id2;
      update players set love_partner_id = v_id2 where id = v_id;
    end if;
    perform _event(r.id, 'exposed', jsonb_build_object('player', v_id, 'role', v_text, 'partner', v_id2));
    res := jsonb_build_object('role', v_text);

  when 'unexpose' then
    v_id := (a ->> 'player_id')::uuid;
    update players set love_partner_id = null where room_id = r.id and love_partner_id = v_id;
    update players set public_role = null, love_partner_id = null where id = v_id and room_id = r.id;

  when 'reveal_all' then
    for x in select p.id, ps.role, ps.partner_id from players p join player_secrets ps on ps.player_id = p.id
              where p.room_id = r.id loop
      update players set public_role = x.role,
                         love_partner_id = case when x.role = 'lovebird' then x.partner_id else love_partner_id end
       where id = x.id;
    end loop;
    v_json := '[]'::jsonb;
    for x in select sh.*, ps.partner_id from shields sh left join player_secrets ps on ps.player_id = sh.player_id
              where sh.room_id = r.id and sh.fake and sh.used_at is not null order by sh.used_at loop
      v_ids := '{}';
      select coalesce(jsonb_agg(_landing_text(l.v)), '[]'::jsonb) into v_land
        from jsonb_array_elements(coalesce(x.owed, '[]'::jsonb)) as l(v) where l.v ->> 'kind' = 'normal';
      if not r.revealed then   -- only log the owed punishments once
        insert into punishments (room_id, player_id, text, kind)
        select r.id, x.player_id, 'Fake heal! ' || t.v, 'fake_heal' from jsonb_array_elements_text(v_land) as t(v);
        if x.partner_id is not null then
          insert into punishments (room_id, player_id, text, kind, via_love)
          select r.id, x.partner_id, 'Fake heal! ' || t.v, 'fake_heal', true from jsonb_array_elements_text(v_land) as t(v);
        end if;
      end if;
      v_json := v_json || jsonb_build_array(jsonb_build_object('player', x.player_id, 'by', x.by_player, 'texts', v_land));
    end loop;
    update rooms set revealed = true,
      reveal = jsonb_build_object(
        'fake_heals', v_json,
        'teams', coalesce((select jsonb_agg(jsonb_build_object('betrayer', ps.player_id, 'intruder', t.v))
                             from player_secrets ps cross join lateral unnest(ps.team_with) as t(v)
                            where ps.room_id = r.id and ps.role = 'betrayer'), '[]'::jsonb),
        'at', now())
    where id = r.id;
    perform _event(r.id, 'reveal_all', '{}'::jsonb);

  -- ======================= TALLY =======================
  when 'log_beer' then
    if r.ended then raise exception 'Time''s up — the tally is frozen'; end if;
    v_int := coalesce((a ->> 'delta')::int, 1);
    if v_host then
      if v_int not in (1, -1) then raise exception 'Bad amount'; end if;
      update rooms set tally = greatest(0, tally + v_int) where id = r.id returning * into r;
      perform _event(r.id, case when v_int > 0 then 'beer' else 'unbeer' end, jsonb_build_object('tally', r.tally));
    else
      if v_int <> 1 then raise exception 'Only the host can take beers off'; end if;
      if me.last_beer_at is not null and now() - me.last_beer_at < interval '20 seconds' then
        raise exception 'Easy! Wait % more seconds', ceil(20 - extract(epoch from now() - me.last_beer_at))::int;
      end if;
      update players set beers = beers + 1, last_beer_at = now() where id = me.id;
      update rooms set tally = tally + 1 where id = r.id returning * into r;
      perform _event(r.id, 'beer', jsonb_build_object('player', me.id, 'tally', r.tally));
    end if;
    res := jsonb_build_object('tally', r.tally);

  when 'end_check' then
    if not r.ended and now() >= r.deadline_at then
      update rooms set ended = true, final_tally = tally,
        result = jsonb_build_object(
          'winner', case when tally >= target then 'group' else 'intruder' end,
          'betrayer_joined', exists (select 1 from player_secrets where room_id = r.id and role = 'betrayer'
                                                                   and cardinality(team_with) > 0))
      where id = r.id;
      perform _event(r.id, 'ended', '{}'::jsonb);
    else
      v_touch := false;
    end if;

  -- ======================= GAMES & VOTES =======================
  when 'start_game' then
    v_text := left(trim(coalesce(a ->> 'name', '')), 40);
    if v_text = '' then raise exception 'Name the game'; end if;
    if exists (select 1 from games where room_id = r.id and status = 'active') then
      raise exception 'Finish the current game first';
    end if;
    insert into games (room_id, name) values (r.id, v_text) returning id into v_id;
    perform _event(r.id, 'game_start', jsonb_build_object('game', v_id, 'name', v_text));
    res := jsonb_build_object('game_id', v_id);

  when 'finish_game' then
    select * into x from games where id = (a ->> 'game_id')::uuid and room_id = r.id and status = 'active';
    if not found then raise exception 'No game running'; end if;
    v_ids := coalesce((select array_agg(q.v::uuid order by q.n) from (select distinct on (e.v) e.v, e.n from jsonb_array_elements_text(coalesce(a -> 'losers', '[]'::jsonb)) with ordinality as e(v, n) order by e.v, e.n) q), '{}');
    if exists (select 1 from unnest(v_ids) as l(v) where not _in_room(r.id, l.v)) then raise exception 'Unknown player'; end if;
    update games set status = 'ended', losers = v_ids, ended_at = now() where id = x.id;
    insert into queue (room_id, player_id, reason)
    select r.id, l.v, 'Lost ' || x.name from unnest(v_ids) with ordinality as l(v, n) order by l.n;
    perform _event(r.id, 'game_over', jsonb_build_object('game', x.id, 'name', x.name, 'losers', to_jsonb(v_ids)));

  when 'start_vote' then
    if exists (select 1 from votes where room_id = r.id and status = 'open') then raise exception 'A vote is already running'; end if;
    v_ids := array(select id from players where room_id = r.id order by seat);
    if cardinality(v_ids) < 3 then raise exception 'Need at least 3 players to vote'; end if;
    v_text := coalesce(a ->> 'kind', 'slacker');
    insert into votes (room_id, kind, game_id, title, options, ends_at)
    values (r.id, v_text, (a ->> 'game_id')::uuid,
            coalesce(a ->> 'title', case v_text when 'slacker' then 'Biggest Slacker' else 'Vote' end),
            v_ids, now() + make_interval(secs => least(120, greatest(10, coalesce((a ->> 'seconds')::int, 30)))))
    returning id into v_id;
    perform _event(r.id, 'vote_start', jsonb_build_object('vote', v_id));
    res := jsonb_build_object('vote_id', v_id);

  when 'cast_vote' then
    select * into x from votes where id = (a ->> 'vote_id')::uuid and room_id = r.id;
    if not found or x.status <> 'open' or now() > x.ends_at + interval '2 seconds' then raise exception 'Voting has closed'; end if;
    v_id := (a ->> 'choice_id')::uuid;
    if not (me.id = any (x.options)) then raise exception 'You joined after this vote started'; end if;
    if not (v_id = any (x.options)) then raise exception 'Not an option'; end if;
    if v_id = me.id then raise exception 'You can''t vote for yourself'; end if;
    insert into ballots (vote_id, room_id, voter_id, choice_id) values (x.id, r.id, me.id, v_id)
    on conflict do nothing;
    if not found then raise exception 'You already voted'; end if;

  when 'close_vote' then
    select * into x from votes where id = (a ->> 'vote_id')::uuid and room_id = r.id and status = 'open';
    if not found then v_touch := false;   -- already closed: harmless (TV + phones may race)
    else
      if not v_host and now() < x.ends_at then raise exception 'The vote is still running'; end if;
      v_ids := coalesce(array(select choice_id from ballots where vote_id = x.id group by choice_id
                               having count(*) = (select max(c) from (select count(*) c from ballots
                                                                       where vote_id = x.id group by choice_id) q)), '{}');
      update votes set status = 'closed', result = v_ids where id = x.id;
      -- vote kinds: add new ones here
      if x.kind = 'slacker' then
        insert into queue (room_id, player_id, reason)
        select r.id, w.v, 'Biggest Slacker' from unnest(v_ids) as w(v);
      end if;
      perform _event(r.id, 'vote_result', jsonb_build_object('vote', x.id, 'winners', to_jsonb(v_ids)));
      res := jsonb_build_object('winners', to_jsonb(v_ids));
    end if;

  -- ======================= PUNISHMENT QUEUE & WHEEL =======================
  when 'queue_add' then
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    insert into queue (room_id, player_id, reason) values (r.id, v_id, coalesce(a ->> 'reason', 'Host''s choice'));

  when 'queue_remove' then
    update queue set status = 'cancelled' where id = (a ->> 'queue_id')::uuid and room_id = r.id and status = 'queued';

  when 'call_next' then
    if rd.id is not null then raise exception 'Finish the current punishment first'; end if;
    if a ? 'player_id' then
      v_id := (a ->> 'player_id')::uuid;
      if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
      insert into queue (room_id, player_id, reason, status)
      values (r.id, v_id, coalesce(a ->> 'reason', 'Host''s choice'), 'active') returning id into v_id2;
      v_text := coalesce(a ->> 'reason', 'Host''s choice');
    else
      select id, player_id, reason into v_id2, v_id, v_text from queue
       where room_id = r.id and status = 'queued' order by pos limit 1;
      if v_id2 is null then raise exception 'Nobody is in the punishment queue'; end if;
      update queue set status = 'active' where id = v_id2;
    end if;
    insert into rounds (room_id, queue_id, victim_id, original_victim_id, reason)
    values (r.id, v_id2, v_id, v_id, v_text) returning id into v_id2;
    perform _event(r.id, 'round_start', jsonb_build_object('round', v_id2, 'player', v_id));
    res := jsonb_build_object('round_id', v_id2);

  when 'spin' then
    if rd.id is null or rd.phase <> 'waiting' then raise exception 'Not ready to spin'; end if;
    -- the victim spins from their phone; the host may spin on their behalf (dead phone)
    if not v_host and rd.victim_id is distinct from me.id then raise exception 'It''s not your turn'; end if;
    select cursed into v_cursed from players where id = rd.victim_id;
    select * into x from shields where player_id = rd.victim_id and used_at is null
     order by fake asc, created_at limit 1 for update;          -- a real heal beats a fake one
    v_found := found;
    v_json := _wheel(r.id);
    if v_found then
      -- identical public outcome for real and fake heals: SAVED
      update shields set used_at = now(), used_round = rd.id,
                         owed = case when fake then _landings(v_json, v_cursed) else null end
       where id = x.id;
      update rounds set phase = 'saved', wheel = v_json, cursed = v_cursed, revealed_at = now() where id = rd.id;
      perform _event(r.id, 'saved', jsonb_build_object('player', rd.victim_id));
    else
      update rounds set phase = 'spinning', wheel = v_json, cursed = v_cursed,
                        landings = _landings(v_json, v_cursed), spin_seq = spin_seq + 1
       where id = rd.id;
    end if;

  when 'round_revealed' then
    if rd.phase = 'spinning' and coalesce((a ->> 'spin_seq')::int, rd.spin_seq) = rd.spin_seq then
      update rounds set phase = 'revealed', revealed_at = now() where id = rd.id;
    else
      v_touch := false;
    end if;

  when 'accept' then
    if rd.id is null then raise exception 'Nothing to accept'; end if;
    if rd.phase = 'spinning' and not v_force then raise exception 'Still spinning'; end if;
    if rd.phase not in ('revealed', 'spinning') then raise exception 'Nothing to accept'; end if;
    if rd.phase = 'revealed' and now() < rd.revealed_at + interval '9 seconds' and not v_force then
      raise exception 'Hold on — a few more seconds';
    end if;
    select partner_id into v_id2 from player_secrets where player_id = rd.victim_id;
    v_int := 0;
    for v_land in select value from jsonb_array_elements(rd.landings) loop
      continue when v_land ->> 'kind' <> 'normal';
      v_text := _landing_text(v_land);
      insert into punishments (room_id, player_id, text) values (r.id, rd.victim_id, v_text);
      if v_id2 is not null then
        insert into punishments (room_id, player_id, text, via_love) values (r.id, v_id2, v_text, true);
      end if;
      v_int := v_int + 1;
    end loop;
    if v_int > 0 and v_id2 is not null
       and not exists (select 1 from players where id = rd.victim_id and public_role = 'lovebird' and love_partner_id = v_id2) then
      update players set public_role = 'lovebird', love_partner_id = v_id2 where id = rd.victim_id;
      update players set public_role = 'lovebird', love_partner_id = rd.victim_id where id = v_id2;
      perform _event(r.id, 'lovebirds', jsonb_build_object('a', rd.victim_id, 'b', v_id2));
    end if;
    update rounds set phase = 'done', ended_at = now() where id = rd.id;
    update queue set status = 'done' where id = rd.queue_id;
    perform _event(r.id, 'accepted', jsonb_build_object('player', rd.victim_id, 'count', v_int,
                                     'partner', case when v_int > 0 then v_id2 end));

  when 'finish_saved' then
    if rd.phase <> 'saved' then raise exception 'Nothing to finish'; end if;
    update rounds set phase = 'done', ended_at = now() where id = rd.id;
    update queue set status = 'done' where id = rd.queue_id;

  when 'cancel_round' then
    if rd.id is null then raise exception 'No punishment running'; end if;
    update rounds set phase = 'cancelled', ended_at = now() where id = rd.id;
    update queue set status = case when coalesce((a ->> 'requeue')::boolean, false) then 'queued' else 'cancelled' end
     where id = rd.queue_id;

  -- ======================= ABILITIES =======================
  when 'heal' then
    if rd.id is null or rd.phase <> 'waiting' then raise exception 'Too late — the wheel is already spinning'; end if;
    if rd.victim_id = me.id then raise exception 'You can''t heal yourself'; end if;
    if coalesce((a ->> 'fake')::boolean, false) then
      if s.role is distinct from 'intruder' or not _setting(r, 'intruder_fake_heal') then raise exception 'You can''t do that'; end if;
      if s.fake_heals_left <= 0 then raise exception 'No fake heals left'; end if;
      update player_secrets set fake_heals_left = fake_heals_left - 1 where player_id = me.id;
      insert into shields (room_id, player_id, by_player, fake, round_id) values (r.id, rd.victim_id, me.id, true, rd.id);
    else
      if s.role is distinct from 'medic' then raise exception 'You can''t do that'; end if;
      if s.heals_left <= 0 then raise exception 'No heals left'; end if;
      if exists (select 1 from shields where by_player = me.id and round_id = rd.id) then raise exception 'You already healed them'; end if;
      update player_secrets set heals_left = heals_left - 1 where player_id = me.id;
      insert into shields (room_id, player_id, by_player, fake, round_id) values (r.id, rd.victim_id, me.id, false, rd.id);
    end if;
    v_touch := false;          -- secret: no broadcast at all

  when 'jester_swap' then
    if s.role is distinct from 'jester' or not _setting(r, 'jester_swap') then raise exception 'You can''t do that'; end if;
    if s.swap_used then raise exception 'You already used your swap tonight'; end if;
    if rd.id is null or rd.phase <> 'waiting' then raise exception 'Too late — the wheel is already spinning'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) then raise exception 'No such player'; end if;
    if v_id = rd.victim_id then raise exception 'They''re already facing the wheel'; end if;
    update rounds set victim_id = v_id where id = rd.id;
    update player_secrets set swap_used = true where player_id = me.id;
    perform _event(r.id, 'jester', jsonb_build_object('kind', 'swap', 'from', rd.victim_id, 'to', v_id));

  when 'jester_respin' then
    if s.role is distinct from 'jester' or not _setting(r, 'jester_respin') then raise exception 'You can''t do that'; end if;
    if s.respins_left <= 0 then raise exception 'No re-spins left'; end if;
    if rd.id is null or rd.phase <> 'revealed' or now() > rd.revealed_at + interval '13 seconds' then
      raise exception 'Too late to re-spin';
    end if;
    update rounds set landings = _landings(rd.wheel, rd.cursed), spin_seq = spin_seq + 1, phase = 'spinning',
                      revealed_at = null where id = rd.id;
    update player_secrets set respins_left = respins_left - 1 where player_id = me.id;
    perform _event(r.id, 'jester', jsonb_build_object('kind', 'respin'));

  when 'jester_graffiti' then
    if s.role is distinct from 'jester' or not _setting(r, 'jester_graffiti') then raise exception 'You can''t do that'; end if;
    if s.graffiti_used then raise exception 'You already used your graffiti tonight'; end if;
    v_text := left(regexp_replace(trim(coalesce(a ->> 'text', '')), '\s+', ' ', 'g'), 60);
    if length(v_text) < 3 then raise exception 'Write a proper punishment'; end if;
    insert into graffiti (room_id, text) values (r.id, v_text);
    update player_secrets set graffiti_used = true where player_id = me.id;
    perform _event(r.id, 'jester', jsonb_build_object('kind', 'graffiti', 'text', v_text));

  when 'remove_graffiti' then
    update graffiti set active = false where id = (a ->> 'graffiti_id')::uuid and room_id = r.id;

  when 'betrayer_guess' then
    if s.role is distinct from 'betrayer' then raise exception 'You can''t do that'; end if;
    if cardinality(s.team_with) > 0 then raise exception 'You already found your partner in crime'; end if;
    if s.guesses_left <= 0 then raise exception 'No guesses left'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if v_id = any (s.guessed) then raise exception 'You already accused them'; end if;
    if exists (select 1 from player_secrets where player_id = v_id and role = 'intruder') then
      update player_secrets set team_with = array_append(team_with, v_id), guessed = array_append(guessed, v_id),
                                guesses_left = guesses_left - 1 where player_id = me.id;
      update player_secrets set team_with = array_append(team_with, me.id) where player_id = v_id;
      res := jsonb_build_object('correct', true, 'name', (select name from players where id = v_id));
    else
      update player_secrets set guessed = array_append(guessed, v_id), guesses_left = guesses_left - 1
       where player_id = me.id;
      insert into punishments (room_id, player_id, text, kind) values (r.id, me.id, 'Penalty drink', 'penalty');
      perform _event(r.id, 'penalty', jsonb_build_object('player', me.id));
      res := jsonb_build_object('correct', false);
    end if;

  when 'request_curse_pass' then
    if not me.cursed then raise exception 'You don''t hold the curse'; end if;
    v_id := (a ->> 'player_id')::uuid;
    if not _in_room(r.id, v_id) or v_id = me.id then raise exception 'Pick someone else'; end if;
    if exists (select 1 from curse_passes where from_id = me.id and status = 'pending') then
      raise exception 'Waiting for the host to approve your last request';
    end if;
    insert into curse_passes (room_id, from_id, to_id) values (r.id, me.id, v_id);
    perform _event(r.id, 'curse_request', jsonb_build_object('from', me.id, 'to', v_id));

  when 'decide_curse' then
    select * into x from curse_passes where id = (a ->> 'pass_id')::uuid and room_id = r.id and status = 'pending';
    if not found then raise exception 'That request is gone'; end if;
    if coalesce((a ->> 'approve')::boolean, false)
       and exists (select 1 from players where id = x.from_id and cursed) then
      update players set cursed = false where id = x.from_id;
      update players set cursed = true  where id = x.to_id;
      update curse_passes set status = 'approved', decided_at = now() where id = x.id;
      perform _event(r.id, 'curse_passed', jsonb_build_object('from', x.from_id, 'to', x.to_id));
    else
      update curse_passes set status = 'rejected', decided_at = now() where id = x.id;
    end if;

  when 'kick' then
    delete from players where id = (a ->> 'player_id')::uuid and room_id = r.id;

  else
    raise exception 'Unknown action %', p_action;
  end case;

  if v_touch then perform _touch(r.id); end if;
  return res;
end $$;

-- =====================================================================
-- get_state: the ONLY read path for clients. Returns public room data plus
-- the caller's own secrets (and their Lovebird partner's / team-mates' names).
-- The host view contains no secrets at all.
-- =====================================================================
create or replace function public.get_state(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  r      rooms;
  me     players;
  s      player_secrets;
  rd     rounds;
  vt     votes;
  v_anon boolean;
  v_host boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then return jsonb_build_object('error', 'no_room', 'server_now', now()); end if;
  select coalesce(is_anonymous, false) into v_anon from auth.users where id = uid;
  v_host := r.host_id = uid and not coalesce(v_anon, true);
  select * into me from players where room_id = r.id and user_id = uid;
  if not v_host and me.id is null then
    return jsonb_build_object('server_now', now(),
                              'room', jsonb_build_object('id', r.id, 'code', r.code),
                              'me', jsonb_build_object('user_id', uid, 'is_host', false, 'joined', false));
  end if;
  select * into s  from player_secrets where player_id = me.id;
  select * into rd from rounds where room_id = r.id and phase in ('waiting','spinning','revealed','saved')
   order by created_at desc limit 1;
  select * into vt from votes where room_id = r.id order by created_at desc limit 1;

  return jsonb_build_object(
    'server_now', now(),
    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'status', r.status, 'tally', r.tally, 'target', r.target,
      'deadline_at', r.deadline_at, 'segments', r.segments, 'settings', r.settings, 'ended', r.ended,
      'final_tally', r.final_tally, 'result', r.result, 'revealed', r.revealed, 'reveal', r.reveal,
      'version', r.version, 'wheel', _wheel(r.id)),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'selfie_url', p.selfie_url, 'seat', p.seat, 'beers', p.beers,
        'has_role', p.has_role, 'public_role', p.public_role, 'love_partner_id', p.love_partner_id, 'cursed', p.cursed,
        'punishments', coalesce((select jsonb_agg(jsonb_build_object('text', pu.text, 'kind', pu.kind, 'via_love', pu.via_love,
                                                                      'at', pu.created_at) order by pu.created_at)
                                   from punishments pu where pu.player_id = p.id), '[]'::jsonb)
      ) order by p.seat) from players p where p.room_id = r.id), '[]'::jsonb),
    'queue', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'player_id', q.player_id, 'reason', q.reason) order by q.pos)
                         from queue q where q.room_id = r.id and q.status = 'queued'), '[]'::jsonb),
    'round', case when rd.id is null then null else jsonb_build_object(
      'id', rd.id, 'victim_id', rd.victim_id, 'original_victim_id', rd.original_victim_id, 'phase', rd.phase,
      'reason', rd.reason, 'spin_seq', rd.spin_seq, 'wheel', rd.wheel, 'cursed', rd.cursed, 'revealed_at', rd.revealed_at,
      'landings', case when rd.phase in ('spinning','revealed') then rd.landings else '[]'::jsonb end) end,
    'game', (select jsonb_build_object('id', g.id, 'name', g.name, 'status', g.status, 'losers', to_jsonb(g.losers))
               from games g where g.room_id = r.id order by g.created_at desc limit 1),
    'vote', case when vt.id is null then null else jsonb_build_object(
      'id', vt.id, 'kind', vt.kind, 'title', vt.title, 'status', vt.status, 'options', to_jsonb(vt.options),
      'ends_at', vt.ends_at, 'result', to_jsonb(vt.result), 'game_id', vt.game_id,
      'counts', coalesce((select jsonb_object_agg(q.choice_id, q.c) from
                           (select choice_id, count(*) c from ballots where vote_id = vt.id group by choice_id) q), '{}'::jsonb),
      'voters', (select count(*) from ballots where vote_id = vt.id),
      'my_choice', (select choice_id from ballots where vote_id = vt.id and voter_id = me.id)) end,
    'curse_passes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'from_id', c.from_id, 'to_id', c.to_id) order by c.created_at)
                                from curse_passes c where c.room_id = r.id and c.status = 'pending'), '[]'::jsonb),
    'graffiti', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'text', g.text) order by g.created_at)
                            from graffiti g where g.room_id = r.id and g.active), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'payload', e.payload, 'at', e.created_at) order by e.id)
                          from (select * from events where room_id = r.id order by id desc limit 40) e), '[]'::jsonb),
    'me', jsonb_build_object(
      'user_id', uid, 'is_host', v_host, 'joined', me.id is not null, 'player_id', me.id,
      'cooldown_until', me.last_beer_at + interval '20 seconds',
      'pending_curse_pass', exists (select 1 from curse_passes where from_id = me.id and status = 'pending'),
      'secret', case when s.player_id is null then null else jsonb_build_object(
        'role', s.role, 'heals_left', s.heals_left, 'fake_heals_left', s.fake_heals_left,
        'guesses_left', s.guesses_left, 'guessed', to_jsonb(s.guessed), 'respins_left', s.respins_left,
        'swap_used', s.swap_used, 'graffiti_used', s.graffiti_used,
        'healed_this_round', rd.id is not null and exists (select 1 from shields sh where sh.by_player = me.id and sh.round_id = rd.id),
        'partner', (select jsonb_build_object('id', p.id, 'name', p.name, 'selfie_url', p.selfie_url) from players p where p.id = s.partner_id),
        'team', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) from players p where p.id = any (s.team_with))
      ) end)
  );
end $$;

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
  end loop;
end $$;
do $$ begin
  execute 'grant execute on function public.api_exec(uuid, text, jsonb) to service_role';
exception when undefined_object then null; end $$;
