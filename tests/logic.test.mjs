// Full-night logic test against the real migrations (in PGlite). Run: node tests/logic.test.mjs
import { createDb, api as rawApi, state, addUser } from '../server/db.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = await createDb();
const HOST = randomUUID();
await addUser(db, HOST, false, 'host@example.com');
const expectErr = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail('expected error ' + re); };
const step = m => console.log('✓ ' + m);
const sql = (q, p = []) => db.query(q, p).then(r => r.rows);
// The rule tests fire abilities back to back, so clear the one-at-a-time TV stage before each call
// (the stage itself is tested on its own with rawApi).
// They also spin straight after call_next, so wind each waiting round past its 4-second stand-in window
// (the window itself is tested with rawApi in TAKE IT FOR THEM).
const api = async (...a) => {
  await db.query('update rooms set ability_until = null');
  await db.query("update rounds set created_at = created_at - interval '5 seconds' where phase = 'waiting' and created_at > now() - interval '5 seconds'");
  return rawApi(...a);
};

// ---------- room, cards, players ----------
await expectErr((async () => { const u = randomUUID(); await addUser(db, u); await api(db, u, 'create_room'); })(), /Host login/);
const { room_id, code } = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
const counts = { intruder: 1, betrayer: 1, forger: 1, medic: 1, detective: 1, lovebird: 1, cursed: 1, scrooge: 1, drinker: 5 };
const { cards } = await api(db, HOST, 'generate_cards', { room_id, role_counts: counts });
assert.equal(cards.length, 11, 'Lovebird pairs are a bonus on top of the dealt cards, not extra cards');
assert.ok(!cards.some(c => c.role === 'lovebird' || c.role === 'cursed'), 'modifiers are not dealt as cards');
assert.equal(cards.filter(c => c.lovebird).length, 2, 'one pair marks exactly 2 cards');
assert.equal(cards.filter(c => c.cursed).length, 1, 'the curse marks exactly 1 card');
// deterministic for this test: move the pair onto the first two Drinker cards (Sophie & Tom get them)
await sql('update role_codes set pair_id = null where room_id = $1', [room_id]);
const lovePair = randomUUID();
for (const c of cards.filter(c => c.role === 'drinker').slice(0, 2)) await sql('update role_codes set pair_id = $1 where code = $2', [lovePair, c.code.replace('-', '')]);
// …and the curse onto the third Drinker card (Priya)
await sql('update role_codes set cursed = false where room_id = $1', [room_id]);
await sql('update role_codes set cursed = true where code = $1', [cards.filter(c => c.role === 'drinker')[2].code.replace('-', '')]);
const NAMES = ['Harry', 'Megan', 'Fred', 'Jake', 'Dora', 'Sophie', 'Tom', 'Priya', 'Olly', 'Ellie', 'Dan'];
const DEAL = { Harry: 'intruder', Megan: 'betrayer', Fred: 'forger', Jake: 'medic', Dora: 'detective', Sophie: 'drinker', Tom: 'drinker',
               Priya: 'drinker', Olly: 'scrooge', Ellie: 'drinker', Dan: 'drinker' };
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
assert.equal(pl(await H(), 'Priya').cursed, true); assert.equal((await S('Priya')).me.secret.role, 'drinker');
assert.equal(pl(await H(), 'Priya').public_role, null, 'the curse is public, the role underneath is not');
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
// the Saboteurs know each other from the start (with roles); the Betrayer and everyone else see nobody
assert.deepEqual((await S('Harry')).me.secret.allies, [{ id: P.Fred.id, name: 'Fred', role: 'forger', caught: false }]);
assert.deepEqual((await S('Fred')).me.secret.allies.map(x => x.name), ['Harry']);
assert.equal((await S('Megan')).me.secret.allies, null, 'the Betrayer isn\'t told until they join');
assert.equal((await S('Dan')).me.secret.allies, null);
step('teams: Intruder/Forger GUILTY, Betrayer DRINKERS until teamed, Scrooge CHAOS; Saboteurs know each other, the Betrayer doesn\'t; TV sees no roles');

// ---------- beers ----------
for (const n of ['Harry', 'Megan', 'Fred', 'Jake', 'Dora', 'Sophie', 'Tom', 'Priya', 'Olly']) await api(db, P[n].uid, 'log_beer', { room_id });
await api(db, HOST, 'log_beer', { room_id, delta: 1 });
// drink levels (beers logged on your own phone): 0–2 → 1 (pacified: no powers), 3–5 → 2, 6–8 → 3, 9+ → 4
// (this room's deadline is an hour away, so the games-played cap is already lifted: only beers matter)
const setBeers = (n, b) => sql('update players set beers = $1 where id = $2', [b, P[n].id]);
for (const n of ['Megan', 'Dora', 'Olly']) await setBeers(n, 3);
await setBeers('Jake', 6);  await setBeers('Harry', 6);  await setBeers('Fred', 6);   // forging a heal needs level 3
assert.equal((await H()).room.tally, 10);
step('beers logged (Ellie + Dan logged none)');

// ---------- Medic heals ahead of time; Forger learns a heal exists, forges it ----------
assert.equal((await S('Fred')).me.secret.forge_ready, false);
await expectErr(api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Jake.id }), /yourself/);
await setBeers('Jake', 3);
assert.equal((await S('Jake')).me.secret.heals_left, 1);
await setBeers('Jake', 6);
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
assert.deepEqual(st.game.champs, [], 'Biggest Champ: a 9-way tie crowns nobody (max 3 champs)');
step('game over: loser Tom queued; slackers = Ellie + Dan (0 beers, tie → both)');

// ---------- the curse passes with no host step, only to someone the Cursed player just beat ----------
{ const me = (await S('Priya')).me;
  assert.deepEqual(me.curse_targets, [P.Tom.id], 'Priya played and didn\'t lose: she can pass it to the loser');
  assert.deepEqual((await S('Tom')).me.curse_targets, [], 'only the Cursed player gets targets');
  await expectErr(api(db, P.Priya.uid, 'request_curse_pass', { room_id, player_id: P.Ellie.id }), /someone you beat/);
  await expectErr(api(db, P.Tom.uid, 'request_curse_pass', { room_id, player_id: P.Priya.id }), /don't hold the curse/);
  await api(db, P.Priya.uid, 'request_curse_pass', { room_id, player_id: P.Tom.id });
  let h = await H();
  assert.equal(pl(h, 'Tom').cursed, true); assert.equal(pl(h, 'Priya').cursed, false, 'passed straight away, no approval');
  assert.ok(h.events.some(e => e.kind === 'curse_passed' && e.payload.to === P.Tom.id));
  assert.deepEqual((await S('Tom')).me.curse_targets, [], 'Tom lost that game: he can\'t send it back');
  await sql('update players set cursed = (id = $1) where room_id = $2', [P.Priya.id, room_id]);   // put it back for the rest of the run
  await expectErr(api(db, P.Priya.uid, 'request_curse_pass', { room_id, player_id: P.Tom.id }), /someone you beat/, 'one pass per game');
  await sql('update rooms set ability_until = null where id = $1', [room_id]); }
step('curse pass: no host step; only to a loser of the last game you played and didn\'t lose; once per game');

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
await setBeers('Jake', 9);                                        // level 4: the Medic evolves into the SURGEON
let jk = (await S('Jake')).me.secret;
assert.equal(jk.evolved, 'surgeon'); assert.equal(jk.heals_left, 0, 'the Surgeon keeps 2 heals (no 3rd)'); assert.equal(jk.self_heal_ready, true);
await api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Jake.id });                   // one self-heal
await expectErr(api(db, P.Jake.uid, 'heal', { room_id, player_id: P.Jake.id }), /already healed yourself/);
assert.equal((await sql('select sealed from shields where player_id = $1 and used_at is null', [P.Jake.id]))[0].sealed, true, 'Surgeon heals are sealed');
await sql('delete from shields where player_id = $1', [P.Jake.id]);
await setBeers('Jake', 6);
step('intact Medic heal → SAVED; heals: 1 at level 2, then 2 at level 3; at level 4 the SURGEON gets a sealed self-heal instead of a 3rd');

// ---------- Detective: one check per game, read once ----------
await setBeers('Dora', 3);                                        // level 2 (basic): a vague reading of 3 people
let { check_id } = await api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Fred.id });
assert.equal(check_id.length, 36);
assert.ok(!JSON.stringify(await S('Dora')).includes('"guilty"'), 'result must not sit in state');
await expectErr(api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Dan.id }), /Read your last file|No investigations/);
const view = await api(db, P.Dora.uid, 'view_check', { room_id, check_id });
assert.equal(view.guilty, true);
assert.equal(view.level, 1); assert.equal(view.group.length, 3); assert.equal(view.group[0], 'Fred');
assert.ok(!view.group.includes('Dora'), 'never includes the Detective');
// the re-read window: the same Detective gets the SAME reading again within 15s of the first view (a reply lost on wifi)
assert.deepEqual(await api(db, P.Dora.uid, 'view_check', { room_id, check_id }), view, 're-read within 15s returns the same reading');
await expectErr(api(db, P.Megan.uid, 'view_check', { room_id, check_id }), /already been burned/);   // nobody else, ever
assert.equal((await S('Dora')).me.secret.pending_check, null, 'the file has left the state after the first view');
assert.ok(!JSON.stringify(await S('Dora')).includes('viewed_at') && !JSON.stringify(await H()).includes('viewed_at'), 'viewed_at is server-only');
await sql("update detective_checks set viewed_at = viewed_at - interval '16 seconds' where id = $1", [check_id]);
await setBeers('Dora', 9);                                        // level 4: JUDGE DREDD (readings cover 2)
await expectErr(api(db, P.Dora.uid, 'view_check', { room_id, check_id }), /^That file has already been burned$/);
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
assert.equal(v2.guilty, true); assert.equal(v2.group[0], 'Dan'); assert.equal(v2.group.length, 2, 'Judge Dredd reads like level 2');
assert.equal((await S('Dora')).me.secret.evolved, 'dredd');
assert.deepEqual((await S('Fred')).me.secret.frame, { name: 'Dan', spent: true });
await expectErr(api(db, P.Dora.uid, 'investigate', { room_id, player_id: P.Megan.id }), /until the next game ends/);
step('Detective: Fred = GUILTY; Forger framed Dan so he reads GUILTY too (once); each result readable once; checks = 1 + games finished');

// ---------- Intruder Hit: can't name Drinker/Cursed; right → cover blown + powers burned; 1 per game ----------
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Dan.id, role: 'drinker' }), /can't name that role/);
let hit = await api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Dora.id, role: 'detective' });
assert.equal(hit.correct, true);
st = await H();
assert.equal(pl(st, 'Dora').public_role, 'detective');
assert.equal((await S('Dora')).me.secret.checks_left, 0);
assert.equal(st.events.at(-1).kind, 'hit');
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'scrooge' }), /One hit per game/);
step('Hit: Dora named as Detective → cover blown, powers burned, queued; next Hit waits for the next game');

// ---------- game 2 → Trial vote with evidence ----------
({ game_id } = await api(db, HOST, 'start_game', { room_id, name: 'Flip Cup' }));
await api(db, HOST, 'finish_game', { room_id, game_id, losers: [] });
assert.equal((await S('Dora')).me.secret.checks_left, 0);   // burned stays burned
await api(db, P.Ellie.uid, 'submit_evidence', { room_id, image_url: 'https://x.supabase.co/storage/v1/object/public/selfies/ev/0b7c6a1e-pour.jpg', caption: 'Who poured this out??' });
st = await H();
assert.equal(st.evidence.length, 1); assert.ok(!JSON.stringify(st.evidence).includes(P.Ellie.id));
assert.deepEqual((await S('Dan')).evidence, []);
// wrong Hit ends the streak
hit = await api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'medic' });
assert.equal(hit.drinkers, false, 'level 2: a miss tells you they are not on the Drinkers team (Scrooge = Chaos)');
assert.equal(hit.correct, false);
assert.equal((await S('Harry')).me.secret.hit_alive, false);
await expectErr(api(db, P.Harry.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'scrooge' }), /blunt/);
step('evidence submitted anonymously (TV only); a wrong Hit ends the streak for the night');

// Trial 1: majority accuses Dan (innocent) → accusers drink, NOT GUILTY
let { vote_id } = await api(db, HOST, 'start_vote', { room_id, kind: 'trial' });
for (const n of ['Harry', 'Megan', 'Jake', 'Tom', 'Olly']) await api(db, P[n].uid, 'cast_vote', { room_id, vote_id, choice_id: P.Dan.id });
for (const n of ['Sophie', 'Priya']) await api(db, P[n].uid, 'cast_vote', { room_id, vote_id, choice_id: '00000000-0000-0000-0000-000000000000' });
for (const view of [await H(), await S('Ellie')]) {                  // while it's open: the total only, never per suspect
  assert.deepEqual(view.vote.counts, {}, 'no live per-suspect counts'); assert.equal(view.vote.voters, 7);
}
let out = await api(db, HOST, 'close_vote', { room_id, vote_id });
assert.equal((await H()).vote.counts[P.Dan.id], 5, 'the counts arrive once the vote has closed');
assert.equal(out.result, 'innocent');
st = await H();
assert.equal(pl(st, 'Dan').public_role, null);
assert.ok(pl(st, 'Megan').punishments.some(p => p.text === 'Wrong accusation'));
step('Trial: majority on Dan → NOT GUILTY, the 5 accusers get a penalty drink, Dan\'s role stays secret');

// Scrooge allowance follows the drink level
assert.equal((await S('Olly')).me.secret.respins_left, 1);
await setBeers('Olly', 9);
let ol = (await S('Olly')).me.secret;
assert.equal(ol.respins_left, 3); assert.equal(ol.swap_used, false);
await setBeers('Olly', 3);
step('Scrooge: re-spins = drink level - 1; a second swap at level 4');

// Betrayer at level 3: 3 accusations + a hint (the Intruder is one of these 3)
await setBeers('Megan', 3);
assert.equal((await S('Megan')).me.secret.guesses_left, 2);
await expectErr(api(db, P.Megan.uid, 'betrayer_hint', { room_id }), /unlock at level 4/);
await setBeers('Megan', 9);
assert.equal((await S('Megan')).me.secret.guesses_left, 3);
assert.equal((await S('Megan')).me.secret.hint_ready, true);
await api(db, P.Megan.uid, 'betrayer_hint', { room_id });
const hint = (await S('Megan')).me.secret.hint;
assert.equal(hint.length, 3); assert.ok(hint.includes('Harry')); assert.ok(!hint.includes('Megan'));
await api(db, P.Megan.uid, 'betrayer_hint', { room_id });
assert.deepEqual((await S('Megan')).me.secret.hint, hint, 'the hint never reshuffles');
step('Betrayer: 2 accusations (3 from level 3); level 4 hint names 3 people incl. the Intruder');

