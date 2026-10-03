# Lethal Company (Zeekerss, 2023): lessons for The Hundred

Researched 3 Oct 2026, a week before the party. Lethal Company is a co-op horror comedy: a crew of contractors scavenges
scrap from moons to meet **the Company's profit quota by a deadline**. Miss it and the crew is **fired and ejected into
space**. That is very close to "100 beers by 01:00 or the Saboteurs win". This file maps what transfers and what doesn't.

**Focus (host update): retention.** The host fears The Hundred is forgotten after the first night. So lessons 13–17
cover what brings Lethal Company groups back night after night, **§2 Retention upgrades comes first**, and every
proposal carries a **retention: high / med / low** mark. "Retention" here means: do the same friends ask for a second
Hundred night, and do they keep talking about the first one in between?

**Checked against before proposing:** README.md, the Roadmap memory (Bookie / BETTING.md, pace tracker extras,
end-of-night awards, /watch spectator), `src/tv/TvRoom.tsx` (`paceOf`, `FINAL_STRETCH`, the rack's 25/50/75 quarter
labels, `BigOverlay` for the win and loss), `src/phone/PhoneHome.tsx` (Locker and rehab states, the shiv),
`src/fx/speak.ts` (browser TTS, GB-voice preference), `src/fx/sound.ts` (synthesised cues incl. `staticNoise`,
`siren`, `alarm`, `toll`) and the existing `.dith` dither texture on the steel panels (`src/styles/board.css`).

