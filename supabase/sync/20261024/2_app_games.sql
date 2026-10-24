-- 24 Oct: APP GAMES (The Herd, Odd One Out, Tag Team Chess) and the chess rules engine, plus _curse_targets.
-- Paste the whole file into the Supabase SQL editor and run it once. It is ASCII-only, and it runs through one
-- EXECUTE that strips Windows line endings, so every function's md5 matches the repo whatever the paste did.
-- New: 3 columns on games and the _chess_*, _app_*, _a_app, _herd_*, _odd_*, _ttc_* functions (all revoked).
-- Changed: _curse_targets (whole), and _exec and _state (patched in place: each patch checks the live text first).
do $wrap$ begin execute replace($sync$
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

-- ===== 20261024000003_chess_engine.sql =====
-- TAG TEAM CHESS: a complete chess rules engine in PL/pgSQL (every move is validated on the server).
-- Pure functions on FEN strings; no tables. The game layer builds on these:
--   _chess_start()                      the start position
--   _chess_moves(fen)        text[]     every legal move for the side to move, UCI ('e2e4', 'e1g1', 'e7e8q'), sorted
--   _chess_play(fen, uci)    text       the FEN after the move ('Illegal move' otherwise; 'e7e8' promotes to a queen)
--   _chess_in_check(fen)     boolean    is the side to move in check
--   _chess_status(fen, history)  text   'play' | 'checkmate' | 'stalemate' | 'insufficient' | 'fifty' | 'threefold'
--   _chess_material(fen)     jsonb      {"white_took": "pp", "black_took": "pn", "white_adv": -2}
--   _chess_describe(fen, uci) jsonb     the move in words, for the TV and phones
--   _chess_random(fen)       text       a random legal move (the 30-second timeout), or null when there are none
-- A malformed FEN raises 'Invalid FEN'.
--
-- En passant convention: _chess_play writes the en-passant square only after a double push AND only when the
-- side to move can legally take en passant (as python-chess and lichess do), so equal positions have equal FENs.
-- _chess_moves and _chess_status also accept FENs that always set it after a double push.
--
-- Internal board: a 120-character "mailbox" string (10 columns x 12 rows). Square index m = 22 + file + 10 * rank
-- (file and rank 0-7), so a1 = 22, h1 = 29, a8 = 92, h8 = 99; m % 10 - 2 is the file and m / 10 - 2 the rank.
-- '.' is an empty square and '-' the border (two rows above and below, one column each side), so every
-- piece step from a real square lands inside the string. Directions: +-1 (file), +-10 (rank), +-9/+-11 (diagonals),
-- +-8/+-12/+-19/+-21 (knight). Upper case is White, lower case Black.

-- ---------- board <-> FEN ----------
create or replace function public._chess_board(p_fen text)
returns text language plpgsql immutable set search_path = public as $$
declare
  pl text := split_part(coalesce(p_fen, ''), ' ', 1);
  r text[];
  b text := repeat('-', 21);
  i int;
begin
  if pl !~ '^[pnbrqkPNBRQK1-8]+(/[pnbrqkPNBRQK1-8]+){7}$'
     or split_part(p_fen, ' ', 2) not in ('w', 'b')
     or split_part(p_fen, ' ', 3) !~ '^(-|K?Q?k?q?)$' or split_part(p_fen, ' ', 3) = ''
     or split_part(p_fen, ' ', 4) !~ '^(-|[a-h][36])$'
     or split_part(p_fen, ' ', 5) !~ '^[0-9]*$' or split_part(p_fen, ' ', 6) !~ '^[0-9]*$' then
    raise exception 'Invalid FEN';
  end if;
  pl := replace(replace(replace(replace(replace(replace(replace(replace(pl,
          '8', '........'), '7', '.......'), '6', '......'), '5', '.....'), '4', '....'), '3', '...'), '2', '..'), '1', '.');
  r := string_to_array(pl, '/');
  for i in reverse 8..1 loop          -- rank 1 (the last FEN row) first
    if length(r[i]) <> 8 then raise exception 'Invalid FEN'; end if;
    b := b || r[i] || '--';
  end loop;
  b := b || repeat('-', 19);
  if length(b) - length(replace(b, 'K', '')) <> 1 or length(b) - length(replace(b, 'k', '')) <> 1 then
    raise exception 'Invalid FEN';
  end if;
  return b;
end $$;

create or replace function public._chess_placement(b text)
returns text language sql immutable set search_path = public as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(
           substr(b, 92, 8) || '/' || substr(b, 82, 8) || '/' || substr(b, 72, 8) || '/' || substr(b, 62, 8) || '/' ||
           substr(b, 52, 8) || '/' || substr(b, 42, 8) || '/' || substr(b, 32, 8) || '/' || substr(b, 22, 8),
         '........', '8'), '.......', '7'), '......', '6'), '.....', '5'), '....', '4'), '...', '3'), '..', '2'), '.', '1')
$$;

create or replace function public._chess_sq(p_name text)
returns int language sql immutable set search_path = public as $$
  select case when p_name ~ '^[a-h][1-8]$'
              then 22 + (ascii(p_name) - 97) + 10 * (ascii(substr(p_name, 2, 1)) - 49) end
$$;

create or replace function public._chess_name(p_sq int)
returns text language sql immutable set search_path = public as $$
  select chr(95 + p_sq % 10) || (p_sq / 10 - 1)::text
$$;

create or replace function public._chess_piece_name(p_piece text)
returns text language sql immutable set search_path = public as $$
  select case upper(p_piece) when 'P' then 'pawn' when 'N' then 'knight' when 'B' then 'bishop'
                             when 'R' then 'rook' when 'Q' then 'queen' when 'K' then 'king' end
$$;

create or replace function public._chess_start()
returns text language sql immutable set search_path = public as $$
  select 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'::text
$$;

-- ---------- attacks ----------
-- Is square p_sq attacked by White (p_by_white) or Black on board b?
create or replace function public._chess_attacked(b text, p_sq int, p_by_white boolean)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  d int; t int; c text; n text; k text; r text; q text; bi text;
begin
  if p_by_white then
    if substr(b, p_sq - 9, 1) = 'P' or substr(b, p_sq - 11, 1) = 'P' then return true; end if;
    n := 'N'; k := 'K'; r := 'R'; q := 'Q'; bi := 'B';
  else
    if substr(b, p_sq + 9, 1) = 'p' or substr(b, p_sq + 11, 1) = 'p' then return true; end if;
    n := 'n'; k := 'k'; r := 'r'; q := 'q'; bi := 'b';
  end if;
  foreach d in array array[-21, -19, -12, -8, 8, 12, 19, 21] loop
    if substr(b, p_sq + d, 1) = n then return true; end if;
  end loop;
  foreach d in array array[-10, -1, 1, 10] loop
    t := p_sq + d; c := substr(b, t, 1);
    if c = k then return true; end if;
    while c = '.' loop t := t + d; c := substr(b, t, 1); end loop;
    if c = r or c = q then return true; end if;
  end loop;
  foreach d in array array[-11, -9, 9, 11] loop
    t := p_sq + d; c := substr(b, t, 1);
    if c = k then return true; end if;
    while c = '.' loop t := t + d; c := substr(b, t, 1); end loop;
    if c = bi or c = q then return true; end if;
  end loop;
  return false;
end $$;

-- Can the side to move (p_white) legally take en passant onto square p_ep?
create or replace function public._chess_ep_ok(b text, p_white boolean, p_ep int)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  fwd int := case when p_white then 10 else -10 end;
  mine text := case when p_white then 'P' else 'p' end;
  x int; ks int; tb text;
begin
  if p_ep is null or p_ep / 10 <> (case when p_white then 7 else 4 end)
     or substr(b, p_ep, 1) <> '.' or substr(b, p_ep - fwd, 1) <> (case when p_white then 'p' else 'P' end) then
    return false;
  end if;
  ks := strpos(b, case when p_white then 'K' else 'k' end);
  foreach x in array array[p_ep - fwd - 1, p_ep - fwd + 1] loop
    if substr(b, x, 1) = mine then
      tb := overlay(overlay(overlay(b placing '.' from x for 1) placing mine from p_ep for 1) placing '.' from p_ep - fwd for 1);
      if not _chess_attacked(tb, ks, not p_white) then return true; end if;
    end if;
  end loop;
  return false;
end $$;

-- ---------- legal moves ----------
create or replace function public._chess_moves(p_fen text)
returns text[] language plpgsql immutable set search_path = public as $$
declare
  b text := _chess_board(p_fen);
  w boolean := split_part(p_fen, ' ', 2) = 'w';
  cr text := split_part(p_fen, ' ', 3);
  ep text := split_part(p_fen, ' ', 4);
  own text; opp text; kc text;
  fwd int; srank int; prank int;
  eps int := -1;
  ks int; chk boolean;
  m int; t int; d int; c text; tc text; dirs int[];
  mf int[] := '{}'; mt int[] := '{}'; mk int[] := '{}';   -- pseudo-legal moves; kind 0 plain, 1 en passant, 2 promotion
  res text[] := '{}';
  i int; f int; k int; nb text; mv text; df int; dr int;
