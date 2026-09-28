// Full-night logic test against the real migrations (in PGlite). Run: node tests/logic.test.mjs
import { createDb, api, state, addUser } from '../server/db.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = await createDb();
const HOST = randomUUID();
await addUser(db, HOST, false, 'host@example.com');
const expectErr = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail('expected error ' + re); };
const step = m => console.log('✓ ' + m);
const sql = (q, p = []) => db.query(q, p).then(r => r.rows);

// ---------- room, cards, players ----------
await expectErr((async () => { const u = randomUUID(); await addUser(db, u); await api(db, u, 'create_room'); })(), /Host login/);
const { room_id, code } = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
const counts = { intruder: 1, betrayer: 1, forger: 1, medic: 1, detective: 1, lovebird: 1, cursed: 1, jester: 1, drinker: 2 };
const { cards } = await api(db, HOST, 'generate_cards', { room_id, role_counts: counts });
assert.equal(cards.length, 11);
const NAMES = ['Harry', 'Megan', 'Fred', 'Jake', 'Dora', 'Sophie', 'Tom', 'Priya', 'Olly', 'Ellie', 'Dan'];
const DEAL = { Harry: 'intruder', Megan: 'betrayer', Fred: 'forger', Jake: 'medic', Dora: 'detective', Sophie: 'lovebird', Tom: 'lovebird',
               Priya: 'cursed', Olly: 'jester', Ellie: 'drinker', Dan: 'drinker' };
const P = {};
for (const n of NAMES) { const uid = randomUUID(); await addUser(db, uid); P[n] = { uid, id: (await api(db, uid, 'join', { code, name: n })).player_id }; }
const pool = [...cards];
for (const n of NAMES) { const i = pool.findIndex(c => c.role === DEAL[n]); await api(db, P[n].uid, 'redeem', { room_id, code: pool.splice(i, 1)[0].code }); }
const S = async n => (await state(db, P[n].uid, code));
const H = async () => state(db, HOST, code);
const pl = (st, n) => st.players.find(p => p.id === P[n].id);
step('11 players joined and redeemed (incl. Detective + Forger)');

// ---------- teams ----------
assert.equal((await S('Harry')).me.secret.team, 'guilty');
assert.equal((await S('Fred')).me.secret.team, 'guilty');
assert.equal((await S('Megan')).me.secret.team, 'drinkers');     // betrayer: innocent until teamed
assert.equal((await S('Olly')).me.secret.team, 'chaos');
assert.equal((await S('Dora')).me.secret.team, 'drinkers');
const hv = await H();
assert.equal(hv.me.secret, null);
assert.ok(!JSON.stringify({ p: hv.players, e: hv.events, r: hv.round }).match(/intruder|forger|detective|medic|betrayer|guilty/));
step('teams: Intruder/Forger GUILTY, Betrayer DRINKERS until teamed, Jester CHAOS; TV sees no roles');

// ---------- beers ----------
for (const n of ['Harry', 'Megan', 'Fred', 'Jake', 'Dora', 'Sophie', 'Tom', 'Priya', 'Olly']) await api(db, P[n].uid, 'log_beer', { room_id });
await api(db, HOST, 'log_beer', { room_id, delta: 1 });
assert.equal((await H()).room.tally, 10);
step('beers logged (Ellie + Dan logged none)');

// ---------- Medic heals ahead of time; Forger learns a heal exists, forges it ----------
assert.equal((await S('Fred')).me.secret.forge_ready, false);
await expectErr(api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Jake.id }), /yourself/);
await api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Tom.id });
assert.equal((await S('Fred')).me.secret.forge_ready, true);
assert.ok(!JSON.stringify(await S('Fred')).includes(P.Tom.id + '","used'), 'forger must not learn the target');
await api(db, P.Fred.uid, 'forge', { room_id });
await expectErr(api(db, P.Fred.uid, 'forge', { room_id }), /already forged/);
assert.deepEqual((await S('Jake')).me.secret.my_heals, [{ name: 'Tom', used: false }]);   // medic isn't told
step('Medic heals Tom in advance → Forger alerted (not told who) → forged once; Medic not told');

