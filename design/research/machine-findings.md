# The Bomb, Penny Drop, Jack-in-the-Box: findings (Machine Party round)

References: `refs.md` → `machine/01–16`, plus `party/01–06`. The "before" screenshots are `current/bomb-*`, `penny-*`, `jack-*`, `phones-bomb-penny-jack.jpg`, and `lobby-tv.jpg` for the house style.

## 1. What's weak now

**All three**
- These are the only unstyled screens left. Each is a title, a flat radial glow (brown, mustard or purple), a row of round avatars and one caption line.
- Next to the lobby they don't look like the same game. The lobby has neon stencil, pinned bone polaroids, crosshatched concrete and orange buttons.
- There is no set, no light source, no texture and no hero moment.
- Emoji (💣 🤡 👑) carry the key objects. At 3m they read as clip-art, and they draw differently on every TV.

**The Bomb**
- **TV:** a purple emoji bomb sits on a strip of 10 avatars. Nothing builds tension, although that is the whole game.
- **BOOM:** the title changes, and the loser's avatar gets a grey ring.
- **Phone (holder):** letter tiles ("P", "E") instead of faces.
- **Phone (everyone else):** just "Tom has it".

**Penny Drop**
- **Live:** a thin CSS coin spins edge-on.
- **Result:** an emoji crown on a gold disc.
- **Phone:** HEADS / TAILS as two generic orange buttons. The drama of calling and waiting is gone.

**Jack-in-the-Box**
- **The box:** a striped crate with the running crank count in the middle.
- **The pop:** the emoji clown pops out, and the lid bar flies diagonally across the title (a bug).
- **Turns:** they read only from a ring on the avatar.
- **Phone:** three orange number buttons.

## 2. What Machine Party (and friends) do

1. **The machine is the interface.** Instructions sit on a red LED dot-matrix marquee, the clocks are seven-segment digits in recessed bezels, and choices are chunky bone keycaps or levers (01, 10, 14).
2. **One command word, huge, under one hard light.** HIDE, AFRAID?, CARVE. SUBMIT. The scene's voice is one or two imperative words (02, 13).
3. **One station per player.** Each lane or seat has its own sign, button and LED status, so who's in, who's hot and who's out reads at a glance (06, 07, 12).
4. **Danger is drawn, not written.** Red rings, hazard stripes and red LED bars (07, 08).
5. **A second accent: acid phosphor green.** It's used on CRTs, spray symbols and the "OK" state, against the red of "danger" (03, 05, 12).
6. **PS1-era grit.** Posterised, dithered textures, a few colours, and grime and cables everywhere. Cheap to fake with one baked ordered-dither tile (all).
7. **Deadpan comedy props.** A traffic cone hat, a cigarette, a shared table with a deadly object being passed round (04, 09).
8. **Eyes in the dark.** Something watching out of an opening: tension without gore (15).

## 3. Staying consistent with the lobby

The lobby's kit stays the base: black and concrete, **sodium orange** (`#ff8a1e`) neon stencil, **bone** (`#f1e8d4`), Big Shoulders (Stencil) Display, Courier Prime labels, pinned polaroids and orange keycap buttons. Machine Party adds a small **"machine kit"**, built once and shared by all three games:

| Piece | Look | Used for |
|-------|------|----------|
| **LED marquee** | red dot-matrix (`#ff2b1a` dots on `#1a0303`), scrolling | the command word: PASS IT. / CALL IT. / CRANK IT. |
| **Seven-segment readout** | recessed bezel, red digits with unlit "8" ghosts | counts (passes, cranks, seconds) |
| **Keycap** | bone, stencil label, 6px black bottom edge (the lobby's button language) | phone controls, TV legends |
| **Station** | polaroid on a steel plate with its own LED lamp (off / amber / red / green) | one per player |
| **Phosphor CRT** | green `#8dff9a` on `#031006`, burnt vignette edges | secondary displays, the coin's result |
| **Grit** | a baked 64×64 Bayer-dither tile plus a hazard-stripe tile | over everything, at low opacity |

**Palette:** keep the lobby's. Add **LED red** `#ff2b1a`, **phosphor green** `#8dff9a` and **hazard yellow** `#e8c53a` (already Jack's).

