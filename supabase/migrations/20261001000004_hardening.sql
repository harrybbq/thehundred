-- Pin search_path on the internal helpers (Supabase advisor: function_search_path_mutable).
alter function public._default_segments() set search_path = public;
alter function public._default_settings() set search_path = public;
alter function public._norm_code(text) set search_path = public;
alter function public._rand_code(int, text) set search_path = public;
alter function public._setting(public.rooms, text) set search_path = public;
alter function public._touch(uuid) set search_path = public;
alter function public._event(uuid, text, jsonb) set search_path = public;
alter function public._wheel(uuid) set search_path = public;
alter function public._landings(jsonb, boolean) set search_path = public;
alter function public._landing_text(jsonb) set search_path = public;
alter function public._new_code(uuid, text, uuid) set search_path = public;
alter function public._cards(uuid) set search_path = public;
alter function public._in_room(uuid, uuid) set search_path = public;
