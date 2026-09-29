# Walk the Plank: findings

References: `refs.md` → `plank/01–13`, `party/01–06`. The "before" screenshots are `current/plank-*.png`.

## 1. What's weak in our mockups right now

**Composition**
- Three near-parallel planks fan out from the left and leave nothing for the eye to land on.
- The moon competes with the title.
- During the walk, the right third of the screen is empty sea.

**Readability at 3m**
- The back polaroid (Maya) is about 60px, and the name labels are around 30px IM Fell. From the sofa you can't tell who's who, and "who's who" is the whole game.

**The Kraken**
- The tentacles are thin, desaturated plum. At a distance they read as weeds.
- The eyes are tiny glows at the bottom edge.
- There's no sense of something big under the water.

**The sea**
- Flat gradient bands plus 1–2px wave lines. Those lines disappear at 3m, so the sea reads as a wall of teal.

**The ship**
- Much better than before, but it's a front-on facade.
- With the mast gone there's no silhouette against the sky, and the top of the stern just stops.

**The reveal**
- The tentacle curls *around* the polaroid like a picture frame, rather than dragging it anywhere.
- The loser's plank doesn't change.
- The "64 · safe" tags are brown on teal and low contrast.
- There's no splash and no beat. Nothing is worth filming.

**Motion**
- Everything loops at once: waves, glints, fog and bob. It's constant noise with no build-up, so nothing gets the audience's attention.

**Performance**
- Grain is a live `feTurbulence` filter on several shapes. That's the most expensive thing a cheap TV browser can be asked to redraw.

**Phone**
- The mini-scene still shows the old flat-board hull.
- The heart icon doesn't line up with its wrapped label.
- The plank strip is small.
- The STOP button is great. Keep it.

## 2. What the best references do (recurring techniques)

1. **Silhouette by value, not detail.** The ship and tentacles are dark shapes against a lighter sky or cloud break (02, 03, 05). Detail is spent only where light hits.
2. **One warm light in a cool scene.** A lantern, fire or window glow in a teal/blue night (05, 06, 08). It pulls the eye and makes the cold feel colder.
3. **The monster is bigger than the frame.** Split waterlines and partial reveals (01, 02) suggest scale because you never see all of it.
4. **Flat, chunky, outlined shapes for comedy.** Thick outlines, flat fills and oversized suckers (04, 06, 12). This sits naturally with a drinking game, not a horror film.
5. **The sea as a pattern.** Repeated hand-drawn wave lines, foam cut-outs on crests, and reflections broken into slivers (08, 09, 10). Everything can be baked into tiles.
6. **Stepped values and few colours.** 4–6 values, plus dither or grain *in the shadows only* (07, 08, party 06).
7. **The audience in the frame.** Foreground silhouettes watching the verdict (11). The TV room sees itself.
8. **The reveal is a staged beat.** Freeze, then one plain verdict line, then the loser gets a cartoon destruction while the others get tagged (07, 11, 12, 13).

## 3. Palette and type

**Palette**

| Role | Hex | Notes |
|------|-----|-------|
| Night sea | `#062a32` | Base, as now |
| Mid sea | `#0f4a55` | Wave bands |
| Moonlight / bone | `#e6f2ee` | Text and highlights |
| Lantern amber | `#ffb866` | The one warm light: windows and lantern |
| Kraken magenta | `#b8406e` | Replaces the muddy `#7a4456`. Complementary to teal, as in ZUGZUG (04) |
| Verdict red | `#d2321c` | "Dragged under" only |

**Type:** keep all current fonts.
- **Pirata One:** the title.
- **IM Fell English SC:** names and tags. Raise the minimum to **44px** on the TV.
- **Big Shoulders:** numbers and captions.
- **Permanent Marker:** on the phone only.

## 4. What reads from 3m (1920×1080 on a ~55" TV)

**Reads**
- Silhouettes.
- Polaroids of **110px or more**.
- Names at **44px or more**.
- Verdict text at **90px or more**.
- One warm light.
- Big tentacles.
- Foam blobs.
- Whole-plank bend.

**Too fine (texture only, never information)**
- 1–2px wave lines.
- Nails, barnacles, stars, grain and rope dashes.
- Suckers on the back tentacles.

**Rule:** depth can shrink the *planks*, but not the *polaroids or names*. Every player must be equally readable.

## 5. The hero moment: the reveal

This is the frame people will film:

1. Everything freezes.
2. The planks settle to their true positions one by one, with a drumroll tick each.
3. On the loser's plank, the camera "cuts" into a **split waterline** (01). The bottom third becomes an underwater cutaway, where a huge magenta tentacle and one enormous eye rise.
4. The loser's polaroid is yanked below the surface line and a flat foam splash bursts up (09).
5. **Crew silhouettes** fill the foreground (11), and "Dragged under" lands.
6. Survivors get big, bone-coloured SAFE tags (party 02).

The filmable frame is step 4: the polaroid half above and half below the waterline, with the eye underneath.

## 6. Ranked upgrades

| # | Change | Inspired by | Effort | Where |
|---|--------|-------------|--------|-------|
| 1 | **The split-waterline reveal**: an underwater cutaway on the loser, a huge eye and tentacle, the polaroid dragged under the surface line, and a flat foam splash | plank 01, 09, 11 | L | TV |
| 2 | **Equal-size players**: every polaroid at 120px or more and every name at 44px or more, whatever the plank depth. Depth shows in plank length and haze, not card size | party 01, 05 | M | TV |
| 3 | **A fatter, magenta Kraken**: thick outlined tentacles with flat sucker shapes and bigger eyes. During the walk they still rise *evenly on all planks* (the shared position only) | plank 02, 04, 06 | M | TV |
| 4 | **Crew silhouettes in the foreground** (flat black heads and shoulders along the bottom edge) for the reveal, and faintly during the walk | plank 11 | S | TV |
| 5 | **A sky with a hole in it**: a cloud break around the moon, with a low-contrast mizzen mast and furled sail back behind the stern, kept below the title | plank 03, 05 | M | TV |
| 6 | **Sea as a baked pattern**: hand-drawn wave-line tiles in three depths, foam cut-outs on crests, all as images moved with `transform` | plank 09, 10 | M | Both |
| 7 | **Moon reflection in slivers**: a column of horizontal glints under the moon, faded in and out with opacity only | plank 08 | S | TV |
| 8 | **An outline pass**: 3–4px dark outlines on planks, tentacles and the ship edge, so shapes survive TV blur | plank 06 | S | Both |
| 9 | **Readable results**: SAFE tags in bone on near-black at 44px or more, and "furthest back" said in the caption, not the colour | party 02, 04 | S | TV |
| 10 | **One motion budget**: during the walk, only the waves drift and the tentacles rise. Glints and fog become baked stills. The reveal gets all the motion. Honours `prefers-reduced-motion` | party 05 | S | Both |
| 11 | **Bake all grain** into one noise PNG (dark areas only). No live `feTurbulence` anywhere | party 06, plank 07 | S | Both |
| 12 | **Phone clean-up**: the new stern quarter in the mini-scene, the heart aligned with a one-line label, and a taller plank strip | (ours) | S | Phone |

**Rules this list keeps**
- **During the walk**: everyone moves on the same curve, and no per-player STOPPED or position appears. That also means removing the live "STOPPED" leak in `MiniGames.tsx`.
- **Kraken**: it rises evenly on every plank and is driven only by the shared position.
- **Secret roles**: none appear.
- **Animation**: transform and opacity only.