begin
  if w then own := 'PNBRQK'; opp := 'pnbrqk'; kc := 'K'; fwd := 10;  srank := 3; prank := 9;
  else      own := 'pnbrqk'; opp := 'PNBRQK'; kc := 'k'; fwd := -10; srank := 8; prank := 2; end if;
  ks := strpos(b, kc);
  chk := _chess_attacked(b, ks, not w);
  if ep <> '-' then
    eps := 22 + ascii(ep) - 97 + 10 * (ascii(substr(ep, 2, 1)) - 49);
    -- only a real target: on the right rank, empty, with the enemy pawn that just double-pushed behind it
    if eps / 10 <> prank - 2 * (fwd / 10) or substr(b, eps, 1) <> '.' or substr(b, eps - fwd, 1) <> (case when w then 'p' else 'P' end) then
      eps := -1;
    end if;
  end if;

  for m in 22..99 loop
    c := substr(b, m, 1);
    continue when strpos(own, c) = 0;
    dirs := null;
    case upper(c)
    when 'P' then
      t := m + fwd;
      if substr(b, t, 1) = '.' then
        mf := mf || m; mt := mt || t; mk := mk || (case when t / 10 = prank then 2 else 0 end);
        if m / 10 = srank and substr(b, t + fwd, 1) = '.' then
          mf := mf || m; mt := mt || (t + fwd); mk := mk || 0;
        end if;
      end if;
      foreach t in array array[m + fwd - 1, m + fwd + 1] loop
        if strpos(opp, substr(b, t, 1)) > 0 then
          mf := mf || m; mt := mt || t; mk := mk || (case when t / 10 = prank then 2 else 0 end);
        elsif t = eps then
          mf := mf || m; mt := mt || t; mk := mk || 1;
        end if;
      end loop;
    when 'N' then
      foreach d in array array[-21, -19, -12, -8, 8, 12, 19, 21] loop
        t := m + d; tc := substr(b, t, 1);
        if tc = '.' or strpos(opp, tc) > 0 then mf := mf || m; mt := mt || t; mk := mk || 0; end if;
      end loop;
    when 'K' then
      foreach d in array array[-11, -10, -9, -1, 1, 9, 10, 11] loop
        t := m + d; tc := substr(b, t, 1);
        if tc = '.' or strpos(opp, tc) > 0 then mf := mf || m; mt := mt || t; mk := mk || 0; end if;
      end loop;
    when 'B' then dirs := array[-11, -9, 9, 11];
    when 'R' then dirs := array[-10, -1, 1, 10];
    else          dirs := array[-11, -10, -9, -1, 1, 9, 10, 11];
    end case;
    if dirs is not null then
      foreach d in array dirs loop
        t := m + d; tc := substr(b, t, 1);
        while tc = '.' loop
          mf := mf || m; mt := mt || t; mk := mk || 0;
          t := t + d; tc := substr(b, t, 1);
        end loop;
        if strpos(opp, tc) > 0 then mf := mf || m; mt := mt || t; mk := mk || 0; end if;
      end loop;
    end if;
  end loop;

  -- keep the moves that don't leave the own king attacked. A piece that isn't on a line with its king can't
  -- uncover it, so only king moves, en passant, moves out of check and moves of possibly pinned pieces are tried.
  for i in 1 .. coalesce(array_length(mf, 1), 0) loop
    f := mf[i]; t := mt[i]; k := mk[i]; c := substr(b, f, 1);
    if c = kc then
      nb := overlay(overlay(b placing '.' from f for 1) placing c from t for 1);
      continue when _chess_attacked(nb, t, not w);
    else
      df := f % 10 - ks % 10; dr := f / 10 - ks / 10;
      if chk or k = 1 or df = 0 or dr = 0 or df = dr or df = -dr then
        nb := overlay(overlay(b placing '.' from f for 1) placing c from t for 1);
        if k = 1 then nb := overlay(nb placing '.' from t - fwd for 1); end if;
        continue when _chess_attacked(nb, ks, not w);
      end if;
    end if;
    mv := chr(95 + f % 10) || (f / 10 - 1)::text || chr(95 + t % 10) || (t / 10 - 1)::text;
    if k = 2 then res := res || array[mv || 'q', mv || 'r', mv || 'b', mv || 'n'];
    else res := res || mv; end if;
  end loop;

  -- castling: the right, king and rook at home, the squares between empty, the king not in check and not
  -- crossing or landing on an attacked square (b1/b8 may be attacked)
  if not chk then
    if w then
      if strpos(cr, 'K') > 0 and substr(b, 26, 1) = 'K' and substr(b, 29, 1) = 'R' and substr(b, 27, 2) = '..'
         and not _chess_attacked(b, 27, false) and not _chess_attacked(b, 28, false) then res := res || 'e1g1'::text; end if;
      if strpos(cr, 'Q') > 0 and substr(b, 26, 1) = 'K' and substr(b, 22, 1) = 'R' and substr(b, 23, 3) = '...'
         and not _chess_attacked(b, 25, false) and not _chess_attacked(b, 24, false) then res := res || 'e1c1'::text; end if;
    else
      if strpos(cr, 'k') > 0 and substr(b, 96, 1) = 'k' and substr(b, 99, 1) = 'r' and substr(b, 97, 2) = '..'
         and not _chess_attacked(b, 97, true) and not _chess_attacked(b, 98, true) then res := res || 'e8g8'::text; end if;
      if strpos(cr, 'q') > 0 and substr(b, 96, 1) = 'k' and substr(b, 92, 1) = 'r' and substr(b, 93, 3) = '...'
         and not _chess_attacked(b, 95, true) and not _chess_attacked(b, 94, true) then res := res || 'e8c8'::text; end if;
    end if;
  end if;

  return array(select x from unnest(res) x order by x collate "C");
end $$;

-- 'e7e8' is taken as 'e7e8q'; anything else not in the legal list raises 'Illegal move'.
create or replace function public._chess_legal_uci(p_fen text, p_uci text)
returns text language plpgsql immutable set search_path = public as $$
declare
  legal text[] := _chess_moves(p_fen);
  mv text := lower(btrim(coalesce(p_uci, '')));
begin
  if mv = any(legal) then return mv; end if;
  if length(mv) = 4 and mv || 'q' = any(legal) then return mv || 'q'; end if;
  raise exception 'Illegal move';
end $$;

-- ---------- making a move ----------
create or replace function public._chess_play(p_fen text, p_uci text)
returns text language plpgsql immutable set search_path = public as $$
declare
  mv text := _chess_legal_uci(p_fen, p_uci);
  b text := _chess_board(p_fen);
  w boolean := split_part(p_fen, ' ', 2) = 'w';
  cr text := replace(split_part(p_fen, ' ', 3), '-', '');
  hm int := coalesce(nullif(split_part(p_fen, ' ', 5), '')::int, 0);
  fm int := coalesce(nullif(split_part(p_fen, ' ', 6), '')::int, 1);
  f int := _chess_sq(substr(mv, 1, 2));
  t int := _chess_sq(substr(mv, 3, 2));
  pc text := substr(b, f, 1);
  cap text := substr(b, t, 1);
  promo text := substr(mv, 5, 1);
  ep text := '-';
begin
  if upper(pc) = 'P' then
    hm := 0;
    if cap = '.' and f % 10 <> t % 10 then        -- en passant: the taken pawn is beside the mover
      b := overlay(b placing '.' from t - (case when w then 10 else -10 end) for 1);
    end if;
  elsif cap <> '.' then hm := 0;
  else hm := hm + 1;
  end if;
  b := overlay(b placing '.' from f for 1);
  b := overlay(b placing (case when promo = '' then pc when w then upper(promo) else promo end) from t for 1);
  if upper(pc) = 'K' then
    cr := case when w then replace(replace(cr, 'K', ''), 'Q', '') else replace(replace(cr, 'k', ''), 'q', '') end;
    if t - f = 2 then        -- castling: the rook jumps over
      b := overlay(overlay(b placing '.' from f + 3 for 1) placing (case when w then 'R' else 'r' end) from f + 1 for 1);
    elsif f - t = 2 then
      b := overlay(overlay(b placing '.' from f - 4 for 1) placing (case when w then 'R' else 'r' end) from f - 1 for 1);
    end if;
  end if;
  -- a rook leaving or taken on its home corner ends that castling right
  if f = 29 or t = 29 then cr := replace(cr, 'K', ''); end if;
  if f = 22 or t = 22 then cr := replace(cr, 'Q', ''); end if;
  if f = 99 or t = 99 then cr := replace(cr, 'k', ''); end if;
  if f = 92 or t = 92 then cr := replace(cr, 'q', ''); end if;
  if upper(pc) = 'P' and abs(t - f) = 20 and _chess_ep_ok(b, not w, (f + t) / 2) then
    ep := _chess_name((f + t) / 2);
  end if;
  return _chess_placement(b) || ' ' || (case when w then 'b' else 'w' end) || ' ' || coalesce(nullif(cr, ''), '-')
         || ' ' || ep || ' ' || hm::text || ' ' || (case when w then fm else fm + 1 end)::text;
end $$;

-- ---------- game state ----------
create or replace function public._chess_in_check(p_fen text)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  b text := _chess_board(p_fen);
  w boolean := split_part(p_fen, ' ', 2) = 'w';
begin
  return _chess_attacked(b, strpos(b, case when w then 'K' else 'k' end), not w);
end $$;

-- The en-passant field as it matters for repetition: the square only if the side to move can legally take there.
create or replace function public._chess_ep_norm(p_fen text)
returns text language plpgsql immutable set search_path = public as $$
declare ep text := split_part(p_fen, ' ', 4);
begin
  if ep = '-' or not _chess_ep_ok(_chess_board(p_fen), split_part(p_fen, ' ', 2) = 'w', _chess_sq(ep)) then return '-'; end if;
  return ep;
end $$;

-- Dead positions with no pawns, rooks or queens: bare kings, a single knight or bishop, or bishops all on one colour
-- (covers K v K, K+N v K, K+B v K and K+B v K+B with same-coloured bishops).
create or replace function public._chess_insufficient(b text)
returns boolean language plpgsql immutable set search_path = public as $$
declare rest text := translate(b, '.-Kk', ''); m int; colours int := 0;
begin
  if rest = '' or length(rest) = 1 and rest ~ '^[NnBb]$' then return true; end if;
  if rest !~ '^[Bb]+$' then return false; end if;
  for m in 22..99 loop
    if substr(b, m, 1) in ('B', 'b') then colours := colours | (1 << ((m % 10 + m / 10) % 2)); end if;
  end loop;
  return colours <> 3;
end $$;

-- p_history holds the FENs of the EARLIER positions in the game (not the current one): the current position counts
-- once, plus once per earlier FEN with the same placement, side to move, castling rights and en-passant square.
-- Order: checkmate / stalemate, then insufficient material, then the fifty-move rule (halfmove clock >= 100),
-- then threefold repetition; otherwise 'play'.
create or replace function public._chess_status(p_fen text, p_history text[] default '{}')
returns text language plpgsql immutable set search_path = public as $$
declare
  b text := _chess_board(p_fen);
  key text := split_part(p_fen, ' ', 1) || ' ' || split_part(p_fen, ' ', 2) || ' ' || split_part(p_fen, ' ', 3);
  epn text;
  seen int := 1;
  h text;
begin
  if cardinality(_chess_moves(p_fen)) = 0 then
    return case when _chess_in_check(p_fen) then 'checkmate' else 'stalemate' end;
  end if;
  if _chess_insufficient(b) then return 'insufficient'; end if;
  if coalesce(nullif(split_part(p_fen, ' ', 5), '')::int, 0) >= 100 then return 'fifty'; end if;
  epn := _chess_ep_norm(p_fen);
  foreach h in array coalesce(p_history, '{}') loop
    if split_part(h, ' ', 1) || ' ' || split_part(h, ' ', 2) || ' ' || split_part(h, ' ', 3) = key
       and _chess_ep_norm(h) = epn then
      seen := seen + 1;
    end if;
  end loop;
  if seen >= 3 then return 'threefold'; end if;
  return 'play';
end $$;

-- Captured pieces like chess.com: white_took = the Black pieces missing from a full set (lower case, pawn to queen),
-- black_took = the White pieces missing; a promoted piece counts as what it is now, never below zero.
-- white_adv = White's material on the board minus Black's (p1 n3 b3 r5 q9).
create or replace function public._chess_material(p_fen text)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  b text := _chess_board(p_fen);
  wp int := length(b) - length(replace(b, 'P', ''));
  wn int := length(b) - length(replace(b, 'N', ''));
  wb int := length(b) - length(replace(b, 'B', ''));
  wr int := length(b) - length(replace(b, 'R', ''));
  wq int := length(b) - length(replace(b, 'Q', ''));
  bp int := length(b) - length(replace(b, 'p', ''));
  bn int := length(b) - length(replace(b, 'n', ''));
  bb int := length(b) - length(replace(b, 'b', ''));
  br int := length(b) - length(replace(b, 'r', ''));
  bq int := length(b) - length(replace(b, 'q', ''));
