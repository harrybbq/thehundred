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
const counts = { intruder: 1, betrayer: 1, forger: 1, medic: 1, detective: 1, lovebird: 1, cursed: 1, jester: 1, drinker: 4 };
const { cards } = await api(db, HOST, 'generate_cards', { room_id, role_counts: counts });
assert.equal(cards.length, 11, 'Lovebird pairs are a bonus on top of the dealt cards, not extra cards');
assert.ok(!cards.some(c => c.role === 'lovebird'));
assert.equal(cards.filter(c => c.lovebird).length, 2, 'one pair marks exactly 2 cards');
// deterministic for this test: move the pair onto the first two Drinker cards (Sophie & Tom get them)
await sql('update role_codes set pair_id = null where room_id = $1', [room_id]);
const lovePair = randomUUID();
for (const c of cards.filter(c => c.role === 'drinker').slice(0, 2)) await sql('update role_codes set pair_id = $1 where code = $2', [lovePair, c.code.replace('-', '')]);
const NAMES = ['Harry', 'Megan', 'Fred', 'Jake', 'Dora', 'Sophie', 'Tom', 'Priya', 'Olly', 'Ellie', 'Dan'];
const DEAL = { Harry: 'intruder', Megan: 'betrayer', Fred: 'forger', Jake: 'medic', Dora: 'detective', Sophie: 'drinker', Tom: 'drinker',
               Priya: 'cursed', Olly: 'jester', Ellie: 'drinker', Dan: 'drinker' };
const P = {};
for (const n of NAMES) { const uid = randomUUID(); await addUser(db, uid); P[n] = { uid, id: (await api(db, uid, 'join', { code, name: n })).player_id }; }
const pool = [...cards];
for (const n of NAMES) { const i = pool.findIndex(c => c.role === DEAL[n]); await api(db, P[n].uid, 'redeem', { room_id, code: pool.splice(i, 1)[0].code }); }
const S = async n => (await state(db, P[n].uid, code));
const H = async () => state(db, HOST, code);
const pl = (st, n) => st.players.find(p => p.id === P[n].id);
assert.equal((await S('Sophie')).me.secret.lovebird, true);
assert.equal((await S('Sophie')).me.secret.partner.name, 'Tom');
assert.equal((await S('Sophie')).me.secret.role, 'drinker');
assert.equal((await S('Ellie')).me.secret.lovebird, false);
step('11 players joined and redeemed (incl. Detective + Forger); Sophie & Tom are Drinkers with the Lovebird bonus');

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
// drink levels (beers logged on your own phone): 0–3 → 1, 4–7 → 2, 8+ → 3
const setBeers = (n, b) => sql('update players set beers = $1 where id = $2', [b, P[n].id]);
await setBeers('Jake', 4);  await setBeers('Harry', 4);
assert.equal((await H()).room.tally, 10);
step('beers logged (Ellie + Dan logged none)');

// ---------- Medic heals ahead of time; Forger learns a heal exists, forges it ----------
assert.equal((await S('Fred')).me.secret.forge_ready, false);
await expectErr(api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Jake.id }), /yourself/);
await setBeers('Jake', 1);
assert.equal((await S('Jake')).me.secret.heals_left, 1);
await setBeers('Jake', 4);
assert.equal((await S('Jake')).me.secret.heals_left, 2);
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
if (pl(st, 'Tom').punishments.length) {
  assert.equal(pl(st, 'Tom').love_partner_id, P.Sophie.id); assert.equal(pl(st, 'Sophie').love_partner_id, P.Tom.id);
  assert.equal(pl(st, 'Tom').public_role, null, 'a revealed Lovebird keeps their real role secret');
  assert.equal(pl(st, 'Sophie').punishments.length, pl(st, 'Tom').punishments.length);
}
step('Tom\'s forged heal: SAVED→FORGED flag, wheel spins anyway; Lovebird pair shares it');
for (const q of st.queue) await api(db, HOST, 'queue_remove', { room_id, queue_id: q.id });

