# Retention: keeping one 7-hour night alive

Researched 2026-10-03, seven days before the party. "Retention" here means **keeping 12 people playing and enjoying
one night from ~18:00 to the 01:00 deadline**. It does not mean bringing the group back for future nights (see the
short note at the end).

Checked against README.md, the Roadmap memory (2026-10-02), the server logic in
`supabase/migrations/20261005000002_v3_logic.sql`, and the earlier studies in this folder (`jackbox.md`,
`gartic-phone.md`, `machine-party.md`, `lethal-company.md`). Ideas from those studies are **ranked and placed on the
night's timeline** here, not described again. Follow the pointers for the full designs.

**The host's brief:** *"I need this to be a world-class game-level experience with obvious flavour from inside jokes
etc. This house party is meant to reignite future plans."*

That brief sets three bars for the plan:
- **World class:** each item is benchmarked against the best of its kind, with a citation. Fewer, better items.
- **Inside-joke flavour** is a first-class requirement (§4).
- **The night must end by setting up the next one** (§5, FINALE & NEXT TIME).

**House rules for every proposal:**
- **Add or extend; don't replace.** Anything that changes an existing rule is marked **CHANGES:** (a re-tune the
  host allowed) or **REPLACES:** (there are none).
- **Keep what players already love:** the evidence photos, the Trial and the big TV scenes. Nothing here removes them.
- **Secrecy:** the TV never shows who holds which role, or who started a move.
- **Drinking safety:** nothing may reward drinking *faster*. Late in the night things get **simpler and gentler**, never heavier.

---

## 0. THE ARC (the host's spec, mapped onto the server)

### 0.1 What the code does today

- **A level is just a beer count.** `_level(beers)` (line 32) returns L1 for 0–3 beers, **L2 from 4** and **L3 from 8**.
  - Every power check reads `lvl := _level(me.beers)` (lines 865, 1111 and 1408, and line 1834 for `get_state`).
- **"Once per game" means once per host game.** It is keyed on `_games_done()`, so the host's game cadence *is* the
  powers' cadence.
- **The maths:** 100 beers ÷ 12 players ≈ **8.3 each over 7 h**, which is **≈1.2 an hour**. At that pace:
  - an average player reaches **L2 about 3.3 h in (~21:20)**;
  - they reach **L3 about 6.7 h in (~00:40), roughly at the deadline**.
- **So for most of the room the L3 signature moves come at the very end.** That covers Bomb, Penny Drop,
  Jack-in-the-Box, Walk the Plank, Ninja, Judge Dredd, Oathbreaker and Surgeon.
  - Only heavy drinkers see them earlier.
  - That's a drink-to-unlock incentive: the opposite of what we want.
  - The host's chaos arrives late or not at all.
- **Before L3, the only mini-games are:**
  - **Dodge** (the Assassin below L3);
  - **Aaron's Plate** (the Skank from L2, or the host at any time).
- **The opposite problem:** someone who downs 8 beers in hour 1 opens the full kit before anyone has played a game.

### 0.2 The three acts

A server-side **act** is worked out from public facts only: games played, Trials closed and the clock. It never
depends on anyone's role.

| Act | Starts when (whichever comes first) | Feel |
|---|---|---|
| **I · THE BUILD-UP** | LET'S GO | Learn the board, the phones, the wheel, the beer button. Quiet, secret groundwork. |
| **II · THE HEAT** | the **first Trial after game 1** closes; or game 2 starts; or **LET'S GO + 90 min** | Busier but not insane. Each team gets one showpiece. |
| **III · THE MADNESS** | the **Trial after game 3** closes; or game 4 starts; or **deadline − 2 h** (23:00) | Everything is on: the evolutions, the big mini-games, THE SHIFT. |
| *(LAST ORDERS)* | deadline − 45 min | Not a new act. Nothing new unlocks; timers stretch and screens simplify (§6, item 7). |

The time fallbacks matter. README says "plan on 3 games", so at a slow pace the third Trial could land near midnight.
The **deadline − 2 h** fallback guarantees at least two hours of Act III.

**Effective level.** This **extends** `_level` rather than replacing it:

```
E = least(act, greatest(_level(beers), act_floor))
act_floor = 1 in Acts I–II; 2 when Act III opens; 3 from Act III + 60 min
```

- **The act caps the level.** Drinking fast in hour 1 can't open Act III powers.
- **The floor is time-based, not drink-based.** In Act III a light drinker still evolves, so nobody sits powerless
  all night and the signature moves stop being a reward for drinking.
- **CHANGES: the thresholds** (the host allowed this). L2 moves from 4 to **3 beers** and L3 from 8 to **6 beers**,
  so the drink path matches a moderate pace (~6 beers by 23:00) instead of a heavy one.
  - Update `_level()` (line 32), the Skank multiplier (line 556) and the `level_up` events at `v_cnt in (4, 8)`
    (line 559 becomes `(3, 6)`), plus every "4 beers" / "8 beers" string on the phones and in README.
  - **Also `src/lib/roles.ts`:** `levelFor`, `toNextLevel`, `PERKS` and the printed `CARD_TEXT` ("At 8 beers you become the NINJA", "triple from 8 beers"). The cards are printed before the night, so either reprint them after the ARC ships, or reword them to be threshold-neutral ("as the night goes on") so they are true with ARC ON or OFF. **TODO:** decide which before printing.
  - The time floors only matter for genuinely light drinkers.

