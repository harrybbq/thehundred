// Full-night simulation: 1 TV/host + 10 phones (separate browser contexts),
// against the local mock backend (same SQL as Supabase).
// Run: MOCK_ALLOW_SQL=1 npm run mock-server  &  VITE_BACKEND=mock npx vite  &  node tests/e2e.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const APP = process.env.APP_URL || 'http://localhost:5173';
const MOCK = process.env.MOCK_URL || 'http://localhost:8787';
const SHOTS = process.env.SHOTS || 'test-results/e2e';
mkdirSync(SHOTS, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const errors = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const shot = async (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
for (const ev of ['unhandledRejection', 'uncaughtException']) process.on(ev, async e => { console.error(e); try { await shot(tv, 'zz-failure-tv'); } catch {} process.exit(1); });

// ---------- TV ----------
const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
tv.on('pageerror', e => errors.push('TV: ' + e.message));
await tv.goto(`${APP}/tv`);
await tv.fill('input[type=email]', 'host@party.test');
await tv.fill('input[type=password]', 'party123');
await tv.click('text=LOG IN');
await tv.click('text=＋ CREATE ROOM');
await tv.waitForSelector('.lobby-code');
const CODE = (await tv.textContent('.lobby-code')).trim();
const hostUid = await tv.evaluate(() => JSON.parse(localStorage.getItem('thehundred-mock-host')).uid);
const hostApi = async (action, args = {}) => {
  const roomId = (await (await fetch(`${MOCK}/state?code=${CODE}`, { headers: { Authorization: hostUid } })).json()).room.id;
  const r = await fetch(`${MOCK}/api`, { method: 'POST', headers: { Authorization: hostUid, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, args: { room_id: roomId, ...args } }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
};
const tvState = async () => (await fetch(`${MOCK}/state?code=${CODE}`, { headers: { Authorization: hostUid } })).json();
log(`room ${CODE} created`);
await shot(tv, '01-lobby-empty');

// ---------- print cards ----------
const cardsPage = await tvCtx.newPage();
await cardsPage.goto(`${APP}/cards/${CODE}`);
await cardsPage.click('text=GENERATE CODES');
await cardsPage.waitForSelector('.role-card');
await shot(cardsPage, '02-print-cards');
const cards = await cardsPage.$$eval('.role-card', els => els.map(e => ({ role: e.querySelector('.rc-role').textContent.replace(/[^A-Z]/g, '').toLowerCase(), code: e.querySelector('.rc-code').textContent.trim() })));
assert.equal(cards.length, 11);                       // default: 1 each + 1 lovebird pair + 4 drinkers
const lengths = await cardsPage.$$eval('.rc-text', els => els.map(e => e.textContent.length));
log(`cards: ${cards.map(c => c.role).join(',')} | blurb lengths ${Math.min(...lengths)}–${Math.max(...lengths)}`);
await cardsPage.pdf?.({ path: `${SHOTS}/role-cards.pdf`, format: 'A4', printBackground: true }).catch(() => {});

// ---------- 10 phones join with selfies ----------
const NAMES = ['Harry', 'Sophie', 'Jake', 'Megan', 'Tom', 'Priya', 'Olly', 'Ellie', 'Dan', 'Chloe'];
const COLORS = ['#ff2d95', '#22e6ff', '#ffb627', '#b04dff', '#39ff88', '#ff6b3b', '#ffd23f', '#6fa8ff', '#ff8a8a', '#9dffb0'];
const selfie = async (i) => Buffer.from((await tv.evaluate(([c, l]) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 600; const x = cv.getContext('2d');
  x.fillStyle = c; x.fillRect(0, 0, 600, 600); x.fillStyle = '#fff'; x.beginPath(); x.arc(300, 250, 150, 0, 7); x.fill();
  x.fillStyle = '#111'; x.font = 'bold 200px sans-serif'; x.textAlign = 'center'; x.fillText(l, 300, 320);
  x.fillStyle = '#fff'; x.fillRect(120, 430, 360, 170);
  return cv.toDataURL('image/png').split(',')[1];
}, [COLORS[i], NAMES[i][0]])), 'base64');

const P = {};
for (let i = 0; i < NAMES.length; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${NAMES[i]}: ${e.message}`));
  await page.goto(`${APP}/join/${CODE}`);
  await page.waitForSelector('.selfie-pick');
  await page.setInputFiles('.selfie-pick input', { name: 'me.png', mimeType: 'image/png', buffer: await selfie(i) });
  await page.waitForSelector('.selfie-pick img');
  await page.fill('input[placeholder="YOUR NAME"]', NAMES[i]);
  if (i === 0) await shot(page, '03-phone-join');
  await page.click('text=I\'M IN');
  await page.waitForSelector('.beer-btn');
  P[NAMES[i]] = { ctx, page };
}
log('10 phones joined');
await sleep(800);
await shot(tv, '04-lobby-joined');

// ---------- redeem role codes ----------
const pick = r => { const i = cards.findIndex(c => c.role === r); return cards.splice(i, 1)[0].code; };
const deal = { Harry: 'intruder', Sophie: 'lovebird', Tom: 'lovebird', Jake: 'medic', Megan: 'betrayer', Priya: 'cursed', Olly: 'jester', Ellie: 'drinker', Dan: 'drinker', Chloe: 'drinker' };
for (const [n, role] of Object.entries(deal)) {
  const pg = P[n].page;
  await pg.fill('.code6', pick(role).replace('-', '').toLowerCase());
  await pg.click('text=UNLOCK');
  await pg.waitForSelector('.role-box.open');
}
await shot(P.Sophie.page, '05-phone-role-lovebird');
await shot(P.Jake.page, '05b-phone-role-medic');
assert.match(await P.Sophie.page.textContent('.role-box'), /Tom/);
assert.match(await P.Tom.page.textContent('.role-box'), /Sophie/);
await sleep(800);
await shot(tv, '06-lobby-ticks');
assert.equal(await tv.$$eval('.lp-tick.on', e => e.length), 10);
// SECURITY (UI level): the TV state never contains a role
let st = await tvState();
assert.ok(st.players.every(p => p.public_role === null) && st.me.secret === null);
log('roles redeemed (TV shows only ticks)');

// ---------- start the night ----------
await tv.click("text=LET'S GO");
await tv.waitForSelector('.tally-panel');
await sleep(600);
await shot(tv, '07-dashboard');

// ---------- beers + milestone ----------
for (const n of NAMES) await P[n].page.click('.beer-btn');
await sleep(500);
assert.match(await P.Dan.page.textContent('.beer-btn'), /NEXT IN/);
for (let i = 0; i < 14; i++) { await tv.keyboard.press('Space'); await sleep(60); }
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
await tv.keyboard.press('Space');
await tv.waitForSelector('.banner');
await sleep(500);
await shot(tv, '08-milestone-25');
await tv.keyboard.press('-');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
log('beers: phones +10, host +15 −1 = 24, milestone fired');
await sleep(3500);

// reactions
for (const n of ['Harry', 'Sophie', 'Jake', 'Megan']) for (const b of await P[n].page.$$('.reactions button')) await b.click();
await sleep(700);
await shot(tv, '09-reactions');

// ---------- a game with losers → slacker vote with a tie ----------
await tv.click('.btn-game');
await tv.fill('.modal input[type=text]', 'Beer Pong');
await tv.click('text=START GAME');
await sleep(3000);
await tv.click('.btn-game');
await tv.click('.pick:has-text("Ellie")');
await tv.click('.pick:has-text("Tom")');
await shot(tv, '10-pick-losers');
await tv.click('text=CONFIRM 2 LOSERS');
await tv.click('text=START 30s VOTE');
await P.Harry.page.waitForSelector('.takeover.vote');
await shot(P.Harry.page, '11-phone-vote');
const votes = { Harry: 'Chloe', Sophie: 'Chloe', Jake: 'Dan', Megan: 'Dan', Olly: 'Chloe', Ellie: 'Dan' };
for (const [v, c] of Object.entries(votes)) await P[v].page.click(`.p-pick:has-text("${c}")`);
await sleep(700);
await shot(tv, '12-vote-live');
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.vote-winner', { timeout: 10000 });
await sleep(800);
await shot(tv, '13-vote-tie');
await tv.click('.vote-result >> text=CLOSE');
st = await tvState();
assert.deepEqual(st.queue.slice(0, 2).map(q => st.players.find(p => p.id === q.player_id).name), ['Ellie', 'Tom']);
assert.deepEqual(new Set(st.queue.slice(2).map(q => st.players.find(p => p.id === q.player_id).name)), new Set(['Chloe', 'Dan']));
log('game + tied slacker vote → queue Ellie, Tom, Chloe, Dan');
await sleep(3000);

const waitPhase = async (phase, timeout = 40000) => tv.waitForFunction(p => {
  const t = document.querySelector('.wheel-actions')?.textContent || '';
  return p === 'accept' ? /ACCEPT/.test(t) : p === 'saved' ? /CONTINUE/.test(t) : p === 'waiting' ? /SPIN FOR THEM/.test(t) : false;
}, phase, { timeout });
const spinOnPhone = async n => { await P[n].page.waitForSelector('.spin-btn', { timeout: 15000 }); await P[n].page.click('.spin-btn', { force: true }); };

// ---------- round 1: Ellie, no heal (default wheel) ----------
await tv.click('.btn-wheel');
await waitPhase('waiting');
await shot(tv, '14-facing-the-wheel');
await shot(P.Ellie.page, '15-phone-spin-button');
await shot(P.Harry.page, '15b-phone-bystander');
await spinOnPhone('Ellie');
await sleep(2500);
await shot(tv, '16-wheel-spinning');
await waitPhase('accept', 60000);
await shot(tv, '17-result-accept');
await tv.click('text=ACCEPT');
await sleep(1500);
log('round 1: Ellie spun and accepted');

// deterministic wheel from here (no Safe / Spin again) so every punishment logs
await hostApi('update_settings', { segments: ['Finish your drink', 'Waterfall (you start)', 'Sing a chorus the room picks', 'Wear the hat of shame for 30 mins'] });

// ---------- round 2: Tom (Lovebird) healed by the Medic → SAVED, covers both, pair stays hidden ----------
await tv.click('.btn-wheel');
await waitPhase('waiting');
await P.Jake.page.waitForSelector('.ab-btn.heal');
await shot(P.Jake.page, '18-medic-heal-button');
assert.equal(await P.Harry.page.$('.ab-btn.heal'), null);
await P.Jake.page.click('.ab-btn.heal'); await P.Jake.page.click('.ab-btn.heal');   // two-tap confirm
await P.Jake.page.waitForSelector('.ab-done');
await spinOnPhone('Tom');
await waitPhase('saved');
await sleep(600);
await shot(tv, '19-saved');
await tv.click('text=CONTINUE');
st = await tvState();
const pl = n => st.players.find(p => p.name === n);
assert.equal(pl('Tom').punishments.length, 0); assert.equal(pl('Sophie').punishments.length, 0); assert.equal(pl('Tom').public_role, null);
log('round 2: Medic healed Lovebird Tom → SAVED, nobody punished, pair still hidden');
await sleep(1000);

let lastRound3Victim;
// ---------- round 3: Chloe healed, then Jester swaps to Sophie (unhealed) → re-spin → accept → Lovebirds revealed ----------
await tv.click('.btn-wheel');
await waitPhase('waiting');
await P.Jake.page.click('.ab-btn.heal'); await P.Jake.page.click('.ab-btn.heal');
await P.Jake.page.waitForSelector('.ab-done');
lastRound3Victim = (await tvState()).round.victim_id;
await P.Olly.page.click('text=SWAP THE VICTIM');
await P.Olly.page.click('.p-pick:has-text("Sophie")');
await shot(P.Olly.page, '20-jester-swap-picker');
await P.Olly.page.click('text=SWAP SOPHIE');
await tv.waitForSelector('.jester-ov');
await shot(tv, '21-jester-strikes-swap');
await sleep(3800);
await spinOnPhone('Sophie');
await tv.waitForFunction(() => /ANY LAST WORDS/.test(document.querySelector('.wheel-actions')?.textContent || ''), null, { timeout: 60000 });
await P.Olly.page.waitForSelector('.ab-btn.jester.hot');
await shot(P.Olly.page, '22-jester-respin');
await P.Olly.page.click('.ab-btn.jester.hot', { force: true }); await P.Olly.page.click('.ab-btn.jester.hot', { force: true });
await tv.waitForSelector('.jester-ov');
await shot(tv, '23-jester-respin-tv');
await waitPhase('accept', 60000);
await tv.click('text=ACCEPT');
await tv.waitForSelector('.banner-title:has-text("LOVEBIRDS")', { timeout: 10000 });
await sleep(1200);
await shot(tv, '24-lovebirds-revealed');
st = await tvState();
assert.equal(pl('Sophie').public_role, 'lovebird'); assert.equal(pl('Tom').public_role, 'lovebird');
assert.equal(pl('Tom').punishments.length, 1); assert.equal(pl('Sophie').punishments.length, 1);
assert.equal(st.players.find(p => p.id === lastRound3Victim).punishments.length, 0);
log('round 3: heal on Chloe, Jester swap → Sophie, Jester re-spin, accept → Lovebirds revealed, both punished');
await sleep(3500);

// ---------- Jester graffiti ----------
await P.Olly.page.click('text=WHEEL GRAFFITI');
await P.Olly.page.fill('textarea', 'Do 10 press-ups while the room counts in French');
await P.Olly.page.click('text=SPRAY IT'); await P.Olly.page.click('text=SURE? TAP AGAIN');
await tv.waitForSelector('.jester-ov');
await shot(tv, '25-jester-graffiti');
await sleep(3800);

// ---------- Chloe's heal stayed with her → next spin is SAVED ----------
st = await tvState();
const healedName = st.players.find(p => p.id === lastRound3Victim)?.name;
await tv.click(`.card:has-text("${healedName}")`);
await tv.click('text=PUNISH NOW');
await waitPhase('waiting');
await shot(tv, '26-wheel-with-graffiti');
await spinOnPhone(healedName);
await waitPhase('saved');
await tv.click('text=CONTINUE');
log(`heal stayed with ${healedName} (the original victim) → SAVED on their next spin`);
await sleep(1000);

// ---------- curse: Priya double spin, then passes it to Harry ----------
await tv.click('.card:has-text("Priya")');
await tv.click('text=PUNISH NOW');
await waitPhase('waiting');
await spinOnPhone('Priya');
await tv.waitForSelector('.wheel-result.curse', { timeout: 30000 });
await shot(tv, '27-cursed-second-spin');
await waitPhase('accept', 60000);
await tv.click('text=ACCEPT');
await sleep(1200);
st = await tvState();
assert.equal(pl('Priya').punishments.length, 2);
await P.Priya.page.click('text=PASS THE CURSE');
await P.Priya.page.click('.p-pick:has-text("Harry")');
await P.Priya.page.click('text=PASS IT HARRY');
await tv.waitForSelector('.curse-modal');
await shot(tv, '28-curse-approval');
await tv.click('.curse-modal >> text=APPROVE');
await sleep(1500);
st = await tvState();
assert.equal(pl('Harry').cursed, true); assert.equal(pl('Priya').cursed, false);
await shot(tv, '29-curse-passed');
log('curse: 2 spins for Priya, passed to Harry with host approval');
await sleep(2500);

// ---------- Betrayer: wrong guess, then right ----------
await P.Megan.page.click('text=ACCUSE THE INTRUDER');
await P.Megan.page.click('.p-pick:has-text("Dan")');
await P.Megan.page.click('text=ACCUSE DAN');
await P.Megan.page.waitForSelector('.takeover.wrong');
await shot(P.Megan.page, '30-betrayer-wrong');
await sleep(500);
await shot(tv, '31-tv-penalty');
assert.equal(await P.Dan.page.$('.takeover'), null, 'accused must not be told');
await P.Megan.page.click('.takeover');
await P.Megan.page.click('text=ACCUSE THE INTRUDER');
await P.Megan.page.click('.p-pick:has-text("Harry")');
await P.Megan.page.click('text=ACCUSE HARRY');
await P.Megan.page.waitForSelector('.takeover.team');
await P.Harry.page.waitForSelector('.takeover.team', { timeout: 15000 });
await shot(P.Harry.page, '32-intruder-team-now');
log('Betrayer: wrong guess → penalty (accused not told); right guess → both phones "team now"');

// ---------- refresh persistence ----------
await P.Sophie.page.reload();
await P.Sophie.page.waitForSelector('.beer-btn');
await P.Sophie.page.click('.role-box.closed');
assert.match(await P.Sophie.page.textContent('.role-box'), /LOVEBIRD/);
await tv.reload();
await tv.waitForSelector('.tally-panel');
assert.equal(await tv.textContent('#tallyNum'), '24');
log('phone + TV refresh: session, role and state restored');

// ---------- expose ----------
await tv.click('.card:has-text("Jake") .expose-btn');
await tv.click('text=EXPOSE THEM');
await sleep(700);
await shot(tv, '33-exposed-medic');
st = await tvState();
assert.equal(pl('Jake').public_role, 'medic');
await sleep(2500);

// ---------- countdown end ----------
await hostApi('update_settings', { deadline_at: new Date(Date.now() + 4000).toISOString() });
await tv.waitForSelector('.big-overlay .bo-title', { timeout: 20000 });
await sleep(1200);
await shot(tv, '34-intruder-wins');
assert.match(await tv.textContent('.bo-title'), /INTRUDER & BETRAYER WIN/);
await P.Ellie.page.waitForSelector('.p-round.ended');
await shot(P.Ellie.page, '35-phone-ended');

// ---------- reveal all ----------
await tv.click('text=REVEAL ALL ROLES');
await tv.click('text=REVEAL EVERYONE'); await tv.click('text=SURE? TAP AGAIN');
await sleep(4000);
await shot(tv, '36-revealing');
await tv.waitForSelector('.reveal-summary', { timeout: 30000 });
await sleep(800);
await shot(tv, '37-reveal-summary');
st = await tvState();
assert.equal(pl('Harry').public_role, 'intruder');
assert.equal(st.room.reveal.teams.length, 1);
await tv.click('.reveal-summary >> text=CLOSE');
await sleep(500);
await shot(tv, '38-final-board');

// ---------- security via the API as a player ----------
const danUid = await P.Dan.page.evaluate(() => JSON.parse(localStorage.getItem('thehundred-mock-player')).uid);
const r = await fetch(`${MOCK}/api`, { method: 'POST', headers: { Authorization: danUid, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_cards', args: { room_id: st.room.id } }) });
assert.equal(r.status, 400); assert.match((await r.json()).error, /Only the host/);
log('player calling host-only get_cards → rejected');

console.log('\nPAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
console.log('E2E PASSED');
