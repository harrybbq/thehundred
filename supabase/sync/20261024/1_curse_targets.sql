-- 24 Oct: EVERYONE PLAYS (several matches in one game). The curse only passes to a loser of the Cursed player's own match.
create or replace function public._curse_targets(p_room uuid, p_me uuid) returns uuid[] language sql stable set search_path = public as $$
  with g as (select * from games where room_id = p_room and status = 'ended' order by ended_at desc limit 1)
  select coalesce((
    select array(select l from unnest(g.losers) as l
                  where l <> p_me and exists (select 1 from players p where p.id = l and not p.cursed and p.public_role is distinct from 'angel')
                    and (jsonb_typeof(g.matchup) is distinct from 'array' or jsonb_array_length(g.matchup) <= 2
                         or (select (s.i - 1) / 2 from jsonb_array_elements(g.matchup) with ordinality as s(side, i) where s.side ? l::text limit 1)
                          = (select (s.i - 1) / 2 from jsonb_array_elements(g.matchup) with ordinality as s(side, i) where s.side ? p_me::text limit 1)))
      from g
     where not (p_me = any (g.losers))
       and (g.matchup is null or jsonb_typeof(g.matchup) <> 'array' or exists (
             select 1 from jsonb_array_elements(g.matchup) as sd(side), jsonb_array_elements_text(sd.side) as v(id) where v.id = p_me::text))
       and not exists (select 1 from curse_passes c where c.game_id = g.id)), '{}')
$$;

revoke all on function public._curse_targets(uuid, uuid) from public, anon, authenticated;