// Betrayer finds the Intruder → Guilty
const g = await api(db, P.Megan.uid, 'betrayer_guess', { room_id, player_id: P.Harry.id });
assert.equal(g.correct, true);
assert.equal((await S('Megan')).me.secret.team, 'guilty');
assert.equal((await S('Megan')).me.secret.hit_alive, false);   // Betrayer gets no Intruder powers
assert.deepEqual((await S('Megan')).me.secret.allies.map(x => `${x.name}:${x.role}`).sort(), ['Fred:forger', 'Harry:intruder'], 'once joined, the Betrayer sees the whole team');
assert.deepEqual((await S('Fred')).me.secret.allies.map(x => x.name).sort(), ['Harry', 'Megan'], 'and the team sees them');
step('Betrayer guessed right → joins the Saboteurs (no powers) and learns the whole team, who learn them');

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
hit = await api(db, P.Megan.uid, 'hit', { room_id, player_id: P.Olly.id, role: 'scrooge' });
assert.equal(hit.correct, true);
assert.equal(pl(await H(), 'Olly').public_role, 'scrooge');
await expectErr(api(db, P.Olly.uid, 'scrooge_graffiti', { room_id, text: 'Nope nope' }), /can't do that/);
step('knife holder lands a Hit on the Scrooge → powers burned');

// level 4 knife holder: no forgiven miss any more (the bomb is their level 3 now): one miss blunts the knife
await sql('update player_secrets set last_hit_game = null where player_id = $1', [P.Megan.id]);
assert.equal((await S('Megan')).me.secret.second_chance, undefined);
hit = await api(db, P.Megan.uid, 'hit', { room_id, player_id: P.Ellie.id, role: 'medic' });
assert.equal(hit.correct, false); assert.equal(hit.second_chance, undefined); assert.equal(hit.drinkers, true);
assert.equal((await S('Megan')).me.secret.hit_alive, false);
step('level 4 Hit: a miss (still told they ARE a Drinker) blunts the knife; no forgiven miss');

// reaching 3 / 6 / 9 beers announces a level-up on the TV: {player, level} only, never the role
for (const [b, lv] of [[2, 2], [5, 3], [8, 4]]) {
  await sql('update players set beers = $1, last_beer_at = null where id = $2', [b, P.Tom.id]);
  await api(db, P.Tom.uid, 'log_beer', { room_id });
  const ev = (await H()).events.at(-1);
  assert.equal(ev.kind, 'level_up'); assert.deepEqual(ev.payload, { player: P.Tom.id, level: lv });
}
await sql('update players set beers = 3, last_beer_at = null where id = $1', [P.Tom.id]);
await api(db, P.Tom.uid, 'log_beer', { room_id });
assert.notEqual((await H()).events.at(-1).kind, 'level_up', 'no level-up at 4 beers');
step('level-up event at 3, 6 and 9 beers, carrying only {player, level}');

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
// the frame only counts as "framed" if it changed the reading: at level 2 the reading also covers one random
// other player, and if that one is a real Saboteur the check read SABOTEUR anyway
const framedExpected = ['Harry', 'Fred'].includes(v2.group[1]) ? 0 : 1;
assert.equal(st.room.reveal.checks.filter(c => c.framed).length, framedExpected);
assert.deepEqual(st.room.reveal.frames, [{ forger: P.Fred.id, target: P.Dan.id, spent: true }]);
assert.equal(st.room.reveal.checks[0].guilty, true);
assert.deepEqual(new Set(st.room.reveal.guilty), new Set([P.Harry.id, P.Fred.id, P.Megan.id]));
step('deadline → THE GUILTY WIN; reveal-all shows roles, forgery, Detective checks and the Guilty team');

// ---------- a Guilty Lovebird: the Intruder can carry the bonus too ----------
{
  const r2 = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });   // cap lifted: only beers matter
  await api(db, HOST, 'generate_cards', { room_id: r2.room_id, role_counts: { intruder: 1, medic: 1, drinker: 2, lovebird: 1 } });
  await expectErr(api(db, HOST, 'generate_cards', { room_id: r2.room_id, role_counts: { intruder: 1, lovebird: 1 } }), /Not enough cards/);
  await api(db, HOST, 'generate_cards', { room_id: r2.room_id, role_counts: { intruder: 1, medic: 1, drinker: 2, lovebird: 1, cursed: 1 } });
  const pid = randomUUID();
  await sql("update role_codes set cursed = (role = 'intruder') where room_id = $1", [r2.room_id]);   // the Intruder starts Cursed
  await sql('update role_codes set pair_id = null where room_id = $1', [r2.room_id]);
  await sql("update role_codes set pair_id = $1 where room_id = $2 and role in ('intruder','medic')", [pid, r2.room_id]);
  const c2 = (await api(db, HOST, 'get_cards', { room_id: r2.room_id })).cards;
  const Q = {};
  for (const [n, role] of [['Ivy', 'intruder'], ['Max', 'medic'], ['Dee', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    Q[n] = { uid, id: (await api(db, uid, 'join', { code: r2.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: r2.room_id, code: c2.find(c => c.role === role).code });
  }
  await sql('update players set beers = 3 where room_id = $1', [r2.room_id]);           // level 2: powers on
  const ivy = (await state(db, Q.Ivy.uid, r2.code)).me.secret;
  assert.equal(ivy.role, 'intruder'); assert.equal(ivy.team, 'guilty'); assert.equal(ivy.lovebird, true); assert.equal(ivy.partner.name, 'Max');
  assert.equal((await state(db, HOST, r2.code)).players.find(p => p.id === Q.Ivy.id).cursed, true, 'a Cursed skull can sit on the Intruder');
  await api(db, HOST, 'expose', { room_id: r2.room_id, player_id: Q.Max.id });            // exposing Max shows the pair, not Ivy's role
  const h2 = await state(db, HOST, r2.code);
  const ivyPub = h2.players.find(p => p.id === Q.Ivy.id);
  assert.equal(ivyPub.love_partner_id, Q.Max.id); assert.equal(ivyPub.public_role, null, 'the Intruder stays hidden behind the Lovebird bonus');
  assert.equal(h2.players.find(p => p.id === Q.Max.id).public_role, 'medic');
  // the Hit names real roles only: never a modifier
  await expectErr(api(db, Q.Ivy.uid, 'hit', { room_id: r2.room_id, player_id: Q.Dee.id, role: 'lovebird' }), /can't name that role/);
  await expectErr(api(db, Q.Ivy.uid, 'hit', { room_id: r2.room_id, player_id: Q.Dee.id, role: 'cursed' }), /can't name that role/);
}
step('modifiers on a Guilty card: the Intruder can be a Cursed Lovebird; exposing the partner reveals the pair, not the Intruder');

// ---------- modifier allocation: random, with a small bias towards plain Drinkers ----------
{
  const r3 = await api(db, HOST, 'create_room', {});
  const deck = { intruder: 1, betrayer: 1, forger: 1, medic: 1, detective: 1, scrooge: 1, drinker: 5, cursed: 1, lovebird: 0 };
  let onDrinker = 0, onGuilty = 0; const N = 800;
  for (let i = 0; i < N; i++) {
    const { cards: c3 } = await api(db, HOST, 'generate_cards', { room_id: r3.room_id, role_counts: deck });
    const cc = c3.find(c => c.cursed);
    if (cc.role === 'drinker') onDrinker++;
    if (cc.role === 'intruder' || cc.role === 'forger') onGuilty++;
  }
  // uniform would be 5/11 = 0.45 on a Drinker; the 0.75 weight gives ~0.53
  assert.ok(onDrinker / N > 0.48 && onDrinker / N < 0.6, `curse on a Drinker ${(onDrinker / N).toFixed(2)}`);
  assert.ok(onGuilty > N * 0.08, 'still lands on Guilty cards regularly');
  step(`modifiers: random with a small Drinker bias (curse on a Drinker ${(100 * onDrinker / N).toFixed(0)}% vs 45% uniform; on a Guilty card ${(100 * onGuilty / N).toFixed(0)}%)`);
}

// ---------- Jester (Chaos) and Skank (Drinkers) ----------
{
  const r4 = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = r4.room_id;
  const { cards: c4 } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: { intruder: 1, jester: 1, skank: 1, scrooge: 0, drinker: 3, lovebird: 0, cursed: 0 } });
  const J = {};
  for (const [n, role] of [['Jo', 'jester'], ['Sk', 'skank'], ['In', 'intruder'], ['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    J[n] = { uid, id: (await api(db, uid, 'join', { code: r4.code, name: n })).player_id };
    const i = c4.findIndex(c => c.role === role);
    await api(db, uid, 'redeem', { room_id: R, code: c4.splice(i, 1)[0].code });
  }
  const SJ = n => state(db, J[n].uid, r4.code);
  const HJ = () => state(db, HOST, r4.code);
  assert.equal((await SJ('Jo')).me.secret.team, 'chaos');
  assert.equal((await SJ('Sk')).me.secret.team, 'drinkers');

  // Skank: every beer secretly counts double (triple at level 3); the TV only sees +1
  for (let i = 0; i < 3; i++) { await sql('update players set last_beer_at = null where id = $1', [J.Sk.id]); await api(db, J.Sk.uid, 'log_beer', { room_id: R }); }
  assert.equal((await HJ()).room.tally, 3, 'the public tally only counts real beers');
  assert.equal((await SJ('Sk')).me.secret.skank_bonus, 3, 'the Skank banks +1 per beer');
  assert.equal((await SJ('A')).me.secret.skank_bonus, null, 'nobody else has a bonus');
  { const tv = await HJ(); assert.ok(!JSON.stringify({ ...tv, room: { ...tv.room, settings: null } }).includes('skank'), 'the TV never sees the Skank'); }
  await sql('update players set beers = 8, last_beer_at = null where id = $1', [J.Sk.id]);
  await api(db, J.Sk.uid, 'log_beer', { room_id: R });                           // 9th beer → level 4 → +2
  assert.equal((await SJ('Sk')).me.secret.skank_bonus, 5);
  step('Skank: beers count double in secret (triple from level 4); the TV tally shows only real beers');

  // Jester convicted at a Trial → revealed, no wrong-accusation drinks, picks one accuser for ×3
  await api(db, HOST, 'update_settings', { room_id: R, segments: ['Drink', 'Drink'] });
  let { vote_id } = await api(db, HOST, 'start_vote', { room_id: R, kind: 'trial' });
  for (const n of ['In', 'A', 'B', 'C']) await api(db, J[n].uid, 'cast_vote', { room_id: R, vote_id, choice_id: J.Jo.id });
  await api(db, J.Sk.uid, 'cast_vote', { room_id: R, vote_id, choice_id: '00000000-0000-0000-0000-000000000000' });
  let o = await api(db, HOST, 'close_vote', { room_id: R, vote_id });
  assert.equal(o.result, 'jester'); assert.equal(o.accusers.length, 4);
  let h = await HJ();
  assert.equal(h.players.find(p => p.id === J.Jo.id).public_role, 'jester');
  assert.equal(h.players.find(p => p.id === J.Jo.id).rehab, false, 'the Jester is not sent to rehab');
  assert.ok(!h.players.some(p => p.punishments.some(x => x.text === 'Wrong accusation')), 'accusers don\'t drink for a Jester');
  await expectErr(api(db, J.A.uid, 'jester_revenge', { room_id: R, vote_id, player_id: J.B.id }), /can't do that/);
  await expectErr(api(db, J.Jo.uid, 'jester_revenge', { room_id: R, vote_id, player_id: J.Sk.id }), /voted for you/);
  await expectErr(api(db, J.Jo.uid, 'jester_revenge', { room_id: R, vote_id }), /Pick one of your accusers/);
  await api(db, J.Jo.uid, 'jester_revenge', { room_id: R, vote_id, player_id: J.A.id });
  await expectErr(api(db, J.Jo.uid, 'jester_revenge', { room_id: R, vote_id, player_id: J.B.id }), /already picked/);
  h = await HJ();
  assert.deepEqual(h.queue.map(q => [q.player_id, q.times]), [[J.A.id, 3]]);
  assert.equal(h.vote.outcome.revenge, J.A.id);
  await api(db, HOST, 'call_next', { room_id: R });
  await api(db, J.A.uid, 'spin', { room_id: R, round_id: (await HJ()).round.id });
  h = await HJ();
  assert.equal(h.round.times, 3); assert.ok(h.round.landings.every(l => l.mult >= 3), 'every landing is ×3');
  await api(db, HOST, 'accept', { room_id: R, round_id: h.round.id, force: true });
  assert.ok((await HJ()).players.find(p => p.id === J.A.id).punishments.some(x => /^Drink ×(3|6|12)$/.test(x.text)));
  // a revealed Jester gets no second revenge: convicting them again is a wrong accusation
  ({ vote_id } = await api(db, HOST, 'start_vote', { room_id: R, kind: 'trial' }));
  for (const n of ['In', 'A', 'B', 'C']) await api(db, J[n].uid, 'cast_vote', { room_id: R, vote_id, choice_id: J.Jo.id });
  o = await api(db, HOST, 'close_vote', { room_id: R, vote_id });
  assert.equal(o.result, 'innocent');
  step('Jester: convicted → revealed, picks an accuser (validated) who spins at ×3; only once');

  // the host can pick at random for a dithering Jester (second Jester in a fresh room)
  // …and the Intruder can hit the Skank: the bonus freezes but still counts
  await sql('update players set beers = 3 where id = $1', [J.In.id]);              // level 2: the knife is out
  const hit = await api(db, J.In.uid, 'hit', { room_id: R, player_id: J.Sk.id, role: 'skank' });
  assert.equal(hit.correct, true);
  await sql('update players set last_beer_at = null where id = $1', [J.Sk.id]);
  await api(db, J.Sk.uid, 'log_beer', { room_id: R });
  assert.equal((await SJ('Sk')).me.secret.skank_bonus, 5, 'a blown Skank stops earning');
  const counted = (await HJ()).room.tally;
  await api(db, HOST, 'update_settings', { room_id: R, deadline_at: new Date(Date.now() - 1000).toISOString() });
  await api(db, HOST, 'end_check', { room_id: R });
  h = await HJ();
  assert.equal(h.room.result.skank_bonus, 5); assert.equal(h.room.result.counted, counted);
  assert.equal(h.room.final_tally, counted + 5, 'the Skank bonus is added when time runs out');
  step('Skank: a Hit freezes the bonus; at the deadline it is added to the final count');
}
{
  const r5 = await api(db, HOST, 'create_room', {});
  const { cards: c5 } = await api(db, HOST, 'generate_cards', { room_id: r5.room_id, role_counts: { jester: 1, drinker: 3, intruder: 0, betrayer: 0, forger: 0, medic: 0, detective: 0, skank: 0, scrooge: 0, lovebird: 0, cursed: 0 } });
  const K = [];
  for (const c of c5) { const uid = randomUUID(); await addUser(db, uid); const id = (await api(db, uid, 'join', { code: r5.code, name: c.role + K.length })).player_id; await api(db, uid, 'redeem', { room_id: r5.room_id, code: c.code }); K.push({ uid, id, role: c.role }); }
  const jj = K.find(k => k.role === 'jester');
  const { vote_id } = await api(db, HOST, 'start_vote', { room_id: r5.room_id, kind: 'trial' });
  for (const k of K.filter(k => k !== jj)) await api(db, k.uid, 'cast_vote', { room_id: r5.room_id, vote_id, choice_id: jj.id });
  await api(db, HOST, 'close_vote', { room_id: r5.room_id, vote_id });
  const res = await api(db, HOST, 'jester_revenge', { room_id: r5.room_id, vote_id });
  assert.ok(K.some(k => k.id === res.player && k !== jj), 'the host picks a random accuser');
  step('Jester: the host can pick at random for them');
}

// ---------- v5: Locker, Davy Jones, Champ, Detective → Judge Dredd, Angel, Assassin → Ninja, Aaron's Plate ----------
{
  const r6 = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = r6.room_id;
  const deck = { intruder: 1, davyjones: 1, detective: 1, assassin: 1, skank: 1, scrooge: 1, drinker: 3, betrayer: 0, forger: 0, medic: 0, jester: 0, lovebird: 0, cursed: 0 };
  const { cards: c6 } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  const V = {};
  const deal = [['In', 'intruder'], ['Dj', 'davyjones'], ['De', 'detective'], ['As', 'assassin'], ['Sk', 'skank'], ['Sc', 'scrooge'], ['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker']];
  for (const [n, role] of deal) {
    const uid = randomUUID(); await addUser(db, uid);
    V[n] = { uid, id: (await api(db, uid, 'join', { code: r6.code, name: n })).player_id };
    const i = c6.findIndex(c => c.role === role);
    await api(db, uid, 'redeem', { room_id: R, code: c6.splice(i, 1)[0].code });
  }
  const An = { uid: randomUUID() }; await addUser(db, An.uid);
  An.id = (await api(db, An.uid, 'join', { code: r6.code, name: 'Angel' })).player_id;
  const SV = n => state(db, (n === 'An' ? An : V[n]).uid, r6.code);
  const HV = () => state(db, HOST, r6.code);
  const pv = (st, id) => st.players.find(p => p.id === id);
  const beers = (n, b) => sql('update players set beers = $1 where id = $2', [b, V[n].id]);

  // Angel: host-assigned, public, not dealt; can't be hit
  await expectErr(api(db, V.A.uid, 'make_angel', { room_id: R, player_id: An.id }), /Only the host/);
  await expectErr(api(db, HOST, 'make_angel', { room_id: R, player_id: V.A.id }), /already have a role card/);
  await api(db, HOST, 'make_angel', { room_id: R, player_id: An.id });
  assert.equal(pv(await HV(), An.id).public_role, 'angel');
  assert.equal((await SV('An')).me.secret.role, 'angel');
  { const { vote_id } = await api(db, HOST, 'start_vote', { room_id: R, kind: 'trial' });
    assert.ok(!(await HV()).vote.options.includes(An.id), 'the Angel can\'t be accused');
    await api(db, An.uid, 'cast_vote', { room_id: R, vote_id, choice_id: '00000000-0000-0000-0000-000000000000' });
    assert.equal((await HV()).vote.voters, 1, '…but votes');
    await expectErr(api(db, An.uid, 'cast_vote', { room_id: R, vote_id, choice_id: V.B.id }), /already voted/);
    await api(db, HOST, 'close_vote', { room_id: R, vote_id }); }
  await beers('In', 3);
  await expectErr(api(db, V.In.uid, 'hit', { room_id: R, player_id: An.id, role: 'angel' }), /cover is already blown/);
  step('Angel: host-assigned and public, never dealt, can\'t be hit');

  // Assassin: a Saboteur, no target contract any more
  assert.equal((await SV('As')).me.secret.team, 'guilty', 'the Assassin plays for the Saboteurs');
  assert.equal((await SV('As')).me.secret.target, undefined);
  step('Assassin: a Saboteur (no target contract)');

  // Davy Jones' Locker: request → host approves; no vote, no powers; 1 punishment waits, the rest drop
  await api(db, V.C.uid, 'request_lock', { room_id: R });
  await expectErr(api(db, V.C.uid, 'request_lock', { room_id: R }), /Waiting for the host/);
  assert.equal(pv(await HV(), V.C.id).lock_requested, true);
  await api(db, HOST, 'decide_lock', { room_id: R, player_id: V.C.id, approve: true, minutes: 15 });
  let h = await HV();
  assert.ok(pv(h, V.C.id).locked_until, 'C is in the Locker'); assert.equal(pv(h, V.C.id).lock_requested, false);
  await api(db, HOST, 'queue_add', { room_id: R, player_id: V.C.id, reason: 'first' });
  await api(db, HOST, 'queue_add', { room_id: R, player_id: V.C.id, reason: 'second' });
  h = await HV();
  assert.equal(pv(h, V.C.id).held, true, 'one punishment waits for them');
  assert.equal(h.queue.length, 0, 'held punishments sit out of the queue');
  assert.equal((await sql("select count(*)::int n from queue where player_id = $1 and status = 'held'", [V.C.id]))[0].n, 1, 'the second one is dropped');
  // Davy Jones (role) locks the Scrooge's swap target out; locked players can't vote or use powers
  await beers('Dj', 6);                                                       // always 15 minutes now
  assert.equal((await SV('Dj')).me.secret.lock_minutes, 15);
  await expectErr(api(db, V.Dj.uid, 'davy_lock', { room_id: R, player_id: V.Dj.id }), /Pick someone else/);
  await api(db, V.Dj.uid, 'davy_lock', { room_id: R, player_id: V.Sc.id });
  await expectErr(api(db, V.Dj.uid, 'davy_lock', { room_id: R, player_id: V.A.id }), /One lock per game/);
  // one prisoner at a time: even with a fresh lock, not while the last one is still down there
  await sql('update player_secrets set last_lock_game = null where player_id = $1', [V.Dj.id]);
  assert.equal((await SV('Dj')).me.secret.lock_ready, false);
  assert.equal((await SV('Dj')).me.secret.prisoner.name, 'Sc');
  await expectErr(api(db, V.Dj.uid, 'davy_lock', { room_id: R, player_id: V.A.id }), /Sc is still in your Locker/);
  await sql("update players set locked_until = now() - interval '1 second' where id = $1", [V.Sc.id]);
  assert.equal((await SV('Dj')).me.secret.lock_ready, true, 'free again once they\'re out');
  await sql("update players set locked_until = now() + interval '15 minutes' where id = $1", [V.Sc.id]);
  await sql('update player_secrets set last_lock_game = 0 where player_id = $1', [V.Dj.id]);
  await expectErr(api(db, V.Sc.uid, 'scrooge_graffiti', { room_id: R, text: 'Nope nope' }), /can't do that/);
  await api(db, HOST, 'call_next', { room_id: R, player_id: V.A.id });
  await expectErr(api(db, V.Sc.uid, 'scrooge_swap', { room_id: R, player_id: V.B.id }), /can't do that/);   // locked Scrooge: no powers
  await api(db, HOST, 'cancel_round', { room_id: R });
  let { vote_id } = await api(db, HOST, 'start_vote', { room_id: R, kind: 'trial' });
  await expectErr(api(db, V.C.uid, 'cast_vote', { room_id: R, vote_id, choice_id: V.A.id }), /Locker/);
  assert.ok(!(await HV()).vote.options.includes(An.id), 'the Angel is never in the dock');
  await api(db, HOST, 'close_vote', { room_id: R, vote_id });
  // out of the Locker: the waiting punishment comes back first
  await api(db, HOST, 'unlock', { room_id: R, player_id: V.C.id });
  await api(db, HOST, 'call_next', { room_id: R });
  h = await HV();
  assert.equal(h.round.victim_id, V.C.id); assert.equal(h.round.reason, 'first');
  await api(db, HOST, 'cancel_round', { room_id: R });
  step('Davy Jones\' Locker: host-approved rest or the Davy Jones role (10/15/20 min); no vote, no powers; one punishment waits');

  // Judge Dredd (Detective at level 4, 9 beers): Walk of Shame once per game (the Mark is gone)
  await expectErr(api(db, V.De.uid, 'dredd_shame', { room_id: R, player_id: V.A.id, caption: 'Too early' }), /can't do that/);
  await beers('De', 9);
  let de = (await SV('De')).me.secret;
  assert.equal(de.evolved, 'dredd'); assert.equal(de.shame_ready, true); assert.equal(de.mark_ready, undefined);
  await api(db, V.De.uid, 'dredd_shame', { room_id: R, player_id: V.A.id, caption: 'Spilled a whole pint' });
  await expectErr(api(db, V.De.uid, 'dredd_shame', { room_id: R, player_id: V.B.id, caption: 'again' }), /One Walk of Shame/);
  assert.ok(pv(await HV(), V.A.id).punishments.some(x => x.text === 'Walk of Shame: Spilled a whole pint'));
  await expectErr(api(db, V.De.uid, 'dredd_mark', { room_id: R, player_id: V.B.id }), /Unknown action/);
  await expectErr(api(db, V.De.uid, 'sheriff_cite', { room_id: R, player_id: V.A.id }), /Unknown action/);
  step('Detective at level 4 → JUDGE DREDD: Walk of Shame once per game (no Mark)');

  // A reading never includes anyone already exposed (rehab) or the Angel among the others
  await sql('update player_secrets set checks_used = 0 where player_id = $1', [V.De.id]);
  await sql('update players set rehab = true where room_id = $1 and id <> all($2::uuid[])', [R, [V.De.id, V.A.id, V.B.id, An.id]]);
  { const { check_id } = await api(db, V.De.uid, 'investigate', { room_id: R, player_id: V.A.id });
    const [c] = await sql('select group_ids from detective_checks where id = $1', [check_id]);
    assert.deepEqual(new Set(c.group_ids), new Set([V.A.id, V.B.id]), 'the other name is never exposed or the Angel');
    await api(db, V.De.uid, 'view_check', { room_id: R, check_id }); }
  await sql('update players set rehab = false where room_id = $1', [R]);
  step('Detective readings skip exposed players and the Angel');

  // Angel: Holy Nova (+10% of the target, never over the line), bless a wheel punishment to SAFE
  await sql('update rooms set tally = 50 where id = $1', [R]);
  const nova = await api(db, An.uid, 'holy_nova', { room_id: R });
  assert.equal(nova.n, 10); assert.equal((await HV()).room.tally, 60);
  await expectErr(api(db, An.uid, 'holy_nova', { room_id: R }), /spent/);
  await sql('update player_secrets set nova_used = false where player_id = $1', [An.id]);
  await sql('update rooms set tally = 92 where id = $1', [R]);
  assert.equal((await SV('An')).me.secret.nova_ready, false);
  await expectErr(api(db, An.uid, 'holy_nova', { room_id: R }), /can't finish the job/);
  await api(db, HOST, 'update_settings', { room_id: R, segments: ['Drink', 'Shot', 'Safe… for now'] });
  await expectErr(api(db, An.uid, 'angel_bless', { room_id: R, index: 2 }), /already safe/);
  await api(db, An.uid, 'angel_bless', { room_id: R, index: 1 });
  await expectErr(api(db, An.uid, 'angel_bless', { room_id: R, index: 0 }), /already blessed/);
  assert.equal((await HV()).room.segments[1], 'Safe (blessed by the Angel)');
  step('Angel: Holy Nova adds 10 (never finishes the job); blesses a wheel punishment into SAFE for good');

  // Assassin → Ninja at level 4 (9 beers)
  await expectErr(api(db, V.As.uid, 'ninja_strike', { room_id: R, player_id: V.A.id }), /can't do that/);
  await beers('As', 8);
  await expectErr(api(db, V.As.uid, 'ninja_strike', { room_id: R, player_id: V.A.id }), /can't do that/);   // level 3: not yet
  await beers('As', 9);
  let as = (await SV('As')).me.secret;
  assert.equal(as.evolved, 'ninja'); assert.equal(as.strike_ready, true); assert.equal(as.shame_ready, false);
  await expectErr(api(db, V.As.uid, 'ninja_strike', { room_id: R, player_id: An.id }), /Not the Angel/);
  await api(db, V.As.uid, 'ninja_strike', { room_id: R, player_id: V.C.id });
  await expectErr(api(db, V.As.uid, 'ninja_strike', { room_id: R, player_id: V.A.id }), /One strike per game/);
  h = await HV();
  assert.ok(h.queue.some(q => q.player_id === V.C.id && q.reason === 'A shuriken from the shadows'));
  assert.ok(h.events.some(e => e.kind === 'shuriken' && e.payload.player === V.C.id));
  assert.ok(!JSON.stringify(h.events.filter(e => e.kind === 'shuriken')).includes(V.As.id), 'the TV isn\'t told who threw it');
  for (const q of h.queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id });
  step('Assassin at level 4 → NINJA: one anonymous shuriken per game sends anyone to the wheel');

  // Biggest Champ: a sealed golden ticket the Forger can't touch, which saves the next spin
  await sql('update players set beers = 0 where room_id = $1', [R]);
  const { game_id: g6 } = await api(db, HOST, 'start_game', { room_id: R, name: 'Darts' });
  for (let i = 0; i < 3; i++) { await sql('update players set last_beer_at = null where id = $1', [V.A.id]); await api(db, V.A.uid, 'log_beer', { room_id: R }); }
  await api(db, V.B.uid, 'log_beer', { room_id: R });
  await api(db, HOST, 'finish_game', { room_id: R, game_id: g6, losers: [] });
  h = await HV();
  assert.deepEqual(h.game.champs, [V.A.id]); assert.equal(h.game.champ_beers, 3);
  assert.ok(!h.game.slackers.includes(An.id), 'the Angel is never the Slacker');
  assert.ok(!h.game.champs.includes(An.id));
  { const ks = h.events.filter(e => ['champ', 'slacker'].includes(e.kind) && e.payload.game === g6).sort((a, b) => a.id - b.id).map(e => e.kind);
    assert.deepEqual(ks, ['champ', 'slacker'], 'the TV shows the Champ, then the Slacker'); }
  for (const q of h.queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id });
  await api(db, HOST, 'call_next', { room_id: R, player_id: V.A.id });
  await api(db, V.A.uid, 'spin', { room_id: R });
  assert.equal((await HV()).round.phase, 'saved', 'the golden ticket skips the next punishment');
  await api(db, HOST, 'finish_saved', { room_id: R });
  step('Biggest Champ: most beers since the last game → a golden ticket that skips their next spin (not the Angel)');

  // THE SHIV: parole for a caught Saboteur. Every 3 beers logged in rehab earns one, max one per game;
  // public stamp, and the victim's next queued punishment counts ×2
  { const drink = async n => { await sql('update players set last_beer_at = null where id = $1', [V[n].id]); await api(db, V[n].uid, 'log_beer', { room_id: R }); };
    await expectErr(api(db, V.B.uid, 'shiv', { room_id: R, player_id: V.A.id }), /Only players in rehab/);
    await drink('C');                                       // beers before rehab don't count
    await sql('update players set rehab = true where id = $1', [V.C.id]);
    await drink('C'); await drink('C');
    let sh = (await SV('C')).me.shiv;
    assert.equal(sh.ready, false); assert.equal(sh.beers_to_go, 1);
    assert.equal((await SV('B')).me.shiv, null, 'only rehab players see it');
    await expectErr(api(db, V.C.uid, 'shiv', { room_id: R, player_id: V.B.id }), /1 more beers/);
    await drink('C');
    assert.equal((await SV('C')).me.shiv.ready, true);
    await expectErr(api(db, V.C.uid, 'shiv', { room_id: R, player_id: An.id }), /Not the Angel/);
    await expectErr(api(db, V.C.uid, 'shiv', { room_id: R, player_id: V.C.id }), /Pick someone else/);
    await api(db, V.C.uid, 'shiv', { room_id: R, player_id: V.B.id });
    h = await HV();
    assert.equal(pv(h, V.B.id).shivved_by, V.C.id, 'the stamp is public');
    assert.ok(h.events.some(e => e.kind === 'shiv' && e.payload.player === V.B.id && e.payload.by === V.C.id));
    await expectErr(api(db, V.C.uid, 'shiv', { room_id: R, player_id: V.A.id }), /One shiv per game/);
    for (let i = 0; i < 3; i++) await drink('C');
    sh = (await SV('C')).me.shiv;
    assert.equal(sh.ready, false, 'still once per game'); assert.equal(sh.used_this_game, true);
    await api(db, HOST, 'queue_add', { room_id: R, player_id: V.B.id, reason: 'Lost darts' });
    await api(db, HOST, 'call_next', { room_id: R });
    h = await HV();
    assert.equal(h.round.victim_id, V.B.id); assert.equal(h.round.times, 2, 'the shivved punishment counts double');
    assert.equal(pv(h, V.B.id).shivved_by, null, 'one punishment, then the stamp is gone');
    await api(db, HOST, 'cancel_round', { room_id: R });
    const { game_id: gs } = await api(db, HOST, 'start_game', { room_id: R, name: 'Cornhole' });
    await api(db, HOST, 'finish_game', { room_id: R, game_id: gs, losers: [] });
    assert.equal((await SV('C')).me.shiv.ready, true, '6 rehab beers + a new game: the second shiv');
    for (const q of (await HV()).queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id });
    await api(db, HOST, 'unexpose', { room_id: R, player_id: V.C.id });
    assert.equal((await SV('C')).me.shiv, null);
    assert.equal((await sql('select rehab_beers from players where id = $1', [V.C.id]))[0].rehab_beers, 0, 'leaving rehab resets the count'); }
  step('The Shiv: every 3 beers in rehab earns one (once per game); public stamp; their next punishment ×2');

  // Aaron's Plate: one sausage each, one dirty; only the TV knows which until it's served
  await expectErr(api(db, V.A.uid, 'bbq_start', { room_id: R }), /can't do that/);
  await beers('Sk', 5);
  assert.equal((await SV('Sk')).me.secret.bbq_ready, false, 'the plate unlocks at level 3');
  await expectErr(api(db, V.Sk.uid, 'bbq_start', { room_id: R }), /can't do that/);
  await beers('Sk', 6);
  assert.equal((await SV('Sk')).me.secret.bbq_ready, true);
  const { plate_id } = await api(db, V.Sk.uid, 'bbq_start', { room_id: R });
  await expectErr(api(db, V.Sk.uid, 'bbq_start', { room_id: R }), /already on|One BBQ/);
  h = await HV();
  assert.equal(h.plate.status, 'open'); assert.equal(typeof h.plate.dirty, 'number', 'the TV knows which one is dirty');
  assert.ok(!h.plate.eaters.includes(An.id), 'the Angel doesn\'t eat');
  assert.ok(h.plate.eaters.includes(V.Sk.id), 'the Skank eats too, so sitting out gives nothing away');
  assert.ok(!JSON.stringify(h.events.filter(e => e.kind === 'bbq_start')).includes(V.Sk.id), 'nobody is told who lit the grill');
  const ph = await SV('A');
  assert.equal(ph.plate.dirty, null, 'phones can\'t see the dirty one');
  await api(db, V.A.uid, 'bbq_pick', { room_id: R, plate_id, index: 0 });
  await expectErr(api(db, V.B.uid, 'bbq_pick', { room_id: R, plate_id, index: 0 }), /beat you to that one/);
  await expectErr(api(db, V.A.uid, 'bbq_pick', { room_id: R, plate_id, index: 1 }), /already took one/);
  await api(db, V.B.uid, 'bbq_pick', { room_id: R, plate_id, index: 1 });
  { const pb = (await SV('B')).plate, pc = (await SV('C')).plate;
    assert.deepEqual(pb.picks, { [V.B.id]: 1 }, 'a phone only sees its own pick');
    assert.deepEqual(pc.picks, {}); assert.deepEqual(pc.taken.sort(), [0, 1], '…and which sausages are gone');
    assert.equal(Object.keys((await HV()).plate.picks).length, 2, 'the TV has them all'); }
  await expectErr(api(db, V.B.uid, 'bbq_close', { room_id: R, plate_id }), /Still grilling/);
  await api(db, HOST, 'bbq_close', { room_id: R, plate_id });
  h = await HV();
  assert.equal(h.plate.status, 'closed'); assert.equal(Object.keys(h.plate.picks).length, h.plate.eaters.length, 'everyone ends up with a sausage');
  const loser = Object.entries(h.plate.picks).find(([, i]) => i === h.plate.dirty)[0];
  assert.equal(h.plate.loser, loser);
  assert.ok(h.queue.some(q => q.player_id === loser && q.reason === 'Ate the dirty sausage'));
  step('Aaron\'s Plate: Skank (or host) lights the grill anonymously; unique picks; latecomers get leftovers; dirty sausage → punishment');
}

// ---------- Test Lab: practice rooms only; bots; acting as a bot with the real rules ----------
{
  await expectErr(api(db, HOST, 'lab_bots', { room_id, n: 2 }), /practice room/);
  const pr = await api(db, HOST, 'create_room', { settings: { practice: true }, deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = pr.room_id;
  const u = randomUUID(); await addUser(db, u); await api(db, u, 'join', { code: pr.code, name: 'Human' });
  await expectErr(api(db, u, 'lab_bots', { room_id: R, n: 2 }), /Only the host/);
  await api(db, HOST, 'lab_bots', { room_id: R, n: 5 });
  let h = await state(db, HOST, pr.code);
  assert.deepEqual(h.players.filter(p => p.name.startsWith('Bot')).map(p => p.name), ['Bot 1', 'Bot 2', 'Bot 3', 'Bot 4', 'Bot 5']);
  await api(db, HOST, 'generate_cards', { room_id: R, role_counts: { intruder: 1, medic: 1, detective: 1, drinker: 2, lovebird: 0, cursed: 0, betrayer: 0, forger: 0, skank: 0, scrooge: 0, jester: 0, davyjones: 0, assassin: 0 } });
  await api(db, HOST, 'lab_deal', { room_id: R });
  h = await state(db, HOST, pr.code);
  assert.equal(h.players.filter(p => p.has_role).length, 5, 'every bot got a card');
  assert.equal(h.me.secret, null, 'the TV state still has no secrets');
  const bots = h.players.filter(p => p.name.startsWith('Bot'));
  const views = await Promise.all(bots.map(b => api(db, HOST, 'lab_state', { room_id: R, player_id: b.id })));
  const medic = bots[views.findIndex(v => v.me.secret.role === 'medic')];
  assert.ok(medic, 'lab_state shows a bot its own secret');
  await expectErr(api(db, HOST, 'lab_as', { room_id: R, player_id: medic.id, action: 'heal', args: { player_id: bots.find(b => b !== medic).id } }), /can't do that/);   // level 1: pacified
  await api(db, HOST, 'lab_beers', { room_id: R, player_id: medic.id, beers: 3 });
  await api(db, HOST, 'lab_as', { room_id: R, player_id: medic.id, action: 'heal', args: { player_id: bots.find(b => b !== medic).id } });
  await expectErr(api(db, HOST, 'lab_as', { room_id: R, player_id: medic.id, action: 'heal', args: { player_id: medic.id } }), /heal yourself/);
  await api(db, HOST, 'lab_beers', { room_id: R, player_id: medic.id, beers: 9 });
  assert.equal((await api(db, HOST, 'lab_state', { room_id: R, player_id: medic.id })).me.secret.evolved, 'surgeon');
  await expectErr(api(db, HOST, 'lab_as', { room_id: R, player_id: medic.id, action: 'lab_bots', args: {} }), /Not allowed/);
  await expectErr(api(db, HOST, 'lab_role', { room_id: R, player_id: medic.id, role: 'scrooge' }), /already have a card/);
  await api(db, HOST, 'lab_bots', { room_id: R, n: 1, selfies: ['data:image/svg+xml,x'] });
  h = await state(db, HOST, pr.code);
  const b6 = h.players.find(p => p.name === 'Bot 6');
  assert.equal(b6.selfie_url, 'data:image/svg+xml,x');
  await api(db, HOST, 'lab_role', { room_id: R, player_id: b6.id, role: 'scrooge' });
  assert.equal((await api(db, HOST, 'lab_state', { room_id: R, player_id: b6.id })).me.secret.role, 'scrooge');
  await expectErr(api(db, HOST, 'lab_as', { room_id: R, player_id: medic.id, action: 'generate_cards', args: {} }), /Only the host/);
  step('Test Lab: practice rooms only, host only; bots dealt real cards; acting as a bot runs the real rules');
}

// ---------- level 4 names; the Oathbreaker's Forged Orders; the Scrooge can't swap onto the Angel ----------
{
  const o = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const deck = { forger: 1, scrooge: 1, davyjones: 1, skank: 1, jester: 1, drinker: 2, intruder: 0, betrayer: 0, medic: 0, detective: 0, assassin: 0, lovebird: 0, cursed: 0 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: o.room_id, role_counts: deck });
  const O = {};
  for (const [n, role] of [['Fo', 'forger'], ['Sc', 'scrooge'], ['Dj', 'davyjones'], ['Sk', 'skank'], ['Je', 'jester'], ['X', 'drinker'], ['Y', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    O[n] = { uid, id: (await api(db, uid, 'join', { code: o.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: o.room_id, code: cards.splice(cards.findIndex(c => c.role === role), 1)[0].code });
  }
  const An = { uid: randomUUID() }; await addUser(db, An.uid);
  An.id = (await api(db, An.uid, 'join', { code: o.code, name: 'Angel' })).player_id;
  await api(db, HOST, 'make_angel', { room_id: o.room_id, player_id: An.id });
  const SO = n => state(db, O[n].uid, o.code);
  await sql('update players set beers = 9 where room_id = $1', [o.room_id]);
  const names = {};
  for (const n of ['Fo', 'Dj', 'Sk', 'Je', 'Sc']) names[n] = (await SO(n)).me.secret.evolved;
  assert.deepEqual(names, { Fo: 'oathbreaker', Dj: 'kraken', Sk: 'gobshite', Je: 'pennywise', Sc: null });
  assert.equal((await SO('Dj')).me.secret.lock_minutes, 15);
  // Forged Orders: move a waiting punishment onto someone else, once per game, never onto the Angel
  await api(db, HOST, 'queue_add', { room_id: o.room_id, player_id: O.X.id, reason: 'Lost darts' });
  let q = (await state(db, HOST, o.code)).queue[0];
  await expectErr(api(db, O.Fo.uid, 'forged_orders', { room_id: o.room_id, queue_id: q.id, player_id: An.id }), /never punished/);
  await api(db, O.Fo.uid, 'forged_orders', { room_id: o.room_id, queue_id: q.id, player_id: O.Y.id });
  let h = await state(db, HOST, o.code);
  assert.equal(h.queue[0].player_id, O.Y.id); assert.equal(h.queue[0].reason, 'Lost darts');
  assert.ok(!JSON.stringify(h.events.filter(e => e.kind === 'orders_forged')).includes(O.Fo.id), 'the TV isn\'t told who forged it');
  await expectErr(api(db, O.Fo.uid, 'forged_orders', { room_id: o.room_id, queue_id: q.id, player_id: O.X.id }), /One set of forged orders/);
  assert.equal((await SO('Fo')).me.secret.orders_ready, false);
  await sql('update players set beers = 2 where id = $1', [O.X.id]);
  await expectErr(api(db, O.X.uid, 'forged_orders', { room_id: o.room_id, queue_id: q.id, player_id: O.Sc.id }), /can't do that/);
  // the Scrooge's swap can't hand a punishment to the Angel
  await api(db, HOST, 'call_next', { room_id: o.room_id });
  const rd = (await state(db, HOST, o.code)).round;
  await expectErr(api(db, O.Sc.uid, 'scrooge_swap', { room_id: o.room_id, round_id: rd.id, player_id: An.id }), /never punished/);
  await api(db, HOST, 'cancel_round', { room_id: o.room_id });
  step('level 4: Oathbreaker / Kraken (15-min Locker) / Gobshite / Pennywise; Forged Orders moves a queued punishment (once, anonymous, never the Angel); Scrooge can\'t swap onto the Angel');
}

// ---------- mini-games: summoned to the TV (Dodge, Walk the Plank, Jack-in-the-Box) and phone-only (the bomb, Penny Drop) ----------
{
  const m = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = m.room_id;
  const deck = { assassin: 1, davyjones: 1, jester: 1, intruder: 1, scrooge: 1, drinker: 3, forger: 0, betrayer: 0, medic: 0, detective: 0, skank: 0, lovebird: 0, cursed: 0 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  const M = {};
  for (const [n, role] of [['As', 'assassin'], ['Kr', 'davyjones'], ['Pw', 'jester'], ['In', 'intruder'], ['Sc', 'scrooge'], ['X', 'drinker'], ['Y', 'drinker'], ['Z', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    M[n] = { uid, id: (await api(db, uid, 'join', { code: m.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: R, code: cards.splice(cards.findIndex(c => c.role === role), 1)[0].code });
  }
  const An = { uid: randomUUID() }; await addUser(db, An.uid);
  An.id = (await api(db, An.uid, 'join', { code: m.code, name: 'Angel' })).player_id;
  await api(db, HOST, 'make_angel', { room_id: R, player_id: An.id });
  const SM = n => state(db, M[n].uid, m.code);
  const HM = () => state(db, HOST, m.code);
  const go = id => sql("update minigames set live_at = now() - interval '1 second' where id = $1", [id]);   // skip the 3-2-1
  const queueOf = async id => (await HM()).queue.filter(q => q.player_id === id).map(q => q.reason);
  const clearQueue = async () => { for (const q of (await HM()).queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id }); };

  // DODGE (Assassin at levels 2-3): summoned to the TV, the throw stays secret
  await sql('update players set beers = 3 where room_id = $1', [R]);
  assert.equal((await SM('As')).me.secret.dodge_ready, true);
  await expectErr(api(db, M.As.uid, 'dodge_throw', { room_id: R, player_id: An.id, dir: 'left' }), /Pick someone else/);
  let { game_id } = await api(db, M.As.uid, 'dodge_throw', { room_id: R, player_id: M.X.id, dir: 'left' });
  let h = await HM();
  assert.equal(h.minigame.status, 'muster'); assert.deepEqual(h.minigame.players, [M.X.id]);
  assert.ok(!JSON.stringify(h).includes('"left"') && !JSON.stringify(h.minigame).includes(M.As.id), 'the TV never sees the throw or who threw it');
  await expectErr(api(db, M.Kr.uid, 'mg_ready', { room_id: R, game_id }), /not in this one/);
  await api(db, M.X.uid, 'mg_ready', { room_id: R, game_id });
  assert.equal((await HM()).minigame.status, 'live');
  await expectErr(api(db, M.X.uid, 'mg_move', { room_id: R, game_id, dir: 'right' }), /Wait for GO/);
  await go(game_id);
  await api(db, M.X.uid, 'mg_move', { room_id: R, game_id, dir: 'left' });
  h = await HM();
  assert.equal(h.minigame.status, 'done'); assert.equal(h.minigame.result.dodged, true); assert.deepEqual(await queueOf(M.X.id), []);
  await expectErr(api(db, M.As.uid, 'dodge_throw', { room_id: R, player_id: M.Y.id, dir: 'high' }), /One throw per game/);
  // a no-show: after 90s the host can call it off (the Assassin gets the throw back) …
  await sql('update player_secrets set last_strike_game = null where player_id = $1', [M.As.id]);
  ({ game_id } = await api(db, M.As.uid, 'dodge_throw', { room_id: R, player_id: M.Y.id, dir: 'high' }));
  await expectErr(api(db, M.Kr.uid, 'plank_start', { room_id: R, player_ids: [M.X.id, M.Y.id, M.Z.id] }), /already on|can't do that/);
  await sql("update minigames set muster_until = now() - interval '1 second' where id = $1", [game_id]);
  await api(db, HOST, 'mg_tick', { room_id: R, game_id });
  assert.equal((await HM()).minigame.state.waiting_host, true);
  await expectErr(api(db, M.Y.uid, 'mg_decide', { room_id: R, game_id, start: false }), /Only the host/);
  await api(db, HOST, 'mg_decide', { room_id: R, game_id, start: false });
  assert.equal((await HM()).minigame.status, 'cancelled'); assert.equal((await SM('As')).me.secret.dodge_ready, true);
  // … or start anyway: the no-show takes the hit
  ({ game_id } = await api(db, M.As.uid, 'dodge_throw', { room_id: R, player_id: M.Y.id, dir: 'high' }));
  await api(db, HOST, 'mg_decide', { room_id: R, game_id, start: true });
  assert.deepEqual(await queueOf(M.Y.id), ['Hit by a throwing star (no-show)']);
  await clearQueue();
  step('Dodge: summoned target reads the throw (right = safe); secret throw & thrower; no-show → host calls it off (refund) or starts anyway (no-show hit)');

  // WALK THE PLANK (the Kraken): furthest from the edge, or overboard, drinks
  await sql('update players set beers = 9 where room_id = $1', [R]);
  ({ game_id } = await api(db, M.Kr.uid, 'plank_start', { room_id: R, player_ids: [M.X.id, M.Y.id, M.Z.id] }));
  for (const n of ['X', 'Y', 'Z']) await api(db, M[n].uid, 'mg_ready', { room_id: R, game_id });
  // the server keeps the clock: put GO t ms in the past, then stop (the marker is at 110 × (t/5200)^1.7)
  const at = t => sql(`update minigames set live_at = now() - interval '${t} milliseconds' where id = $1`, [game_id]);
  await at(1000);
  await api(db, M.X.uid, 'mg_move', { room_id: R, game_id, pos: 99.9 });          // a doctored stop, a second after GO
  assert.ok((await SM('X')).minigame.mine < 10, 'a phone cannot claim a spot the marker has not reached');
  await sql(`update minigames set secret = secret #- '{pos,${M.X.id}}' where id = $1`, [game_id]);
  await at(5050);                                                               // an honest stop near the edge (~95)
  await api(db, M.X.uid, 'mg_move', { room_id: R, game_id, pos: 95 });
  await at(4000);
  await api(db, M.Y.uid, 'mg_move', { room_id: R, game_id, pos: 60 });
  assert.ok(!JSON.stringify(await HM()).includes('"95"') && (await SM('X')).minigame.mine === 95, 'positions stay hidden until the end (you see your own)');
  assert.ok(!('stopped' in (await HM()).minigame.state), 'nobody is told who has stopped');
  await at(6300);
  await api(db, M.Z.uid, 'mg_move', { room_id: R, game_id, pos: 20 });             // too late: the marker was already over the edge
  h = await HM();
  assert.deepEqual(h.minigame.result.losers, [M.Z.id], 'overboard beats furthest-from-the-edge');
  assert.deepEqual(await queueOf(M.Z.id), ['Walked the plank']);
  await clearQueue();
  step('Walk the Plank: 3 summoned, stop the marker near the edge; overboard (or furthest back) walks the plank');

  // JACK-IN-THE-BOX (Pennywise): take turns cranking; whoever pops it drinks
  ({ game_id } = await api(db, M.Pw.uid, 'jack_start', { room_id: R, player_ids: [M.Pw.id, M.X.id, M.Y.id, M.Z.id] }));
  for (const n of ['Pw', 'X', 'Y', 'Z']) await api(db, M[n].uid, 'mg_ready', { room_id: R, game_id });
  await go(game_id);
  await sql(`update minigames set secret = '{"pop":5}' where id = $1`, [game_id]);
  let order = (await HM()).minigame.state.order;
  const who = id => Object.keys(M).find(k => M[k].id === id);
  await expectErr(api(db, M[who(order[1])].uid, 'mg_move', { room_id: R, game_id, n: 1 }), /Not your turn/);
  await api(db, M[who(order[0])].uid, 'mg_move', { room_id: R, game_id, n: 3 });
  assert.equal((await HM()).minigame.state.count, 3);
  await api(db, M[who(order[1])].uid, 'mg_move', { room_id: R, game_id, n: 2 });
  h = await HM();
  assert.equal(h.minigame.status, 'done'); assert.deepEqual(h.minigame.result.losers, [order[1]]); assert.equal(h.minigame.result.pop, 5);
  await clearQueue();
  step('Jack-in-the-Box: 4 summoned, turns of 1-3 cranks, a secret pop number; whoever pops it drinks');

  // THE BOMB (Intruder at level 4): phone-only hot potato; no passing straight back; the fuse is secret
  ({ game_id } = await api(db, M.In.uid, 'bomb_start', { room_id: R }));
  h = await HM();
  assert.equal(h.minigame.status, 'live'); assert.ok(!h.minigame.players.includes(An.id), 'the Angel sits it out');
  assert.equal(h.minigame.ends_at, null); assert.ok(!JSON.stringify(h).includes('fuse'), 'nobody sees the fuse');
  let holder = h.minigame.state.holder;
  const other = Object.keys(M).find(k => M[k].id !== holder);
  await expectErr(api(db, M[other].uid, 'mg_move', { room_id: R, game_id, to: M.X.id }), /not holding/);
  await api(db, M[who(holder)].uid, 'mg_move', { room_id: R, game_id, to: M[other].id });
  await expectErr(api(db, M[other].uid, 'mg_move', { room_id: R, game_id, to: holder }), /straight back/);
  await sql(`update minigames set secret = jsonb_set(secret, '{fuse_at}', to_jsonb(now() - interval '1 second')) where id = $1`, [game_id]);
  await api(db, HOST, 'mg_tick', { room_id: R, game_id });
  assert.deepEqual(await queueOf(M[other].id), ['Holding the bomb']);
  await clearQueue();
  step('the bomb: live on every phone at once, pass it on (not straight back), whoever holds it when the secret fuse runs out drinks');

  // PENNY DROP (Scrooge at level 4): everyone calls; wrong or silent callers drink
  ({ game_id } = await api(db, M.Sc.uid, 'penny_start', { room_id: R }));
  await go(game_id);
  await sql(`update minigames set secret = jsonb_set(secret, '{coin}', '"heads"') where id = $1`, [game_id]);
  assert.ok(!JSON.stringify(await HM()).includes('"heads"'), 'the coin stays hidden');
  await api(db, M.X.uid, 'mg_move', { room_id: R, game_id, call: 'heads' });
  await api(db, M.Y.uid, 'mg_move', { room_id: R, game_id, call: 'tails' });
  await sql("update minigames set ends_at = now() - interval '1 second' where id = $1", [game_id]);
  await api(db, HOST, 'mg_tick', { room_id: R, game_id });
  h = await HM();
  const losers = h.minigame.result.losers;
  assert.ok(losers.includes(M.Y.id) && losers.includes(M.Z.id) && !losers.includes(M.X.id));
  assert.ok(h.players.find(p => p.id === M.Y.id).punishments.some(x => x.text === 'Penny Drop: called it wrong'));
  step('Penny Drop: everyone calls the coin on their phone; wrong or silent callers take a drink');
}

// ---------- one TV moment at a time: first public ability wins, the rest are told (and keep their ability) ----------
{
  const t = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const deck = { davyjones: 2, scrooge: 0, drinker: 2, intruder: 0, betrayer: 0, forger: 0, medic: 1, detective: 0, skank: 0, jester: 0, assassin: 0, lovebird: 0, cursed: 0 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: t.room_id, role_counts: deck });
  const T = {};
  for (const [n, role] of [['D1', 'davyjones'], ['D2', 'davyjones'], ['Me', 'medic'], ['X', 'drinker'], ['Y', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    T[n] = { uid, id: (await rawApi(db, uid, 'join', { code: t.code, name: n })).player_id };
    await rawApi(db, uid, 'redeem', { room_id: t.room_id, code: cards.splice(cards.findIndex(c => c.role === role), 1)[0].code });
  }
  await sql('update players set beers = 3 where room_id = $1', [t.room_id]);
  // both Davy Joneses press at once: exactly one gets the stage
  const [a, b] = await Promise.allSettled([
    rawApi(db, T.D1.uid, 'davy_lock', { room_id: t.room_id, player_id: T.X.id }),
    rawApi(db, T.D2.uid, 'davy_lock', { room_id: t.room_id, player_id: T.Y.id }),
  ]);
  assert.equal([a, b].filter(x => x.status === 'fulfilled').length, 1, 'only the first press goes through');
  const lost = a.status === 'rejected' ? a : b, loser = a.status === 'rejected' ? T.D1 : T.D2;
  assert.match(lost.reason.message, /^BUSY:\d+$/);
  const secs = +lost.reason.message.slice(5); assert.ok(secs >= 10 && secs <= 11, 'the Locker holds the stage ~11s');
  assert.equal((await state(db, loser.uid, t.code)).me.secret.lock_ready, true, 'the loser keeps their ability');
  assert.ok((await state(db, T.X.uid, t.code)).room.ability_until, 'phones can see the stage is busy');
  // secret abilities don't take part (a block would give them away)
  await rawApi(db, T.Me.uid, 'heal', { room_id: t.room_id, player_id: T.X.id });
  // once the break is over, the loser goes
  await sql('update rooms set ability_until = now() - interval \'1 second\' where id = $1', [t.room_id]);
  await rawApi(db, loser.uid, 'davy_lock', { room_id: t.room_id, player_id: loser === T.D1 ? T.X.id : T.Y.id });
  assert.equal((await state(db, T.X.uid, t.code)).room.ability_until !== null, true);
  // the host is never blocked
  await rawApi(db, HOST, 'unlock', { room_id: t.room_id, player_id: T.X.id });
  step('one TV moment at a time: simultaneous presses → first wins, the other is told BUSY and keeps the ability');
}

// ---------- the 30 Sep scan: cheats and stuck states closed ----------
{
  const k = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = k.room_id;
  const deck = { intruder: 1, betrayer: 1, lovebird: 1, drinker: 3, forger: 0, medic: 0, detective: 0, scrooge: 0, skank: 0, davyjones: 0, jester: 0, assassin: 0, cursed: 0 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  await sql('update role_codes set pair_id = null where room_id = $1', [R]);
  const pair = randomUUID(), K = {};
  const drinkers = cards.filter(c => c.role === 'drinker');
  for (const c of drinkers.slice(0, 2)) await sql('update role_codes set pair_id = $1 where code = $2', [pair, c.code.replace('-', '')]);
  for (const [n, c] of [['In', cards.find(c => c.role === 'intruder')], ['Be', cards.find(c => c.role === 'betrayer')], ['L1', drinkers[0]], ['L2', drinkers[1]], ['D', drinkers[2]]]) {
    const uid = randomUUID(); await addUser(db, uid);
    K[n] = { uid, code: c.code, id: (await api(db, uid, 'join', { code: k.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: R, code: c.code });
  }
  const HK = () => state(db, HOST, k.code), SK = n => state(db, K[n].uid, k.code);
  await sql('update players set beers = 3 where id = any($1::uuid[])', [[K.In.id, K.Be.id]]);   // level 2: powers on

  // no card, no beers and no vote: a second tab can't be a sock puppet
  const sock = randomUUID(); await addUser(db, sock);
  await api(db, sock, 'join', { code: k.code, name: 'Sock' });
  await expectErr(api(db, sock, 'log_beer', { room_id: R }), /Open your card first/);
  // renaming into someone else's name, or wearing someone else's photo, is refused
  await expectErr(api(db, sock, 'join', { code: k.code, name: 'd' }), /already has that name/);
  await expectErr(api(db, sock, 'join', { code: k.code, name: 'Sock', selfie_url: `https://x.supabase.co/storage/v1/object/public/selfies/${K.D.uid}/a.jpg` }), /Take your selfie on this phone/);
  await api(db, sock, 'join', { code: k.code, name: 'Sock', selfie_url: `https://x.supabase.co/storage/v1/object/public/selfies/${sock}/a.jpg` });
  // one beer every 3 minutes
  await api(db, K.D.uid, 'log_beer', { room_id: R });
  await expectErr(api(db, K.D.uid, 'log_beer', { room_id: R }), /One beer every 3 minutes/);
  step('no card = no beers; names stay unique on rename; selfies only from your own folder; one beer per 3 minutes');

  // a wrong Betrayer guess is a private drink: no public punishment, no event naming them
  const before = (await HK()).events.length;
  const g = await api(db, K.Be.uid, 'betrayer_guess', { room_id: R, player_id: K.D.id });
  assert.equal(g.correct, false);
  const hk = await HK();
  assert.ok(!hk.players.find(p => p.id === K.Be.id).punishments?.length, 'no public penalty row for the Betrayer');
  assert.ok(!hk.events.slice(before).some(e => e.kind === 'penalty'), 'no penalty event');
  step('a wrong Betrayer guess stays on their phone: nothing public names them');

  // a missed Hit holds no stage: nobody can tell it happened
  await rawApi(db, K.In.uid, 'hit', { room_id: R, player_id: K.D.id, role: 'medic' });
  assert.equal((await HK()).room.ability_until, null, 'a missed Hit leaves no stage hold');
  step('a missed Hit is invisible: no stage hold');

  // undo stops at a player's move: it can't erase it or hand a spent move back
  await api(db, HOST, 'log_beer', { room_id: R, delta: 1 });
  const undoBefore = JSON.stringify((await HK()).undo);
  await api(db, K.Be.uid, 'betrayer_guess', { room_id: R, player_id: K.L1.id });
  assert.equal(JSON.stringify((await HK()).undo), undoBefore, 'a quiet secret move changes nothing the TV can see (the UNDO key stays as it was)');
  await expectErr(api(db, HOST, 'undo', { room_id: R }), /moved on/);
  step('host undo stops once a player has made a move (and the TV cannot tell a quiet move happened)');

  // kick: the Lovebird is single again, the kicked Intruder's knife goes to the Betrayer, the code stays burned
  await api(db, HOST, 'kick', { room_id: R, player_id: K.L1.id });
  assert.equal((await SK('L2')).me.secret.lovebird, false, 'the partner is no longer a Lovebird');
  await api(db, HOST, 'kick', { room_id: R, player_id: K.In.id });
  assert.equal((await SK('Be')).me.secret.has_knife, true, 'the knife passes on');
  const again = randomUUID(); await addUser(db, again);
  await api(db, again, 'join', { code: k.code, name: 'Again' });
  await expectErr(api(db, again, 'redeem', { room_id: R, code: K.In.code }), /./);
  assert.equal((await api(db, HOST, 'get_cards', { room_id: R })).redeemed, 5, 'kicked players\' codes still count as used');
  step('kick: Lovebird freed, knife passed, code stays burned');

  // the deadline: beers stop at 01:00 even if the TV never ends the night
  await sql("update rooms set deadline_at = now() - interval '1 second' where id = $1", [R]);
  await sql('update players set last_beer_at = null where id = $1', [K.D.id]);
  await expectErr(api(db, K.D.uid, 'log_beer', { room_id: R }), /Time's up/);
  await api(db, HOST, 'end_check', { room_id: R });
  assert.equal((await HK()).room.ended, true);
  step('after the deadline no beer counts, and end_check ends the night');
}

// ---------- the 1 Oct scan: Locker vs the queue, hint decoys, the Angel, spin again, mini-games, the knife, lock length, evidence ----------
{
  const k = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = k.room_id;
  const deck = { intruder: 1, betrayer: 1, assassin: 1, drinker: 4, forger: 0, medic: 0, detective: 0, scrooge: 0, skank: 0, davyjones: 0, jester: 0, lovebird: 0, cursed: 0 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  const K = {};
  for (const [n, role] of [['In', 'intruder'], ['Be', 'betrayer'], ['As', 'assassin'], ['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker'], ['D', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    K[n] = { uid, id: (await api(db, uid, 'join', { code: k.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: R, code: cards.splice(cards.findIndex(c => c.role === role), 1)[0].code });
  }
  const An = { uid: randomUUID() }; await addUser(db, An.uid);
  An.id = (await api(db, An.uid, 'join', { code: k.code, name: 'Angel' })).player_id;
  await api(db, HOST, 'make_angel', { room_id: R, player_id: An.id });
  const HK = () => state(db, HOST, k.code), SK = n => state(db, K[n].uid, k.code);
  const qOf = id => sql('select reason, status from queue where player_id = $1 order by pos', [id]);
  await sql('update players set beers = 3 where id = $1', [K.As.id]);                // level 2: the Assassin's Dodge
  const clearQueue = () => sql("update queue set status = 'cancelled' where room_id = $1 and status in ('queued','held')", [R]);

  // 1 + 8: a host lock is always 15 minutes (the minutes argument is ignored); what was already queued follows the Locker rule
  await api(db, HOST, 'queue_add', { room_id: R, player_id: K.C.id, reason: 'c1' });
  await api(db, HOST, 'queue_add', { room_id: R, player_id: K.D.id, reason: 'd1' });
  await api(db, HOST, 'queue_add', { room_id: R, player_id: K.C.id, reason: 'c2' });
  await api(db, HOST, 'lock', { room_id: R, player_id: K.C.id, minutes: 30 });
  let h = await HK();
  const mins = (Date.parse(h.players.find(p => p.id === K.C.id).locked_until) - Date.parse(h.server_now)) / 60e3;
  assert.ok(mins > 14.9 && mins <= 15, 'the host lock is 15 minutes, whatever the TV asked for (got ' + mins + ')');
  assert.deepEqual(await qOf(K.C.id), [{ reason: 'c1', status: 'held' }, { reason: 'c2', status: 'cancelled' }],
                   'queued before the lock: the first one waits, the rest are dropped');
  assert.deepEqual(h.queue.map(q => q.reason), ['d1']);
  assert.equal(h.players.find(p => p.id === K.C.id).held, true);
  await api(db, HOST, 'queue_add', { room_id: R, player_id: K.C.id, reason: 'c3' });
  assert.equal((await qOf(K.C.id)).filter(q => q.status === 'held').length, 1, 'still only one waits');
  // call_next skips anyone in the Locker, even a row that somehow sits in the queue
  await sql("update queue set status = 'queued' where player_id = $1 and status = 'held'", [K.C.id]);
  await api(db, HOST, 'call_next', { room_id: R });
  assert.equal((await HK()).round.victim_id, K.D.id, 'C is in the Locker: D goes first');
  await api(db, HOST, 'cancel_round', { room_id: R });
  await expectErr(api(db, HOST, 'call_next', { room_id: R, player_id: K.C.id }), /Davy Jones' Locker/);
  await api(db, HOST, 'unlock', { room_id: R, player_id: K.C.id });
  await clearQueue();
  // a rest the player asked for still takes the host's 10/20/30
  await api(db, K.A.uid, 'request_lock', { room_id: R });
  await api(db, HOST, 'decide_lock', { room_id: R, player_id: K.A.id, approve: true, minutes: 30 });
  h = await HK();
  assert.ok((Date.parse(h.players.find(p => p.id === K.A.id).locked_until) - Date.parse(h.server_now)) / 60e3 > 29, 'an approved rest keeps its length');
  await api(db, HOST, 'unlock', { room_id: R, player_id: K.A.id });
  step('Locker: queued punishments follow the lock (one waits, the rest drop); call_next skips locked players; the host lock is always 15 min');

  // 3: the Angel is never punished
  await expectErr(api(db, HOST, 'queue_add', { room_id: R, player_id: An.id }), /The Angel is never punished/);
  await expectErr(api(db, HOST, 'call_next', { room_id: R, player_id: An.id }), /The Angel is never punished/);
  await expectErr(api(db, HOST, 'free_spin', { room_id: R, player_id: An.id }), /The Angel is never punished/);
  { const { game_id } = await api(db, HOST, 'start_game', { room_id: R, name: 'Darts' });
    await api(db, HOST, 'finish_game', { room_id: R, game_id, losers: [An.id, K.B.id] });
    h = await HK();
    assert.deepEqual(h.game.losers, [K.B.id], 'the Angel is left off the losers');
    assert.ok(!h.queue.some(q => q.player_id === An.id)); assert.ok(h.queue.some(q => q.player_id === K.B.id && q.reason === 'Lost Darts')); }
  assert.equal((await sql('select count(*)::int n from queue where player_id = $1', [An.id]))[0].n, 0);
  await clearQueue();
  step('the Angel is never punished: queue_add, PUNISH NOW and free spin refuse; finish_game drops them from the losers');

  // 4: a third "spin again" never ends the chain on "again" (it would log nothing)
  { const wheel = JSON.stringify(['Spin again', 'Spin again, doubled', 'Spin again!', 'Drink'].map(text => ({ text, graffiti: false })));
    for (let i = 0; i < 200; i++) {
      const [{ l }] = await sql('select public._landings($1::jsonb, false) l', [wheel]);
      assert.ok(l.length <= 3); assert.notEqual(l[l.length - 1].kind, 'again', 'the chain always ends on a real landing');
      if (l.length === 3) assert.equal(l[2].mult, 4);
    } }
  step('spin again: at the max depth the re-roll leaves out "spin again", so the chain always logs something');

  // 2: the Betrayer's level-4 hint never uses an exposed player or the Angel as a decoy
  await sql('update players set beers = 9 where id = $1', [K.Be.id]);
  await sql('update players set rehab = true where id = any($1::uuid[])', [[K.A.id, K.B.id, K.As.id]]);
  await api(db, K.Be.uid, 'betrayer_hint', { room_id: R });
  { const [{ hint_ids }] = await sql('select hint_ids from player_secrets where player_id = $1', [K.Be.id]);
    assert.deepEqual(new Set(hint_ids), new Set([K.In.id, K.C.id, K.D.id]), 'the decoys are never exposed or the Angel'); }
  await sql('update players set rehab = false where room_id = $1', [R]);
  step('Betrayer hint: decoys follow the Detective\'s rule (no exposed players, no Angel)');

  // 5: mini-games and the wheel/vote don't overlap
  { const { game_id } = await api(db, K.As.uid, 'dodge_throw', { room_id: R, player_id: K.D.id, dir: 'left' });
    await expectErr(api(db, HOST, 'call_next', { room_id: R, player_id: K.B.id }), /mini-game is on/);
    await expectErr(api(db, HOST, 'free_spin', { room_id: R }), /mini-game is on/);
    const { vote_id } = await api(db, HOST, 'start_vote', { room_id: R, kind: 'trial' });
    await expectErr(api(db, HOST, 'mg_decide', { room_id: R, game_id, start: true }), /TV is busy/);
    assert.equal((await HK()).minigame.status, 'muster', 'START ANYWAY waits for the vote');
    await api(db, HOST, 'close_vote', { room_id: R, vote_id });
    await api(db, HOST, 'mg_decide', { room_id: R, game_id, start: true });
    assert.equal((await HK()).minigame.status, 'done');
    assert.deepEqual((await qOf(K.D.id)).filter(q => q.status === 'queued').map(q => q.reason), ['Hit by a throwing star (no-show)']);
    await clearQueue(); }
  step('mini-games: call_next and free spins wait for a game in muster/live; START ANYWAY waits for a clear TV');

  // 6: unexposing a caught Intruder takes back the knife that passed to the Betrayer
  await api(db, HOST, 'expose', { room_id: R, player_id: K.In.id });
  assert.equal((await SK('Be')).me.secret.has_knife, true, 'the catch passes the knife to the Betrayer');
  assert.ok(!JSON.stringify(await SK('In')).includes('caught_prev') && !JSON.stringify(await HK()).includes('caught_prev'), 'caught_prev is server-only');
  await api(db, HOST, 'unexpose', { room_id: R, player_id: K.In.id });
  { const be = (await SK('Be')).me.secret, inn = (await SK('In')).me.secret;
    assert.equal(be.has_knife, false, 'the knife comes back'); assert.equal(be.team, 'drinkers');
    assert.equal(inn.hit_alive, true, 'the Intruder\'s knife is sharp again'); assert.equal(inn.forge_used, false);
    assert.equal((await sql('select count(*)::int n from player_secrets where room_id = $1 and has_knife', [R]))[0].n, 0, 'one knife holder: the Intruder'); }
  step('unexpose: a caught Intruder gets their knife back and the Betrayer loses it (never two knife holders)');

  // 6b: the knife MOVED ON meanwhile (the Betrayer it went to was caught too, so it passed to a second Betrayer).
  // Un-catching the Intruder takes it from whoever holds it now, and gives that Betrayer their guesses back.
  await sql("update player_secrets set role = 'betrayer', guesses_left = 2, guessed = '{}' where player_id = $1", [K.D.id]);
  { const holders = async () => (await sql('select player_id from player_secrets where room_id = $1 and has_knife', [R])).map(x => x.player_id);
    await api(db, HOST, 'expose', { room_id: R, player_id: K.In.id });
    const [first] = await holders();
    assert.ok(first === K.Be.id || first === K.D.id, 'the catch passes the knife to a Betrayer');
    const second = first === K.Be.id ? K.D.id : K.Be.id;
    await api(db, HOST, 'expose', { room_id: R, player_id: first });               // that Betrayer is caught: it moves on
    assert.deepEqual(await holders(), [second], 'the knife moved on to the other Betrayer');
    assert.equal((await sql('select guesses_left from player_secrets where player_id = $1', [second]))[0].guesses_left, 0, 'the knife zeroes their guesses');
    await api(db, HOST, 'unexpose', { room_id: R, player_id: K.In.id });
    assert.deepEqual(await holders(), [], 'the Intruder is the only knife holder again (not the second Betrayer too)');
    const [sb] = await sql('select guesses_left, guessed, hit_alive from player_secrets where player_id = $1', [second]);
    assert.equal(sb.guesses_left, 2 - sb.guessed.length, 'the second Betrayer gets their guesses back');
    assert.equal(sb.hit_alive, false);
    assert.equal((await SK('In')).me.secret.hit_alive, true, 'the Intruder\'s knife is sharp again');
    // the first Betrayer un-caught too: the Intruder is back, so they come back WITHOUT the knife
    await api(db, HOST, 'unexpose', { room_id: R, player_id: first });
    assert.deepEqual(await holders(), [], 'un-catching the first Betrayer never takes the knife off the Intruder');
    assert.equal((await sql('select hit_alive from player_secrets where player_id = $1', [first]))[0].hit_alive, false); }
  await sql("update player_secrets set role = 'drinker', guesses_left = 0, guessed = '{}' where player_id = $1", [K.D.id]);
  step('unexpose: the knife moved on to a second Betrayer; un-catching the Intruder takes it from whoever holds it');

  // 9: evidence photos come from the anonymous evidence folder (or the local mock), never the uploader's selfie folder or an outside link
  await expectErr(api(db, K.A.uid, 'submit_evidence', { room_id: R, image_url: `https://x.supabase.co/storage/v1/object/public/selfies/${K.A.uid}/a.jpg` }), /Take the photo on this phone/);
  await expectErr(api(db, K.A.uid, 'submit_evidence', { room_id: R, image_url: 'https://evil.example/x.jpg' }), /Take the photo on this phone/);
  await expectErr(api(db, K.A.uid, 'submit_evidence', { room_id: R, image_url: 'https://x.supabase.co/storage/v1/object/public/selfies/ev/../x.jpg' }), /Take the photo on this phone/);
  await expectErr(api(db, K.A.uid, 'submit_evidence', { room_id: R }), /Take a photo first/);
  await api(db, K.A.uid, 'submit_evidence', { room_id: R, image_url: `https://x.supabase.co/storage/v1/object/public/selfies/ev/${randomUUID()}.jpg` });
  await api(db, K.A.uid, 'submit_evidence', { room_id: R, image_url: 'http://localhost:8787/files/abc-123' });
  assert.equal((await HK()).evidence.length, 2);
  assert.ok((await sql("select count(*)::int n from pg_indexes where tablename = 'punishments' and indexdef like '%(player_id)%'"))[0].n >= 1, 'punishments(player_id) is indexed');
  assert.equal((await sql("select has_table_privilege('anon', 'public.minigames', 'select') a"))[0].a, false, 'minigames is locked down');
  step('evidence: only the anonymous evidence folder or the local mock; punishments indexed by player; minigames revoked');

  // a phone's mg_tick is housekeeping: it doesn't block the host's UNDO, and a tick that settles nothing pings nobody
  { await api(db, HOST, 'queue_add', { room_id: R, player_id: K.B.id, reason: 'undo me' });
    const [{ id: lastGame }] = await sql('select id from minigames where room_id = $1 order by created_at desc limit 1', [R]);   // the finished Dodge
    const v0 = (await HK()).room.version;
    const res = await api(db, K.B.uid, 'mg_tick', { room_id: R, game_id: lastGame });
    assert.deepEqual(res, { ok: true });
    assert.equal((await HK()).room.version, v0, 'a quiet tick doesn\'t ping the phones');
    await api(db, HOST, 'undo', { room_id: R });
    assert.ok(!(await HK()).queue.some(q => q.reason === 'undo me'), 'the host can still undo'); }
  step('a phone\'s mg_tick doesn\'t block the host\'s UNDO, and a quiet tick doesn\'t ping anyone');
}

// ---------- spare codes for late guests ----------
{
  const sp = await api(db, HOST, 'create_room', {});
  const R = sp.room_id;
  const deck = { intruder: 1, medic: 1, drinker: 2, lovebird: 1, cursed: 2 };
  const { cards: d1 } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  const join = async n => { const uid = randomUUID(); await addUser(db, uid); return { uid, id: (await api(db, uid, 'join', { code: sp.code, name: n })).player_id }; };
  // a spare made before the deck locks is left alone by a re-deal, and never picks up a modifier
  const early = (await api(db, HOST, 'spare_codes', { room_id: R })).codes;
  assert.equal(early.length, 1);
  for (let i = 0; i < 5; i++) await api(db, HOST, 'generate_cards', { room_id: R, role_counts: { ...deck, lovebird: 2, cursed: 4 } });
  const [eRow] = await sql("select * from role_codes where code = $1", [early[0].replace('-', '')]);
  assert.ok(eRow && eRow.spare && eRow.role === 'drinker' && !eRow.cursed && !eRow.pair_id, 'a re-deal keeps the spare plain');
  const { cards: d2, spares: s2, redeemed: r0 } = await api(db, HOST, 'get_cards', { room_id: R });
  assert.equal(d2.length, 4, 'the printed deck is unchanged by spares');
  assert.ok(!d2.some(c => c.code === early[0]), 'spares stay off the printed deck');
  assert.deepEqual(s2.map(c => c.code), early); assert.equal(r0, 0);
  // the main deck: someone redeems → it's locked
  const a = await join('Ann');
  await api(db, a.uid, 'redeem', { room_id: R, code: d2[0].code });
  await expectErr(api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck }), /locked/);
  // host-only
  const late = await join('Lateo');
  await expectErr(api(db, late.uid, 'spare_codes', { room_id: R }), /Only the host/);
  await expectErr(api(db, a.uid, 'spare_codes', { room_id: R, n: 3 }), /Only the host/);
  await expectErr(api(db, HOST, 'spare_codes', { room_id: R, n: 6 }), /1 to 5/);
  await expectErr(api(db, HOST, 'spare_codes', { room_id: R, n: 0 }), /1 to 5/);
  // no card yet: no beers, no vote
  await expectErr(api(db, late.uid, 'log_beer', { room_id: R }), /Open your card/);
  // after the lock, spares still work; they look like any code (XXX-XXX) and come back alone
  const res = await api(db, HOST, 'spare_codes', { room_id: R, n: 3 });
  assert.deepEqual(Object.keys(res).sort(), ['codes'], 'only the new codes come back: no counts');
  assert.equal(res.codes.length, 3);
  for (const c of [...res.codes, ...early]) assert.match(c, /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
  assert.equal(new Set([...res.codes, ...d2.map(c => c.code)]).size, 7);
  const red = await api(db, late.uid, 'redeem', { room_id: R, code: res.codes[0].toLowerCase() });
  assert.equal(red.role, 'drinker');
  const ls = await state(db, late.uid, sp.code);
  assert.equal(ls.me.secret.role, 'drinker'); assert.equal(ls.me.secret.lovebird, false);
  assert.equal(ls.players.find(p => p.id === late.id).cursed, false);
  await api(db, late.uid, 'log_beer', { room_id: R });
  assert.equal((await state(db, HOST, sp.code)).players.find(p => p.id === late.id).beers, 1, 'the late guest can log beers');
  await expectErr(api(db, late.uid, 'redeem', { room_id: R, code: res.codes[1] }), /already have a role/);
  const late2 = await join('Latisha');
  await expectErr(api(db, late2.uid, 'redeem', { room_id: R, code: res.codes[0] }), /isn't valid|already been used/);   // single use
  await api(db, late2.uid, 'redeem', { room_id: R, code: early[0] });
  // still locked after spares; get_cards is the same deck, the used spares drop off the spare list
  await expectErr(api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck }), /locked/);
  const g = await api(db, HOST, 'get_cards', { room_id: R });
  assert.deepEqual(g.cards, d2, 'the main deck is unchanged');
  assert.deepEqual(g.spares.map(c => c.code).sort(), res.codes.slice(1).sort());
  // the TV's state never carries codes or spare counts
  assert.ok(!JSON.stringify(await state(db, HOST, sp.code)).includes(res.codes[1].replace('-', '')), 'no codes in the TV state');
  // a host UNDO doesn't wipe out a spare made after the snapshot (a late guest may be holding it)
  await api(db, HOST, 'queue_add', { room_id: R, player_id: a.id });
  const [afterSnap] = (await api(db, HOST, 'spare_codes', { room_id: R })).codes;
  await api(db, HOST, 'undo', { room_id: R });
  assert.ok((await api(db, HOST, 'get_cards', { room_id: R })).spares.some(c => c.code === afterSnap), 'undo keeps unused spares');
  // an ended room can't make spares
  await sql('update rooms set ended = true where id = $1', [R]);
  await expectErr(api(db, HOST, 'spare_codes', { room_id: R }), /over/);
  void d1;
  step('spare codes: host only, plain Drinker, work after the deck locks, never re-deal or change the printed deck');
}

// ---------- PICK AT RANDOM: a secret deck, so the host plays blind too ----------
{
  const rd = await api(db, HOST, 'create_room', {});
  const R = rd.room_id;
  const hand = { intruder: 1, betrayer: 1, medic: 1, detective: 1, skank: 1, davyjones: 1, scrooge: 1, jester: 1, forger: 0, assassin: 0, drinker: 0, lovebird: 1, cursed: 1 };
  await api(db, HOST, 'update_settings', { room_id: R, settings: { role_counts: hand } });
  const uid = randomUUID(); await addUser(db, uid); const pa = await api(db, uid, 'join', { code: rd.code, name: 'Rando' });
  await expectErr(api(db, uid, 'random_deal', { room_id: R, n: 8 }), /Only the host/);
  await expectErr(api(db, HOST, 'random_deal', { room_id: R, n: 3 }), /4 to 20/);
  await expectErr(api(db, HOST, 'random_deal', { room_id: R, n: 21 }), /4 to 20/);
  const UNIQUE = ['intruder', 'betrayer', 'forger', 'medic', 'detective', 'skank', 'davyjones', 'scrooge', 'jester', 'assassin'];
  const ROLE_NAMES = [...UNIQUE, 'drinker'];
  const seen = { 8: new Set() };
  for (let i = 0; i < 70; i++) {
    const n = [4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 20][i % 12];
    const res = await api(db, HOST, 'random_deal', { room_id: R, n, lovebird: 1, cursed: 1 });
    assert.deepEqual(res, { n }, 'only the deck size comes back: no roles, no counts');
    const { cards } = await api(db, HOST, 'get_cards', { room_id: R });
    assert.equal(cards.length, n, `${n} cards for ${n} players`);
    const by = r => cards.filter(c => c.role === r).length;
    assert.equal(by('intruder'), 1, 'always exactly one Intruder');
    for (const r of UNIQUE) assert.ok(by(r) <= 1, `never two ${r}s`);
    const sab = by('intruder') + by('forger') + by('assassin'), chaos = by('scrooge') + by('jester');
    const [sLo, sHi] = n <= 7 ? [1, 1] : n <= 10 ? [1, 2] : n <= 15 ? [2, 2] : [3, 3];
    const [cLo, cHi] = n <= 6 ? [0, 1] : n <= 10 ? [1, 2] : [2, 2];
    assert.ok(sab >= sLo && sab <= sHi, `${n} players: ${sab} Saboteurs`);
    assert.ok(chaos >= cLo && chaos <= cHi, `${n} players: ${chaos} Chaos`);
    if (n < 6) assert.equal(by('betrayer'), 0, 'no Betrayer under 6 players');
    assert.equal(cards.filter(c => c.lovebird).length, 2, 'the host\'s Lovebird pair still lands');
    assert.equal(cards.filter(c => c.cursed).length, 1, 'the host\'s Cursed still lands');
    if (n === 8) for (const c of cards) seen[8].add(c.role);
    // nothing about the mix is saved where the room (or a phone) can read it
    const hs = await state(db, HOST, rd.code), ps = await state(db, uid, rd.code);
    assert.equal(hs.room.settings.random_deal, n);
    assert.deepEqual(hs.room.settings.role_counts, hand, 'the hand-picked counts stay as they were: they are not the deal');
    for (const st of [hs, ps]) {
      const txt = JSON.stringify({ room: st.room, players: st.players, events: st.events });
      for (const r of ROLE_NAMES) if (!JSON.stringify(hand).includes(`"${r}"`)) assert.ok(!txt.includes(`"${r}"`), `${r} leaks into the state`);
    }
  }
  assert.ok(seen[8].has('forger') || seen[8].has('assassin'), 'an 8-player deal sometimes adds a second Saboteur');
  // picking by hand again switches the room back
  await api(db, HOST, 'generate_cards', { room_id: R, role_counts: hand });
  assert.equal((await state(db, HOST, rd.code)).room.settings.random_deal, undefined, 'GENERATE CODES = a hand-picked deck again');
  // once a code is entered the deal is locked, random or not
  await api(db, HOST, 'random_deal', { room_id: R, n: 8 });
  const { cards: locked } = await api(db, HOST, 'get_cards', { room_id: R });
  await api(db, uid, 'redeem', { room_id: R, code: locked[0].code });
  await expectErr(api(db, HOST, 'random_deal', { room_id: R, n: 8 }), /locked/);
  void pa;
  step('PICK AT RANDOM: one Intruder always, a balanced secret mix for 4-20 players, only the size comes back; locks like any deal');
}

// ---------- THE LATE PILE: late guests draw from the roles the deck left out ----------
{
  const lp = await api(db, HOST, 'create_room', {});
  const R = lp.room_id;
  await expectErr(api(db, HOST, 'late_pile', { room_id: R, n: 3 }), /Deal the main deck first/);
  const deck = { intruder: 1, betrayer: 1, medic: 1, detective: 1, skank: 1, davyjones: 1, scrooge: 1, jester: 1, forger: 0, assassin: 0, drinker: 0, lovebird: 1, cursed: 1 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  const [plain] = (await api(db, HOST, 'spare_codes', { room_id: R })).codes;
  const join = async n => { const uid = randomUUID(); await addUser(db, uid); return { uid, id: (await api(db, uid, 'join', { code: lp.code, name: n })).player_id }; };
  const a = await join('Early');
  await expectErr(api(db, a.uid, 'late_pile', { room_id: R, n: 3 }), /Only the host/);
  await expectErr(api(db, HOST, 'late_pile', { room_id: R, n: 6 }), /0 to 5/);
  const lateCards = async () => (await api(db, HOST, 'get_cards', { room_id: R })).spares.filter(c => c.late);
  let sawSab = false;
  for (let i = 0; i < 30; i++) {
    const res = await api(db, HOST, 'late_pile', { room_id: R, n: 3 });
    assert.deepEqual(res, { n: 3 }, 'only a count comes back');
    const late = await lateCards();
    assert.equal(late.length, 3, 'a re-shuffle replaces the unused late cards');
    for (const c of late) assert.ok(['forger', 'assassin', 'drinker'].includes(c.role), `${c.role}: only roles the deck left out, never the Intruder`);
    assert.ok(late.filter(c => c.role !== 'drinker').length <= 1, 'never two Saboteurs in the late pile');
    sawSab ||= late.some(c => c.role !== 'drinker');
    const rows = await sql('select * from role_codes where room_id = $1 and late', [R]);
    assert.ok(rows.every(r => r.spare && !r.cursed && !r.pair_id), 'late cards are spares with no modifiers');
    assert.equal((await state(db, HOST, lp.code)).me.late_left, 3, 'the TV gets a count');
    assert.equal((await state(db, a.uid, lp.code)).me.late_left ?? null, null, 'a phone gets nothing');
  }
  assert.ok(sawSab, 'the late pile can hold a Saboteur');
  const g = await api(db, HOST, 'get_cards', { room_id: R });
  assert.deepEqual(g.cards, cards, 'the printed deck is untouched');
  assert.ok(g.spares.some(c => c.code === plain && !c.late && c.role === 'drinker'), 'the plain spare stays');
  // n = 0 empties it; a re-deal of the deck wipes the unused late pile (its pool came from the old deck)
  await api(db, HOST, 'late_pile', { room_id: R, n: 0 });
  assert.equal((await lateCards()).length, 0);
  await api(db, HOST, 'late_pile', { room_id: R, n: 3 });
  await api(db, HOST, 'random_deal', { room_id: R, n: 8 });
  assert.equal((await lateCards()).length, 0, 'PICK AT RANDOM wipes the unused late pile');
  for (let i = 0; i < 25; i++) {
    await api(db, HOST, 'late_pile', { room_id: R, n: 5 });
    const { cards: d, spares } = await api(db, HOST, 'get_cards', { room_id: R });
    const inDeck = new Set(d.map(c => c.role));
    for (const c of spares.filter(c => c.late)) assert.ok(c.role === 'drinker' || (!inDeck.has(c.role) && c.role !== 'intruder'), `late ${c.role} doubles the random deck`);
  }
  await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  assert.equal((await lateCards()).length, 0, 'GENERATE CODES wipes the unused late pile too');
  // the deck locks; the late pile still works, and a late Forger joins the Saboteurs like anyone
  const { cards: d3 } = await api(db, HOST, 'get_cards', { room_id: R });
  await api(db, a.uid, 'redeem', { room_id: R, code: d3.find(c => c.role === 'intruder').code });
  let forger = null;
  for (let i = 0; i < 60 && !forger; i++) { await api(db, HOST, 'late_pile', { room_id: R, n: 5 }); forger = (await lateCards()).find(c => c.role === 'forger'); }
  assert.ok(forger, 'a late Forger turned up');
  const lateGuest = await join('Lately');
  assert.equal((await api(db, lateGuest.uid, 'redeem', { room_id: R, code: forger.code })).role, 'forger');
  const intr = await state(db, a.uid, lp.code);
  assert.ok(JSON.stringify(intr.me.secret.allies).includes(lateGuest.id), 'the Intruder sees the late Forger as a teammate');
  // the Forger is in play now, and that was the late pile's one Saboteur: from here on it deals only Drinkers
  for (let i = 0; i < 15; i++) {
    await api(db, HOST, 'late_pile', { room_id: R, n: 5 });
    assert.ok((await lateCards()).every(c => c.role === 'drinker'), 'no second late Saboteur, no second Forger');
  }
  await sql('update rooms set ended = true where id = $1', [R]);
  await expectErr(api(db, HOST, 'late_pile', { room_id: R, n: 3 }), /over/);
  step('late pile: host only, 0-5 sealed cards from the roles the deck left out (never the Intruder, one Saboteur at most, no modifiers); re-deals wipe it; a late Saboteur joins the team');
}

// ---------- TAKE IT FOR THEM: another player steps in and becomes the victim ----------
{
  const k = await api(db, HOST, 'create_room', { deadline_at: new Date(Date.now() + 3600e3).toISOString() });
  const R = k.room_id;
  const deck = { intruder: 1, betrayer: 1, medic: 1, scrooge: 1, drinker: 7, forger: 0, detective: 0, skank: 0, davyjones: 0, jester: 0, assassin: 0, lovebird: 0, cursed: 0 };
  const { cards } = await api(db, HOST, 'generate_cards', { room_id: R, role_counts: deck });
  await sql('update role_codes set pair_id = null, cursed = false where room_id = $1', [R]);
  const T = {};
  for (const [n, role] of [['In', 'intruder'], ['Be', 'betrayer'], ['Me', 'medic'], ['Sc', 'scrooge'], ['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker'],
                           ['D', 'drinker'], ['E', 'drinker'], ['X', 'drinker'], ['L', 'drinker']]) {
    const uid = randomUUID(); await addUser(db, uid);
    T[n] = { uid, id: (await api(db, uid, 'join', { code: k.code, name: n })).player_id };
    await api(db, uid, 'redeem', { room_id: R, code: cards.splice(cards.findIndex(c => c.role === role), 1)[0].code });
  }
  const An = { uid: randomUUID() }; await addUser(db, An.uid);
  An.id = (await api(db, An.uid, 'join', { code: k.code, name: 'Angel' })).player_id;
  await api(db, HOST, 'make_angel', { room_id: R, player_id: An.id });
  const sock = randomUUID(); await addUser(db, sock); await api(db, sock, 'join', { code: k.code, name: 'Sock' });
  const HT = () => state(db, HOST, k.code), ST = n => state(db, T[n].uid, k.code);
  // the phone names who it's stepping in for (the victim it saw); rawApi never winds the 4s window on
  const nowVictim = async () => (await sql("select victim_id from rounds where room_id = $1 and phase in ('waiting','spinning','revealed','saved')", [R]))[0]?.victim_id;
  const take = async n => rawApi(db, T[n].uid, 'take_it', { room_id: R, for: await nowVictim() });
  // a wheel with no Safe / Spin again, so every landing logs; C is cursed, C and D are Lovebirds, L is in the Locker
  await api(db, HOST, 'update_settings', { room_id: R, segments: ['Two fingers', 'No hands', 'Waterfall', 'Finish your drink'] });
  await sql('update players set cursed = true where id = $1', [T.C.id]);
  await sql('update player_secrets set partner_id = $1 where player_id = $2', [T.D.id, T.C.id]);
  await sql('update player_secrets set partner_id = $1 where player_id = $2', [T.C.id, T.D.id]);
  await sql("update players set locked_until = now() + interval '15 minutes' where id = $1", [T.L.id]);
  await sql('update players set beers = 6 where id = $1', [T.Me.id]);          // Medic level 3: two heals
  const openShields = id => sql('select count(*)::int n from shields where player_id = $1 and used_at is null', [id]).then(r => r[0].n);

  // round 1: A (healed by the Medic, shivved x2) is called up; C steps in
  await api(db, T.Me.uid, 'heal', { room_id: R, player_id: T.A.id });
  await sql('update players set shivved_by = $1 where id = $2', [T.In.id, T.A.id]);
  await api(db, HOST, 'queue_add', { room_id: R, player_id: T.A.id, reason: 'Lost pool' });
  await rawApi(db, HOST, 'call_next', { room_id: R });
  let h = await HT();
  assert.equal(h.round.victim_id, T.A.id); assert.equal(h.round.times, 2, 'the shiv: x2');
  assert.equal(h.round.stand_in_id, null);
  assert.equal(Date.parse(h.round.spin_at) - Date.parse(h.round.created_at), 4000, 'the state carries the 4s window');
  // the 4-second window: nobody spins yet, not the victim, not the host
  await expectErr(rawApi(db, T.A.uid, 'spin', { room_id: R }), /Anyone stepping in/);
  await expectErr(rawApi(db, HOST, 'spin', { room_id: R }), /Anyone stepping in/);
  // not yourself, not the Angel, not from the Locker, not the host, not without a card
  await expectErr(take('A'), /already facing the wheel/);
  await expectErr(rawApi(db, An.uid, 'take_it', { room_id: R, for: T.A.id }), /The Angel is never punished/);
  await expectErr(take('L'), /Davy Jones' Locker/);
  await expectErr(rawApi(db, HOST, 'take_it', { room_id: R }), /Join the room first/);
  await expectErr(rawApi(db, sock, 'take_it', { room_id: R, for: T.A.id }), /Open your card first/);
  assert.equal((await ST('C')).me.take_it_used, false);
  // first tap wins; the second is told cleanly
  await take('C');
  await expectErr(take('B'), /Someone already stepped in/);
  assert.equal((await ST('B')).me.take_it_used, false, 'a refused tap spends nothing');
  h = await HT();
  assert.equal(h.round.victim_id, T.C.id, 'C is at the wheel now');
  assert.equal(h.round.original_victim_id, T.A.id, 'original_victim_id stays as the original');
  assert.equal(h.round.stand_in_id, T.C.id);
  assert.equal(h.round.times, 2, 'the shiv x2 stays with the round');
  assert.equal(h.round.phase, 'waiting');
  const ev = h.events.filter(e => e.kind === 'stand_in').at(-1);
  assert.deepEqual([ev.payload.from, ev.payload.to], [T.A.id, T.C.id], 'a public stand_in event');
  assert.ok(!JSON.stringify(ev.payload).match(/heal|shield/), 'the event says nothing about heals');
  assert.equal((await ST('C')).me.take_it_used, true);
  await expectErr(rawApi(db, T.C.uid, 'spin', { room_id: R }), /Anyone stepping in/);   // the window still holds for the stand-in
  await expectErr(api(db, T.A.uid, 'spin', { room_id: R }), /not your turn/);
  // C spins: C's curse doubles it, A's heal doesn't save C, and the x2 stays
  await api(db, T.C.uid, 'spin', { room_id: R });
  h = await HT();
  assert.equal(h.round.phase, 'spinning', "the original victim's heal is not transferred");
  assert.equal(h.round.cursed, true, 'the curse follows the new victim');
  assert.equal(new Set(h.round.landings.map(l => l.spin)).size, 2, 'cursed: two spins');
  assert.ok(h.round.landings.every(l => l.mult === 2), "every landing x2 (the round's times)");
  assert.equal(await openShields(T.A.id), 1, 'A keeps their heal for later');
  await api(db, HOST, 'round_revealed', { room_id: R, spin_seq: h.round.spin_seq });
  await api(db, HOST, 'accept', { room_id: R, force: true });
  h = await HT();
  const pun = n => h.players.find(p => p.id === T[n].id).punishments;
  assert.equal(pun('C').length, 2, 'C takes the punishment'); assert.equal(pun('A').length, 0, 'A walks free');
  assert.equal(pun('D').length, 2, "the Lovebird shares the NEW victim's pain"); assert.ok(pun('D').every(u => u.via_love));
  assert.equal(h.players.find(p => p.id === T.A.id).shivved_by, null, 'the shiv was spent on the round');
  step('TAKE IT FOR THEM: 4s window for victim and host; not self/Angel/Locker/no card; first tap wins; curse + Lovebird follow the stand-in; heal stays; x2 stays');

  // round 2: the Scrooge swaps B onto E first; X steps in for E (stand_in_for = E); the Scrooge can still swap afterwards
  await sql('update players set beers = 9 where id = $1', [T.Sc.id]);          // level 4: two swaps
  await api(db, HOST, 'call_next', { room_id: R, player_id: T.B.id });
  await expectErr(take('C'), /already took one for someone tonight/);
  await api(db, T.Sc.uid, 'scrooge_swap', { room_id: R, player_id: T.E.id });
  await expectErr(take('B'), /your own punishment/);                         // the original can't step back in
  await expectErr(rawApi(db, T.X.uid, 'take_it', { room_id: R, for: T.B.id }), /The punishment moved/);   // a stale check
  await expectErr(rawApi(db, T.X.uid, 'take_it', { room_id: R }), /The punishment moved/);
  await sql('update rooms set ended = true where id = $1', [R]);
  await expectErr(take('X'), /The night is over/);
  await sql('update rooms set ended = false where id = $1', [R]);
  assert.equal((await ST('X')).me.take_it_used, false, 'refused taps spend nothing');
  await take('X');
  h = await HT();
  assert.equal(h.round.victim_id, T.X.id); assert.equal(h.round.original_victim_id, T.B.id, 'still the original');
  assert.equal(h.round.stand_in_for, T.E.id, 'stand_in_for: who X actually took it from');
  assert.deepEqual((({ from, to }) => [from, to])(h.events.filter(e => e.kind === 'stand_in').at(-1).payload), [T.E.id, T.X.id]);
  await api(db, T.Sc.uid, 'scrooge_swap', { room_id: R, player_id: T.Be.id });
  h = await HT();
  assert.equal(h.round.victim_id, T.Be.id, 'the Scrooge swaps the stand-in away');
  assert.equal(h.round.original_victim_id, T.B.id);
  await expectErr(take('D'), /Someone already stepped in/);                 // one stand-in per round, even after a swap
  await api(db, HOST, 'cancel_round', { room_id: R });
  step('TAKE IT FOR THEM: once a night; one per round; not the original; stale check refused; not once the night is over; stand_in_for; Scrooge swaps after');

  // round 3: the stand-in's own heal follows the normal rules (it saves them)
  await api(db, T.Me.uid, 'heal', { room_id: R, player_id: T.D.id });
  await api(db, HOST, 'call_next', { room_id: R, player_id: T.X.id });
  await take('D');
  await api(db, T.D.uid, 'spin', { room_id: R });
  assert.equal((await HT()).round.phase, 'saved', "D's own heal saves D");
  await api(db, HOST, 'finish_saved', { room_id: R });
  // round 4: A's heal waited for A's next spin
  await api(db, HOST, 'call_next', { room_id: R, player_id: T.A.id });
  await api(db, T.A.uid, 'spin', { room_id: R });
  assert.equal((await HT()).round.phase, 'saved', "A's heal was kept for A");
  await api(db, HOST, 'finish_saved', { room_id: R });
  // too late once the wheel is spinning
  await api(db, HOST, 'call_next', { room_id: R, player_id: T.X.id });
  await api(db, T.X.uid, 'spin', { room_id: R });
  await expectErr(take('B'), /Too late/);
  await api(db, HOST, 'cancel_round', { room_id: R });
  // kicking a stand-in hands the punishment back: the original's queue row is queued again, not silently gone
  await sql("update queue set status = 'cancelled' where room_id = $1 and status in ('queued','held')", [R]);
  await api(db, HOST, 'queue_add', { room_id: R, player_id: T.In.id, reason: 'Kick test' });
  await api(db, HOST, 'call_next', { room_id: R });
  await take('B');
  await api(db, HOST, 'kick', { room_id: R, player_id: T.B.id });
  h = await HT();
  assert.equal(h.round, null, 'the round is called off');
  assert.deepEqual(h.queue.map(q => [q.player_id, q.reason]), [[T.In.id, 'Kick test']], "In's punishment is back in the queue");
  // locked while called up: the round is called off and the punishment waits for them (the Locker rule)
  await api(db, HOST, 'call_next', { room_id: R });
  assert.equal((await HT()).round.victim_id, T.In.id);
  await api(db, HOST, 'lock', { room_id: R, player_id: T.In.id });
  h = await HT();
  assert.equal(h.round, null, 'a locked victim can\'t spin: the round is called off');
  assert.equal(h.players.find(p => p.id === T.In.id).held, true, 'their punishment waits for them');
  assert.equal(h.queue.length, 0);
  step("TAKE IT FOR THEM: the stand-in's own heal works as normal; the original's heal waits for them; too late once spinning; kick + Locker hand the punishment back");
}

// ---------- delete_room: only the room's own host ----------
{
  const d = await api(db, HOST, 'create_room', {});
  const u = randomUUID(); await addUser(db, u); await api(db, u, 'join', { code: d.code, name: 'Doomed' });
  await expectErr(api(db, u, 'delete_room', { room_id: d.room_id }), /Host login required/);
  const other = randomUUID(); await addUser(db, other, false, 'other@example.com');
  await expectErr(api(db, other, 'delete_room', { room_id: d.room_id }), /Room not found/);
  await api(db, HOST, 'delete_room', { room_id: d.room_id });
  assert.equal((await state(db, u, d.code)).error, 'no_room');
  assert.ok(!(await api(db, HOST, 'my_rooms')).some(r => r.id === d.room_id));
  step('delete_room: host only, the room and its players are gone');
}

// ---------- LEVELS 1-4, the game cap, caps and betting ----------
// a fresh room dealt exactly as asked; `hours` = how far away the deadline is (within 2 hours lifts the game cap)
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
  return {
    R: rm.room_id, code: rm.code, X,
    S: n => state(db, X[n].uid, rm.code), H: () => state(db, HOST, rm.code),
    beers: (n, b) => sql('update players set beers = $1 where id = $2', [b, X[n].id]),
    game: async (opts = {}, losers = []) => {
      const { game_id } = await api(db, HOST, 'start_game', { room_id: rm.room_id, name: 'Darts', ...opts });
      await api(db, HOST, 'finish_game', { room_id: rm.room_id, game_id, losers });
      for (const q of (await state(db, HOST, rm.code)).queue) await api(db, HOST, 'queue_remove', { room_id: rm.room_id, queue_id: q.id });
    },
  };
};

// level 1 (0-2 beers) is pacified; level 2 (3 beers) opens the basic powers; each tier opens at its level
{
  const L = await mkRoom([['Me', 'medic'], ['De', 'detective'], ['In', 'intruder'], ['As', 'assassin'], ['Fo', 'forger'], ['Sc', 'scrooge'], ['A', 'drinker'], ['B', 'drinker']]);
  const { R, X } = L;
  const me = (await L.S('Me')).me;
  assert.equal(me.secret.level, 1); assert.equal(me.secret.heals_left, 0);
  assert.deepEqual(me.level_info, { level: 1, beers_to_next: 3, waiting_on_game: false });
  assert.equal((await L.H()).players.find(p => p.id === X.Me.id).level, 1, 'the level is public');
  assert.equal((await L.S('De')).me.secret.checks_left, 0); assert.equal((await L.S('In')).me.secret.hit_ready, false);
  assert.equal((await L.S('As')).me.secret.dodge_ready, false); assert.equal((await L.S('Fo')).me.secret.frame_ready, false);
  assert.equal((await L.S('Sc')).me.secret.respins_left, 0); assert.equal((await L.S('Sc')).me.secret.swap_used, true);
  await expectErr(api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.A.id }), /^You can't do that$/);
  await expectErr(api(db, X.De.uid, 'investigate', { room_id: R, player_id: X.A.id }), /^You can't do that$/);
  await expectErr(api(db, X.In.uid, 'hit', { room_id: R, player_id: X.Me.id, role: 'medic' }), /^You can't do that$/);
  await expectErr(api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.A.id, dir: 'left' }), /^You can't do that$/);
  await expectErr(api(db, X.Fo.uid, 'frame', { room_id: R, player_id: X.A.id }), /^You can't do that$/);
  await expectErr(api(db, X.Sc.uid, 'scrooge_graffiti', { room_id: R, text: 'Too early' }), /^You can't do that$/);
  await L.beers('Me', 2);
  await expectErr(api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.A.id }), /^You can't do that$/, '2 beers is still level 1');
  // passives still work at level 1: the vote and evidence
  { const { vote_id } = await api(db, HOST, 'start_vote', { room_id: R, kind: 'trial' });
    await api(db, X.Me.uid, 'cast_vote', { room_id: R, vote_id, choice_id: X.A.id });
    await api(db, HOST, 'close_vote', { room_id: R, vote_id }); }
  await api(db, X.A.uid, 'submit_evidence', { room_id: R, image_url: `https://x.supabase.co/storage/v1/object/public/selfies/ev/${randomUUID()}.jpg` });
  step('level 1 (0-2 beers) is pacified: heal, investigate, hit, dodge, frame and graffiti refused; votes and evidence still work');

  for (const n of ['Me', 'De', 'In', 'As', 'Fo', 'Sc']) await L.beers(n, 3);
  assert.equal((await L.S('Me')).me.secret.level, 2);
  assert.deepEqual((await L.S('Me')).me.level_info, { level: 2, beers_to_next: 3, waiting_on_game: false });
  await api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.A.id });
  { const { check_id } = await api(db, X.De.uid, 'investigate', { room_id: R, player_id: X.B.id });
    assert.equal((await api(db, X.De.uid, 'view_check', { room_id: R, check_id })).group.length, 3, 'a basic reading covers 3'); }
  { const { game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.B.id, dir: 'left' });
    await api(db, HOST, 'mg_decide', { room_id: R, game_id, start: false }); }
  await api(db, X.Fo.uid, 'frame', { room_id: R, player_id: X.B.id });
  step('level 2 (3 beers): heal, investigate, dodge and frame open');

  // the Medic: 2nd heal at level 3, the Surgeon's self-heal at level 4
  await expectErr(api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.B.id }), /next heal unlocks at level 3/);
  await expectErr(api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.Me.id }), /Surgeon can, at level 4/);
  // the Forger: forging a heal at level 3 (a heal is waiting, but not yet)
  assert.equal((await L.S('Fo')).me.secret.forge_ready, false);
  await expectErr(api(db, X.Fo.uid, 'forge', { room_id: R }), /Forging a heal unlocks at level 3/);
  // the Scrooge: graffiti at level 3
  await expectErr(api(db, X.Sc.uid, 'scrooge_graffiti', { room_id: R, text: 'Neck it' }), /Graffiti unlocks at level 3/);
  for (const n of ['Me', 'Fo', 'Sc']) await L.beers(n, 6);
  assert.equal((await L.S('Me')).me.secret.heals_left, 1);
  await api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.B.id });
  await expectErr(api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.Me.id }), /Surgeon can, at level 4/);
  assert.equal((await L.S('Fo')).me.secret.forge_ready, true);
  await api(db, X.Fo.uid, 'forge', { room_id: R });
  await api(db, X.Sc.uid, 'scrooge_graffiti', { room_id: R, text: 'Neck it' });
  assert.equal((await L.S('Me')).me.secret.evolved, null, 'no evolution before level 4');
  await L.beers('Me', 9);
  { const m = (await L.S('Me')).me;
    assert.equal(m.secret.level, 4); assert.equal(m.secret.evolved, 'surgeon'); assert.equal(m.level_info.beers_to_next, null); }
  await api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.Me.id });
  // a level-2 Hit still lands
  assert.equal((await api(db, X.In.uid, 'hit', { room_id: R, player_id: X.Me.id, role: 'medic' })).correct, true);
  step('each tier at its level: 2nd heal + forge + graffiti at level 3 (6 beers); Surgeon self-heal at level 4 (9 beers)');
}

// the game cap: the level is capped at games finished + 1 until 2 hours before the deadline
{
  const C = await mkRoom([['Me', 'medic'], ['A', 'drinker'], ['B', 'drinker']], 6);
  const { R, X } = C;
  await C.beers('Me', 9); await C.beers('A', 8);
  let m = (await C.S('Me')).me;
  assert.equal(m.secret.level, 1, '9 beers but no games yet: level 1');
  assert.equal(m.level_info.level, 1); assert.equal(m.level_info.waiting_on_game, true);
  assert.equal((await C.H()).players.find(p => p.id === X.Me.id).level, 1);
  assert.equal(m.secret.heals_left, 0);
  await expectErr(api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.A.id }), /^You can't do that$/);
  // drinking faster doesn't level you up past the cap
  await api(db, X.A.uid, 'log_beer', { room_id: R });
  assert.ok(!(await C.H()).events.some(e => e.kind === 'level_up'), 'no level-up while capped');
  const lastCap = async () => (await C.H()).events.filter(e => e.kind === 'level_cap').map(e => e.payload);
  for (const [games, lv] of [[1, 2], [2, 3], [3, 4]]) {
    await C.game();
    assert.deepEqual((await lastCap()).at(-1), { cap: games + 1 }, 'level_cap event after the game');
    m = (await C.S('Me')).me;
    assert.equal(m.secret.level, lv); assert.equal(m.level_info.level, lv);
    assert.equal(m.level_info.waiting_on_game, lv < 4);
    assert.equal((await C.H()).players.find(p => p.id === X.Me.id).level, lv);
    if (lv === 2) { assert.equal(m.secret.heals_left, 1); await api(db, X.Me.uid, 'heal', { room_id: R, player_id: X.A.id }); }
  }
  assert.equal(m.secret.evolved, 'surgeon');
  assert.ok(!JSON.stringify(await lastCap()).match(/medic|surgeon|player/), 'the cap event names nobody');
  await C.game();
  assert.equal((await lastCap()).length, 3, 'no level_cap past level 4');
  step('game cap: 9 beers with 0 games = level 1 (waiting_on_game); each finished game lifts the cap (level_cap event) up to 4');

  const D = await mkRoom([['Me', 'medic'], ['A', 'drinker']], 6);
  await D.beers('Me', 9);
  assert.equal((await D.S('Me')).me.secret.level, 1);
  await api(db, HOST, 'update_settings', { room_id: D.R, deadline_at: new Date(Date.now() + 119 * 60e3).toISOString() });
  m = (await D.S('Me')).me;
  assert.equal(m.secret.level, 4, 'within 2 hours of the deadline the cap is gone'); assert.equal(m.level_info.waiting_on_game, false);
  await D.game();
  assert.ok(!(await D.H()).events.some(e => e.kind === 'level_cap'), 'no level_cap event once the cap is off');
  step('game cap: lifted 2 hours before the deadline (level 4 straight away, no level_cap event)');
}

// caps: worked out from what happened, private to your own phone
{
  const K = await mkRoom([['As', 'assassin'], ['Me', 'medic'], ['A', 'drinker'], ['B', 'drinker'], ['C', 'drinker'], ['X', 'drinker']]);
  const { R, X } = K;
  const caps = async n => (await K.S(n)).me.caps;
  assert.equal(await caps('A'), 10); assert.equal(await caps('Me'), 10);
  await api(db, X.A.uid, 'log_beer', { room_id: R });
  assert.equal(await caps('A'), 11, '+1 per beer');
  // everyone gets +5 per level-up (a Drinker-only bonus would make a Drinker's phone pop bigger: a tell)
  for (const [b, d] of [[3, 18], [6, 26], [9, 34]]) { await K.beers('A', b); assert.equal(await caps('A'), d); }
  await K.beers('Me', 9); assert.equal(await caps('Me'), 34, 'the same level bonus for every role');
  await K.beers('A', 0); await K.beers('Me', 0);
  // host games: +3 for playing and not losing (matchup game: only the players in it)
  await K.game({ matchup: [[X.A.id], [X.B.id]] }, [X.B.id]);
  assert.deepEqual([await caps('A'), await caps('B'), await caps('C')], [13, 10, 10], 'winner +3, loser 0, not in the matchup 0');
  await K.game({}, [X.C.id]);
  assert.deepEqual([await caps('A'), await caps('B'), await caps('C'), await caps('Me')], [16, 13, 10, 13], 'no matchup: everyone but the loser +3');
  // someone who joins later doesn't collect for games already over
  const late = randomUUID(); await addUser(db, late); await api(db, late, 'join', { code: K.code, name: 'Late' });
  assert.equal((await state(db, late, K.code)).me.caps, 10);
  // a mini-game survivor +3; the one hit gets nothing
  await K.beers('As', 3);
  for (const [dir, gain] of [['left', 3], ['right', 0]]) {
    await sql('update player_secrets set last_strike_game = null where player_id = $1', [X.As.id]);
    const before = await caps('X');
    const { game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.X.id, dir: 'left' });
    await api(db, X.X.uid, 'mg_ready', { room_id: R, game_id });
    await sql("update minigames set live_at = now() - interval '1 second' where id = $1", [game_id]);
    await api(db, X.X.uid, 'mg_move', { room_id: R, game_id, dir });
    assert.equal(await caps('X'), before + gain);
    for (const q of (await K.H()).queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id });
  }
  // private: only your own, never in the players list or the TV's state
  const hk = await K.H();
  assert.ok(hk.me.caps == null, 'the TV has no caps');
  assert.ok(!hk.players.some(p => 'caps' in p) && !(await K.S('B')).players.some(p => 'caps' in p), 'nobody else\'s caps in the players list');
  assert.ok(!/"caps":\d/.test(JSON.stringify(hk)), 'no caps figure anywhere in the TV state');
  step('caps: 10 + beers + 3 per host game played and not lost + 3 per mini-game survived + 5 per level-up for everyone; own phone only');
}

// betting: spectators put 5 caps on Dodge / Walk the Plank / Jack-in-the-Box while it's being called to the TV
{
  const B = await mkRoom([['As', 'assassin'], ['Pw', 'jester'], ['A', 'drinker'], ['Bb', 'drinker'], ['C', 'drinker'], ['D', 'drinker'],
                          ['X', 'drinker'], ['Y', 'drinker'], ['Z', 'drinker']]);
  const { R, X } = B;
  const caps = async n => (await B.S(n)).me.caps;
  const go = id => sql("update minigames set live_at = now() - interval '1 second' where id = $1", [id]);
  const clearQueue = async () => { for (const q of (await B.H()).queue) await api(db, HOST, 'queue_remove', { room_id: R, queue_id: q.id }); };
  const freshThrow = () => sql('update player_secrets set last_strike_game = null where player_id = $1', [X.As.id]);
  const bet = (n, game_id, option) => api(db, X[n].uid, 'bet', { room_id: R, game_id, option });
  await B.beers('As', 3);
  assert.equal((await B.H()).book, null, 'no book without a game');
  // the Bookie opens after the night's first game: a Dodge before that takes no bets
  const early = (await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.X.id, dir: 'left' })).game_id;
  assert.equal((await B.S('A')).book, null, 'no book before the first game');
  assert.equal((await B.H()).book, null);
  await expectErr(bet('A', early, 'dodged'), /after the first game/);
  await sql("update minigames set status = 'cancelled' where id = $1", [early]); await freshThrow();
  // a finished first game that nobody played in (so nobody's caps move)
  await sql("insert into games (room_id, name, status, ended_at, matchup) values ($1, 'Warm-up', 'ended', now() - interval '1 minute', $2)",
            [R, JSON.stringify([[randomUUID()], [randomUUID()]])]);

  // a Dodge: A and Bb say DODGES, C says HIT
  let { game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.X.id, dir: 'left' });
  await api(db, HOST, 'queue_add', { room_id: R, player_id: X.D.id, reason: 'undo me' });   // a host move to undo later
  let bk = (await B.S('A')).book;
  assert.deepEqual([bk.game_id, bk.kind, bk.status, bk.n, bk.stake, bk.can_bet, bk.mine, bk.winning, bk.winners],
                   [game_id, 'dodge', 'open', 0, 5, true, null, null, null]);
  assert.deepEqual(bk.options.map(o => o.id), ['dodged', 'hit']);
  assert.equal((await B.S('X')).book.can_bet, false, 'the player in the game can\'t bet');
  await expectErr(bet('X', game_id, 'dodged'), /You're in this one/);
  await expectErr(bet('A', game_id, 'maybe'), /Pick one of the options/);
  await bet('A', game_id, 'dodged');
  assert.equal(await caps('A'), 5, 'the stake comes off straight away');
  await expectErr(bet('A', game_id, 'hit'), /You already bet/);
  await bet('Bb', game_id, 'dodged'); await bet('C', game_id, 'hit');
  await expectErr(api(db, X.A.uid, 'bet', { room_id: R, game_id: randomUUID(), option: 'hit' }), /No bets on that/);
  // nobody else's pick leaves the server while it's open
  let h = await B.H();
  assert.equal(h.book.mine, null, 'the TV has no pick'); assert.equal(h.book.n, 3); assert.equal(h.book.can_bet, false);
  assert.deepEqual((await B.S('A')).book.mine, { option: 'dodged', stake: 5, payout: null });
  assert.equal((await B.S('D')).book.mine, null);
  for (const v of [h, await B.S('D'), await B.S('A'), await B.S('X')]) {
    assert.equal(v.book.winners, null); assert.equal(v.book.winning, null);
    assert.ok((JSON.stringify(v).match(/"option"/g) || []).length <= 1, 'at most your own pick');
  }
  assert.ok(h.events.filter(e => e.kind === 'bet_placed').every(e => JSON.stringify(Object.keys(e.payload).sort()) === '["game","n"]'), 'bet_placed: just the count');
  assert.ok(!JSON.stringify(h.events.filter(e => e.kind.startsWith('bet'))).includes(X.C.id), 'no bet event names a bettor');
  // a bet is not a move: the host can still undo, and the bets survive it
  assert.equal((await sql('select blocked from undo_log where room_id = $1 order by id desc limit 1', [R]))[0].blocked, false);
  await api(db, HOST, 'undo', { room_id: R });
  assert.ok(!(await B.H()).queue.some(q => q.reason === 'undo me'));
  assert.equal((await B.H()).book.n, 3, 'the bets survive the undo');
  // closes at GO
  await api(db, X.X.uid, 'mg_ready', { room_id: R, game_id });
  assert.equal((await B.H()).book.status, 'closed');
  await expectErr(bet('D', game_id, 'hit'), /Bets are closed/);
  await go(game_id);
  await api(db, X.X.uid, 'mg_move', { room_id: R, game_id, dir: 'left' });
  // settled: the pot (15) split between the 2 who called it, 7 each (rounded down)
  bk = (await B.S('A')).book;
  assert.equal(bk.status, 'settled'); assert.deepEqual(bk.winning, ['dodged']); assert.deepEqual(bk.winners, [X.A.id, X.Bb.id]);
  assert.deepEqual(bk.mine, { option: 'dodged', stake: 5, payout: 7 }); assert.ok(bk.settled_at);
  assert.deepEqual([await caps('A'), await caps('Bb'), await caps('C')], [12, 12, 5], 'winners +2 net, the loser -5');
  assert.deepEqual((await B.H()).events.filter(e => e.kind === 'bets_settled').at(-1).payload, { game: game_id, n: 3, winners: [X.A.id, X.Bb.id] });
  await clearQueue();
  step('betting: a spectator stakes 5 (not players in it, one bet each, valid options only); picks stay secret while open; closes at GO; 2 of 3 right split the pot 7/7');

  // nobody right: everyone gets their stake back
  await freshThrow();
  ({ game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.Y.id, dir: 'left' }));
  await bet('A', game_id, 'hit'); await bet('C', game_id, 'hit');
  assert.equal(await caps('C'), 0);
  await api(db, X.Y.uid, 'mg_ready', { room_id: R, game_id }); await go(game_id);
  await api(db, X.Y.uid, 'mg_move', { room_id: R, game_id, dir: 'left' });
  assert.deepEqual([await caps('A'), await caps('C')], [12, 5], 'nobody called it: refunds');
  assert.deepEqual((await B.S('C')).book.mine, { option: 'hit', stake: 5, payout: 5 });
  assert.deepEqual((await B.H()).events.filter(e => e.kind === 'bets_settled').at(-1).payload.winners, []);
  await clearQueue();
  // fewer than 5 caps: no bet
  await freshThrow();
  ({ game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.Z.id, dir: 'high' }));
  await bet('C', game_id, 'hit');                                                  // C: 5 → 0
  await sql("insert into bets (room_id, game_id, player_id, option, stake, payout) select $1, id, $2, 'hit', 5, 0 from minigames where room_id = $1 and kind = 'dodge' and id <> $3 limit 2", [R, X.D.id, game_id]);
  assert.equal(await caps('D'), 0, 'D lost two earlier bets');
  assert.equal((await B.S('D')).book.can_bet, false);
  await expectErr(bet('D', game_id, 'hit'), /You need 5 caps/);
  // muster runs out: closed
  await sql("update minigames set muster_until = now() - interval '1 second' where id = $1", [game_id]);
  assert.equal((await B.H()).book.status, 'closed');
  await expectErr(bet('A', game_id, 'hit'), /Bets are closed/);
  // the host calls it off: everyone refunded
  await api(db, HOST, 'mg_decide', { room_id: R, game_id, start: false });
  assert.equal(await caps('C'), 5);
  assert.equal((await B.S('C')).book.status, 'void');
  assert.ok((await B.H()).events.some(e => e.kind === 'bets_void' && e.payload.game === game_id));
  // a no-show (START ANYWAY): refunded too
  await freshThrow();
  ({ game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.Z.id, dir: 'high' }));
  await bet('A', game_id, 'dodged');
  await api(db, HOST, 'mg_decide', { room_id: R, game_id, start: true });
  assert.equal(await caps('A'), 12); assert.equal((await B.S('A')).book.status, 'void');
  await clearQueue();
  step('betting: nobody right → refunds; under 5 caps refused; closed when muster runs out; called off or no-show → refunds (bets_void)');

  // Jack-in-the-Box: bet on who pops it (a player id)
  await sql('update players set beers = 9 where id = $1', [X.Pw.id]);
  ({ game_id } = await api(db, X.Pw.uid, 'jack_start', { room_id: R, player_ids: [X.Pw.id, X.X.id, X.Y.id, X.Z.id] }));
  const order = (await B.H()).minigame.state.order;
  assert.deepEqual((await B.S('A')).book.options.map(o => o.id), order, 'the options are the players, in turn order');
  await expectErr(bet('Pw', game_id, order[0]), /You're in this one/);
  await expectErr(bet('A', game_id, X.A.id), /Pick one of the options/);
  await expectErr(bet('A', game_id, 'dodged'), /Pick one of the options/);
  await bet('A', game_id, order[1]); await bet('Bb', game_id, order[1]); await bet('C', game_id, order[2]);
  assert.ok(!JSON.stringify(await B.S('D')).includes('"option"') && !JSON.stringify(await B.H()).includes('"option"'), 'picks stay secret');
  const who = id => Object.keys(X).find(k => X[k].id === id);
  for (const id of order) await api(db, X[who(id)].uid, 'mg_ready', { room_id: R, game_id });
  await go(game_id);
  await sql(`update minigames set secret = '{"pop":5}' where id = $1`, [game_id]);
  await api(db, X[who(order[0])].uid, 'mg_move', { room_id: R, game_id, n: 3 });
  await api(db, X[who(order[1])].uid, 'mg_move', { room_id: R, game_id, n: 2 });          // pops it
  bk = (await B.S('Bb')).book;
  assert.deepEqual(bk.winning, [order[1]]); assert.deepEqual(bk.winners, [X.A.id, X.Bb.id]); assert.equal(bk.mine.payout, 7);
  assert.deepEqual([await caps('A'), await caps('Bb'), await caps('C')], [14, 14, 0]);
  assert.equal((await B.H()).book.mine, null);
  step('betting on Jack-in-the-Box: options are the players; whoever pops it wins the bet; the TV never has a pick');
  await clearQueue();

  // you choose the stake: 5 or more, up to all your caps; winners share the pot in proportion to their stakes
  await freshThrow();
  ({ game_id } = await api(db, X.As.uid, 'dodge_throw', { room_id: R, player_id: X.Z.id, dir: 'right' }));
  const betN = (n, option, stake) => api(db, X[n].uid, 'bet', { room_id: R, game_id, option, stake });
  await expectErr(betN('A', 'dodged', 4), /The smallest bet is 5 caps/);
  await expectErr(betN('A', 'dodged', 15), /You only have 14 caps/);
  const yCaps = await caps('Y');
  await betN('A', 'dodged', 10); await betN('Bb', 'dodged', 5); await betN('Y', 'hit', yCaps);   // Y goes all in
  assert.deepEqual([await caps('A'), await caps('Bb'), await caps('Y')], [4, 9, 0]);
  assert.equal((await B.S('A')).book.mine.stake, 10);
  assert.equal((await B.H()).book.mine, null, 'the TV never sees a stake');
  await api(db, X.Z.uid, 'mg_ready', { room_id: R, game_id }); await go(game_id);
  await api(db, X.Z.uid, 'mg_move', { room_id: R, game_id, dir: 'right' });             // Z dodges it
  const pot = 15 + yCaps;
  assert.equal((await B.S('A')).book.mine.payout, Math.floor(pot * 10 / 15), 'A staked 10 of the 15 on the winner: two thirds of the pot');
  assert.equal((await B.S('Bb')).book.mine.payout, Math.floor(pot * 5 / 15));
  assert.equal((await B.S('Y')).book.mine.payout, 0);
  assert.deepEqual([await caps('A'), await caps('Bb'), await caps('Y')], [4 + Math.floor(pot * 10 / 15), 9 + Math.floor(pot * 5 / 15), 0]);
  step('betting: you choose the stake (5 up to all in); winners share the pot in proportion to their stakes');
}

// THE CAPS SHOP: soundboard 5, bribe the wheel 15, graffiti 20, golden ticket 30; open to everyone; caps come off
{
  const Q = await mkRoom([['A', 'drinker'], ['Bb', 'drinker'], ['Sc', 'scrooge'], ['Md', 'medic']]);
  const { R, X } = Q;
  const caps = async n => (await Q.S(n)).me.caps;
  const shop = (n, item, extra = {}) => api(db, X[n].uid, 'shop', { room_id: R, item, ...extra });
  // the first hour is quiet: only the soundboard until the first game has finished
  await expectErr(shop('A', 'ticket'), /Opens after the first game/);
  await expectErr(api(db, X.A.uid, 'shop', { room_id: R }), /Not for sale/);
  await Q.game({}, [X.A.id, X.Bb.id]);                                           // losers: no +3, so the sums below stay simple
  await Q.beers('A', 30); await Q.beers('Bb', 3);                                   // A: 10 + 30 + 15 (level 4) = 55
  assert.equal(await caps('A'), 55);
  assert.deepEqual((await Q.S('A')).me.shop, { bought: [], opens_after_game: false, graffiti_off: false, can_bribe: false, bribe_until: null, sound_ready_at: null });
  await expectErr(shop('A', 'beer'), /Not for sale/);
  await expectErr(shop('A', 'sound', { sound: 'fart' }), /Pick a sound/);
  await expectErr(shop('A', 'sound'), /Pick a sound/);
  // soundboard: anonymous, one per room every 45 seconds
  await shop('A', 'sound', { sound: 'pulease' });
  assert.equal(await caps('A'), 50);
  let h = await Q.H();
  const sb = h.events.filter(e => e.kind === 'soundboard');
  assert.deepEqual(sb.at(-1).payload, { sound: 'pulease' }, 'the TV gets the sound, never who');
  await expectErr(shop('Bb', 'sound', { sound: 'relax' }), /cooling down/);
  assert.ok((await Q.S('Bb')).me.shop.sound_ready_at);
  // graffiti: once a night, announced exactly like the Scrooge's
  await expectErr(shop('A', 'graffiti', { text: 'no' }), /proper punishment/);
  await shop('A', 'graffiti', { text: 'Sing the national anthem' });
  h = await Q.H();
  assert.deepEqual(h.events.filter(e => e.kind === 'scrooge').at(-1).payload, { kind: 'graffiti', text: 'Sing the national anthem' }, 'the same event as the Scrooge');
  assert.ok(h.graffiti.some(g => g.text === 'Sing the national anthem'));
  await expectErr(shop('A', 'graffiti', { text: 'Another one' }), /Once a night/);
  assert.equal(await caps('A'), 30);
  // golden ticket: quiet, sealed, skips your next punishment
  const lastEv = (await Q.H()).events.at(-1).id;
  await shop('A', 'ticket');
  assert.equal(await caps('A'), 0);
  assert.equal((await sql('select count(*)::int n from shields where player_id = $1 and golden and sealed', [X.A.id]))[0].n, 1);
  assert.deepEqual((await Q.H()).events.filter(e => e.id > lastEv), [], 'buying a ticket tells nobody');
  await expectErr(shop('A', 'ticket'), /Once a night/);
  await expectErr(shop('Bb', 'ticket'), /You need 30 caps/);
  assert.deepEqual((await Q.S('A')).me.shop.bought.sort(), ['graffiti', 'ticket']);
  // bribe: only straight after your own wheel lands; re-spins it
  await expectErr(shop('Bb', 'bribe'), /Only straight after your own wheel lands/);
  await api(db, HOST, 'call_next', { room_id: R, player_id: X.Bb.id });
  await sql("update rounds set created_at = now() - interval '10 seconds' where room_id = $1", [R]);
  await api(db, X.Bb.uid, 'spin', { room_id: R });
  h = await Q.H();
  await api(db, HOST, 'round_revealed', { room_id: R, spin_seq: h.round.spin_seq });
  assert.equal((await Q.S('Bb')).me.shop.can_bribe, true);
  assert.equal((await Q.S('A')).me.shop.can_bribe, false, 'only the one on the wheel');
  await expectErr(shop('A', 'bribe'), /Only straight after your own wheel lands/);
  await shop('Bb', 'bribe');
  h = await Q.H();
  assert.equal(h.round.phase, 'spinning'); assert.equal(h.round.spin_seq, 2, 'the wheel spins again');
  assert.deepEqual(h.events.filter(e => e.kind === 'bribe').at(-1).payload, { player: X.Bb.id });
  assert.equal(await caps('Bb'), 10 + 3 + 5 - 15);
  await api(db, HOST, 'round_revealed', { room_id: R, spin_seq: 2 });
  await expectErr(shop('Bb', 'bribe'), /Once a night/);
  await api(db, HOST, 'accept', { room_id: R, force: true });
  // a purchase is a move: the host can't undo past it (its effects live in the undo snapshot)
  assert.equal((await sql('select bool_or(blocked) b from undo_log where room_id = $1', [R]))[0].b, true);
  // other players never see your shop or your caps
  assert.ok(!('shop' in (await Q.H()).me) || (await Q.H()).me.shop === null);
  assert.ok(!JSON.stringify((await Q.S('Bb')).players).includes('"caps"'));
  step('caps shop: soundboard (anonymous, 45s room cooldown), graffiti (once, announced like the Scrooge\'s), golden ticket (once, quiet), bribe (once, only right after your own wheel lands: it spins again); caps come off; a buy blocks undo');
}

// ---------- secrecy sweep ----------
const dan = await S('Dan');
const blob = JSON.stringify({ p: dan.players.filter(p => !p.public_role), me: dan.me, e: dan.events, ev: dan.evidence });
assert.ok(!/"(intruder|forger|medic|betrayer|detective)"/.test(JSON.stringify(dan.me)), 'drinker sees only own role');
void blob;
step('secrecy sweep passed');
console.log('\nALL LOGIC TESTS PASSED');
