-- ============================================================================
-- OPTIONAL — NOT applied by `supabase db push` (it lives outside migrations/).
-- Realtime Authorization: make the `room:<id>` channel private, so only people in
-- the room (a player row, or the host) can receive or send on it.
--
-- HOW TO TURN IT ON (README → Security has the same steps):
--   1. Run this file once (SQL editor, or copy it into migrations/ and db push).
--      Safe on its own: _touch keeps sending the PUBLIC ping as well, so the current
--      site carries on exactly as before.
--   2. Set VITE_REALTIME_PRIVATE=1 in Netlify and redeploy. Clients now join the private
--      channel. Rehearse with 2 phones: the TV must update instantly and emoji must land.
--      If not, unset the variable and redeploy (clients still poll every 3 s anyway).
--   3. Only once 2 works: Realtime → Settings → turn OFF "Allow public access".
--   Rollback: unset the variable; optionally run the ROLLBACK block at the bottom.
--
-- "storage" in the filename: if this file is ever moved into migrations/, the local
-- PGlite mock still skips it (PGlite has no realtime.messages table).
-- ============================================================================

-- Who may use topic 'room:<uuid>': the room's host, or a user with a player row in it.
-- security definer because `authenticated` has no grants on rooms/players. Compares
-- ids as text, so a junk topic is just "no" rather than a uuid cast error.
create or replace function public._rt_member(p_topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_topic like 'room:%' and (
    exists (select 1 from rooms r where r.id::text = substr(p_topic, 6) and r.host_id = auth.uid())
    or exists (select 1 from players p where p.room_id::text = substr(p_topic, 6) and p.user_id = auth.uid())
  )
$$;
revoke all on function public._rt_member(text) from public, anon;
grant execute on function public._rt_member(text) to authenticated;

-- Receive (and join): room members only. Players are anonymous users = role `authenticated`.
drop policy if exists "room members receive" on realtime.messages;
create policy "room members receive" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public._rt_member((select realtime.topic())));

-- Send (emoji reactions from phones): room members only.
drop policy if exists "room members send" on realtime.messages;
create policy "room members send" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public._rt_member((select realtime.topic())));

-- The "changed" ping goes out on BOTH channels during the switch-over, so old (public)
-- and new (private) clients both get it. Once every client is private, the public send
-- can be deleted. Overrides the _touch from 20261001000002_logic.sql (same body otherwise;
-- search_path pinned as hardening.sql did).
create or replace function public._touch(p_room uuid) returns void
language plpgsql set search_path = public as $$
declare v bigint;
begin
  update public.rooms set version = version + 1 where id = p_room returning version into v;
  begin
    perform realtime.send(jsonb_build_object('v', v), 'changed', 'room:' || p_room::text, true);
  exception when others then null;  -- realtime unavailable: clients also poll
  end;
  begin
    perform realtime.send(jsonb_build_object('v', v), 'changed', 'room:' || p_room::text, false);
  exception when others then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- ROLLBACK (run by hand if needed):
--   drop policy if exists "room members receive" on realtime.messages;
--   drop policy if exists "room members send" on realtime.messages;
--   drop function if exists public._rt_member(text);
--   -- and re-run the _touch definition from 20261001000002_logic.sql (public send only),
--   -- then: alter function public._touch(uuid) set search_path = public;
-- ---------------------------------------------------------------------------
