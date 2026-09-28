// Full-night simulation (v3): 1 TV/host + 12 phones (separate browser contexts),
// against the local mock backend (same SQL as Supabase).
// Run: npm run mock-server  &  VITE_BACKEND=mock npx vite  &  node tests/e2e.mjs
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
// E2E_FONTS=1: fetch Google Fonts with curl (which honours the sandbox proxy) so screenshots use the real type
const fontCache = new Map();
const withFonts = async ctx => {
  if (!process.env.E2E_FONTS) return ctx;
  const { execFileSync } = await import('node:child_process');
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async route => {
    const url = route.request().url();
    if (!fontCache.has(url)) fontCache.set(url, execFileSync('curl', ['-s', '-A', 'Mozilla/5.0 Chrome/120', url], { maxBuffer: 1 << 24 }));
    await route.fulfill({ body: fontCache.get(url), contentType: url.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  return ctx;
};
const shot = async (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
for (const ev of ['unhandledRejection', 'uncaughtException']) process.on(ev, async e => { console.error(e); try { await shot(tv, 'zz-failure-tv'); } catch {} process.exit(1); });

// ---------- TV ----------
const tvCtx = await withFonts(await browser.newContext({ viewport: { width: 1920, height: 1080 } }));
const tv = await tvCtx.newPage();
tv.on('pageerror', e => errors.push('TV: ' + e.message));
await tv.goto(`${APP}/tv`);
await tv.fill('input[type=email]', 'host@party.test');
await tv.fill('input[type=password]', 'party123');
await tv.click('text=LOG IN');
await tv.click('text=+ CREATE ROOM');
await tv.waitForSelector('.lobby-code');
const CODE = (await tv.textContent('.lobby-code')).trim();
const hostUid = await tv.evaluate(() => JSON.parse(localStorage.getItem('thehundred-mock-host')).uid);
const tvState = async () => (await fetch(`${MOCK}/state?code=${CODE}`, { headers: { Authorization: hostUid } })).json();
const hostApi = async (action, args = {}) => {
  const roomId = (await tvState()).room.id;
  const r = await fetch(`${MOCK}/api`, { method: 'POST', headers: { Authorization: hostUid, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, args: { room_id: roomId, ...args } }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
};
log(`room ${CODE} created`);
await shot(tv, '01-lobby-empty');

// ---------- print cards ----------
const cardsPage = await tvCtx.newPage();
await cardsPage.goto(`${APP}/cards/${CODE}`);
await cardsPage.click('text=GENERATE CODES');
await cardsPage.waitForSelector('.role-card');
await shot(cardsPage, '02-print-cards');
const cards = await cardsPage.$$eval('.role-card', els => els.map(e => ({
  role: e.querySelector('.rc-role').textContent.replace(/[^A-Z]/g, '').toLowerCase(), lovebird: /LOVEBIRD/.test(e.textContent.match(/MODIFIER: \w+/g)?.join() || ''), cursed: /CURSED/.test(e.textContent.match(/MODIFIER: \w+/g)?.join() || ''),
  team: e.querySelector('.rc-team').textContent, code: e.querySelector('.rc-code').textContent.trim() })));
assert.equal(cards.length, 12);                       // default: 8 roles + 4 drinkers; the Lovebird pair is a bonus on 2 of them
assert.equal(cards.filter(c => c.lovebird).length, 2);
assert.equal(cards.filter(c => c.cursed).length, 1);
assert.ok(!cards.some(c => c.role === 'lovebird' || c.role === 'cursed'), 'modifiers are not cards');
// deterministic for the run: move the pair onto the first two Drinker cards (Sophie & Tom get them)
{
  const rid = (await tvState()).room.id, pid = crypto.randomUUID();
  const sqlq = (sql, params) => fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql, params }) });
  await sqlq('update role_codes set pair_id = null where room_id = $1', [rid]);
  for (const c of cards.filter(c => c.role === 'drinker').slice(0, 2)) await sqlq('update role_codes set pair_id = $1 where code = $2', [pid, c.code.replace('-', '')]);
  // …and the Cursed modifier onto the third Drinker card (Priya)
  await sqlq('update role_codes set cursed = false where room_id = $1', [rid]);
  await sqlq('update role_codes set cursed = true where code = $1', [cards.filter(c => c.role === 'drinker')[2].code.replace('-', '')]);
}
assert.match(cards.find(c => c.role === 'forger').team, /SABOTEURS/);
assert.match(cards.find(c => c.role === 'scrooge').team, /CHAOS/);
assert.match(cards.find(c => c.role === 'jester').team, /CHAOS/);
assert.match(cards.find(c => c.role === 'skank').team, /DRINKERS/);
assert.match(cards.find(c => c.role === 'betrayer').team, /DRINKERS/);
const lengths = await cardsPage.$$eval('.rc-text', els => els.map(e => e.textContent.length));
log(`cards: ${cards.map(c => c.role).join(',')} | blurb lengths ${Math.min(...lengths)}–${Math.max(...lengths)}`);
await cardsPage.pdf?.({ path: `${SHOTS}/role-cards.pdf`, format: 'A4', printBackground: true }).catch(() => {});

// ---------- 12 phones join with selfies ----------
const NAMES = ['Harry', 'Sophie', 'Jake', 'Megan', 'Tom', 'Priya', 'Olly', 'Ellie', 'Dan', 'Chloe', 'Maya', 'Kai'];
const COLORS = ['#c9861f', '#2c6e74', '#8e2a1a', '#51606a', '#b3601a', '#1d4d52', '#d8ccb0', '#5c2a54', '#3f7a14', '#9e2f42', '#2a4d69', '#8a6a00'];
const picture = async (c, l, w = 600, h = 600) => Buffer.from((await tv.evaluate(([c, l, w, h]) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
  x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#f1e8d4'; x.beginPath(); x.arc(w / 2, h * 0.42, h / 4, 0, 7); x.fill();
  x.fillStyle = '#111'; x.font = `bold ${h / 3}px sans-serif`; x.textAlign = 'center'; x.fillText(l, w / 2, h * 0.53);
  return cv.toDataURL('image/png').split(',')[1];
}, [c, l, w, h])), 'base64');

const P = {};
for (let i = 0; i < NAMES.length; i++) {
  const ctx = await withFonts(await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${NAMES[i]}: ${e.message}`));
  await page.goto(`${APP}/join/${CODE}`);
  await page.waitForSelector('.selfie-pick');
  if (i === 0) await shot(page, '03a-phone-join-empty');
  await page.setInputFiles('.selfie-pick input', { name: 'me.png', mimeType: 'image/png', buffer: await picture(COLORS[i], NAMES[i][0]) });
  await page.waitForSelector('.selfie-pick img');
  await page.fill('input[placeholder="YOUR NAME"]', NAMES[i]);
  if (i === 0) await shot(page, '03-phone-join');
  await page.click('text=I\'M IN');
  await page.waitForSelector('.beer-btn');
  P[NAMES[i]] = { ctx, page };
}
log('12 phones joined');
await sleep(800);
await shot(tv, '04-lobby-joined');
await shot(P.Harry.page, '04b-phone-home-no-code');

// ---------- redeem role codes ----------
const pick = r => { const i = cards.findIndex(c => c.role === r); return cards.splice(i, 1)[0].code; };
const deal = { Harry: 'intruder', Megan: 'betrayer', Kai: 'forger', Jake: 'medic', Maya: 'detective', Sophie: 'drinker', Tom: 'drinker',
               Priya: 'drinker', Olly: 'scrooge', Ellie: 'skank', Dan: 'drinker', Chloe: 'jester' };
for (const [n, role] of Object.entries(deal)) {
  const pg = P[n].page;
  await pg.fill('.code6', pick(role).replace('-', '').toLowerCase());
  await pg.click('text=OPEN MY FILE');
  await pg.waitForSelector('.dossier');
}
await shot(P.Jake.page, '05-phone-file-medic');
await shot(P.Harry.page, '05b-phone-file-intruder');
assert.match(await P.Sophie.page.textContent('.dossier'), /Tom/);
assert.match(await P.Tom.page.textContent('.dossier'), /Sophie/);
assert.match(await P.Harry.page.textContent('.d-team'), /SABOTEURS/);
assert.match(await P.Kai.page.textContent('.d-team'), /SABOTEURS/);
assert.match(await P.Megan.page.textContent('.d-team'), /DRINKERS/);
assert.match(await P.Olly.page.textContent('.d-team'), /CHAOS/);
await P.Jake.page.click('.dossier');
await shot(P.Jake.page, '05c-phone-file-closed');
await sleep(800);
await shot(tv, '06-lobby-ticks');
assert.equal(await tv.$$eval('.lp-tick', e => e.length), 12);
// SECURITY (UI level): the TV state never contains a role
let st = await tvState();
assert.ok(st.players.every(p => p.public_role === null) && st.me.secret === null);
log('roles redeemed; files show teams; TV shows only ticks');

// ---------- start the night ----------
await tv.click("text=LET'S GO");
await tv.waitForSelector('.tally-panel');
await sleep(600);
await shot(tv, '07-dashboard');

// ---------- beers + milestone (Chloe logs nothing → she'll be the Slacker) ----------
for (const n of NAMES.filter(n => n !== 'Chloe')) await P[n].page.click('.beer-btn');
await sleep(500);
assert.match(await P.Dan.page.textContent('.beer-btn'), /NEXT IN/);
for (let i = 0; i < 13; i++) { await tv.keyboard.press('Space'); await sleep(60); }
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
await tv.keyboard.press('Space');
await tv.waitForSelector('.banner');
await sleep(500);
await shot(tv, '08-milestone-25');
await tv.keyboard.press('-');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
log('beers: phones +11, host +14 −1 = 24, milestone fired');
await P.Ellie.page.click('.file.closed');
assert.match(await P.Ellie.page.textContent('.dossier'), /Hidden bonus: \+1 beers/);
await shot(P.Ellie.page, '08b-phone-skank');
await P.Ellie.page.click('.file-open');
log('Skank: Ellie\'s beer secretly counts double (+1 hidden bonus)');
await sleep(3500);
for (const n of ['Harry', 'Sophie', 'Jake', 'Megan']) for (const b of await P[n].page.$$('.reactions button')) await b.click();

// ---------- host undo ----------
await tv.keyboard.press('Space');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '25');
await tv.waitForSelector('.key.undo');
await shot(tv, '09-undo-button');
await tv.click('.key.undo');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
log('host undo: +1 reverted');
await sleep(3500);

// ---------- Medic heals in advance, Forger forges one ----------
const medicHeal = async name => {
  await P.Jake.page.click('text=HEAL IN ADVANCE');
  await P.Jake.page.click(`.p-pick:has-text("${name}")`);
  await P.Jake.page.click(`text=HEAL ${name.toUpperCase()}`);
  await sleep(300);
};
// drink levels: Jake logs his way to 4 beers → level 2 → a second heal (and a level-up notice)
const jakeId = (await tvState()).players.find(p => p.name === 'Jake').id;
await fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: 'update players set beers = 3, last_beer_at = null where id = $1', params: [jakeId] }) });
await P.Jake.page.waitForFunction(() => !/NEXT IN/.test(document.querySelector('.beer-btn')?.textContent || ''), null, { timeout: 10000 });
await P.Jake.page.click('.beer-btn');
await tv.waitForSelector('.banner-title:has-text("LEVEL 2")', { timeout: 10000 });
await shot(tv, '09b-level-up-tv');
await P.Jake.page.waitForSelector('.takeover.notice', { timeout: 10000 });
await shot(P.Jake.page, '09c-level-up-phone');
await P.Jake.page.click('.takeover');
assert.match(await P.Jake.page.textContent('.p-lvl'), /LV2/);
log('drink level: Jake hit 4 beers → LEVEL 2 banner on the TV, perk notice on his phone');
await sleep(2500);
await P.Kai.page.waitForSelector('.ab-done');                     // nothing to forge yet
await medicHeal('Tom');
await P.Kai.page.waitForSelector('.ab-btn.forge', { timeout: 10000 });
await shot(P.Jake.page, '10-medic-heal');
await shot(P.Kai.page, '10b-forger-ready');
await P.Kai.page.click('.ab-btn.forge', { force: true }); await P.Kai.page.click('.ab-btn.forge', { force: true });
await P.Kai.page.waitForSelector('.ab-btn.forge', { state: 'detached' });
await medicHeal('Ellie');
st = await tvState();
assert.ok(!JSON.stringify(st).includes('forged":true'), 'TV must not learn about the forgery early');
log('Medic healed Tom + Ellie in advance; Forger forged one (the TV knows nothing)');

// ---------- evidence ----------
await P.Dan.page.click('.ev-btn');
await P.Dan.page.setInputFiles('.ev-frame input', { name: 'ev.png', mimeType: 'image/png', buffer: await picture('#1d4d52', '?', 800, 600) });
await P.Dan.page.waitForSelector('.ev-frame img');
await P.Dan.page.fill('input[placeholder^="caption"]', 'Harry pouring into the plant');
await shot(P.Dan.page, '11-phone-evidence');
await P.Dan.page.click('text=FILE IT');
await P.Dan.page.waitForSelector('.beer-btn');
await P.Ellie.page.click('.ev-btn');
await P.Ellie.page.setInputFiles('.ev-frame input', { name: 'ev2.png', mimeType: 'image/png', buffer: await picture('#8e2a1a', '!', 600, 800) });
await P.Ellie.page.waitForSelector('.ev-frame img');
await P.Ellie.page.click('text=FILE IT');
await P.Ellie.page.waitForSelector('.beer-btn');
st = await tvState();
assert.equal(st.evidence.length, 2);
assert.ok(!JSON.stringify(st.evidence).includes(st.players.find(p => p.name === 'Dan').id), 'evidence is anonymous');
log('2 pieces of evidence filed (anonymous)');

// ---------- Forger frames Chloe (once) ----------
await P.Kai.page.click('.ab-btn.frame');
await P.Kai.page.click('.p-pick:has-text("Chloe")');
await P.Kai.page.click('text=FRAME CHLOE');
await P.Kai.page.waitForSelector('.ab-done:has-text("Chloe is framed")');
await shot(P.Kai.page, '11b-forger-framed');
assert.ok(!JSON.stringify(await tvState()).includes('frame'), 'TV never hears about a frame');
log('Forger framed Chloe (the TV knows nothing)');

// ---------- game 1 → losers → automatic Slacker → Trial (innocent) ----------
await tv.click('.btn-game');
await tv.fill('.modal input[type=text]', 'Beer Pong');
await tv.click('.chip:has-text("2 v 2")');
await tv.click('text=DRAW MATCHUPS');
await tv.waitForSelector('.mu-vs');
await sleep(2800);
await shot(tv, '11c-matchup-draw');
assert.equal(await tv.$$eval('.mu-p', e => e.length), 4);
assert.ok(await tv.$('.mu-skull'), 'the Cursed player is always drawn in');
await tv.click('.matchup-ov >> text=START GAME');
await sleep(500);
assert.equal((await tvState()).game.matchup.flat().length, 4);
await sleep(3000);
await tv.click('.btn-game');
await tv.click('.pick:has-text("Tom")');
await tv.click('.pick:has-text("Ellie")');
await shot(tv, '12-pick-losers');
await tv.click('text=CONFIRM 2 LOSERS');
await tv.waitForSelector('.slacker-ov', { timeout: 15000 });
await sleep(900);
await shot(tv, '13-slacker');
assert.match(await tv.textContent('.slacker-ov'), /CHLOE/);
await tv.click('text=START THE TRIAL');
await P.Harry.page.waitForSelector('.takeover.vote');
await shot(P.Harry.page, '14-phone-trial');
const votes1 = { Harry: 'Dan', Sophie: 'Dan', Jake: 'Dan', Megan: 'Dan', Olly: 'Dan', Ellie: 'Dan', Kai: 'Dan', Tom: 'Harry' };
for (const [v, c] of Object.entries(votes1)) await P[v].page.click(`.p-pick:has-text("${c}")`);
await P.Chloe.page.click('text=NO TRIAL');
for (let i = 0; i < 40 && (await tvState()).vote?.voters < 9; i++) await sleep(250);
await sleep(900);
await shot(tv, '15-trial-live-evidence');
assert.equal(await tv.$$eval('.evidence-col .ev', e => e.length), 2);
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.verdict', { timeout: 10000 });
await sleep(1200);
await shot(tv, '16-verdict-not-guilty');
assert.match(await tv.textContent('.verdict'), /NOT GUILTY/);
await tv.click('.verdict >> text=CLOSE');
st = await tvState();
const pl = n => st.players.find(p => p.name === n);
const wheelCount = n => pl(n).punishments.filter(u => u.kind === 'wheel').length;
assert.deepEqual(st.queue.map(q => st.players.find(p => p.id === q.player_id).name), ['Tom', 'Ellie', 'Chloe']);
assert.equal(pl('Harry').punishments.at(-1)?.text, 'Wrong accusation');
assert.equal(pl('Tom').punishments.length, 0);
log('game 1: losers Tom, Ellie; Slacker Chloe (0 beers); Trial → Dan NOT GUILTY, 7 accusers drink');
await sleep(2500);

const waitPhase = async (phase, timeout = 40000) => tv.waitForFunction(p => {
  const t = document.querySelector('.wheel-actions')?.textContent || '';
  return p === 'accept' ? /ACCEPT/.test(t) : p === 'saved' ? /CONTINUE/.test(t) : p === 'waiting' ? /SPIN FOR THEM/.test(t) : false;
}, phase, { timeout });
const spinOnPhone = async n => { await P[n].page.waitForSelector('.spin-btn', { timeout: 15000 }); await P[n].page.click('.spin-btn', { force: true }); };

// deterministic wheel (no Safe / Spin again) so every punishment logs
await hostApi('update_settings', { segments: ['Finish your drink', 'Waterfall', 'Sing a chorus the room picks', 'Hat of shame for 30 mins', 'Two fingers', 'No hands'] });

// ---------- Tom: heal was FORGED → SAVED, struck out, spins anyway → Lovebirds revealed ----------
await tv.click('.btn-wheel');
await waitPhase('waiting');
await shot(tv, '17-facing-the-wheel');
await shot(P.Tom.page, '18-phone-spin');
await spinOnPhone('Tom');
await tv.waitForSelector('.saved-stamp', { timeout: 15000 });
await sleep(700);
await shot(tv, '19-forge-saved-frame');
await tv.waitForSelector('.forged-stamp', { timeout: 10000 });
await sleep(900);
await shot(tv, '20-forged');
await sleep(2400);
await shot(tv, '21-wheel-spinning');
await waitPhase('accept', 60000);
await shot(tv, '22-result-accept');
await tv.click('text=ACCEPT');
await tv.waitForSelector('.banner-title:has-text("LOVEBIRDS")', { timeout: 10000 });
await sleep(1200);
await shot(tv, '23-lovebirds-red-string');
st = await tvState();
assert.equal(wheelCount('Tom'), 1); assert.equal(wheelCount('Sophie'), 1);
assert.equal(pl('Sophie').love_partner_id, pl('Tom').id);
assert.equal(pl('Sophie').public_role, null, 'the Lovebird pair is shown, their roles stay secret');
assert.ok(await tv.$('.case[data-id="' + pl('Tom').id + '"] .love-tag'));
log('Tom: forged heal → SAVED struck out → spun anyway; Lovebirds revealed');
await sleep(3500);

// ---------- Ellie: real heal → SAVED ----------
await tv.click('.btn-wheel');
await waitPhase('waiting');
await spinOnPhone('Ellie');
await waitPhase('saved');
await sleep(800);
await shot(tv, '24-saved');
await tv.click('text=CONTINUE');
st = await tvState();
assert.equal(wheelCount('Ellie'), 0);
log('Ellie: intact heal → SAVED');
await sleep(1200);

// ---------- Chloe (Slacker): the Scrooge swaps her for Kai, then forces a re-spin ----------
await tv.click('.btn-wheel');
await waitPhase('waiting');
await P.Olly.page.click('text=SWAP THE VICTIM');
await P.Olly.page.click('.p-pick:has-text("Kai")');
await P.Olly.page.click('text=SWAP KAI');
await tv.waitForSelector('.scrooge-ov');
await sleep(400);
await shot(tv, '25-scrooge-static');
await sleep(3600);
await spinOnPhone('Kai');
await tv.waitForFunction(() => /Any last words/.test(document.querySelector('.wheel-actions')?.textContent || ''), null, { timeout: 60000 });
await P.Olly.page.waitForSelector('.ab-btn.scrooge.hot');
await P.Olly.page.click('.ab-btn.scrooge.hot', { force: true }); await P.Olly.page.click('.ab-btn.scrooge.hot', { force: true });
await tv.waitForSelector('.scrooge-ov');
await waitPhase('accept', 60000);
await tv.click('text=ACCEPT');
log('Scrooge: swapped Chloe → Kai, then forced a re-spin');
await sleep(2000);

// ---------- Detective: investigate, hold to read (3s, once) ----------
await P.Maya.page.click('text=INVESTIGATE');
await P.Maya.page.click('.p-pick:has-text("Harry")');
await P.Maya.page.click('text=INVESTIGATE HARRY');
await P.Maya.page.waitForSelector('.ab-btn.detective.hold');
await P.Maya.page.hover('.ab-btn.detective.hold');
await P.Maya.page.mouse.down();
await P.Maya.page.waitForSelector('.verdict-stamp');
await shot(P.Maya.page, '26-detective-hold');
assert.match(await P.Maya.page.textContent('.verdict-stamp'), /SABOTEUR/);
assert.match(await P.Maya.page.textContent('.group-read'), /ONE OF THESE 3 IS A SABOTEUR/, 'level 1 Detective gets a vague reading of 3 people');
await P.Maya.page.mouse.up();
await sleep(300);
assert.equal(await P.Maya.page.$('.verdict-stamp'), null);
await P.Maya.page.mouse.down(); await sleep(400);
assert.equal(await P.Maya.page.$('.verdict-stamp'), null, 'file burns after one read');
await P.Maya.page.mouse.up();
log('Detective: Harry read as a SABOTEUR while held; gone on release, never again');

// ---------- the Hit: Intruder names Jake as the Medic ----------
await P.Harry.page.click('text=THE HIT');
await P.Harry.page.click('.p-pick:has-text("Jake")');
await P.Harry.page.click('text=NEXT JAKE');
await shot(P.Harry.page, '27-hit-roles');
assert.equal(await P.Harry.page.$('.role-pick:has-text("DRINKER")'), null);
assert.equal(await P.Harry.page.$('.role-pick:has-text("CURSED")'), null);
await P.Harry.page.click('.role-pick:has-text("MEDIC")'); await P.Harry.page.click('.role-pick:has-text("SURE")');
await tv.waitForSelector('.hit-ov', { timeout: 10000 });
await sleep(900);
await shot(tv, '28-hit-cover-blown');
await P.Jake.page.waitForSelector('.takeover.notice', { timeout: 10000 });
await shot(P.Jake.page, '29-phone-cover-blown');
await P.Jake.page.click('.takeover');
assert.equal(await P.Jake.page.$('text=HEAL IN ADVANCE'), null, 'burned Medic has no powers');
await P.Harry.page.click('.takeover');
assert.match(await P.Harry.page.textContent('.abilities'), /sharpening/);
log('Hit: Jake exposed as Medic, powers burned; Intruder waits for the next game');
await sleep(5000);

// ---------- Betrayer: wrong, then right → Saboteur (no Intruder powers) ----------
await P.Megan.page.click('text=ACCUSE THE INTRUDER');
await P.Megan.page.click('.p-pick:has-text("Dan")');
await P.Megan.page.click('text=ACCUSE DAN');
await P.Megan.page.waitForSelector('.takeover.wrong');
assert.equal(await P.Dan.page.$('.takeover'), null, 'accused must not be told');
await P.Megan.page.click('.takeover');
await P.Megan.page.click('text=ACCUSE THE INTRUDER');
await P.Megan.page.click('.p-pick:has-text("Harry")');
await P.Megan.page.click('text=ACCUSE HARRY');
await P.Megan.page.waitForSelector('.takeover.team', { timeout: 10000 });
await shot(P.Megan.page, '30-betrayer-guilty-now');
await P.Harry.page.waitForSelector('.takeover.team', { timeout: 15000 });
await P.Megan.page.click('.takeover');
assert.equal(await P.Megan.page.$('text=THE HIT'), null, 'Betrayer gets no Intruder powers');
log('Betrayer: wrong guess → drink; right guess → Saboteur, no powers');

// ---------- game 2 → Slacker Olly → Trial convicts Harry → rehab, knife to Megan ----------
await P.Harry.page.click('.takeover');                        // "you have a partner"
for (const n of NAMES.filter(n => n !== 'Olly')) await P[n].page.click('.beer-btn');
await tv.click('.btn-game');
await tv.fill('.modal input[type=text]', 'Flip Cup');
await tv.click('text=START GAME');
await sleep(2500);
await tv.click('.btn-game');
await tv.click('text=CONFIRM 0 LOSERS');
await tv.waitForSelector('.slacker-ov', { timeout: 15000 });
assert.match(await tv.textContent('.slacker-ov'), /OLLY/);
await tv.click('text=START THE TRIAL');
await P.Dan.page.waitForSelector('.takeover.vote');
for (const v of ['Sophie', 'Jake', 'Dan', 'Ellie', 'Chloe', 'Maya', 'Tom', 'Priya']) await P[v].page.click('.p-pick:has-text("Harry")');
for (let i = 0; i < 40 && (await tvState()).vote?.voters < 8; i++) await sleep(250);
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.verdict', { timeout: 10000 });
await sleep(1500);
await shot(tv, '31-verdict-guilty');
assert.match(await tv.textContent('.verdict'), /GUILTY/);
await tv.click('.verdict >> text=CLOSE');
await P.Harry.page.waitForSelector('.takeover.rehab', { timeout: 10000 });
await shot(P.Harry.page, '32-phone-rehab');
await P.Megan.page.waitForSelector('.takeover.knife', { timeout: 10000 });
await shot(P.Megan.page, '33-phone-knife');
await P.Megan.page.click('.takeover');
await P.Megan.page.waitForSelector('text=THE HIT');
st = await tvState();
assert.equal(pl('Harry').rehab, true); assert.equal(pl('Harry').public_role, 'intruder');
await sleep(1500);
await shot(tv, '34-board-rehab');
log('game 2: Slacker Olly; Trial convicts Harry → rehab; the knife passes to Megan');

// ---------- refresh persistence ----------
await P.Sophie.page.reload();
await P.Sophie.page.waitForSelector('.beer-btn');
await P.Sophie.page.click('.file.closed');
assert.match(await P.Sophie.page.textContent('.dossier'), /LOVEBIRD/);
await tv.reload();
await tv.waitForSelector('.tally-panel');
log('phone + TV refresh: session, role and state restored');

// ---------- host free spin on the whole room ----------
await tv.click('.btn-free');
await tv.click('.chip:has-text("Birthday spin")');
await tv.click('.btn.danger:has-text("SPIN NOW")');
await tv.waitForSelector('.wh-name:has-text("THE WHOLE ROOM")');
await sleep(1500);
await shot(tv, '34b-free-spin-room');
await waitPhase('accept', 60000);
await tv.click('text=ACCEPT');
log('host free spin: the whole room spun, nothing logged against anyone');
await sleep(1500);

// ---------- the Jester gets convicted and takes revenge ----------
await hostApi('start_vote', { kind: 'trial' });
await P.Chloe.page.waitForSelector('.takeover.vote');
for (const v of ['Sophie', 'Jake', 'Dan', 'Ellie', 'Maya', 'Tom', 'Priya']) { await P[v].page.waitForSelector('.takeover.vote'); await P[v].page.click('.p-pick:has-text("Chloe")'); }
for (let i = 0; i < 40 && (await tvState()).vote?.voters < 7; i++) await sleep(250);
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.verdict', { timeout: 10000 });
await sleep(1500);
assert.match(await tv.textContent('.verdict'), /JESTER/);
await shot(tv, '34c-verdict-jester');
await P.Chloe.page.waitForSelector('.takeover.jester', { timeout: 10000 });
await shot(P.Chloe.page, '34d-phone-jester-revenge');
await P.Chloe.page.click('.takeover.jester .p-pick:has-text("Tom")');
await P.Chloe.page.click('.takeover.jester .p-pick.armed');
await tv.waitForSelector('.verdict .vline:has-text("REVENGE: TOM")', { timeout: 10000 });
st = await tvState();
assert.deepEqual(st.queue.filter(q => q.times === 3).map(q => pl('Tom').id === q.player_id), [true]);
assert.equal(pl('Chloe').public_role, 'jester');
await sleep(1200);
await shot(tv, '34e-jester-revenge');
await tv.click('.verdict >> text=CLOSE');
log('Jester: Chloe convicted → picked Tom for a ×3 punishment');
await sleep(4000);

// ---------- countdown end → the Saboteurs win ----------
await hostApi('update_settings', { deadline_at: new Date(Date.now() + 4000).toISOString() });
await tv.waitForSelector('.big-overlay .bo-title', { timeout: 20000 });
await sleep(1500);
await shot(tv, '35-guilty-win');
assert.match(await tv.textContent('.bo-title'), /THE SABOTEURS WIN/);
assert.match(await tv.textContent('.bo-sub'), /\+ 2 SKANK BONUS = \d+ \/ 100/);
await P.Ellie.page.waitForSelector('.p-round.ended');
await shot(P.Ellie.page, '36-phone-ended');

// ---------- reveal all ----------
await tv.click('text=REVEAL ALL ROLES');
await tv.click('text=REVEAL EVERYONE'); await tv.click('text=SURE? TAP AGAIN');
await tv.waitForSelector('.reveal-ov');
await sleep(3000);
await shot(tv, '37-revealing');
await tv.waitForSelector('.casefile', { timeout: 30000 });
await sleep(900);
await shot(tv, '38-case-file');
const findings = await tv.textContent('.findings');
assert.match(findings, /MEGAN.*secretly joined.*HARRY/);
assert.match(findings, /knife passed to MEGAN/);
assert.match(findings, /KAI.*forged.*JAKE.*TOM/);
assert.match(findings, /MAYA.*checked.*HARRY.*SABOTEUR/);
assert.match(findings, /KAI.*framed.*CHLOE/);
await tv.click('.casefile >> text=CLOSE');
await sleep(500);
await shot(tv, '39-final-board');

// ---------- security via the API as a player ----------
const danUid = await P.Dan.page.evaluate(() => JSON.parse(localStorage.getItem('thehundred-mock-player')).uid);
const r = await fetch(`${MOCK}/api`, { method: 'POST', headers: { Authorization: danUid, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_cards', args: { room_id: st.room.id } }) });
assert.equal(r.status, 400); assert.match((await r.json()).error, /Only the host/);
log('player calling host-only get_cards → rejected');

console.log('\nPAGE ERRORS:', errors.length ? errors : 'none');
await browser.close();
if (errors.length) process.exit(1);
console.log('E2E PASSED');
