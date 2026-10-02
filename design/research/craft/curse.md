# Curse pass: craft notes (motion and texture)

What the curse pass on the Suspects board (`src/tv/CurseFx.tsx`, `src/styles/curse.css`) borrows, and why.
The beats are the original ones (698d3ba): the skull lifts off, a shadow figure crosses the board, thorns possess
the new card, and they become the skull.

## Motion
1. **Anticipation before every release** (Disney's 12 principles). The old card shudders, its burn glows, the sigil
   flares, and the skull squashes down (scale 1.12, 0.8) before the figure pours out. The eye knows where to look
   before anything moves.
2. **Squash and stretch on impact, then overshoot and settle.** When the knot becomes the skull it hits at 1.38 × 0.66,
   rebounds to 0.88 × 1.12, then settles in three ever-smaller steps (follow-through). The char overshoots to 1.15.
3. **Arcs, not lines.** The figure flies on a cubic bowed toward the board's centre. This is the path idea behind CSS
   `offset-path`, but sampled into transform keyframes so a cheap TV browser doesn't need it.
4. **Slow in, slow out with intent.** easeInOutCubic (easings.net): it tears free, rushes, then brakes into the dive.
   The smoke and embers are timed to the moment the figure actually passes them, by inverting the easing curve.
5. **Lean and stretch with velocity.** The figure tilts up to 26° into its direction of travel and stretches up to 22%
   at peak speed, computed per keyframe from the sampled velocity.
6. **Secondary motion.** The ragged tail swings on its own clock, lagging the body. The vines wriggle (rotate/skew)
   after they finish growing. The card trembles while it is possessed.
7. **Stroke drawing for growth and retraction** (CSS-Tricks, "How SVG Line Animation Works": `pathLength=1`, dash 1,
   offset 1→0). Running the same offset on to −1 makes each vine retract toward its end, and every vine ends in the
   corner, so the tendrils converge into the knot for free.
8. **Pop with a spring curve.** Thorns use `cubic-bezier(.3,1.6,.5,1)` from their base (`transform-box: fill-box`),
   staggered along their vine so they follow its growth.
9. **Gravity for embers and buoyancy for smoke.** Embers fall on an ease-in curve and shrink; smoke rises, turns and
   expands on ease-out. Mixing the two directions sells "hot, heavy, evil".
10. **Candle flicker as irregular opacity holds** (SitePoint, "Organic CSS3 animation"). The sigil and the cooling
    ember rim use uneven keyframes, never a loop, so it reads as fire rather than a blinking LED.
11. **One focal point at a time.** The old card, then the figure, then the new card, then the strip. Nothing else on
    the board moves. A Se7en-style tension beat (Kyle Cooper's titles) comes from holding still before the hit.

## Texture
12. **Bake, don't filter.** `scripts/bake-curse.mjs` writes fBm value-noise PNGs once: the charred corner, its ember rim
    and a 2×2 smoke atlas. This is the CSS-Tricks "Grainy Gradients" feTurbulence idea moved offline: no runtime
    filters, every texture under 200 KB, and crisp at 4K (the corner is 352 × 320 for a box of about 224 × 204 at 4K).
13. **Burnt paper is a ragged threshold, not a gradient.** The char is a distance field from the corner, warped by two
    octaves of noise (big bites plus fine tatter): a crisp rust lip, mottled black with ash flecks inside, and a
    blotchy brown scorch fading into the manila. The board's static `.bd .curse` uses the same PNG, so the hand-off
    from animation to board is seamless.
14. **Blend modes for light** (MDN `mix-blend-mode`). The ember rim and the impact ring use `screen`, so they only
    brighten the char layer beneath them, like light, never like paint. The overlay's own stacking context isolates
    them from the manila card underneath.
15. **Noir lighting on the figure.** It's a near-black silhouette with one red rim light down its leading edge, ember
    eyes and a glowing skull: one warm light in a cold shape, which reads at 3 m.

## Scale and performance
- Card boxes are measured from the DOM, and every size is in the card's `--k` (board.css: `min(1cqh,.62cqw)` of the
  card). The board re-measures and restarts if it re-lays out mid-pass. Tested at a 1180 × 600 and a 1900 × 1000
  board.
- Transform, opacity and SVG stroke-dashoffset only. About 70 small elements for ~4.6 s, then gone.
- Reduced motion: a plain crossfade of the brand from one card to the other.

## Still not world class
- The thorn vines are uniform-width strokes. They read as dark scribble at small board sizes, where tapered,
  hand-drawn vines would read as thorns.
- The figure is a flat SVG silhouette. A baked, painted sprite with soft smoky edges would be richer.
- The burnt corner is small on a 10+ player board (~35 px at 1080p), so the skull carries the read.

## Sources (opened in Chrome and screenshotted, 2026-10-01)
- Art of the Title, Se7en: https://www.artofthetitle.com/title/se7en/
- Twelve basic principles of animation: https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- easings.net: https://easings.net/
- CSS-Tricks, How SVG Line Animation Works: https://css-tricks.com/svg-line-animation-works/
- MDN offset-path: https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path
- MDN mix-blend-mode: https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode
- CSS-Tricks, Grainy Gradients: https://css-tricks.com/grainy-gradients/
- Real-Time VFX, curse effects: https://realtimevfx.com/search?q=curse
- Codrops (smoke and ink demos): https://tympanus.net/codrops/?s=smoke
- SitePoint, Playing with Fire, Organic CSS3 Animation: https://www.sitepoint.com/playing-with-fire-organic-css3-animation/
- Game Developer, Darkest Dungeon's Affliction System: https://www.gamedeveloper.com/design/game-design-deep-dive-i-darkest-dungeon-s-i-affliction-system