begin
  return jsonb_build_object(
    'white_took', repeat('p', greatest(0, 8 - bp)) || repeat('n', greatest(0, 2 - bn)) || repeat('b', greatest(0, 2 - bb))
                  || repeat('r', greatest(0, 2 - br)) || repeat('q', greatest(0, 1 - bq)),
    'black_took', repeat('p', greatest(0, 8 - wp)) || repeat('n', greatest(0, 2 - wn)) || repeat('b', greatest(0, 2 - wb))
                  || repeat('r', greatest(0, 2 - wr)) || repeat('q', greatest(0, 1 - wq)),
    'white_adv', (wp + 3 * wn + 3 * wb + 5 * wr + 9 * wq) - (bp + 3 * bn + 3 * bb + 5 * br + 9 * bq));
end $$;

-- A move in words, from the position before it: {"piece": "bishop", "from": "c4", "to": "f7", "captures": "pawn",
-- "check": true, "mate": false, "castle": null, "promotes": null, "en_passant": false}.
create or replace function public._chess_describe(p_fen text, p_uci text)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  mv text := _chess_legal_uci(p_fen, p_uci);
  b text := _chess_board(p_fen);
  f int := _chess_sq(substr(mv, 1, 2));
  t int := _chess_sq(substr(mv, 3, 2));
  pc text := substr(b, f, 1);
  cap text := substr(b, t, 1);
  is_ep boolean := upper(pc) = 'P' and cap = '.' and f % 10 <> t % 10;
  nf text := _chess_play(p_fen, mv);
  chk boolean := _chess_in_check(nf);
begin
  return jsonb_build_object(
    'piece', _chess_piece_name(pc),
    'from', substr(mv, 1, 2),
    'to', substr(mv, 3, 2),
    'captures', case when is_ep then 'pawn' when cap <> '.' then _chess_piece_name(cap) end,
    'check', chk,
    'mate', chk and cardinality(_chess_moves(nf)) = 0,
    'castle', case when upper(pc) = 'K' and t - f = 2 then 'kingside' when upper(pc) = 'K' and f - t = 2 then 'queenside' end,
    'promotes', case when substr(mv, 5, 1) <> '' then _chess_piece_name(substr(mv, 5, 1)) end,
    'en_passant', is_ep);
end $$;

-- volatile, not immutable: it must not be folded into a constant by the planner.
create or replace function public._chess_random(p_fen text)
returns text language sql volatile set search_path = public as $$
  select m from unnest(_chess_moves(p_fen)) m order by random() limit 1
$$;

-- ---------- privileges: internal only (the game layer calls these from api_exec) ----------
revoke all on function public._chess_board(text) from public, anon, authenticated;
revoke all on function public._chess_placement(text) from public, anon, authenticated;
revoke all on function public._chess_sq(text) from public, anon, authenticated;
revoke all on function public._chess_name(int) from public, anon, authenticated;
revoke all on function public._chess_piece_name(text) from public, anon, authenticated;
revoke all on function public._chess_start() from public, anon, authenticated;
revoke all on function public._chess_attacked(text, int, boolean) from public, anon, authenticated;
revoke all on function public._chess_ep_ok(text, boolean, int) from public, anon, authenticated;
revoke all on function public._chess_moves(text) from public, anon, authenticated;
revoke all on function public._chess_legal_uci(text, text) from public, anon, authenticated;
revoke all on function public._chess_play(text, text) from public, anon, authenticated;
revoke all on function public._chess_in_check(text) from public, anon, authenticated;
revoke all on function public._chess_ep_norm(text) from public, anon, authenticated;
revoke all on function public._chess_insufficient(text) from public, anon, authenticated;
revoke all on function public._chess_status(text, text[]) from public, anon, authenticated;
revoke all on function public._chess_material(text) from public, anon, authenticated;
revoke all on function public._chess_describe(text, text) from public, anon, authenticated;
revoke all on function public._chess_random(text) from public, anon, authenticated;

-- ===== 20261024000004_app_games.sql =====
-- =====================================================================
-- APP GAMES: 5-20 minute games the TV runs itself (The Herd, Odd One Out, Tag Team Chess), picked from GAMES
-- next to the real ones. Each is an ordinary row in games (so GAME OVER, the Champ, the Slacker, the Trial, the
-- levels and the caps all follow exactly as for beer pong), plus what the app needs to run it. Living on the games
-- row, an app game rides the host's undo snapshot for free.
--
-- Each kind lives in its own file and provides five functions (g is the game's row, me the caller, or null for
-- the TV):
--   _<kind>_init(g, a)        set up app_state / app_secret for a new game (the players are in g.matchup)
--   _<kind>_move(g, me, a)    a player's move; raises a plain sentence when it's refused
--   _<kind>_host(g, a)        the host's keys (a ->> 'op'); 'stop' ends the game now with what's been played
--   _<kind>_tick(g)           move on if a deadline has passed; true if anything changed
--   _<kind>_view(g, me, host) what this viewer may see: public facts, plus 'mine' (a phone's own secrets)
-- and ends the game with _app_finish(game_id, losers). Kinds: herd, odd, chess (chess is _ttc_*: _chess_* is the
-- rules engine).
-- =====================================================================

alter table public.games
  add column if not exists app        text,     -- 'herd' | 'odd' | 'chess' (null: a real game)
  add column if not exists app_state  jsonb,    -- public: what the TV and every phone may see
  add column if not exists app_secret jsonb;    -- the server's only: the famous name, the picks before the reveal

-- who an app game is played by: everyone in the room except anyone in Davy Jones' Locker (the Angel plays)
create or replace function public._app_players(p_room uuid) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(id order by seat), '{}') from players
   where room_id = p_room and coalesce(locked_until <= now(), true)
$$;

-- the players of an app game, in seat order (g.matchup holds them: one side, or chess's two teams)
create or replace function public._app_roster(g games) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(p.id order by p.seat), '{}') from players p
   where p.id in (select v.id::uuid from jsonb_array_elements(coalesce(g.matchup, '[]')) as sd(side), jsonb_array_elements_text(sd.side) as v(id))
$$;

-- an app game is over: straight into the usual GAME OVER (losers to the queue, then the Champ, the Slacker, the Trial)
create or replace function public._app_finish(p_game uuid, p_losers uuid[]) returns void language plpgsql set search_path = public as $$
declare g games; r rooms;
begin
  select * into g from games where id = p_game and status = 'active' and app is not null;
  if g.id is null then return; end if;
  select * into r from rooms where id = g.room_id;
  -- anyone kicked during the game is gone: finish_game would refuse an unknown player and the game could never end
  p_losers := array(select l from unnest(coalesce(p_losers, '{}'::uuid[])) with ordinality as x(l, n)
                     where exists (select 1 from players where id = x.l and room_id = g.room_id) order by x.n);
  perform _a_games('finish_game', jsonb_build_object('game_id', g.id, 'losers', to_jsonb(p_losers)),
                   r, null::players, null::player_secrets, null::rounds, true);
end $$;

-- the running app game in a room (one game at a time, like the real ones)
create or replace function public._app_live(p_room uuid) returns games language sql stable set search_path = public as $$
  select * from games where room_id = p_room and status = 'active' and app is not null order by created_at desc limit 1
$$;

create or replace function public._a_app(p_action text, a jsonb, r rooms, me players, s player_secrets, rd rounds, v_host boolean)
returns jsonb language plpgsql set search_path = public as $$
declare
  res jsonb := '{"ok":true}'::jsonb; g games; v_kind text; v_ids uuid[]; v_side jsonb; v_res jsonb; v_tick boolean;
  quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
begin
  if p_action = 'app_start' then
    v_kind := a ->> 'kind';
    if v_kind is null or v_kind not in ('herd', 'odd', 'chess') then raise exception 'Pick a game'; end if;
    if r.ended then raise exception 'The night is over'; end if;
    if exists (select 1 from minigames where room_id = r.id and status in ('muster','live')) or not _mg_clear(r.id) then
      raise exception 'The TV is busy. Finish the punishment, the vote, the plate or the mini-game first';
    end if;
    if v_kind = 'chess' then
      -- two teams from THE DRAW (TWO TEAMS: everyone); the engine side of white and black is drawn in _ttc_init
      if coalesce(jsonb_typeof(a -> 'teams'), '') <> 'array' then raise exception 'Draw two teams first'; end if;
      if jsonb_array_length(a -> 'teams') <> 2
         or exists (select 1 from jsonb_array_elements(a -> 'teams') t(side) where jsonb_typeof(t.side) <> 'array' or jsonb_array_length(t.side) = 0) then
        raise exception 'Draw two teams first';
      end if;
      v_side := a -> 'teams';
      v_ids := array(select v.id::uuid from jsonb_array_elements(v_side) as sd(side), jsonb_array_elements_text(sd.side) as v(id));
      if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'Someone is on both teams'; end if;
    else
      v_ids := case when jsonb_typeof(a -> 'player_ids') = 'array'
                    then array(select distinct x::uuid from jsonb_array_elements_text(a -> 'player_ids') as t(x))
                    else _app_players(r.id) end;
      if cardinality(v_ids) < 3 then raise exception 'Needs at least 3 players'; end if;
      v_side := jsonb_build_array(to_jsonb(v_ids));
    end if;
    if exists (select 1 from unnest(v_ids) u where not (u = any (_app_players(r.id)))) then
      raise exception 'Only players in the room (and out of the Locker) can play';
    end if;
    -- a normal game row (start_game refuses if one is already running), then the app's own set-up
    v_res := _a_games('start_game', jsonb_build_object('name', case v_kind when 'herd' then 'The Herd' when 'odd' then 'Odd One Out'
                                                                           else 'Tag Team Chess' end, 'matchup', v_side),
                      r, me, s, rd, true);
    update games set app = v_kind where id = (v_res ->> 'game_id')::uuid returning * into g;
    if v_kind = 'herd' then perform _herd_init(g, a);
    elsif v_kind = 'odd' then perform _odd_init(g, a);
    else perform _ttc_init(g, a);
    end if;
    perform _event(r.id, 'app_start', jsonb_build_object('game', g.id, 'kind', v_kind));   -- the phones buzz
    return v_res;
  end if;

  g := _app_live(r.id);
  if g.id is null or (a ? 'game_id' and g.id::text <> (a ->> 'game_id')) then
    if p_action = 'app_tick' then return quiet; end if;
    raise exception 'That game is over';
  end if;

  -- (each kind is called from its own branch: a branch only needs its kind's functions when it runs)
  if p_action = 'app_tick' then           -- housekeeping (the TV ticks every second, phones past a deadline): anyone
    if g.app = 'herd' then v_tick := _herd_tick(g);
    elsif g.app = 'odd' then v_tick := _odd_tick(g);
    else v_tick := _ttc_tick(g);
    end if;
    return case when v_tick then res else quiet end;
  elsif p_action = 'app_move' then
    if v_host then raise exception 'That''s for the players'; end if;
    if not (me.id = any (_app_roster(g))) then raise exception 'You''re not in this game'; end if;
    if g.app = 'herd' then res := _herd_move(g, me, a);
    elsif g.app = 'odd' then res := _odd_move(g, me, a);
    else res := _ttc_move(g, me, a);
    end if;
  elsif p_action = 'app_host' then
    if g.app = 'herd' then res := _herd_host(g, a);
    elsif g.app = 'odd' then res := _odd_host(g, a);
    else res := _ttc_host(g, a);
    end if;
  end if;
  return coalesce(res, '{"ok":true}'::jsonb);
end $$;

-- this viewer's view of the running app game (null when there isn't one)
create or replace function public._app_view(p_room uuid, me players, v_host boolean) returns jsonb language plpgsql stable set search_path = public as $$
declare g games; v jsonb;
begin
  g := _app_live(p_room);
  if g.id is null then return null; end if;
  if g.app = 'herd' then v := _herd_view(g, me, v_host);
  elsif g.app = 'odd' then v := _odd_view(g, me, v_host);
  else v := _ttc_view(g, me, v_host);
  end if;
  return jsonb_build_object('id', g.id, 'kind', g.app, 'name', g.name, 'players', to_jsonb(_app_roster(g)), 'started_at', g.created_at)
         || coalesce(v, '{}'::jsonb);
