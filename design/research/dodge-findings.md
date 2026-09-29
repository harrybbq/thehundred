# Dodge: findings

References: `refs.md` → `dodge/01–10`, `party/01–06`. The "before" screenshots are `current/dodge-*.png`.

## 1. What's weak in our mockups right now

**Composition**
- The whole alley is one flat plane: a tiled brick wall with things pinned to it. There's no foreground, no depth and no end to the alley.
- The lamp cone is the best thing on the screen, but it lights nothing in particular.

**Texture**
- The bricks repeat evenly, so they read as wallpaper.
- The puddles are *outlined* ellipses that look drawn on, rather than wet.
- The rain is thin and low-contrast. At 3m it's invisible.

**Readability at 3m**
- The LEFT, HIGH and RIGHT graffiti and the countdown read well.
- The Courier intro copy (about 22px) doesn't.
- "nobody saw nothing" is illegible.
- On the hit frame, the TO THE WHEEL stamp sits on top of RIGHT.

**The hit**
- It's a red tint over the same scene. The shuriken is about 90px and the afterimages are faint.
- There's no impact frame and no moment worth filming.

**The dodge**
- There's no distinct payoff yet: the "dodged" board is the same scene with a different caption.

**Performance**
- Brick grain and chalk use live SVG filters. They need baking.

**Phone**
- The swipe screen is solid.
- On the HIT screen, the stencil letterforms read as broken glyphs ("H I T" with odd gaps), and the shuriken is small.
- The cracks are good. Keep them.

## 2. What the best references do (recurring techniques)

1. **Depth through dark foreground framing.** Bars, fences or a fire escape in near-black at the edges (04, 01). Two shapes and the flat wall becomes a place.
2. **One saturated light at the far end.** A red or neon source at the vanishing point, which the eye travels to (02, 06).
3. **Wet ground as a mirror.** Flipped, darkened, slightly smeared copies of the lights, not outlines (02, 06).
4. **Rain as one consistent layer.** A single angle, brighter only where it crosses a light (03, 05).
5. **Fog separates depth.** Back layers lose saturation and contrast, and one warm object sits up front (05).
6. **Two-colour rim lighting.** A warm key and a cold fill, so the subject pops off a dark ground (07, 01).
7. **The hit is a cut-in, not a tint.** The frame freezes and flat speed ribbons or shards explode from the impact (08, 09).
8. **Metal made of facets.** Split light and dark planes per blade read as steel at any size, with no gradient (10).

## 3. Palette and type

**Palette**

| Role | Hex | Notes |
|------|-----|-------|
| Wet black | `#07090b` | Base |
| Brick | `#4a2418` | Desaturated, darker away from the lamp |
| Sodium lamp | `#ff8a1e` | Key light |
| Cold rim | `#6fc7e8` | New. Fill and rim on the polaroid, rain in shadow |
| Bone | `#f1e8d4` | Text, graffiti and highlights |
| Hit red | `#c2371f` | The cut-in only |
| Far neon | `#e0304a` | New. The one light at the end of the alley |

**Type:** keep all current fonts.
- **Big Shoulders Stencil:** the title and countdown.
- **Permanent Marker:** graffiti.
- **Courier Prime:** phone body text only. On the TV, the intro copy either goes to 32px or more in bold, or is cut in favour of the caption.
- **Phone HIT:** switch to Big Shoulders Display 900, with a crack line through it instead of stencil gaps.

## 4. What reads from 3m

**Reads**
- The graffiti words.
- The countdown.
- A polaroid of 250px or more.
- The lamp cone.
- A shuriken of **220px or more** at the hit.
- Big speed ribbons.
- A mirrored reflection.

**Too fine (texture only)**
- Mortar lines.
- Grain.
- Single raindrops outside the light.
- Chalk jitter.
- "nobody saw nothing".
- Thin afterimage outlines.

## 5. The hero moment: the hit (and its twin, the dodge)

**Hit**
1. The scene freezes and drains to black and white for a few frames (03).
2. **Red speed ribbons** tear across from the throw side (08).
3. A **huge faceted shuriken** (10) thunks into the polaroid, which cracks and swings on one piece of tape.
4. Shards burst outward (09), and the **TO THE WHEEL** stamp slams on *clear* space.

The filmable frame is step 3: the shuriken embedded, the ribbons behind, the crack lines.

**Dodge**
1. The polaroid snaps sideways, with a streaked afterimage in the cold rim colour.
2. The shuriken whips through the gap and sticks in the brick with a spark.
3. **MISSED** is sprayed on in marker. The payoff is smug, not violent.

## 6. Ranked upgrades

| # | Change | Inspired by | Effort | Where |
|---|--------|-------------|--------|-------|
| 1 | **The hit cut-in**: freeze, a two-tone flash, red speed ribbons from the throw side, a giant faceted shuriken embedded in a cracked, swinging polaroid, and shards | dodge 03, 08, 09, 10 | M | TV |
| 2 | **Depth framing**: a near-black fire escape or drainpipe at the left and right edges in the foreground, and a fogged far end of the alley | dodge 01, 04, 05 | M | TV |
| 3 | **A mirror puddle**: filled puddle shapes holding a flipped, darkened copy of the lamp, the polaroid and the graffiti (baked, then clipped). No outlines | dodge 02, 06 | M | TV |
| 4 | **One far red light**: a neon sign or doorway at the vanishing point, its reflection in the puddle, and a magenta/cyan rim on the polaroid | dodge 02, 07 | S | TV |
| 5 | **The dodge payoff**: the shuriken sticks in the brick with a spark, a cold-rim afterimage on the polaroid, and **MISSED** sprayed in Permanent Marker | dodge 09 | M | TV |
| 6 | **Rain as one baked tile**: a single angle, moved with `transform`, with a brighter copy masked to the lamp cone only | dodge 03, 05 | S | Both |
| 7 | **Brick with light falloff**: baked noise and grime drips, and bricks darkening away from the lamp, so the wall stops reading as wallpaper | dodge 01, party 06 | S | TV |
| 8 | **TV type pass**: intro copy 32px or more or cut, TO THE WHEEL placed clear of the graffiti, and "nobody saw nothing" demoted to texture | party 02 | S | TV |
| 9 | **A faceted shuriken everywhere**: split light and dark blade planes and a raised ring, used on the TV and phone and in the Test Lab | dodge 10 | S | Both |
| 10 | **Phone HIT fix**: Big Shoulders Display 900 with a crack line through it, a bigger faceted shuriken at the impact point, and the cracks kept | dodge 10 | S | Phone |
| 11 | **Phone swipe pad in the alley**: a lamp pool and wet sheen on the pad, so the phone feels like the same place as the TV | dodge 02, 06 | S | Phone |
| 12 | **The countdown as a thing in the scene**: a flickering sodium sign or a parking meter showing the seconds | party 05 | S | TV |

**Rules this list keeps**
- **The TV never names the thrower.** The *mockup's* kicker "The Assassin throws at Tom" names a secret role. The live `MiniGames.tsx` doesn't, but the mockup should change to "Something's coming for Tom" so it can't creep into the build.
- **The TV never shows the throw direction before the reveal.**
- **Animation**: transform and opacity only, with textures baked.
- **Reduced motion**: it gets the still end frames.
