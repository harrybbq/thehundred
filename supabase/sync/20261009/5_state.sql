do $do$
declare d text;
begin
  d := pg_get_functiondef('_state(uuid,text)'::regprocedure);
  if position($h$    -- THE BOOKIE: only the count while it's open; picks never leave the server except your own (and, once settled,
    -- who called it). The host/TV gets the same object without 'mine'.
    'book', case when v_mg.id is not null and v_mg.kind in ('dodge','plank','jack')
                  and (v_mg.status in ('muster','live') or v_mg.finished_at > now() - interval '45 seconds') then jsonb_build_object(
      'game_id', v_mg.id, 'kind', v_mg.kind, 'stake', 5,                      -- the smallest bet
$h$ in d) = 0 then raise exception 'hunk 0 missing _state'; end if;
  d := replace(d, $h$    -- THE BOOKIE: only the count while it's open; picks never leave the server except your own (and, once settled,
    -- who called it). The host/TV gets the same object without 'mine'.
    'book', case when v_mg.id is not null and v_mg.kind in ('dodge','plank','jack')
                  and (v_mg.status in ('muster','live') or v_mg.finished_at > now() - interval '45 seconds') then jsonb_build_object(
      'game_id', v_mg.id, 'kind', v_mg.kind, 'stake', 5,                      -- the smallest bet
$h$, $h$    -- THE BOOKIE: only the count while it's open; picks never leave the server except your own (and, once settled,
    -- who called it). The host/TV gets the same object without 'mine'.
    'book', case when v_mg.id is not null and v_mg.kind in ('dodge','plank','jack') and _bookie_on(v_mg.id)
                  and (v_mg.status in ('muster','live') or v_mg.finished_at > now() - interval '45 seconds') then jsonb_build_object(
      'game_id', v_mg.id, 'kind', v_mg.kind, 'stake', 5,                      -- the smallest bet
$h$);
  if position($h$    'me', jsonb_build_object(
      'user_id', uid, 'is_host', v_host, 'joined', me.id is not null, 'player_id', me.id,
      'cooldown_until', me.last_beer_at + interval '3 minutes',
      'curse_targets', case when me.cursed then to_jsonb(_curse_targets(r.id, me.id)) else '[]'::jsonb end,
$h$ in d) = 0 then raise exception 'hunk 1 missing _state'; end if;
  d := replace(d, $h$    'me', jsonb_build_object(
      'user_id', uid, 'is_host', v_host, 'joined', me.id is not null, 'player_id', me.id,
      'cooldown_until', me.last_beer_at + interval '3 minutes',
      'curse_targets', case when me.cursed then to_jsonb(_curse_targets(r.id, me.id)) else '[]'::jsonb end,
$h$, $h$    'me', jsonb_build_object(
      'user_id', uid, 'is_host', v_host, 'joined', me.id is not null, 'player_id', me.id,
      'late_left', case when v_host then (select count(*) from role_codes c where c.room_id = r.id and c.late and c.redeemed_at is null) end,   -- a count, never the roles
      'cooldown_until', me.last_beer_at + interval '3 minutes',
      'curse_targets', case when me.cursed then to_jsonb(_curse_targets(r.id, me.id)) else '[]'::jsonb end,
$h$);
  execute d;
end $do$;