### 0.3 The power table: before and after

"Act" is the earliest act a power can be used in. It also needs the level shown (E, as defined above).

| Role | Power | **Before** (beers) | **After**: act / level |
|---|---|---|---|
| Medic | 1st heal | L1 (0) | **I** / L1 |
| Medic | 2nd heal | L2 (4) | II / L2 (3 beers) |
| Medic → Surgeon | self-heal, unforgeable heals | L3 (8) | III / L3 |
| Detective | opening reading (group of 3) | L1, at the start | **I** / L1 (unchanged) |
| Detective | +1 reading per game, sharper at L2 | per game / L2 | II / L2 (it's per game already, so this follows naturally) |
| Detective → Judge Dredd | Walk of Shame | L3 | III / L3 |
| Forger | frame; forge a heal (once a night each) | L1 | **I** / L1 |
| Forger → Oathbreaker | Forged Orders | L3 | III / L3 |
| Scrooge | swap, re-spins (= level), graffiti | L1 | **I** / L1 (bites from the first queued punishment; **TODO:** check whether a FREE SPIN round accepts a swap) |
| Scrooge | 2nd swap, **Penny Drop** | L3 | III / L3 |
| Skank | hidden ×2 bonus (passive) | L1 | I (unchanged) |
| Skank | **Aaron's Plate** | L2 (4) | **III** / L2. **CHANGES:** moved later to keep Act II to two showpieces; the host can still fire the Plate any time. |
| Skank → Gobshite | ×3 bonus | L3 | III / L3, using the **raw drink level capped by the act, with no time floor**. This is the one power that moves the score, so it must never come from the clock alone. |
| Intruder | **The Hit** | L1 (from the start) | **II** / L1. **CHANGES:** see the balance check below. |
| Intruder | a missed Hit still tells you if they're a Drinker | L2 (4) | II / L2 |
| Intruder / knife | **The Bomb** | L3 | III / L3 |
| Betrayer | accusations (2, or 3 at L2) | L1 | **II** / L1. **CHANGES:** no team-up before the Drinkers have had a Trial. |
| Betrayer | hint | L3 | III / L3 |
| Assassin | **Dodge** | L1–2 | **II** / L1 *(an Act II showpiece)* |
| Assassin → Ninja | shuriken | L3 | III / L3 |
| Davy Jones | **Locker drag** | L1 | **II** / L1 *(an Act II showpiece)* |
| Davy Jones → Kraken | **Walk the Plank** | L3 | III / L3 |
| Jester | revenge (when convicted) | at any Trial | II (Trials start after game 1 anyway) |
| Jester → Pennywise | **Jack-in-the-Box** | L3 | III / L3 |
| Cursed / Lovebird | passes; shared punishments | after games | unchanged |
| Angel | Holy Nova, bless | any time | unchanged (public, host-assigned) |
| Anyone | ⚓ TOO PISHED? (a Locker rest) | any time | **unchanged: never gated** |

**Why Dodge and the Locker drag are Act II's two "fun" unlocks:**
- **One per team.** Dodge is a Saboteur move; the Locker drag is a Drinker move. A generic "new powers" announcement
  therefore hints at neither side.
- **Both are already designed as low-level powers,** so nothing is rebalanced.
- **Both are short TV scenes** (the WANTED poster with a 6-second read; the sea water flooding a card).
- **Both are low-harm:** a Dodge miss is one wheel spin, and the Locker drag *protects* its target.

**Balance check:**
- **Saboteurs don't strike before the Drinkers can respond.** In Act I the Drinkers get the Detective's reading and
  the Medic's heal. The Saboteurs only get the Forger's frame, which is quiet groundwork that pays off at the Trial.
  The Hit and the Betrayer's team-up open in Act II, after the first Trial has given the room a chance to accuse
  someone.
  - In Act III, the Bomb and the Ninja arrive alongside the Surgeon (unforgeable heals) and Judge Dredd.
- **The chaos roles stay fun all night.** The Scrooge is live from Act I (whenever the host spins the wheel). The
  Jester has Trials to bait from Act II and Jack-in-the-Box in Act III.
- **Nobody is powerless all night.**
  - In Act I, Drinker, Davy Jones, Assassin, Intruder, Betrayer and Jester have nothing to press, for about an hour.
    That's deliberate: the build-up.
  - From Act II every role has something. The plain Drinker has TAKE IT FOR THEM, the Trial vote and evidence photos.
  - The Act III time floor means even a light drinker evolves.

### 0.4 The curtain: how an act change is announced

- **TV:** a 10–12 s scene at the next free moment (`enqueue`, never during a round or mini-game):
  - the stage lights cut;
  - a title card: **"ACT II · THE HEAT"**;
  - one line in THE COMPANY's voice (§6, item 5), using the gag file's copy;
  - the generic stamp **NEW POWERS ARE ACTIVE**.
  - At Act III, add a one-screen **shift review** with the crew's grade against the pace line (`lethal-company.md` §3,
    with its perks dropped). The grade uses public numbers only.
  - **PREVIOUSLY TONIGHT** (~20 s, before the title card): three or four public callbacks from this room's own
    event log, each shown with the person's polaroid. The flavour engine (§4) picks them. For example:
    - "19:42 · AIDAN ATE THE DIRTY SAUSAGE";
    - "JAMIE STEPPED IN FOR BETH";
    - "THE TRIAL SAID KYLE. THE TRIAL WAS WRONG."
  - Then the FILM THIS lamp, and every polaroid on the board flickers once. **All of them, identically.**
