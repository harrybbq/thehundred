// Chess rules engine tests (supabase/migrations/20261024000003_chess_engine.sql) in PGlite, then the TAG TEAM CHESS game
// layer on top of it (20261024000007_tag_team_chess.sql) through api_exec. Run: node tests/chess.test.mjs
import { createDb, api as rawApi, state, addUser } from '../server/db.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const started = Date.now();
const db = await createDb();
const step = m => console.log('✓ ' + m);
const one = async (q, p = []) => Object.values((await db.query(q, p)).rows[0])[0];
const expectErr = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail('expected error ' + re); };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const moves = fen => one('select _chess_moves($1)', [fen]);
const play = (fen, uci) => one('select _chess_play($1, $2)', [fen, uci]);
const line = async (fen, ucis) => { for (const u of ucis.split(' ')) fen = await play(fen, u); return fen; };
const status = (fen, hist = []) => one('select _chess_status($1, $2::text[])', [fen, hist]);
const inCheck = fen => one('select _chess_in_check($1)', [fen]);
const describe = (fen, uci) => one('select _chess_describe($1, $2)', [fen, uci]);
const material = fen => one('select _chess_material($1)', [fen]);
const field = (fen, i) => fen.split(' ')[i];

assert.equal(await one('select _chess_start()'), START);

