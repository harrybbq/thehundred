// ODD ONE OUT (supabase/migrations/20261024000006_odd_one_out.sql) against the real migrations in PGlite.
// Run: node tests/odd.test.mjs
import { createDb, api as rawApi, state, addUser } from '../server/db.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = await createDb();
const HOST = randomUUID();
await addUser(db, HOST, false, 'host@example.com');
const expectErr = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail('expected error ' + re); };
const step = m => console.log('✓ ' + m);
const sql = (q, p = []) => db.query(q, p).then(r => r.rows);
const api = async (...a) => { await db.query('update rooms set ability_until = null'); return rawApi(...a); };

// a fresh room dealt exactly as asked (the same helper as tests/logic.test.mjs)
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

// the game's driver for one room: moves, host keys, deadlines, and (test only) a peek at the server's secret
const odd = K => {
  const { R, X } = K;
  const name = id => Object.keys(X).find(n => X[n].id === id);
  const d = {
    app: async n => (n ? (await K.S(n)) : (await K.H())).app,
    move: (n, args) => api(db, X[n].uid, 'app_move', { room_id: R, ...args }),
    host: (op, args = {}) => api(db, HOST, 'app_host', { room_id: R, op, ...args }),
    // the TV's keys send the step they were pressed on
    key: async (op, args = {}) => api(db, HOST, 'app_host', { room_id: R, op, step: (await d.app()).step, ...args }),
    due: () => sql("update games set app_state = jsonb_set(app_state, '{until}', to_jsonb(now() - interval '1 second')) where room_id = $1 and status = 'active'", [R]),
    tick: () => api(db, X[Object.keys(X)[0]].uid, 'app_tick', { room_id: R }),
    secret: async () => (await sql("select app_secret s from games where room_id = $1 and status = 'active' and app = 'odd'", [R]))[0].s,
    name,
    // everyone reads the card; the clues run to the vote (each speaker's DONE, or the clock)
    toVote: async (names, { clock = false } = {}) => {
      for (const n of names) await d.move(n, { op: 'read' });
      let h = await d.app(); assert.equal(h.phase, 'clues');
      while (h.phase === 'clues') {
        if (clock) { await d.due(); await d.tick(); } else await d.move(name(h.order[h.turn]), { op: 'done', turn: h.turn });
        h = await d.app();
      }
      assert.equal(h.phase, 'vote');
    },
  };
  return d;
};

// ---------- the secrecy sweep: before a reveal, the name and the odd one out are nowhere but the right phone's `mine` ----------
const strip = app => { const { rounds, mine, ...rest } = app ?? {}; void rounds; void mine; return rest; };
async function sweep(K, D, label, { oddOut = false } = {}) {
  const sec = await D.secret();
  const h = await K.H();
  assert.ok(sec.famous && sec.odd, label + ': a round is on');
  // the TV: everything it gets, minus the ledger of finished rounds (checked on its own)
  assert.ok(!JSON.stringify({ ...h, app: strip(h.app) }).includes(sec.famous), label + ': the TV never has the name');
  assert.ok(!JSON.stringify(h.app.rounds).includes(sec.famous), label + ': nor in the finished rounds');
  assert.equal(h.app.mine, null, label + ': the TV has no card');
  assert.ok(!/"famous":|"votes":/.test(JSON.stringify(strip(h.app))), label + ': no name and no ballots on the board');
  if (oddOut) {
    assert.equal(h.app.last.odd, sec.odd, label + ': caught: the odd one out is public now');
    assert.ok(!('famous' in h.app.last), label + ': the name waits for the guess');
  } else {
    assert.equal(h.app.last, null, label + ': nothing about this round on the board');
    assert.ok(!/"odd":/.test(JSON.stringify(strip(h.app))), label + ': no odd one out on the board');
  }
  assert.ok(!JSON.stringify(h.events).includes(sec.famous) && !/"odd":|"famous":/.test(JSON.stringify(h.events)), label + ': nothing in the events');
  for (const n of Object.keys(K.X)) {
    const st = await K.S(n);
    const me = K.X[n].id;
    assert.ok(!JSON.stringify({ ...st, app: strip(st.app) }).includes(sec.famous), `${label}: ${n}'s phone has the name only in its own card`);
    if (!oddOut) assert.ok(!/"odd":/.test(JSON.stringify(strip(st.app))), `${label}: ${n}'s board has no odd one out`);
    assert.ok(!/"votes":/.test(JSON.stringify(strip(st.app))), `${label}: ${n} sees no ballots`);
    if (!st.app.players.includes(me)) assert.equal(st.app.mine, null, `${label}: ${n} isn't playing: no card`);
    else if (me === sec.odd) {
      assert.equal(st.app.mine.odd, true, `${label}: the odd one out's card`);
      assert.ok(!('famous' in st.app.mine) && !JSON.stringify(st).includes(sec.famous), `${label}: the odd one out never gets the name`);
    } else {
      assert.equal(st.app.mine.famous, sec.famous, `${label}: ${n}'s card has the name`);
      assert.ok(!('odd' in st.app.mine), `${label}: ${n}'s card says nothing about who's odd`);
    }
  }
  return sec;
}
const lostRows = async K => (await K.H()).queue.filter(q => q.reason === 'Lost Odd One Out').map(q => q.player_id);

