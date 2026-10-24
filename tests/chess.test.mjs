// Chess rules engine tests (supabase/migrations/20261024000003_chess_engine.sql) in PGlite. Run: node tests/chess.test.mjs
import { createDb } from '../server/db.mjs';
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

console.log(`\nALL CHESS TESTS PASSED (${((Date.now() - started) / 1000).toFixed(1)}s)`);
