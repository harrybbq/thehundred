do $do$
declare d text;
begin
  d := pg_get_functiondef('_state(uuid,text)'::regprocedure);
  if position($h$  if not v_host and me.id is null then
    return jsonb_build_object('server_now', now(), 'room', jsonb_build_object('id', r.id, 'code', r.code),
                              'me', jsonb_build_object('user_id', uid, 'is_host', false, 'joined', false));
  end if;
  select * into s  from player_secrets where player_id = me.id;
$h$ in d) = 0 then raise exception 'hunk 0 missing _state'; end if;
  d := replace(d, $h$  if not v_host and me.id is null then
    return jsonb_build_object('server_now', now(), 'room', jsonb_build_object('id', r.id, 'code', r.code),
                              'me', jsonb_build_object('user_id', uid, 'is_host', false, 'joined', false));
  end if;
  select * into s  from player_secrets where player_id = me.id;
$h$, $h$  if not v_host and me.id is null then
    return jsonb_build_object('server_now', now(), 'room', jsonb_build_object('id', r.id, 'code', r.code),
                              'me', jsonb_build_object('user_id', uid, 'is_host', false, 'joined', false,
                                -- a rejoin this phone asked for (name and photo are on the TV anyway)
                                'rejoin', (select jsonb_build_object('player_id', p.id, 'name', p.name, 'selfie_url', p.selfie_url, 'at', p.rejoin_at,
                                                                     'code', p.rejoin_code)
                                             from players p where p.room_id = r.id and p.rejoin_uid = uid and p.rejoin_at > now() - interval '15 minutes'
                                             order by p.rejoin_at desc limit 1)));
  end if;
  select * into s  from player_secrets where player_id = me.id;
$h$);
  if position($h$        'locked_until', case when p.locked_until > now() then p.locked_until end,
        'lock_requested', p.lock_requested_at is not null,
        'held', exists (select 1 from queue q where q.player_id = p.id and q.status = 'held'),
        'punishments', coalesce((select jsonb_agg(jsonb_build_object('text', pu.text, 'kind', pu.kind, 'via_love', pu.via_love,
$h$ in d) = 0 then raise exception 'hunk 1 missing _state'; end if;
  d := replace(d, $h$        'locked_until', case when p.locked_until > now() then p.locked_until end,
        'lock_requested', p.lock_requested_at is not null,
        'held', exists (select 1 from queue q where q.player_id = p.id and q.status = 'held'),
        'punishments', coalesce((select jsonb_agg(jsonb_build_object('text', pu.text, 'kind', pu.kind, 'via_love', pu.via_love,
$h$, $h$        'locked_until', case when p.locked_until > now() then p.locked_until end,
        'lock_requested', p.lock_requested_at is not null,
        'rejoin_requested', v_host and p.rejoin_uid is not null and p.rejoin_at > now() - interval '15 minutes',   -- for the host's approval
        'rejoin_code', case when v_host and p.rejoin_uid is not null and p.rejoin_at > now() - interval '15 minutes' then p.rejoin_code end,
        'held', exists (select 1 from queue q where q.player_id = p.id and q.status = 'held'),
        'punishments', coalesce((select jsonb_agg(jsonb_build_object('text', pu.text, 'kind', pu.kind, 'via_love', pu.via_love,
$h$);
  if position($h$                           (select choice_id, count(*) c from ballots where vote_id = vt.id group by choice_id) q), '{}'::jsonb) end,
      'voters', (select count(*) from ballots where vote_id = vt.id),
      'my_choice', (select choice_id from ballots where vote_id = vt.id and voter_id = me.id)) end,
    -- Aaron's Plate: which sausage is dirty only goes to the TV (and to everyone once it's served);
$h$ in d) = 0 then raise exception 'hunk 2 missing _state'; end if;
  d := replace(d, $h$                           (select choice_id, count(*) c from ballots where vote_id = vt.id group by choice_id) q), '{}'::jsonb) end,
      'voters', (select count(*) from ballots where vote_id = vt.id),
      'my_choice', (select choice_id from ballots where vote_id = vt.id and voter_id = me.id)) end,
    -- Aaron's Plate: which sausage is dirty only goes to the TV (and to everyone once it's served);
$h$, $h$                           (select choice_id, count(*) c from ballots where vote_id = vt.id group by choice_id) q), '{}'::jsonb) end,
      'voters', (select count(*) from ballots where vote_id = vt.id),
      -- who can still vote (names are on the TV anyway; never what anyone voted)
      'waiting', case when vt.status = 'open' and v_host then to_jsonb(_vote_waiting(vt.id)) else '[]'::jsonb end,   -- the TV names them
      'waiting_n', case when vt.status = 'open' then cardinality(_vote_waiting(vt.id)) else 0 end,                         -- phones: a count
      'my_choice', (select choice_id from ballots where vote_id = vt.id and voter_id = me.id)) end,
    -- Aaron's Plate: which sausage is dirty only goes to the TV (and to everyone once it's served);
$h$);
  execute d;
end $do$;