// ======================================================================================================
// THE WHOLE GAME: 3 rounds (named it and picked · caught again · wrongly accused), the Locker sits out
// ======================================================================================================
{
  const K = await mkRoom([['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker'], ['D', 'drinker'], ['E', 'drinker'], ['F', 'drinker']]);
  const D = odd(K); const { R, X } = K;
  const PLAY = ['A', 'B', 'C', 'D', 'E'];
  await sql("update players set locked_until = now() + interval '10 minutes' where id = $1", [X.F.id]);   // F is in the Locker
  await expectErr(api(db, X.A.uid, 'app_start', { room_id: R, kind: 'odd' }), /Only the host/);
  const { game_id } = await api(db, HOST, 'app_start', { room_id: R, kind: 'odd' });
  let h = await D.app();
  assert.equal(h.kind, 'odd'); assert.equal(h.phase, 'intro'); assert.equal(h.of, 3); assert.equal(h.n, 0);
  assert.equal((await K.H()).game.name, 'Odd One Out');
  assert.deepEqual([...h.players].sort(), PLAY.map(n => X[n].id).sort(), 'the Locker sits it out');
  assert.equal((await D.app('F')).mine, null, 'F watches, no card');
  await expectErr(D.move('F', { op: 'here' }), /not in this game/);
  await expectErr(api(db, X.A.uid, 'dodge_throw', { room_id: R, player_id: X.B.id, dir: 'left' }), /running a game/);
  await expectErr(D.move('A', { op: 'vote', player_id: X.B.id }), /Too late/);
  await expectErr(D.move('A', { op: 'dance' }), /Unknown move/);
  // check-in: who's in is public; a tick before the deadline does nothing; everyone in starts round 1
  for (const n of ['A', 'B', 'C', 'D']) await D.move(n, { op: 'here' });
  await D.move('A', { op: 'here' });                                                    // twice is fine
  h = await D.app(); assert.equal(h.phase, 'intro'); assert.equal(h.here.length, 4);
  await D.tick(); assert.equal((await D.app()).phase, 'intro', 'a tick before the deadline does nothing');
  await D.move('E', { op: 'here' });
  h = await D.app(); assert.equal(h.phase, 'card'); assert.equal(h.n, 1);

  // ---- round 1: caught, named it, picks who loses ----
  const s1 = await sweep(K, D, 'R1 card');
  const O1 = D.name(s1.odd);
  assert.ok(PLAY.includes(O1), 'the odd one out is playing');
  await D.move('A', { op: 'read' });
  assert.deepEqual((await D.app()).read, [X.A.id], 'who has read is public');
  for (const n of PLAY) await D.move(n, { op: 'read' });
  h = await D.app(); assert.equal(h.phase, 'clues');
  assert.deepEqual([...h.order].sort(), [...h.players].sort(), 'everyone speaks once, in a random order');
  await sweep(K, D, 'R1 clues');
  const notSpeaker = PLAY.find(n => X[n].id !== h.order[0]);
  await expectErr(D.move(notSpeaker, { op: 'done' }), /not your turn/);
  await D.move(D.name(h.order[0]), { op: 'done', turn: 0 });                            // DONE moves it on
  h = await D.app(); assert.equal(h.turn, 1);
  await expectErr(D.move(D.name(h.order[0]), { op: 'done', turn: 0 }), /not your turn/, 'a late DONE never skips the next speaker');
  const st1 = h.step;
  await D.host('next', { step: st1 - 1 });                                               // a stale key: nothing
  assert.equal((await D.app()).turn, 1);
  await D.host('next', { step: st1 });                                                   // the host's SKIP
  h = await D.app(); assert.equal(h.turn, 2);
  await D.host('next', { step: st1 });                                                   // the second half of a double tap: nothing
  assert.equal((await D.app()).turn, 2);
  await D.due(); await D.tick();                                                         // 20 seconds up: the next speaker
  assert.equal((await D.app()).turn, 3);
  await D.due(); await D.tick(); await D.due(); await D.tick();
  h = await D.app(); assert.equal(h.phase, 'vote'); assert.deepEqual(h.voted, []);
  await sweep(K, D, 'R1 vote open');
  await expectErr(D.move('A', { op: 'vote', player_id: X.A.id }), /yourself/);
  await expectErr(D.move('A', { op: 'vote', player_id: X.F.id }), /someone in the game/);
  await expectErr(D.move('A', { op: 'done' }), /clues are over/);
  // everyone but the odd one out votes for them; the odd one out votes for someone else
  const inno1 = PLAY.filter(n => n !== O1);
  await D.move(inno1[0], { op: 'vote', player_id: s1.odd });
  await expectErr(D.move(inno1[0], { op: 'vote', player_id: X[inno1[1]].id }), /already voted/);
  h = await D.app(); assert.deepEqual(h.voted, [X[inno1[0]].id], 'who has voted, never for whom');
  assert.equal((await D.app(inno1[0])).mine.vote, s1.odd, 'my own vote on my phone');
  assert.equal((await D.app(inno1[1])).mine.vote, undefined);
  await sweep(K, D, 'R1 one vote in');
  for (const n of inno1.slice(1)) await D.move(n, { op: 'vote', player_id: s1.odd });
  await sweep(K, D, 'R1 all but one in');
  await D.move(O1, { op: 'vote', player_id: X[inno1[0]].id });                           // the last vote closes it
  h = await D.app(); assert.equal(h.phase, 'caught');
  assert.equal(h.last.odd, s1.odd); assert.deepEqual(h.last.tops, [s1.odd]); assert.equal(h.last.counts[s1.odd], 4); assert.equal(h.last.total, 5);
  await sweep(K, D, 'R1 caught', { oddOut: true });
  await expectErr(D.move('A', { op: 'vote', player_id: X.B.id }), /Too late/);
  await expectErr(D.host('judge', { right: true }), /Nothing to judge/);
  await D.key('next');                                                                   // REVEAL THE NAME
  h = await D.app(); assert.equal(h.phase, 'answer'); assert.equal(h.last.famous, s1.famous); assert.equal(h.until, null);
  assert.deepEqual(await D.tick(), { ok: true }); assert.equal((await D.app()).phase, 'answer', 'only the host can judge it: no deadline');
  await expectErr(D.host('next'), /THEY GOT IT/);
  await expectErr(D.host('judge', {}), /Did they get it/);
  await D.key('judge', { right: true });                                                 // THEY GOT IT
  h = await D.app(); assert.equal(h.phase, 'pick');
  const T1 = inno1[0];
  await expectErr(D.move(T1, { op: 'pick', player_id: X[inno1[1]].id }), /Only the odd one out/);
  await expectErr(D.move(O1, { op: 'pick', player_id: s1.odd }), /someone else/);
  await expectErr(D.move(O1, { op: 'pick', player_id: X.F.id }), /someone else/);
  await D.move(O1, { op: 'pick', player_id: X[T1].id });
  h = await D.app(); assert.equal(h.phase, 'result');
  assert.equal(h.last.outcome, 'named'); assert.equal(h.last.picked, X[T1].id); assert.deepEqual(h.last.losers, [X[T1].id]); assert.equal(h.last.random, false);
  assert.deepEqual(h.rounds.map(r => [r.n, r.famous, r.odd, r.outcome, r.losers]), [[1, s1.famous, s1.odd, 'named', [X[T1].id]]]);

  // ---- round 2: a new name, a new odd one out; caught again. T1 loses it either way: picked, or (if T1 is the odd one out) a wrong guess ----
  await D.key('next');                                                                   // NEXT ROUND
  h = await D.app(); assert.equal(h.phase, 'card'); assert.equal(h.n, 2); assert.equal(h.last, null);
  const s2 = await sweep(K, D, 'R2 card');
  const O2 = D.name(s2.odd);
  assert.notEqual(s2.famous, s1.famous, 'a new famous person'); assert.notEqual(s2.odd, s1.odd, 'never the same odd one out twice');
  await D.toVote(PLAY, { clock: true });
  await sweep(K, D, 'R2 vote');
  for (const n of PLAY) await D.move(n, { op: 'vote', player_id: n === O2 ? X[PLAY.find(m => m !== O2)].id : s2.odd });
  h = await D.app(); assert.equal(h.phase, 'caught'); assert.equal(h.until, null);
  assert.deepEqual(await D.tick(), { ok: true });
  assert.equal((await D.app()).phase, 'caught', 'no clock on the guess: the name never goes up before it is said');
  await D.key('next');                                                                   // REVEAL THE NAME
  assert.equal((await D.app()).phase, 'answer');
  if (O2 === T1) await D.key('judge', { right: false });                                 // THEY DIDN'T: the odd one out loses it
  else { await D.key('judge', { right: true }); await D.move(O2, { op: 'pick', player_id: X[T1].id }); }
  h = await D.app(); assert.equal(h.phase, 'result'); assert.deepEqual(h.last.losers, [X[T1].id]);
  assert.equal(h.last.outcome, O2 === T1 ? 'wrong' : 'named');
  await D.due(); await D.tick();                                                         // the next round by itself

  // ---- round 3: the room gets it wrong: an innocent is voted out ----
  h = await D.app(); assert.equal(h.n, 3); assert.equal(h.phase, 'card');
  const s3 = await sweep(K, D, 'R3 card');
  const O3 = D.name(s3.odd);
  assert.ok(![s1.odd, s2.odd].includes(s3.odd), 'a third odd one out');
  assert.ok(![s1.famous, s2.famous].includes(s3.famous));
  await D.due(); await D.tick();                                                         // nobody read in time: the clues start anyway
  assert.equal((await D.app()).phase, 'clues');
  while ((await D.app()).phase === 'clues') { await D.due(); await D.tick(); }
  const X3 = PLAY.find(n => n !== O3);                                                    // the wrongly accused
  for (const n of PLAY) await D.move(n, { op: 'vote', player_id: n === X3 ? s3.odd : X[X3].id });
  h = await D.app(); assert.equal(h.phase, 'result');
  assert.equal(h.last.outcome, 'escaped'); assert.deepEqual(h.last.tops, [X[X3].id]); assert.deepEqual(h.last.losers, [X[X3].id]);
  assert.equal(h.last.odd, s3.odd); assert.equal(h.last.famous, s3.famous, 'not caught: both come out at once');
  assert.equal(h.last.counts[X[X3].id], 4); assert.equal(h.last.counts[s3.odd], 1);

  // ---- CASE CLOSED, then the usual GAME OVER ----
  await D.key('next');
  h = await D.app(); assert.equal(h.phase, 'final'); assert.equal(h.rounds.length, 3);
  const expect = [X[T1].id, X[T1].id, X[X3].id];
  const once = [...new Set(expect)];
  assert.deepEqual(h.losers, once, 'each loser once, in order');
  for (const id of once) assert.equal(h.losses[id], expect.filter(x => x === id).length);
  await D.key('next');                                                                   // CONTINUE
  const st = await K.H();
  assert.equal(st.app, null, 'over: the board is gone');
  assert.equal(st.game.status, 'ended'); assert.deepEqual(st.game.losers, once);
  const rows = await lostRows(K);
  for (const id of once) assert.equal(rows.filter(x => x === id).length, expect.filter(x => x === id).length, 'a queue row for every round lost');
  assert.equal(rows.length, 3);
  assert.ok(st.events.some(e => e.kind === 'game_over' && e.payload.game === game_id), 'the usual GAME OVER follows');
  assert.ok(st.events.some(e => e.kind === 'app_start' && e.payload.kind === 'odd'));
  await expectErr(D.move('A', { op: 'here' }), /over/);
  assert.deepEqual(await D.tick(), { ok: true }, 'a tick with no game is quiet');
  // a second game in the room has none of the names the first one used
  for (const q of st.queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id });
  await api(db, HOST, 'app_start', { room_id: R, kind: 'odd' });
  for (const n of PLAY) await D.move(n, { op: 'here' });
  assert.ok(![s1.famous, s2.famous, s3.famous].includes((await D.secret()).famous), 'a fresh name');
  await D.host('stop'); await D.host('stop');
  assert.equal((await K.H()).game.status, 'ended'); assert.deepEqual((await K.H()).game.losers, [], 'stopped before any round finished: nobody loses');
  step('ODD ONE OUT: 3 rounds (named it and picked, caught again, wrongly accused); a repeat loser gets a queue row per round lost; the Locker sits out; no self-vote; one vote each; stale and doubled host keys do nothing; GAME OVER follows');
}