- **Phones:** **every** phone, a plain Drinker's included, buzzes once and shows the same full-screen card:
  **"YOUR FILE HAS BEEN UPDATED."**
  - The detail sits behind the existing 🔒 YOUR MOVES cover.
  - A Drinker's detail is real but generic ("NEW: you can vote at the Trial · TAKE IT FOR THEM"), so the length and
    timing of the buzz match everyone else's.
  - This follows the "private level-ups" decision in the phone-UI memory.
- **Never** name a role or a power on the TV. "The Medic can heal now" would be a leak.
- **The LV badges on the TV** show E, which uses the same formula for everyone.
  - From Act III + 60 min everyone is LV3, which incidentally closes the badge leak noted in `machine-party.md` §3
    (a Bomb narrowing the Intruder down to the visible LV3 players).

### 0.5 Host overrides, late joiners, the deadline

- **The host has three controls** (⚙ → Game & Deadline → ACTS, one big button each):
  - **NEXT ACT NOW** skips ahead;
  - **HOLD** stops automatic advances, e.g. during dinner;
  - **ARC: OFF** gives E = `_level(beers)` and today's behaviour exactly. That's the safety valve one week out.
- **Acts never go backwards.** UNDO of a GAME OVER doesn't rewind an act that has already been announced. Store
  `act` and `act_at` on `rooms` and only ever raise them.
- **Late joiners** come straight into the current act, with the same E formula and floors. They never need to "drink
  to catch up", which is a safety improvement.