// ---------- game 1: losers + automatic slacker ----------
await expectErr(api(db, HOST, 'start_game', { room_id, name: 'X', matchup: [[randomUUID()]] }), /Unknown player/);
let { game_id } = await api(db, HOST, 'start_game', { room_id, name: 'Beer Pong', matchup: [[P.Tom.id, P.Priya.id], [P.Ellie.id, P.Dan.id]] });
assert.deepEqual((await H()).game.matchup, [[P.Tom.id, P.Priya.id], [P.Ellie.id, P.Dan.id]]);
await api(db, HOST, 'finish_game', { room_id, game_id, losers: [P.Tom.id] });
let st = await H();
assert.deepEqual(new Set(st.game.slackers), new Set([P.Ellie.id, P.Dan.id]));
assert.equal(st.game.slacker_beers, 0);
assert.deepEqual(st.queue.map(q => q.player_id).slice(0, 1), [P.Tom.id]);
step('game over: loser Tom queued; slackers = Ellie + Dan (0 beers, tie → both)');

// ---------- Tom spins: forged heal → FORGED then spins; Lovebirds revealed on accept ----------
await api(db, HOST, 'call_next', { room_id });
await api(db, P.Tom.uid, 'spin', { room_id });
st = await H();
assert.equal(st.round.phase, 'spinning'); assert.equal(st.round.forged, true);
await api(db, HOST, 'accept', { room_id, force: true });
st = await H();
if (pl(st, 'Tom').punishments.length) { assert.equal(pl(st, 'Tom').public_role, 'lovebird'); assert.equal(pl(st, 'Sophie').punishments.length, pl(st, 'Tom').punishments.length); }
step('Tom\'s forged heal: SAVED→FORGED flag, wheel spins anyway; Lovebird pair shares it');
for (const q of st.queue) await api(db, HOST, 'queue_remove', { room_id, queue_id: q.id });

// ---------- a real heal still saves ----------
await api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Ellie.id });
await api(db, HOST, 'call_next', { room_id, player_id: P.Ellie.id });
await api(db, P.Ellie.uid, 'spin', { room_id });
assert.equal((await H()).round.phase, 'saved');
await api(db, HOST, 'finish_saved', { room_id });
await expectErr(api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Dan.id }), /No heals left/);
step('intact Medic heal → SAVED; 2 heals max');

// ---------- Detective: one check per game, read once ----------
let { check_id } = await api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Fred.id });
assert.equal(check_id.length, 36);
assert.ok(!JSON.stringify(await S('Dora')).includes('"guilty"'), 'result must not sit in state');
await expectErr(api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Dan.id }), /Read your last file|No investigations/);
const view = await api(db, P.Dora.uid, 'view_check', { room_id, check_id });
assert.equal(view.guilty, true);
await expectErr(api(db, P.Dora.uid, 'view_check', { room_id, check_id }), /already been burned/);
// 1 game finished → 2 checks available in total
// Forger frames Dan (once): the Detective's check on Dan reads GUILTY
assert.equal((await S('Fred')).me.secret.frame_ready, true);
await expectErr(api(db, P.Dan.uid, 'frame', { room_id, player_id: P.Ellie.id }), /can't do that/);
await api(db, P.Fred.uid, 'frame', { room_id, player_id: P.Dan.id });
await expectErr(api(db, P.Fred.uid, 'frame', { room_id, player_id: P.Ellie.id }), /already framed/);
assert.deepEqual((await S('Fred')).me.secret.frame, { name: 'Dan', spent: false });
assert.ok(!JSON.stringify(await H()).includes('frame'), 'TV never hears about the frame');
({ check_id } = await api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Dan.id }));
assert.equal((await api(db, P.Dora.uid, 'view_check', { room_id, check_id })).guilty, true);
assert.deepEqual((await S('Fred')).me.secret.frame, { name: 'Dan', spent: true });
await expectErr(api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Megan.id }), /until the next game ends/);
step('Detective: Fred = GUILTY; Forger framed Dan so he reads GUILTY too (once); each result readable once; checks = 1 + games finished');

