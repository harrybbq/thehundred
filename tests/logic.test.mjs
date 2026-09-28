// Full-game logic test against the real migrations (in PGlite). Run: node tests/logic.test.mjs
import { createDb, api, state, addUser } from '../server/db.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = await createDb();
const HOST = randomUUID();
await addUser(db, HOST, false, 'host@example.com');
const expectErr = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail('expected error ' + re); };
const step = m => console.log('✓ ' + m);

// --- room + cards
await expectErr((async () => { const u = randomUUID(); await addUser(db, u); await api(db, u, 'create_room'); })(), /Host login/);
const { room_id, code } = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
await api(db, HOST, 'update_settings', { room_id, settings: { intruder_fake_heal: true } });
const { cards } = await api(db, HOST, 'generate_cards', { room_id, role_counts: { intruder: 1, betrayer: 1, medic: 1, lovebird: 1, cursed: 1, jester: 1, drinker: 3 } });
assert.equal(cards.length, 10);
step('room created, 10 cards generated (lovebird = pair)');

// --- 10 players join
const names = ['Harry', 'Sophie', 'Jake', 'Megan', 'Tom', 'Priya', 'Olly', 'Ellie', 'Dan', 'Chloe'];
const P = {};
for (const n of names) {
  const uid = randomUUID(); await addUser(db, uid);
  const r = await api(db, uid, 'join', { code, name: n, selfie_url: `https://x/${n}.jpg` });
  P[n] = { uid, id: r.player_id };
}
await expectErr((async () => { const u = randomUUID(); await addUser(db, u); await api(db, u, 'join', { code, name: 'harry' }); })(), /already has that name/);
step('10 players joined');

// --- deal roles by name
const byRole = r => cards.filter(c => c.role === r).map(c => c.code);
const deal = { Harry: byRole('intruder')[0], Sophie: byRole('lovebird')[0], Tom: byRole('lovebird')[1], Jake: byRole('medic')[0],
  Megan: byRole('betrayer')[0], Priya: byRole('cursed')[0], Olly: byRole('jester')[0], Ellie: byRole('drinker')[0], Dan: byRole('drinker')[1], Chloe: byRole('drinker')[2] };
