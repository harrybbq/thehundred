# The Hundred 🍺

A Jackbox-style party game for **10 October**: the laptop on the TV is the host screen, and guests join on their phones.
The group has to hit **100 beers** before **01:00**. Some of them are lying.

**Teams**
- **DRINKERS** (win if the group hits the target): Drinker, Medic (→ Surgeon), Detective (→ Judge Dredd), Skank (→ The Gobshite), Davy Jones (→ The Kraken), the Angel (host-assigned, public), and the Betrayer (until they find the Intruder).
- **MODIFIERS: Lovebird and Cursed** are not cards or teams of their own. They're printed on top of random dealt cards, whatever the role (even the Intruder), with a small bias towards plain Drinker cards (each about 1.4× as likely as any other card), so spotting one never rules anyone out. Modifiers can't be named in a Hit.
- **SABOTEURS** (win if the group falls short): Intruder, Forger (→ Oathbreaker), Assassin (→ Ninja), and the Betrayer once they team up or inherit the knife. The Saboteurs know each other from the start: each phone names the rest of the team and their roles. A Betrayer isn't told, and isn't shown to the team, until they join; then they see everyone and everyone sees them.
- **CHAOS** (no side): Scrooge, Jester (→ Pennywise).

| What | URL |
|---|---|
| Landing page | https://gammonbeastshundred.netlify.app |
| **TV / host screen** (log in) | https://gammonbeastshundred.netlify.app/tv |
| **Phones** (the QR code on the TV points here) | https://gammonbeastshundred.netlify.app/join/ROOMCODE |
| Printable role cards | https://gammonbeastshundred.netlify.app/cards/ROOMCODE |

Netlify builds automatically from the `claude/party-dashboard-app-hizebt` branch. The backend is the Supabase project **TheHundred** (`cjtimfbwxbyvvcsmdxyg`).

---

## Before the night (once)

1. **Supabase auth settings:** Authentication → Sign In / Providers
   - **Allow anonymous sign-ins: ON.** Phones use this.
   - **Confirm email: OFF**, or confirm your host email once.
   - URL Configuration → Site URL = `https://gammonbeastshundred.netlify.app`
2. Open **/tv** and create your host account (**CREATE ACCOUNT**, email and password).
3. **Create the room** (+ CREATE ROOM). The deadline defaults to **01:00 on 11 Oct**, the end of the 10 Oct party night.
4. **Set the roles in play:** ⚙ → *Roles & Cards*. The default is 12 cards: one each of Intruder, Betrayer, Forger, Medic, Detective, Skank, Davy Jones, Scrooge and Jester, plus 3 Drinkers (the Assassin is off by default). **Modifiers** add no cards: each Lovebird pair is printed on 2 random cards and each Cursed on 1 (default: 1 pair, 1 Cursed).
   Tap **GENERATE CODES** (tap twice to confirm).
5. **Print the cards:** 🖨 *Role cards* (or `/cards/ROOMCODE`) → **PRINT**.
   Use A4 at 100% scale with headers and footers off. That's 4 cards per page. Cut along the dashed lines, put one card in each envelope and shuffle.
   - All blurbs are about the same length, so reading time gives nothing away. Each card also shows its TEAM.
   - Every code is single-use.
   - Cards with a modifier carry a dashed line under their real role ("MODIFIER: LOVEBIRD" / "MODIFIER: CURSED"); Lovebird pairs are linked on the server.
   - Once anyone has redeemed a code, the codes are locked. To re-deal, create a new room.
6. Do a dress rehearsal with 2–3 phones. You can use ⚙ → *Game & Deadline* → **TEST: DEADLINE IN 1 MIN**, then **↺ BACK TO 10 OCT 01:00**.

## On the night