// ======================================================================================================
// A tie between innocents: they all lose · a tie that includes the odd one out: caught · a wrong guess ·
// nobody votes · the host stops mid-round
// ======================================================================================================
{
  const K = await mkRoom([['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker'], ['D', 'drinker'], ['E', 'drinker']]);
  const D = odd(K); const { R, X } = K;
  const PLAY = Object.keys(X);
  await api(db, HOST, 'app_start', { room_id: R, kind: 'odd' });
  await D.key('next');                                                                   // START ANYWAY (nobody checked in)
  assert.equal((await D.app()).phase, 'card');
  // round 1: two innocents tied at the top (2 votes each), the odd one out on 1 or fewer
  let s = await D.secret(); let O = D.name(s.odd);
  let inno = PLAY.filter(n => n !== O);                                                   // four innocents: i0..i3
  await D.toVote(PLAY);
  const ballots = { [O]: inno[0], [inno[2]]: inno[0], [inno[3]]: inno[1], [inno[0]]: inno[1], [inno[1]]: inno[2] };
  for (const [n, t] of Object.entries(ballots)) await D.move(n, { op: 'vote', player_id: X[t].id });
  let h = await D.app();
  assert.equal(h.phase, 'result'); assert.equal(h.last.outcome, 'escaped');
  const tied = [X[inno[0]].id, X[inno[1]].id];
  assert.deepEqual([...h.last.tops].sort(), [...tied].sort(), 'tied at the top'); assert.deepEqual([...h.last.losers].sort(), [...tied].sort(), 'an innocent tie: they all lose');
  await D.key('next');
  // round 2: a tie that includes the odd one out counts as caught; then a wrong guess
  s = await D.secret(); O = D.name(s.odd);
  inno = PLAY.filter(n => n !== O);
  await D.toVote(PLAY, { clock: true });
  const b2 = { [inno[0]]: O, [inno[1]]: O, [O]: inno[0], [inno[2]]: inno[0], [inno[3]]: inno[1] };
  for (const [n, t] of Object.entries(b2)) await D.move(n, { op: 'vote', player_id: X[t].id });
  h = await D.app();
  assert.equal(h.phase, 'caught', 'a tie that includes the odd one out: caught');
  assert.deepEqual([...h.last.tops].sort(), [s.odd, X[inno[0]].id].sort());
  await D.key('next'); await D.key('judge', { right: false });                           // THEY DIDN'T
  h = await D.app(); assert.equal(h.last.outcome, 'wrong'); assert.deepEqual(h.last.losers, [s.odd], 'a wrong guess: the odd one out loses');
  await D.key('next');
  // round 3: the host ends the vote before anyone votes: nobody voted out, nobody loses; then the host stops the game
  await D.toVote(PLAY, { clock: true });
  await D.key('next');                                                                   // END VOTING NOW
  h = await D.app(); assert.equal(h.phase, 'result'); assert.equal(h.last.outcome, 'escaped');
  assert.deepEqual(h.last.tops, []); assert.deepEqual(h.last.losers, []); assert.equal(h.last.total, 0);
  const lost = [...tied, s.odd];
  // (the rounds are all played: stop goes straight to CASE CLOSED)
  await D.host('stop');
  h = await D.app(); assert.equal(h.phase, 'final'); assert.deepEqual([...h.losers].sort(), [...new Set(lost)].sort());
  await D.due(); await D.tick();
  assert.equal((await K.H()).game.status, 'ended');
  assert.deepEqual((await lostRows(K)).sort(), [...lost].sort());
  // a stop in the middle of a round: only the rounds finished count
  for (const q of (await K.H()).queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id });
  await api(db, HOST, 'app_start', { room_id: R, kind: 'odd' });
  await D.key('next');
  s = await D.secret(); O = D.name(s.odd);
  await D.toVote(PLAY);
  for (const n of PLAY) await D.move(n, { op: 'vote', player_id: n === O ? X[PLAY.find(m => m !== O)].id : s.odd });
  await D.key('next'); await D.key('judge', { right: false });                           // round 1: the odd one out loses
  await D.key('next');
  for (const n of PLAY) await D.move(n, { op: 'read' });
  assert.equal((await D.app()).phase, 'clues');
  const s2 = await D.secret();
  await D.host('stop');                                                                  // END GAME during round 2's clues
  h = await D.app(); assert.equal(h.phase, 'final'); assert.equal(h.rounds.length, 1); assert.deepEqual(h.losers, [s.odd]);
  assert.ok(!JSON.stringify(await K.H()).includes(s2.famous), 'the unfinished round stays secret');
  assert.ok(!JSON.stringify(h).includes('"odd":"' + s2.odd + '"') || s2.odd === s.odd);
  await D.host('stop');                                                                  // END GAME on CASE CLOSED: over now
  assert.equal((await K.H()).game.status, 'ended');
  assert.deepEqual(await lostRows(K), [s.odd]);
  step('ODD ONE OUT: an innocent tie all lose; a tie with the odd one out is caught; a wrong guess loses; no votes, nobody loses; a stop mid-round counts only the rounds finished');
}

