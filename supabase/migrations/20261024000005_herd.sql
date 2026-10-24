-- =====================================================================
-- THE HERD (an app game, about 6 minutes, everyone): 10 questions, 4 answers each. Don't pick what you think:
-- pick what you think most people will pick. 20 seconds a question (it moves on as soon as everyone is in), and you
-- can change your answer until then. The most-picked answer is THE HERD: everyone else, and anyone who didn't answer,
-- gets a strike. A tie for the most: nobody does. After 10 the most strikes go in the punishment queue (everyone
-- tied: nobody).
-- Secrets: while a question is open the picks stay here (app_secret); everyone sees only who is in, never what they
-- picked. The picks come out together at the reveal.
-- =====================================================================

-- the question bank: [question, answer A, B, C, D]. A room's own questions (settings.herd_questions, same shape) go first.
create or replace function public._herd_bank() returns jsonb language sql immutable set search_path = public as $$
  select '[
    ["The best bit of a roast dinner?", "Roast potatoes", "Yorkshire pudding", "The gravy", "Pigs in blankets"],
    ["The best crisp flavour?", "Salt and vinegar", "Cheese and onion", "Ready salted", "Prawn cocktail"],
    ["The best biscuit with a brew?", "Chocolate digestive", "Hobnob", "Custard cream", "Rich tea"],
    ["The best takeaway after a night out?", "Kebab", "The chippy", "Pizza", "Maccies"],
    ["The best Christmas film?", "Home Alone", "Elf", "Love Actually", "Die Hard"],
    ["The worst chore?", "Washing up", "Hoovering", "Ironing", "Cleaning the loo"],
    ["The best pint?", "Lager", "Guinness", "Cider", "Pale ale"],
    ["The best chocolate bar?", "Twix", "Dairy Milk", "Kit Kat", "Mars"],
    ["The best day of the week?", "Friday", "Saturday", "Sunday", "Payday"],
    ["The best James Bond?", "Daniel Craig", "Sean Connery", "Pierce Brosnan", "Roger Moore"],
    ["The best bit of a fry-up?", "Bacon", "Sausage", "Hash brown", "Black pudding"],
    ["The best superpower?", "Flying", "Invisibility", "Reading minds", "Teleporting"],
    ["The best sandwich?", "Bacon butty", "Chip butty", "BLT", "Cheese and pickle"],
    ["The best pizza topping?", "Pepperoni", "Ham and pineapple", "Margherita", "BBQ chicken"],
    ["The worst job?", "Traffic warden", "Call centre", "Sewer worker", "Taxman"],
    ["The best Only Fools character?", "Del Boy", "Rodney", "Trigger", "Uncle Albert"],
    ["The best thing about summer?", "Beer gardens", "BBQs", "Festivals", "Holidays"],
    ["The best decade for music?", "The 80s", "The 90s", "The 2000s", "Right now"],
    ["The best thing on chips?", "Ketchup", "Mayo", "Curry sauce", "Gravy"],
    ["The best hangover cure?", "Staying in bed", "A fry-up", "Hair of the dog", "Netflix"],
    ["The best Hogwarts house?", "Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"],
    ["The best soap?", "EastEnders", "Corrie", "Emmerdale", "Hollyoaks"],
    ["The best cereal?", "Crunchy Nut", "Coco Pops", "Weetabix", "Frosties"],
    ["The best cheese?", "Cheddar", "Brie", "Mozzarella", "Halloumi"],
    ["The best animal?", "Dog", "Cat", "Lion", "Otter"],
    ["The worst thing on a night out?", "Bar queues", "Losing your mates", "A dead phone", "Missing the last train"],
    ["The best fast food?", "McDonald''s", "KFC", "Burger King", "Greggs"],
    ["The best thing at Greggs?", "Sausage roll", "Steak bake", "Vegan sausage roll", "A doughnut"],
    ["The best sport to watch?", "Football", "Darts", "Boxing", "F1"],
    ["The best Disney film?", "The Lion King", "Toy Story", "Aladdin", "Frozen"],
    ["The first drink of the night?", "A pint", "A shot", "A cocktail", "Prosecco"],
    ["The best Spice Girl?", "Sporty", "Scary", "Baby", "Ginger"],
    ["The best seat in the pub?", "At the bar", "Beer garden", "A booth", "By the fire"],
    ["The worst crime?", "Milk in first", "Pineapple on pizza", "Socks and sandals", "Not thanking the driver"],
    ["The best way to have an egg?", "Fried", "Scrambled", "Boiled", "Poached"],
    ["The best sweets?", "Haribo", "Skittles", "Wine gums", "Jelly babies"],
    ["The best Friends character?", "Joey", "Chandler", "Ross", "Phoebe"],
    ["The best season?", "Summer", "Autumn", "Winter", "Spring"],
    ["The best Mario Kart driver?", "Mario", "Yoshi", "Bowser", "Toad"],
    ["The evening meal is called...?", "Tea", "Dinner", "Supper", "Scran"],
    ["The best ice cream?", "Vanilla", "Chocolate", "Mint choc chip", "Cookie dough"],
    ["The best bit of a Sunday?", "A lie-in", "A roast", "The pub", "The football"],
    ["A spare fiver goes on...?", "A pint", "A meal deal", "A scratchcard", "Savings"],
    ["The best song to end the night?", "Mr Brightside", "Sweet Caroline", "Dancing Queen", "Come On Eileen"],
    ["The best kebab?", "Doner", "Chicken shish", "Mixed", "Falafel"],
    ["The best board game?", "Monopoly", "Cluedo", "Scrabble", "Guess Who"],
    ["The best thing about Christmas?", "The food", "Presents", "Time off", "The telly"],
    ["The best way to get home?", "Taxi", "Night bus", "Walk it", "Sleep on a mate''s sofa"]
  ]'::jsonb
