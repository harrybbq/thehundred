do $do$
declare d text;
begin
  d := pg_get_functiondef('_a_setup(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position($h$     where id = r.id;
    res := jsonb_build_object('n', v_int);

  when 'get_cards' then
$h$ in d) = 0 then raise exception 'hunk 0 missing _a_setup'; end if;
  d := replace(d, $h$     where id = r.id;
    res := jsonb_build_object('n', v_int);

  when 'get_cards' then
$h$, $h$     where id = r.id;
    res := jsonb_build_object('n', v_int);

  -- REJOIN (host): let a player back in on the phone that asked (rejoin_request), or refuse. Their old phone, if it
  -- ever comes back, just sees the join screen. Undo can't hand the file back to the lost phone.
  when 'decide_rejoin' then
    v_id := (a ->> 'player_id')::uuid;
    select * into x from players where id = v_id and room_id = r.id for update;
    if not found then raise exception 'They''re not in this room'; end if;
    if x.rejoin_uid is null then raise exception 'Nobody is asking to come back as them'; end if;
    if coalesce((a ->> 'approve')::boolean, false) then
      if x.rejoin_at < now() - interval '15 minutes' then raise exception 'That request has expired: ask them to try again'; end if;
      if (a ->> 'code') is distinct from x.rejoin_code::text then raise exception 'The number has changed: check their phone again'; end if;
      if x.rejoin_uid = r.host_id then raise exception 'That''s the host''s login'; end if;
      if exists (select 1 from players where room_id = r.id and user_id = x.rejoin_uid) then
        raise exception 'That phone has joined as someone else since: kick that one first';
      end if;
      update players set user_id = x.rejoin_uid, rejoin_uid = null, rejoin_at = null, rejoin_code = null where id = v_id;
      update undo_log set blocked = true where room_id = r.id and not blocked;
      perform _event(r.id, 'rejoined', jsonb_build_object('player', v_id));
    else
      update players set rejoin_uid = null, rejoin_at = null, rejoin_code = null where id = v_id;
    end if;

  when 'get_cards' then
$h$);
  execute d;
end $do$;
