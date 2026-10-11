do $do$
declare d text;
begin
  d := pg_get_functiondef('_a_games(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position($h$    values (r.id, v_text, (a ->> 'game_id')::uuid,
            coalesce(a ->> 'title', case v_text when 'trial' then 'The Trial' else 'Vote' end),
            v_ids, now() + make_interval(secs => least(120, greatest(10, coalesce((a ->> 'seconds')::int, 30)))))
    returning id into v_id;
    perform _event(r.id, 'vote_start', jsonb_build_object('vote', v_id, 'kind', v_text));
$h$ in d) = 0 then raise exception 'hunk 0 missing _a_games'; end if;
  d := replace(d, $h$    values (r.id, v_text, (a ->> 'game_id')::uuid,
            coalesce(a ->> 'title', case v_text when 'trial' then 'The Trial' else 'Vote' end),
            v_ids, now() + make_interval(secs => least(120, greatest(10, coalesce((a ->> 'seconds')::int, 30)))))
    returning id into v_id;
    perform _event(r.id, 'vote_start', jsonb_build_object('vote', v_id, 'kind', v_text));
$h$, $h$    values (r.id, v_text, (a ->> 'game_id')::uuid,
            coalesce(a ->> 'title', case v_text when 'trial' then 'The Trial' else 'Vote' end),
            v_ids, case when v_text = 'trial' then now() + interval '30 minutes'     -- a Trial waits for every vote (the host can end it)
                        else now() + make_interval(secs => least(120, greatest(10, coalesce((a ->> 'seconds')::int, 30)))) end)
    returning id into v_id;
    perform _event(r.id, 'vote_start', jsonb_build_object('vote', v_id, 'kind', v_text));
$h$);
  if position($h$    insert into ballots (vote_id, room_id, voter_id, choice_id) values (x.id, r.id, me.id, v_id) on conflict do nothing;
    if not found then raise exception 'You already voted'; end if;

  when 'close_vote' then
$h$ in d) = 0 then raise exception 'hunk 1 missing _a_games'; end if;
  d := replace(d, $h$    insert into ballots (vote_id, room_id, voter_id, choice_id) values (x.id, r.id, me.id, v_id) on conflict do nothing;
    if not found then raise exception 'You already voted'; end if;

  when 'close_vote' then
$h$, $h$    insert into ballots (vote_id, room_id, voter_id, choice_id) values (x.id, r.id, me.id, v_id) on conflict do nothing;
    if not found then raise exception 'You already voted'; end if;
    -- a Trial delivers its verdict the moment the last person who can vote has voted
    if x.kind = 'trial' and cardinality(_vote_waiting(x.id)) = 0 then
      res := _a_games('close_vote', jsonb_build_object('vote_id', x.id), r, me, s, rd, true);
    end if;

  when 'close_vote' then
$h$);
  if position($h$    if v_id is null or v_id = _no_trial() or v_c1 = coalesce(v_c2, -1) or v_c1 * 2 <= v_total then
      v_out := jsonb_build_object('result', 'none', 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = '{}', outcome = v_out where id = x.id;
    elsif _is_guilty(v_id) then
      perform _catch(r.id, v_id);
$h$ in d) = 0 then raise exception 'hunk 2 missing _a_games'; end if;
  d := replace(d, $h$    if v_id is null or v_id = _no_trial() or v_c1 = coalesce(v_c2, -1) or v_c1 * 2 <= v_total then
      v_out := jsonb_build_object('result', 'none', 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = '{}', outcome = v_out where id = x.id;
    elsif _is_guilty(v_id) then
      perform _catch(r.id, v_id);
$h$, $h$    if v_id is null or v_id = _no_trial() or v_c1 = coalesce(v_c2, -1) or v_c1 * 2 <= v_total then
      v_out := jsonb_build_object('result', 'none', 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', ends_at = least(ends_at, now()), result = '{}', outcome = v_out where id = x.id;
    elsif _is_guilty(v_id) then
      perform _catch(r.id, v_id);
$h$);
  if position($h$      v_out := jsonb_build_object('result', 'guilty', 'accused', v_id, 'role', (select public_role from players where id = v_id),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    elsif exists (select 1 from player_secrets ps join players p on p.id = ps.player_id
                   where ps.player_id = v_id and ps.role = 'jester' and not ps.burned and not ps.revenge_used and p.public_role is null) then
$h$ in d) = 0 then raise exception 'hunk 3 missing _a_games'; end if;
  d := replace(d, $h$      v_out := jsonb_build_object('result', 'guilty', 'accused', v_id, 'role', (select public_role from players where id = v_id),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    elsif exists (select 1 from player_secrets ps join players p on p.id = ps.player_id
                   where ps.player_id = v_id and ps.role = 'jester' and not ps.burned and not ps.revenge_used and p.public_role is null) then
$h$, $h$      v_out := jsonb_build_object('result', 'guilty', 'accused', v_id, 'role', (select public_role from players where id = v_id),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', ends_at = least(ends_at, now()), result = array[v_id], outcome = v_out where id = x.id;
    elsif exists (select 1 from player_secrets ps join players p on p.id = ps.player_id
                   where ps.player_id = v_id and ps.role = 'jester' and not ps.burned and not ps.revenge_used and p.public_role is null) then
$h$);
  if position($h$      v_out := jsonb_build_object('result', 'jester', 'accused', v_id, 'role', 'jester', 'accusers', to_jsonb(v_ids),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    else
      v_ids := array(select voter_id from ballots where vote_id = x.id and choice_id = v_id);
$h$ in d) = 0 then raise exception 'hunk 4 missing _a_games'; end if;
  d := replace(d, $h$      v_out := jsonb_build_object('result', 'jester', 'accused', v_id, 'role', 'jester', 'accusers', to_jsonb(v_ids),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    else
      v_ids := array(select voter_id from ballots where vote_id = x.id and choice_id = v_id);
$h$, $h$      v_out := jsonb_build_object('result', 'jester', 'accused', v_id, 'role', 'jester', 'accusers', to_jsonb(v_ids),
                                  'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', ends_at = least(ends_at, now()), result = array[v_id], outcome = v_out where id = x.id;
    else
      v_ids := array(select voter_id from ballots where vote_id = x.id and choice_id = v_id);
$h$);
  if position($h$       where not exists (select 1 from players where id = w.v and public_role = 'angel');   -- the Angel is never punished
      v_out := jsonb_build_object('result', 'innocent', 'accused', v_id, 'accusers', to_jsonb(v_ids), 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    end if;
    perform _event(r.id, 'vote_result', jsonb_build_object('vote', x.id) || v_out);
$h$ in d) = 0 then raise exception 'hunk 5 missing _a_games'; end if;
  d := replace(d, $h$       where not exists (select 1 from players where id = w.v and public_role = 'angel');   -- the Angel is never punished
      v_out := jsonb_build_object('result', 'innocent', 'accused', v_id, 'accusers', to_jsonb(v_ids), 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', result = array[v_id], outcome = v_out where id = x.id;
    end if;
    perform _event(r.id, 'vote_result', jsonb_build_object('vote', x.id) || v_out);
$h$, $h$       where not exists (select 1 from players where id = w.v and public_role = 'angel');   -- the Angel is never punished
      v_out := jsonb_build_object('result', 'innocent', 'accused', v_id, 'accusers', to_jsonb(v_ids), 'votes', v_c1, 'total', v_total);
      update votes set status = 'closed', ends_at = least(ends_at, now()), result = array[v_id], outcome = v_out where id = x.id;
    end if;
    perform _event(r.id, 'vote_result', jsonb_build_object('vote', x.id) || v_out);
$h$);
  execute d;
end $do$;
