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
// a page that throws in a loop must not take the test runner's memory with it: keep each distinct error once
errors.push = function (m) { if (this.length < 200 && !this.includes(m)) { console.log('PAGE ERROR ' + m.slice(0, 400)); Array.prototype.push.call(this, m); } return this.length; };

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
// This run checks screens and flows, not timing: keep the one-ability-at-a-time TV stage clear so its
// scripted presses never land inside each other's hold (the stage has its own logic test).
setInterval(() => fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: 'update rooms set ability_until = null' }) }).catch(() => {}), 300).unref();
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
assert.equal(cards.length, 12);                       // default: 9 roles + 3 drinkers; the Lovebird pair is a bonus on 2 of them
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
// Phone UI v2 helpers: every move is MOVES → the row → a player → CHECK (YES arms after 0.6s) → the result
const H = {
  async home(pg) {                                   // back to Home from wherever the phone is (notices, results, cases)
    for (let i = 0; i < 12; i++) {
      if (await pg.$('.pu-beer') && !(await pg.$('.pu-notice'))) return;
      // a notice's own key first (THE BOOKIE IS OPEN has a back key on cards 2 and 3 that would loop)
      const b = await pg.$('.pu-notice .pu-ok') ?? await pg.$('.pu-result .pu-ok, .pu-take .take-skip, .pu-back, .pu-key:has-text("CLOSE THE CASE"), .pu-key:has-text("HIDE MY FILE"), .pu-key:has-text("Later")');
      if (b) await b.click().catch(() => {});
      await sleep(250);
    }
  },
  async moves(pg) { await H.home(pg); await pg.click('.moves-tile'); await pg.waitForSelector('.pu-list'); },
  async move(pg, key) { await H.moves(pg); await pg.click(`[data-move="${key}"]:not([disabled])`); },
  pick: (pg, name) => pg.click(`.pu-prow:has-text("${name.toUpperCase()}")`),
  async yes(pg) { await pg.waitForSelector('.pu-yes:not([disabled])'); await pg.click('.pu-yes'); },
  async result(pg) { await pg.waitForSelector('.pu-result'); const t = await pg.textContent('.pu-result'); await pg.click('.pu-result .pu-ok'); return t; },
  async ok(pg) { await pg.waitForSelector('.pu-notice'); await pg.click('.pu-notice .pu-ok'); await sleep(200); },
  async file(pg) { await H.home(pg); await pg.click('.file-tile'); await pg.waitForSelector('.pu-dossier'); },
};
for (let i = 0; i < NAMES.length; i++) {
  const ctx = await withFonts(await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${NAMES[i]}: ${e.message}`));
  await page.goto(`${APP}/join/${CODE}`);
  await page.waitForSelector('.pu-polar');
  if (i === 0) await shot(page, '03a-phone-join-empty');
  await page.setInputFiles('.pu-polar input', { name: 'me.png', mimeType: 'image/png', buffer: await picture(COLORS[i], NAMES[i][0]) });
  await page.waitForSelector('.pu-polar img');
  await page.fill('input[placeholder="YOUR NAME"]', NAMES[i]);
  if (i === 0) await shot(page, '03-phone-join');
  await page.click('.pu-join');
  await page.waitForSelector('.code6');                 // step 3: the code from your card
  P[NAMES[i]] = { ctx, page };
}
log('12 phones joined');
await sleep(800);
await shot(tv, '04-lobby-joined');
await shot(P.Harry.page, '04b-phone-code-step');

// ---------- redeem role codes ----------
const pick = r => { const i = cards.findIndex(c => c.role === r); return cards.splice(i, 1)[0].code; };
const deal = { Harry: 'intruder', Megan: 'betrayer', Kai: 'forger', Jake: 'medic', Maya: 'detective', Sophie: 'drinker', Tom: 'drinker',
               Priya: 'drinker', Olly: 'scrooge', Ellie: 'skank', Dan: 'davyjones', Chloe: 'jester' };
for (const [n, role] of Object.entries(deal)) {
  const pg = P[n].page;
  await pg.fill('.code6', pick(role).replace('-', '').toLowerCase());
  await pg.click('.pu-open');
  await pg.waitForSelector('.pu-dossier, .pu-notice');
  // Saboteurs get a YOUR TEAM notice as soon as a teammate is in; it comes before the file
  while (await pg.$('.pu-notice')) await H.ok(pg);
  await pg.waitForSelector('.pu-dossier');
}
// the Intruder was told about the Forger when Kai opened his file
for (const n of ['Harry', 'Kai']) { while (await P[n].page.$('.pu-notice')) await H.ok(P[n].page); if (!(await P[n].page.$('.pu-dossier'))) await H.file(P[n].page); }
await shot(P.Jake.page, '05-phone-file-medic');
await shot(P.Harry.page, '05b-phone-file-intruder');
assert.match(await P.Sophie.page.textContent('.pu-dossier'), /Tom/);
assert.match(await P.Tom.page.textContent('.pu-dossier'), /Sophie/);
assert.match(await P.Harry.page.textContent('.pu-d-team'), /SABOTEURS/);
assert.match(await P.Kai.page.textContent('.pu-d-team'), /SABOTEURS/);
assert.match(await P.Megan.page.textContent('.pu-d-team'), /DRINKERS/);
assert.match(await P.Olly.page.textContent('.pu-d-team'), /CHAOS/);
await H.home(P.Jake.page);
await shot(P.Jake.page, '05c-phone-home');
for (const n of NAMES) await H.home(P[n].page);
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
// LEVELS 1-4: level 1 is pacified and levels are capped by games played until 2 h before the deadline. This run uses powers
// from the start, so lift the cap (deadline 100 min away) and give everyone level 2 (3 beers); the Forger (forge) and the Scrooge (graffiti) need level 3.
await fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: "update rooms set deadline_at = now() + interval '100 minutes' where code = $1", params: [CODE] }) });
await fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: "update players p set beers = case when p.name in ('Kai', 'Olly') then 6 else 3 end from rooms r where r.id = p.room_id and r.code = $1", params: [CODE] }) });
await sleep(2500);
for (const n of NAMES) await H.home(P[n].page);              // clear the private "LEVEL 2 · your file has changed" notices

// ---------- beers + milestone (Chloe logs nothing → she'll be the Slacker) ----------
for (const n of NAMES.filter(n => n !== 'Chloe')) await P[n].page.click('.pu-beer');
await sleep(500);
assert.match(await P.Dan.page.textContent('.pu-beer'), /NEXT IN/);
for (let i = 0; i < 13; i++) { await tv.keyboard.press('Space'); await sleep(60); }
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
await tv.keyboard.press('Space');
await tv.waitForSelector('.banner');
await sleep(500);
await shot(tv, '08-milestone-25');
await tv.keyboard.press('-');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
log('beers: phones +11, host +14 −1 = 24, milestone fired');
await H.file(P.Ellie.page);
assert.match(await P.Ellie.page.textContent('.pu-dossier'), /Hidden bonus: \+1 beers/);
await shot(P.Ellie.page, '08b-phone-skank');
await H.home(P.Ellie.page);
log('Skank: Ellie\'s beer secretly counts double (+1 hidden bonus)');
await sleep(3500);
for (const n of ['Harry', 'Sophie', 'Jake', 'Megan']) for (const b of await P[n].page.$$('.pu-rkey')) await b.click();

// ---------- host undo ----------
await tv.keyboard.press('Space');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '25');
await tv.waitForSelector('.hk.undo');
await shot(tv, '09-undo-button');
await tv.click('.hk.undo');
await tv.waitForFunction(() => document.querySelector('#tallyNum')?.textContent === '24');
log('host undo: +1 reverted');
await sleep(3500);

// ---------- Medic heals in advance, Forger forges one ----------
const medicHeal = async name => {
  await H.move(P.Jake.page, 'heal');
  await H.pick(P.Jake.page, name);
  await H.yes(P.Jake.page);
  assert.match(await H.result(P.Jake.page), /DONE/);
};
// drink levels: Jake logs his way to 6 beers → level 3 → a second heal (and a level-up notice)
const jakeId = (await tvState()).players.find(p => p.name === 'Jake').id;
await fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: 'update players set beers = 5, last_beer_at = null where id = $1', params: [jakeId] }) });
await P.Jake.page.waitForFunction(() => !/NEXT IN/.test(document.querySelector('.pu-beer')?.textContent || ''), null, { timeout: 10000 });
await P.Jake.page.click('.pu-beer');
await tv.waitForSelector('.banner-title:has-text("LEVEL 3")', { timeout: 10000 });
await shot(tv, '09b-level-up-tv');
await P.Jake.page.waitForSelector('.pu-notice', { timeout: 10000 });
await shot(P.Jake.page, '09c-level-up-phone');
assert.doesNotMatch(await P.Jake.page.textContent('.pu-notice'), /heal/i, 'the level-up notice never names the perk');
await H.ok(P.Jake.page);
assert.match(await P.Jake.page.textContent('.pu-tb-sub'), /LV3/);
log('drink level: Jake hit 6 beers → LEVEL 3 banner on the TV, a private "your file has changed" notice on his phone');
await sleep(2500);
await H.moves(P.Kai.page);
await P.Kai.page.waitForSelector('[data-move="forge"][disabled]');   // nothing to forge yet
await medicHeal('Tom');
await H.moves(P.Kai.page);
await P.Kai.page.waitForSelector('[data-move="forge"]:not([disabled])', { timeout: 10000 });
await shot(P.Jake.page, '10-medic-heal');
await shot(P.Kai.page, '10b-forger-ready');
await P.Kai.page.click('[data-move="forge"]');
await H.yes(P.Kai.page); await H.result(P.Kai.page);
await H.moves(P.Kai.page);
assert.equal(!!(await P.Kai.page.$('[data-move="forge"]')), false, 'a spent forgery leaves the case');
await H.home(P.Kai.page);
await medicHeal('Ellie');
st = await tvState();
assert.ok(!JSON.stringify(st).includes('forged":true'), 'TV must not learn about the forgery early');
log('Medic healed Tom + Ellie in advance; Forger forged one (the TV knows nothing)');

// ---------- evidence ----------
await H.move(P.Dan.page, 'evidence');
await P.Dan.page.setInputFiles('.pu-ev input', { name: 'ev.png', mimeType: 'image/png', buffer: await picture('#1d4d52', '?', 800, 600) });
await P.Dan.page.waitForSelector('.pu-ev img');
await P.Dan.page.click('.pu-key:has-text("NEXT")');                     // step 2: a one-tap caption, or type one
await P.Dan.page.fill('input[placeholder^="or type"]', 'Harry pouring into the plant');
await shot(P.Dan.page, '11-phone-evidence');
await P.Dan.page.click('text=FILE IT');
await H.result(P.Dan.page);
await H.move(P.Ellie.page, 'evidence');
await P.Ellie.page.setInputFiles('.pu-ev input', { name: 'ev2.png', mimeType: 'image/png', buffer: await picture('#8e2a1a', '!', 600, 800) });
await P.Ellie.page.waitForSelector('.pu-ev img');
await P.Ellie.page.click('.pu-key:has-text("NEXT")');
await P.Ellie.page.click('.pu-tr-chip:has-text("POURING IT AWAY")');
await P.Ellie.page.click('text=FILE IT');
await H.result(P.Ellie.page);
st = await tvState();
assert.equal(st.evidence.length, 2);
assert.deepEqual(st.evidence.map(e => e.caption).sort(), ['Harry pouring into the plant', 'Pouring it away'], 'typed and one-tap captions');
assert.ok(!JSON.stringify(st.evidence).includes(st.players.find(p => p.name === 'Dan').id), 'evidence is anonymous');
log('2 pieces of evidence filed (anonymous)');

// ---------- Forger frames Chloe (once) ----------
await H.move(P.Kai.page, 'frame');
await H.pick(P.Kai.page, 'Chloe');
await H.yes(P.Kai.page);
await H.result(P.Kai.page);
await H.moves(P.Kai.page);
assert.equal(!!(await P.Kai.page.$('[data-move="frame"]')), false, 'spent abilities leave the case');
await shot(P.Kai.page, '11b-forger-framed');
await H.home(P.Kai.page);
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
await tv.waitForSelector('.champ-ov', { timeout: 15000 });                        // the Champ first…
await sleep(900);
await shot(tv, '13a-champ');
assert.ok(await tv.$('.champ-ov [aria-label^="BIGGEST CHAMP"]'), 'the Champ marquee');
assert.equal(!!(await tv.$('.slacker-ov:not(.champ-ov)')), false, '…never on top of the Slacker');
await tv.waitForSelector('.slacker-ov:not(.champ-ov)', { timeout: 15000 });       // …then the Slacker
await sleep(900);
await shot(tv, '13-slacker');
assert.match(await tv.textContent('.slacker-ov'), /CHLOE/);
await tv.click('text=START THE TRIAL');
const vote = async (n, c) => { const pg = P[n].page; await pg.waitForSelector('.pu-voting .pu-prow'); await H.pick(pg, c); await H.yes(pg); await pg.waitForSelector('.pu-voting', { state: 'detached' }); };
await P.Harry.page.waitForSelector('.pu-voting');
await shot(P.Harry.page, '14-phone-trial');
const votes1 = { Harry: 'Dan', Sophie: 'Dan', Jake: 'Dan', Megan: 'Dan', Olly: 'Dan', Ellie: 'Dan', Kai: 'Dan', Tom: 'Harry' };
for (const [v, c] of Object.entries(votes1)) await vote(v, c);
await P.Chloe.page.click('.pu-notrial'); await H.yes(P.Chloe.page);
for (let i = 0; i < 40 && (await tvState()).vote?.voters < 9; i++) await sleep(250);
await sleep(900);
await shot(tv, '15-trial-live-evidence');
assert.equal(await tv.$$eval('.evidence-col .ev', e => e.length), 2, 'both exhibits on the corkboard');
assert.ok(!(await tv.textContent('.trial-ov')).match(/VOTES SO FAR/), 'no live per-suspect counts');
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.verdict', { timeout: 10000 });
await sleep(3200);                                               // the drinkers land last
await shot(tv, '16-verdict-not-guilty');
assert.match(await tv.textContent('.verdict'), /NOT GUILTY/);
// each wrong accuser is told privately: YOU DRINK (the ones who didn't accuse Dan aren't)
for (const n of Object.keys(votes1).filter(n => votes1[n] === 'Dan')) {
  await P[n].page.waitForSelector('.pu-n-wrong', { timeout: 10000 });
  assert.match(await P[n].page.textContent('.pu-notice'), /YOU DRINK/);
  if (n === 'Harry') await shot(P[n].page, '16b-phone-you-drink');
  await H.ok(P[n].page);
}
assert.equal(!!(await P.Chloe.page.$('.pu-n-wrong')), false, 'NO TRIAL voters are not told to drink');
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

// ---------- Ellie: real heal → SAVED (NEXT UP carries on through the queue by itself) ----------
await waitPhase('waiting');
assert.ok(await tv.$('.chain-stop'), 'the host can stop the run after this one');
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
await waitPhase('waiting');
if (await tv.$('.chain-stop')) await tv.click('.chain-stop');                  // stop the run after this one
await H.move(P.Olly.page, 'swap');
await H.pick(P.Olly.page, 'Kai');
await H.yes(P.Olly.page);
await H.result(P.Olly.page);
await tv.waitForSelector('.sg-ov .sg-title.swap');
assert.match(await tv.textContent('.sg-ov'), /Chloe\? Bah! Kai looks far more punishable/);
await sleep(2600);
await shot(tv, '25-scrooge-swap');
await tv.waitForSelector('.sg-ov', { state: 'detached', timeout: 8000 });
await spinOnPhone('Kai');
await tv.waitForFunction(() => /Any last words/.test(document.querySelector('.wheel-actions')?.textContent || ''), null, { timeout: 60000 });
await H.move(P.Olly.page, 'respin');
await H.yes(P.Olly.page);
await H.result(P.Olly.page);
await tv.waitForSelector('.sg-ov .sg-respin-title');
await sleep(2400);
await shot(tv, '25b-scrooge-respin');
await waitPhase('accept', 60000);
await tv.click('text=ACCEPT');
log('Scrooge: swapped Chloe → Kai, then forced a re-spin');

// ---------- THE BOOKIE IS OPEN: once, when game 1's whole aftermath has cleared (the queue is empty now) ----------
await tv.waitForSelector('.bookie-open-ov', { timeout: 20000 });
await sleep(1600);
await shot(tv, '25c-bookie-open');
st = await tvState();
assert.ok(st.room.settings.bookie_announced, 'the moment is stamped once on the server');
await tv.waitForSelector('.bookie-open-ov', { state: 'detached', timeout: 25000 });
{
  const bp = P.Sophie.page;                                       // every phone gets its own 3 cards on CHECK YOUR PHONE
  await bp.waitForSelector('.pu-bookie-x', { timeout: 15000 });
  await shot(bp, '25d-phone-bookie');
  for (const k of ["HOW DO I BET?", "AND IF I WIN?", "GOT IT"]) { await bp.click(`.pu-bookie-x .pu-ok:has-text("${k}")`); await sleep(800); }   // the key ignores a 2nd tap within 600 ms
  assert.equal(!!(await bp.$('.pu-bookie-x')), false, 'GOT IT closes the cards');
}
for (const n of NAMES) await H.home(P[n].page);                   // everyone else taps through
log('THE BOOKIE IS OPEN: the TV explains betting once; every phone gets 3 cards');
await sleep(1000);
// graffiti stays secret until the next punishment starts
await H.move(P.Olly.page, 'graffiti');
await P.Olly.page.fill('.pu-text', 'Lick the floor');
await P.Olly.page.click('.pu-key:has-text("NEXT")');
await H.yes(P.Olly.page);
await H.result(P.Olly.page);
await sleep(2500);
assert.equal(!!(await tv.$('.sg-ov')), false, 'no graffiti animation when it is written');

// ---------- Detective: investigate, hold to read (3s, once) ----------
await H.move(P.Maya.page, 'investigate');
await H.pick(P.Maya.page, 'Harry');
await H.yes(P.Maya.page);
await H.result(P.Maya.page);
await H.moves(P.Maya.page);
await P.Maya.page.waitForSelector('.pu-hold');
await P.Maya.page.hover('.pu-hold');
await P.Maya.page.mouse.down(); await sleep(120); await P.Maya.page.mouse.up(); await sleep(300);   // a quick tap burns nothing
assert.match(await P.Maya.page.textContent('.pu-hold .v'), /HOLD TO READ/, 'a tap does not burn the reading');
await P.Maya.page.mouse.down();
await P.Maya.page.waitForSelector('.pu-hold .v.g, .pu-hold .v.i');
await shot(P.Maya.page, '26-detective-hold');
assert.match(await P.Maya.page.textContent('.pu-hold .v'), /SABOTEUR/);
assert.match(await P.Maya.page.textContent('.pu-hold small'), /One of these 3/, 'level 2 Detective gets a vague reading of 3 people');
await P.Maya.page.mouse.up();
await sleep(300);
assert.equal(!!(await P.Maya.page.$('.pu-hold .v.g')), false, 'letting go hides the reading');
assert.match(await P.Maya.page.textContent('.pu-hold .v'), /HOLD AGAIN/);
await P.Maya.page.mouse.down();                                   // the rest of the 3 seconds, then it burns
await P.Maya.page.waitForFunction(() => /GONE/.test(document.querySelector('.pu-hold .v')?.textContent ?? ''), null, { timeout: 6000 });
await P.Maya.page.mouse.up();
await P.Maya.page.mouse.down(); await sleep(400);
assert.equal(!!(await P.Maya.page.$('.pu-hold .v.g')), false, 'file burns after one read');
await P.Maya.page.mouse.up();
await H.home(P.Maya.page);
log('Detective: Harry read as a SABOTEUR while held; gone on release, never again');

// ---------- the Hit: Intruder names Jake as the Medic ----------
await H.move(P.Harry.page, 'hit');
await H.pick(P.Harry.page, 'Jake');
await P.Harry.page.waitForSelector('.pu-choice');
await shot(P.Harry.page, '27-hit-roles');
assert.equal(!!(await P.Harry.page.$('.pu-choice:has-text("Drinker")')), false);
assert.equal(!!(await P.Harry.page.$('.pu-choice:has-text("Cursed")')), false);
await P.Harry.page.click('.pu-choice:has-text("Medic")');
await H.yes(P.Harry.page);
assert.match(await H.result(P.Harry.page), /DONE[\s\S]*was the Medic/, 'the Hit lands: Jake was the Medic');
await tv.waitForSelector('.hit-ov', { timeout: 10000 });
await sleep(900);
await shot(tv, '28-hit-cover-blown');
await P.Jake.page.waitForSelector('.pu-notice', { timeout: 10000 });
await shot(P.Jake.page, '29-phone-cover-blown');
await H.ok(P.Jake.page);
await H.moves(P.Jake.page);
assert.equal(!!(await P.Jake.page.$('[data-move="heal"]')), false, 'burned Medic has no powers');
await H.home(P.Jake.page);
await H.moves(P.Harry.page);
assert.equal(!!(await P.Harry.page.$('[data-move="hit"]')), false, 'the used Hit is hidden until the next game');
await H.home(P.Harry.page);
log('Hit: Jake exposed as Medic, powers burned; Intruder waits for the next game');
await sleep(5000);

// ---------- Betrayer: wrong, then right → Saboteur (no Intruder powers) ----------
await H.move(P.Megan.page, 'accuse');
await H.pick(P.Megan.page, 'Dan');
await H.yes(P.Megan.page);
assert.match(await H.result(P.Megan.page), /Take a drink/);
assert.equal(!!(await P.Dan.page.$('.pu-notice:not(.pu-bookie-x)')), false, 'accused must not be told');   // THE BOOKIE's cards are for everyone
await H.move(P.Megan.page, 'accuse');
await H.pick(P.Megan.page, 'Harry');
await H.yes(P.Megan.page);
await P.Megan.page.waitForSelector('.pu-n-team', { timeout: 10000 });
await shot(P.Megan.page, '30-betrayer-guilty-now');
await P.Harry.page.waitForSelector('.pu-n-team', { timeout: 15000 });
await H.ok(P.Megan.page);
await H.moves(P.Megan.page);
assert.equal(!!(await P.Megan.page.$('[data-move="hit"]')), false, 'Betrayer gets no Intruder powers');
await H.home(P.Megan.page);
log('Betrayer: wrong guess → drink; right guess → Saboteur, no powers');

// ---------- game 2 → Slacker Olly → Trial convicts Harry → rehab, knife to Megan ----------
for (const n of ['Harry', 'Kai']) {                             // the whole team hears the Betrayer joined
  await P[n].page.waitForSelector('.pu-n-team', { timeout: 15000 });
  await H.ok(P[n].page);
}
for (const n of NAMES) await H.home(P[n].page);
// one beer per 3 minutes: the clock moves on (the test runs faster than a party)
await fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql: 'update players set last_beer_at = null' }) });
for (const n of NAMES.filter(n => n !== 'Olly')) await P[n].page.waitForFunction(() => !/NEXT IN/.test(document.querySelector('.pu-beer')?.textContent || ''), null, { timeout: 10000 });
for (const n of NAMES.filter(n => n !== 'Olly')) await P[n].page.click('.pu-beer');
await tv.click('.btn-game');
await tv.fill('.modal input[type=text]', 'Flip Cup');
await tv.click('text=START GAME');
await sleep(2500);
await tv.click('.btn-game');
await tv.click('text=CONFIRM 0 LOSERS');
await tv.waitForSelector('.slacker-ov:not(.champ-ov)', { timeout: 20000 });
assert.match(await tv.textContent('.slacker-ov'), /OLLY/);
await tv.click('text=START THE TRIAL');
await P.Dan.page.waitForSelector('.pu-voting');
for (const v of ['Sophie', 'Jake', 'Dan', 'Ellie', 'Chloe', 'Maya', 'Tom', 'Priya']) await vote(v, 'Harry');
for (let i = 0; i < 40 && (await tvState()).vote?.voters < 8; i++) await sleep(250);
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.verdict', { timeout: 10000 });
await sleep(1500);
await shot(tv, '31-verdict-guilty');
assert.match(await tv.textContent('.verdict'), /GUILTY/);
await tv.click('.verdict >> text=CLOSE');
await P.Harry.page.waitForSelector('.pu-n-rehab', { timeout: 10000 });
await shot(P.Harry.page, '32-phone-rehab');
await P.Megan.page.waitForSelector('.pu-n-knife', { timeout: 10000 });
await shot(P.Megan.page, '33-phone-knife');
await H.ok(P.Megan.page);
await H.moves(P.Megan.page);
await P.Megan.page.waitForSelector('[data-move="hit"]');
await H.home(P.Megan.page);
st = await tvState();
assert.equal(pl('Harry').rehab, true); assert.equal(pl('Harry').public_role, 'intruder');
await sleep(1500);
await shot(tv, '34-board-rehab');
log('game 2: Slacker Olly; Trial convicts Harry → rehab; the knife passes to Megan');

// ---------- refresh persistence ----------
await P.Sophie.page.reload();
await P.Sophie.page.waitForSelector('.pu-beer, .pu-notice');
await H.file(P.Sophie.page);
assert.match(await P.Sophie.page.textContent('.pu-dossier'), /LOVEBIRD/);
await H.home(P.Sophie.page);
await tv.reload();
await tv.waitForSelector('.tally-panel');
log('phone + TV refresh: session, role and state restored');

// ---------- host free spin on the whole room ----------
await tv.click('.btn-free');
await tv.click('.chip:has-text("Birthday spin")');
await tv.click('.btn.danger:has-text("SPIN NOW")');
await tv.waitForSelector('.sg-ov [aria-label="Lick the floor"]', { timeout: 10000 });   // held-back graffiti plays before the spin
await sleep(3000);
await shot(tv, '34a-scrooge-graffiti');
await tv.waitForSelector('.sg-ov', { state: 'detached', timeout: 8000 });
log('Scrooge graffiti: announced at the start of the next punishment, not when written');
await tv.waitForSelector('.wh-name:has-text("THE WHOLE ROOM")');
await sleep(1500);
await shot(tv, '34b-free-spin-room');
await waitPhase('accept', 60000);
await tv.click('text=ACCEPT');
log('host free spin: the whole room spun, nothing logged against anyone');
await sleep(1500);

// ---------- the Jester gets convicted and takes revenge ----------
await hostApi('start_vote', { kind: 'trial' });
await P.Chloe.page.waitForSelector('.pu-voting');
for (const v of ['Sophie', 'Jake', 'Dan', 'Ellie', 'Maya', 'Tom', 'Priya']) await vote(v, 'Chloe');
for (let i = 0; i < 40 && (await tvState()).vote?.voters < 7; i++) await sleep(250);
await tv.click('text=END VOTE NOW');
await tv.waitForSelector('.jr-ov', { timeout: 10000 });
await sleep(5500);
assert.match(await tv.textContent('.jr-ov'), /The Jester is choosing/);
assert.match(await tv.textContent('.jr-plaque'), /Chloe, the Jester/);
assert.ok(await tv.$('.jr-ov .jr-makeup'), 'the Jester\'s selfie wears the makeup');
await shot(tv, '34c-verdict-jester');
await P.Chloe.page.waitForSelector('.pu-jester-rev', { timeout: 10000 });
await shot(P.Chloe.page, '34d-phone-jester-revenge');
await H.pick(P.Chloe.page, 'Tom');
await H.yes(P.Chloe.page);
await tv.waitForSelector('.jr-vname:has-text("TOM")', { timeout: 10000 });
st = await tvState();
assert.deepEqual(st.queue.filter(q => q.times === 3).map(q => pl('Tom').id === q.player_id), [true]);
assert.equal(pl('Chloe').public_role, 'jester');
await sleep(3500);
await shot(tv, '34e-jester-revenge');
await tv.click('.jr-btn:has-text("CLOSE")');
await tv.waitForSelector('.jr-ov', { state: 'detached' });
log('Jester: Chloe convicted → picked Tom for a ×3 punishment');
await sleep(4000);

// ---------- v5: the Angel (Holy Nova + blessing), Walk of Shame, Davy Jones' Locker, Aaron's Plate ----------
{
  const sqlq = (sql, params) => fetch(`${MOCK}/__sql`, { method: 'POST', body: JSON.stringify({ sql, params }) });
  const rid = (await tvState()).room.id;
  await sqlq("update players set beers = greatest(beers, 6) where name = 'Ellie'", []);   // the Skank's plate unlocks at level 3
  // a non-drinker joins (API only) and the host makes them the Angel
  const angelUid = crypto.randomUUID();
  await sqlq('insert into auth.users (id, is_anonymous) values ($1, true)', [angelUid]);
  const angelApi = async (action, args = {}) => {
    const r = await fetch(`${MOCK}/api`, { method: 'POST', headers: { Authorization: angelUid, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, args: { room_id: rid, ...args } }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
  };
  const angelId = (await angelApi('join', { code: CODE, name: 'Gabriel' })).player_id;
  await sleep(1500);
  await tv.click(`.case[data-id="${angelId}"]`);
  for (let i = 0; i < 3 && !(await tvState()).players.find(p => p.id === angelId)?.public_role; i++) {   // the confirm can reset if the modal re-renders mid-tap
    await tv.click('text=MAKE ANGEL'); await tv.click('.modal >> text=SURE?', { timeout: 3000 }).catch(() => {}); await sleep(800);
  }
  await tv.waitForSelector(`.case.angel[data-id="${angelId}"] .halo`);
  await sleep(3500);
  await angelApi('holy_nova');
  await tv.waitForSelector('.hn2-stage', { timeout: 10000 });
  await sleep(3400);
  await shot(tv, '34f-holy-nova');
  await tv.waitForSelector('.hn2-stage', { state: 'detached', timeout: 20000 });
  await angelApi('angel_bless', { index: 0 });
  await tv.waitForSelector('.bl-stage', { timeout: 10000 });
  await sleep(4300);
  await shot(tv, '34g1-blessed');
  await tv.waitForSelector('.bl-stage', { state: 'detached', timeout: 20000 });
  await sleep(1500);
  assert.match((await tvState()).room.segments[0], /^Safe \(blessed by the Angel\)/);
  await shot(tv, '34g-angel-board');
  log('Angel: made by the host, halo on the board; Holy Nova +10; blessed a wheel punishment into SAFE');

  // Walk of Shame (Judge Dredd isn't in this deck, so play the TV scene straight from an event)
  await sqlq(`insert into events (room_id, kind, payload) values ($1, 'shame', $2)`, [rid, JSON.stringify({ player: pl('Kai').id, caption: 'Hid three pints in the plant pot' })]);
  await sqlq('update rooms set version = version + 1 where id = $1', [rid]);
  await tv.waitForSelector('.sh2-stage', { timeout: 10000 });
  await sleep(3700);
  await shot(tv, '34h-walk-of-shame');
  await sleep(2200);
  await shot(tv, '34h2-i-am-the-law');
  await tv.waitForSelector('.sh2-stage', { state: 'detached', timeout: 20000 });

  // the curse passes from Priya to Tom (no host step: Priya just beat Tom) and plays out on the board
  await sqlq(`insert into games (room_id, name, status, matchup, losers, ended_at) values ($1, 'Arm wrestle', 'ended', $2::jsonb, $3::uuid[], now())`,
             [rid, JSON.stringify([[pl('Priya').id], [pl('Tom').id]]), `{${pl('Tom').id}}`]);
  await sqlq('update rooms set version = version + 1 where id = $1', [rid]);
  await H.moves(P.Priya.page);
  await P.Priya.page.waitForSelector('[data-move="curse"]', { timeout: 10000 });
  await P.Priya.page.click('[data-move="curse"]');
  await H.pick(P.Priya.page, 'Tom');
  await H.yes(P.Priya.page);
  await H.result(P.Priya.page);
  await tv.waitForSelector('.cv', { timeout: 10000 });
  await sleep(1900);
  await shot(tv, '34g2-curse-pass-vines');
  await sleep(1500);
  await shot(tv, '34g3-curse-pass-burnt');
  await tv.waitForSelector('.cv', { state: 'detached', timeout: 10000 });
  st = await tvState();
  assert.equal(pl('Tom').cursed, true); assert.equal(pl('Priya').cursed, false);
  log('Curse pass: Priya → Tom, the shadow crosses, thorns possess, the skull brands the card');

  // Davy Jones' Locker: Sophie asks the host; Davy Jones (Dan) drags Priya down
  await H.move(P.Sophie.page, 'rest'); await H.yes(P.Sophie.page); await H.result(P.Sophie.page);
  await tv.waitForSelector('.modal:has-text("DAVY JONES\' LOCKER?")', { timeout: 10000 });
  await tv.click('.modal >> text=10 MIN');
  await tv.waitForSelector('.lk-stage', { timeout: 10000 });
  await sleep(3000);
  await shot(tv, '34i0-locker-chain');
  await sleep(4500);
  await shot(tv, '34i1-locker-cell');
  await tv.waitForSelector(`.case[data-id="${pl('Sophie').id}"] .locker`, { timeout: 10000 });
  await P.Sophie.page.waitForSelector('.pu-notice', { timeout: 10000 }); await H.ok(P.Sophie.page);
  await H.move(P.Dan.page, 'lock');
  await H.pick(P.Dan.page, 'Priya');
  await H.yes(P.Dan.page);
  await H.result(P.Dan.page);
  await tv.waitForSelector(`.case[data-id="${pl('Priya').id}"] .locker`, { timeout: 10000 });
  await P.Priya.page.waitForSelector('.pu-notice:has-text("DAVY JONES")', { timeout: 10000 });
  await H.ok(P.Priya.page);
  await P.Priya.page.waitForSelector('.pu-locker', { timeout: 10000 });
  await hostApi('queue_add', { player_id: pl('Priya').id, reason: 'test' });
  await hostApi('queue_add', { player_id: pl('Priya').id, reason: 'test 2' });
  await tv.waitForSelector(`.case[data-id="${pl('Priya').id}"] .held-tag`);
  await tv.waitForSelector('.lk-stage', { state: 'detached', timeout: 30000 });   // let the Locker scenes finish
  await sleep(1200); await tv.waitForSelector('.lk-stage', { state: 'detached', timeout: 30000 });
  await shot(tv, '34i-davy-jones-locker');
  await shot(P.Priya.page, '34j-phone-locker');
  log('Davy Jones\' Locker: Sophie asked, host approved 10 min; Davy Jones locked Priya; one punishment waits, the second dropped');

  // Aaron's Plate: the Skank fires up the BBQ; everyone grabs a sausage on their phone
  await H.moves(P.Ellie.page);                                          // (home() clears the LEVEL 3 notice)
  await P.Ellie.page.waitForSelector('[data-move="bbq"]', { timeout: 10000 });
  await P.Ellie.page.click('[data-move="bbq"]');
  await H.yes(P.Ellie.page);
  await tv.waitForSelector('.ap-ov .ap-grill', { timeout: 10000 });
  st = await tvState();
  assert.equal(st.plate.eaters.length, 10, 'the Angel and the two locked players sit it out');
  assert.equal(st.plate.picks && Object.keys(st.plate.picks).length, 0);
  for (const n of ['Kai', 'Dan', 'Jake', 'Maya', 'Tom']) {
    try { await P[n].page.waitForSelector('.pu-plate', { timeout: 10000 }); }
    catch (e) { await shot(P[n].page, 'zz-bbq-' + n); throw e; }
    await P[n].page.click('.pu-bbq-pick:not([disabled])');
    await sleep(300);
  }
  await shot(P.Olly.page, '34k-phone-plate');
  await sleep(1200);
  await shot(tv, '34l-aarons-plate');
  for (let t = 0; t < 60 && (await tvState()).plate.status !== 'closed'; t++) await sleep(500);   // served when time's up
  await sleep(5000);
  await shot(tv, '34m1-aarons-plate-eating');
  await sleep(11000);                                                   // the snap, the hand, the verdict
  await shot(tv, '34m-aarons-plate-served');
  st = await tvState();
  assert.ok(st.queue.some(q => q.reason === 'Ate the dirty sausage') || st.players.find(p => p.id === st.plate.loser)?.held, 'the dirty sausage eater is punished');
  await tv.click('.ap-close');
  await tv.waitForSelector('.ap-ov', { state: 'detached' });
  log(`Aaron's Plate: ${st.players.find(p => p.id === st.plate.loser)?.name} ate the dirty sausage`);
}

// ---------- countdown end → the Saboteurs win ----------
await hostApi('update_settings', { deadline_at: new Date(Date.now() + 4000).toISOString() });
await tv.waitForSelector('.big-overlay .bo-title', { timeout: 20000 });
await sleep(1500);
await shot(tv, '35-guilty-win');
assert.match(await tv.textContent('.bo-title'), /THE SABOTEURS WIN/);
assert.match(await tv.textContent('.bo-sub'), /\+ 2 SKANK BONUS = \d+ \/ 100/);
await H.home(P.Ellie.page);
await P.Ellie.page.waitForSelector('.pu-end-tally');               // the end-of-night screen: your side's result
assert.match(await P.Ellie.page.textContent('.pu-hero'), /THE SABOTEURS WIN/, 'before the reveal the hero shows only the group result');
await P.Ellie.page.click('.pu-end-cover');                         // your own result sits behind a cover
assert.match(await P.Ellie.page.textContent('.pu-end-mine .pu-display'), /YOU LOST/, 'the Skank (a Drinker) lost when the Saboteurs won');
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
