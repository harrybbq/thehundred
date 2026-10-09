alter table public.role_codes add column if not exists late boolean not null default false;

CREATE OR REPLACE FUNCTION public._bookie_on(p_mg uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from minigames m join games g on g.room_id = m.room_id
                  where m.id = p_mg and g.status = 'ended' and g.ended_at <= m.created_at)
$function$;

CREATE OR REPLACE FUNCTION public._deal_cards(p_room uuid, p_counts jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare x record; v_int int; v_id uuid;
begin
  delete from role_codes where room_id = p_room and (not spare or (late and redeemed_at is null));
  for x in select key as role, greatest(0, least(40, (value #>> '{}')::int)) as n from jsonb_each(p_counts) loop
    continue when not (x.role = any (_roles()));
    for i in 1..x.n loop
      perform _new_code(p_room, x.role, null);
    end loop;
  end loop;
  -- Modifiers land on random dealt cards, whatever their role (Guilty included), with a small bias towards
  -- plain Drinker cards: sorting on random() × 0.75 makes each one about 1.4× as likely as any other card.
  -- Lovebird pairs: 2 cards per pair
  v_int := greatest(0, least(20, coalesce((p_counts ->> 'lovebird')::int, 0)));
  if v_int * 2 > (select count(*) from role_codes where room_id = p_room and not spare) then
    raise exception 'Not enough cards for % Lovebird pair(s)', v_int;
  end if;
  for i in 1..v_int loop
    v_id := gen_random_uuid();
    update role_codes set pair_id = v_id
     where id in (select id from role_codes where room_id = p_room and not spare and pair_id is null
                   order by random() * (case when role = 'drinker' then 0.75 else 1 end) limit 2);
  end loop;
  -- Cursed: the bias favours Drinker cards that don't already carry a Lovebird
  v_int := greatest(0, least(20, coalesce((p_counts ->> 'cursed')::int, 0)));
  if v_int > (select count(*) from role_codes where room_id = p_room and not spare) then raise exception 'Not enough cards for % Cursed', v_int; end if;
  update role_codes set cursed = true
   where id in (select id from role_codes where room_id = p_room and not spare
                 order by random() * (case when role = 'drinker' and pair_id is null then 0.75 else 1 end) limit v_int);
end $function$;

CREATE OR REPLACE FUNCTION public._plevel(p_beers integer, p_room uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select _blevel(p_beers)
$function$;

CREATE OR REPLACE FUNCTION public._random_counts(p_n integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v jsonb := '{"intruder":1}'::jsonb; v_left int := p_n - 1; v_k int; x text;
begin
  v_k := case when p_n <= 7 then 0 when p_n <= 10 then (random() < 0.5)::int when p_n <= 15 then 1 else 2 end;
  for x in select r from unnest(array['forger','assassin']) r order by random() limit least(v_k, v_left) loop
    v := v || jsonb_build_object(x, 1); v_left := v_left - 1;
  end loop;
  v_k := case when p_n <= 6 then (random() < 0.5)::int when p_n <= 10 then 1 + (random() < 0.5)::int else 2 end;
  for x in select r from unnest(array['scrooge','jester']) r order by random() limit least(v_k, v_left) loop
    v := v || jsonb_build_object(x, 1); v_left := v_left - 1;
  end loop;
  if p_n >= 6 and v_left > 0 and random() < 0.75 then v := v || '{"betrayer":1}'::jsonb; v_left := v_left - 1; end if;
  for x in select r from unnest(array['medic','detective','skank','davyjones']) r order by random() loop
    exit when v_left <= 0;
    if random() < 0.85 then v := v || jsonb_build_object(x, 1); v_left := v_left - 1; end if;
  end loop;
  return v || jsonb_build_object('drinker', greatest(0, v_left));
end $function$;

CREATE OR REPLACE FUNCTION public._spares(p_room uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('code', substr(code, 1, 3) || '-' || substr(code, 4, 3), 'role', role,
                                               'lovebird', false, 'cursed', false, 'late', late) order by slot, code), '[]'::jsonb)
    from role_codes where room_id = p_room and spare and redeemed_at is null
$function$;

revoke all on function public._bookie_on(uuid) from public, anon, authenticated;
revoke all on function public._deal_cards(uuid,jsonb) from public, anon, authenticated;
revoke all on function public._random_counts(integer) from public, anon, authenticated;