1. Plug the laptop into the TV, open **/tv**, pick the room and press **⛶** (or **F**) for full screen. Tap anywhere once so sound works.
2. The **lobby** shows a huge QR code and the room code. Guests scan it, type their name and take a selfie. Their card appears on the TV.
3. Guests pick an envelope in another room and enter the code on their phone (the manila *FILE* → **OPEN MY FILE**). The lobby shows a ✓ once they have, but never the role. Tapping the file opens their dossier (role, team, powers) for 10 seconds. Abilities live behind a striped **🔒 YOUR MOVES** cover that looks the same on every phone, whatever the role (even with nothing to do). Tap it to open; it locks itself again after 20 seconds without a touch, so someone glancing over your shoulder can't read your role off your buttons.
4. Tap **LET'S GO**. Bring the lobby back any time with **JOIN** for late arrivals.
5. **Beers:** guests tap **+1 I FINISHED A BEER** on their phone. One beer every 3 minutes per phone (stops tap-farming), and the beer is logged against them. You need a redeemed card to log beers or vote.
   The host can also use **+1 / Space**. **−1** is host-only.
6. **Games** (plan on 3):
   - **GAMES** → name the game → optionally **DRAW MATCHUPS** (1 v 1, 2 v 2, 3 v 3 or two teams of everyone). The TV draws the sides at random and the **Cursed player is always drawn in**, so nobody can dodge them. → START GAME. At GAME OVER you can tap "SIDE LOST" to select a whole side.
   - When it ends, tap **GAME OVER** → tap the losers → CONFIRM. They join the punishment queue.
   - The TV then shows, in order: the **Biggest Champ** (most beers since the last game; they get a 👑 and a **golden ticket** that skips their next punishment, which the Forger can't touch; up to 3 tied champs each get one, a bigger tie crowns nobody), then the **Biggest Slacker** (fewest beers logged on their phone since the last game; everyone tied goes in the queue, if everyone ties nobody does). Late joiners are skipped. The Angel and anyone in the Locker are never the Slacker.
   - Then tap **START THE TRIAL** (or **START A TRIAL** from GAMES at any time). Everyone except rehab players (and anyone in the Locker) votes for who they think is a Saboteur. The Angel votes too but can't be accused, or *NO TRIAL*. Evidence photos are pinned down both sides of the TV.
     - A **clear majority** of the votes cast is needed, otherwise there's no verdict.
     - **GUILTY** → they're caught: role stamped, powers gone, **rehab** (no more votes), and into the punishment queue.
       - **Parole: THE SHIV.** Every 3 beers a rehab player logs earns them a shiv, usable once per game. They stab anyone (not the Angel, not someone already stabbed): the TV shows **SHIVVED BY [NAME]** on that player's card, and their next punishment from the queue counts **×2**. Beers logged before rehab don't count, and leaving rehab (host un-exposes) resets the count.
     - **NOT GUILTY** → everyone who accused them takes a "Wrong accusation" drink.
     - **JESTER** → they wanted this. Their role is stamped (no rehab, no wrong-accusation drinks), and their phone picks one of the people who voted for them to take a **×3 punishment** (every landing counts three times). If they dither, the TV has **PICK AT RANDOM FOR THEM**. Once a night; a revealed Jester convicted again counts as NOT GUILTY.
7. **Punishments:**
   - **NEXT UP** calls the next person in the queue. The TV shows *NAME IS FACING THE WHEEL*, and their phone shows the **SPIN** box. It then keeps going by itself: when each punishment finishes, the next person is called, until the queue is empty. Tap the button again (**STOP AFTER THIS**) to pause.
   - Tap a player's card → **PUNISH NOW** to punish someone directly.
   - A **Medic** heal is written in advance on anyone; their next spin shows **SAVED!**. If the **Forger** rewrote that heal, the TV shows SAVED, a pen strikes it out (**FORGED**) and the wheel spins anyway.
   - While the victim's phone shows SPIN, the Scrooge can swap the victim. After the reveal there's a 10-second *"Any last words…"* window (the Scrooge's re-spin chance), then tap **ACCEPT**.
   - If someone's phone dies, use **SPIN FOR THEM**.
   - **FREE SPIN** (next to NEXT UP): the host spins right now for special cases, on a chosen player or on **the whole room** (nothing is logged against anyone). It skips the queue and ignores heals.
8. **Undo:** the yellow **UNDO** button (or Ctrl+Z) reverts the host's last action from the last 2 minutes (a beer, an accept, a verdict, a game over…). Phone beers logged since are kept. Once a player has made any other move since, undo is refused (so it can never erase a Hit or hand back a spent move); fix those by hand.
9. **Expose:** tap **EXPOSE** on a card. The server stamps their **real** role. A Saboteur exposed this way is caught (rehab) on the spot.
10. **Curse passes** need nobody's approval: after a game, the Cursed player can pass it to anyone who lost it, as long as they played and didn't lose themselves (once per game). The TV plays the curse moving.
11. At **01:00** the tally freezes and the TV shows who won. Tap **REVEAL ALL ROLES**: every role is stamped one by one, then the case file lists the Saboteurs, the Betrayer's team-up, the knife, every Detective check and the forged heal.

### The secret powers
| Role | Power |
|---|---|
| **Intruder** | **The Hit:** name a player and a role (Betrayer, Forger, Medic, Detective, Skank, Scrooge or Jester; never Drinker, and never a modifier like Lovebird or Cursed). Right → their cover is blown on the TV, their powers burn, they go in the queue, and you keep your streak (one Hit per game). Wrong → your knife is blunt for the rest of the night. Nobody is told about a miss. At 8 beers: **the bomb** (see Mini-games). |
| **Betrayer** | Two accusations. Right → you join the Saboteurs (no Intruder powers). Wrong → penalty drink. If the Intruder is caught, the **knife** (the Hit) passes to you. |
| **Forger** | Once a night, when the Medic has written a heal, secretly forge it. You never learn whose. Also once a night, **frame** a player: the Detective's next check on them reads GUILTY (the case file reveals it at the end). At 8 beers they become the **Oathbreaker**: once per game, **Forged Orders** rewrites the name on a punishment waiting in the queue (the TV shows the ink change, never who did it; never onto the Angel or anyone in the Locker). |
| **Medic** | Heals on anyone but yourself, at any time (1, then 2 at 4 beers). At 8 beers evolves into the **Surgeon**: one self-heal, and their heals can't be forged. |
| **Detective** | One investigation at the start and one more after each game (max 3): is this player a Saboteur? Vague while sober, sharper from 4 beers. **Press and hold** to read it. It shows for 3 seconds, once, then the file burns. At 8 beers evolves into **Judge Dredd**: readings stay at 2 people, plus once per game a **Walk of Shame** (the TV plays the "I am the law" clip with the victim's photo and the Judge's caption; they drink). Readings never include anyone already exposed or the Angel. |
| **Lovebird** (modifier) | On top of your real role: share every punishment with your partner. The pair (heart + red string) is revealed at your first shared punishment, or when either of you is exposed, but your roles stay secret. |
| **Cursed** (modifier) | On top of your real role: the skull is public, your role isn't. Every punishment spins twice. Beat someone in a game to pass it on: after the game, **PASS THE CURSE** on your phone lists that game's losers (in a 3v3 you choose which of the three). Once per game, no host step. |
| **Skank** | Every beer logged on your own phone secretly counts double for the group (triple from 8 beers). From 4 beers, once per game: **Aaron's Plate** (below). The TV tally only shows real beers; the hidden bonus is added when time runs out ("36 + 12 SKANK BONUS = 48"). A Hit on the Skank freezes the bonus, but what's banked still counts. At 8 beers they become **The Gobshite**. |
| **Scrooge** | Swap the victim (*SWAPSIES!*), force a re-spin (*RE-SPIN, PEASANTS*), scrawl graffiti on the wheel (once). Swaps and re-spins play on the TV straight away; graffiti is only announced (*ON YOUR WHEEL*) when the **next punishment starts**, so its timing doesn't give the Scrooge away. The swap only works after someone's called to the wheel and before they spin, and never onto the Angel or anyone in the Locker. At 8 beers: **Penny Drop** (see Mini-games). |
| **Jester** | No powers until convicted at a Trial: then pick one accuser for a ×3 punishment (see the Trial above). The TV plays *Jester's Revenge* with the Jester's own selfie in jester makeup. At 8 beers they become **Pennywise**: **Jack-in-the-Box** (see Mini-games). |
| **Davy Jones** | Once per game, drag someone to **Davy Jones' Locker** for 15 minutes to protect them: see the Locker below. One prisoner at a time: no new lock while the last one is still down there. Can't lock themselves or the Angel. At 8 beers they become **The Kraken**: **Walk the Plank** (see Mini-games). |
| **Assassin** | A **Saboteur**. Once per game, **Dodge**: throw at someone and choose left, right or high; they're called to the TV and have to read where it's coming from (see Mini-games). At 8 beers they become the **Ninja**: once per game, a silent **shuriken** sends anyone straight to the wheel, no dodging. The TV shows the shuriken hitting the victim's photo but never who threw it (no Trial, so no Jester revenge). |
| **Angel** | Not a card: the host taps a non-drinker and chooses MAKE ANGEL. Public (halo on the TV), never punished, tried, hit or the Slacker. Once a night **Holy Nova** adds 10% of the target to the tally (it can't push it over the line), and once a night they **bless** a wheel punishment, which turns into SAFE for good (never the Scrooge's graffiti). |

### Davy Jones' Locker (anyone)
Too far gone? Tap **⚓ TOO PISHED?** on your phone and the host approves a rest (10 / 15 / 20 / 30 min), or the host locks someone from their card. The TV floods their card with sea water and a countdown. While locked: no powers, no vote, and they're off limits to the Scrooge's swap and the Jester's revenge. **One punishment waits for them** (it comes back first when they're out); anything more is dropped. They can still be named in a Hit. The host can let them out early.

### Aaron's Plate (the dirty sausage)
The Skank (once per game, from 4 beers) or the host (GAMES → 🌭 AARON'S PLATE) fires up the BBQ. The TV never says who. Everyone who isn't locked or the Angel, the Skank included, gets 25 seconds to grab a sausage on their phone, first come first served. **Only the TV shows the tell: the dirty one lies a little crooked, and a lone fly keeps visiting it.** Picks show on the TV as anonymous "? TAKEN" chips, so nobody learns who took which until it's served: everyone tucks in, the last two sit under a flickering spotlight, and the dirty one is unmasked. Anyone who doesn't pick gets a random leftover. Whoever gets the dirty sausage goes in the punishment queue. *Aaron swears it's fine.*

### Mini-games
Some abilities start a short game instead of just handing out a punishment. One runs at a time, and the TV runs the clock.
- **Summoned to the TV** (Dodge, Walk the Plank, Jack-in-the-Box): the TV shows a WANTED poster of the players and their phones buzz with **GET TO THE TV** and an **I'M HERE** button. The game starts (3, 2, 1) once they've all checked in and the TV is free. After 90 seconds the host gets two buttons: **START ANYWAY** (no-shows lose) or **CALL IT OFF** (whoever started it gets the ability back).
- **Dodge** (Assassin): the target has 6 seconds to read where the throw is coming from (left, high or right). Right = it misses; wrong or too slow = to the wheel.
- **Walk the Plank** (the Kraken picks 3): a marker creeps along a plank on each phone, speeding up (and buzzes faster near the edge). Stop it as close to the edge as you dare. Anyone who goes over walks the plank; if nobody does, whoever stopped furthest from the edge does. On the TV everyone walks together, side by side, until the end, so nobody's stop gives anything away. Then the camera drops under the water and the Kraken takes the losers (one, two or all three).
- **Jack-in-the-Box** (Pennywise picks 4, and can pick themselves): turns of 1, 2 or 3 cranks. It pops at a secret number from 8 to 20, and whoever pops it gets the clown and goes to the wheel. Too slow on your turn and it cranks once for you.
- **The bomb** (Intruder / knife holder at 8 beers): phone-only, so anyone anywhere can play. It lands on a random phone; pass it on (not straight back). The fuse is 20 to 40 seconds and secret. Whoever holds it when it blows goes to the wheel.
- **Penny Drop** (Scrooge at 8 beers): phone-only. Everyone gets 10 seconds to call heads or tails; wrong or silent callers take a drink.
- The Angel and anyone in the Locker sit games out. The TV never shows who started one, and nothing secret is ever sent to a screen (not the throw, the pop number, the fuse or the coin).

### One TV moment at a time
Abilities that play on the TV (a Hit, the Scrooge's swap and re-spin, the Ninja's shuriken, the Walk of Shame, Holy Nova, the Angel's blessing, Davy Jones' Locker, Forged Orders, Aaron's Plate and every mini-game) take turns. The first press wins and holds the TV for its animation plus a short break (7 to 13 seconds, 30 for Aaron's Plate). Anyone who presses during that time gets **"SOMEONE BEAT YOU TO IT"** on their phone. Their ability isn't used, and a countdown shows when they can go. Secret abilities (heals, forging, investigations) never wait, so a blocked press can't give away that someone quietly used a power. The host is never blocked.

### Drink levels: the more you drink, the stronger your powers
Levels come from the beers each player logs **on their own phone** (host +1s on the TV don't count). Everyone's level is shown on their TV card (LV1/LV2/LV3), the TV announces each level-up, and the player's phone says what just unlocked.

| Beers logged | 0–3 (LV1) | 4–7 (LV2) | 8+ (LV3) |
|---|---|---|---|
| **Detective** | Vague: a reading covers your target + 2 random others ("one of these 3 is a Saboteur" / "none of them are") | Target + 1 other | **Judge Dredd**: target + 1 other, plus a Walk of Shame |
| **Medic** | 1 heal | 2 heals | **Surgeon**: 2 heals + 1 self-heal, heals can't be forged |
| **Intruder / knife holder** | Name the exact role | A miss still tells you if they're on the Drinkers team | + **the bomb**, once per game |
| **Betrayer** | 2 accusations | 3 accusations | 3 + a hint: the Intruder is one of 3 names |
| **Skank** | Each beer counts ×2 | Each beer counts ×2 | **The Gobshite**: each beer counts ×3 |
| **Davy Jones** | 15-minute lock | 15-minute lock | **The Kraken**: + Walk the Plank |
| **Scrooge** | 1 re-spin, 1 swap | 2 re-spins, 1 swap | 3 re-spins, 2 swaps, + Penny Drop |
| **Forger** | Forge + frame | Forge + frame | **Oathbreaker**: + Forged Orders |
| **Jester** | Revenge if convicted | Revenge if convicted | **Pennywise**: + Jack-in-the-Box |
| **Assassin** | Dodge | Dodge | **Ninja**: the shuriken (no dodging) |

The level is checked at the moment a power is used, and uses are counted, so reaching a new level unlocks the extra use straight away. A Forger's frame still makes the framed target read GUILTY at any level. Beers are self-logged (one every 3 minutes per phone), so watch for anyone racing ahead suspiciously.

**If the Intruder is caught early:** they go to rehab and lose their powers, but they still lose if the group hits the target. The knife passes to a hidden Betrayer. With no Betrayer left, the Saboteurs are just the Forger (and anyone in rehab), and the night is about the 100 beers.

**Evidence:** any guest can tap **SUBMIT EVIDENCE** to photograph suspicious behaviour. Photos are anonymous, shown only on the TV during a Trial, and the host can hide any in ⚙ → *Evidence*.

### Test Lab (host only, before the night)
On the TV's main menu (the room list), tap **🧪 TEST LAB**. It's only there, never inside a live room, so guests can't stumble on it.
- **TV moments** play every big animation (Holy Nova, Blessed, Davy Jones' Locker, Walk of Shame, the Ninja's shuriken, the three Scrooge tricks, Jester's Revenge, Aaron's Plate, the curse pass, the banners, and all five mini-games: Dodge, Walk the Plank, Jack-in-the-Box, the bomb and Penny Drop, each from the call to the TV to the result) with pretend players. Nothing is saved.
- **Practice rooms** are throwaway rooms full of bots, marked PRACTICE on the TV and hidden from your normal room list. Open **🤖 BOTS** on the right to pick a bot, give it any card (or deal the Setup cards to every bot), set its beers to jump drink levels, and use its phone. Everything runs through the real server rules, so what works here works on the night. The server only allows the `lab_*` actions in practice rooms, and only for the host.

### Checklist for the night
- [ ] Anonymous sign-ins ON in Supabase (phones can't join otherwise)
- [ ] Host account works on the party laptop and the room is created
- [ ] Role counts match your guest count, codes generated, cards printed, cut and sealed, plus a pen
- [ ] Deadline shows 01:00 (⚙ → Game & Deadline); target 100
- [ ] Scrooge ability toggles set how you want (⚙ → Game & Deadline)
- [ ] Laptop: charger plugged in, sleep/screensaver off, browser zoom 100%, full screen, sound up
- [ ] Wi-Fi password on the wall next to the QR code (phones need internet)
- [ ] A spare phone for anyone whose battery dies (or use SPIN FOR THEM)
- [ ] Hat of shame 🎩

---

## How it works

- **Frontend:** Vite + React + TypeScript (`src/`). `/tv` is the host screen, `/join` the phone, `/cards` the print page. The look is *noir*: sodium light, rain on a chain-link fence, manila case files, polaroids, rubber stamps and a riveted gunmetal wheel (fonts from Google Fonts). The original single file is kept in `legacy/index.html`.
- **Backend (Supabase):**
  - `supabase/migrations/*_schema.sql` creates the tables. RLS is on everywhere, with **no policies and no table grants** for `anon`/`authenticated`.
  - `*_logic.sql` holds all the game rules:
    - `api_exec(uid, action, args)` handles every change: roles, uses left, no self-heal, Betrayer guess limit, once-per-night Scrooge powers, cooldowns, host-only actions. Each action runs in one transaction with the room row locked. Only `service_role` can execute it.
    - `get_state(code)` is the only way to read data. It returns the public room state plus **only the caller's own secrets**: their role, their team, their Lovebird partner's name, their allies once the Betrayer succeeds, and their power counters. The host/TV view contains no secrets at all.
  - `supabase/functions/api`: the Edge Function checks the caller's session and calls `api_exec` with the verified user id. It's the only way clients can change anything.
  - **Realtime:** each change sends a broadcast "changed" ping on `room:<id>` (with no data), and clients re-fetch `get_state`. Clients also poll every 3 seconds, so a dropped connection or a sleeping phone always catches up. Emoji reactions are sent as broadcast messages.
  - **Storage:** the public `selfies` bucket. Photos are compressed on the phone to roughly 50 KB, and each user can only upload into their own folder.
- **Rulings where the brief left room:**
  - A heal is attached to the player it was cast on. If the Scrooge swaps the victim, the heal **stays with the original victim** for their next spin. It doesn't transfer.
  - Heals and forgeries never ping other screens, so nothing on the TV twitches when they happen. The Forger always rewrites the **oldest** intact heal. If a player somehow has a forged and an intact heal, the intact one wins.
  - **Cursed** means two server-side spins. **Spin again, doubled** chains up to ×4. **Safe** logs nothing.
  - A wrong Betrayer guess logs a "Penalty drink" and shows *"NAME owes a drink"* on the TV, as specified. The accused is never told.

## Developing & tests

```bash
npm install
npm run dev                  # against the real Supabase project

# fully local (no Supabase needed): the same SQL runs in PGlite
npm run mock-server          # terminal 1
npm run dev:mock             # terminal 2 → http://localhost:5173/tv (any email/password)

npm run test:logic           # full game rules + secrecy checks against the SQL
npm run test:e2e             # 1 TV + 12 phones: a whole night in Playwright (needs the two servers above)
                             # E2E_FONTS=1 fetches Google Fonts via curl for realistic screenshots
```

**Mini-game art.** The approved Dodge and Walk the Plank designs are the boards in `design/mockups/` (with the research behind them in `design/research/`); `src/tv/PlankTV.tsx`, `src/tv/DodgeTV.tsx` and `src/phone/MiniPhones.tsx` are their ports. Textures are baked, not drawn live, so a cheap smart-TV browser keeps up: `node scripts/bake-textures.mjs` regenerates `public/textures/` (each under 200 KB; the TV and phones preload them). The galleon's stern is generated by `python design/mockups/tools/ship.py /textures/` → copy `tools/ship.svg` to `src/tv/art/plank-ship.svg`.

To apply database changes, add a migration in `supabase/migrations/` and apply it with the Supabase CLI (`supabase db push`) or MCP. Redeploy the function with `supabase functions deploy api --no-verify-jwt` (the function checks the session itself).