**Type:** no new fonts. The dot-matrix and seven-segment digits are drawn as SVG dots and segments, not a font, so they stay crisp and load nothing.

## 4. Hard rules for these three

- **The Bomb:** the fuse is secret. The TV and phones must never show a countdown, a burning fuse, a speeding tick or anything else that tracks the real remaining time.
  - The readout shows scrambled `-- : --` segments.
  - Any rising tension must be driven by **passes** (public) or be random and constant.
- **Penny Drop:**
  - The coin is secret until it lands.
  - Nobody's call appears on the TV before the result: only the count called.
  - After the result, showing each player's call is fine.
- **Jack-in-the-Box:** the pop number (8–20) is secret.
  - Anything that builds may follow the **count** (public) only.
  - Nothing may hint at how close the count is to the pop.
- **All:** transform and opacity only, baked textures, reduced-motion stills, no emoji for the key objects.

## 5. Hero moments (what gets filmed)

**The Bomb: BOOM**
1. The marquee freezes on PASS IT.
2. Every station lamp flicks red.
3. A white flash, then the console blows out in a flat cartoon burst.
4. The holder's station is scorched and gets a traffic cone "hat" stamp (04).
5. The marquee reads **BOOM.**

**Penny Drop: the drop**
1. A coin press on a workbench under one lamp spits the coin into a tray. It wobbles and settles.
2. The CRT above reads **HEADS** or **TAILS** in phosphor green.
3. Every station lights: green for called it, red for drinks.

**Jack-in-the-Box: the pop**
1. A crank box sits on the table under a hanging lamp, with two green eyes watching through the slot (15).
2. On the pop, the lid blasts off, the spring and Jack shoot up (drawn, not emoji), and the lamp swings.
3. The popper's station goes red, and the marquee reads **POP.**

## 5b. Penny Drop wears the Scrooge's colours (added on request)
Penny Drop is the Scrooge's ability, so it matches his existing TV scenes (Swapsies, Re-spin, Graffiti; the lab screenshots are `current/scrooge-*`). The machine kit stays, restyled into his house style.

**The Scrooge's kit**
- **Colours:** gold `#ffd84a` / `#e0b458` stencil titles, on warm black.
- **Kicker:** IM Fell English SC ("The Scrooge says…").
- **Voice:** a snide IM Fell *italic* quote with gold keywords ("Didn't fancy that one. *Spin it again.*").
- **Coins:** gold, with his mark. Heads is **his purple top hat with the pink band**.
- **Scrawls:** green and red Permanent Marker ("OFF THE HOOK!", "TEE-HEE!").
- **Plaque:** riveted steel with gold marker.
- **Taunts:** "RE-SPIN, PEASANTS", "AGAIN! AGAIN!".

**What changes for Penny**
- **Marquee:** gold dots instead of red, and it speaks in his voice ("CALL IT, PEASANTS.").
- **P1 coin press:** now **the Scrooge's brass counting-house coin press** (brass, rivets, a ledger).
- **P2 verdict:** a gold stencil **HEADS** / **TAILS** on his riveted plaque, with a Scrooge quote under it ("Bah! Four of you owe me."). This replaces the green CRT, so there's no phosphor green in Penny.
- **Coin faces:** heads is the top hat; tails is his pound mark in a laurel.
- **P3 stations:** light **green "CALLED IT"** / **red "DRINKS"** in his marker scrawl.

## 6. Ranked upgrades

**Shared (do first: all three use it)**