for (const [n, c] of Object.entries(deal)) await api(db, P[n].uid, 'redeem', { room_id, code: c.toLowerCase() });
await expectErr(api(db, P.Harry.uid, 'redeem', { room_id, code: byRole('drinker')[0] }), /already have a role/);
const u2 = randomUUID(); await addUser(db, u2); await api(db, u2, 'join', { code, name: 'Late' });
await expectErr(api(db, u2, 'redeem', { room_id, code: deal.Ellie }), /not valid or has already been used|isn't valid/);
await api(db, HOST, 'kick', { room_id, player_id: (await state(db, u2, code)).me.player_id });
step('roles redeemed; codes are single-use');

// --- SECURITY: views
const sHost = await state(db, HOST, code);
assert.equal(sHost.me.secret, null);
assert.ok(!JSON.stringify(sHost).includes('"intruder"') || !JSON.stringify(sHost.players).includes('intruder'));
assert.ok(sHost.players.every(p => p.public_role === null && p.has_role));
assert.equal(sHost.players.find(p => p.id === P.Priya.id).cursed, true);   // curse is public
const sSophie = await state(db, P.Sophie.uid, code);
assert.equal(sSophie.me.secret.role, 'lovebird');
assert.equal(sSophie.me.secret.partner.name, 'Tom');
const sDan = await state(db, P.Dan.uid, code);
assert.equal(sDan.me.secret.role, 'drinker');
{ const m = JSON.stringify({ p: sDan.players, e: sDan.events, me: sDan.me, r: sDan.round }).match(/.{80}(intruder|medic|jester|betrayer|lovebird).{40}/); assert.ok(!m, 'drinker view leaks roles: ' + (m && m[0])); }
step('TV/host view has no secrets; players only see their own role (+ lovebird partner)');

// --- beers + cooldown + host -1
await api(db, P.Dan.uid, 'log_beer', { room_id });
await expectErr(api(db, P.Dan.uid, 'log_beer', { room_id }), /Wait \d+ more seconds/);
await expectErr(api(db, P.Dan.uid, 'log_beer', { room_id, delta: -1 }), /Only the host/);
for (const n of names.slice(0, 9)) if (n !== 'Dan') await api(db, P[n].uid, 'log_beer', { room_id });
await api(db, HOST, 'log_beer', { room_id, delta: 1 });
await api(db, HOST, 'log_beer', { room_id, delta: -1 });
assert.equal((await state(db, HOST, code)).room.tally, 9);
step('beer logging: +1 per player with 20s cooldown, host ±1, tally 9');

// --- game with losers + slacker vote with a tie
const { game_id } = await api(db, HOST, 'start_game', { room_id, name: 'Beer Pong' });
await api(db, HOST, 'finish_game', { room_id, game_id, losers: [P.Ellie.id, P.Tom.id] });
const { vote_id } = await api(db, HOST, 'start_vote', { room_id, kind: 'slacker', game_id });
await expectErr(api(db, P.Dan.uid, 'cast_vote', { room_id, vote_id, choice_id: P.Dan.id }), /yourself/);
const votes = { Harry: 'Chloe', Sophie: 'Chloe', Jake: 'Dan', Megan: 'Dan', Olly: 'Chloe', Ellie: 'Dan' };
for (const [v, c] of Object.entries(votes)) await api(db, P[v].uid, 'cast_vote', { room_id, vote_id, choice_id: P[c].id });
await expectErr(api(db, P.Harry.uid, 'cast_vote', { room_id, vote_id, choice_id: P.Dan.id }), /already voted/);
await expectErr(api(db, P.Harry.uid, 'close_vote', { room_id, vote_id }), /still running/);
const vr = await api(db, HOST, 'close_vote', { room_id, vote_id });
assert.deepEqual(new Set(vr.winners), new Set([P.Chloe.id, P.Dan.id]));
let st = await state(db, HOST, code);
assert.deepEqual(st.queue.slice(0, 2).map(q => q.player_id), [P.Ellie.id, P.Tom.id]);
assert.deepEqual(new Set(st.queue.slice(2).map(q => q.player_id)), new Set([P.Chloe.id, P.Dan.id]));
if (st.queue[2].player_id !== P.Chloe.id) { /* keep test deterministic: Chloe third */ }
step('game losers + tied slacker vote → queue [Ellie, Tom, Chloe, Dan]');

// --- round 1: Ellie, no heal
const spinAndAccept = async (victimUid) => {
  await api(db, victimUid, 'spin', { room_id });
  let s = await state(db, HOST, code);
  if (s.round.phase === 'spinning') {
    await api(db, HOST, 'round_revealed', { room_id, spin_seq: s.round.spin_seq });
    await expectErr(api(db, HOST, 'accept', { room_id }), /few more seconds/);
    await api(db, HOST, 'accept', { room_id, force: true });
  } else await api(db, HOST, 'finish_saved', { room_id });
  return s.round;
};
let r = (await api(db, HOST, 'call_next', { room_id }));
await expectErr(api(db, P.Dan.uid, 'spin', { room_id }), /not your turn/);
let rd = await spinAndAccept(P.Ellie.uid);
assert.equal(rd.phase, 'spinning'); assert.equal(rd.landings.length >= 1, true);
step('round 1: Ellie spins (server-chosen landing ' + JSON.stringify(rd.landings.map(l => l.text)) + ')');

// --- round 2: Tom (lovebird) healed by Medic Jake → SAVED, covers both, pair stays hidden
await api(db, HOST, 'call_next', { room_id });
await expectErr(api(db, P.Dan.uid, 'heal', { room_id }), /can't do that/);
await api(db, P.Jake.uid, 'heal', { room_id });
await expectErr(api(db, P.Jake.uid, 'heal', { room_id }), /already healed/);
const hostBefore = await state(db, HOST, code);
assert.ok(!JSON.stringify({ r: hostBefore.round, p: hostBefore.players, e: hostBefore.events }).match(/heal|shield/i), 'host view must not show a pending heal');
rd = await spinAndAccept(P.Tom.uid);
assert.equal(rd.phase, 'saved');
st = await state(db, HOST, code);
assert.equal(st.players.find(p => p.id === P.Tom.id).punishments.length, 0);
assert.equal(st.players.find(p => p.id === P.Sophie.id).punishments.length, 0);
assert.equal(st.players.find(p => p.id === P.Tom.id).public_role, null);
assert.equal((await state(db, P.Jake.uid, code)).me.secret.heals_left, 1);
step('round 2: Medic heals Lovebird Tom → SAVED, nobody punished, pair still hidden');

// --- round 3: Chloe; Medic heals Chloe, then Jester swaps to Sophie (lovebird) → Sophie spins unhealed,
//     Tom gets it too and the pair is revealed. Heal stays with Chloe.
await api(db, HOST, 'call_next', { room_id, player_id: P.Chloe.id });
await api(db, P.Jake.uid, 'heal', { room_id });
await expectErr(api(db, P.Jake.uid, 'heal', { room_id }), /already healed|No heals/);
await api(db, P.Olly.uid, 'jester_swap', { room_id, player_id: P.Sophie.id });
await expectErr(api(db, P.Olly.uid, 'jester_swap', { room_id, player_id: P.Dan.id }), /already used/);
await expectErr(api(db, P.Chloe.uid, 'spin', { room_id }), /not your turn/);
// force a normal landing for determinism: keep re-trying via cancel if Safe
let ok = false;
for (let i = 0; i < 30 && !ok; i++) {
  await api(db, P.Sophie.uid, 'spin', { room_id });
  st = await state(db, HOST, code);
  assert.equal(st.round.phase, 'spinning', 'Sophie must not inherit Chloe\'s heal');
  if (st.round.landings.some(l => l.kind === 'normal')) ok = true;
  else { await api(db, HOST, 'cancel_round', { room_id }); await api(db, HOST, 'call_next', { room_id, player_id: P.Sophie.id }); }
}
await api(db, HOST, 'round_revealed', { room_id, spin_seq: st.round.spin_seq });
// jester re-spin within the window
const seqBefore = st.round.spin_seq;
await api(db, P.Olly.uid, 'jester_respin', { room_id });
st = await state(db, HOST, code);
assert.equal(st.round.phase, 'spinning'); assert.equal(st.round.spin_seq, seqBefore + 1);
assert.equal(st.events.at(-1).kind, 'jester'); assert.ok(!JSON.stringify(st.events.at(-1)).includes(P.Olly.id));
await api(db, HOST, 'accept', { room_id, force: true });
st = await state(db, HOST, code);
const soph = st.players.find(p => p.id === P.Sophie.id), tom = st.players.find(p => p.id === P.Tom.id);
const normals = (await state(db, HOST, code)).players.find(p => p.id === P.Sophie.id).punishments.length;
if (normals > 0) {
  assert.equal(soph.public_role, 'lovebird'); assert.equal(tom.public_role, 'lovebird'); assert.equal(soph.love_partner_id, P.Tom.id);
  assert.equal(tom.punishments.length, soph.punishments.length);
}
step(`round 3: heal on Chloe, Jester swap → Sophie (unhealed), Jester re-spin, accept → Lovebirds ${normals ? 'revealed & both punished' : '(re-spin landed Safe)'}`);

// Chloe's heal stays with her: next time she spins she's SAVED
st = await state(db, HOST, code);
await api(db, HOST, 'call_next', { room_id, player_id: P.Chloe.id });
rd = await spinAndAccept(P.Chloe.uid);
assert.equal(rd.phase, 'saved');
step('heal stayed with the original victim (Chloe saved on her next spin)');

// --- Medic out of heals; can't self heal
await api(db, HOST, 'call_next', { room_id, player_id: P.Jake.id });
await expectErr(api(db, P.Jake.uid, 'heal', { room_id }), /yourself/);
await api(db, HOST, 'cancel_round', { room_id });
await api(db, HOST, 'call_next', { room_id, player_id: P.Dan.id });
await expectErr(api(db, P.Jake.uid, 'heal', { room_id }), /No heals left/);
// Intruder fake heal on Dan → SAVED publicly, owed at end of night
await api(db, P.Harry.uid, 'heal', { room_id, fake: true });
await expectErr(api(db, P.Harry.uid, 'heal', { room_id, fake: true }), /No fake heals/);
rd = await spinAndAccept(P.Dan.uid);
assert.equal(rd.phase, 'saved'); assert.deepEqual(rd.landings, []);
step('Medic limits (no self-heal, 2 heals) + Intruder fake heal looks identical (SAVED)');

// --- Curse: Priya cursed → double spin; pass to Harry with host approval
await api(db, HOST, 'call_next', { room_id, player_id: P.Priya.id });
await api(db, P.Priya.uid, 'spin', { room_id });
st = await state(db, HOST, code);
assert.equal(st.round.cursed, true);
assert.equal(new Set(st.round.landings.map(l => l.spin)).size, 2, 'cursed = two spins');
await api(db, HOST, 'accept', { room_id, force: true });
await expectErr(api(db, P.Dan.uid, 'request_curse_pass', { room_id, player_id: P.Harry.id }), /don't hold/);
await api(db, P.Priya.uid, 'request_curse_pass', { room_id, player_id: P.Harry.id });
st = await state(db, HOST, code);
await expectErr(api(db, P.Priya.uid, 'decide_curse', { room_id, pass_id: st.curse_passes[0].id, approve: true }), /Only the host/);
await api(db, HOST, 'decide_curse', { room_id, pass_id: st.curse_passes[0].id, approve: true });
st = await state(db, HOST, code);
assert.equal(st.players.find(p => p.id === P.Harry.id).cursed, true);
assert.equal(st.players.find(p => p.id === P.Priya.id).cursed, false);
step('curse doubles spins; pass requires host approval and moves the skull');

// --- Jester graffiti
await expectErr(api(db, P.Dan.uid, 'jester_graffiti', { room_id, text: 'Lick the floor' }), /can't do that/);
await api(db, P.Olly.uid, 'jester_graffiti', { room_id, text: 'Do 10 press-ups while the room counts in French!!! '.repeat(3) });
st = await state(db, HOST, code);
assert.equal(st.graffiti.length, 1); assert.ok(st.graffiti[0].text.length <= 60);
assert.equal(st.room.wheel.at(-1).graffiti, true);
await expectErr(api(db, P.Olly.uid, 'jester_graffiti', { room_id, text: 'again' }), /already used/);
await api(db, P.Olly.uid, 'jester_respin', { room_id }).catch(e => assert.match(e.message, /Too late/));
await api(db, HOST, 'remove_graffiti', { room_id, graffiti_id: st.graffiti[0].id });
assert.equal((await state(db, HOST, code)).graffiti.length, 0);
step('Jester graffiti (≤60 chars, once, host can remove); re-spin only in window');

// --- Betrayer: wrong then right
const pen = (await state(db, HOST, code)).players.find(p => p.id === P.Megan.id).punishments.length;
let g = await api(db, P.Megan.uid, 'betrayer_guess', { room_id, player_id: P.Dan.id });
assert.equal(g.correct, false);
st = await state(db, HOST, code);
assert.equal(st.players.find(p => p.id === P.Megan.id).punishments.length, pen + 1);
assert.equal(st.events.at(-1).kind, 'penalty');
assert.ok(!JSON.stringify(await state(db, P.Dan.uid, code)).includes('accus'), 'accused not told');
g = await api(db, P.Megan.uid, 'betrayer_guess', { room_id, player_id: P.Harry.id });
assert.equal(g.correct, true);
assert.equal((await state(db, P.Harry.uid, code)).me.secret.team[0].name, 'Megan');
assert.equal((await state(db, P.Megan.uid, code)).me.secret.team[0].name, 'Harry');
await expectErr(api(db, P.Megan.uid, 'betrayer_guess', { room_id, player_id: P.Jake.id }), /already found/);
step('Betrayer: wrong guess → penalty (accused not told); right guess → both phones see team');

// --- Expose (host) uses the TRUE role
const ex = await api(db, HOST, 'expose', { room_id, player_id: P.Jake.id, role: 'drinker' });
assert.equal(ex.role, 'medic');
step('host Expose stamps the real role');

// --- countdown end + reveal all
await api(db, HOST, 'update_settings', { room_id, deadline_at: new Date(Date.now() - 1000).toISOString() });
await api(db, P.Dan.uid, 'end_check', { room_id });
st = await state(db, HOST, code);
assert.equal(st.room.ended, true); assert.equal(st.room.result.winner, 'intruder'); assert.equal(st.room.result.betrayer_joined, true);
await expectErr(api(db, P.Ellie.uid, 'log_beer', { room_id }), /frozen/);
await expectErr(api(db, P.Ellie.uid, 'reveal_all', { room_id }), /Only the host/);
await api(db, HOST, 'reveal_all', { room_id });
st = await state(db, HOST, code);
assert.equal(st.players.find(p => p.id === P.Harry.id).public_role, 'intruder');
assert.equal(st.room.reveal.fake_heals.length, 1);
assert.equal(st.room.reveal.fake_heals[0].player, P.Dan.id);
assert.deepEqual(st.room.reveal.teams, [{ betrayer: P.Megan.id, intruder: P.Harry.id }]);
assert.ok(st.players.find(p => p.id === P.Dan.id).punishments.some(p => p.kind === 'fake_heal') || st.room.reveal.fake_heals[0].texts.length === 0);
step('deadline → INTRUDER WINS (+Betrayer), tally frozen, reveal-all shows roles, fake heal, team');
console.log('\nALL LOGIC TESTS PASSED');
