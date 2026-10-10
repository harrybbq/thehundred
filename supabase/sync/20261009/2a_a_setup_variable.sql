do $do$
declare d text;
begin
  d := pg_get_functiondef('_a_setup(text,jsonb,rooms,players,player_secrets,rounds,boolean)'::regprocedure);
  if position($h$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_json jsonb; v_text text; u undo_log; v_int int;
begin
  case p_action
$h$ in d) = 0 then raise exception 'hunk 0 missing _a_setup'; end if;
  d := replace(d, $h$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_json jsonb; v_text text; u undo_log; v_int int;
begin
  case p_action
$h$, $h$
declare
  res jsonb := '{"ok":true}'::jsonb; x record; v_id uuid; v_json jsonb; v_text text; u undo_log; v_int int; v_bool boolean;
begin
  case p_action
$h$);
  execute d;
end $do$;