// ======================================================================================================
// The Angel plays but is never the odd one out and never loses; with fewer players than rounds the odd one out
// repeats only once everyone has had a go; a pick that times out is made at random
// ======================================================================================================
{
  const K = await mkRoom([['Ang', 'drinker'], ['A', 'drinker'], ['B', 'drinker']]);
  const D = odd(K); const { R, X } = K;
  const PLAY = Object.keys(X);
  await sql("update players set public_role = 'angel' where id = $1", [X.Ang.id]);
  await expectErr(api(db, HOST, 'app_start', { room_id: R, kind: 'odd', player_ids: [X.A.id, X.B.id] }), /at least 3/);
  await api(db, HOST, 'app_start', { room_id: R, kind: 'odd' });
  assert.equal((await D.app()).players.length, 3, 'the Angel plays');
  for (const n of PLAY) await D.move(n, { op: 'here' });
  // round 1: the room votes the Angel out (innocent): they're never punished, so nobody loses
  let s = await sweep(K, D, 'Angel R1 card');
  assert.notEqual(s.odd, X.Ang.id, 'the Angel is never the odd one out');
  assert.equal((await D.app('Ang')).mine.famous, s.famous, 'the Angel gets the name like everyone else');
  let O = D.name(s.odd), other = PLAY.find(n => n !== O && n !== 'Ang');
  await D.toVote(PLAY);
  await D.move(O, { op: 'vote', player_id: X.Ang.id }); await D.move(other, { op: 'vote', player_id: X.Ang.id }); await D.move('Ang', { op: 'vote', player_id: X[other].id });
  let h = await D.app();
  assert.equal(h.last.outcome, 'escaped'); assert.deepEqual(h.last.tops, [X.Ang.id]); assert.deepEqual(h.last.losers, [], 'the Angel never loses');
  const odds = [s.odd];
  await D.key('next');
  // round 2: caught, named it: the Angel can't be picked
  s = await D.secret(); O = D.name(s.odd); other = PLAY.find(n => n !== O && n !== 'Ang');
  assert.notEqual(s.odd, X.Ang.id); assert.notEqual(s.odd, odds[0], 'not the same odd one out twice while someone is left');
  odds.push(s.odd);
  await D.toVote(PLAY, { clock: true });
  await D.move(other, { op: 'vote', player_id: s.odd }); await D.move('Ang', { op: 'vote', player_id: s.odd }); await D.move(O, { op: 'vote', player_id: X.Ang.id });
  await D.key('next'); await D.key('judge', { right: true });
  await expectErr(D.move(O, { op: 'pick', player_id: X.Ang.id }), /not the Angel/);
  await D.move(O, { op: 'pick', player_id: X[other].id });
  h = await D.app(); assert.deepEqual(h.last.losers, [X[other].id]);
  await D.key('next');
  // round 3: both have had a go, so one of them again (never the Angel); they name it and don't pick in time
  s = await D.secret(); O = D.name(s.odd); other = PLAY.find(n => n !== O && n !== 'Ang');
  assert.ok(odds.includes(s.odd), 'everyone has had a go: a repeat'); assert.notEqual(s.odd, X.Ang.id);
  await D.toVote(PLAY, { clock: true });
  await D.move(other, { op: 'vote', player_id: s.odd }); await D.move('Ang', { op: 'vote', player_id: s.odd }); await D.move(O, { op: 'vote', player_id: X[other].id });
  await D.key('next'); await D.key('judge', { right: true });
  await D.due(); await D.tick();                                                         // 45 seconds and no pick: at random
  h = await D.app(); assert.equal(h.last.random, true); assert.equal(h.last.picked, X[other].id, 'the only one it can be (not the Angel)');
  await D.key('next'); await D.key('next');
  const rows = await lostRows(K);
  assert.ok(!rows.includes(X.Ang.id), 'the Angel never goes in the queue');
  assert.ok(!(await K.H()).game.losers.includes(X.Ang.id));
  assert.equal(rows.length, 2);
  step('ODD ONE OUT: the Angel plays, is never the odd one out and never loses; repeats only once everyone has had a go; a pick that times out is random (never the Angel); needs 3 players');
}

console.log('\nALL ODD ONE OUT TESTS PASSED');
