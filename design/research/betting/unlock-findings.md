# THE BOOKIE IS OPEN: the unlock moment

*8 Oct 2026. A research note, with no code changed. It designs the one-off moment that plays after the night's first game
and its whole aftermath, introducing betting on the TV and every phone. The betting rules are in [`BETTING.md`](BETTING.md) and the
README ("Caps and betting"). What's built is in `src/tv/Bookie.tsx`, `src/phone/Bookie.tsx` and `src/styles/bookie.css`.*

> **Source note.** This environment's network policy blocked opening web pages. WebFetch and curl were both refused
> for www.jackboxgames.com, cogconnected.com, en.wikipedia.org and others, so every URL below came back from web search with an
> extract. I cite only claims that the extract tied to that URL. Points marked *(play, uncited)* come from playing the games.
> To allow full page reads, add the hosts under the environment's **Network access** settings.

---

## 0. Recommendation in short

**Build Concept C, "ONE CAP"** (§3), with Concept A's tin OPEN sign as its first beat.
- **Length:** 15 s on the Machine set. There's one big object per beat, and the beats run: a cap lands, the sign drops, a phone shows a bet, the stake stacks, a fedora pot splits into two piles, and the NO DRINKS stamp lands.
- **Shows the hard rule:** it *shows* the proportional split (a bigger stake gets a bigger pile) instead of saying it, and it shows no number that could be anyone's caps.
- **Reuse:** it reuses the kit already built (the gold marquee, the `.bk-closed` stamp, the `ch-ticket` stub, `CapIcon`, Champ's drop-and-swing and the PULEASE sting). That keeps it to about half a day of work with the party on 10 Oct.
- **Phones:** stay on Home with a NOW-strip line during the TV beats, then take over with **3 cards** (HOW DO I BET? → AND IF I WIN? → GOT IT)
  on the TV's "CHECK YOUR PHONE" beat.
- **Sync:** the TV writes one server timestamp (`settings.bookie_announced`) through the host's existing `update_settings`, so no SQL change is needed.

---

## 1. References: what to steal

### 1a. Party and console games
| Source | What it shows | Steal |
|---|---|---|
| [Jackbox blog: survey answers](https://www.jackboxgames.com/blog/responding-to-your-questions-from-the-jackbox-customer-survey) | Since Pack 6 most games let you skip the tutorial. The prompt is "in the bottom corner", and the VIP gets the skip on their controller. Tutorials also live as separate videos. | **The host holds the skip.** A SKIP keycap is visible from frame 0, never animated (Champ's CONTINUE). Rehearse it in the Test Lab, not live. |
| [CogConnected: Trivia Murder Party 3 preview](https://cogconnected.com/preview/trivia-murder-3-preview/) | Calls the unskippable host rules spiel, "again and again", the game's "most egregious misstep". | **Once a night, never repeated.** It's guarded by a flag (§5). |
| [iMore: Super Mario Party guide](https://www.imore.com/super-mario-party-beginners-guide) | The rules screen runs "a mini rendition of the mini-game" that you can try. | **Explain with a miniature** of the thing (a bet screen, stacks, a pot), not a paragraph. |
| [Nintendo World Report hands-on](https://www.nintendoworldreport.com/hands-on-preview/48086) | That preview screen "eliminates the purpose of a practice mode". | **The moment is a demo bet**, not a list of rules. |
| [Hearthstone wiki: new player experience](https://hearthstone.wiki.gg/wiki/New_player_experience) | Modes stay locked "so that they are not overwhelmed", then open as rewards on a track. | **Frame it as a reward** ("NOW TAKING CAPS"), never as homework. This confirms the quiet Act 1. |
| [mobilegamer.biz: Second Dinner on Marvel Snap onboarding](https://mobilegamer.biz/second-dinner-reveals-the-secrets-of-marvel-snaps-onboarding-and-card-design/) | Instead of explaining a mulligan, they made Quicksilver always start in the opening hand. Ongoing cards arrive along the unlock path. | **Teach in context.** The first real bet pop-up is the second half of the tutorial; its sub-lines already teach. |
| [Laughing Squid: Fallout 4 S.P.E.C.I.A.L. #1](https://laughingsquid.com/strength-first-episode-of-1950s-style-animated-educational-video-series-for-fallout-4-s-p-e-c-i-a-l-attributes/), [Motionographer: Rubber House](https://motionographer.com/2015/12/18/making-cute-1950s-style-animations-for-a-cruel-post-apocalyptic-world/) | One attribute per short, in a Vault-Tec "educational video" voice, with a cute, tongue-in-cheek tone over a cruel world. | **One idea per beat**, in a chipper public-information voice inside the noir set: "RELAX.", "PULEASE". |
| [TV Tropes: Rules Spiel](https://tvtropes.org/pmwiki/pmwiki.php/Main/RulesSpiel) | Game-show rules use the same words every time, are "for the audience", and get dropped once the format is known. | **Fixed copy, played once.** The TV strip ("CLOSES AT GO") repeats the rule live after that. |
| [Great Big Game Show: how it works](https://greatbiggameshow.com/dc/how-it-works) | "Each mini-game kicks off with a super-short video explaining the rules", and the host answers questions. | **Split the work:** the TV is short and the phones carry the detail. |
| [Tubefilter: Twitch Predictions launch](https://www.tubefilter.com/2020/11/13/twitch-launches-predictions-feature-channel-points/) | A banner at the top of chat invites bets, PREDICT then asks how many points, and a cancel refunds everyone. | **The same mental model**, minus the live ratio (BETTING.md §4). |
| Balatro *(play, uncited)* | New-unlock cards appear at the end of a run, at a rest point: the card, one line and one button. | **Fire at the rest point**, after the wheel, never mid-Trial. |

### 1b. Period objects for a noir bookie
| Source | What it shows | Steal |
|---|---|---|
| [Wikipedia: American Totalisator](https://en.wikipedia.org/wiki/American_Totalisator) | Illuminated odds boards at Pimlico and Arlington Park (1933), with a later "classic" 6×4-bulb digit. | **The gold LED marquee *is* the period tote.** Use static pages, not scrolling. No split-flap: `craft/nowplaying.md` records that the user dislikes clock-like, departures-board faces. |
| [Inside Sacramento: 1936 raid](https://insidesacramento.com/?p=30427) | A room "filled with chalkboards, teletype machines, telephones, betting slips, loud speakers". | Set dressing for Concept B. |
| [Crime Library: the race wire](https://crimelibrary.org/gangsters_outlaws/mob_bosses/siegel/service_12.html) | The wire existed so bookies weren't beaten by "post-betting" after the result was known. | **"Bets close at GO" is a period-true rule.** A flavour line if wanted: NO PAST-POSTING. |
| [Wikipedia: Tic-tac](https://en.wikipedia.org/wiki/Tic-tac_(horse_racing)) | Signallers wore white gloves "to remain as visible as possible" across the ring. | **White-gloved hand pictograms** as signage that reads from 3 m. |
| *(Extract, not pinned to one page)* Betting-shop histories: [History Today](https://www.historytoday.com/archive/bit-flutter), [casino.org](https://www.casino.org/blog/a-compete-history-of-betting-shops-in-the-uk/) | From 1961 a "board man" chalked prices over rubbed-out races. | **A duster wipe means "reset"** (Concept B's "nobody called it"). |
| [Museums Victoria: Phar Lap ticket](https://collections.museumsvictoria.com.au/items/263694) | Small card, "red and black on a brown background", a tax stamp top left. | **The stub palette and layout** for any betting-ticket graphic. |
| [State Library NSW: Place your bets](https://www2.sl.nsw.gov.au/archive/discover_collections/society_art/races/placebets.html) | A clerk "wearing a bag containing money and issuing betting tickets". | **The bookie's bag** as an alternative pot to the fedora (open question 3). |
| [Wikipedia: Ticker tape](https://en.wikipedia.org/wiki/Ticker_tape) | Printed at about one character a second, and thrown from windows as parade confetti. | **Confetti only.** Tape is far too slow and small to carry text at 3 m. |
| [Collectors Weekly: cigar box labels](https://www.collectorsweekly.com/tobacciana/cigar-box-labels) | Embossed gold, many colours; the label was "often better than the cigar". | **A gilt cartouche** for the title, from baked gradients (no filters). |
| [Nick Garrett, signwriter](https://nickgarrettsignwriter.com/london-sign-writer-gold-leaf-windows-shopsfanlight) | Two-tone gilding on glass: matte gold readable in any light, plus mirror-polished detail. | **Concept A's door lettering** as two baked layers (matte, plus a mirror layer that fades in). |
| [Kaplan collection: pawn tickets](https://www.kaplancollection.org/subject/pawn-tickets) | Small tickets with a stub. | Already in the kit (`.bk-strip`'s notched stub), so nothing new needed. |

### 1c. Phones, drunk readers, legibility
| Source | What it shows | Steal |
|---|---|---|
| [NN/g: mobile tutorials](https://www.nngroup.com/articles/mobile-tutorials/) (findings via [Smashing #327](https://www.smashingmagazine.com/the-smashing-newsletter/smashing-newsletter-issue-327/)) | 70 users, deck-of-cards tutorials: those who read them found tasks *harder*, with no gain in success or time. Advice: keep it brief, unobtrusive and about what's unfamiliar. | **3 cards at most**, only the unfamiliar parts. The bet screen teaches the rest at the moment of use. |
| [Adobe Spectrum: coach mark](https://spectrum.adobe.com/page/coach-mark) | "Temporary messages that educate users through new or unfamiliar product experiences". | **The bet pop-up's own sub-line is the coach mark.** It already exists, so no overlay is needed. |
| [W3C COGA: Making Content Usable](https://www.w3.org/TR/coga-usable/) | Supplemental guidance for cognitive and learning disabilities. | One purpose per screen and familiar words. This matches the phone rules. |
| [Saults et al. 2007 (PMC2658822)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2658822) | Alcohol impaired memory for *sequences* but not for *simultaneous arrays*. | **Each beat and each card is one picture taken in at once.** Never "remember step 1 for step 3". |
| [Giancola et al.: alcohol myopia](https://www.psychologicalscience.org/journals/perspectives/1745691610369467/) | Remaining attention goes "to only the most salient cues". | **One central object per beat**, with the copy dead centre and nothing important in the corners. |
| [BBC subtitle rate (Clevercast summary)](https://clevercast.com/bbc-subtitling-guidelines) | 160–180 wpm, that is 0.33–0.375 s a word. | The reading budget (§2). |
| [Signs NY: distance visibility](https://signsny.com/resources/distance-visibility/) | 1 inch of letter height per 10 ft is *readable*; "maximum impact" needs much bigger letters. | Type sizes (§2). |

---

## 2. Rules for this moment (derived from the above and CLAUDE.md)

- **Reading budget.**
  - Use at least 0.6 s a word for tipsy readers (about 1.7× the BBC rate), plus about 0.6 s to find the line. So "max 8 words" is the ceiling: the **primary line is 4–6 words** and a pictogram does the rest. That gives **4 text beats plus a title in about 15 s**, not 6.
  - Secondary lines (≤3 words) are bonus: the phones repeat them.
- **Type at 3 m on a 60" TV.**
  - The screen is about 75 cm tall, so 1080 lines is about 0.69 mm a pixel. The 1"/10 ft rule makes readable cap height about 37 px, which is about 52 px of Big Shoulders. The "impact" column is about 3× that.
  - In 1920×1080 board units: **title ≥ 180 px, primary line ≥ 110 px, secondary line and labels ≥ 64 px.** Champ's 60 px subline is the floor, not the target.
  - Bone `#f1e8d4` on ink, with the caps gold `#f6e3a6`/`#c99a45` as the Bookie's accent (already the colour of `pu-caps` and `.bk-ban`).
- **Copy rules.**
  - **THE BOOKIE is the house, never a person.** The roadmap has a future Bookie *role*, so no "someone in this room" framing and no player silhouette.
  - **Never mention earning caps by logging beers** (never reward drinking faster).
  - **No real guest names or faces in the demo bet.** It would read as a live bet. Use blank silhouette mugshots.
  - **No pot total and no number that could be anyone's caps.** 5 / 10 / 20 / ALL IN are rules and fine. Show proportion by size.
  - Catchphrases are fair game ("RELAX.", "PULEASE"). Invented personal gags are not.
- **Motion.**
  - Only transform and opacity. These are fine: the rotateY sign flip, scaleX "coin spin", translate slides and rotate wobbles.
  - Not allowed: clip-path or mask reveals and stroke-dashoffset "writing".
  - **Reduced motion follows the repo:** each beat is its settled still, swapped by an opacity fade (about 200 ms) on the **same clock**, so the phones stay in sync. There's no rain slide, buzz shake or confetti.
- **Not a third banner.** LEVEL 2 UNLOCKED (a 2.8 s banner) already fires at game end. This is the aftermath's second unlock, so it's a **scene**, and its copy never says "LEVEL".
- **Ordering.**
  - The server opens betting at `games_done ≥ 1`, which happens at game end. Dodge (LV2) opens then too, so **a bet can happen during the Trial or the wheel, before this moment.**
  - So the first bet pop-up must stand alone. It does: "Bet 5 caps or more. Winners share the pot." / "Tap who you think. Bets close at GO."
  - The moment's copy also stays true if a bet has already happened ("NOW TAKING CAPS", never "BETTING STARTS NOW").
- **Who wins the screen.** A summons outranks the moment. If a mini-game is called mid-scene, the TV cuts to the WANTED poster, and the phones' summons takeover outranks the cards anyway.

---

## 3. Three TV concepts (one shared beat skeleton)

All three use the same clock and copy, so the phone handoff is identical whichever ships. T0 is the server timestamp (§5).

| Beat | Time (s) | Primary line (≥110 px) | Secondary (≥64 px) | Words |
|---|---|---|---|---|
| **B0 OPEN** | 0.0–2.2 | **THE BOOKIE IS OPEN** (title, ≥180 px) | NOW TAKING CAPS | 7 |
| **B1 WHEN** | 2.2–5.6 | **WATCHING A MINI-GAME? BET ON IT.** | (three pictograms: the throw, the plank, the box) | 6 |
| **B2 HOW** | 5.6–8.6 | **PICK IT. STAKE IT.** | 5 · 10 · 20 · ALL IN, with marker "PULEASE" by ALL IN | 8 (+1 gag) |
| **B3 PAY** | 8.6–12.0 | **CALL IT? SPLIT THE POT.** | NOBODY? CAPS BACK. | 8 |
| **B4 SAFE** | 12.0–14.6 | **NO DRINKS AT STAKE. RELAX.** | CHECK YOUR PHONE (lands at 12.6) | 8 |
| out | 14.6–15.0 | fade back to the board | | |

**Sound** (obeys the TV's sound switch): `Sound.coinDrop` as the cap lands, the **PULEASE sting** (already on the soundboard) as ALL IN wobbles, and a thud on the stamp.
The host's **SKIP** keycap is visible and live from frame 0. It skips the TV only; the phones still get their cards.

### Concept A: "THE TURF ACCOUNTANT'S DOOR" (the mood piece)
The set: a wet alley wall under the sodium lamp, with rain (`rain.png`). A frosted-glass office door carries reverse-gilt **THE BOOKIE**, with a brass betting
hatch below the glass and a tin sign on a string reading CLOSED.

| Beat | Picture and motion (transform/opacity) | Reduced motion |
|---|---|---|
| B0 | The lamp stutters on (opacity steps 0/.7/.2/1, NOW PLAYING's tube flicker). The light behind the glass comes on, and the gilt swaps from its matte layer to its lit layer (opacity). The tin sign flips **CLOSED→OPEN** (rotateY 180°, two faces, hidden backface) and swings to rest (rotate ±6°→0). The door now reads THE BOOKIE / IS OPEN. | Lit door, sign already OPEN |
| B1 | The hatch slides up (translateY), and a mini WANTED poster with a blank silhouette slaps into it (scale 1.2→1, rotate 3°). The pictograms pop. | Hatch open, poster pinned |
| B2 | A betting ticket (Phar Lap palette: red and black on brown) is pushed out under the hatch (translateX). It has four ruled boxes; "PULEASE" pops by ALL IN (scale). | Ticket in place |
| B3 | Caps slide across the counter into an upturned fedora (translate and rotate, 10 baked sprites, a 60 ms stagger). The hat tips (rotate −20°) into two piles under two stubs: one stub holds 2 cap icons and its pile is twice the other's. On "NOBODY?" the caps slide back. | The two piles, settled |
| B4 | A red double-border stamp hits the glass (`.bk-closed`: scale 2.2→1). The inside light drops to half. A phone pictogram buzzes (translateX ±6 px ×3). | Stamp on, phone still |

**Cost: L** (about 1.5–2 days): a new set (door, glass, hatch, sign, hat) and new baked textures. **Risk:** the copy lives on a door panel, so it's smaller and fights the set.

### Concept B: "THE BOARD MAN" (the wire-room odds board)
The set: a wire-room wall, with a slate blackboard ruled like a race card (RUNNER | PRICE) and the **gold LED marquee bolted above as the tote**. Beside them sit a candlestick
phone and a ticker spilling tape.

| Beat | Picture and motion | Reduced motion |
|---|---|---|
| B0 | The marquee does the kit's two-flash power-on and shows a **static page**, THE BOOKIE IS OPEN. The board lamp swings on (rotate). | Lit marquee, lit board |
| B1 | Row 1 is "chalked": a slate-coloured cover with a chalk stick at its edge **slides off** the baked chalk line (translateX). That's a cover moving, not a mask, so it's allowed. | The row appears (opacity) |
| B2 | The price column uncovers the same way: 5 · 10 · 20 · ALL IN, with "PULEASE" chalked and underlined (opacity steps). | Column appears |
| B3 | "CALL IT? SPLIT THE POT." uncovers. Then a duster wipes across (translateX) and the row crossfades to "NOBODY? CAPS BACK.": the 1961 board man's rub-out as "reset". | The second row only |
| B4 | A stamp lands on the board, "RELAX." is chalked, and the marquee page flips (opacity, steps) to CHECK YOUR PHONE. Ticker tape bursts as confetti (translate and rotate, baked strips). | Stamp on, no confetti |

**Cost: M** (about 1 day). It reuses the marquee but needs a slate texture and baked chalk rows (no new font).
**Risk:** chalk on slate has lower contrast (about 7:1 against bone on ink's 16:1). A full board is text-heavy for drunk readers. It also never *shows* the proportional split.

### Concept C: "ONE CAP" (recommended)
The set: the **Machine set** that Champ, Penny and Jack share: concrete, one hanging lamp, Champ's gold marquee on the rig and a riveted gunmetal table edge.
Behind it is a back window with sodium light and rain sliding (transform).

| Beat | Picture and motion | Reduced motion |
|---|---|---|
| B0 | Dark. **One giant cap** (the `CapIcon` art, baked at 512 px) is flicked in from the left: translateX and rotate, with a coin spin faked by scaleX 1→0.1→1 cycles. It clatters (3 translateY bounces) and settles as the lamp clunks on (opacity steps). The gold marquee flicks on with THE BOOKIE IS OPEN. A **tin OPEN sign** drops in on chains and swings to rest (Champ's drop-and-swing keyframes, reused). | Cap on the table, sign hung, marquee lit |
| B1 | A bone phone outline rises from the bottom (translateY 600→0, ease-out). It shows a mini bet screen: WHO WALKS THE PLANK? with **three blank silhouette mugshots**. The three game pictograms pop above it (scale .6→1, an 80 ms stagger). | Phone up, pictograms shown |
| B2 | The phone drops away, and four **cap stacks** slide in (translateX, a 90 ms stagger): 5 is one cap, 10 is two, 20 is four, and ALL IN is a teetering tower that wobbles (rotate ±3°). Labels go underneath. "PULEASE" appears in marker by the tower, with the sting. | Stacks standing |
| B3 | The stacks slide into an **upturned fedora** in the centre (translate and rotate per layer), and the hat thumps (scaleY .92→1). Two blank `ch-ticket` stubs pop up (scale): one holds **2 cap icons**, the other **1**. The hat pours two piles, **one twice the other**. There are no digits and no total. On "NOBODY?" every cap slides back to its stack. | Two piles under two stubs |
| B4 | The red double-border **NO DRINKS AT STAKE** stamp slams centre (`.bk-closed`: scale 2.2→1), with marker "RELAX." under it. The phone outline pops back up and buzzes (translateX ±6 px ×3) with CHECK YOUR PHONE on its screen. | Stamp on, phone up, still |

**Cost: S–M** (about half a day plus the Test Lab entry).
- **Reused:** `mk-marquee--gold`, `.bk-closed`, the `ch-ticket` stub mask, `CapIcon`, Champ's chain drop, `Sound.coinDrop` and the PULEASE sting.
- **New art:** the fedora, the phone outline and a cap-stack sprite.

---

## 4. The phone explainer (3 cards)

The cards use the standard top bar plus the `Row`: title **THE BOOKIE**, with the sub-line **1 of 3** / **2 of 3** / **3 of 3** at 16 px.
- **Layout:** static art (96–120 px), H1 at 36 px, body at 20 px, and **one 88 px key** at the bottom.
- **Moving between cards:**
  - The key is the only way forward: no swipe paging (no drags) and no auto-advance.
  - Cards 2 and 3 have the kit's 64 px back key.
  - Each key ignores a second tap within 600 ms.
- **The demo stake chips are flat:** outlined tokens with no bevel or shadow, so drunk thumbs don't mistake them for `Key`s.

| Card | Art | H1 (36 px) | Body (20 px) and facts | Key |
|---|---|---|---|---|
| **1** | `CapIcon` 120 px hanging under the tin OPEN sign | **THE BOOKIE IS OPEN** | When someone's called to the TV for a mini-game, everyone else can bet caps on how it goes. | **HOW DO I BET?** |
| **2** | Four flat tokens: 5 · 10 · 20 · ALL IN | **PICK IT. STAKE IT.** | A bet pops up on your phone. Pick who or what, then 5, 10, 20 or ALL IN (whatever you can afford). Bets close at GO.<br>Fact: *Not feeling it? Tap NOT BETTING.* | **AND IF I WIN?** |
| **3** | Two cap piles, big and small, under two stubs (2 caps / 1 cap) | **CALL IT, SPLIT THE POT** | Everyone who called it shares the whole pot. Bigger bet, bigger share.<br>Facts: *Nobody called it? Everyone gets their caps back.* · *No drinks at stake. Relax.* · *Your caps stay on your phone. Never on the TV.* | **GOT IT** |

Nothing on a card names a role, a player or anyone's caps, and the cards are the same on every phone. The cards never mention earning caps.

---

## 5. Recommendation and handoff

**Why C:**
- **It shows the hard rule.** "Proportional to your stake" is the one rule that can't be said in 8 words, and C *shows* it: stack heights, then pile sizes.
- **One central object per beat** (cap, phone, stacks, hat, stamp). That suits alcohol myopia, and every beat is a single array, never a sequence to remember.
- **The TV and the phones match.** They share the same `CapIcon`, the same stake chips and the same stub art, so CHECK YOUR PHONE lands on something already familiar.
- **The cheapest of the three to build**, two days out, because it's built from kit already in the repo. A is the best mood but costs about 3× as much. B is text-heavy and never shows the split.

**Steal from A:** the tin **CLOSED→OPEN sign** as B0's hook, the fastest "unlocked" read there is. Steal from B: nothing for now. Its duster "reset" is a good idea to keep for later.

### Trigger and timing sync

| Server time | TV | Phones |
|---|---|---|
| Before T0 | The stage is clear (`stageClear` in TvRoom), `games_done ≥ 1`, and there's no local played flag. The queue is empty, or 45 s have passed quietly (as in the in-progress build). The TV then calls `update_settings` with `{ settings: { bookie_announced: iso(room.now() + 2000) } }`. This is host-only and not undo-snapshotted, so it adds no UNDO entry. | — |
| **T0** | Starts B0, scheduled from `room.now() ≥ T0`, never from when the reply arrived. | NOW strip: **THE BOOKIE IS OPEN · WATCH THE TV**, plus one 40 ms buzz (Android). No takeover. |
| T0+12.0 | B4: NO DRINKS AT STAKE. RELAX. | — |
| **T0+12.6** | CHECK YOUR PHONE lands. | **Card 1 takes over**, with a buzz. |
| T0+15.0 | Fades back to the board. | The cards stay until GOT IT. |

- **One shared clock.**
  - Both sides key every beat off T0 with the server-offset clock (`useRoom`'s `now()`).
  - A phone whose state arrives late jumps straight to the right card. If it's past T0+12.6, it goes to card 1.
  - The 2 s lead covers the realtime touch plus the 3 s poll for most phones.
- **Priority.**
  - The cards are the **lowest** takeover in PhoneHome. Spin, vote, summons, Aaron's Plate and **any bet pop-up** come first; the cards come back afterwards.
  - A bet pop-up marks the cards as seen, because the bet screen teaches the same thing in context.
- **Replay guards.**
  - Each side keeps a per-room local flag: TV `bookie-intro:<room>`, and per player on the phones.
  - The TV writes the setting only if it's absent.
  - Both guards are needed because a host UNDO may `_restore` the rooms row and drop the setting.
- **Late phones** (joined, woken or reloaded after T0+12.6) get card 1 once on Home.
- **The skip and the Test Lab.**
  - The host's SKIP cuts the TV scene only.
  - Add **"THE BOOKIE IS OPEN"** to Test Lab → TV moments, with a reduced-motion check.
  - It touches the TV, so **run rules-auditor before committing.**
- **No SQL needed.** An optional stricter version would gate `bet` on `bookie_announced` instead of `games_done`. That needs a migration and the user's go-ahead. I'd say not this close to the party.

**The in-progress build differs from this design in three places** (the uncommitted `TvRoom.tsx` and `PhoneHome.tsx` as of writing):
1. **The stamp uses the wrong clock.** It writes `new Date().toISOString()`, the TV laptop's own clock. Use `room.now()` plus a lead, so T0 is server time and is still in the future when the phones get it.
2. **The phones take over too early.** They show the explainer as soon as the setting arrives, which is while the TV scene starts, so the two compete for eyes. Hold the takeover until T0+12.6 s, and use only the NOW strip before that.
3. **A bet pop-up should win.** The explainer notice isn't yet pre-empted by a spectator's bet pop-up. A bet should win and mark the explainer as seen.

`BookieOpenScene` and `BookieExplainer` are imported but not yet in `Bookie.tsx`. They should follow §3 (Concept C) and §4 (the three cards). The explainer doesn't need the `caps` prop it's passed: the cards show nobody's caps.

---

## 6. Open questions for the host
1. **The caps shop:** the bribe, graffiti and golden ticket also open after game 1. Should card 3 add a fact, "THE CAPS SHOP IS OPEN TOO"? It's one more line, but it's the same unlock.
2. **3 cards or 1?** A single card (card 1's art and H1, with card 3's facts and GOT IT) is lighter; three cards explain more.
3. **The pot:** a fedora (noir, reads instantly) or the bookie's leather money bag (period-correct, per the NSW clerk)?
4. **Should the host be able to replay it** (e.g. ⚙ → REPLAY THE BOOKIE) for late arrivals, or is the late-phone card enough?