// ---------- Intruder Hit: can't name Drinker/Cursed; right → cover blown + powers burned; 1 per game ----------
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Dan.id, role: 'drinker' }), /can't name that role/);
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Priya.id, role: 'jester' }), /cover is already blown/);
let hit = await api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Dora.id, role: 'detective' });
assert.equal(hit.correct, true);
st = await H();
assert.equal(pl(st, 'Dora').public_role, 'detective');
assert.equal((await S('Dora')).me.secret.checks_left, 0);
assert.equal(st.events.at(-1).kind, 'hit');
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'jester' }), /One hit per game/);
step('Hit: Dora named as Detective → cover blown, powers burned, queued; next Hit waits for the next game');

// ---------- game 2 → Trial vote with evidence ----------
({ game_id } = await api(db, HOST, 'start_game', { room_id, name: 'Flip Cup' }));
await api(db, HOST, 'finish_game', { room_id, game_id, losers: [] });
assert.equal((await S('Dora')).me.secret.checks_left, 0);   // burned stays burned
await api(db, P.Ellie.uid, 'submit_evidence', { room_id, image_url: 'https://x/pour.jpg', caption: 'Who poured this out??' });
st = await H();
assert.equal(st.evidence.length, 1); assert.ok(!JSON.stringify(st.evidence).includes(P.Ellie.id));
assert.deepEqual((await S('Dan')).evidence, []);
// wrong Hit ends the streak
hit = await api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'medic' });
assert.equal(hit.correct, false);
assert.equal((await S('Harry')).me.secret.hit_alive, false);
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'jester' }), /blunt/);
step('evidence submitted anonymously (TV only); a wrong Hit ends the streak for the night');

// Trial 1: majority accuses Dan (innocent) → accusers drink, NOT GUILTY
let { vote_id } = await api(db, HOST, 'start_vote', { room_id, kind: 'trial' });
for (const n of ['Harry', 'Megan', 'Jake', 'Tom', 'Olly']) await api(db, P[n].uid, 'cast_vote', { room_id, vote_id, choice_id: P.Dan.id });
for (const n of ['Sophie', 'Priya']) await api(db, P[n].uid, 'cast_vote', { room_id, vote_id, choice_id: '00000000-0000-0000-0000-000000000000' });
let out = await api(db, HOST, 'close_vote', { room_id, vote_id });
assert.equal(out.result, 'innocent');
st = await H();
assert.equal(pl(st, 'Dan').public_role, null);
assert.ok(pl(st, 'Megan').punishments.some(p => p.text === 'Wrong accusation'));
step('Trial: majority on Dan → NOT GUILTY, the 5 accusers get a penalty drink, Dan\'s role stays secret');

// Betrayer finds the Intruder → Guilty
const g = await api(db, P.Megan.uid, 'betrayer_guess', { room_id, player_id: P.Harry.id });
assert.equal(g.correct, true);
assert.equal((await S('Megan')).me.secret.team, 'guilty');
assert.equal((await S('Megan')).me.secret.hit_alive, false);   // Betrayer gets no Intruder powers
step('Betrayer guessed right → joins the Guilty (no powers)');

// Trial 2: majority convicts Harry → rehab, knife to Megan
({ vote_id } = await api(db, HOST, 'start_vote', { room_id, kind: 'trial' }));
for (const n of ['Megan', 'Jake', 'Tom', 'Olly', 'Ellie', 'Dan']) await api(db, P[n].uid, 'cast_vote', { room_id, vote_id, choice_id: P.Harry.id });
out = await api(db, HOST, 'close_vote', { room_id, vote_id });
assert.equal(out.result, 'guilty'); assert.equal(out.role, 'intruder');
st = await H();
assert.equal(pl(st, 'Harry').rehab, true); assert.equal(pl(st, 'Harry').public_role, 'intruder');
const meg = (await S('Megan')).me.secret;
assert.equal(meg.has_knife, true); assert.equal(meg.hit_ready, true);
assert.equal((await S('Harry')).me.secret.hit_alive, false);
step('Trial: Harry convicted → REHAB (powerless); the knife passes to Megan with a fresh Hit');