**A note on sources.** The fandom wiki blocked fetching (HTTP 402), so mechanics come from the Miraheze wiki, Wikipedia
and press. A few details (the Company's sell-desk voice lines, the performance-report notes) only came through search
summaries of fandom/press pages and are marked *(via search summary)*. Sources disagree on the exact quota formula, so
none is quoted here: it grows **quadratically** each cycle over a **3-day** window. I could not confirm any verbatim
dialogue for the firing scene, so none is invented below.

---

## 1. Design lessons

1. **A quota is a clock plus a number, and the drama lives in the checkpoints.** Each cycle gives the crew 3 days; the
   HUD keeps "days left" in view, and every day ends with a report before the next. The pressure isn't one big
   deadline, it's being re-judged at every step. The Hundred has the number and the clock but only one judgement (01:00),
   plus a silent `FINAL STRETCH` label at 15 minutes.
   Sources: [Miraheze: Quota](https://lethal.miraheze.org/wiki/Quota), [Wikipedia](https://en.wikipedia.org/wiki/Lethal_Company).

2. **The Company is a character, and its voice is cheerful.** On day one the ship's speaker plays an onboarding
   recording ("Welcome to your first day on the job! This is your very own autopilot ship, where you will eat and sleep
   for the duration of your contract…"), and the sell desk answers in HR-speak ("We value your commitment", "Your hard
   work is invaluable to The Company" *(via search summary)*). The menace comes from how upbeat it sounds. TheGamer calls
   the result catharsis: watching "my little guy get blasted into the vacuum of space for failing to accomplish a
   similarly impossible task for their corporate overlord".
   Sources: [Steam thread on the intro speech](https://steamcommunity.com/app/1966720/discussions/0/6292161380817308286/),
   [fandom: The Company](https://lethal-company.fandom.com/wiki/The_Company),
   [TheGamer](https://www.thegamer.com/lethal-company-workplace-horror-comedy-politics-social-impact-quota/).

3. **Being fired is the punchline, not just a fail screen.** Missing quota triggers the "[EJECTED] Disciplinary
   Process": "the airlock vents. You drift into the void." It wipes the save. Losing is a shared, slapstick, *watched*
   event, and it ends the story with a laugh rather than a scoreboard.
   Sources: [deadplate endings](https://deadplate.net/games/lethal-company/endings/), [Miraheze: Quota](https://lethal.miraheze.org/wiki/Quota).

4. **Make lateness pay, then punish lateness.** The Company buys scrap at 30% with 3 days left, then 53%, 77% and 100%
   on deadline day, which tempts crews to hold on. Meanwhile the overtime bonus pays +15 credits per day left for
   finishing *early*. Two opposing pulls create a real decision.
   Sources: [Miraheze: The Company](https://lethal.miraheze.org/wiki/The_Company), [Miraheze: Quota](https://lethal.miraheze.org/wiki/Quota).

5. **Risk without reward gets skipped.** Weather like *Eclipsed* doubles monster spawns but does **not** raise scrap
   value, so players simply avoid those moons; the community wrote mods to add a multiplier. Every risky choice in The
   Hundred must name its prize.
   Sources: [Steam discussion](https://steamcommunity.com/app/1966720/discussions/0/4034728215960880382/),
   [Steam suggestion thread](https://steamcommunity.com/app/1966720/discussions/0/4038103329144961136/),
   [WeatherMultipliers mod](https://github.com/Goryaa/WeatherMultipliers), [Miraheze: Weather](https://lethal.miraheze.org/wiki/Weather).

6. **The operator: one player stays home and runs the others.** A common strategy is to leave one player on the ship
   with the monitor and terminal (switch cameras, open doors, disable turrets) and the walkie-talkie. The signal
   translator broadcasts short typed messages to everyone ("cuts through voice-chat chaos"). The fun is asymmetric
   information: the operator sees, the others act.
   Sources: [Miraheze: Walkie-talkie](https://lethal.miraheze.org/wiki/Walkie-talkie),
   [Game Rant: Signal Translator](https://gamerant.com/lethal-company-how-use-signal-translator-transmitter/),
   [fandom: Guide: Camera duty](https://lethal-company.fandom.com/wiki/Guide:Camera_duty).

7. **The dead stay in the game: they hear the living, the living don't hear them, and together they hold one lever.**
   Spectators watch a living player and hear everything they hear, chat among themselves, and can **unanimously** vote
   to make the ship leave early. Dead players keep laughing and stay invested, but can't spoil anything.
   Source: [Miraheze: Spectator](https://lethal.miraheze.org/wiki/Spectator).

8. **Death has a small, recoverable cost.** A death costs 20% of credits, or 8% if a teammate drags the body back to
   the ship. A walkie-talkie left on when its holder dies hisses static on everyone else's, which is an audio "they're
   gone". The rescue gives the living a heroic, funny errand.
   Sources: [Miraheze: Player Body](https://lethal.miraheze.org/wiki/Player_Body), [Miraheze: Walkie-talkie](https://lethal.miraheze.org/wiki/Walkie-talkie).

9. **Comedy comes from failure plus a channel that breaks.** Zeekerss: his games "had always been funny accidentally.
   But now, they could be funny and scary at the same time"; Lethal Company is "a game about laughing at death".
   Proximity voice means a friend's voice echoing down a corridor, then silence. Note that proximity voice itself
   doesn't transfer (everyone at the party is in one room); what transfers is **one-way and degraded channels**.
   Sources: [Push to Talk](https://www.pushtotalk.gg/p/how-lethal-company-sold-10-million-copies),
   [GamesRadar](https://www.gamesradar.com/games/horror/life-after-lethal-company-solo-creator-zeekerss-says-weirdly-not-a-lot-has-changed-after-one-of-the-biggest-indie-hits-in-recent-memory-and-he-still-has-a-good-handful-of-ideas-for-games/).

10. **The end-of-day report hands out jokes, not stats.** Each day ends with a performance report: a crew grade
    (S/A/B/C/F), each employee's status (alive / deceased / missing) and notes like "The laziest employee", "The most
    paranoid employee", "Sustained the most injuries", "Most profitable". **Dead players can win notes too.**
    Sources: [fandom: Performance report](https://lethal-company.fandom.com/wiki/Performance_report) *(via search summary)*,
    [The Nerd Stash: ranks](https://thenerdstash.com/all-ranks-in-lethal-company-explained/).

11. **Lo-fi is a design tool, not a budget.** The game renders at a fixed ~860×520 and upscales, with a custom
    posterisation pass on the volumetric lighting, edge detection and heavy fog. Low resolution hides detail, so the
    imagination fills it with dread, and it's cheap to run. The Hundred's TV is a laptop on a 40" screen, so the same
    trade (bake it, keep it small, let pixels show) already applies.
    Sources: [daily.dev / "The Strange Graphics of Lethal Company"](https://daily.dev/posts/the-strange-graphics-of-lethal-company-5knvykwlu),
    [The Nerd Stash: low-poly horror](https://thenerdstash.com/lethal-company-shows-the-timeless-power-of-low-poly-horror/).

12. **The quota is shared, and that is what makes it bond people.** The Company is the common enemy and everyone is
    equally doomed. In The Hundred the "Company" can play the same role **above** the Saboteur/Drinker split: a neutral
    tyrant who doesn't know who anyone is, which suits a TV that may never show a secret.
    Sources: [TheGamer](https://www.thegamer.com/lethal-company-workplace-horror-comedy-politics-social-impact-quota/),
    [Gamecritics review](https://gamecritics.com/gc-staff/lethal-company-review/) ("every death is a setback").

### Retention lessons: why groups come back

13. **The quota is a campaign you are guaranteed to lose, and that is the hook.** Each quota you meet raises the next
    one, so every save ends in a firing; the only question is *how far did we get*. Players compare their highest
    quota, a streamer crew's 17-quota, 13-hour run became news, and there are quota speedruns. A losing run still
    produces a number to beat next time.
    Sources: [GamesRadar: 10,501 quota record](https://www.gamesradar.com/my-lethal-company-crew-struggles-with-1000-quota-but-these-great-assets-have-managed-10501-across-13-hours-in-an-apparent-world-record/),
    [Destructoid](https://www.destructoid.com/the-highest-lethal-company-quota-record-explained/),
    [Steam: "What's your highest quota?"](https://steamcommunity.com/app/1966720/discussions/0/4032472470666567065/),
    [Speedrun.com](https://www.speedrun.com/Lethal_Company/runs/ylln5vxy).

14. **Persistent ship stuff gives a run its identity, and losing it all stings, sometimes too much.** Credits buy
    suits, furniture and ship upgrades that make *your* ship feel like home. Getting fired wipes all of it, decor
    included. The community asked for cosmetics to survive the firing, and a popular mod (PersistentPurchases) does
    exactly that. Lesson for us: **split progress into crew stakes (can be lost) and personal flair (never lost).**
    Sources: [Steam: do you lose decor when fired?](https://steamcommunity.com/app/1966720/discussions/0/4034726898984939566/),
    [Steam: "Keep cosmetic items"](https://steamcommunity.com/app/1966720/discussions/0/4034727291142213971/),
    [Thunderstore: PersistentPurchases](https://thunderstore.io/c/lethal-company/p/TheBeeTeam/PersistentPurchases/).

15. **Variety comes from a menu of graded places, not from more content.** 12 moons ordered by difficulty with hazard
    grades D to S, harder moons cost credits to route to, three procedural interiors, and weather on top. A group picks
    its night's flavour and its risk. Variety is mostly *combinations* of a few parts.
    Source: [Miraheze: Moons](https://lethal.miraheze.org/wiki/Moons).

16. **Stories and clips did the marketing.** Growth went from ~600 concurrent players to 184,015 in about six weeks,
    driven by word of mouth and streams (it took off after MoistCr1TiKaL played with friends); the TikTok tag passed
    2.4 billion views; PC Gamer put it down to "all the intense shouting". The game is built so failure makes a
    30-second story you can retell or post.
    Sources: [Dexerto](https://www.dexerto.com/gaming/lethal-company-becomes-one-of-steams-most-popular-games-amid-viral-success-2390742/),
    [Prima Games](https://primagames.com/featured/how-did-lethal-company-become-so-popular),
    [PC Gamer](https://www.pcgamer.com/lethal-company-is-a-viral-hit-in-no-small-part-thanks-to-all-the-intense-shouting/),
    [Push to Talk](https://www.pushtotalk.gg/p/how-lethal-company-sold-10-million-copies).

17. **Zeekerss ships rarely but big.** He wants updates to feel like players "broke into an alien zoo and released the
    animals", "bigger and less frequent". For a game played a few nights a year, that's the right rhythm: one new
    headline thing per party, announced in advance, is a reason to show up.
    Source: [Wikipedia](https://en.wikipedia.org/wiki/Lethal_Company).

**What doesn't transfer directly:** Lethal Company is played weekly online; The Hundred is a few in-person parties a
year with ~12 friends. So "retention" can't mean daily loops. It means (a) a **campaign that spans parties**, (b) a
**personal file** that remembers you between them, (c) **a different night each time**, and (d) **stories and clips**
that keep the last night alive until the next. One practical blocker: phones sign in anonymously per browser, so a
player's identity across nights needs a claim step (e.g. the host matches name + selfie in the lobby, or a printed
badge number). That's assumed in R2 and R3 below.

---

## 2. Retention upgrades (first priority)

All of these are **after 10 Oct** except where marked; the first night itself is the best retention tool, so for the
next 7 days only R5's "before" part and R6 are realistic. Every item follows the ground rules in §3.

| # | Upgrade | Retention | Where | Effort | Timing |
|---|---|---|---|---|---|
| R1 | THE CONTRACT: a campaign across party nights | **high** | server + TV | L | after |
| R2 | Personnel files: rank and cosmetics that never wipe | **high** | server + phone + TV | L | after |
| R3 | The Precinct: crew upgrades bought with overtime, lost when fired | **high** | server + TV | L | after |
| R4 | Districts: pick the night's beat (graded risk) | **high** | settings + TV | M | after |
| R5 | THE CASE FILE: a shareable recap + "Previously on…" | **high** | server + web page + TV | M | after (a "before" slice exists) |
| R6 | FILM THIS: moments built for phone clips | med | TV | S | before 10 Oct |
| R7 | NEW QUOTA: overtime after the win | med | TV (+ server for credits) | S–M | before (TV-only) |

### R1. THE CONTRACT: a campaign across party nights (retention: high)
- **What:** a "crew" record that outlives a room. Each party is one **contract**. Meet it and the Company raises the
  next one: the target is set **per head** (e.g. 100 for 12 people ≈ 8.3 each, then 9, then 10…) so a different
  turnout stays fair, or the deadline moves 15 minutes earlier. Miss it and the crew is **FIRED** (item 2's scene now
  means something): the campaign resets to Contract No. 1, and the TV lobby shows the crew's record for ever after:
  "LONGEST SERVICE: 3 CONTRACTS". The lobby of the next party opens on "CONTRACT No. 2 · QUOTA 9.0 PER HEAD".
- **Why:** lessons 13 and 3. Every night ends with a reason for the next: "we survived, so next time is harder" or
  "we got fired, so we're starting over to beat 3". It's the single strongest retention hook in Lethal Company.
- **Where:** server (a `crews` table, `rooms.crew_id`, contract number and result written at `end_check`), TV
  (lobby header, the win/fired screens, a "CONTRACT HISTORY" plaque), host setup (CREATE ROOM → continue a crew).
- **Effort:** L.
- **Risk:** secrecy is none (all public numbers and results). The Saboteurs' win now also "fires" the Drinkers' crew,
  which raises stakes for everyone; that fits. Drunk-friendliness: no player input at all. Keep a host override
  ("start a new crew") for a very different guest list.

### R2. Personnel files: rank and cosmetics that never wipe (retention: high)
- **What:** each returning guest has a **personnel file**: nights attended, wins by team, beers, notes earned (item 5),
  and a Company rank on the Lethal ladder (INTERN → PART-TIME → EMPLOYEE → LEADER → BOSS). Ranks and notes unlock
  **personal cosmetics** that show on their TV card and phone: a polaroid frame (gilt for a past Champ, tinfoil for
  "The most paranoid employee", a dunce cap for a three-time Slacker), a rubber-stamp colour, and a name-clip
  fanfare. **Personal flair never wipes**, even when the crew is fired (lesson 14).
- **Why:** gives each person something of their own to come back to and show off, and extends the Roadmap's
  long-term "all-time stats".
- **Where:** server (a persistent `people` table keyed by a claimed identity, see the blocker above), phone (MY FILE
  tab), TV (frames on `PlayerGrid` cards and the lobby).
- **Effort:** L.
- **Risk / rule conflicts:** **cosmetics must only unlock from public facts or from post-reveal data, and only between
  nights.** Never unlock or change a frame mid-night from a secret action (a Hit, a heal, a frame), or a card change
  on the TV would leak a role. Past-role badges ("Ex-Intruder") are fine *next* night (roles are re-dealt) but should
  be opt-in, because they invite meta-grudges. Ranks must not grant gameplay power.

### R3. The Precinct: crew upgrades bought with overtime, lost when fired (retention: high)
- **What:** the crew's "ship". Beers over the target (the overtime of R7), S-grade shifts (item 3) and a won contract
  earn **crew credits**. Between nights the host spends them in a Company catalogue: a new wheel pack (Roadmap's
  "scenario/wheel packs" become the shop stock), a TV backdrop (rain / fog / neon), one extra role card in the deck
  (Informant, Fixer from the Roadmap), a new Company voice, or a lobby jukebox track. **Getting fired wipes the
  crew's catalogue** (lesson 14: crew stakes can be lost, personal flair from R2 can't).
- **Why:** lessons 13 and 14. Something visible changes on the TV each time the group comes back, and it's *theirs*.
- **Where:** server (credits on the crew, unlocks list), TV (CATALOGUE in Setup; the unlocked look in the room).
- **Effort:** L (the shop is M; each unlock is its own piece of content).
- **Risk:** the catalogue is spent by the host between nights, so no secrecy issue. Don't sell anything that makes the
  100 easier (that tilts against the Saboteurs); stick to looks, packs and roles that are balanced on their own.

### R4. Districts: pick the night's beat (retention: high)
- **What:** lesson 15. Each party the host routes the crew to a **district** with a hazard grade: **THE DOCKS** (C:
  Davy Jones, Plank and the Locker on, longer locks), **CHINATOWN** (B: Assassin and the Ninja in the deck, Dodge
  first), **THE CASINO** (A: Penny Drop, the Bookie and a gambling wheel pack), **THE PRECINCT** (D: the classic
  deck). A harder district pays more crew credits (R3) and its target is a bit higher, so risk has a reward (lesson 5).
  The Company announces it in the lobby: "Tonight's assignment: THE DOCKS. Hazard grade: B. Good luck, employees."
  Per-game **weather** (item 7) sits on top as the small variety.
- **Why:** the second night must not feel like a rerun of the first. Districts are mostly **presets over settings
  that already exist** (role counts, mini-games, Scrooge toggles, wheel segments, Locker times), plus a backdrop and a
  line of copy.
- **Where:** host setup (pick a district → it fills Roles & Cards and Game & Deadline), TV (lobby title card, tint),
  server (only the credits multiplier).
- **Effort:** M.
- **Risk:** a district must never reveal the deck beyond what Roles & Cards already makes public; keep "which roles
  are in play" as public as it is today. Re-test each preset in the Test Lab.

### R5. THE CASE FILE: a shareable recap and "Previously on…" (retention: high)
- **What:** lesson 16. After REVEAL ALL ROLES the server already builds a case file (Saboteurs, the Betrayer's
  team-up, the knife, Detective checks, the forged heal). Turn it into a **page at /file/CODE** that every guest gets
  on their phone at the end: a timeline of the night (each Trial and verdict, each Hit, Plank and Jester's revenge,
  the Fired scene), the evidence photos the host kept, the performance report and notes (item 5), and the contract
  result. The **next** party opens with a 60-second **"PREVIOUSLY ON THE HUNDRED"** slideshow from the last file
  (this is the Roadmap's "photo wall + previously on…" item; build it as one feature).
- **Why:** the recap is what people send to the group chat the next morning; the "Previously on" reignites the old
  grudges at the start of the next night. Both turn emergent stories into retold stories.
- **Before 10 Oct slice:** make sure the night's events are **stored** with timestamps (most already are, as the
  reveal and undo show), so the recap can be built later from the first night's data. No UI needed yet.
- **Where:** server (a read-only, post-reveal `get_case_file`), a new public-by-link page, TV (the montage).
- **Effort:** M.
- **Risk:** only available **after** `reveal_all`. Evidence photos must stay anonymous (never say who filed one).
  The link should be unguessable and the host can unpublish it. Don't include Locker rest requests (welfare, not
  comedy).

### R6. FILM THIS: moments built for phone clips (retention: med) (before 10 Oct)
- **What:** lesson 16. For the 5 or 6 biggest TV moments (Fired, Jester's Revenge, the Plank's drop, the Kraken, the
  Walk of Shame, the win), show a **1.5-second "● REC · FILM THIS" lamp** in the corner before the payoff, so phones
  come up in time. Check that each payoff reads in a **9:16 crop of the TV's centre** (names and faces central, no
  key text in the outer thirds).
- **Why:** clips posted the next day are the cheapest retention there is, and the payoff usually happens before
  anyone has started recording.
- **Where:** TV only (a shared lamp component, a pre-roll delay in each scene).
- **Effort:** S.
- **Risk:** a pre-roll must not delay a secret-timed reveal in a way that leaks anything (it only plays on scenes that
  are already public). Respect reduced motion; the lamp is a static badge then.

### R7. NEW QUOTA: overtime after the win (retention: med)
- **What:** when the 100 falls before 01:00, the Company doesn't just say "THE GROUP WINS". After the win card it
  issues an **overtime quota** for the time left ("Overtime target: 20 more by 01:00. Overtime is voluntary*.
  *Mandatory."). Hitting it is a bonus line on the end screen and crew credits for R3. It never changes who won.
- **Why:** lessons 4 and 13. Today an early win leaves the rest of the night with nothing to aim at ("KEEP
  PARTYING"). A second, lighter target keeps the board alive and builds the habit of "the Company always wants more".
- **Where:** TV-only version before 10 Oct (a second target line on the counter after the win, from public numbers);
  credits need the server after.
- **Effort:** S (TV-only), M with credits.
- **Risk:** the Saboteurs have already lost, so their win condition is unaffected. Must not double-count the Skank's
  hidden bonus (the TV still sees real beers only).

---

## 3. Night-of upgrades for The Hundred

**Ground rules applied to every item (including §2):**
- **The TV never shows a secret.** Anything the Company says is derived only from **tally, target, time left and
  player count** (the inputs `paceOf` already uses), plus public events (verdicts, Locker, punishments). It must
  never mention the Skank bonus (hidden until 01:00), who started an ability, heals or forgeries.
- **One TV moment at a time.** Company announcements must go through the existing `enqueue` path, never talk over a
  mini-game, Trial, wheel round or scene, and skip (not queue forever) if the TV is busy for too long.
- **Abilities are server-validated.** Anything a phone can trigger is a new `api_exec` action with its own checks. The
  live Supabase has to be hand-synced (see Roadmap), so server items are tagged **after 10 Oct** unless trivial.
- **Drunk thumbs:** no typing, no terminal. At most two big buttons.

| # | Upgrade | Retention | Where | Effort | Timing |
|---|---|---|---|---|---|
| 2 | YOU'RE FIRED: the ejection ending (+ the overtime win) | **high** (the clip; R1's reset) | TV | S–M | before 10 Oct |
| 5 | Employee notes on the end-of-night report | **high** (feeds R2, R5) | TV | S–M | feeds Roadmap #4 |
| 1 | THE COMPANY: loudspeaker memos at checkpoints | med (a quotable character) | TV | S | before 10 Oct |
| 7 | Hazard pay: weather cards for the next game | med (variety, with R4) | TV + server | M | after 10 Oct |
| 3 | Shift reviews: three interim quotas with a grade | low (feeds R3 credits) | TV (+ phone notice) | M | before 10 Oct (TV-only version) |
| 6 | THE SWITCHBOARD: an operator mode for the Locker and rehab | low | phone + server + TV | M | after 10 Oct |
| 4 | The PA kit: chime, static, low-res memo, "signal lost" | low | TV | S | before 10 Oct |
| 8 | The Ghost Bell: the out-players' one unanimous lever | low | phone + server + TV | M | after 10 Oct |

(The table is sorted by retention; the write-ups below keep their original numbers.)

### 1. THE COMPANY: loudspeaker memos at checkpoints (retention: med)
- **What:** an upbeat corporate PA voice ("THE COMPANY", or a noir name like *Head Office*) that speaks on the TV at
  fixed moments. When the tally crosses 25 / 50 / 75 (the rack already labels these quarters): "Twenty-five units
  delivered. The Company is… satisfied." At time checkpoints (e.g. 3h, 2h, 1h, 30 min, 15 min left): "Reminder: the
  deadline is 01:00. There are 61 beers outstanding. The Company believes in you." At the first Trial: "The Company
  reminds staff that suspicion improves productivity." The line is picked by the **pace lamp** (green / amber / red),
  so the tone gets colder as the room falls behind. A typed memo card ("MEMO · FROM HEAD OFFICE · RE: QUOTA") slides
  over the counter for ~6 s while `speak()` reads it.
- **Why:** lessons 1, 2 and 12. Right now pace is silent text in a corner. A voice turns the deadline into a character
  everyone hates together, and reminds a drunk room of the target without the host shouting.
- **Where:** TV only (`TvRoom.tsx` watching `tally` and `remaining`; reuses `speak.ts` and `Sound`). No server.
- **Effort:** S (a list of lines, a threshold watcher keyed by a "last announced" ref, one memo component).
- **Risk:** secrecy is none if lines only use public numbers. **Don't** fire on the Skank-boosted total (the TV doesn't
  have it anyway). Drunk-friendliness is good, but keep it rare (≤ ~8 a night) and skippable by the sound switch;
  never during a round or mini-game (enqueue). One thing to watch: on undo or −1 the tally can re-cross a threshold,
  so announce each checkpoint once a night.

### 2. YOU'RE FIRED: the ejection ending (and the overtime win) (retention: high)
- **What:** when time runs out short of 100, play a 10–15 s scene **before** the existing `BigOverlay`. The PA chime,
  "The Company regrets to inform all staff…", an alarm and red lamp, then a door labelled *AIRLOCK* (in noir, a steel
  dock door over black water also works) opens, and **every player's polaroid** is sucked out one by one, spinning
  into the dark. It ends on a pink slip stamped **TERMINATED · SHORT BY 7**, then the usual SABOTEURS WIN card.
  **Everyone** is ejected identically, so it gives nothing away before REVEAL ALL ROLES. The win version: the Company
  says "Quota met. Congratulations. Your new quota is **101**." (a deadpan gag on lesson 1's growing quota), and if the
  target fell early, an **OVERTIME** line converts the spare time into a public commendation ("47 minutes early.
  Overtime bonus: one (1) pat on the back.").
- **Why:** lesson 3. The loss is currently a static card; the Saboteurs' win deserves a slapstick, filmable moment the
  whole room laughs at, including the losers.
- **Where:** TV (`TvRoom.tsx`, a new scene next to `LockerScene` / `ShurikenScene`; reuse the Plank/Locker sink-and-
  drift motion). No server.
- **Effort:** S–M. Mugshots and polaroids exist; transform/opacity only (fine for the TV-performance rule; give a
  reduced-motion end frame).
- **Risk:** none for secrecy as long as nobody is ejected differently (no Saboteur faces first, no order by role;
  use player join order or random). It plays once; CLOSE / REVEAL stay live from frame 0.

### 3. Shift reviews: three interim quotas with a grade (retention: low)
- **What:** split the night into 3 shifts (e.g. deadline −3h, −1h30, 01:00; host-editable in Game & Deadline) with a
  **straight-line interim quota** (e.g. 34 / 67 / 100, computed from start time and target). At each shift end the TV
  shows a **PERFORMANCE REVIEW**: the crew grade (S / A / B / C / F by how far ahead of or behind the line the real
  tally is), "BEERS THIS SHIFT", and the Company's verdict in one line. A failed interim does **not** end the game; it
  just triggers a public consequence the host confirms, e.g. "DISCIPLINARY ACTION" = a whole-room **FREE SPIN** (already
  exists, logs nothing against anyone), and an **S** grade earns a public perk such as a second golden ticket for the
  next game's Champ. Phones get a one-line notice ("SHIFT 1: GRADE C. The Company is watching.").
- **Why:** lessons 1 and 10. It gives the night three climaxes instead of one, and gives the host a natural cue to
  run a game (overlaps Roadmap #3's "nudge the host if no game for 40 min").
- **Where:** TV-only version: grade computed on the TV from public numbers, host taps CONFIRM for any consequence (no
  server). A server version (stored shift results, auto-perks) is after 10 Oct.
- **Effort:** M (TV-only), L with server perks.
- **Risk:** secrecy is fine (public numbers only). **Balance:** a penalty for a bad shift must hit everyone equally, or
  Saboteurs could stall to aim it at Drinkers; the whole-room spin is neutral. Don't reward an S with anything that
  changes the tally or target: that would tilt the win condition. Drunk-friendly: one screen, one tap for the host.

### 4. The PA kit: chime, static, low-res memo, "signal lost" (retention: low)
- **What:** a small audio-visual kit shared by items 1–3:
  - **PA chime:** a two-tone "ding-dong" (synthesised like the existing cues) before every Company line, and a short
    `staticNoise` tail after. Browser TTS can't be routed through Web Audio, so fake the "tannoy" with static under it
    and a slightly lower `rate`/`pitch` rather than trying to filter the voice.
  - **Low-res memo:** the memo card rendered small and scaled up with `image-rendering: pixelated`, 1-bit dither from
    the existing `/textures/dither.png`, a faint scanline, and amber-on-black teletype type. A deliberate lo-fi
    "Company terminal" voice set against the warm noir paper of the case files (lesson 11).
  - **"Signal lost":** when a player is locked in the Locker or convicted to rehab, their TV card gets a 0.5 s burst of
    static and a "SIGNAL LOST" strip, the walkie-talkie death hiss from lesson 8.
- **Why:** sound sells the Company more than art does, and these are cheap, baked and on-brand (noir already has
  sodium light, rain and a riveted wheel; a 1940s PA and teletype fit that world).
- **Where:** TV (`fx/sound.ts`, a CSS class, `PlayerGrid` card state already knows Locker/rehab).
- **Effort:** S.
- **Risk:** none for secrecy (Locker and rehab are already public). Keep the static quiet and short so it never
  covers name-clip summons.

### 5. Employee notes on the end-of-night report (shapes Roadmap #4) (retention: high)
- **What:** don't add a new feature; give Roadmap #4 *End-of-night awards after reveal_all* the Lethal Company
  format: a **PERFORMANCE REPORT** typed out on Company letterhead, each player with a status (**ON SHIFT / IN
  REHAB / LOST AT SEA** for the Locker) and at most one note: "MOST PROFITABLE EMPLOYEE" (most beers), "SUSTAINED THE
  MOST INJURIES" (most wheel landings), "THE MOST PARANOID EMPLOYEE" (most wrong-accusation drinks), "THE LAZIEST
  EMPLOYEE" (fewest beers, excluding the Angel), "TERMINATED WITH CAUSE" (convicted). **Out players are eligible**
  (lesson 10).
- **Why:** turns the night's stats into one last round of jokes about named friends.
- **Where:** TV, after REVEAL ALL ROLES (roles are public by then, so notes may reference them).
- **Effort:** S–M (data already exists after reveal).
- **Risk:** none after reveal. Avoid "laziest" for anyone who was in the Locker for a rest (don't shame the people who
  looked after themselves); that fits the drunk-players memory.

### 6. THE SWITCHBOARD: an operator mode for the Locker and rehab (retention: low)
- **What:** lessons 6 and 7. A player who is out gets a **radio** screen instead of a dead phone: a live feed of
  public events ("AT THE WHEEL: PRIYA", "TRIAL OPEN", "34 TO GO"), and **one big TRANSMIT key** that sends one of 6
  canned lines ("DRINK FASTER", "I'VE GOT EYES ON YOU", "DON'T TRUST THE QUIET ONES", "SEND HELP", "IT'S WET DOWN
  HERE", "TELL MY MUM") to the TV as a crackly ticker: **"📻 FROM THE DEEP: SEND HELP"**. Anonymous, rate-limited
  (one every 5 min per player), no free text. Locker players only see it if they open it (they're meant to be
  resting).
- **Why:** rehab and Locker players currently "can still watch the TV and drink". Lethal's spectators stay the most
  engaged players in the lobby because they have a channel. Here the out players become the party's heckling chorus.
- **Where:** phone (Locker/rehab branch of `PhoneHome`), server (new `transmit` action: caller must be locked or in
  rehab, rate limit, choice must be one of the fixed ids), TV (a ticker queued like emoji).
- **Effort:** M.
- **Risk / rule conflicts:**
  - **Must be a server action, not a Realtime broadcast.** Emoji go over the public broadcast channel, which anyone who
    knows the room id can spoof; a "from the deep" line implies the sender is out, so it has to be server-checked.
  - **Rehab players are known Saboteurs.** Keep transmissions **cosmetic**: they change no game state. Misleading
    heckles are fine (that's social deduction), but no operator ability may touch the queue, votes or tally.
  - **Not a spectator view.** It deliberately differs from Roadmap's /watch: it is only for players who are out, and
    its point is the one-way voice, not a second screen.
  - **Secrecy:** the feed shows only what the TV already shows. Never show who pressed what.

### 7. Hazard pay: weather cards for the next game (retention: med)
- **What:** lessons 4 and 5. When the host starts a game, the TV deals three "conditions" for it and the room picks
  one with a quick phone vote (the vote infrastructure exists) or the host picks: **CLEAR** (normal), **FOG** (matchups
  stay hidden until the 3-2-1), **ECLIPSE** (every loser's punishment counts **×2**, *and* the Champ of that game gets
  **two** golden tickets). Every risk names its prize, so ECLIPSE is never just worse.
- **Why:** the night is "play game, punish losers" on repeat. A visible gamble before each game, announced by the
  Company ("Conditions on the next contract: ECLIPSED. Hazard pay applies."), adds a group decision without new
  mini-games.
- **Where:** TV (cards + reveal), phone (3 huge tiles), server (store the condition on the game, apply ×2 via the
  queue's existing `times`, extra tickets at game over).
- **Effort:** M.
- **Risk:** keep it distinct from **the Bookie** (BETTING.md): this is about the game's stakes, not wagers; don't
  propose a "will we hit 100" bet here, that's already Bookie MVP. ×2 stacks with Cursed (×2 spins) and the shiv:
  set an explicit cap on the combined multiplier (the wheel's "spin again, doubled" chain
  already stops at ×4, so ×4 is a natural ceiling). Saboteurs can vote ECLIPSE to raise punishments, but that hits both
  sides equally. Drunk-friendly: three tiles, 10 s, a default if nobody votes.

### 8. The Ghost Bell: the out-players' one unanimous lever (retention: low)
- **What:** lesson 7 (the dead's unanimous early-departure vote) plus the Company desk's bell. Once a night, if
  **every** player currently in the Locker or rehab (minimum 2) taps **RING THE BELL** within 60 s, the TV plays "THE
  COMPANY IS IMPATIENT": a bell, tentacle-shadow shudder, and the whole room (not the Angel, not the out players)
  drinks a sip. Logs nothing against anyone.
- **Why:** gives the out players a shared goal and a reason to talk to each other, the way spectators do in Lethal.
- **Where:** phone (one button on the Switchboard), server (`ring_bell`: tracks presses, checks unanimity and
  once-a-night), TV (scene, via enqueue).
- **Effort:** M (after the Switchboard exists).
- **Risk:** the out group may be all caught Saboteurs; a room-wide sip is neutral and doesn't move the tally, so it
  can't swing the result. Locker players should be resting, so the bell must never buzz or nag them. Optional; cut
  first if time is short.

### Considered and rejected
- **A rising "buy rate" (late beers count more):** the closest copy of lesson 4, but it would make the TV tally lie
  about real beers and muddle the Skank's hidden multiplier. The public tally must stay 1 beer = 1.
- **Body retrieval:** already covered in spirit. **TAKE IT FOR THEM** is the heroic rescue, and the rehab **shiv** is
  how the "dead" keep mattering. A second rescue mechanic would be clutter.
- **A real terminal / typed commands:** fails the drunk-thumbs rule; canned buttons only (item 6).
- **Raising the quota mid-night:** a real Lethal mechanic, but it changes the win condition the Saboteurs signed up
  for. The escalation lives **between** nights instead (R1), and **after** a win (R7, which doesn't change the
  result). With R1 built, item 2's "new quota: 101" gag becomes the real next contract.