- **Changing the deadline** recalculates the time fallbacks. The TEST: DEADLINE IN 1 MIN control should jump to Act III.
- **Server work:**
  - a `_act(room)` function and an `act` column (plus `act_at`, and `started_at` set at LET'S GO);
  - a function giving E for a player;
  - in each `case` branch, a check of the act against that power's minimum (the table above);
  - an `act` event and an `act` field in `get_state`;
  - tests in `tests/` covering: the act cap, the time floor, ARC OFF giving exactly today's behaviour, and that no
    act event payload contains a role.
- **Effort: M–L.** **Before 10 Oct: yes, behind ARC ON/OFF.**

---

## 1. Dead zones found in the code

1. **Act I in all but name, for hours (18:00 to ~21:20).** Nobody reaches L2 for about 3 h at the average pace.
   Before game 1 there is no punishment queue unless the host makes one. The only mini-games are Dodge and the host's
   Aaron's Plate. Some phones (Drinker, Jester) have nothing to press at all.
2. **The middle sag (~21:00–23:30).** The night's loop is "game → Champ/Slacker → Trial → wheel queue", repeated.
   - **The wheel is static.** `segments` is set once in Setup; the only thing that ever changes it is the Scrooge's
     single graffiti.
   - Nothing marks progress except the rack. The pace lamp is a silent corner widget.
3. **The big mini-games may never happen.** Bomb, Penny, Jack and Plank need an L3 role that is uncaught, not burned
   and not in the Locker (`bomb_start` and the others, lines 1434–1474). Most players reach L3 around the deadline,
   and a caught or locked role never fires. The host has no path to them; Aaron's Plate is the only host-fired game
   (line 1237).
4. **Late night: drunk players, and more of them out.**
   - Reaction windows are fixed: Dodge 6 s, Plank 14 s, Plate 25 s, the vote timer.
   - Rehab players can't vote (line 651).
   - Locker players can't vote, play or use powers, and `_mg_eligible` excludes them.
   - The out players have nothing to do but watch.
   - Musters (90 s) and summons get longer as people wander off.
5. **Out players.** Rehab means no vote and no powers: only the shiv and the beer button. The Locker means no
   anything. The Angel is never in a game. That's about 2–5 of 12 people by 23:00 with no input. Note that rehab players
   are *not* excluded from `_mg_eligible`, so they do still play mini-games.
6. **The target is hit early.** `paceOf` (TvRoom.tsx line 735) switches to "TARGET HIT · EVERY BEER NOW IS A BONUS".
   - Nothing else changes. Holy Nova is blocked, the Saboteurs can no longer win, and the Champ/Slacker loop keeps
     rewarding the biggest drinker.
   - For the last 1–2 h there is nothing at stake but more beer.
7. **The target is clearly out of reach.** The lamp goes red and says **"DRINK FASTER · 3.4 EACH AN HOUR"**, with no
   upper limit on the per-person figure.
   - **This is the sharpest safety issue in the game.**
   - The Slacker still punishes whoever drank least since the last game.
8. **Wheel repetition.** With roughly 8–12 fixed segments and 30+ spins a night, every punishment is seen 3 or more times by midnight.

---

## 2. Lessons (with sources)

1. **The interest curve: open with a hook, ease off, build bigger and bigger, end on a finale.** The curve is fractal:
   each level has its own small curve with something new. → Three acts, each with its own curtain and its own new
   thing. [Schell, *The Art of Game Design* ch. 16, via Game Studies wiki](https://game-studies.fandom.com/wiki/Interest_Curve);
   [Lex's notes](https://notesbylex.com/the-art-of-game-design-a-book-of-lenses-2nd-edition-by-jesse-schell)
2. **Pacing is a loop of build-up, peak and relax.** Left 4 Dead's AI Director stops spawning at the peak, then
   enforces a 30–45 s relax before building again. Its strength is "holding back".
   → INTERMISSION, and one big scene at a time (`enqueue`). [L4D wiki: The Director](https://left4dead.fandom.com/wiki/The_Director);
   [Wikipedia: Left 4 Dead](https://en.wikipedia.org/wiki/Left_4_Dead)
3. **Escalating checkpoints give a long session several climaxes.** Lethal Company splits the run into quota
   "days" with a reckoning at each. → The act curtains and shift reviews. Sources in `lethal-company.md` §1.
4. **A scheduled late-game twist re-energises a long match.** Mario Party's *Last Five Turns* event gives the
   standings, then adds a rule twist (doubled spaces, a bonus for whoever is last).
   → The Act III curtain and THE WHEEL CHANGES. [Super Mario Wiki](https://www.mariowiki.com/Last_Five_Turns_Event);
   [Giant Bomb](https://www.giantbomb.com/last-five-turns-event/3015-3010/)
5. **A long night works as a run of short games.** Blood on the Clocktower games last 60–90 min, and groups play 2–3
   back to back. Machine Party chains games with no gap. → The host's games are the chapters, and THE SHIFT adds a
   dense burst. [Wikipedia: BotC](https://en.wikipedia.org/wiki/Blood_on_the_Clocktower);
   [Josh Humphriss review](https://joshhumphriss.com/articles/botcreview); `machine-party.md` lessons 1 and 10.
6. **The dead keep a vote, and late on they decide the game.** In BotC the dead keep one ghost vote, and "smart
   players on the final day will be talking to the dead". → A Gallery vote for out players.
   [Glyph & Grok review](https://glyphngrok.substack.com/p/game-review-blood-on-the-clocktower);
   [BotC wiki: Storyteller Advice](https://wiki.bloodontheclocktower.com/Storyteller_Advice)
7. **Eliminated players keep playing.** In Trivia Murder Party, ghosts still answer, and in the final round they can
   overtake the living and steal their life. → Ghosts and the Switchboard.
   [Jackboxpedia: TMP2](https://jackbox.wiki/wiki/Trivia_Murder_Party_2); [Jackbox wiki: TMP](https://jackboxgames.fandom.com/wiki/Trivia_Murder_Party)
   Werewolf groups fix the classic boredom of elimination the same way: an "afterlife" side game for the dead, plus
   hard discussion timers.
   [BGG: Werewolf without player elimination](https://boardgamegeek.com/thread/2287147/werewolf-without-player-elimination);
   [Official Werewolf rules](https://officialgamerules.org/game-rules/werewolf/)
8. **Reactivity makes players feel seen.** Hades tracks enough state that its characters remark on your most recent
   death and on past events, without repeating themselves. That's the benchmark for the flavour engine's callbacks.
   [Christi Kerr: how Hades' dialogue rewards failure](https://www.christi-kerr.com/post/how-the-dialogue-system-in-hades-rewards-failure);
   [Screen Rant: Hades script stats](https://screenrant.com/hades-dev-script-voice-lines-huge-massive/)
9. **Timers are accessibility.** Jackbox stretches every timer for players who need it. At 00:30, drunk thumbs are an
   accessibility problem. → LAST ORDERS. `jackbox.md` lesson 9.
10. **Reaction and choice times degrade steadily as blood alcohol rises.** Clear loss of reaction time and control
    sets in around 0.08–0.10%. → Late in the night, stretch reaction windows and cut choices; never add a new mechanic
    after midnight.
    [PubMed 10952075](https://pubmed.ncbi.nlm.nih.gov/10952075/); [PMC3510176](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3510176/);
    [UWM BASICS: BAC effects](https://uwm.edu/basics/wp-content/uploads/sites/192/2020/03/BAC-Effects.pdf)
11. **The body clears about one standard drink an hour, and nothing speeds that up.** The game's own target is about
    1.2 an hour each, so it is already at the edge. Any mechanic that pushes *faster* is the wrong lever.
    → Gentle pace wording, the LONG SHOT state, and the act floors based on time rather than beers.
    [Healthline, citing NIAAA](https://www.healthline.com/health/alcohol/blood-alcohol-level-chart);
    [Cleveland Clinic: BAC](https://my.clevelandclinic.org/health/diagnostics/22689-blood-alcohol-content-bac)
12. **Inside jokes beat generic content, as long as the whole room shares them.** Jackbox ships a custom-episode
    editor so groups can run Quiplash on their own prompts. Its writers' advice: "definitely use any inside jokes… but
    make sure it's a collective inside joke", and be specific. → The gag file (§4).
    [Jackbox: custom episodes](https://www.jackboxgames.com/blog/about-custom-episodes-in-quiplash-2-drawful-2);
    [Jackbox: how to write a good Quiplash prompt](https://www.jackboxgames.com/blog/how-to-write-a-good-quiplash-prompt)
13. **People share stories about themselves, not charts.** Spotify Wrapped makes the user the main character, in
    bite-size 9:16 slides that need no cropping. → The keepsake card (§5).
    [Nativa on Wrapped](https://thenativa.com/blog/how-spotify-wrapped-turned-data-into-a-viral-marketing-moment/);
    [NoGood on Wrapped](https://nogood.io/blog/spotify-wrapped-marketing-strategy/)

**The variety budget** (from lessons 1 and 4): about one new thing an hour, and one big thing per act. Never stack two
new mechanics inside the same 15 minutes.

---


## 3. The 7-hour timeline

This assumes LET'S GO at 18:00 and the deadline at 01:00. **Plan on 5 host games rather than README's 3**: games are
both the chapters and the refresh for the "once per game" powers.

| Time | Act | What's new |
|---|---|---|
| 18:00–18:30 | I | Joining, envelopes, the how-to primer (Roadmap #2). The opening memo: *"Target: 100. Deadline: 01:00. Expected effort per officer: **one, maybe two.**"* |
| 18:30–19:15 | I | The host's **Aaron's Plate** (the light mini-game; *"Aaron swears it's fine"*) and one **whole-room FREE SPIN** to teach the wheel. Quiet secret groundwork. **Game 1**, Champ/Slacker, then the **first Trial**. |
| ~19:30 | **II curtain** | PREVIOUSLY TONIGHT, then "ACT II · THE HEAT · **ONE MAYBE TWO** NEW POWERS ARE ACTIVE". Now open: the Hit, Dodge, the Locker drag, the Betrayer's accusations. The Act II wheel. |
| 19:30–21:45 | II | Games 2 and 3 with their Trials. Dodge and the Locker give a scene or two per game. Callbacks start to appear in the memos. **INTERMISSION** around 21:00 (*"RELAX."*: food, water, the evidence reel so far). |
| ~22:00 (≤ 23:00) | **III curtain** | PREVIOUSLY TONIGHT, the shift review, "ACT III · THE MADNESS", then **THE SHIFT** fires right away. The Act III wheel, with its inside-joke segments. |
| 22:00–00:15 | III | All evolutions; the role-fired Bomb, Penny, Jack, Plank, Ninja and Dredd; games 4 and 5; a second SHIFT. Nicknames appear on summons and at the wheel. An INTERMISSION around 23:15. |
| 00:15–01:00 | LAST ORDERS | No new mechanics. Reaction timers ×1.5. A last Trial. The pace text softens. |
| 01:00 | **finale** | §5: the ending scene → REVEAL ALL → the case file → the Casebook → keepsakes → **THE CASE CONTINUES…** |

---

## 4. THE FLAVOUR ENGINE: inside jokes as a first-class system

**Benchmarks:**
- **Hades** for reactivity (lesson 8): the game remembers what happened and says so, without repeating itself.
- **Quiplash's custom episodes** for group-specific content (lesson 12): the jokes must be collective and specific.

The aim is that **every act curtain, memo and finale names people in the room and remembers what they did tonight.**

### 4.1 Flavour the game already has (catalogued from the code)

- **Aaron's Plate.** The dirty sausage ("One of them fell on the balcony… Aaron swears it's fine", PhoneHome.tsx
  line 318), with the crooked sausage and the fly on the TV.
- **The Skank, "a lowly goblin"** (roles.ts), who becomes **THE GOBSHITE**.
- **The Locker:** ⚓ **TOO PISHED?**, Davy Jones and the film scene "SENTENCED TO THE DEEP".
- **Scrooge copy:** *SWAPSIES!* and *RE-SPIN, PEASANTS*.
- **Jester's Revenge**, with the Jester's own selfie in jester make-up.
- **Judge Dredd's "I am the law"** Walk of Shame.
- **The default wheel** (`_default_segments`): the hat of shame, "Room writes a text from your phone (within reason)",
  a chorus the room picks, and others.
- **Name-clip summons** for the guest list in `public/assets/names/manifest.json`: Aaron, Harry, Aidan, Sol, Joshua,
  Jamie, Kyle, James, Jimmy, Beth, Emma, Matthew, Thomas, Munro, Jenkins, Luke and Eva. The "A-A-RON!" clip is in
  NAMES-A.md.
- **The site name, `gammonbeastshundred`.** "The Gammon Beasts" is a crew name waiting to be used on screen.

### 4.2 The gag file (editable, pre-filled with the host's jokes)

`public/flavour.json` is a plain file the host edits in any text editor. Later it could become a Setup → FLAVOUR screen.
- **Where:** TV only, loaded at start-up. The phones never need it, except for shared copy strings.
- **Effort:** S for the file plus a loader.
- **Before 10 Oct:** **yes**.

```json
{
  "crew": "THE GAMMON BEASTS",
  "nicknames": { "Aaron": "GLOOPSTEIN", "Munro": "BOGARDE", "Joshua": "BLUB" },
  "catchphrases": {
    "kicker":  "ONE MAYBE TWO",
    "calm":    "RELAX.",
    "plea":    "PULEASE"
  },
  "memos": [
    "Expected effort per officer: one, maybe two.",
    "{crew}: {left} to go. Head Office says RELAX. Head Office is lying.",
    "Reminder: the sausages are fine. Aaron has confirmed it. Twice."
  ],
  "callbacks": [
    { "on": "bbq_loser",  "line": "{name} ATE THE DIRTY SAUSAGE AT {time}. WE REMEMBER." },
    { "on": "stand_in",   "line": "{name} TOOK IT FOR {other}. A HERO. ALLEGEDLY." },
    { "on": "verdict_wrong", "line": "THE TRIAL SAID {name}. THE TRIAL WAS WRONG. PULEASE." }
  ],
  "wheel": {
    "I":   ["Finish your drink", "Safe", "Sing a chorus the room picks", "…"],
    "II":  ["One maybe two (sips, your call)", "…"],
    "III": ["Do your best Gloopstein", "Plead your case: one sentence, starting with PULEASE", "RELAX: 60 seconds of silence while the room heckles", "…"]
  }
}
```

**How the TV uses it:**
- **Nicknames are occasional and never replace the real name.** The display format is
  **"AARON 'GLOOPSTEIN'"** or **"GLOOPSTEIN (AARON)"**, used on:
  - at most 1 in 3 wheel call-ups;
  - the Act III curtain;
  - the finale.
  The real name stays primary on the WANTED poster and on anything a drunk player has to act on. The name-clip summons
  stay the real names.
- **Catchphrases are copy:**
  - **"ONE MAYBE TWO"** is the Act I → II kicker. It is also a gentle wheel segment whose amount is the victim's own
    call. That is a drinking-safety gag: it lets people pick the small number.
  - **"RELAX."** goes on calm screens: INTERMISSION, the Locker's flooded card, the phone's waiting state and LONG SHOT.
  - **"PULEASE"** goes on pleas and defences: the Trial's accused-card subtitle ("THE DEFENCE SAYS: PULEASE"),
    TAKE IT FOR THEM's prompt, and the Jester's revenge chooser.
- **Callbacks** (the Hades lesson) are filled from the public `events` table:
  - `bbq` loser, stand-ins (`take_it`), verdicts, Jester's revenge victim, shivs, the first beer, Champs, Walks of Shame.
  - Each event can be called back **at most once** a night, ranked by how funny it is.
  - They are used in PREVIOUSLY TONIGHT, in COMPANY memos and in the Casebook.
  - The Act III payoff: *"Previously tonight: GLOOPSTEIN (AARON) served the dirty sausage. AIDAN ate it."*
- **Secrecy:** callbacks come only from public events that the TV has already shown. Never "started by", never a
  role before the reveal, and never who filed an exhibit.
- **No beef (the host's rule):** every line teases the *moment*, never the person. No line pits two guests against
  each other ("X vs Y", rankings of who is worse), and nothing mocks how much or how little someone drank.
- **Hold for review:** anything the room typed (evidence captions, graffiti) is only reused in a callback if the host
  left it visible, as in `gartic-phone.md` P6.

---

## 5. FINALE & NEXT TIME (the night sets up the next one)

**Benchmarks:**
- **Spotify Wrapped** (lesson 13) for the keepsake.
- **Lethal Company's "your new quota is…"** (`lethal-company.md` §2) for the deadpan escalation.
- **Machine Party's RUN IT BACK and regulars** (`machine-party.md` R0 and R6) for remembering who came.

| # | Item | Where | Effort | Before 10 Oct? |
|---|---|---|---|---|
| F1 | **The ending scene** (YOU'RE FIRED, or QUOTA MET with an overtime line) | TV | S–M | **yes** |
| F2 | **THE CASE CONTINUES…** cliffhanger card | TV | S | **yes** |
| F3 | **Keepsake card** per player (9:16, after the reveal) | phone + TV | M | cut-down, yes |
| F4 | **Save the night:** export + regulars | server / script | S (script) → M | the script, yes |
| F5 | **Casebook** (public chapters) + awards | TV + server | M | cut-down only |

- **F1 · The ending scene.**
  - **What:** this is `lethal-company.md` §2, flavoured.
    - **Short of the target:** *"THE GAMMON BEASTS: TERMINATED. SHORT BY 7."* Every polaroid is ejected identically,
      so no Saboteur faces go first.
    - **Target met:** *"QUOTA MET. RELAX."*, then a beat, then *"Your new quota is 101."*
  - **Risk:** none, because everyone is treated the same and it plays before the reveal.
- **F2 · THE CASE CONTINUES…**
  - **What:** this plays after the reveal and the Casebook, and is the very last screen.
    - A case-file stamp: **CASE #001 · CLOSED**, then a red stamp **REOPENED**.
    - One line built from tonight: either *"The Saboteurs were never all caught"* or *"Someone in this room still owes
      Aaron a sausage."*
    - The tease: *"CASE #002 · {date or 'SOON'} · QUOTA: 101"*.
  - **Where:** the date comes from the gag file (a `next` field), or it stays **SOON**.
  - **Why:** a cliffhanger plus a concrete next step. "Reignite future plans" made literal.
  - **Effort:** S.
- **F3 · Keepsake card ("TAKE YOUR FILE HOME", `gartic-phone.md` P2).**
  - **What:** after REVEAL ALL, each phone gets a **9:16 case file** to keep: the selfie mugshot, the real role, the
    nickname if there is one, and **one callback about you** ("ATE THE DIRTY SAUSAGE · 19:42").
    - Also: a verdict stamp, and the crew line "THE GAMMON BEASTS · CASE #001".
    - It's saved with `navigator.share` and a file.
  - **Why:** Wrapped's lesson that people share stories about themselves.
  - **Drinking safety:** **no beer count on the card** and no "most beers" title. Celebrate the moment, not the volume.
  - **Secrecy:** only after `reveal_all`.
  - **Cut-down for 10 Oct:** the TV shows a QR code to a page rendering the cards. Otherwise, after the party.
- **F4 · Save the night, so night 2 recognises people.**
  - **What exists:**
    - Phones keep their anonymous `auth.uid` (`persistSession`, `storageKey thehundred-player`) and their name
      (`thehundred-name`).
    - But **no table links rooms**, the selfie is retaken every time, and nothing survives a cleared browser.
    - Rooms persist until the host deletes them, and `delete_room` cascades every row.
    - **Storage files are never deleted:** `selfies/` and `ev/` have no DELETE policy. The RoomList's "…and photos?"
      warning is inaccurate: the photos stay in the public bucket.
  - **Before 10 Oct:** a one-off **export script** that dumps the room after `reveal_all` (players, selfies,
    roles, events, evidence and the result) to JSON. That's the night's archive, and the seed for night 2.
  - **After:** `machine-party.md`'s host-owned **regulars** (re-claim your face on the join page) and **RUN IT BACK**.
- **F5 · The Casebook** (`gartic-phone.md` P1) is the flavour engine's long form: every callback in order, ending on
  F2. Ship only the public chapters; the secret chapters must stay server-locked until the reveal.

---

## 6. Upgrades, ranked for the 7-hour arc

These are fewer and stronger than the first draft. Each one names its benchmark.

| # | Upgrade | Benchmark | Act slot | Where | Effort | Before 10 Oct? |
|---|---|---|---|---|---|---|
| 1 | **THE ARC** (§0) | Schell's interest curve; Mario Party's Last Five Turns | all | server + TV + phone | M–L | **yes** (behind ARC ON/OFF) |
| 2 | **THE FLAVOUR ENGINE** (§4): the gag file, callbacks, PREVIOUSLY TONIGHT | Hades; Quiplash custom episodes | the curtains, memos, finale | TV | S → M | **yes** (the file + curtain callbacks) |
| 3 | **THE SHIFT** | Machine Party's back-to-back games | opens Act III | server + TV | M | **yes** |
| 4 | **FINALE & NEXT TIME** (§5) | Lethal's new quota; Wrapped | 01:00 | TV (+ phone) | S–M | F1, F2 and the F4 script: **yes** |
| 5 | **THE COMPANY** memos, voiced by the gag file | Lethal Company's quota checkpoints | all | TV | S | **yes** |
| 6 | **INTERMISSION** ("RELAX.") | the L4D Director's relax phase | II, III | TV + server hold | S | **yes** |
| 7 | **LAST ORDERS** | Jackbox timers as accessibility | the last 45 min | server + TV | S | **yes** |
| 8 | **QUOTA MET / LONG SHOT** | NIAAA pacing (lesson 11) | whenever it happens | TV + a setting | S | **yes** |
| 9 | **Out players: Ghosts → Gallery** | BotC ghost votes; Trivia Murder Party ghosts | II–III | phone + TV (+ server) | S → M | Ghosts **yes**; Gallery maybe |
| 10 | **THE WHEEL CHANGES** (per act, from the gag file) | Mario Party's late-game rule twist | each curtain | TV + Setup | S–M | maybe |

**11. FILM THIS lamp** (`lethal-company.md` R6, TV, S, **yes**): the 1.5 s "● REC" pre-roll before the curtains and the
big scenes, so phones are up for the payoff.

**Dropped from the list to keep it short** (still good; see their own docs): DRAG THEM HERE (S, worth doing if there's
a spare hour), the Switchboard and the Ghost Bell, and the shift-review perks. The
shift review itself is folded into the Act III curtain.

### Notes per item (the rest is in §0, §4, §5 and the source docs)

1. **THE ARC.**
   - **Secrecy risk:** the curtain is generic, every phone gets the same buzz and card, and the act comes from public
     facts only.
   - **Drinking safety:** a net improvement. The act cap and the time floors stop power from depending on drink.
2. **THE FLAVOUR ENGINE.**
   - **Secrecy risk:** callbacks use public events only.
   - **Drinking safety:** never joke about volume.
   - **The "no beef" rule** applies to every line.
3. **THE SHIFT** (`machine-party.md` P1).
   - **What:** host-fired, Act III and later, never in LAST ORDERS.
   - **Secrecy risk:** rounds inside a Shift look exactly like role-fired ones, with no per-round label. This also
     hides which roles are L3.
   - **Counters:** host-fired rounds have their own counter, so they never use up a role's once-per-game move.
   - **Drinking safety:** a loss is one wheel spin, as today.
4. **FINALE & NEXT TIME.** See §5.
5. **THE COMPANY** (`lethal-company.md` §1 and §4).
   - **What:** memos at 25/50/75, at 3h/2h/1h/30m left and at each curtain.
   - **Copy rule:** lines are sarcastic about the crew and **never say "drink faster"**.
   - **Name:** keep "THE COMPANY", or rename it to suit the noir, e.g. *Head Office*. That's the host's call.
6. **INTERMISSION.**
   - **What:** a host button for 10 or 15 minutes. It sets the existing `ability_until` hold. That field is already
     read at line 1761 (players' held moves get BUSY) and line 1316 (no game can start while it's set). It also
     pauses NEXT UP. The deadline is not paused.
   - **TV:** **RELAX.**, rain, the board dimmed, the public evidence reel and "FOOD · WATER · AIR".
   - **Drinking safety:** positive.
7. **LAST ORDERS** (`jackbox.md` #1 and `gartic-phone.md` P7).
   - **Reaction windows ×1.5:** the Dodge read, the Plank, Jack turns, the Plate, and TAKE IT FOR THEM's 4 s lock.
   - **Waiting windows shorter:** musters drop from 90 to 60 s.
   - Nothing new unlocks.
   - **Fairness:** the change is room-wide and announced (the Dodge/Plank fairness rules require that). The fuse and
     the pop number stay untouched.
8. **QUOTA MET / LONG SHOT.**
   - **When the target is met early:**
     - The lamp reads **"QUOTA MET · THE CASE IS STILL OPEN"**, and the rest of the night is about catching the Saboteurs.
     - A Setup option **SLACKER AFTER THE QUOTA: OFF** (on by default) stops the fewest-beers punishment.
     - There is **no** live "Saboteurs at large: N" counter: Betrayer team-ups and host-set role counts could leak it.
   - **When the target is out of reach** (needs more than 2.5 each an hour with under 2 h left):
     - The lamp reads **"LONG SHOT · 31 TO GO · RELAX."**, without the per-person figure or "DRINK FASTER".
   - **CHANGES:** only the lamp text, plus an off-able Slacker switch. The win rules are untouched.
9. **Out players.**
   - **Ghosts** (`machine-party.md` P5): a cosmetic heckle pad for the Locker, rehab and the Angel.
   - **The Gallery** (`jackbox.md` #6): a non-binding Trial vote, shown after the verdict.
   - **Rules:**
     - rehab players are known Saboteurs, so everything they do stays cosmetic;
     - Locker players opt in and are never buzzed;
     - never show who pressed what.
10. **THE WHEEL CHANGES.**
    - **What:** up to three segment lists (I, II and III) in the gag file or Setup, swapped in at each curtain with an
      unbolt-and-lower scene. `segments` is already editable through `update_settings`, and the Scrooge's graffiti
      carries over.
    - **Hard copy rule:** the Act III wheel may be wilder in dares and forfeits, never bigger in drink. Add SAFE or
      water segments late, not shots.

---

## 7. Build first: THE ARC, with THE SHIFT as its Act III opener and the flavour engine on the curtains

- **It's the host's spec, and it fixes the longest dead zones at the root.**
  - Today the night's shape comes from beer counts: flat until L3 arrives around the deadline.
  - The ARC turns that into games and Trials, the chapters the host already runs.
  - Each curtain becomes the night's big recurring moment.
- **It's the only change that improves drinking safety structurally.** The power curve stops being a drinking curve.
- **It's additive.** One function for the act, one for E, one act check per power and one curtain scene, all behind
  ARC ON/OFF.
- **Ship THE SHIFT with it.** Without the SHIFT, Act III's chaos still depends on an L3 role being alive, uncaught and awake.
- **Ship the gag file with it.** The curtain is the perfect place for PREVIOUSLY TONIGHT and the nicknames, and that's
  what makes it feel like *their* night rather than a generic game.
- **If there is only one day of work,** do these in order:
  1. the act gate and the curtain (with PREVIOUSLY TONIGHT from the gag file);
  2. F1 and F2 (the ending scene and THE CASE CONTINUES…);
  3. items 5, 7 and 8 (all S).
