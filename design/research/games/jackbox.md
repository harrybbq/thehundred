# The Jackbox Party Packs: lessons for The Hundred

Researched 2026-10-03, seven days before the party. Covers Quiplash, Fibbage, Trivia Murder Party, Drawful, Push the Button,
Fakin' It, Weapons Drawn, Hypnotorious, Job Job and Champ'd Up, plus Jackbox's settings, accessibility and streaming features.
Checked against README.md and the Roadmap memory (2026-10-02) so nothing below repeats work that is built or already planned.

---

## 1. Design lessons

**1. One decision per moment, and say what to do next.**
Allard Laban: the games "never ask players to make multiple choices in a given moment; it's always either pick an answer,
draw a picture, or enter a word or phrase". Harry Gottlieb's Jack Principles say the same: "limit the user's choices, give them
one task at a time, make sure they always know what to do next".
Source: [Built In Chicago](https://www.builtinchicago.org/articles/jackbox-games-design-party-pack), [Coding Horror: The Jack Principles](https://blog.codinghorror.com/the-jack-principles/)
*The Hundred already does this:* the vote check screen, the locked YOUR MOVES cover and the "You: just drink." line under NOW.

**2. Never wait on one person: the game moves on by itself.**
The Jack Principles say the program should know it's waiting, then "pause or move on without the user's response if it doesn't
come soon enough". Jackbox rounds run on hard timers "so you're never stuck waiting for one person to finish".
Source: [Coding Horror](https://blog.codinghorror.com/the-jack-principles/), [TechCrunch](https://techcrunch.com/2020/05/04/all-product-creators-can-learn-something-from-jackbox-games-user-experiences/)
*Already in The Hundred:* PICK AT RANDOM FOR THEM, START ANYWAY, "too slow and it cranks once for you" and the queue that calls
the next victim by itself.

**3. Give the people who are waiting something to press.**
In Push the Button, players who aren't doing the current test get a **"Hurry Up!"** button that shortens the timer for the ones who are.
Hypnotorious has a **clap** button that hands out small bonuses. Lobbies give you a doodle pad while you wait.
Source: [Jackboxpedia: Push the Button](https://jackbox.wiki/wiki/Push_the_Button), [Jackboxpedia: Hypnotorious](https://jackbox.wiki/wiki/Hypnotorious)

**4. Being out of the game shouldn't mean being out of the fun.**
In Trivia Murder Party, dead players come back as **ghosts** in the final round: they get three answer choices (the survivor
gets two) and can steal the win. The audience bets on Killing Floor outcomes.
Source: [Jackboxpedia: Trivia Murder Party](https://jackbox.wiki/wiki/Trivia_Murder_Party)

**5. Spread the secrets around so nobody feels exposed.**
In Weapons Drawn, everyone is a murderer and a detective, so "no one has to feel the pressure of being the only one with a
secret role". Unsolved murders come back in a quick **Cold Case** round at the end, which ties off loose threads.
Source: [Jackbox blog: Weapons Drawn rules](https://www.jackboxgames.com/blog/rules-strategies-weapons-drawn)

**6. Social deduction works best with your body, not your phone.**
Fakin' It's tasks are physical: raise a hand, hold up some fingers, point at someone, pull a face. The Faker gets no prompt and
has to copy everyone else. Jackbox's founders say "everybody has to be looking at each other while they're playing the game".
Source: [Jackboxpedia: Fakin' It](https://jackbox.wiki/wiki/Fakin%27_It), [CBR interview with Gottlieb and Bilder](https://www.cbr.com/interview-jackbox-harry-gottlieb-mike-bilder/)

**7. Reward people for catching the liar, not only for lying.**
Fakin' It pays a **Sleuth Bonus** to everyone who voted for the Faker, and a Faker Bonus if they escape. Push the Button needs a
**unanimous** vote to throw someone out, and one wrong ejection loses the game for the humans. That makes the accusation the
big moment of the round.
Source: [Jackboxpedia: Fakin' It](https://jackbox.wiki/wiki/Fakin%27_It), [Jackboxpedia: Push the Button](https://jackbox.wiki/wiki/Push_the_Button)

**8. Spectating should change the result.**
Quiplash's designer called the Audience an "enhanced spectator" role: "who wants to just watch when you can participate?"
Anyone who joins after the lobby closes goes straight into the audience instead of being turned away.
Source: [PlayStation Blog: Quiplash audience](https://blog.playstation.com/2015/06/30/quiplash-new-party-game-expands-audience-participation-to-10000/), [Jackboxpedia: Audience](https://jackbox.wiki/wiki/Audience)

**9. Timers are an accessibility setting.**
Since Party Pack 2 almost every game has **Extended Timers**; Party Pack 8 added **No Timer** in Job Job, and Party Pack 10
groups Subtitles, Motion Sensitivity, Extended Timers and No Timers together under Accessibility. Jackbox says longer timers
help people who need more time "to hear or read prompts and enter responses", not only laggy streams.
Source: [Jackbox blog: Party Pack 8 features](https://www.jackboxgames.com/blog/streaming-moderation-accessibility-features-jackbox-party-pack-eight), [Jackbox blog: Party Pack 10 accessibility](https://www.jackboxgames.com/blog/accessibility-features-in-the-jackbox-party-pack-10)

**10. Assume the room is loud: put every spoken line on screen.**
Party Pack 6 added subtitles to every game for people who are hard of hearing *or playing in noisy rooms*. Party Pack 7 reads
the room code aloud and adds a motion-sensitivity switch.
Source: [Jackbox blog: Party Pack 6](https://www.jackboxgames.com/blog/new-features-in-the-jackbox-party-pack-six), [Jackbox blog: Party Pack 7 accessibility](https://www.jackboxgames.com/blog/new-accessibility-features-in-the-jackbox-party-pack-7)
*Already largely true here:* the WANTED poster shows the summoned names, the Walk of Shame has a caption and the reveal respects reduced motion.

**11. Hand the controls to someone in the room.**
The first player in is the **VIP** and starts the game from their phone ("Everybody's In"). **Start Game From Controller Only**
exists for when the person who should be in charge didn't get VIP.
Source: [Jackbox blog: Party Pack 5 streamer's guide](https://www.jackboxgames.com/blog/the-jackbox-party-pack-5-streamers-guide)

**12. Short rounds, with a way back in.**
Games run 15–20 minutes and use **comeback mechanics** "which allows players who are behind in points to catch up". Rejoining
after a drop is just the same code and name, because a cookie remembers your seat.
Source: [TechCrunch](https://techcrunch.com/2020/05/04/all-product-creators-can-learn-something-from-jackbox-games-user-experiences/), [Jason Shen](https://jasonshen.com/2020/the-product-genius-behind-jackbox-games), [Steam thread on rejoining](https://steamcommunity.com/app/331670/discussions/0/619574421241120886/)

### Things Jackbox backs up that are already built or planned (not proposed again)
- **Rejoin after a drop:** this already works through the stored room code and the Supabase session. Moving to a **new** phone is Roadmap #1 (the host's relink code).
- **30-second onboarding:** Roadmap #2 (the 3-card primer).
- **"Awareness" of the room and the clock:** Roadmap #3 (the pace ghost and the 40-minute no-game nudge).
- **Closing ceremony / Cold Case:** Roadmap #4 (end-of-night awards) and the REVEAL ALL case file.
- **Something to do while waiting / betting on outcomes:** the Bookie (still an open decision). Trivia Murder Party's audience wagers show it works as a side-show, which is the line the user already drew.
- **Late joiners:** spare codes. **Moving on without the user:** START ANYWAY and PICK AT RANDOM. **Motion sensitivity:** reduced motion.
- **Spectator /watch:** this is on the longer-term list. Lesson 8 supports it, and proposal 6 below is the small version.

---

## 2. Proposed upgrades for The Hundred

The party is 7 days away. **S items** could go in before 10 Oct; **M items** only if there's spare time after the Roadmap
must-dos; **L items** are for after the party.

| # | Upgrade | Lesson | Where | Effort | Before 10 Oct? |
|---|---|---|---|---|---|
| 1 | Late-night timers ("LAST ORDERS PACE") | 9, 2 | server + TV setting | S | Yes |
| 2 | DRAG THEM HERE during summons | 3 | phone + TV | S | Yes |
| 3 | Who's offline: a dot on TV cards | 2, 12 | TV + Realtime Presence | M | Maybe |
| 4 | Host remote on the host's phone (VIP) | 11 | new /remote route | M | Maybe |
| 5 | Sleuth stamp for correct Trial voters | 7 | server + TV | S–M | Yes (balance check first) |
| 6 | The Gallery: a say for the Locker, rehab and the Angel | 4, 8 | phone + TV | M | Maybe |
| 7 | PUSH THE BUTTON: a Trial called by a player | 7, 3 | server + phone + TV | M | No |
| 8 | THE LINEUP: a Fakin' It-style mini-game | 6, 5 | server + phone + TV | L | No |

### 1. Late-night timers ("LAST ORDERS PACE")
- **What:** a single setting in Setup: ×1 / ×1.5 / ×2, optionally switching itself on at a set time (e.g. after 00:00). It stretches every window people react in: the Dodge read, Penny Drop's call, a Jack-in-the-Box turn, Aaron's Plate, the Plank, the Trial vote, and the 4-second TAKE IT FOR THEM lock. When it switches on, the TV shows a one-time banner, *"LAST ORDERS: EVERYONE GETS MORE TIME"*.
- **Why:** lesson 9. Jackbox treats timers as accessibility. At 00:30, drunk thumbs are an accessibility problem, and a missed 6-second Dodge feels like the game's fault rather than the player's.
- **Where:** server. Every window is a hard-coded `interval` in `20261005000002_v3_logic.sql` (Dodge 10 s, Plank 14 s, plate 25 s, Penny, Jack, the vote's `ends_at`). Multiply each one by `rooms.settings->>'pace'` (the `settings` jsonb already holds `scrooge_swap`). The TV and phone countdowns already read `ends_at`, so the clients barely change.
- **Effort:** S. It's one multiplier per interval, plus a logic test.
- **Risk:** no secrecy risk. **Rule to keep:** the multiplier has to be room-wide and announced, never per-player, or it breaks the Dodge/Plank fairness rules that the rules-auditor checks. Leave the bomb fuse (20–40 s, secret) and the pop number alone: they're secrets, not reaction windows.

### 2. DRAG THEM HERE during summons
- **What:** while a WANTED poster is up and someone hasn't checked in, every *other* phone's NOW card shows a big **DRAG THEM HERE** key. Each tap adds to a "🔔 ×14" shame counter under that name on the poster and buzzes the missing phone harder. One tap per phone every few seconds.
- **Why:** lesson 3 (Push the Button's Hurry Up). Right now a summons is dead air for everyone else: "You: watch the TV." This turns the wait into heckling, which is the fun part of a party, and it gets the no-show to the TV faster than the 90-second START ANYWAY.
- **Where:** phone (one key) and TV (the counter on the poster). Send it as a broadcast like emoji, rate-limited by the TV's existing emoji allow-list, so it needs no database write.
- **Effort:** S.
- **Risk:** low. The summoned names are already public, and the counter must never show who started the game or who is tapping. Leave it off the summoned players' own phones (they get the buzz instead) so it's one clear action.

### 3. Who's offline: a dot on TV cards
- **What:** a small grey "📵 OFFLINE" mark on a player's TV card when their phone hasn't been seen for about 60 s. NEXT UP, the summons and the host's player sheet show it too, so the host goes straight to SPIN FOR THEM or START ANYWAY instead of waiting.
- **Why:** lessons 2 and 12. Jackbox holds your seat and knows you dropped. Today the host only finds out a phone is dead by waiting.
- **Where:** TV. Use Supabase Realtime **Presence** on `room:<id>` (phones track `{player_id}`), so there's no `last_seen` column, no write and no row lock in `get_state`. Nothing like it exists yet.
- **Effort:** M. Presence is new to the codebase, and phones sleeping with the screen locked need a grace period so the TV doesn't flicker.
- **Risk:** the channel is public, so presence would show *player id + online* to anyone who has the room id. That's not a role, but keep the payload to the id only. No drunk-friendliness risk.

### 4. Host remote on the host's phone (VIP)
- **What:** a `/remote/CODE` page on the host's phone, signed in as the host, with only the big recurring buttons: **+1 BEER**, **NEXT UP / STOP AFTER THIS**, **GAME OVER → tap the losers**, **START THE TRIAL**, **UNDO**, **SPIN FOR THEM**. Everything else stays on the laptop.
- **Why:** lesson 11. The host is also a drunk player; walking to the laptop every time the queue stalls is the biggest drag on pacing.
- **Where:** a new phone route that reuses the TV's `act()` calls. Every host action already checks `rooms.host_id`.
- **Effort:** M.
- **Risk:** the host view has no secrets by design, so it's safe to show. **Auth clash:** the host's *player* session is an anonymous login in the same browser storage. The remote must live in a separate browser profile, an incognito tab or a second device, or it will sign the host out of their own player seat. Big buttons, and UNDO stays one tap away.

### 5. Sleuth stamp for correct Trial voters
- **What:** on a **GUILTY** verdict against a real Saboteur, everyone who voted for them gets a **SLEUTH** stamp on their TV card and can hand out one drink (a ×1 penalty on any player who isn't the Angel or in the Locker) from their phone. It mirrors NOT GUILTY, where the accusers drink.
- **Why:** lesson 7. Right now the Trial only punishes wrong guesses. Fakin' It shows that rewarding the right guess makes voting feel like a play, not a risk.
- **Where:** server: at `close_vote`, read `ballots` *after* the verdict and log the stamps and drinks. TV: stamps after the verdict animation. Phone: one PICK screen.
- **Effort:** S–M.
- **Risk:** **secrecy:** live counts must keep not leaking, so show voters only after the verdict, as NOT GUILTY already does. **Balance:** Saboteurs can "bus" an exposed teammate to collect sleuth credit and look clean. That's arguably good drama, but play-test it. Make the drink-handing optional (the stamp alone is enough) if the user worries about drink inflation.

### 6. The Gallery: a say for the Locker, rehab and the Angel
- **What:** players who can't vote (rehab, the Locker) get a **non-binding** Gallery vote at a Trial. The TV shows it as a separate line, *"THE GALLERY SAYS: DAVE (3)"*, after the real verdict. A rehab player's vote is fun precisely because they're a revealed Saboteur who might be lying.
- **Why:** lessons 4 and 8 (Trivia Murder Party ghosts, the enhanced spectator). Rehab players currently have the shiv but nothing to do at a Trial, the biggest moment of the night.
- **Where:** phone (the vote screen in "gallery" mode) and server (a separate ballot kind, never counted in the verdict).
- **Effort:** M.
- **Risk:** low for secrecy, if the gallery tally only appears after the verdict. For Locker players, keep it opt-in (they asked to rest): a quiet card, never a buzz.

### 7. PUSH THE BUTTON: a Trial called by a player
- **What:** once a night, any carded player can **PUSH THE BUTTON** (hold to arm, then YES on a check screen) to call an emergency Trial right now. Their name goes on the TV, *"PRIYA HIT THE BUTTON"*. If the verdict is NOT GUILTY or there's no verdict, the button-pusher takes a ×2 punishment.
- **Why:** lesson 7. In Push the Button, the accusation is a move a player makes, with a cost. Here only the host can start a Trial.
- **Where:** server (`start_vote` is host-only; this would be a new player action with once-a-night and cost checks), phone (a moves row), TV (an intro sting).
- **Effort:** M.
- **Risk:** **conflicts:** it has to queue behind the "one TV moment at a time" rule and must not fire during a wheel round, a mini-game or another vote. It also changes the post-game rhythm (game → Champ → Slacker → Trial), so too many Trials could drag. The pusher's name is public, which is fine, but Saboteurs can use it to waste Trials. **After the party.**

### 8. THE LINEUP: a Fakin' It-style mini-game
- **What:** the spec for the Roadmap's "Lineup" mini-game. The host starts it; every phone gets a physical prompt (*"Hands up if you've lied tonight"*, *"Hold up how many beers you'd say you've had"*, *"Point at who you trust least"*). **Saboteurs** get a *different* prompt (or none, Faker-style) and must blend in. On 3-2-1 everyone acts in the room. The TV only shows the round type and a countdown, then a 20-second "who looked wrong?" quick vote that's for points or drinks only and never convicts.
- **Why:** lessons 5 and 6. It's a real deduction tool that gets heads up out of phones and suits drunk bodies better than drunk thumbs.
- **Where:** a server prompt table with per-player prompts (sent only in `get_state`'s own secrets), phone (one huge prompt line), TV (category + countdown).
- **Effort:** L.
- **Risk:** **secrecy:** the prompts must never reach the TV, and Saboteurs' phones must look the same as everyone else's (same layout, same text length), the same rule as the card blurbs. The TV shows the shared prompt only *after* the round, if at all. **After the party.**

### Considered and dropped
- **Caption every voice line:** mostly done already (the WANTED poster names, the Walk of Shame caption). The only spoken line without text, "To the TV. Now.", is covered by the poster.
- **A comeback boost when the group is behind pace:** it would favour the Drinkers and change what the game is about (Saboteurs vs the 100). Leave it to the pace nudge (Roadmap #3).
- **Family-friendly filter / moderation:** not needed for 12 friends. The host can already hide evidence photos.