// Megan's first Hit (knife holder)
hit = await api(db, P.Megan.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'jester' });
assert.equal(hit.correct, true);
assert.equal(pl(await H(), 'Olly').public_role, 'jester');
await expectErr(api(db, P.Olly.uid, 'jester_graffiti', { room_id, text: 'Nope nope' }), /can't do that/);
step('knife holder lands a Hit on the Jester → powers burned');

// ---------- host undo ----------
const before = (await H()).room.tally;
await api(db, HOST, 'log_beer', { room_id, delta: -1 });
await api(db, P.Ellie.uid, 'log_beer', { room_id });       // a phone beer logged after the host action…
let u = await api(db, HOST, 'undo', { room_id });
assert.equal(u.undone, '−1 beer');
assert.equal((await H()).room.tally, before + 1, 'undo reverts the −1 but keeps Priya\'s beer');
await api(db, HOST, 'expose', { room_id, player_id: P.Fred.id });
assert.equal(pl(await H(), 'Fred').rehab, true);
await api(db, HOST, 'undo', { room_id });
assert.equal(pl(await H(), 'Fred').public_role, null);
await expectErr(api(db, P.Dan.uid, 'undo', { room_id }), /Only the host/);
step('host undo: reverts −1 (keeps later phone beers) and an Expose; host-only');

// ---------- host free spin: whole room (nothing logged) and on a player (skips the queue) ----------
await expectErr(api(db, P.Dan.uid, 'free_spin', { room_id }), /Only the host/);
const punBefore = (await sql('select count(*)::int n from punishments'))[0].n;
await api(db, HOST, 'free_spin', { room_id, reason: 'Birthday spin' });
st = await H();
assert.equal(st.round.victim_id, null); assert.equal(st.round.phase, 'spinning'); assert.ok(st.round.landings.length >= 1);
await api(db, HOST, 'accept', { room_id, force: true });
assert.equal((await sql('select count(*)::int n from punishments'))[0].n, punBefore);
await api(db, HOST, 'free_spin', { room_id, player_id: P.Ellie.id });
st = await H();
assert.equal(st.round.victim_id, P.Ellie.id); assert.equal(st.round.reason, "Host's spin");
await api(db, HOST, 'accept', { room_id, force: true });
step('host free spin: whole room (nothing logged) or a chosen player, straight to the wheel');

// ---------- deadline, reveal ----------
await api(db, HOST, 'update_settings', { room_id, deadline_at: new Date(Date.now() - 1000).toISOString() });
await api(db, P.Dan.uid, 'end_check', { room_id });
st = await H();
assert.equal(st.room.ended, true); assert.equal(st.room.result.winner, 'guilty'); assert.equal(st.room.result.betrayer_joined, true);
await api(db, HOST, 'reveal_all', { room_id });
st = await H();
assert.equal(pl(st, 'Fred').public_role, 'forger');
assert.equal(st.room.reveal.forgeries.length, 1);
assert.equal(st.room.reveal.checks.filter(c => c.framed).length, 1);
assert.deepEqual(st.room.reveal.frames, [{ forger: P.Fred.id, target: P.Dan.id, spent: true }]);
assert.equal(st.room.reveal.checks[0].guilty, true);
assert.deepEqual(new Set(st.room.reveal.guilty), new Set([P.Harry.id, P.Fred.id, P.Megan.id]));
step('deadline → THE GUILTY WIN; reveal-all shows roles, forgery, Detective checks and the Guilty team');

// ---------- secrecy sweep ----------
const dan = await S('Dan');
const blob = JSON.stringify({ p: dan.players.filter(p => !p.public_role), me: dan.me, e: dan.events, ev: dan.evidence });
assert.ok(!/"(intruder|forger|medic|betrayer|detective)"/.test(JSON.stringify(dan.me)), 'drinker sees only own role');
void blob;
step('secrecy sweep passed');
console.log('\nALL LOGIC TESTS PASSED');
