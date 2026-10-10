do $do$
declare d text;
begin
  d := pg_get_functiondef('_a_setup(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position($h$    end if;
    v_json := coalesce(a -> 'role_counts', r.settings -> 'role_counts');
    delete from role_codes where room_id = r.id and not spare;     -- spare late-guest codes are not part of the deck
    for x in select key as role, greatest(0, least(40, (value #>> '{}')::int)) as n from jsonb_each(v_json) loop
      continue when not (x.role = any (_roles()));
      for i in 1..x.n loop
        perform _new_code(r.id, x.role, null);
      end loop;
    end loop;
    -- Modifiers land on random dealt cards, whatever their role (Guilty included), with a small bias towards
    -- plain Drinker cards: sorting on random() × 0.75 makes each one about 1.4× as likely as any other card.
    -- Lovebird pairs: 2 cards per pair
    v_int := greatest(0, least(20, coalesce((v_json ->> 'lovebird')::int, 0)));
    if v_int * 2 > (select count(*) from role_codes where room_id = r.id and not spare) then
      raise exception 'Not enough cards for % Lovebird pair(s)', v_int;
    end if;
    for i in 1..v_int loop
      v_id := gen_random_uuid();
      update role_codes set pair_id = v_id
       where id in (select id from role_codes where room_id = r.id and not spare and pair_id is null
                     order by random() * (case when role = 'drinker' then 0.75 else 1 end) limit 2);
    end loop;
    -- Cursed: the bias favours Drinker cards that don't already carry a Lovebird
    v_int := greatest(0, least(20, coalesce((v_json ->> 'cursed')::int, 0)));
    if v_int > (select count(*) from role_codes where room_id = r.id and not spare) then raise exception 'Not enough cards for % Cursed', v_int; end if;
    update role_codes set cursed = true
     where id in (select id from role_codes where room_id = r.id and not spare
                   order by random() * (case when role = 'drinker' and pair_id is null then 0.75 else 1 end) limit v_int);
    update rooms set settings = jsonb_set(settings, '{role_counts}', v_json) where id = r.id;
    res := jsonb_build_object('cards', _cards(r.id));

  when 'get_cards' then
$h$ in d) = 0 then raise exception 'hunk 1 missing _a_setup'; end if;
  d := replace(d, $h$    end if;
    v_json := coalesce(a -> 'role_counts', r.settings -> 'role_counts');
    delete from role_codes where room_id = r.id and not spare;     -- spare late-guest codes are not part of the deck
    for x in select key as role, greatest(0, least(40, (value #>> '{}')::int)) as n from jsonb_each(v_json) loop
      continue when not (x.role = any (_roles()));
      for i in 1..x.n loop
        perform _new_code(r.id, x.role, null);
      end loop;
    end loop;
    -- Modifiers land on random dealt cards, whatever their role (Guilty included), with a small bias towards
    -- plain Drinker cards: sorting on random() × 0.75 makes each one about 1.4× as likely as any other card.
    -- Lovebird pairs: 2 cards per pair
    v_int := greatest(0, least(20, coalesce((v_json ->> 'lovebird')::int, 0)));
    if v_int * 2 > (select count(*) from role_codes where room_id = r.id and not spare) then
      raise exception 'Not enough cards for % Lovebird pair(s)', v_int;
    end if;
    for i in 1..v_int loop
      v_id := gen_random_uuid();
      update role_codes set pair_id = v_id
       where id in (select id from role_codes where room_id = r.id and not spare and pair_id is null
                     order by random() * (case when role = 'drinker' then 0.75 else 1 end) limit 2);
    end loop;
    -- Cursed: the bias favours Drinker cards that don't already carry a Lovebird
    v_int := greatest(0, least(20, coalesce((v_json ->> 'cursed')::int, 0)));
    if v_int > (select count(*) from role_codes where room_id = r.id and not spare) then raise exception 'Not enough cards for % Cursed', v_int; end if;
    update role_codes set cursed = true
     where id in (select id from role_codes where room_id = r.id and not spare
                   order by random() * (case when role = 'drinker' and pair_id is null then 0.75 else 1 end) limit v_int);
    update rooms set settings = jsonb_set(settings, '{role_counts}', v_json) where id = r.id;
    res := jsonb_build_object('cards', _cards(r.id));

  when 'get_cards' then
$h$, $h$    end if;
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
$h$);
  if position($h$                                                   from role_codes where room_id = r.id and not (v_json ? code)), '[]'::jsonb),
                              'no_touch', true);

  when 'kick' then
$h$ in d) = 0 then raise exception 'hunk 2 missing _a_setup'; end if;
  d := replace(d, $h$                                                   from role_codes where room_id = r.id and not (v_json ? code)), '[]'::jsonb),
                              'no_touch', true);

  when 'kick' then
$h$, $h$                                                   from role_codes where room_id = r.id and not (v_json ? code)), '[]'::jsonb),
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
$h$);
  execute d;
end $do$;
