do $do$
declare d text;
begin
  d := pg_get_functiondef('_a_mini(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position($h$    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.kind not in ('dodge','plank','jack') then raise exception 'No bets on that'; end if;
    if g.status <> 'muster' or (g.muster_until is not null and now() > g.muster_until) or r.ended then raise exception 'Bets are closed'; end if;
    if not me.has_role then raise exception 'Open your card first: type your code in YOUR FILE'; end if;
$h$ in d) = 0 then raise exception 'hunk 0 missing _a_mini'; end if;
  d := replace(d, $h$    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.kind not in ('dodge','plank','jack') then raise exception 'No bets on that'; end if;
    if g.status <> 'muster' or (g.muster_until is not null and now() > g.muster_until) or r.ended then raise exception 'Bets are closed'; end if;
    if not me.has_role then raise exception 'Open your card first: type your code in YOUR FILE'; end if;
$h$, $h$    select * into g from minigames where id = (a ->> 'game_id')::uuid and room_id = r.id for update;
    if g.id is null or g.kind not in ('dodge','plank','jack') then raise exception 'No bets on that'; end if;
    if not _bookie_on(g.id) then raise exception 'Betting opens after the first game'; end if;
    if g.status <> 'muster' or (g.muster_until is not null and now() > g.muster_until) or r.ended then raise exception 'Bets are closed'; end if;
    if not me.has_role then raise exception 'Open your card first: type your code in YOUR FILE'; end if;
$h$);
  execute d;
end $do$;