| # | Change | From | Effort | Where |
|---|--------|------|--------|-------|
| S1 | **The machine kit**: LED marquee, seven-segment readout, keycap, station with LED lamp, phosphor CRT and grit tiles, as shared components and baked textures | 01, 05, 06, 12, 14 | M | Both |
| S2 | **One set per game**: a table top under one hanging lamp (same camera and light for all three), with concrete, cables and hazard tape, matching the lobby's concrete | 02, 11 | M | TV |
| S3 | **Stations replace the avatar rows**: equal polaroids on steel plates, each with its LED lamp (who's up, who's hot, who's out) | 06, 12, party/01 | M | TV |
| S4 | **No emoji for key objects**: bomb, coin, clown and crank drawn in SVG | 14, 15 | M | Both |

**The Bomb**

| # | Change | From | Effort | Where |
|---|--------|------|--------|-------|
| B1 | **The bomb as a console** on the table: dynamite bundle, wires and a readout scrambling `-- : --` (never a real time) | 14, 01 | M | TV |
| B2 | **Passing is physical**: the bomb slides station to station along the table (a transform), and the station lamps go amber for the holder | 09, 06 | M | TV |
| B3 | **Tension from passes only**: the marquee speeds up and the lamp flickers more with each pass, capped. Never tied to the fuse | 01, 07 | S | TV |
| B4 | **The BOOM beat**: red lamps, flash, flat burst, scorched station with the cone "hat" stamp, and "BOOM." on the marquee | 04, 08 | M | TV |
| B5 | **Holder's phone**: a red-alarm screen with the bomb console and big face keycaps to pass to (real selfies, not letters). "NOT BACK TO SAM" as a crossed-out key | 01, 10 | M | Phone |
| B6 | **Everyone else's phone**: the holder's polaroid under a red lamp and "PRAY IT ISN'T YOU", with a dither and hazard frame | 13 | S | Phone |

**Penny Drop**

| # | Change | From | Effort | Where |
|---|--------|------|--------|-------|
| P1 | **A coin press on the workbench**: the coin spins in a clamp while calls come in, then drops into a tray and settles (transform only) | 01, 11 | M | TV |
| P2 | **Phosphor CRT verdict**: HEADS / TAILS in green dot-matrix with burnt edges | 05 | S | TV |
| P3 | **Stations light up at the result**: green for called it, red for drinks, and each player's call printed on their plate (only after the result) | 12, 06 | S | TV |
| P4 | **The call on the phone is two levers** (green HEADS, red TAILS), pulled down to commit, with a satisfying clunk and buzz | 10 | M | Phone |
| P5 | **A seven-segment countdown** and a "CALLED 4/10" counter on the console | 14 | S | Both |

**Jack-in-the-Box**

| # | Change | From | Effort | Where |
|---|--------|------|--------|-------|
| J1 | **The box redrawn**: a battered crank box with hazard stripes, a brass crank that turns once per crank (transform), and a **seven-segment count** on its side | 01, 07 | M | TV |
| J2 | **Eyes in the slot**: two green eyes peek through the lid gap, opening wider as the **count** rises (never tied to the pop) | 15 | S | TV |
| J3 | **Turn order as a path**: stations along a dotted path, with the current player's lamp amber and a marquee "CRANK IT, JOSH." | 16, 06 | S | TV |
| J4 | **The POP**: the lid blasts off (fixing today's lid-over-the-title bug), a drawn spring-and-Jack shoots up, the lamp swings, the popper goes red, and "POP." | 15, 08 | M | TV |
| J5 | **Phone**: a real crank handle you drag round (1, 2 or 3 turns, with a detent buzz per turn) plus the 1/2/3 keycaps as a fallback | 10 | M | Phone |
| J6 | **Waiting phones**: "JOSH IS CRANKING", with the box's eyes watching you | 15 | S | Phone |

## 7. Scrooge upgrades (Swapsies, Re-spin, Graffiti)

The three ScroogeOverlay scenes move into **his counting house**, the same set and colours as Penny Drop (5b). The set has a panelled wall with dim ledger shelves, a green-shaded hanging lamp, and a leather-topped mahogany counter with a brass rail. Penny's ledger, coin stacks and hat coin are on the counter. His **top hat is drawn in SVG everywhere** (no 🎩).

Boards: `mockups/ScroogeSwap.dc.html`, `ScroogeRespin.dc.html` and `ScroogeGraffiti.dc.html`. The shared parts are in `scrooge-kit.js` / `.css`. Captures are in `after/scrooge-*` (a GIF, a hero frame, an end frame and a reduced-motion still per scene).

| Scene | Hero moment | Beats (ms) |
|-------|-------------|------------|
| **Swapsies** (4300) | His two white-gloved hands (purple sleeves, pink cuffs) come down, pinch the two polaroids and cross them over, FROM high and TO low, then set them down with a thunk. The hat drops onto the new victim. Red YOU'RE UP! and green OFF THE HOOK! sit **beside** the cards, never over the faces. | sting 0–420 · title 550 · hands 700–1180 · cross 1200–2060 · hat 2150–2640 · scrawls 2500/2620 · quote 2800 |
| **Re-spin** (3900) | "The Scrooge says…". His coin (heads = the hat) falls in from above the frame, flipping, and **slams onto the hub of a drawn wheel lying on the counter**. The hit (squash, gold flash, shock ring, dust, jolt) knocks the **wheel into one full spin**. Then AGAIN! ×3 and **SPIN AGAIN, PEASANTS**, so it can't be misread as Penny Drop's HEADS. | kicker 450 · coin 450–1180 · hit 1180 · wheel spin 1180–2680 · AGAIN! 1350/1500/1650 · title 1900 · quote 2300 |
| **Graffiti** (4500) | His gloved hand and gold marker **write the text stroke by stroke** on the riveted plaque, lit by a brass picture light. It ends with an underline flourish, then drips and TEE-HEE! | hand in 700 · writing 950–≤2600 **whatever the length** (ink and lifts share one budget) · drips, TEE-HEE!, quote settle by ~3300 and hold ≥1.2s. The board exposes `data-write-end` / `data-settled` for the port. |

**How**
- **Handwriting:** a single-stroke capital alphabet (`ScroogeKit.GL`: A–Z, 0–9, `! ? . , ' - & + # £`). Each stroke is a `pathLength=1` path animated by `stroke-dashoffset`.
- **Following hand:** it moves by `transform` keyframes, sampled 9× along each stroke.
- **Layout:** the text lays itself out in 1–3 lines at the biggest size that fits (a cap height of 44–112px).
- **Everything else:** `transform` and `opacity` only. No filters or blend modes, and textures are baked.
- **Play and hold:** each scene plays once and holds. The DOM's own styles are the settled end frame, so `motion=false` / reduced motion shows the same frame, still.
- **Scrubbing:** `?t=ms` freezes any board at that moment.
- **Red:** it appears once per scene, as a single scrawl stamp. There is no red flashing.
- **Secret info:** the scenes show only what ScroogeOverlay already shows (two names and photos, or the graffiti text). There is no host button.

**To port**
- The hat, the glove and the counting-house set become shared TV components.
- The alphabet ships as data.
- Graffiti needs `getTotalLength` / `getPointAtLength` at mount to time the pen.
- Text is normalised before writing: accents are stripped (NFD minus combining marks), curly quotes and dashes are straightened, and `: / ( ) % "` have glyphs.
- Anything still unwritable (emoji, other scripts) falls back to the **raw text in Permanent Marker with a clip-path wipe**, with the hand sweeping along. Characters are never dropped.
- Drips hang from real letter feet, in each glyph's own units.
- Swapsies names wrap onto two lines on the polaroid when long.
- The title and kicker sit above his arms.
- Lamp cords stop under the titles.
