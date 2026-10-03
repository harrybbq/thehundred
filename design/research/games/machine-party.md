# Machine Party: lessons and proposed upgrades for The Hundred

Researched 2026-10-03. Gameplay and structure only; the visual side (LED marquee, seven-segment, keycaps, phosphor CRT)
is already covered in `design/research/machine-findings.md` and `refs.md` → `machine/01–16`, and is built
(`src/styles/machine.css`, `src/tv/machineKit.ts`).

## 1. Which game, and why

**Machine Party** (Steam app [4108000](https://store.steampowered.com/app/4108000/)), by **Mike Klubnika** (Buckshot
Roulette) and **GDeavid**, published by Oro Interactive and released **30 July 2026**. It's "a collection of violent
party games, where you try to prove to your friends that your life is worth more than theirs"
([dev log 25](https://mikeklubnika.com/logs/log_25)).

- **Format:** 2–4 players, online only, with private room codes. There's no public lobby, no voice chat and no local
  split-screen ([soonlab review](https://www.soonlab.ai/blog/machine-party-review/)).
- **Content:** 15 lethal minigames, played in a random order or as a custom playlist. A full run takes about an hour.
- **Reception:** Very Positive on Steam (88% of ~1,860 reviews).

**Why this one, and not Mario Party, Pummel Party or Party Animals:**
- The repo already names it. `refs.md` lines 61–76 cite Machine Party screenshots (Steam app 4108000) as the visual
  source for the "Machine Party round": The Bomb, Penny Drop and Jack-in-the-Box (commit e768219).
- `machine.css` and `machineKit.ts` are headed "Machine Party round".
- So "Machine Party" is both the Steam game and the host's own name for that round, and it's the same game. There's no
  real ambiguity.
- If the host meant something else, the most likely candidate is Mario Party, which reviewers keep comparing this game
  to ("dark Mario Party without the board game").

**The 15 games** ([Destructoid](https://www.destructoid.com/all-machine-party-minigames-and-how-to-win/)):
- **Minefield:** a mine detector, with a harvester chasing you.
- **Chisel Gauntlet:** memorise a shape and carve it.
- **Firearm Factory:** build the gun first, then use it on the others.
- **Wrong Way:** enter arrow codes on an escalator heading into a crusher.
- **Duck Hunt:** one hunter against the runners.
- **Stable Footing:** lit tiles, and shove people into the abyss.
- **Table Manners:** eat peas, but freeze when the murderer looks up.
- **Tunnel Hazard:** get into the green alcove, not the red one.
- **Inside Job:** one hunter infects runners, who then join the hunt.
- **Smoke Break:** hold to inhale, and let go before you cough.
- **Debris Platforms:** clear your platform and throw the junk onto someone else's.
- **Spine Breaker:** a mechanical spider chases you.
- **Lethal Rebound:** blades.
- **Forklift Certified:** most boxes moved in 20 seconds; the lowest count dies.
- **The Filter:** sort the parts and burn the picture frames.

## 2. Design lessons (with sources)

Confidence: **H** = the developer, a press review, or many Steam reviews. **L** = only SEO fan-guide sites, so treat
it as unverified.

1. **Cut the fluff, not the game. (H)** Klubnika: the team "tried our best to cut down the amount of dialogue,
   transitions, and other board game aspects… a frantic back-to-back party game with almost no fluff and wait times".
   The same cut on Buckshot Roulette meant "the player's time was respected much more".
   ([log 19](https://mikeklubnika.com/logs/log_19))
2. **Success should open a new chance to betray, not a safe victory screen. (H)** In Firearm Factory, whoever builds
   the gun first immediately uses it on the others. ([soonlab](https://www.soonlab.ai/blog/machine-party-review/))
3. **Betrayals must be readable to the people watching. (H)** Spectators should "anticipate the mistake", and the
   victim should understand exactly how they were beaten. That's what fuels the accusations after a round.
   ([soonlab](https://www.soonlab.ai/blog/machine-party-review/))
4. **Every failure has a visible, specific consequence before the next round. (H)** Deaths are varied and cinematic:
   paste, decapitation, falls. Each one is a punchline, not a generic "you lose".
   ([Life is Xbox](https://www.lifeisxbox.eu/review-machine-party/),
   [Insert Coins](https://insertcoins.press/en/articles/machine-party-test))
5. **Betrayal should be tempting, never forced. (H)** "The game never forces you to betray, it just makes betrayal
   deliciously tempting." ([Insert Coins](https://insertcoins.press/en/articles/machine-party-test))
6. **Asymmetric one-against-all rounds give variety without new controls. (H)** Duck Hunt and Inside Job hand one
   player the hunter role. Inside Job also turns the dead into hunters, so eliminated players stay in the game.
   ([Destructoid](https://www.destructoid.com/all-machine-party-minigames-and-how-to-win/))
7. **Vary the skill, not the skin. (H)** Praise: "every game requires a different kind of skillset". Complaint: "half
   the modes are just a reuse of the same 'push your friend' mechanic" and "rekins [reskins] of one another".
   The rounds that worked span reflex, memory, timing, nerve, observation and bluffing.
   ([Steam reviews](https://store.steampowered.com/app/4108000/))
8. **Runaway leaders kill the back half of a session. (H)** The top design complaint after "too little content":
   "practically no way to catch up to someone who is in the lead" and "people 800-400 ahead of me". Accumulated points
   with no catch-up mean the last-place players check out. ([Steam negative reviews](https://store.steampowered.com/app/4108000/))
9. **Pure luck reads as unfair once you're drunk on it. (H)** "Many are nauseatingly luck-based." Rounds where nerve or
   reading people decides the result got the praise. ([Steam reviews](https://store.steampowered.com/app/4108000/))
10. **The first hour is the magic; repetition is the enemy. (H)** "The game is alot of fun… for the first hour."
    "After playing it like 5 times it already starts feeling repetitive." For The Hundred (one night, about 5 hours),
    this means don't run the same mini-game twice the same way.
11. **Teach in two beats: the controls, then how you die. (L)** Fan guides say each round shows the controls first and
    the win/lose condition second, and that players miss the second part.
    ([allthings.how](https://allthings.how/machine-party-how-to-win-all-15-minigames-2/), unverified)
12. **Score highlights between rounds. (L)** Fan guides say the game shows a running score after each round and
    replays the spectacular deaths. The scores are "gene mutation points", which reward consistency over one lucky
    round. ([machineparty.wiki](https://machineparty.wiki/guides/how-to-play/), unverified)

### Retention lessons (added after the host's update: keeping groups coming back)

13. **Machine Party's biggest weakness is retention, and it's the warning for us. (H)**
    - Every top complaint is about coming back: "after one run you've played pretty much all the minigames";
      "the game is like an hour long. No replayability whatsoever"; "after playing it like 5 times it already starts
      feeling repetitive"; "got old quick given that there are so little games/customization".
    - It has 88% positive reviews, but those come from first nights.
    - Nothing in the game carries over from one session to the next except the player's own memory.
      ([Steam negative reviews](https://store.steampowered.com/app/4108000/))
14. **"A social game that does very little to create the social group for you." (H)** The friction of getting the
    group together again (no lobby browser, no voice chat) is the "big catch".
    ([soonlab](https://www.soonlab.ai/blog/machine-party-review/))
    For The Hundred, the equivalents are:
    - the host's setup cost: codes, printing, rooms;
    - nothing to re-invite people to.
15. **Variety between sessions comes from recombining a pool, not just from more content. (H, from a sister genre)**
    - Blood on the Clocktower stays replayable through "Scripts": curated role sets that "play very differently",
      drawn from one character pool, plus custom scripts.
      ([Wikipedia](https://en.wikipedia.org/wiki/Blood_on_the_Clocktower),
      [BoardGameGeek](https://boardgamegeek.com/boardgame/240980/blood-on-the-clocktower/ratings?comment=1))
    - Machine Party's own fans asked for randomised rotation and custom playlists for the same reason. These reports
      come from a fan wiki and contradict the press, which says the order is already random, so treat them as **L**.
      ([machineparty.wiki](https://machineparty.wiki/updates/))
16. **Cosmetic unlocks earned by turning up. (L)** The fan wiki says test-subject outfits and colours unlock through
    sessions and achievements. It's a small reason to come back, and it never touches balance.
    ([machineparty.wiki customise](https://machineparty.wiki/guides/how-to-customize/), unverified)
17. **Social memory is the real meta. (H, from reviews)**
    - The fun "creates witness statements" ([Crimenet Gazette](https://www.crimenetgazette.com/post/machine-party-review-2026-the-best-way-to-lose-friends-without-committing-a-crime)),
      and post-round accusations are the point ([soonlab](https://www.soonlab.ai/blog/machine-party-review/)).
    - The game throws those stories away when the session ends.
    - A social-deduction drinking game produces even better stories: betrayals, wrongful convictions, the Jester's
      revenge. Keeping them, and replaying them at the next night, is the cheapest retention The Hundred has.

**What the code allows today:**
- Nothing is deleted after a night. There's no room-delete action; only undo's `_restore` clears per-room rows.
- So the 10 Oct data (beer_log, punishments, games, votes, evidence, events, and the roles after `reveal_all`) will
  survive.
- But a player exists **only inside one room**: `players.room_id` is set to cascade-delete with the room, and
  `user_id` is an anonymous session tied to one phone's browser.
- There is **no identity that links Dave on night 1 to Dave on night 2**. Every retention idea below starts there.

## 3. What The Hundred already does well, by these measures

- **Readable consequences:** BOOM, the clown pop, the plank drop, the shuriken hit and SAVED/FORGED.
- **One TV moment at a time.**
- **Automatic wheel queue:** no host fluff between punishments.
- **Lesson 2 is built in:** the Champ's golden ticket, curse passing to the losers and TAKE IT FOR THEM.
- **No runaway scoreboard:** the score is the group's 100 beers, not personal points. Lesson 8 matters here as
  *drinking-load* catch-up (the same people keep losing), not points.

**One gap found in the code.** In `20261005000002_v3_logic.sql`, `bomb_start`, `penny_start`, `jack_start` and
`plank_start` are **role-only and need level 3 (8 beers)** (lines ~1435–1474). Only `bbq_start` (Aaron's Plate) has a
host path (line ~1238). So on the night:
- If the Intruder, Scrooge, Jester or Davy Jones never reaches 8 beers, or is caught early, the whole Machine Party
  round may never be played.
- That's the opposite of lesson 1's density.

## 4. Retention proposals (first priority)

Ordered by retention value. R0 is the only one that **must happen before 10 Oct**; the rest can follow the first night,
because night 1's data will still be there.

### R0. Keep night 1 linkable (before the party) · retention: high (it enables everything else)
- **What:**
  - Don't delete or reuse the 10 Oct room.
  - Before the night, add a nullable `regular_id` to `players` and a host-owned `regulars` table (name, latest
    selfie, created_at). No UI is needed yet. After the night the host links each player to a regular from one list
    (match by name and selfie).
  - Alternatively, skip the schema and just write a one-off export script that dumps the room after `reveal_all`.
- **Why:**
  - Lesson 13: nothing carries over.
  - Night 1 is the story the group will want replayed at night 2 (R1, R3). Losing it can't be undone.
- **Where:** server (one migration, or a script). No TV or phone change.
- **Effort:** S
- **Risk:**
  - None to secrecy: it's host-only data and isn't read by `get_state`.
  - It's a schema change a week out, so apply it in the same careful way as the Roadmap's "only changed functions +
    new columns" sync.

### R1. PREVIOUSLY ON THE HUNDRED: open every night with last night's case · retention: high
- **What:**
  - Night 2's lobby, while people scan the QR, loops a 30–45 second "previously on" reel from the last night's
    archived case file:
    - the winning side;
    - the Saboteurs unmasked (stamped mugshots);
    - the wrongful convictions;
    - the Jester's revenge;
    - the best 3 evidence photos;
    - the most-blown-up player (P2 stamps).
  - It ends on "CASE #2. SOMEONE IN THIS ROOM IS LYING AGAIN."
- **Why:**
  - Lesson 17: social memory is the meta.
  - It turns the first 20 minutes (people arriving) into anticipation, not dead time (lesson 1).
- **Where:**
  - **Server:** a read-only `get_case_archive(room)` for the host, allowed only after that room's `reveal_all`.
  - **TV:** reuses the board, stamp and polaroid kit.
- **Effort:** M
- **Risk:**
  - Secrecy is safe only if it reads **finished** rooms whose roles were all revealed. Never show a live room.
  - It must not hint at night 2's deal: last night's role says nothing about tonight's card, and the reel must not
    imply otherwise.
- **Roadmap overlap:** this *is* the "photo wall + previously on… montage". R0 makes it possible.

### R2. THE RAP SHEET: all-time records and rivalries · retention: high
- **What:**
  - A career file for each regular, built only from **finished, revealed** nights:
    - nights played, side won, times convicted, wrongly accused, times wrongly accused others;
    - wheel spins, BOOMs, golden tickets, Jester revenges received;
    - roles played (shown after the fact).
  - **NEMESIS:** the person who has cost you the most, counting swaps, shivs, curse passes, revenge picks, wrong
    accusations of you, and Dodge/Plank/Jack picks once revealed.
  - **RECORDS:** "most beers in a night", "fastest conviction", "longest undetected Saboteur".
  - When a regular joins night 2+, the TV lobby flashes a one-line rap sheet on their polaroid:
    "DAVE IS BACK · 3RD NIGHT · CONVICTED 2× · NEMESIS: PRIYA".
  - On their phone they can hold to open their own full file.
- **Why:** lesson 17, plus rivalries. A nemesis is a reason to show up and get even.
- **Where:**
  - **Server:** aggregates over archived rooms by `regular_id`.
  - **TV:** the lobby, and the end-of-night awards.
  - **Phone:** your own file.
- **Effort:** M
- **Risk:**
  - **Rule check:** never surface anything from the **current** night mid-game. A live "times picked by X" would
    leak who is Davy Jones, the Jester or the Scrooge. Update records only after `reveal_all`.
  - "Roles played" history is fine: every role is public once a night ends.
- **Roadmap overlap:** this is the "all-time stats" item, specified.

### R3. RANKS and cosmetic unlocks: the Precinct ladder · retention: med-high
- **What:**
  - Nights attended (plus a few feats) promote you up a noir ladder: ROOKIE → BEAT COP → SERGEANT → DETECTIVE →
    LIEUTENANT → CAPTAIN → COMMISSIONER.
  - Ranks unlock **cosmetics only**: polaroid frames (bullet-hole, gold, wanted-poster), a mugshot backdrop and
    height chart, the wheel-spin flourish, the stamp ink colour on your card, and a signature name-clip summons.
  - Feat badges include FIRST BLOOD (first successful Hit), CLEAN HANDS (a Saboteur who was never accused) and
    WRONG MAN (convicted while innocent).
- **Why:** lesson 16. A visible reason to come back that never touches balance.
- **Where:** server (rank derived from R2), TV (the frame on the card), phone (picking a frame).
- **Effort:** M
- **Risk:**
  - **Rule check:** cosmetics must never depend on, or change with, tonight's role or level. Pick the frame before
    the deal; it's locked for the night.
  - No feat badge may be awarded mid-night. FIRST BLOOD appearing at 23:00 would expose the Intruder. Award them
    all at `reveal_all`.

### R4. CASE FILES: a different scenario every night · retention: high
- **What:**
  - Each night is a numbered case with a curated **scenario**, in the spirit of Blood on the Clocktower's scripts.
    Examples:
    - **"The Docks"** (two Davy Joneses, Plank unlocks at LV2);
    - **"Famine"** (heals halved, Skank ×3);
    - **"The Circus"** (a Jester and Pennywise in play, Jack in every Shift);
    - **"Blackout"** (no evidence photos, so a vote from memory).
  - Each scenario also carries a matching wheel pack and one **featured** mini-game.
  - The host picks one in Setup. The next case's name is teased at the end of the current night (R5).
- **Why:**
  - Lesson 15: recombine the pool. The Hundred already has 11+ roles, 6 mini-games and a configurable wheel, which
    is far more than Machine Party's fixed 15.
- **Where:** server (scenario = a preset of the existing settings plus role counts and toggles) and TV (a case title
  card).
- **Effort:**
  - M for presets of existing settings;
  - L if scenarios need new rules ("Plank at LV2").
- **Risk:**
  - **Rule check:** every rule tweak must live in `api_exec`, not the client.
  - Role counts per scenario are public by design, the same as now, where the host knows the deck. But the TV must
    never list which cards were dealt to whom.
- **Roadmap overlap:** "scenario/wheel packs" and new roles (Informant, Fixer) become scenario content.

### R5. THE NEXT SUMMONS: anticipation at the end of every night · retention: high
- **What:**
  - After the case file and the awards, the TV shows a **SUBPOENA** card: "CASE #2 · [DATE] · THE DOCKS", with one
    teased new thing (a mini-game silhouette, or a redacted new role).
  - Phones get **I'LL BE THERE** / **CAN'T**, and the TV tallies the faces of everyone who said yes.
  - The phone saves a link (a /summons/CODE page) that shows the same card and RSVPs until the night.
- **Why:**
  - Lesson 14: create the group for them. The ask lands while everyone is still in the room and buzzing.
  - The tease gives them something to anticipate.
- **Where:** server (an RSVP table on the next case), TV (the closing card), phone (the RSVP plus a lightweight page).
- **Effort:** S–M
- **Risk:**
  - None to secrecy.
  - Drunk-friendly: two giant buttons. Default to doing nothing if they're ignored, never a nag.

### R6. RUN IT BACK: zero-effort night 2 for the host · retention: high
- **What:**
  - One button on the finished room: **RUN IT BACK**. It creates the next room with the same regulars, the next
    scenario (R4), the same settings and an adjusted role count for the RSVP list (R5).
  - It also generates codes and opens the print page.
  - Regulars rejoin by tapping **their own face** on the join page (linked to `regular_id`) instead of retaking a
    selfie and retyping their name.
- **Why:**
  - Lesson 14. The biggest retention killer is the host's setup cost, not the players' interest.
  - Today, night 2 means repeating the full Setup and printing.
- **Where:** server (clone settings and the roster; a re-claim flow for regulars) and TV/phone (the join picker).
- **Effort:** M
- **Risk:**
  - **Identity hijack:** anyone could tap Dave's face.
  - Mitigation: the claim needs the host's OK (one tap on the TV), or a per-regular PIN.
  - It ties into the Roadmap's "move a player to a new phone (relink code)" and "setup wizard" items.

### R7. GRUDGE CARRY-OVER: last night's story changes tonight's opening, publicly · retention: med
- **What:** two public, cosmetic-plus-small-perk carry-overs from the last night:
  - **THE ONE THAT GOT AWAY:** the Saboteur who survived unconvicted starts night 2 with a WANTED stamp on their
    polaroid. It's purely a grudge marker, and says nothing about tonight's role.
  - **THE MARTYR:** whoever took the most punishments last night starts with one golden ticket.
- **Why:**
  - Rivalries (lesson 17) and cross-session catch-up (lesson 8).
  - The worst-treated player has a reason to return.
- **Where:** server (computed from the R2 archive at room creation) and TV (stamps).
- **Effort:** S (once R0 and R2 exist)
- **Risk:**
  - **Rule check:** the WANTED stamp must be clearly "LAST NIGHT". Players will still read it as suspicion. That's
    acceptable, and it's even good table talk, but tell the host.
  - The golden ticket follows the existing rules (the Forger can't touch it).

### R8. Featured new mini-game per night, plus a "first time" fanfare · retention: med
- **What:**
  - Each case (R4) debuts or features one mini-game: P4 THE FOREMAN, or the Roadmap's Wire Cut / Lineup / Last
    Orders.
  - The first time a game appears for the group, it gets a DEBUT card on the marquee, and the R5 summons teases it.
- **Why:**
  - Lessons 10 and 13: content exhaustion killed Machine Party's replay. A slow drip of novelty gives every night a
    headline.
- **Where:** server (a "played before" flag per regulars-group) and TV.
- **Effort:** S for the flag, plus L per new game.
- **Risk:** as for each game. No new secrecy surface.

## 5. Night-of proposals (from the first pass, now tagged for retention)

Roadmap overlaps are noted. They're framed as feeding existing items, not duplicating them.

### P1. THE SHIFT: a host-fired back-to-back burst of the phone games · retention: med (variety within and between nights)
- **What:** a GAMES → **THE SHIFT** button. The server picks 2–3 quick rounds from the phone-only games (Bomb, Penny
  Drop, Aaron's Plate) plus Jack-in-the-Box with 4 random players. It runs them back to back with only the marquee
  between them ("NEXT: CALL IT."), then shows one combined loser list for the wheel queue.
- **Why:**
  - Lessons 1 and 10: about 5 minutes of nothing but games.
  - It guarantees the Machine Party round happens even if no level-3 role ever fires.
  - It never repeats the previous Shift's order.
- **Where:**
  - **Server:** a new `shift_start` host action that reuses the existing start/tick code.
  - Host-fired rounds need their **own counter**, so they never eat a role's once-per-game use.
  - **TV:** the marquee between rounds.
- **Effort:** M
- **Risk:**
  - Secrecy improves, but only if each round inside a Shift looks exactly like a role-fired one. Use no per-round
    "SHIFT" label, only the generic marquee between rounds.
  - Today the LV badges are public on every TV card, so a Bomb firing narrows the Intruder down to the visible level-3
    players. Host-fired rounds that look the same mask that leak.
  - If the host wants a visible SHIFT label, the cover is lost. Drop the label rather than the cover.
  - Drunk-friendly: the phone controls already exist.
  - **Rule check:** the fuse, pop number and coin stay server-only, as now.

### P2. CAUSE OF DEATH stamps: a specific, collectable consequence for every loss · retention: med-high (once persisted, it feeds R1/R2)
- **What:** each mini-game loss stamps a short cause on the loser's TV polaroid for the rest of the night. Examples:
  BLOWN UP, CLOWNED, WALKED THE PLANK, CALLED IT WRONG, ATE THE DIRTY ONE, DIDN'T DODGE.
  The stamps stack as small tally marks, and show big for 2 seconds at the result.
- **Why:**
  - Lesson 4: every death is a distinct punchline.
  - Lesson 3: the room can read who keeps dying how.
  - It's the data the Roadmap's **end-of-night awards** (#4) and the "previously on…" montage need ("MOST BLOWN UP").
- **Where:**
  - **Server:** a `cause` column on the logged punishment/loss, which is already public.
  - **TV:** the stamp layer on the board cards.
- **Effort:** S–M
- **Risk:**
  - **Rule check:** never stamp anything that implies who started the game. The Ninja's shuriken stamp must say
    SHURIKEN, never "ASSASSIN".
  - Dodge: the stamp shows only after the result, not the throw direction beforehand.

### P3. Readable two-beat briefing card before every mini-game · retention: low
- **What:** during the existing 3-2-1 countdown, the TV shows two LED marquee beats:
  - beat 1 is the verb ("PASS IT.");
  - beat 2 is how you die ("HOLD IT AT THE BANG = THE WHEEL").
  - The summoned phones show the same two lines on a single bone keycap-style card, with one picture, before the
    controls unlock.
- **Why:**
  - Lesson 11, and lesson 1 (teach inside the countdown that already exists, rather than adding a screen).
  - Drunk players at 00:30 won't remember Penny Drop's rule from 22:00.
- **Where:** TV and phone (copy only). No server change.
- **Effort:** S
- **Risk:** none to secrecy. It's the same text for every player and every role. Drunk-friendly by design: two lines,
  one picture.

### P4. LAST ORDERS-style one-against-all round: THE FOREMAN (a Table Manners adaptation) · retention: med (new content, see R8)
- **What:** a phone mini-game. Everyone eligible mashes a big EAT button to clear a plate (their progress bar shows on
  the TV). At random intervals the TV's Foreman turns round, and the phones flash red and buzz. Anyone who taps during
  red is caught and goes to the wheel; so does the slowest eater.
  - A rotating variant (lesson 6): the last round's loser is the Foreman, and chooses when to look on their phone.
  - They get 3 looks, so it becomes a reading-people duel.
- **Why:**
  - Lesson 7: a new skill (restraint/observation) that no current game uses. Plank and Jack are push-your-luck;
    Dodge is a reflex read.
  - Lesson 9: the result is decided by nerve, not luck.
  - It sits beside the Roadmap's Wire Cut / Lineup / Last Orders ideas.
- **Where:** server (a timing table, with the look times kept server-only until they fire), TV, and phone.
- **Effort:** L
- **Risk:**
  - Drunk thumbs: mashing is fine. The "stop" signal must be the whole phone screen turning red plus a buzz, not a
    small icon.
  - Secrecy: the Foreman variant is public by design. Don't let a secret role pick the Foreman.
  - **Rule check:** a tap's timing must be judged on the server (the server stamps the time it receives each tap,
    with a small grace window), or phone lag decides it.

### P5. GHOSTS: something to do while you're sitting out · retention: low-med (sitting out stays fun)
- **What:** the Angel, anyone in the Locker and anyone in rehab get a **cosmetic** heckle pad during mini-games. It
  sends a few big reactions (a skull, a clown or a "BOTTLE IT") onto the TV beside the players' stations. They are
  never sent to the playing phones.
- **Why:**
  - Lesson 6 (Inside Job keeps the dead in the game), and Machine Party's main social complaint: silent players lose
    the "zest".
  - At present, Locker and Angel players just watch.
- **Where:** phone and TV. It can reuse the existing emoji broadcast channel and its rate limit.
- **Effort:** S
- **Risk:**
  - **Rule check:** it must not affect a running game. The Plank/Dodge fairness rules (rules-auditor) forbid
    anything that changes a player's input or view on their phone. Keep it TV-only and cosmetic.
  - It must not be identifiable as a role: the Angel is public anyway, and rehab players are public.

### P6. Catch-up for the drinking load: the BAD LUCK charm · retention: med (the worst-treated still want to come back)
- **What:** after each game, any player who has spun the wheel noticeably more than the room's average (e.g. 3 or
  more above the median) gets a public **BAD LUCK charm**. Their next wheel landing is rolled twice, and they take the
  milder of the two. It's shown on their TV card.
- **Why:**
  - Lesson 8: "no way to catch up" was the top complaint.
  - Here the runaway is one friend drinking far more than the rest, which is both unfun and unsafe.
  - It mirrors the Champ's golden ticket at the other end.
- **Where:**
  - **Server:** computed in `finish_game` from public punishment counts.
  - **TV:** a badge.
  - **Phone:** a one-line notice.
- **Effort:** S–M
- **Risk:**
  - Secrecy: punishment counts are already public. But the charm must interact with the Forger, Medic and Cursed by
    clear rules: it applies after the Cursed double-spin, and the Forger can't touch it, the same as the golden ticket.
  - It needs a "mild" ordering on the wheel slices.
  - **Balance:** it slightly favours the Saboteurs (fewer sips). It's harmless, but flag it to the host.

### P7. Survivor's pick: winning a mini-game opens a small betrayal chance (optional) · retention: low
- **What:** the survivor or winner of a mini-game (e.g. the furthest-safe Plank walker, or the correct Penny caller
  with the fastest call) gets one public **POINT THE FINGER**. They nominate someone for the next Trial's "named
  suspect" slot, which shows on the TV with the survivor's face.
- **Why:**
  - Lessons 2 and 5: success should tempt you to betray.
  - It feeds the deduction game rather than the drinking.
- **Where:** server (a nominee field on the next vote), TV (a Trial exhibit), and phone (one pick list).
- **Effort:** M
- **Risk / conflict:**
  - **The user has ruled out "handing out sips"** (BETTING spec). That's why this hands out *suspicion*, not drinks.
  - If the host wants a drink version instead, it conflicts with that line.
  - A Saboteur survivor can use it to frame someone, which is fine and on theme.

### P8. Never the same game twice in a row: the rotation guard · retention: med
- **What:** for host-fired games (the Shift, Aaron's Plate from GAMES, and P4), the server avoids the last two
  mini-games played. The NOW PLAYING marquee shows "NEW GAME" the first time each one appears tonight.
- **Why:** lesson 10 ("after one run you've played pretty much all of them"). It spreads the six-plus games across
  the night.
- **Where:** server (a recent-games list on the room) and TV (a marquee tag).
- **Effort:** S
- **Risk:** none. Role-fired games are untouched, because restricting them would leak timing.

### P9. Between-games beat: THE LEDGER, ten seconds and no more · retention: low
- **What:** after Champ/Slacker, one 10-second TV card:
  - the group's beers against pace (the Roadmap "on pace" ghost);
  - each player's wheel count as tally marks;
  - P2's death stamps;
  - then straight into the Trial prompt.
- **Why:**
  - Lesson 12 and lesson 1: one readable summary instead of several screens.
  - It's the visible ledger the Roadmap pace tracker (#3) needs.
- **Where:** TV only. Public data.
- **Effort:** S–M
- **Risk:**
  - **Rule check:** never show the hidden Skank ×2/×3 bonus, Detective checks, heals or a per-player "phone vs host
    +1" split.
  - Phone-logged counts already drive the public LV badges, so they aren't secret. The tallies count punishments only.

## 6. Conflicts and rules summary
- **The retention rule (it applies to R1–R3 and R7):** persistent records are built **only from finished rooms after
  `reveal_all`**.
  - Nothing from the current night may feed the rap sheet, ranks or badges until the reveal. A live stat ("picked by
    X", "FIRST BLOOD") would expose Davy Jones, the Jester, the Scrooge or the Intruder.
  - Cosmetics are chosen before the deal and never vary with role or level.
- **Identity (R0, R6):** regulars are host-owned. Re-claiming a face needs the host's OK or a PIN, so nobody can
  join as someone else.
- **Secret roles never on the TV:** P1 must not reveal the starter of role-fired rounds. P2's stamps name the method,
  never the role. P9 must not show beer splits per phone.
- **Server-validated abilities:**
  - P1: a separate host-only counter, so the role counters don't change.
  - P4: tap timing judged on the server.
  - P6 and P7: decided only in `finish_game` / the vote code.
- **Fairness rules for Plank/Dodge:** P5 stays cosmetic and TV-only.
- **The user's "no handing out sips" line:** P7 is suspicion-only for this reason.
- **The 10 Oct timeline:**
  - **R0 must happen before the party.** Without it, night 1 can't be linked to later nights by anything other than
    names.
  - P2 is worth doing before the party too, because its stamps become R1/R2 material.
  - R1–R8 can all be built after night 1, from its archived data.
  - P3, P5 and P8 are S. P1 is M and reuses the existing code. P4 is the only new mini-game, and is L.
