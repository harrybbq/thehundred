-- PICK AT RANDOM + the late pile: the rest of _a_setup. Paste the whole file into Supabase > SQL Editor and Run.
-- Safe to paste with any line endings: it finds its place by short ASCII markers, checks the code it replaces is the
-- expected version (md5), strips carriage returns, and refuses to run twice.
do $do$
declare d text; a int; b int; c int; v1 text; v2 text;
begin
  d := pg_get_functiondef('_a_setup(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position('random_deal' in d) > 0 then raise exception 'Already applied: nothing to do'; end if;
  v1 := replace($n$
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
    res := jsonb_build_object('n', v_int);$n$, chr(13), '');
  v2 := replace($n$
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
    res := jsonb_build_object('n', v_int, 'no_touch', true);$n$, chr(13), '');
  v1 := substr(v1, 2);                                        -- drop the newline after the opening quote
  v2 := chr(10) || chr(10) || substr(v2, 2);
  a := position('    delete from role_codes where room_id = r.id and not spare;' in d);
  if a = 0 then raise exception 'Marker 1 not found'; end if;
  b := a - 1 + position(chr(10) || chr(10) || '  when ''get_cards'' then' in substr(d, a));
  if b < a then raise exception 'Marker 2 not found'; end if;
  if md5(substr(d, a, b - a)) <> '154f9142a1b0b32f2dfe13a22a955151' then raise exception 'The card-dealing code is not the expected version'; end if;
  d := substr(d, 1, a - 1) || v1 || substr(d, b);
  c := position(chr(10) || chr(10) || '  when ''kick'' then' in d);
  if c = 0 then raise exception 'Marker 3 not found'; end if;
  if position(chr(10) || chr(10) || '  when ''kick'' then' in substr(d, c + 2)) > 0 then raise exception 'Marker 3 is not unique'; end if;
  d := substr(d, 1, c - 1) || v2 || substr(d, c);
  execute d;
end $do$;