// ---------- perft: count the leaf nodes of the legal-move tree through _chess_moves/_chess_play ----------
// One recursive query per position; returns the leaf count at every depth 1..n.
async function perft(fen, depth) {
  const rows = (await db.query(`
    with recursive t(fen, d) as (
      select $1::text, 1
      union all
      select _chess_play(t.fen, m), t.d + 1 from t, unnest(_chess_moves(t.fen)) m where t.d < $2
    )
    select d, sum(cardinality(_chess_moves(fen)))::int as n from t group by d order by d`, [fen, depth])).rows;
  return rows.map(r => r.n);
}
const PERFT = [
  ['start position', START, [20, 400, 8902]],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039]],
  ['position 3 (en passant pins)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812]],
  ['position 4 (promotions, castling)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486]],
];
// CHESS_DEEP=1 node tests/chess.test.mjs: one level deeper everywhere (about a minute)
if (process.env.CHESS_DEEP) {
  PERFT[0][2].push(197281); PERFT[1][2].push(97862); PERFT[2][2].push(43238); PERFT[3][2].push(9467); PERFT[4][2].push(62379);
  PERFT.push(['position 4 mirrored', 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', [6, 264, 9467]],
             ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]);
}
for (const [name, fen, want] of PERFT) {
  const t = Date.now();
  const got = await perft(fen, want.length);
  assert.deepEqual(got, want, `perft ${name}`);
  step(`perft ${name}: ${want.join(', ')} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}

// ---------- castling ----------
const CASTLE = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
const castles = async fen => (await moves(fen)).filter(m => ['e1g1', 'e1c1', 'e8g8', 'e8c8'].includes(m)).sort();
assert.deepEqual(await castles(CASTLE), ['e1c1', 'e1g1']);
assert.deepEqual(await castles('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1'), ['e1c1'], 'f1 attacked: no castling through it');
assert.deepEqual(await castles('4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1'), ['e1c1'], 'g1 attacked: no castling into check');
assert.deepEqual(await castles('3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1'), ['e1g1'], 'd1 attacked: no queenside');
assert.deepEqual(await castles('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'), ['e1c1', 'e1g1'], 'b1 attacked is fine');
assert.deepEqual(await castles('k3r3/8/8/8/8/8/8/R3K2R w KQ - 0 1'), [], 'in check: no castling');
assert.deepEqual(await castles('4k3/8/8/8/8/8/8/RN2K1NR w KQ - 0 1'), [], 'pieces in the way');
assert.deepEqual(await castles('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'), ['e8c8', 'e8g8']);
assert.equal(await play(CASTLE, 'e1g1'), 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
assert.equal(await play(CASTLE, 'e1c1'), 'r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1');
assert.equal(await play('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 3 9', 'e8g8'), 'r4rk1/8/8/8/8/8/8/R3K2R w KQ - 4 10');
step('castling: rights, empty squares, not out of / through / into check (b1 may be attacked); the rook jumps over');

assert.equal(field(await play(CASTLE, 'e1e2'), 2), 'kq', 'king move loses both');
assert.equal(field(await play(CASTLE, 'h1h2'), 2), 'Qkq', 'h-rook move loses kingside');
assert.equal(field(await play(CASTLE, 'a1b1'), 2), 'Kkq', 'a-rook move loses queenside');
assert.equal(field(await play(CASTLE, 'a1a8'), 2), 'Kk', 'rook takes rook: both lose their queenside');
const rookTaken = await play('r3k2r/8/8/8/8/8/1B6/R3K2R w KQkq - 0 1', 'b2h8');
assert.equal(field(rookTaken, 2), 'KQq', 'a rook taken on its square loses that right');
assert.deepEqual(await castles(rookTaken), ['e8c8']);
const kingBack = await line(CASTLE, 'e1f1 e8f8 f1e1 f8e8');
assert.equal(field(kingBack, 2), '-', 'rights never come back');
assert.deepEqual(await castles(kingBack), []);
step('castling rights: lost after a king or rook move and after a rook is taken on its square, for good');

// ---------- en passant ----------
const afterE4 = await play(START, 'e2e4');
assert.equal(afterE4, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'no black pawn can take: no ep square');
const epPos = await line(START, 'e2e4 a7a6 e4e5 d7d5');
assert.equal(epPos, 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
assert.ok((await moves(epPos)).includes('e5d6'), 'en passant right after the double push');
assert.equal(await play(epPos, 'e5d6'), 'rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3', 'the pawn beside is taken');
const later = await line(epPos, 'g1f3 a6a5');
assert.equal(field(later, 3), '-');
assert.ok(!(await moves(later)).includes('e5d6'), 'gone a move later');
assert.ok(!(await moves('8/8/8/KPp4r/8/8/8/7k w - c6 0 1')).includes('b5c6'), 'ep that uncovers a rank pin is illegal');
assert.ok((await moves('8/8/8/KPp5/8/8/8/7k w - c6 0 1')).includes('b5c6'));
assert.ok((await moves('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3')).includes('d4e3'), 'black takes ep too');
// a FEN that always writes the ep square after a double push is accepted (and nothing can take there)
assert.equal((await moves('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).length, 20);
step('en passant: right after the double push only, never through a pin; the FEN square is written only when it can be taken');

// ---------- promotion ----------
const PROMO = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
const promos = (await moves(PROMO)).filter(m => m.startsWith('e7'));
assert.deepEqual(promos.sort(), ['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r']);
for (const [p, want] of [['q', 'Q'], ['r', 'R'], ['b', 'B'], ['n', 'N']]) {
  assert.equal(await play(PROMO, 'e7e8' + p), `4${want}3/8/8/8/8/8/k7/4K3 b - - 0 1`);
}
assert.equal(await play(PROMO, 'e7e8'), '4Q3/8/8/8/8/8/k7/4K3 b - - 0 1', 'no letter = queen');
assert.equal(await play('4k3/8/8/8/8/8/p7/4K3 b - - 0 1', 'a2a1n'), '4k3/8/8/8/8/8/8/n3K3 w - - 0 2');
step('promotion: listed once per piece (q, r, b, n), all four play, e7e8 defaults to a queen, black promotes too');

// ---------- illegal moves ----------
await expectErr(play(START, 'e2e5'), /Illegal move/);
await expectErr(play(START, 'e7e5'), /Illegal move/);          // not your piece
await expectErr(play(START, 'xyz'), /Illegal move/);
await expectErr(play(START, null), /Illegal move/);
await expectErr(play('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1', 'e2d3'), /Illegal move/);   // pinned bishop
await expectErr(play('4k3/8/8/8/8/8/8/4K2r w - - 0 1', 'e1f1'), /Illegal move/);     // into check
await expectErr(play('4k3/8/8/8/8/8/8/4K2r w - - 0 1', 'e1d1'), /Illegal move/);     // along the checking line
await expectErr(describe(START, 'e1e2'), /Illegal move/);
await expectErr(moves('not a fen'), /Invalid FEN/);
await expectErr(moves('8/8/8/8/8/8/8/8 w - - 0 1'), /Invalid FEN/);
step('illegal moves raise "Illegal move" (wrong piece, pinned piece, into check, x-ray along the check); a bad FEN raises "Invalid FEN"');

// ---------- status ----------
const fools = await line(START, 'f2f3 e7e5 g2g4 d8h4');
assert.equal(await status(fools), 'checkmate');
assert.equal(await inCheck(fools), true);
assert.deepEqual(await moves(fools), []);
assert.equal(await status('k7/8/1Q6/8/8/8/8/7K b - - 0 1'), 'stalemate');
assert.equal(await inCheck('k7/8/1Q6/8/8/8/8/7K b - - 0 1'), false);
assert.equal(await inCheck(afterE4), false);
assert.equal(await status(START), 'play');
assert.equal(await status('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'insufficient', 'K v K');
assert.equal(await status('4k3/8/8/8/8/8/8/4KN2 w - - 0 1'), 'insufficient', 'K+N v K');
assert.equal(await status('4k3/8/8/8/8/8/8/4KB2 b - - 0 1'), 'insufficient', 'K+B v K');
assert.equal(await status('b3k3/8/8/8/8/8/8/4KB2 w - - 0 1'), 'insufficient', 'K+B v K+B, both bishops on light squares');
assert.equal(await status('b3k3/8/8/8/8/8/8/4K1B1 w - - 0 1'), 'play', 'opposite-coloured bishops can still mate');
assert.equal(await status('4k3/8/8/8/8/8/8/4KNN1 w - - 0 1'), 'play');
assert.equal(await status('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'), 'play');
assert.equal(await status('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'), 'play');
assert.equal(await status('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'), 'fifty');
assert.equal(await status('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), 'play');
assert.equal(fools, 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
assert.equal(await status(fools.replace(/ 1 3$/, ' 100 3')), 'checkmate', 'mate beats the fifty-move rule');

// threefold: knights out and back twice; the history holds every earlier position
const hist = [START];
let fen = START;
for (const u of 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8'.split(' ')) {
  fen = await play(fen, u);
  if (hist.length === 4) assert.equal(await status(fen, hist), 'play', 'twice is not enough');
  if (hist.length < 8) hist.push(fen);
}
assert.equal(fen.split(' ').slice(0, 4).join(' '), START.split(' ').slice(0, 4).join(' '));
assert.equal(await status(fen, hist), 'threefold', 'the start position for the third time');
assert.equal(await status(fen, hist.slice(1)), 'play', 'only counts what the history holds');
assert.equal(await status(fen), 'play', 'no history, no repetition');
// a hand-written FEN with an untakeable ep square is the same position as one without it
assert.equal(await status(afterE4, [afterE4.replace(' - ', ' e3 '), afterE4.replace(' - ', ' e3 ')]), 'threefold');
step('status: Fool\'s mate is checkmate; stalemate; K v K, K+N v K, K+B v K(+B same colour) insufficient; fifty at 100; threefold from the history');

// ---------- material ----------
const exd5 = await line(START, 'e2e4 d7d5 e4d5');
assert.deepEqual(await material(exd5), { white_took: 'p', black_took: '', white_adv: 1 });
assert.deepEqual(await material(START), { white_took: '', black_took: '', white_adv: 0 });
assert.deepEqual(await material('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),
  { white_took: 'ppppppppnnbbrrq', black_took: 'ppppppppnnbbrrq', white_adv: 0 });
assert.deepEqual(await material('1QQ1k3/8/8/8/8/8/PPPPPP2/RNB1KBNR w KQ - 0 1'),
  { white_took: 'ppppppppnnbbrrq', black_took: 'pp', white_adv: 46 }, 'a promoted queen never counts below zero');
assert.deepEqual(await material('rnb1kbnr/pppp1ppp/8/8/8/8/PPPPPPP1/RNBQKBN1 w Qkq - 0 1'),
  { white_took: 'pq', black_took: 'pr', white_adv: 4 });
step('material: white_took / black_took like chess.com (pawn to queen), white_adv on the board');

// ---------- describe ----------
const bxf7 = await line(START, 'e2e4 e7e5 f1c4 g8f6');
assert.deepEqual(await describe(bxf7, 'c4f7'),
  { piece: 'bishop', from: 'c4', to: 'f7', captures: 'pawn', check: true, mate: false, castle: null, promotes: null, en_passant: false });
const scholar = await line(START, 'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6');
assert.deepEqual(await describe(scholar, 'h5f7'),
  { piece: 'queen', from: 'h5', to: 'f7', captures: 'pawn', check: true, mate: true, castle: null, promotes: null, en_passant: false });
assert.deepEqual(await describe(CASTLE, 'e1g1'),
  { piece: 'king', from: 'e1', to: 'g1', captures: null, check: false, mate: false, castle: 'kingside', promotes: null, en_passant: false });
assert.equal((await describe('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8c8')).castle, 'queenside');
assert.deepEqual(await describe('3r4/4P3/8/8/8/8/k7/4K3 w - - 0 1', 'e7d8n'),
  { piece: 'pawn', from: 'e7', to: 'd8', captures: 'rook', check: false, mate: false, castle: null, promotes: 'knight', en_passant: false });
assert.deepEqual(await describe(PROMO, 'e7e8'),
  { piece: 'pawn', from: 'e7', to: 'e8', captures: null, check: false, mate: false, castle: null, promotes: 'queen', en_passant: false });
assert.deepEqual(await describe(epPos, 'e5d6'),
  { piece: 'pawn', from: 'e5', to: 'd6', captures: 'pawn', check: false, mate: false, castle: null, promotes: null, en_passant: true });
assert.equal((await describe(START, 'g1f3')).piece, 'knight');
step('describe: capture with check, mate, both castles, promotion (with a capture, and the default queen), en passant');

// ---------- random ----------
for (const f of [START, epPos, PROMO, 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1']) {
  const legal = await moves(f);
  const picks = new Set();
  for (let i = 0; i < 12; i++) {
    const r = await one('select _chess_random($1)', [f]);
    assert.ok(legal.includes(r), `random move ${r} is legal`);
    picks.add(r);
  }
  assert.ok(picks.size > 1, 'it really is random');
}
assert.equal(await one('select _chess_random($1)', [fools]), null);
assert.equal(await one('select _chess_random($1)', ['k7/8/1Q6/8/8/8/8/7K b - - 0 1']), null);
step('random: always a legal move, null on checkmate or stalemate');

// ---------- privileges ----------
const fns = (await db.query(`select p.oid::regprocedure::text as sig, p.proconfig, p.provolatile
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.proname like '\\_chess\\_%'`)).rows;
for (const name of ['_chess_start()', '_chess_moves(text)', '_chess_play(text,text)', '_chess_in_check(text)',
                    '_chess_status(text,text[])', '_chess_material(text)', '_chess_describe(text,text)', '_chess_random(text)']) {
  assert.ok(fns.some(f => f.sig === name), 'missing ' + name);
}
for (const f of fns) {
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await one('select has_function_privilege($1, $2, \'execute\')', [role, f.sig]), false, `${role} can run ${f.sig}`);
  }
  assert.deepEqual(f.proconfig, ['search_path=public'], f.sig);
  assert.equal(f.provolatile, f.sig === '_chess_random(text)' ? 'v' : 'i', f.sig);
}
step(`privileges: none of the ${fns.length} _chess_ functions run for anon or authenticated; all pin search_path`);

// =====================================================================
// TAG TEAM CHESS: the game layer, end to end through api_exec (start, rotation, clocks, results, the queue)
// =====================================================================
{
  const HOST = randomUUID();
  await addUser(db, HOST, false, 'host@example.com');
  const sql = (q, p = []) => db.query(q, p).then(r => r.rows);
  const api = (...a) => rawApi(...a);
  // a fresh room dealt exactly as asked (copied from tests/logic.test.mjs)
  const NO_ROLES = { intruder: 0, betrayer: 0, forger: 0, medic: 0, detective: 0, scrooge: 0, skank: 0, davyjones: 0, jester: 0, assassin: 0, lovebird: 0, cursed: 0 };
  const mkRoom = async (deal, hours = 1) => {
    const rm = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + hours * 3600e3).toISOString() });
    const counts = { ...NO_ROLES, drinker: 0 };
    for (const [, role] of deal) counts[role] = (counts[role] || 0) + 1;
    const { cards } = await api(db, HOST, 'generate_cards', { room_id: rm.room_id, role_counts: counts });
    await sql('update role_codes set pair_id = null, cursed = false where room_id = $1', [rm.room_id]);
    const X = {};
    for (const [n, role] of deal) {
      const uid = randomUUID(); await addUser(db, uid);
      X[n] = { uid, id: (await api(db, uid, 'join', { code: rm.code, name: n })).player_id };
      await api(db, uid, 'redeem', { room_id: rm.room_id, code: cards.splice(cards.findIndex(c => c.role === role), 1)[0].code });
    }
    return { R: rm.room_id, code: rm.code, X, S: n => state(db, X[n].uid, rm.code), H: () => state(db, HOST, rm.code) };
  };

  // A, B, C against D, E (uneven teams); X is in the room but not playing; X holds a real role (it must never leak)
  const K = await mkRoom([['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker'], ['D', 'drinker'], ['E', 'drinker'], ['X', 'intruder']]);
  const { R, X } = K;
  const TEAM3 = [X.A.id, X.B.id, X.C.id], TEAM2 = [X.D.id, X.E.id];
  const nameOf = id => Object.keys(X).find(n => X[n].id === id);
  const app = async n => (n ? await K.S(n) : await K.H()).app;
  const host = op => api(db, HOST, 'app_host', { room_id: R, op });
  const tick = () => api(db, X.A.uid, 'app_tick', { room_id: R });
  const mv = (n, uci, extra = {}) => api(db, X[n].uid, 'app_move', { room_id: R, uci, ...extra });
  const mover = async () => nameOf((await app()).mover);
  const play = async (uci, extra) => mv(await mover(), uci, extra);           // whoever's move it is plays it
  const playLine = async ucis => { for (const u of ucis.split(' ')) await play(u); };
  const live = "room_id = $1 and status = 'active'";
  // wind the clock: the turn (or the intro / the result hold) started `secs` seconds earlier than it did
  const back = secs => sql(`update games set app_state = app_state
      || jsonb_build_object('until', (app_state ->> 'until')::timestamptz - make_interval(secs => $2::float8))
      || case when app_state ->> 'turn_at' is null then '{}'::jsonb
              else jsonb_build_object('turn_at', (app_state ->> 'turn_at')::timestamptz - make_interval(secs => $2::float8)) end
     where ${live}`, [R, secs]);
  // put a position on the board (white to move at the start of the game), with its legal moves, like a real move does
  const setFen = fen => sql(`update games set app_state = app_state || jsonb_build_object('fen', $2::text, 'legal', to_jsonb(_chess_moves($2::text)),
      'material', _chess_material($2::text)) where ${live}`, [R, fen]);
  const queue = async () => (await K.H()).queue.map(q => q.player_id);
  const clearQueue = async () => { for (const q of (await K.H()).queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id }); };
  const start = async (teams = [TEAM3, TEAM2]) => (await api(db, HOST, 'app_start', { room_id: R, kind: 'chess', teams })).game_id;

  // ---------- start ----------
  await expectErr(api(db, HOST, 'app_start', { room_id: R, kind: 'chess' }), /Draw two teams/);
  await expectErr(api(db, HOST, 'app_start', { room_id: R, kind: 'chess', teams: [TEAM3, []] }), /Draw two teams/);
  await expectErr(api(db, HOST, 'app_start', { room_id: R, kind: 'chess', teams: [TEAM3, [X.A.id, X.D.id]] }), /both teams/);
  await expectErr(api(db, X.A.uid, 'app_start', { room_id: R, kind: 'chess', teams: [TEAM3, TEAM2] }), /Only the host/);
  let gid = await start();
  // colours and the order inside each team are drawn at random: re-deal this game's set-up 40 times
  const colours = new Set(), orders = new Set();
  for (let i = 0; i < 40; i++) {
    await sql(`select _ttc_init(g, '{}'::jsonb) from games g where g.id = $1`, [gid]);
    const [{ st }] = await sql('select app_state as st from games where id = $1', [gid]);
    colours.add(st.white.length);
    orders.add(JSON.stringify(st.white.length === 3 ? st.white : st.black));
    assert.deepEqual([...st.white, ...st.black].sort(), [...TEAM3, ...TEAM2].sort());
  }
  assert.deepEqual([...colours].sort(), [2, 3], 'either team can be white');
  assert.ok(orders.size > 2, 'the order inside a team is shuffled');
  let h = await app();
  assert.equal(h.kind, 'chess'); assert.equal(h.name, 'Tag Team Chess'); assert.equal(h.phase, 'intro');
  assert.equal((await K.H()).game.name, 'Tag Team Chess');
  assert.equal(h.fen, START); assert.equal(h.turn, 'w'); assert.equal(h.ply, 0); assert.equal(h.result, null);
  assert.deepEqual(h.legal, await moves(START), 'the legal moves are stored, not worked out per viewer');
  assert.ok([TEAM3, TEAM2].some(t => [...t].sort().join() === [...h.white].sort().join()), 'white is one whole team');
  assert.ok([TEAM3, TEAM2].some(t => [...t].sort().join() === [...h.black].sort().join()), 'black is the other');
  assert.equal(h.mover, h.white[0]);
  assert.deepEqual(h.clock, { w: 600000, b: 600000 }); assert.equal(h.move_ms, 30000); assert.equal(h.turn_at, null);
  assert.equal(h.mine, null, 'the TV has no side');
  assert.equal((await app('X')).mine, null, 'nor does someone in the room who isn\'t playing');
  assert.ok(!/intruder|drinker|guilty|"role"/.test(JSON.stringify(await app('X'))), 'no roles anywhere in the game');
  const W = h.white.map(nameOf), B = h.black.map(nameOf);
  assert.deepEqual((await app(W[0])).mine, { side: 'w', my_turn: false, next_up_in: 0 }, 'not your turn until the clocks start');
  assert.equal((await app(B[0])).mine.next_up_in, 1);
  assert.equal((await app(W[1])).mine.next_up_in, 2);
  assert.equal((await app(B[1])).mine.next_up_in, 3);
  await expectErr(mv(W[0], 'e2e4'), /haven't started/);
  await expectErr(api(db, HOST, 'start_game', { room_id: R, name: 'Darts' }), /Finish the current game/);
  await tick(); assert.equal((await app()).phase, 'intro', 'a tick before the intro is up does nothing');
  await back(16); await tick();
  h = await app();
  assert.equal(h.phase, 'play'); assert.ok(h.turn_at);
  assert.ok(Math.abs(Date.parse(h.until) - Date.parse(h.turn_at) - 30000) < 5, 'the turn\'s deadline: 30 seconds');
  assert.equal((await app(W[0])).mine.my_turn, true);
  step('TTC start: two teams from the draw (checked); colours and each team\'s order random; the legal moves stored; the intro, then the clocks');

  // ---------- who may move ----------
  await expectErr(mv('X', 'e2e4'), /not in this game/);
  await expectErr(api(db, HOST, 'app_move', { room_id: R, uci: 'e2e4' }), /Join the room|for the players/);
  await expectErr(mv(B[0], 'e7e5'), /white's move/);
  await expectErr(mv(W[1], 'e2e4'), new RegExp(`${W[0]}'s move`));
  await expectErr(mv(W[0], 'e2e5'), /Illegal move/);
  await expectErr(mv(W[0], 'e7e5'), /Illegal move/);
  await expectErr(mv(W[0], 'e2e4', { ply: 3 }), /moved on/);
  await expectErr(host('next'), /END GAME/);
  // touching a piece lights it up on the TV; only the player to move can, and only a piece that can move
  await mv(W[0], undefined, { touch: 'g1' }); assert.equal((await app()).touch, 'g1');
  await mv(W[0], undefined, { touch: 'e1' }); assert.equal((await app()).touch, null, 'the king can\'t move yet');
  await mv(W[0], undefined, { touch: 'b1' });
  await expectErr(api(db, X[W[1]].uid, 'app_move', { room_id: R, touch: 'g1' }), /move/);
  step('TTC who may move: only the player to move (not their team-mates, the other team, a watcher or the host); illegal and stale moves refused; touch');

  // ---------- the move goes round each team (3 and 2: each loops on its own) ... and threefold ----------
  // knights out and back twice: the start position comes round a third time on the 8th move
  const knights = 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8'.split(' ');
  for (let p = 0; p < 8; p++) {
    h = await app();
    const want = p % 2 === 0 ? h.white[(p / 2) % h.white.length] : h.black[((p - 1) / 2) % h.black.length];
    assert.equal(h.mover, want, `ply ${p}: the right player`);
    assert.equal((await app(nameOf(want))).mine.next_up_in, 0);
    if (p === 1) assert.equal(h.touch, null, 'a move clears the touch');
    await mv(nameOf(want), knights[p], { ply: p });
    if (p < 7) assert.equal((await app()).phase, 'play', 'twice is not threefold');
  }
  h = await app();
  assert.equal(h.ply, 8); assert.equal(h.moves.length, 8); assert.equal(h.moves[0].piece, 'knight');
  assert.deepEqual(h.moves.map(m => m.by), [0, 1, 2, 3, 4, 5, 6, 7].map(p => p % 2 === 0 ? h.white[(p / 2) % h.white.length] : h.black[((p - 1) / 2) % h.black.length]));
  assert.deepEqual(h.idx, { w: 4 % h.white.length, b: 4 % h.black.length }, 'each team is on its own next player');
  assert.equal(h.phase, 'end'); assert.deepEqual(h.result, { kind: 'threefold', winner: null, losers: [] });
  assert.equal(h.mover, null);
  await expectErr(mv('A', 'e2e4'), /over/);
  await host('stop');                                  // END GAME on the result: it stands (a draw: nobody)
  let st = await K.H();
  assert.equal(st.app, null); assert.equal(st.game.status, 'ended'); assert.deepEqual(st.game.losers, []);
  assert.deepEqual(await queue(), [], 'a draw sends nobody to the queue');
  assert.ok(st.events.some(e => e.kind === 'game_over' && e.payload.game === gid));
  step('TTC rotation: white 1, black 1, white 2, black 2... each team loops on its own (3 v 2); threefold repetition is a draw: nobody queued');

  // ---------- the 2-second grace, the 30-second random move, and the flag ----------
  gid = await start();
  await host('next');
  h = await app();
  let w = h.white.map(nameOf), b = h.black.map(nameOf);
  await back(31);                                       // a second past the deadline: still taken (it may have been sent in time)
  await tick(); assert.equal((await app()).ply, 0, 'the tick waits for the 2-second grace');
  await mv(w[0], 'e2e4');
  h = await app();
  assert.equal(h.clock.w, 570000, 'a move in the grace counts as made on the deadline (30 s)');
  assert.equal(h.mover, h.black[0]);
  await back(10); await mv(b[0], 'e7e5');
  h = await app(); assert.ok(h.clock.b <= 590000 && h.clock.b > 589000, 'black\'s clock ran only on black\'s turn');
  assert.equal(h.clock.w, 570000);
  // white's second player sleeps through the 30 seconds: a random legal move is played for them
  const legalBefore = h.legal;
  await back(31.5); await tick(); assert.equal((await app()).ply, 2);
  await back(1); await tick();
  h = await app();
  assert.equal(h.ply, 3); assert.equal(h.moves.at(-1).auto, true); assert.equal(h.moves.at(-1).by, X[w[1 % w.length]].id);
  assert.ok(legalBefore.includes(h.moves.at(-1).uci), 'a legal move');
  assert.equal(h.clock.w, 540000, 'a missed turn costs the 30 seconds');
  assert.equal(h.mover, h.black[1 % h.black.length], 'and the turn passes on as normal');
  await expectErr(mv(w[1 % w.length], 'd2d4', { ply: 2 }), /moved on/);
  await expectErr(mv(w[1 % w.length], 'd2d4'), /black's move/);
  // black's clock nearly out: the flag (only once the grace is up), and black loses
  await sql(`update games set app_state = jsonb_set(app_state, '{clock,b}', '5000') where ${live}`, [R]);
  await back(6); await tick(); assert.equal((await app()).phase, 'play', 'the clock\'s deadline gets the grace too');
  await back(1.5); await tick();
  h = await app();
  assert.equal(h.phase, 'end'); assert.equal(h.result.kind, 'flag'); assert.equal(h.result.winner, 'w');
  assert.deepEqual([...h.result.losers].sort(), [...h.black].sort()); assert.equal(h.clock.b, 0);
  assert.equal((await app(b[0])).mine.my_turn, false);
  await host('stop');                                   // END GAME on the result screen: the flag stands
  assert.deepEqual([...await queue()].sort(), [...h.black].sort(), 'the flagged team goes in the queue');
  assert.deepEqual([...(await K.H()).game.losers].sort(), [...h.black].sort());
  await clearQueue();
  step('TTC clocks: a move in the 2 s grace counts on the deadline; 30 s up: a random legal move, the turn passes on, the clock pays 30 s; a team\'s clock out: they lose on time');

  // ---------- checkmate: Fool's mate, 1.f3 e5 2.g4 Qh4# ----------
  gid = await start([TEAM2, TEAM3]);
  await host('next');
  await playLine('f2f3 e7e5 g2g4');
  h = await app();
  await play('d8h4');
  h = await app();
  assert.equal(h.phase, 'end'); assert.equal(h.check, true);
  assert.deepEqual(h.result, { kind: 'checkmate', winner: 'b', losers: h.white });
  assert.deepEqual(h.moves.at(-1), { piece: 'queen', from: 'd8', to: 'h4', captures: null, check: true, mate: true, castle: null, promotes: null,
    en_passant: false, ply: 4, side: 'b', by: h.black[1 % h.black.length], uci: 'd8h4', auto: false });
  assert.equal((await K.H()).game.status, 'active', 'the result holds on the TV first');
  await tick(); assert.equal((await app()).phase, 'end', 'held for 20 seconds');
  await back(21); await tick();
  st = await K.H();
  assert.equal(st.app, null); assert.equal(st.game.status, 'ended');
  assert.deepEqual([...st.queue.map(q => q.player_id)].sort(), [...h.white].sort(), 'the whole mated team goes in the queue');
  assert.ok(st.events.some(e => e.kind === 'game_over' && e.payload.game === gid), 'then the usual GAME OVER');
  assert.ok(st.events.some(e => e.kind === 'app_start' && e.payload.kind === 'chess'));
  await expectErr(mv('A', 'e2e4'), /over/);
  assert.deepEqual(await tick(), { ok: true }, 'a tick with no game is quiet');
  await clearQueue();
  step('TTC checkmate (Fool\'s mate): the result holds 20 s, then the whole losing team to the queue and the usual GAME OVER');

  // ---------- promotion with a piece letter; a draw by insufficient material ----------
  gid = await start();
  await host('next');
  await setFen('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await play('e7e8n');
  h = await app();
  assert.equal(h.fen.split(' ')[0], '4N3/8/8/8/8/8/k7/4K3');
  assert.equal(h.moves.at(-1).promotes, 'knight');
  assert.deepEqual(h.result, { kind: 'insufficient', winner: null, losers: [] }, 'K+N v K can\'t mate: a draw');
  await host('next'); assert.deepEqual(await queue(), []);
  // 'e7e8' with no letter is a queen
  gid = await start();
  await host('next');
  await setFen('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
  await play('e7e8');
  h = await app(); assert.equal(h.fen.split(' ')[0], '4Q3/8/8/8/8/8/k7/4K3'); assert.equal(h.phase, 'play');
  await host('stop');
  // ---------- stalemate ----------
  await host('next');
  gid = await start();
  await host('next');
  await setFen('7k/8/8/6Q1/8/8/8/K7 w - - 0 1');
  await play('g5g6');
  h = await app();
  assert.deepEqual(h.result, { kind: 'stalemate', winner: null, losers: [] });
  await host('next'); assert.deepEqual(await queue(), [], 'stalemate: nobody');
  step('TTC promotion by UCI letter (knight) and the default queen; draws (insufficient material, stalemate): nobody queued');

  // ---------- END GAME during play: a draw, nobody loses ----------
  gid = await start();
  await host('stop');
  h = await app(); assert.equal(h.phase, 'end'); assert.deepEqual(h.result, { kind: 'stopped', winner: null, losers: [] });
  await host('next');
  st = await K.H(); assert.equal(st.game.status, 'ended'); assert.deepEqual(st.game.losers, []); assert.deepEqual(await queue(), []);
  gid = await start(); await host('next');
  await playLine('e2e4 e7e5');
  await back(5); await host('stop');
  h = await app(); assert.equal(h.result.kind, 'stopped'); assert.ok(h.clock.w < 600000 && h.clock.w >= 594000, 'the running clock stops where it was');
  await host('next'); assert.deepEqual(await queue(), []);
  step('TTC END GAME: a draw during the intro or the game (nobody queued); on the result screen the result stands');

  // ---------- speed: one move, and the view (17 phones poll it: no engine there) ----------
  gid = await start(); await host('next');
  let t = Date.now();
  await playLine('e2e4 e7e5 g1f3 b8c6 f1c4 g8f6');
  const perMove = (Date.now() - t) / 6;
  t = Date.now();
  for (let i = 0; i < 20; i++) await app('A');
  const perView = (Date.now() - t) / 20;
  await host('stop'); await host('next');
  step(`TTC speed: ${perMove.toFixed(0)} ms a move, ${perView.toFixed(0)} ms a whole phone state (PGlite)`);

  // ---------- privileges ----------
  const tfns = (await db.query(`select p.oid::regprocedure::text as sig, p.proconfig, p.provolatile
                                  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname like '\\_ttc\\_%'`)).rows;
  for (const name of ['_ttc_init(games,jsonb)', '_ttc_move(games,players,jsonb)', '_ttc_host(games,jsonb)', '_ttc_tick(games)',
                      '_ttc_view(games,players,boolean)']) {
    assert.ok(tfns.some(f => f.sig === name), 'missing ' + name);
  }
  for (const f of tfns) {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await one('select has_function_privilege($1, $2, \'execute\')', [role, f.sig]), false, `${role} can run ${f.sig}`);
    }
    assert.deepEqual(f.proconfig, ['search_path=public'], f.sig);
  }
  assert.equal(tfns.find(f => f.sig === '_ttc_view(games,players,boolean)').provolatile, 's', 'the view is stable');
  step(`TTC privileges: none of the ${tfns.length} _ttc_ functions run for anon or authenticated`);
}

console.log(`\nALL CHESS TESTS PASSED (${((Date.now() - started) / 1000).toFixed(1)}s)`);
