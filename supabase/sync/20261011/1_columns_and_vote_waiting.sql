alter table public.players add column if not exists rejoin_uid uuid, add column if not exists rejoin_at timestamptz, add column if not exists rejoin_code int;

CREATE OR REPLACE FUNCTION public._vote_waiting(p_vote uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(p.id order by p.seat), '{}')
    from votes v join players p on p.room_id = v.room_id
   where v.id = p_vote and v.status = 'open' and p.has_role and not p.rehab
     and (p.locked_until is null or p.locked_until <= now())
     and (p.id = any (v.options) or (p.public_role = 'angel' and p.created_at <= v.created_at))
     and not exists (select 1 from ballots b where b.vote_id = v.id and b.voter_id = p.id)
$function$;

revoke all on function public._vote_waiting(uuid) from public, anon, authenticated;
