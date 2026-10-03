# Gartic Phone: research and proposed upgrades for The Hundred

Researched 2026-10-03, a week before the party (10 Oct). Read alongside `README.md` and the Roadmap memory.
Already built, so not proposed again: anonymous evidence photos at the Trial, host KICK and hide-evidence, the
REVEAL ALL case file, one-TV-moment-at-a-time, name summons. Already on the Roadmap and **merged into the items below
rather than duplicated**: "End-of-night awards after reveal_all" (Before the party #4) and "photo wall + 'previously
on…' montage" (Longer term).

## What Gartic Phone is, briefly

A browser telephone-pictionary game (Onrizon, December 2020): write a sentence → the next player draws it → the next
writes what they think the drawing is, and so on. **Every player starts a chain at the same time**, so everyone is busy
every turn, and at the end the host plays each chain back as an "album". Up to 30 players. Modes vary what you can see
and how long you get:

| Mode | The twist |
|---|---|
| Normal | Write, draw, write, draw… |
| Knock-off | Copy the last drawing from memory; the clock gets faster each turn |
| Secret | Your own sentence is hidden as you type and your canvas stays blank while you draw |
| Animation / Solo / Movie / Background | Each player draws the next frame of a shared GIF |
| Masterpiece / No Rush | No timer, or the timer only starts once half the room is done |
| Story | Text only: each player continues someone else's sentence |
| Icebreaker | Drawn answers to questions, then a talk-about-it phase |
| Complement | Start with a few random lines; the next player turns them into something |
| Speedrun | Normal with brutal timers |
| Sandwich | Write at the start and the end only; drawings in between |
| Crowd (removed mid-2024) | For 15–30 players: fewer turns and faster timers |
| Exquisite Corpse (replaced Crowd) | Each player draws one body part, seeing only a sliver of the part above |
| Missing Piece | Draw something incomplete; the next player completes it; then the original part is erased |
| Co-op | Draw one picture together |
| Score | Points for matching the last link (reviewers rank it the worst mode) |

## 1. Design lessons

1. **The laugh is the whole chain, not any single link.** Players say the funny bit is seeing the first prompt next to
   the final guess with every step in between; one drawing on its own rarely lands. Reveal *sequences*, not single
   frames. ([Lilach Bullock, prompts guide](https://www.lilachbullock.com/funny-gartic-phone-prompts-for-game-night/);
   [Wikipedia: Broken Picture Telephone](https://en.wikipedia.org/wiki/Broken_Picture_Telephone))
2. **Incompetence is the fuel, so make it impossible to be good.** "The worse you draw, the funnier it gets", and the
   cramped phone screen "is part of the fun". On a small screen a clumsy tool works in your favour.
   ([WhistleOut review](https://www.whistleout.com/CellPhones/Apps/gartic-phone-app-review);
   [Telestrations guide](https://playpartygame.com/guessing-and-mystery-games/how-to-play-telestrations/))
3. **Semantic drift needs only 4–6 hops.** The sweet spot is about 6–8 players per chain. Longer chains make the
   reveal drag, and "Crowd" handled big rooms with *fewer turns and faster timers*, not longer chains.
   ([Verà Labs guide](https://playveralabs.com/gartic-phone/);
   [TheGamer, modes ranked](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/))
4. **Run the chains in parallel so nobody waits.** Every player starts an album, so all 12 phones are busy every turn.
   A single 12-person chain would leave 11 people idle.
   ([Wikipedia: fold-the-paper structure](https://en.wikipedia.org/wiki/Broken_Picture_Telephone);
   [Fortress of Solitude](https://www.fortressofsolitude.co.za/gartic-phone-what-is-it-how-do-you-play/))
5. **Treat the timer as a comedy dial, with options for stragglers.** Gartic's options: Fast (half), Slow (double),
   **Regressive** (shorter every turn), Progressive, **Dynamic** (the clock only starts once most players press DONE),
   Infinite, and Host's decision. Guides say "fast timers force sheer panic, and panic equals pure comedy". Dynamic
   time is the drunk-proof one: nobody is rushed until the group is waiting on them.
   ([Gartic on X: Regressive Time](https://x.com/Gartic/status/1388134776125677577);
   [Gartic on X: presets](https://x.com/garticphone/status/1372640014132207623);
   [custom settings guide](https://medium.com/gartic/unlocking-gartic-phone-how-to-fully-customize-your-gartic-phone-match-3c3d67f418de))
6. **The reveal is host-paced, with an auto option.** The host picks *manual* (clicks through each step) or
   *automatic*, and whether albums play from the start or the end. With a manual click the host can wait for the
   laugh to die down before the next step.
   ([Album, Gartic Phone wiki](https://gartic-phone.fandom.com/wiki/Album);
   [lobby & custom settings](https://gartic-phone.fandom.com/wiki/Lobby_and_custom_settings))
7. **Hiding information is the strongest twist.** *Secret* (blank canvas, hidden text) ranks near the top because it
   creates "maximum chaos". *Knock-off* (copy from memory) and *Exquisite Corpse* (see only a sliver of the last part)
   are the same trick: restrict what the next person sees.
   ([TheGamer](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/);
   [Gartic on X: Exquisite Corpse](https://x.com/Gartic/status/1794118110837965031);
   [Tech Rorschach, all modes](https://techrorschach.com/all-gartic-phone-modes/))
8. **Scoring adds little.** Score mode ranks last ("feels a little arbitrary… doesn't need it"). The payoff is the
   shared laugh, not a winner. Any drawing game should end in a consequence, not a points table.
   ([TheGamer](https://www.thegamer.com/gartic-phone-all-game-modes-ranked/))
9. **People want to take the album home.** There's a GIF download button at the reveal, and fans still wrote scripts
   to stitch whole albums into one PNG with names and guesses, which is the format you can share in a group chat.
   ([Gartic Phone wiki: album/GIF](https://gartic-phone.fandom.com/wiki/Album);
   [JeanMeche's album-export gist](https://gist.github.com/JeanMeche/51108e81f1ef61bfb513d0f3f30eb1f6);
   [Verà Labs: "export full digital albums and animated GIFs"](https://playveralabs.com/gartic-phone/))
10. **Screen content before it's shown, not after.** The moderation tool lets the host (or someone they trust, on a
    second device) see each drawing or sentence *before* the album shows it, and blur it with one tap. Blocked
    players get a red mark, and kicks are tied to the room, so a kicked player can't rejoin.
    ([Gartic: moderation tool](https://medium.com/gartic/gartic-phones-moderation-tool-keeping-the-game-fun-and-safe-fce642d4814c);
    [Gartic on TikTok: review before showing](https://www.tiktok.com/@gartic/video/7226783356174732549);
    [safety tips](https://medium.com/gartic/playing-gartic-phone-safely-essential-tips-for-gamers-and-streamers-ac642a10dc02))
11. **The tools are simple, but still too many for drunk thumbs.** Pencil, eraser, shapes, fill, undo/redo, 18
    colours, 5 brush sizes, opacity. The parts that matter on a phone are a big pen, a few colours and undo; the
    rest is for sober artists.
    ([Gartic Phone wiki: drawing](https://gartic-phone.fandom.com/wiki/Drawing_and_writing);
    [Liverpool Researcher Hub guide](https://www.liverpool.ac.uk/researcher/postdoc-appreciation-week/npdc/engagement/pre-conference/gartic-telephone/))
12. **Zero friction to join, and a format streamers can show.** A link or QR code, no accounts, any device. Its rise
    came from lockdown and from streamers finding the reveal "pure content gold". Seeing everyone's face react to the
    reveal is the product.
    ([Verà Labs](https://playveralabs.com/gartic-phone/); [Wikipedia](https://en.wikipedia.org/wiki/Broken_Picture_Telephone))

## 2. Proposed upgrades for The Hundred

Hard rules checked for every item: **a secret role never reaches the TV** (get_state's host view has no secrets);
**every ability and every timer is server-validated** in `api_exec`; drunk-thumb phone UI; one TV moment at a time.
The party is in 7 days, so each item says whether it is realistic **before 10 Oct**.

### P1. THE CASEBOOK: the end-of-night replay album (TV)  ·  **M–L**  ·  before the party: yes, as a cut-down version
- **What:** after REVEAL ALL, a new **OPEN THE CASEBOOK** button on the TV. It plays the night back as Gartic-style
  albums, one per chapter: *Game 1 → Trial 1 → Game 2 …*. Each chapter is a sequence: beers since the last chapter
  (the rack filling up), the matchup and its losers, the wheel results (who, what, ×2 shiv, SAVED/FORGED), every
  evidence exhibit with its caption, the vote tally and the verdict stamp. After the role reveal it also replays the
  **secret moves at the moment they happened** ("21:42: the Forger forged Priya's heal", "Hit on Dave: MISS"). The
  host clicks **NEXT** for each step (manual mode); **AUTO** plays it at about 4 seconds a step. It ends with the
  Roadmap's end-of-night awards (most punished, best stand-in, sharpest Detective, wrongest accuser).
- **Why:** lessons 1 and 6. The chain is the joke: "she voted *him* guilty, 20 minutes after *he* got her shivved".
  Evidence photos are the players' favourite feature, and at the moment they disappear after each Trial.
- **Where:** TV (new scene, built from the existing stamp/polaroid art). Server: a `get_recap` action that is
  **refused until `reveal_all` has run**; it joins `events`, punishments, votes, evidence and the secret-action log.
  Before the reveal it returns nothing.
- **Risk:** secrecy is **HIGH if gated wrong**. The secret chapters must come from a server endpoint that is locked
  until the reveal, never from the live `get_state`, and the client can't be trusted to hold them back. Evidence
  hidden by the host stays hidden. Evidence photographers stay anonymous for ever (the album never says who filed an
  exhibit). Drunk-friendliness: none, because only the host clicks.
- **Cut-down for 10 Oct:** public chapters only (beers, games, wheel, evidence, verdicts) plus the existing case file
  at the end. That needs no new secret log.

### P2. TAKE YOUR FILE HOME: shareable keepsakes (phone + TV)  ·  **M**  ·  before the party: maybe
- **What:** once the night is over, every phone gets **SAVE MY FILE**: one tall PNG case file with their mugshot,
  real role stamp, team result, beers logged, every punishment they took (with ×s), the votes they cast and how
  those landed, any Trial they stood in, and one evidence photo (if any were shown). There's also a group **FRONT
  PAGE** poster (the final tally, the winners, all 12 mugshots stamped with their roles), which the TV can show as a
  QR code to download. Optionally, a short animated GIF of the beer rack climbing to the final number.
- **Why:** lesson 9. Fans wrote their own exporters to get a single shareable image; a PNG pastes straight into the
  group chat on 11 Oct, where the night carries on.
- **Where:** phone and TV, drawn client-side on `<canvas>` from data the caller is already allowed to see (after the
  reveal, roles are public). Server: nothing new except the recap data from P1.
- **Risk:** secrecy: only offered after `reveal_all`, so low. Tech: drawing images from the `selfies` bucket onto a
  canvas needs CORS headers (Supabase public storage normally sends `*`, but **test it**); without them the canvas is
  locked and won't export. iOS Safari saves through the share sheet, so use `navigator.share` with a file and fall
  back to a long-press on the image. Drunk-friendliness: one big button.

### P3. POLICE SKETCH: a telephone mini-game (phones draw, TV reveals)  ·  **L**  ·  before the party: no
- **What:** a mini-game started by the host from GAMES (or later as a level-3 power). The server splits the
  eligible players into **3 chains of about 4** that run **at the same time** (lesson 4). Link 1 gets a **witness
  statement**, a ridiculous prompt drawn from a list ("the suspect, mid-pint, wearing the hat of shame"). Link 2
  draws it, link 3 writes what they see, link 4 draws that. Each turn is 25 s, then 20 s, then 15 s (**Regressive**,
  lesson 5). The TV then plays each chain as an album, one step per host tap, and at the end of each chain the room
  votes on the **worst link**: that person goes in the punishment queue (a consequence, not points, lesson 8).
- **Why:** this is the Gartic loop, with a noir skin ("sketch artist", "witness statement") and a drinking ending.
  It is the one big format missing from the current mini-games, which are all reflex or luck games.
- **Where:** phone: a canvas with **one fat pen, 3 inks (black, red, chalk-white), UNDO and DONE**, and nothing else
  (lessons 2 and 11). Screens follow the drunk-thumbs rule: a full-screen canvas and one 2-word button. TV: a
  chain-reveal scene. Server: chain assignment, prompts, deadlines and auto-submit at the deadline (empty canvas =
  "THE WITNESS FLED") all in `api_exec`; drawings upload to a random insert-only path like evidence (`sk/<random>`).
  Uses the one-TV-moment lock and the summons system only for the reveal.
- **Risk:** secrecy: prompts must **never be role-related**, and the TV never shows who started it (same rule as
  the other mini-games). Players *can* doodle their own role; that's no different from saying it out loud. Content:
  see P6. Drunk: the timer has to forgive slow hands; lean towards Dynamic time (the clock starts only when most of
  the chain is done). Biggest build on this list.

### P4. COURTROOM SKETCH: draw an exhibit at the Trial (phone → TV)  ·  **S–M**  ·  before the party: yes
- **What:** the **EVIDENCE** screen gets a second tab, **SKETCH IT**: no photo, just a quick drawing ("Dave's pint
  going into the plant pot") with the same anonymous caption. It goes up on the Trial corkboard as an exhibit,
  marked COURTROOM SKETCH.
- **Why:** evidence is the players' favourite feature, but a photo needs you to catch the moment. A sketch lets you
  testify after the fact, and a terrible drawing of a crime is very Gartic (lesson 2).
- **Where:** phone: the P3 canvas (or a first, simpler version of it). Server: reuse `submit_evidence`; upload the
  PNG to `ev/<random>.png`, still not traceable to the filer. TV: the existing exhibit card, with a pencil-on-paper
  frame instead of a polaroid.
- **Risk:** secrecy: same anonymity as photos (no uid in the path). Drunk-friendliness: good if the canvas is the
  P3 minimum. Content: the host can already HIDE; see P6 for screening before it shows.

### P5. RUMOUR MILL: an anonymous one-line testimony telephone at the Trial  ·  **M**  ·  before the party: maybe
- **What:** an optional Trial opener, based on Story mode and **Secret** (lesson 7). Each voter gets 20 s to finish
  "I SAW…" in 40 characters, aimed at any player. The server shuffles the lines; each one is passed to a random
  other phone, which sees **only the line, with the name blanked**, and must guess who it's about. The TV then
  reveals each rumour with the guess and the real target (never the author), typed out in the case-file font.
- **Why:** it gives the Trial a real "whispered" phase that puts suspicion into words, and it is cheap to play
  (one text box, then one tap on a mugshot).
- **Where:** phone (one text box, then a grid of mugshots), TV (rumours one per host tap), server (shuffle, blanking
  and deadlines in `api_exec`).
- **Risk:** content: free text on the TV, so it needs P6's screen before it shows. Secrecy: lines are anonymous;
  "I saw Priya with the Detective card" is just talking, already possible. Drunk: typing is the weakest input for
  drunk thumbs; offer 8 tap-to-fill starter phrases.

### P6. HOLD FOR REVIEW: screening for anything typed or drawn (TV host panel)  ·  **S**  ·  before the party: yes
- **What:** a Setup switch **SCREEN EXHIBITS**. When it's on, new evidence (and any later sketches or rumours)
  arrives **held**; the host's TV toast shows a thumbnail with **ALLOW / HIDE**, and the Setup → Evidence list gets a
  HELD state. When it's off, behaviour is as now.
- **Why:** lesson 10. Gartic screens before the album shows; at the moment The Hundred hides only after the fact,
  and a photo can go up on a 40" TV at a Trial before the host has looked at it.
- **Where:** TV (the Setup tab and the toast). Server: a `held` flag on evidence; `get_state` doesn't send held
  items to the TV's exhibit list.
- **Risk:** low. The host's toast must not reveal who filed it (it doesn't today). Default **off**, so nothing
  changes on the night unless the host wants it.

### P7. DYNAMIC and LAST ORDERS timers: pace from Gartic's timer options (server)  ·  **S**  ·  before the party: yes, the Trial part
- **What:** two timing changes. (a) **Dynamic Trial clock:** the vote timer only starts once about 70% of eligible
  voters have voted, then gives the stragglers 20 s (lesson 5), so a drunk who hasn't found their phone isn't cut
  off at 0:00 while 9 people are already waiting. (b) **LAST ORDERS (Regressive):** from about 00:15, the mini-game
  muster window, the Plank speed and the Trial timer shorten step by step, and the TV says "LAST ORDERS" in the
  NOW PLAYING marquee, so the end of the night speeds up instead of dragging.
- **Why:** "panic equals pure comedy" late at night, while early on the timers stay forgiving. The deadline is
  01:00, so the game already has a natural crescendo to tie this to.
- **Where:** server only (`ends_at` is already computed there), plus the marquee label on the TV.
- **Risk:** low. Fairness: Dodge's 6-second read and other reaction timings shouldn't shrink, because those
  fairness rules are audited; only change muster and vote windows. No secrets involved.

### P8. WANTED POSTER (Exquisite Corpse): a 3-player drawing duel (phones → TV)  ·  **M**  ·  before the party: no
- **What:** a short variant of the P3 engine for the **matchup losers' tie-break** or the Slacker. Three players
  each draw one strip of a WANTED poster (head / body / legs) of a suspect named on the TV, seeing only a 10 px
  sliver of the strip above. The TV unrolls the poster from the top down, and the room votes which strip gave it
  away: that player drinks.
- **Why:** lesson 7 at its strongest: one reveal, about 60 seconds, and it uses the WANTED poster art the
  summons already has.
- **Where:** phone canvas (from P3), TV poster scene, server strips and deadlines.
- **Risk:** the named "suspect" is a public player, never a role; same secrecy as P3. Only worth building once P3's
  canvas exists.

### P9. PREVIOUSLY ON…: a mini album between games (TV)  ·  **S–M**  ·  before the party: maybe (Roadmap item)
- **What:** the "previously on" montage from the Roadmap, done as Gartic's **automatic** album: when the host opens
  GAMES, the TV plays a 15-second, skippable recap of only the *public* moments since the last game (wheel results,
  curse passes, verdicts, the photo of the last exhibit). No secret moves.
- **Why:** lessons 1 and 6 in miniature; it reminds a noisy room what's happened since and feeds suspicion before
  the next Trial.
- **Where:** TV only, from the public `events` the TV already receives.
- **Risk:** secrecy: it must only use events the TV view already shows. **Do not** reorder or time things in a way
  that hints at hidden actions (heals, forgeries and investigations are never shown, the same rule as "secret
  abilities never wait"). Uses the one-TV-moment lock.

## Conflicts with the rules (summary)

| Item | Rule at risk | Mitigation |
|---|---|---|
| P1 Casebook (secret chapters) | Secret roles never on the TV | Server endpoint refuses until `reveal_all`; never from `get_state` |
| P2 Keepsakes | Same | Offered only after `reveal_all`; Locker/Angel status are public anyway |
| P3 / P8 drawing games | Server-validated abilities; TV never says who started a mini-game | Chains, prompts, deadlines and auto-submit in `api_exec`; random insert-only storage path |
| P4 / P5 anonymous content | Evidence anonymity (no uid) | Same `ev/` random-path pattern; the TV never names an author |
| P7 timers | Audited Dodge/Plank fairness rules | Only shorten muster/vote windows; reaction windows unchanged |

## Recommended order for 10 Oct

P6 (S) → P7a Dynamic Trial clock (S) → P4 Courtroom Sketch (S–M) → P1 cut-down Casebook (M) → P2 if time allows.
P3, P5 and P8 go on the Roadmap's longer-term list.
