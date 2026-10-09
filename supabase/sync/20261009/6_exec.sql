do $do$
declare d text;
begin
  d := pg_get_functiondef('_exec(uuid,boolean,text,jsonb)'::regprocedure);
  if position($h$  end if;

  if p_action in ('update_settings','generate_cards','get_cards','spare_codes','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide') and not v_host then
$h$ in d) = 0 then raise exception 'hunk 0 missing _exec'; end if;
  d := replace(d, $h$  end if;

  if p_action in ('update_settings','generate_cards','get_cards','spare_codes','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide') and not v_host then
$h$, $h$  end if;

  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide') and not v_host then
$h$);
  if position($h$
  res := case
    when p_action in ('update_settings','generate_cards','get_cards','spare_codes','kick','submit_evidence','hide_evidence','undo')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
$h$ in d) = 0 then raise exception 'hunk 1 missing _exec'; end if;
  d := replace(d, $h$
  res := case
    when p_action in ('update_settings','generate_cards','get_cards','spare_codes','kick','submit_evidence','hide_evidence','undo')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
$h$, $h$
  res := case
    when p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','kick','submit_evidence','hide_evidence','undo')
      then _a_setup(p_action, a, r, me, s, rd, v_host)
    when p_action in ('redeem','expose','unexpose','reveal_all')
$h$);
  execute d;
end $do$;