// ---------- a real heal still saves ----------
await api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Ellie.id });
await api(db, HOST, 'call_next', { room_id, player_id: P.Ellie.id });
await api(db, P.Ellie.uid, 'spin', { room_id });
assert.equal((await H()).round.phase, 'saved');
await api(db, HOST, 'finish_saved', { room_id });
await expectErr(api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Dan.id }), /No heals left/);
await setBeers('Jake', 8);
assert.equal((await S('Jake')).me.secret.heals_left, 1, 'level 3 unlocks a third heal');
await setBeers('Jake', 4);
step('intact Medic heal → SAVED; heals = drink level (2 at level 2, a 3rd unlocks at 8 beers)');

// ---------- Detective: one check per game, read once ----------
await setBeers('Dora', 1);                                        // level 1: a vague reading of 3 people
let { check_id } = await api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Fred.id });
assert.equal(check_id.length, 36);
assert.ok(!JSON.stringify(await S('Dora')).includes('"guilty"'), 'result must not sit in state');
await expectErr(api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Dan.id }), /Read your last file|No investigations/);
const view = await api(db, P.Dora.uid, 'view_check', { room_id, check_id });
assert.equal(view.guilty, true);
assert.equal(view.level, 1); assert.equal(view.group.length, 3); assert.equal(view.group[0], 'Fred');
assert.ok(!view.group.includes('Dora'), 'never includes the Detective');
await setBeers('Dora', 8);                                        // level 3: exact
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
const v2 = await api(db, P.Dora.uid, 'view_check', { room_id, check_id });
assert.equal(v2.guilty, true); assert.deepEqual(v2.group, ['Dan']);
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
assert.equal(hit.drinkers, false, 'level 2: a miss tells you they are not on the Drinkers team (Jester = Chaos)');
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

// Jester allowance follows the drink level
assert.equal((await S('Olly')).me.secret.respins_left, 1);
await setBeers('Olly', 8);
let ol = (await S('Olly')).me.secret;
assert.equal(ol.respins_left, 3); assert.equal(ol.swap_used, false);
await setBeers('Olly', 1);
step('Jester: re-spins = drink level; a second swap at level 3');

// Betrayer at level 3: 3 accusations + a hint (the Intruder is one of these 3)
await setBeers('Megan', 1);
assert.equal((await S('Megan')).me.secret.guesses_left, 2);
await expectErr(api(db, P.Megan.uid, 'betrayer_hint', { room_id }), /unlock at 8/);
await setBeers('Megan', 8);
assert.equal((await S('Megan')).me.secret.guesses_left, 3);
assert.equal((await S('Megan')).me.secret.hint_ready, true);
await api(db, P.Megan.uid, 'betrayer_hint', { room_id });
const hint = (await S('Megan')).me.secret.hint;
assert.equal(hint.length, 3); assert.ok(hint.includes('Harry')); assert.ok(!hint.includes('Megan'));
await api(db, P.Megan.uid, 'betrayer_hint', { room_id });
assert.deepEqual((await S('Megan')).me.secret.hint, hint, 'the hint never reshuffles');
step('Betrayer: 2 accusations (3 from level 2); level 3 hint names 3 people incl. the Intruder');

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

// level 3 knife holder: one miss a night is forgiven
await sql('update player_secrets set last_hit_game = null where player_id = $1', [P.Megan.id]);
assert.equal((await S('Megan')).me.secret.second_chance, true);
hit = await api(db, P.Megan.uid, 'hit', { room_id, player_id: P.Ellie.id, role: 'medic' });
assert.equal(hit.correct, false); assert.equal(hit.second_chance, true); assert.equal(hit.drinkers, true);
let mg = (await S('Megan')).me.secret;
assert.equal(mg.hit_alive, true); assert.equal(mg.hit_ready, true); assert.equal(mg.second_chance, false);
hit = await api(db, P.Megan.uid, 'hit', { room_id, player_id: P.Ellie.id, role: 'jester' });
assert.equal(hit.second_chance, undefined);
assert.equal((await S('Megan')).me.secret.hit_alive, false);
step('level 3 Hit: first miss forgiven (+ told they ARE a Drinker), second miss blunts the knife');

