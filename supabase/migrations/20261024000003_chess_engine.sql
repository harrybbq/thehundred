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