$$;

-- the next question onto the board (or the end: THE STRAYS)
create or replace function public._herd_next(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; st jsonb; v_q jsonb; v_max int; v_top uuid[]; v_n int;
begin
  select * into g from games where id = p_game for update;
  st := g.app_state;
  if (st ->> 'n')::int >= (st ->> 'of')::int or jsonb_array_length(coalesce(g.app_secret -> 'deck', '[]')) = 0 then
    -- the most strikes go in the queue; everyone level (or nobody struck): nobody does. Only players still in the game
    -- count (a kick takes them out), and never the Angel (never punished)
    select max(coalesce((st -> 'strikes' ->> p.id::text)::int, 0)), count(*) into v_max, v_n
      from players p where p.id = any (_app_roster(g)) and p.public_role is distinct from 'angel';
    v_top := array(select p.id from players p where p.id = any (_app_roster(g)) and p.public_role is distinct from 'angel'
                     and coalesce((st -> 'strikes' ->> p.id::text)::int, 0) = v_max order by p.seat);
    if coalesce(v_max, 0) = 0 or cardinality(v_top) = v_n then v_top := '{}'; end if;
    update games set app_state = st || jsonb_build_object('phase', 'final', 'until', now() + interval '20 seconds', 'losers', to_jsonb(v_top),
                                                          'answered', '[]'::jsonb)
     where id = g.id;
    return;
  end if;
  v_q := g.app_secret -> 'deck' -> 0;
  update games set app_secret = jsonb_build_object('deck', (g.app_secret -> 'deck') - 0, 'picks', '{}'::jsonb),
         app_state = st || jsonb_build_object('phase', 'ask', 'until', now() + interval '20 seconds', 'n', (st ->> 'n')::int + 1,
                                              'q', v_q, 'answered', '[]'::jsonb, 'asked', coalesce(st -> 'asked', '[]') || jsonb_build_array(v_q ->> 'q'))
   where id = g.id;
end $$;

-- time's up (or everyone is in): the picks come out, and the strays get a strike
create or replace function public._herd_reveal(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; st jsonb; v_picks jsonb; v_counts int[] := array[0,0,0,0]; v_max int; v_herd int; v_struck uuid[] := '{}'; v uuid; x record;
        v_strikes jsonb;
begin
  select * into g from games where id = p_game for update;
  st := g.app_state; v_picks := coalesce(g.app_secret -> 'picks', '{}');
  for x in select key, value::int as i from jsonb_each_text(v_picks) loop v_counts[x.i + 1] := v_counts[x.i + 1] + 1; end loop;
  v_max := (select max(c) from unnest(v_counts) c);
  if v_max > 0 and (select count(*) from unnest(v_counts) c where c = v_max) = 1 then
    v_herd := array_position(v_counts, v_max) - 1;
  end if;
  v_strikes := st -> 'strikes';
  if v_herd is not null then
    foreach v in array _app_roster(g) loop
      if (v_picks ->> v::text) is distinct from v_herd::text then
        v_struck := v_struck || v;
        v_strikes := v_strikes || jsonb_build_object(v::text, coalesce((v_strikes ->> v::text)::int, 0) + 1);
      end if;
    end loop;
  end if;
  update games set app_state = st || jsonb_build_object('phase', 'reveal', 'until', now() + interval '9 seconds', 'strikes', v_strikes,
                                                        'last', jsonb_build_object('counts', to_jsonb(v_counts), 'picks', v_picks,
                                                                                   'herd', v_herd, 'struck', to_jsonb(v_struck)))
   where id = g.id;
end $$;

create or replace function public._herd_init(g games, a jsonb) returns void language plpgsql set search_path = public as $$
declare v_used jsonb; v_deck jsonb; v_own jsonb;
begin
  -- the questions this room hasn't had yet (its own first, then the bank), in a random order, answers shuffled;
  -- 10 to play and up to 3 spares for the host's SKIP
  v_used := coalesce((select jsonb_agg(q) from games x, jsonb_array_elements_text(coalesce(x.app_state -> 'asked', '[]')) q
                       where x.room_id = g.room_id and x.app = 'herd' and x.id <> g.id), '[]');
  v_own := coalesce((select settings -> 'herd_questions' from rooms where id = g.room_id), '[]');
  if jsonb_typeof(v_own) <> 'array' then v_own := '[]'; end if;
  with qs as (
    select t.q, t.n, (t.q ->> 0) as text, t.own from (
      select q, n, true as own from jsonb_array_elements(v_own) with ordinality as o(q, n)
      union all
      select q, n, false from jsonb_array_elements(_herd_bank()) with ordinality as b(q, n)) t
     where jsonb_typeof(t.q) = 'array' and jsonb_array_length(t.q) = 5),
  fresh as (select distinct on (text) * from qs where not (v_used ? text) order by text, own desc),
  pick as (select * from fresh order by own desc, random() limit 13)
  select jsonb_agg(jsonb_build_object('q', left(p.q ->> 0, 90),
           'a', (select jsonb_agg(left(x, 28) order by random()) from jsonb_array_elements_text(p.q - 0) as x))
         order by p.own desc, random()) into v_deck
    from pick p;
  if v_deck is null or jsonb_array_length(v_deck) = 0 then raise exception 'No questions left'; end if;
  update games set
    app_secret = jsonb_build_object('deck', v_deck, 'picks', '{}'::jsonb),
    app_state = jsonb_build_object('phase', 'intro', 'until', now() + interval '15 seconds', 'n', 0, 'of', least(10, jsonb_array_length(v_deck)),
                                   'answered', '[]'::jsonb, 'asked', '[]'::jsonb,
                                   'strikes', (select jsonb_object_agg(v::text, 0) from unnest(_app_roster(g)) v))
   where id = g.id;
end $$;

create or replace function public._herd_move(g games, me players, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare v_pick int;
begin
  if g.app_state ->> 'phase' <> 'ask' or now() > (g.app_state ->> 'until')::timestamptz + interval '2 seconds' then
    raise exception 'Too late: that question has closed';
  end if;
  begin v_pick := (a ->> 'pick')::int; exception when others then v_pick := null; end;
  if v_pick is null or v_pick not between 0 and 3 then raise exception 'Pick an answer'; end if;
  update games set app_secret = jsonb_set(app_secret, '{picks}', coalesce(app_secret -> 'picks', '{}') || jsonb_build_object(me.id::text, v_pick)),
         app_state = case when app_state -> 'answered' ? me.id::text then app_state
                          else jsonb_set(app_state, '{answered}', (app_state -> 'answered') || to_jsonb(me.id::text)) end
   where id = g.id returning * into g;
  -- everyone's in: no need to wait
  if (select count(*) from jsonb_array_elements_text(g.app_state -> 'answered') x(id) where x.id::uuid = any (_app_roster(g)))
     >= cardinality(_app_roster(g)) then perform _herd_reveal(g.id); end if;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._herd_host(g games, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare v_ph text := g.app_state ->> 'phase';
begin
  case a ->> 'op'
  when 'next' then                                   -- START NOW / NEXT QUESTION / CONTINUE
    if v_ph = 'intro' or v_ph = 'reveal' then perform _herd_next(g.id);
    elsif v_ph = 'ask' then perform _herd_reveal(g.id);
    elsif v_ph = 'final' then perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'losers'))::uuid[]);
    end if;
  when 'skip' then                                   -- a dud question: swap it for a spare, nobody struck
    if v_ph <> 'ask' then raise exception 'No question to skip'; end if;
    if jsonb_array_length(coalesce(g.app_secret -> 'deck', '[]')) <= (g.app_state ->> 'of')::int - (g.app_state ->> 'n')::int then
      raise exception 'No spare questions left';
    end if;
    update games set app_state = app_state || jsonb_build_object('n', (app_state ->> 'n')::int - 1,
                                                                 'asked', (app_state -> 'asked') - (jsonb_array_length(app_state -> 'asked') - 1))
     where id = g.id;
    perform _herd_next(g.id);
  when 'stop' then                                   -- end it now: the strikes so far decide (the open question doesn't count)
    if v_ph = 'final' then
      perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'losers'))::uuid[]);
      return '{"ok":true}'::jsonb;
    end if;
    update games set app_state = app_state || jsonb_build_object('of', 0) where id = g.id;
    perform _herd_next(g.id);
  else raise exception 'Unknown key';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._herd_tick(g games) returns boolean language plpgsql set search_path = public as $$
declare v_ph text := g.app_state ->> 'phase';
begin
  if now() < (g.app_state ->> 'until')::timestamptz then return false; end if;
  if v_ph in ('intro', 'reveal') then perform _herd_next(g.id);
  elsif v_ph = 'ask' then perform _herd_reveal(g.id);
  elsif v_ph = 'final' then perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'losers'))::uuid[]);
  end if;
  return true;
end $$;

-- everything on the board is public; a phone also gets its own pick while the question is open
create or replace function public._herd_view(g games, me players, v_host boolean) returns jsonb language sql stable set search_path = public as $$
  select (g.app_state - 'asked')
         || jsonb_build_object('mine', case when me.id is not null and not v_host then
              jsonb_build_object('pick', case when g.app_state ->> 'phase' = 'ask' then (g.app_secret -> 'picks' -> (me.id::text)) end,
                                 'strikes', coalesce((g.app_state -> 'strikes' ->> me.id::text)::int, 0)) end)
$$;

-- ---------- privileges (every _ function is server-only) ----------
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like '\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