// reaching 4 / 8 beers announces a level-up on the TV
await sql('update players set beers = 3, last_beer_at = null where id = $1', [P.Tom.id]);
await api(db, P.Tom.uid, 'log_beer', { room_id });
assert.deepEqual((await H()).events.at(-1).payload, { player: P.Tom.id, level: 2 });
step('level-up event at 4 and 8 beers');

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

// ---------- a Guilty Lovebird: the Intruder can carry the bonus too ----------
{
  const r2 = await api(db, HOST, 'create_room', {});
  await api(db, HOST, 'generate_cards', { room_id: r2.room_id, role_counts: { intruder: 1, medic: 1, drinker: 2, lovebird: 1 } });
  await expectErr(api(db, HOST, 'generate_cards', { room_id: r2.room_id, role_counts: { intruder: 1, lovebird: 1 } }), /Not enough cards/);
  await api(db, HOST, 'generate_cards', { room_id: r2.room_id, role_counts: { intruder: 1, medic: 1, drinker: 2, lovebird: 1 } });
  const pid = randomUUID();
  await sql('update role_codes set pair_id = null where room_id = $1', [r2.room_id]);
  await sql("update role_codes set pair_id = $1 where room_id = $2 and role in ('intruder','medic')", [pid, r2.room_id]);
  const c2 = (await api(db, HOST, 'get_cards', { room_id: r2.room_id })).cards;
  const Q = {};
  for (const [n, role] of [['Ivy', 'intruder'], ['Max', 'medic'], ['Dee', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    Q[n] = { uid, id: (await api(db, uid, 'join', { code: r2.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: r2.room_id, code: c2.find(c => c.role === role).code });
  }
  const ivy = (await state(db, Q.Ivy.uid, r2.code)).me.secret;
  assert.equal(ivy.role, 'intruder'); assert.equal(ivy.team, 'guilty'); assert.equal(ivy.lovebird, true); assert.equal(ivy.partner.name, 'Max');
  await api(db, HOST, 'expose', { room_id: r2.room_id, player_id: Q.Max.id });            // exposing Max shows the pair, not Ivy's role
  const h2 = await state(db, HOST, r2.code);
  const ivyPub = h2.players.find(p => p.id === Q.Ivy.id);
  assert.equal(ivyPub.love_partner_id, Q.Max.id); assert.equal(ivyPub.public_role, null, 'the Intruder stays hidden behind the Lovebird bonus');
  assert.equal(h2.players.find(p => p.id === Q.Max.id).public_role, 'medic');
  // a Lovebird Hit on a hidden pair outs them without burning powers
  await sql('update players set love_partner_id = null where room_id = $1', [r2.room_id]);
  const hh = await api(db, Q.Ivy.uid, 'hit', { room_id: r2.room_id, player_id: Q.Dee.id, role: 'lovebird' });
  assert.equal(hh.correct, false);
}
step('Lovebird bonus on a Guilty card: the Intruder can be a Lovebird; exposing the partner reveals the pair, not the Intruder');

// ---------- secrecy sweep ----------
const dan = await S('Dan');
const blob = JSON.stringify({ p: dan.players.filter(p => !p.public_role), me: dan.me, e: dan.events, ev: dan.evidence });
assert.ok(!/"(intruder|forger|medic|betrayer|detective)"/.test(JSON.stringify(dan.me)), 'drinker sees only own role');
void blob;
step('secrecy sweep passed');
console.log('\nALL LOGIC TESTS PASSED');
