-- Stand-ins for the Supabase pieces the migrations rely on (local testing only).
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, is_anonymous boolean not null default false, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;
create schema if not exists realtime;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql as $$ begin perform pg_notify('room_events', topic || '|' || event); end $$;
do $$ begin create role anon nologin; exception when others then null; end $$;
do $$ begin create role authenticated nologin; exception when others then null; end $$;
do $$ begin create role service_role nologin; exception when others then null; end $$;