end $$;

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

-- ===== 20261024000005_herd.sql =====
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

-- ===== 20261024000006_odd_one_out.sql =====
-- =====================================================================
-- ODD ONE OUT (an app game, about 9 minutes, everyone): 3 rounds. Each round every phone gets the same very famous
-- name, except one: the odd one out's phone only says they're the odd one out. In a random order (the odd one out
-- can go first) everyone says up to 3 words about the name, out loud, 20 seconds each (the speaker's DONE moves it
-- on). Then everyone votes for who they think the odd one out is (never themselves); the vote waits for everyone
-- (the host can end it).
--   Caught (the most votes; a tie that includes them counts): one guess at the name, out loud, and the host judges
--     it on the TV. Wrong: the odd one out loses the round. Right: they pick who loses it instead (anyone else in
--     the game but the Angel).
--   Not caught: whoever the room voted out loses the round (a tie: all of them; nobody voted: nobody).
-- A new name and a new odd one out every round, at random (never by role), and nobody is the odd one out twice in a
-- game until everyone has had a go. The Angel plays but is never the odd one out and never loses a round. At the end
-- every round's losers go in the punishment queue, once for every round they lost.
--
-- Secrets: the name and the odd one out live in app_secret until that round's reveal (caught: the odd one out, then
-- the name at REVEAL THE NAME; not caught: both at once). A phone's `mine` holds only its own card ({famous} or
-- {odd: true}) and its own vote. The ballots never come out: who has voted while it's open, the counts once it closes.
--
-- The board (app_state.phase), each with the deadline the ticks drive:
--   intro    the rules while everyone taps I'M IN (60s, or everyone in, or START ANYWAY)
--   card     a new round: everyone holds to read their card and taps I'VE READ IT (40s, or everyone read)
--   clues    one speaker at a time in a random order, 20s each (DONE or the host's SKIP moves it on)
--   vote     everyone votes on their phone (waits for everyone; END VOTING NOW; a 5 minute backstop)
--   caught   the odd one out is named and says their guess; REVEAL THE NAME once they have (the host only, no
--            deadline: a clock could put the name up before the guess)
--   answer   the name is on the TV: THEY GOT IT / THEY DIDN'T (the host only, no deadline)
--   pick     they named it: they pick who loses the round (45s, then it's picked at random)
--   result   who loses this round (15s, or NEXT ROUND)
--   final    CASE CLOSED: every round, and who goes in the queue (25s, or CONTINUE)
-- Every move of the board bumps app_state.step; the host's keys send the step they were pressed on, so a double tap
-- (or a key pressed on a board that has already moved on) does nothing.
-- =====================================================================

-- the famous people: names everyone at the party will know
create or replace function public._odd_bank() returns jsonb language sql immutable set search_path = public as $$
  select '[
    "David Beckham", "Taylor Swift", "Ed Sheeran", "Adele", "Harry Styles", "Beyonce", "Rihanna", "Lady Gaga",
    "Elton John", "Freddie Mercury", "Madonna", "Elvis Presley", "Dua Lipa", "Stormzy", "Justin Bieber",
    "Britney Spears", "Robbie Williams", "Lewis Capaldi", "Shakira", "Ariana Grande", "Billie Eilish", "Snoop Dogg",
    "Eminem", "David Bowie", "Paul McCartney", "Mick Jagger", "Kylie Minogue", "Cristiano Ronaldo", "Lionel Messi",
    "Wayne Rooney", "Harry Kane", "Marcus Rashford", "Mo Salah", "Peter Crouch", "Gary Lineker", "Erling Haaland",
    "Usain Bolt", "Serena Williams", "Lewis Hamilton", "Andy Murray", "Tyson Fury", "Muhammad Ali", "Michael Jordan",
    "Tom Cruise", "Leonardo DiCaprio", "Brad Pitt", "Keanu Reeves", "The Rock", "Daniel Radcliffe", "Emma Watson",
    "Tom Holland", "Margot Robbie", "Ryan Reynolds", "Jim Carrey", "Mr Bean", "Gordon Ramsay", "David Attenborough",
    "Simon Cowell", "Jeremy Clarkson", "Jamie Oliver", "Kim Kardashian", "Morgan Freeman", "Jackie Chan",
    "Idris Elba", "The Queen", "King Charles", "Prince Harry", "Prince William", "Princess Diana",
    "Winston Churchill", "Albert Einstein", "William Shakespeare", "Napoleon", "Henry VIII", "Isaac Newton",
    "Cleopatra", "Julius Caesar", "Leonardo da Vinci", "Charles Darwin", "Neil Armstrong", "Nelson Mandela",
    "Barack Obama", "Steve Jobs", "Bill Gates", "Oprah Winfrey", "Santa Claus", "Shrek", "Homer Simpson",
    "Mickey Mouse", "SpongeBob", "Harry Potter", "James Bond", "Sherlock Holmes", "Darth Vader", "Batman",
    "Spider-Man", "Super Mario", "Pikachu", "Peppa Pig", "Scooby-Doo", "Paddington Bear", "Winnie the Pooh",
    "Gandalf", "Yoda"
  ]'::jsonb
$$;

-- move the board: patch app_state and bump its step (the caller holds the game's row lock)
create or replace function public._odd_set(p_game uuid, p_patch jsonb) returns void language sql set search_path = public as $$
  update games set app_state = app_state || p_patch || jsonb_build_object('step', coalesce((app_state ->> 'step')::int, 0) + 1)
   where id = p_game
$$;

create or replace function public._odd_angel(p_player uuid) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from players where id = p_player and public_role = 'angel')
$$;

-- who the odd one out may hand the round to: anyone else in the game, but not the Angel or anyone in the Locker now
create or replace function public._odd_targets(g games, p_odd uuid) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(p.id order by p.seat), '{}') from players p
   where p.id = any (_app_roster(g)) and p.id <> p_odd and p.public_role is distinct from 'angel' and coalesce(p.locked_until <= now(), true)
$$;

-- every round's losers in order, once for each round they lost (the Angel never)
create or replace function public._odd_losses(g games) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(l.v::uuid order by r.i, l.j), '{}')
    from jsonb_array_elements(coalesce(g.app_state -> 'rounds', '[]')) with ordinality as r(x, i),
         jsonb_array_elements_text(coalesce(r.x -> 'losers', '[]')) with ordinality as l(v, j)
   where not _odd_angel(l.v::uuid)
$$;

