do $do$
declare d text;
begin
  d := pg_get_functiondef('_exec(uuid,boolean,text,jsonb)'::regprocedure);
  if position($h$    perform _touch(r.id);
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'player_id', me.id);
  end if;

$h$ in d) = 0 then raise exception 'hunk 0 missing _exec'; end if;
  d := replace(d, $h$    perform _touch(r.id);
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'player_id', me.id);
  end if;

$h$, $h$    perform _touch(r.id);
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'player_id', me.id);

  -- REJOIN: this phone has lost its identity (a private tab closed, another browser, cleared data) and typed a name
  -- that's already playing. It asks to take that player back; the host approves on the TV (decide_rejoin), and the
  -- player keeps everything: role, beers, level, caps, queue spot. A phone that's already playing can't ask.
  -- The phone and the TV both show a 2-digit number, and the host approves the number they see on the phone in front
  -- of them (decide_rejoin checks it), so another phone can't slip its own request in. A pending request from another
  -- phone can't be replaced: the host refuses it first.
  elsif p_action = 'rejoin_request' then
    select * into r from rooms where code = upper(trim(a ->> 'code')) for update;
    if not found then raise exception 'No room with that code'; end if;
    if p_uid = r.host_id then raise exception 'That''s the host''s login: use a phone'; end if;
    if exists (select 1 from players where room_id = r.id and user_id = p_uid) then raise exception 'This phone is already in the game'; end if;
    v_text := left(regexp_replace(trim(coalesce(a ->> 'name', '')), '\s+', ' ', 'g'), 20);
    select * into me from players where room_id = r.id and lower(name) = lower(v_text);
    if me.id is null then raise exception 'Nobody called that is in this game'; end if;
    if me.rejoin_uid is distinct from p_uid and me.rejoin_at > now() - interval '15 minutes' then
      raise exception 'Another phone is already asking to come back as %. Find the host.', me.name;
    end if;
    update players set rejoin_uid = null, rejoin_at = null, rejoin_code = null              -- one request per phone
     where room_id = r.id and rejoin_uid = p_uid and id <> me.id;
    if me.rejoin_uid is distinct from p_uid or me.rejoin_at <= now() - interval '15 minutes' then   -- a repeat tap: no new beep
      update players set rejoin_uid = p_uid, rejoin_at = now(), rejoin_code = 10 + floor(random() * 90)::int where id = me.id;
      perform _event(r.id, 'rejoin_request', jsonb_build_object('player', me.id));
    end if;
    perform _touch(r.id);
    return jsonb_build_object('player_id', me.id, 'name', me.name);

  elsif p_action = 'rejoin_cancel' then
    select * into r from rooms where code = upper(trim(a ->> 'code')) for update;
    if not found then raise exception 'No room with that code'; end if;
    update players set rejoin_uid = null, rejoin_at = null, rejoin_code = null where room_id = r.id and rejoin_uid = p_uid;
    perform _touch(r.id);
    return '{"ok":true}'::jsonb;
  end if;

$h$);
  if position($h$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide') and not v_host then
    raise exception 'Only the host can do that';
  end if;
$h$ in d) = 0 then raise exception 'hunk 1 missing _exec'; end if;
  d := replace(d, $h$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide') and not v_host then
    raise exception 'Only the host can do that';
  end if;
$h$, $h$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide','decide_rejoin') and not v_host then
    raise exception 'Only the host can do that';
  end if;
$h$);
  if position($h$
  res := case
    when p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','kick','submit_evidence','hide_evidence','undo')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
$h$ in d) = 0 then raise exception 'hunk 2 missing _exec'; end if;
  d := replace(d, $h$
  res := case
    when p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','kick','submit_evidence','hide_evidence','undo')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
$h$, $h$
  res := case
    when p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','kick','submit_evidence','hide_evidence','undo','decide_rejoin')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
$h$);
  execute d;
end $do$;