-- the next round onto the board: a fresh name, a fresh odd one out (or, after the last round, CASE CLOSED)
create or replace function public._odd_round(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; st jsonb; sec jsonb; v_names jsonb; v_used jsonb; v_name text; v_pool uuid[]; v_done uuid[]; v_odd uuid;
begin
  select * into g from games where id = p_game for update;
  st := g.app_state; sec := coalesce(g.app_secret, '{}');
  if (st ->> 'n')::int >= (st ->> 'of')::int then perform _odd_final(g.id); return; end if;
  -- a name this room hasn't had (this game's, then every earlier Odd One Out); once they're all used, just not this game's
  v_names := coalesce(sec -> 'names', '[]');
  v_used := v_names || coalesce((select jsonb_agg(r.x ->> 'famous') from games og, jsonb_array_elements(coalesce(og.app_state -> 'rounds', '[]')) as r(x)
                                  where og.room_id = g.room_id and og.app = 'odd' and og.id <> g.id), '[]');
  select b.n into v_name from jsonb_array_elements_text(_odd_bank()) as b(n) where not (v_used ? b.n) order by random() limit 1;
  if v_name is null then
    select b.n into v_name from jsonb_array_elements_text(_odd_bank()) as b(n) where not (v_names ? b.n) order by random() limit 1;
  end if;
  -- the odd one out: anyone playing but the Angel, at random; nobody twice until everyone has had a go
  v_pool := array(select p.id from players p where p.id = any (_app_roster(g)) and p.public_role is distinct from 'angel');
  v_done := array(select x::uuid from jsonb_array_elements_text(coalesce(sec -> 'used_odd', '[]')) as t(x));
  if not exists (select 1 from unnest(v_pool) u where not (u = any (v_done))) then v_done := '{}'; end if;
  select u into v_odd from unnest(v_pool) u where not (u = any (v_done)) order by random() limit 1;
  if v_odd is null or v_name is null then perform _odd_final(g.id); return; end if;   -- (can't happen with 3 players)
  update games set app_secret = jsonb_build_object('famous', v_name, 'odd', v_odd, 'votes', '{}'::jsonb,
                                                   'used_odd', to_jsonb(v_done || v_odd), 'names', v_names || to_jsonb(v_name))
   where id = g.id;
  perform _odd_set(g.id, jsonb_build_object('phase', 'card', 'until', now() + interval '40 seconds', 'n', (st ->> 'n')::int + 1,
                                            'here', '[]'::jsonb, 'read', '[]'::jsonb, 'order', '[]'::jsonb, 'turn', 0,
                                            'voted', '[]'::jsonb, 'last', null));
end $$;

-- the clues: everyone in a random order (no head start: the odd one out can be first)
create or replace function public._odd_clues(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_set(g.id, jsonb_build_object('phase', 'clues', 'until', now() + interval '20 seconds', 'turn', 0,
                                            'order', (select jsonb_agg(u::text order by random()) from unnest(_app_roster(g)) u)));
end $$;

-- the next speaker, or (after the last one) the vote
create or replace function public._odd_turn(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; v_t int;
begin
  select * into g from games where id = p_game for update;
  v_t := (g.app_state ->> 'turn')::int + 1;
  if v_t >= jsonb_array_length(coalesce(g.app_state -> 'order', '[]')) then
    perform _odd_set(g.id, jsonb_build_object('phase', 'vote', 'until', now() + interval '5 minutes', 'voted', '[]'::jsonb));
  else
    perform _odd_set(g.id, jsonb_build_object('turn', v_t, 'until', now() + interval '20 seconds'));
  end if;
end $$;

-- the round is settled: on the board, and into the record for CASE CLOSED
create or replace function public._odd_result(p_game uuid, p_last jsonb) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_set(g.id, jsonb_build_object('phase', 'result', 'until', now() + interval '15 seconds', 'last', p_last,
    'rounds', coalesce(g.app_state -> 'rounds', '[]') || jsonb_build_array(jsonb_build_object(
      'n', (g.app_state ->> 'n')::int, 'famous', p_last -> 'famous', 'odd', p_last -> 'odd', 'outcome', p_last -> 'outcome',
      'accused', p_last -> 'tops', 'picked', p_last -> 'picked', 'losers', p_last -> 'losers'))));
end $$;

-- how many of these player ids (a jsonb array) are still in the game
create or replace function public._odd_in(g games, p_ids jsonb) returns int language sql stable set search_path = public as $$
  select count(*)::int from jsonb_array_elements_text(coalesce(p_ids, '[]')) x(id) where x.id::uuid = any (_app_roster(g))
$$;

-- the vote closes: the counts come out (never the ballots); caught, or the room got it wrong
create or replace function public._odd_close(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; sec jsonb; v_odd uuid; v_counts jsonb; v_max int; v_total int; v_tops uuid[]; v_last jsonb;
begin
  select * into g from games where id = p_game for update;
  sec := g.app_secret; v_odd := (sec ->> 'odd')::uuid;
  if not (v_odd = any (_app_roster(g))) then          -- the odd one out was kicked mid-round: nobody loses this one
    perform _odd_result(g.id, jsonb_build_object('odd', v_odd, 'counts', '{}'::jsonb, 'tops', '[]'::jsonb, 'total', 0,
                                                 'famous', sec ->> 'famous', 'outcome', 'escaped', 'losers', '[]'::jsonb));
    return;
  end if;
  select coalesce(jsonb_object_agg(q.t, q.c), '{}'::jsonb), coalesce(max(q.c), 0), coalesce(sum(q.c), 0)::int into v_counts, v_max, v_total
    from (select value as t, count(*)::int as c from jsonb_each_text(coalesce(sec -> 'votes', '{}')) group by value) q;
  v_tops := array(select p.id from players p where p.id = any (_app_roster(g)) and v_max > 0 and (v_counts ->> p.id::text)::int = v_max order by p.seat);
  v_last := jsonb_build_object('odd', v_odd, 'counts', v_counts, 'tops', to_jsonb(v_tops), 'total', v_total);
  if v_odd = any (v_tops) then
    -- caught (a tie that includes them counts): the odd one out comes out now; the name waits for their guess, and
    -- only the host knows when that's been said (no deadline: the name never goes up before the guess)
    perform _odd_set(g.id, jsonb_build_object('phase', 'caught', 'until', null, 'last', v_last));
  else
    -- got away with it: whoever the room voted out loses the round (all of them on a tie; nobody voted, nobody)
    perform _odd_result(g.id, v_last || jsonb_build_object('famous', sec ->> 'famous', 'outcome', 'escaped',
      'losers', to_jsonb(array(select u from unnest(v_tops) with ordinality as t(u, k) where not _odd_angel(u) order by k))));
  end if;
end $$;

-- REVEAL THE NAME: after the odd one out's guess, the name goes up for the host to judge
create or replace function public._odd_reveal(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_set(g.id, jsonb_build_object('phase', 'answer', 'until', null,
                                            'last', coalesce(g.app_state -> 'last', '{}') || jsonb_build_object('famous', g.app_secret ->> 'famous')));
end $$;

-- THEY GOT IT / THEY DIDN'T
create or replace function public._odd_judge(p_game uuid, p_right boolean) returns void language plpgsql set search_path = public as $$
declare g games; v_last jsonb;
begin
  select * into g from games where id = p_game for update;
  v_last := coalesce(g.app_state -> 'last', '{}') || jsonb_build_object('right', p_right);
  if p_right then
    perform _odd_set(g.id, jsonb_build_object('phase', 'pick', 'until', now() + interval '45 seconds', 'last', v_last));
  else
    perform _odd_result(g.id, v_last || jsonb_build_object('outcome', 'wrong', 'losers', jsonb_build_array(v_last -> 'odd')));
  end if;
end $$;

-- they named it: the one they picked loses the round (p_random: they didn't pick in time)
create or replace function public._odd_pick(p_game uuid, p_target uuid, p_random boolean) returns void language plpgsql set search_path = public as $$
declare g games;
begin
  select * into g from games where id = p_game for update;
  perform _odd_result(g.id, coalesce(g.app_state -> 'last', '{}') || jsonb_build_object('outcome', 'named', 'picked', p_target, 'random', p_random,
    'losers', case when p_target is null then '[]'::jsonb else jsonb_build_array(p_target) end));
end $$;

-- CASE CLOSED: the rounds played (an unfinished round doesn't count)
create or replace function public._odd_final(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; v_all uuid[];
begin
  select * into g from games where id = p_game for update;
  v_all := _odd_losses(g);
  perform _odd_set(g.id, jsonb_build_object('phase', 'final', 'until', now() + interval '25 seconds',
    'losers', to_jsonb(array(select u from (select distinct on (u) u, k from unnest(v_all) with ordinality as t(u, k) order by u, k) d order by d.k)),
    'losses', coalesce((select jsonb_object_agg(u, c) from (select u::text, count(*)::int as c from unnest(v_all) u group by u) q), '{}'::jsonb)));
end $$;

-- over: the usual GAME OVER (once per loser), then one more queue row for every extra round someone lost
create or replace function public._odd_finish(p_game uuid) returns void language plpgsql set search_path = public as $$
declare g games; v_all uuid[]; v_once uuid[];
begin
  select * into g from games where id = p_game for update;
  if g.id is null or g.status <> 'active' then return; end if;
  v_all := _odd_losses(g);
  v_once := array(select u from (select distinct on (u) u, k from unnest(v_all) with ordinality as t(u, k) order by u, k) d order by d.k);
  perform _app_finish(g.id, v_once);
  if (select status from games where id = g.id) = 'ended' then
    insert into queue (room_id, player_id, reason)
    select g.room_id, x.u, 'Lost Odd One Out'
      from (select t.u, min(t.k) as k, count(*) as c from unnest(v_all) with ordinality as t(u, k) group by t.u) x,
           generate_series(2, x.c::int) as s(i)
     where not _odd_angel(x.u)
     order by x.k, s.i;
  end if;
end $$;

create or replace function public._odd_init(g games, a jsonb) returns void language plpgsql set search_path = public as $$
begin
  update games set
    app_secret = jsonb_build_object('votes', '{}'::jsonb, 'used_odd', '[]'::jsonb, 'names', '[]'::jsonb),
    app_state = jsonb_build_object('phase', 'intro', 'until', now() + interval '60 seconds', 'step', 0, 'n', 0, 'of', 3,
                                   'here', '[]'::jsonb, 'read', '[]'::jsonb, 'order', '[]'::jsonb, 'turn', 0, 'voted', '[]'::jsonb,
                                   'last', null, 'rounds', '[]'::jsonb)
   where id = g.id;
end $$;

-- a player's move: {op: 'here'} I'M IN ; {op: 'read'} I'VE READ IT ; {op: 'done', turn} DONE (the speaker only) ;
-- {op: 'vote', player_id} ; {op: 'pick', player_id} (the odd one out, once they've named it)
create or replace function public._odd_move(g games, me players, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare st jsonb := g.app_state; sec jsonb := coalesce(g.app_secret, '{}'); v_ph text := g.app_state ->> 'phase'; v_t uuid; v_late boolean;
        quiet constant jsonb := '{"ok":true,"no_touch":true}'::jsonb;
begin
  v_late := (st ->> 'until') is not null and now() > (st ->> 'until')::timestamptz + interval '2 seconds';
  begin v_t := (a ->> 'player_id')::uuid; exception when others then v_t := null; end;
  case a ->> 'op'
  when 'here' then                                   -- I'M IN (the rules): everyone in, the first round starts
    if v_ph <> 'intro' then return quiet; end if;
    if not (st -> 'here' ? me.id::text) then
      update games set app_state = jsonb_set(app_state, '{here}', (app_state -> 'here') || to_jsonb(me.id::text)) where id = g.id returning * into g;
    end if;
    if _odd_in(g, g.app_state -> 'here') >= cardinality(_app_roster(g)) then perform _odd_round(g.id); end if;
  when 'read' then                                   -- I'VE READ IT: everyone has, the clues start
    if v_ph <> 'card' then return quiet; end if;
    if not (st -> 'read' ? me.id::text) then
      update games set app_state = jsonb_set(app_state, '{read}', (app_state -> 'read') || to_jsonb(me.id::text)) where id = g.id returning * into g;
    end if;
    if _odd_in(g, g.app_state -> 'read') >= cardinality(_app_roster(g)) then perform _odd_clues(g.id); end if;
  when 'done' then                                   -- DONE: only the speaker, only on their own turn
    -- a DONE that crossed with the clock (the turn or the clues already moved on): nothing to do, nothing to say
    if a ? 'turn' and (v_ph <> 'clues' or (a ->> 'turn') is distinct from (st ->> 'turn')) then return quiet; end if;
    if v_ph <> 'clues' then raise exception 'The clues are over'; end if;
    if (st -> 'order' ->> (st ->> 'turn')::int) is distinct from me.id::text
       or (a ? 'turn' and (a ->> 'turn') is distinct from (st ->> 'turn')) then
      raise exception 'It''s not your turn';
    end if;
    perform _odd_turn(g.id);
  when 'vote' then
    if v_ph <> 'vote' or v_late then raise exception 'Too late: the vote has closed'; end if;
    if v_t is null or not (v_t = any (_app_roster(g))) then raise exception 'Pick someone in the game'; end if;
    if v_t = me.id then raise exception 'You can''t vote for yourself'; end if;
    if sec -> 'votes' ? me.id::text then raise exception 'You already voted'; end if;
    update games set app_secret = jsonb_set(app_secret, '{votes}', coalesce(app_secret -> 'votes', '{}') || jsonb_build_object(me.id::text, v_t)),
                     app_state = jsonb_set(app_state, '{voted}', (app_state -> 'voted') || to_jsonb(me.id::text))
     where id = g.id returning * into g;
    -- everyone's in: no need to wait
    if _odd_in(g, g.app_state -> 'voted') >= cardinality(_app_roster(g)) then perform _odd_close(g.id); end if;
  when 'pick' then
    if v_ph <> 'pick' or v_late then raise exception 'Too late to pick'; end if;
    if (sec ->> 'odd') is distinct from me.id::text then raise exception 'Only the odd one out picks'; end if;
    if v_t is null or not (v_t = any (_odd_targets(g, me.id))) then raise exception 'Pick someone else in the game (not the Angel)'; end if;
    perform _odd_pick(g.id, v_t, false);
  else raise exception 'Unknown move';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

-- the host's keys: {op: 'next', step} moves the board on (START ANYWAY, START THE CLUES, SKIP, END VOTING NOW,
-- REVEAL THE NAME, NEXT ROUND, CONTINUE) ; {op: 'judge', right, step} THEY GOT IT / THEY DIDN'T ; {op: 'stop'}
create or replace function public._odd_host(g games, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare v_ph text := g.app_state ->> 'phase';
begin
  -- a doubled tap, or a key pressed on a board that has already moved on: nothing
  if a ? 'step' and (a ->> 'step') is distinct from (g.app_state ->> 'step') then return '{"ok":true,"no_touch":true}'::jsonb; end if;
  case a ->> 'op'
  when 'next' then
    if v_ph in ('intro', 'result') then perform _odd_round(g.id);
    elsif v_ph = 'card' then perform _odd_clues(g.id);
    elsif v_ph = 'clues' then perform _odd_turn(g.id);
    elsif v_ph = 'vote' then perform _odd_close(g.id);
    elsif v_ph = 'caught' then perform _odd_reveal(g.id);
    elsif v_ph = 'final' then perform _odd_finish(g.id);
    elsif v_ph = 'answer' then raise exception 'Did they get it? Tap THEY GOT IT or THEY DIDN''T';
    else raise exception 'The odd one out is picking';
    end if;
  when 'judge' then
    if v_ph <> 'answer' then raise exception 'Nothing to judge'; end if;
    if jsonb_typeof(a -> 'right') is distinct from 'boolean' then raise exception 'Did they get it?'; end if;
    perform _odd_judge(g.id, (a ->> 'right')::boolean);
  when 'stop' then                                   -- end it now: the rounds played so far decide (the open one doesn't count)
    if v_ph = 'final' then perform _odd_finish(g.id); else perform _odd_final(g.id); end if;
  else raise exception 'Unknown key';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._odd_tick(g games) returns boolean language plpgsql set search_path = public as $$
declare v_ph text := g.app_state ->> 'phase';
begin
  -- (REVEAL THE NAME and THEY GOT IT / THEY DIDN'T are the host's alone: a null until never moves on by itself)
  -- in the vote and the pick a phone gets 2 seconds' grace after the deadline (_odd_move): the tick waits it out, so a
  -- pick sent in time is never beaten by the random one
  if (g.app_state ->> 'until') is null
     or now() < (g.app_state ->> 'until')::timestamptz + (case when v_ph in ('vote', 'pick') then interval '2 seconds' else interval '0' end) then
    return false;
  end if;
  if v_ph in ('intro', 'result') then perform _odd_round(g.id);
  elsif v_ph = 'card' then perform _odd_clues(g.id);
  elsif v_ph = 'clues' then perform _odd_turn(g.id);
  elsif v_ph = 'vote' then perform _odd_close(g.id);
  elsif v_ph = 'pick' then                           -- they didn't pick in time: picked at random for them
    perform _odd_pick(g.id, (select u from unnest(_odd_targets(g, (g.app_secret ->> 'odd')::uuid)) u order by random() limit 1), true);
  elsif v_ph = 'final' then perform _odd_finish(g.id);
  else return false;
  end if;
  return true;
end $$;

-- the board is public as it stands (nothing secret is written to it before its reveal); a phone in the game also gets
-- its own card while the round is open, and its own vote
create or replace function public._odd_view(g games, me players, v_host boolean) returns jsonb language sql stable set search_path = public as $$
  select g.app_state
         || jsonb_build_object('mine', case when me.id is not null and not v_host and me.id = any (_app_roster(g)) then
              jsonb_strip_nulls(
                case when g.app_state ->> 'phase' in ('card', 'clues', 'vote', 'caught', 'answer', 'pick') then
                  case when g.app_secret ->> 'odd' = me.id::text then jsonb_build_object('odd', true)
                       else jsonb_build_object('famous', g.app_secret ->> 'famous') end
                else '{}'::jsonb end
                || jsonb_build_object('vote', g.app_secret -> 'votes' -> (me.id::text))) end)
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

-- ===== 20261024000007_tag_team_chess.sql =====
-- =====================================================================
-- TAG TEAM CHESS (an app game, up to about 20 minutes): two teams from THE DRAW, one board on the TV, everyone moves
-- from their phone. Which team is white is drawn here, at random, and so is the order inside each team. The move goes
-- round each team: white's player 1, black's player 1, white's player 2, black's player 2... each team loops back to
-- its own player 1 (a team of 3 and a team of 2 each cycle their own list). Classic chess, every rule, checked by the
-- engine (_chess_*, 20261024000003_chess_engine.sql). No conferring (honour system: a sign on the TV and the phones).
--   Chess clocks: 10 minutes a team, running only on that team's turn; run out and that team loses (a flag).
--   30 seconds a move: miss it and a random legal move is played for that player, and the turn passes on as normal.
--   Checkmate or a flag: the whole losing team goes in the punishment queue. Any draw (stalemate, not enough pieces,
--   the fifty-move rule, threefold repetition) or the host's END GAME: nobody does. Then the usual GAME OVER.
-- Phases: intro (the teams and the rules, 15 s; the host's START NOW) -> play -> end (the result, held 20 s; the
-- host's CONTINUE) -> _app_finish.
-- Chess has no secrets, so app_state is the whole game, the same for every viewer. The engine costs ~2 ms a call, so
-- the legal moves are worked out once per move and stored (the view never calls the engine: 17 phones poll it).
-- app_secret only keeps the earlier positions for threefold repetition, since the last capture or pawn move (nothing
-- before one can come round again).
-- Clocks: clock = each side's remaining ms when the current turn started (turn_at); the side to move's clock runs
-- from turn_at. The deadline is turn_at + the 30 s, or + what's left on the clock if that's less; until mirrors it
-- (the TV and phones count down to it). A move is still taken up to 2 s after the deadline (it may have been sent in
-- time), and only then does the tick settle it: a flag if the clock ran out, otherwise a random move.
-- The player to move may also "touch" a piece (a = {touch: 'c4'}): the TV lights up where it can go. Nothing else.
-- =====================================================================

-- the team (move order) playing a side, and the other side
create or replace function public._ttc_roster(st jsonb, p_side text) returns jsonb language sql immutable set search_path = public as $$
  select case p_side when 'w' then st -> 'white' else st -> 'black' end
$$;
-- the first player at or after this place in the team's order who is still in the room (a kick takes them out of
-- the rotation instead of leaving their turns to run out); the same place if none are
create or replace function public._ttc_live(p_team jsonb, p_from int) returns int language sql stable set search_path = public as $$
  select coalesce((select (p_from + k) % jsonb_array_length(p_team) from generate_series(0, jsonb_array_length(p_team) - 1) k
                    where exists (select 1 from players where id = (p_team ->> ((p_from + k) % jsonb_array_length(p_team)))::uuid)
                    order by k limit 1), p_from)
$$;
create or replace function public._ttc_other(p_side text) returns text language sql immutable set search_path = public as $$
  select case p_side when 'w' then 'b' else 'w' end
$$;

-- the turn's deadline: 30 seconds, or the flag if the side to move has less than that on its clock
create or replace function public._ttc_deadline(st jsonb) returns timestamptz language sql stable set search_path = public as $$
  select (st ->> 'turn_at')::timestamptz
         + make_interval(secs => least((st ->> 'move_ms')::bigint, (st -> 'clock' ->> (st ->> 'turn'))::bigint) / 1000.0)
$$;

create or replace function public._ttc_init(g games, a jsonb) returns void language plpgsql set search_path = public as $$
declare v_w int := case when random() < .5 then 0 else 1 end; v_white jsonb; v_black jsonb; v_fen text := _chess_start();
begin
  -- g.matchup = [teamA, teamB] from THE DRAW (app_start checked they're in the room); colours and the order inside
  -- each team are drawn here. Checked again: app_start's own check lets a missing teams key through (null <> 'array'),
  -- and raising here rolls the whole start back.
  if coalesce(jsonb_typeof(g.matchup), '') <> 'array' then raise exception 'Draw two teams first'; end if;
  if jsonb_array_length(g.matchup) <> 2 then raise exception 'Draw two teams first'; end if;
  if exists (select 1 from jsonb_array_elements(g.matchup) t(side) where coalesce(jsonb_typeof(t.side), '') <> 'array') then
    raise exception 'Draw two teams first';
  end if;
  if exists (select 1 from jsonb_array_elements(g.matchup) t(side) where jsonb_array_length(t.side) = 0) then
    raise exception 'Draw two teams first';
  end if;
  v_white := (select jsonb_agg(x order by random()) from jsonb_array_elements(g.matchup -> v_w) x);
  v_black := (select jsonb_agg(x order by random()) from jsonb_array_elements(g.matchup -> (1 - v_w)) x);
  update games set
    app_secret = jsonb_build_object('history', '[]'::jsonb),
    app_state = jsonb_build_object(
      'phase', 'intro', 'until', now() + interval '15 seconds',
      'white', v_white, 'black', v_black,
      'fen', v_fen, 'legal', to_jsonb(_chess_moves(v_fen)), 'turn', 'w',
      'idx', jsonb_build_object('w', 0, 'b', 0),          -- who plays each side's next move (an index into its team)
      'mover', v_white -> 0,
      'team_ms', 600000, 'move_ms', 30000, 'clock', jsonb_build_object('w', 600000, 'b', 600000), 'turn_at', null,
      'ply', 0, 'moves', '[]'::jsonb, 'check', false, 'material', _chess_material(v_fen), 'touch', null, 'result', null)
   where id = g.id;
end $$;

-- the clocks start: white's first player is on the move
create or replace function public._ttc_begin(p_game uuid) returns void language plpgsql set search_path = public as $$
declare st jsonb;
begin
  select app_state into st from games where id = p_game for update;
  st := st || jsonb_build_object('phase', 'play', 'turn_at', now(), 'touch', null);
  update games set app_state = st || jsonb_build_object('until', _ttc_deadline(st)) where id = p_game;
end $$;

-- the end of the game (the board stays up, held 20 s): checkmate / flag (p_winner wins, the other team loses), a draw
-- or the host's stop (nobody). A clock that was running stops where it is.
create or replace function public._ttc_end(p_game uuid, p_kind text, p_winner text) returns void language plpgsql set search_path = public as $$
declare st jsonb; v_side text; v_left bigint;
begin
  select app_state into st from games where id = p_game for update;
  v_side := st ->> 'turn';
  if st ->> 'phase' = 'play' and st ->> 'turn_at' is not null then
    v_left := greatest(0, (st -> 'clock' ->> v_side)::bigint
                          - (extract(epoch from now() - (st ->> 'turn_at')::timestamptz) * 1000)::bigint);
    if p_kind = 'flag' then v_left := 0; end if;
    st := jsonb_set(st, array['clock', v_side], to_jsonb(v_left));
  end if;
  update games set app_state = st || jsonb_build_object(
      'phase', 'end', 'until', now() + interval '20 seconds', 'mover', null, 'touch', null,
      'result', jsonb_build_object('kind', p_kind, 'winner', p_winner,
                                   'losers', case when p_winner is null then '[]'::jsonb else _ttc_roster(st, _ttc_other(p_winner)) end))
   where id = p_game;
end $$;

-- play a move (already checked against the legal list): the clock, the next player of each team, the new position
-- and its legal moves (worked out once, here), and whether that's the end
create or replace function public._ttc_play(p_game uuid, p_uci text, p_auto boolean) returns void language plpgsql set search_path = public as $$
declare
  g games; st jsonb; v_side text; v_other text; v_fen text; v_new text; v_desc jsonb; v_legal text[]; v_hist jsonb;
  v_clock bigint; v_used bigint; v_idx int; v_oidx int; v_moves jsonb; v_status text;
begin
  select * into g from games where id = p_game for update;
  st := g.app_state;
  v_side := st ->> 'turn'; v_other := _ttc_other(v_side); v_fen := st ->> 'fen';
  v_desc := _chess_describe(v_fen, p_uci);                 -- once per move (it's the expensive one)
  v_new := _chess_play(v_fen, p_uci);
  v_legal := _chess_moves(v_new);
  -- the time this turn took; a move in the 2-second grace counts as made on the deadline, a random move as 30 s
  v_clock := (st -> 'clock' ->> v_side)::bigint;
  v_used := case when p_auto then (st ->> 'move_ms')::bigint
                 else (extract(epoch from now() - (st ->> 'turn_at')::timestamptz) * 1000)::bigint end;
  v_used := greatest(0, least(v_used, (st ->> 'move_ms')::bigint, v_clock));
  -- the earlier positions for threefold: a capture or a pawn move (halfmove clock 0) means none can recur
  v_hist := case when split_part(v_new, ' ', 5) = '0' then '[]'::jsonb
                 else coalesce(g.app_secret -> 'history', '[]'::jsonb) || to_jsonb(v_fen) end;
  -- this team's next player; the move list keeps the last 8 (ply counts them all)
  v_idx := ((st -> 'idx' ->> v_side)::int + 1) % jsonb_array_length(_ttc_roster(st, v_side));
  v_moves := coalesce(st -> 'moves', '[]'::jsonb) || (v_desc || jsonb_build_object(
               'ply', (st ->> 'ply')::int + 1, 'side', v_side, 'by', st -> 'mover', 'uci', p_uci, 'auto', p_auto));
  while jsonb_array_length(v_moves) > 8 loop v_moves := v_moves - 0; end loop;
  v_oidx := _ttc_live(_ttc_roster(st, v_other), (st -> 'idx' ->> v_other)::int);   -- the other team's next player still here
  st := st || jsonb_build_object(
    'fen', v_new, 'legal', to_jsonb(v_legal), 'turn', v_other,
    'idx', jsonb_set(jsonb_set(st -> 'idx', array[v_side], to_jsonb(v_idx)), array[v_other], to_jsonb(v_oidx)),
    'mover', _ttc_roster(st, v_other) -> v_oidx,
    'clock', jsonb_set(st -> 'clock', array[v_side], to_jsonb(v_clock - v_used)),
    'turn_at', now(), 'ply', (st ->> 'ply')::int + 1, 'moves', v_moves,
    'check', coalesce((v_desc ->> 'check')::boolean, false), 'material', _chess_material(v_new), 'touch', null);
  st := st || jsonb_build_object('until', _ttc_deadline(st));
  update games set app_state = st, app_secret = coalesce(app_secret, '{}'::jsonb) || jsonb_build_object('history', v_hist) where id = p_game;

  v_status := case when cardinality(v_legal) = 0 then (case when (v_desc ->> 'check')::boolean then 'checkmate' else 'stalemate' end)
                   else _chess_status(v_new, array(select jsonb_array_elements_text(v_hist))) end;
  if v_status = 'checkmate' then perform _ttc_end(p_game, 'checkmate', v_side);
  elsif v_status <> 'play' then perform _ttc_end(p_game, v_status, null);
  end if;
end $$;

create or replace function public._ttc_move(g games, me players, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare st jsonb; v_side text; v_uci text; v_sq text;
begin
  select * into g from games where id = g.id for update;  -- one at a time with the tick's random move: re-read, re-check
  st := g.app_state;
  v_side := case when st -> 'white' ? me.id::text then 'w' when st -> 'black' ? me.id::text then 'b' end;
  if v_side is null then raise exception 'You''re not in this game'; end if;
  if st ->> 'phase' = 'intro' then raise exception 'The clocks haven''t started yet'; end if;
  if st ->> 'phase' <> 'play' then raise exception 'The game is over'; end if;
  if a ? 'ply' and (a ->> 'ply') is distinct from (st ->> 'ply') then raise exception 'Too late: the board has moved on'; end if;
  if st ->> 'turn' <> v_side then
    raise exception 'It''s %''s move', case st ->> 'turn' when 'w' then 'white' else 'black' end;
  end if;
  if st ->> 'mover' <> me.id::text then
    raise exception 'It''s %''s move', coalesce((select name from players where id = (st ->> 'mover')::uuid), 'someone else');
  end if;
  if now() > _ttc_deadline(st) + interval '2 seconds' then raise exception 'Too late: time ran out'; end if;

  if a ? 'touch' and not a ? 'uci' then                   -- the piece you're thinking about, for the TV (or none)
    v_sq := lower(a ->> 'touch');
    if v_sq is not null and not exists (select 1 from jsonb_array_elements_text(st -> 'legal') m where left(m, 2) = v_sq) then
      v_sq := null;
    end if;
    if (st ->> 'touch') is not distinct from v_sq then return '{"ok":true,"no_touch":true}'::jsonb; end if;
    update games set app_state = app_state || jsonb_build_object('touch', v_sq) where id = g.id;
    return '{"ok":true}'::jsonb;
  end if;

  v_uci := lower(btrim(coalesce(a ->> 'uci', '')));
  if not (st -> 'legal' ? v_uci) then
    if length(v_uci) = 4 and st -> 'legal' ? (v_uci || 'q') then v_uci := v_uci || 'q';   -- 'e7e8' is a queen
    else raise exception 'Illegal move'; end if;
  end if;
  perform _ttc_play(g.id, v_uci, false);
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._ttc_host(g games, a jsonb) returns jsonb language plpgsql set search_path = public as $$
declare v_ph text;
begin
  select * into g from games where id = g.id for update;
  v_ph := g.app_state ->> 'phase';
  case a ->> 'op'
  when 'next' then                                   -- START NOW (the intro) / CONTINUE (the result)
    if v_ph = 'intro' then perform _ttc_begin(g.id);
    elsif v_ph = 'end' then perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'result' -> 'losers'))::uuid[]);
    else raise exception 'The game is on. END GAME stops it';
    end if;
  when 'stop' then                                   -- END GAME: a draw, nobody loses (on the result: it stands)
    if v_ph = 'end' then perform _app_finish(g.id, array(select jsonb_array_elements_text(g.app_state -> 'result' -> 'losers'))::uuid[]);
    else perform _ttc_end(g.id, 'stopped', null);
    end if;
  else raise exception 'Unknown key';
  end case;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function public._ttc_tick(g games) returns boolean language plpgsql set search_path = public as $$
declare st jsonb; v_side text; v_uci text;
begin
  select * into g from games where id = g.id for update;
  st := g.app_state;
  if st ->> 'phase' = 'intro' then
    if now() < (st ->> 'until')::timestamptz then return false; end if;
    perform _ttc_begin(g.id);
  elsif st ->> 'phase' = 'end' then
    if now() < (st ->> 'until')::timestamptz then return false; end if;
    perform _app_finish(g.id, array(select jsonb_array_elements_text(st -> 'result' -> 'losers'))::uuid[]);
  else
    -- nothing until 2 s past the deadline: a move sent in time may still be on its way
    if now() < _ttc_deadline(st) + interval '2 seconds' then return false; end if;
    v_side := st ->> 'turn';
    if (st -> 'clock' ->> v_side)::bigint <= (st ->> 'move_ms')::bigint then
      perform _ttc_end(g.id, 'flag', _ttc_other(v_side));          -- the team's clock ran out first: they lose on time
    else
      v_uci := _chess_random(st ->> 'fen');                         -- 30 seconds up: a random legal move for them
      if v_uci is null then perform _ttc_end(g.id, 'stalemate', null);
      else perform _ttc_play(g.id, v_uci, true);
      end if;
    end if;
  end if;
  return true;
end $$;

-- everything is public (chess has no secrets); a phone in the game also gets its side and how soon its turn comes:
-- next_up_in = how many moves (both sides') until it's yours, 0 = it's yours now
create or replace function public._ttc_view(g games, me players, v_host boolean) returns jsonb language plpgsql stable set search_path = public as $$
declare st jsonb := g.app_state; v_side text; v_ros jsonb; v_i int; v_n int; v_k int;
begin
  if me.id is not null and not v_host then
    v_side := case when st -> 'white' ? me.id::text then 'w' when st -> 'black' ? me.id::text then 'b' end;
  end if;
  if v_side is null then return st || jsonb_build_object('mine', null); end if;
  v_ros := _ttc_roster(st, v_side);
  v_n := jsonb_array_length(v_ros);
  select o.n - 1 into v_i from jsonb_array_elements_text(v_ros) with ordinality as o(id, n) where o.id = me.id::text;
  v_k := ((v_i - (st -> 'idx' ->> v_side)::int) % v_n + v_n) % v_n;     -- this team's moves before mine
  return st || jsonb_build_object('mine', jsonb_build_object(
    'side', v_side,
    'my_turn', st ->> 'phase' = 'play' and st ->> 'mover' = me.id::text,
    'next_up_in', 2 * v_k + case when st ->> 'turn' = v_side then 0 else 1 end));
end $$;

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

-- ===== _exec: 5 patch(es) on the live function =====
do $do$
declare d text;
begin
  d := pg_get_functiondef('public._exec(uuid,boolean,text,jsonb)'::regprocedure);
  if position($o1$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide','decide_rejoin') and not v_host then
    raise exception 'Only the host can do that';
  end if;$o1$ in d) > 0 then d := replace(d, $o1$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide','decide_rejoin') and not v_host then
    raise exception 'Only the host can do that';
  end if;$o1$, $n1$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide','decide_rejoin',
                  'app_start','app_host') and not v_host then
    raise exception 'Only the host can do that';
  end if;$n1$);
  elsif position($n1$  if p_action in ('update_settings','generate_cards','random_deal','get_cards','spare_codes','late_pile','start_game','finish_game','start_vote','queue_add','queue_remove',
                  'call_next','round_revealed','accept','finish_saved','cancel_round','remove_graffiti','expose',
                  'unexpose','reveal_all','kick','undo','hide_evidence','free_spin','decide_lock','lock','unlock','make_angel','mg_decide','decide_rejoin',
                  'app_start','app_host') and not v_host then
    raise exception 'Only the host can do that';
  end if;$n1$ in d) = 0 then raise exception '_exec: patch 1 does not match the live function'; end if;
  if position($o2$                  'betrayer_guess','betrayer_hint','request_curse_pass','cast_vote','submit_evidence','request_lock','davy_lock','take_it',
                  'ninja_strike','holy_nova','angel_bless','dredd_shame','shiv','bbq_pick','forged_orders','bet','shop',
                  'dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move') and me.id is null then
    raise exception 'Join the room first';
  end if;
$o2$ in d) > 0 then d := replace(d, $o2$                  'betrayer_guess','betrayer_hint','request_curse_pass','cast_vote','submit_evidence','request_lock','davy_lock','take_it',
                  'ninja_strike','holy_nova','angel_bless','dredd_shame','shiv','bbq_pick','forged_orders','bet','shop',
                  'dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move') and me.id is null then
    raise exception 'Join the room first';
  end if;
$o2$, $n2$                  'betrayer_guess','betrayer_hint','request_curse_pass','cast_vote','submit_evidence','request_lock','davy_lock','take_it',
                  'ninja_strike','holy_nova','angel_bless','dredd_shame','shiv','bbq_pick','forged_orders','bet','shop',
                  'dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','app_move') and me.id is null then
    raise exception 'Join the room first';
  end if;

  -- an app game has the TV for as long as it runs: no mini-game or plate can be called onto it
  if p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','bbq_start')
     and exists (select 1 from games where room_id = r.id and status = 'active' and app is not null) then
    raise exception 'The TV is running a game. Try again when it''s over';
  end if;
$n2$);
  elsif position($n2$                  'betrayer_guess','betrayer_hint','request_curse_pass','cast_vote','submit_evidence','request_lock','davy_lock','take_it',
                  'ninja_strike','holy_nova','angel_bless','dredd_shame','shiv','bbq_pick','forged_orders','bet','shop',
                  'dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','app_move') and me.id is null then
    raise exception 'Join the room first';
  end if;

  -- an app game has the TV for as long as it runs: no mini-game or plate can be called onto it
  if p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','bbq_start')
     and exists (select 1 from games where room_id = r.id and status = 'active' and app is not null) then
    raise exception 'The TV is running a game. Try again when it''s over';
  end if;
$n2$ in d) = 0 then raise exception '_exec: patch 2 does not match the live function'; end if;
  if position($o3$  if v_host and (p_action in ('accept','finish_saved','cancel_round','call_next','start_game','finish_game','start_vote','close_vote',
                              'expose','unexpose','kick','queue_add','queue_remove','remove_graffiti','hide_evidence','free_spin',
                              'jester_revenge','decide_lock','lock','unlock','make_angel','bbq_start','bbq_close')
                 or (p_action = 'log_beer' and me.id is null)) then
    insert into undo_log (room_id, action, label, snap) values (r.id, p_action, _undo_label(p_action, a), _snapshot(r.id));$o3$ in d) > 0 then d := replace(d, $o3$  if v_host and (p_action in ('accept','finish_saved','cancel_round','call_next','start_game','finish_game','start_vote','close_vote',
                              'expose','unexpose','kick','queue_add','queue_remove','remove_graffiti','hide_evidence','free_spin',
                              'jester_revenge','decide_lock','lock','unlock','make_angel','bbq_start','bbq_close')
                 or (p_action = 'log_beer' and me.id is null)) then
    insert into undo_log (room_id, action, label, snap) values (r.id, p_action, _undo_label(p_action, a), _snapshot(r.id));$o3$, $n3$  if v_host and (p_action in ('accept','finish_saved','cancel_round','call_next','start_game','finish_game','start_vote','close_vote',
                              'expose','unexpose','kick','queue_add','queue_remove','remove_graffiti','hide_evidence','free_spin',
                              'jester_revenge','decide_lock','lock','unlock','make_angel','bbq_start','bbq_close','app_start','app_host')
                 or (p_action = 'log_beer' and me.id is null)) then
    insert into undo_log (room_id, action, label, snap) values (r.id, p_action, _undo_label(p_action, a), _snapshot(r.id));$n3$);
  elsif position($n3$  if v_host and (p_action in ('accept','finish_saved','cancel_round','call_next','start_game','finish_game','start_vote','close_vote',
                              'expose','unexpose','kick','queue_add','queue_remove','remove_graffiti','hide_evidence','free_spin',
                              'jester_revenge','decide_lock','lock','unlock','make_angel','bbq_start','bbq_close','app_start','app_host')
                 or (p_action = 'log_beer' and me.id is null)) then
    insert into undo_log (room_id, action, label, snap) values (r.id, p_action, _undo_label(p_action, a), _snapshot(r.id));$n3$ in d) = 0 then raise exception '_exec: patch 3 does not match the live function'; end if;
  if position($o4$    when p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','mg_tick','mg_decide','bet')
      then _a_mini(p_action, a, r, me, s, rd, v_host)
  end;
  if res is null then raise exception 'Unknown action %', p_action; end if;$o4$ in d) > 0 then d := replace(d, $o4$    when p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','mg_tick','mg_decide','bet')
      then _a_mini(p_action, a, r, me, s, rd, v_host)
  end;
  if res is null then raise exception 'Unknown action %', p_action; end if;$o4$, $n4$    when p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','mg_tick','mg_decide','bet')
      then _a_mini(p_action, a, r, me, s, rd, v_host)
    when p_action in ('app_start','app_move','app_host','app_tick')
      then _a_app(p_action, a, r, me, s, rd, v_host)
  end;
  if res is null then raise exception 'Unknown action %', p_action; end if;$n4$);
  elsif position($n4$    when p_action in ('dodge_throw','plank_start','jack_start','bomb_start','penny_start','mg_ready','mg_move','mg_tick','mg_decide','bet')
      then _a_mini(p_action, a, r, me, s, rd, v_host)
    when p_action in ('app_start','app_move','app_host','app_tick')
      then _a_app(p_action, a, r, me, s, rd, v_host)
  end;
  if res is null then raise exception 'Unknown action %', p_action; end if;$n4$ in d) = 0 then raise exception '_exec: patch 4 does not match the live function'; end if;
  if position($o5$  -- mg_tick is housekeeping (phones tick too, so a game settles even if the TV sleeps), not a move
  -- bet: bets live outside the undo snapshot and caps are worked out from what happened, so a bet never blocks undo
  if not v_host and p_action not in ('log_beer', 'mg_tick', 'bet') then update undo_log set blocked = true where room_id = r.id and not blocked; end if;
  if not coalesce((res ->> 'no_touch')::boolean, false) then perform _touch(r.id); end if;
  return res - 'no_touch';$o5$ in d) > 0 then d := replace(d, $o5$  -- mg_tick is housekeeping (phones tick too, so a game settles even if the TV sleeps), not a move
  -- bet: bets live outside the undo snapshot and caps are worked out from what happened, so a bet never blocks undo
  if not v_host and p_action not in ('log_beer', 'mg_tick', 'bet') then update undo_log set blocked = true where room_id = r.id and not blocked; end if;
  if not coalesce((res ->> 'no_touch')::boolean, false) then perform _touch(r.id); end if;
  return res - 'no_touch';$o5$, $n5$  -- mg_tick is housekeeping (phones tick too, so a game settles even if the TV sleeps), not a move
  -- bet: bets live outside the undo snapshot and caps are worked out from what happened, so a bet never blocks undo
  -- app_tick is housekeeping too (it only plays what a deadline already decided)
  if not v_host and p_action not in ('log_beer', 'mg_tick', 'bet', 'app_tick') then update undo_log set blocked = true where room_id = r.id and not blocked; end if;
  if not coalesce((res ->> 'no_touch')::boolean, false) then perform _touch(r.id); end if;
  return res - 'no_touch';$n5$);
  elsif position($n5$  -- mg_tick is housekeeping (phones tick too, so a game settles even if the TV sleeps), not a move
  -- bet: bets live outside the undo snapshot and caps are worked out from what happened, so a bet never blocks undo
  -- app_tick is housekeeping too (it only plays what a deadline already decided)
  if not v_host and p_action not in ('log_beer', 'mg_tick', 'bet', 'app_tick') then update undo_log set blocked = true where room_id = r.id and not blocked; end if;
  if not coalesce((res ->> 'no_touch')::boolean, false) then perform _touch(r.id); end if;
  return res - 'no_touch';$n5$ in d) = 0 then raise exception '_exec: patch 5 does not match the live function'; end if;
  execute d;
end $do$;

-- ===== _state: 1 patch(es) on the live function =====
do $do$
declare d text;
begin
  d := pg_get_functiondef('public._state(uuid,text)'::regprocedure);
  if position($o1$    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'status', r.status, 'tally', r.tally, 'target', r.target,
      'deadline_at', r.deadline_at, 'segments', r.segments, 'settings', r.settings, 'ended', r.ended,
      'final_tally', r.final_tally, 'result', r.result, 'revealed', r.revealed, 'reveal', r.reveal,
      'version', r.version, 'wheel', _wheel(r.id), 'games_done', v_games,
      'ability_until', case when r.ability_until > now() then r.ability_until end),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object($o1$ in d) > 0 then d := replace(d, $o1$    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'status', r.status, 'tally', r.tally, 'target', r.target,
      'deadline_at', r.deadline_at, 'segments', r.segments, 'settings', r.settings, 'ended', r.ended,
      'final_tally', r.final_tally, 'result', r.result, 'revealed', r.revealed, 'reveal', r.reveal,
      'version', r.version, 'wheel', _wheel(r.id), 'games_done', v_games,
      'ability_until', case when r.ability_until > now() then r.ability_until end),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object($o1$, $n1$    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'status', r.status, 'tally', r.tally, 'target', r.target,
      'deadline_at', r.deadline_at, 'segments', r.segments,
      'settings', case when v_host then r.settings else r.settings - 'herd_questions' end,   -- a room's own Herd questions: the host's only
      'ended', r.ended,
      'final_tally', r.final_tally, 'result', r.result, 'revealed', r.revealed, 'reveal', r.reveal,
      'version', r.version, 'wheel', _wheel(r.id), 'games_done', v_games,
      'ability_until', case when r.ability_until > now() then r.ability_until end),
    -- APP GAMES: the kinds this server runs (an older one doesn't send this, and the TV offers none), and the running one
    -- as this viewer may see it
    'app_games', '["herd","odd","chess"]'::jsonb,
    'app', _app_view(r.id, me, v_host),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object($n1$);
  elsif position($n1$    'room', jsonb_build_object(
      'id', r.id, 'code', r.code, 'status', r.status, 'tally', r.tally, 'target', r.target,
      'deadline_at', r.deadline_at, 'segments', r.segments,
      'settings', case when v_host then r.settings else r.settings - 'herd_questions' end,   -- a room's own Herd questions: the host's only
      'ended', r.ended,
      'final_tally', r.final_tally, 'result', r.result, 'revealed', r.revealed, 'reveal', r.reveal,
      'version', r.version, 'wheel', _wheel(r.id), 'games_done', v_games,
      'ability_until', case when r.ability_until > now() then r.ability_until end),
    -- APP GAMES: the kinds this server runs (an older one doesn't send this, and the TV offers none), and the running one
    -- as this viewer may see it
    'app_games', '["herd","odd","chess"]'::jsonb,
    'app', _app_view(r.id, me, v_host),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object($n1$ in d) = 0 then raise exception '_state: patch 1 does not match the live function'; end if;
  execute d;
end $do$;

-- every _ function is the server's only (new functions are executable by default on Supabase)
do $rv$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like '\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $rv$;
$sync$, chr(13), ''); end $wrap$;
