# Craft notes: the Shuriken (and any TV hit moment)

Reusable techniques for motion and texture on the 1920×1080 TV stage. Each one says where it shows up in
`ShurikenScene` (src/tv/Scenes.tsx, src/styles/shuriken.css).

## Motion

1. **Anticipation before the action.** A beat that tells the eye where to look: the bulb flickers and dies (380–700ms),
   then a single glint in the dark (820ms) marks the spot the star will come from.
   Source: Thomas & Johnston's 12 principles (en.wikipedia.org/wiki/Twelve_basic_principles_of_animation).
2. **Scale as distance; ease-in for approach.** A thing thrown at camera grows slowly, then fast at the end. The flight
   runs scale .08 → .3 over 62% of its time, then → 1, on an ease-in curve. Source: easings.net (easeInCubic vs easeOut;
   ease-out is for things arriving at rest, ease-in for things accelerating into a hit).
3. **Smear frames and multiples.** For the last ~40% of the flight, a tapered streak and two ghost stars trail the blade,
   and a spin-blur disc sits under it. This reads as speed where 60fps frames alone would strobe.
   Sources: Wikipedia "Smear frame"; rebusfarm.net smear-frame guide.
4. **Hit-stop as impact frames.** Freeze at contact. The freeze is two flat graphic frames of 50ms each, 3+3 frames at
   60Hz: black silhouettes on Kill Bill blue with Ben-Day dots, then on bone with the star in rust. After that, 40ms of
   still frame, so the whole stop is 140ms (~8 frames). Keep a single freeze under ~120ms or it reads as a dropped
   frame; here the graphic change carries it. Sources: Sakurai on hitstop (sourcegaming.info); valdemird.com
   "Game feel on the web" (60–90ms); theasc.com on the House of Blue Leaves silhouettes.
5. **Trauma shake.** offset = trauma² × noise, with a little rotation (pure translation reads as a glitch), held on
   twos (42ms poses). `njShake()` applies it. Sources: Eiserloh, GDC 2016 "Juicing Your Cameras With Math";
   Nijman/Vlambeer "The art of screenshake".
6. **Follow-through and secondary motion.** The world keeps moving after the hit:
   - the star quivers in the wood about its entry point
   - the photo is knocked and springs back to a new tilt
   - the dead bulb sways on its cord
   - paper chips arc up and fall
7. **Squash and overshoot on type.** THUNK slams in at 1.7×, squashes (.9 × .84), overshoots to 1.05 and settles.
   It holds, then follows through by drifting up and fading in held steps (on twos), never a smooth fade.
8. **Staggered beats, one per sound.** The words land on separate beats: NAME (stamp), "takes a shuriken." (whoosh),
   the stamp (stamp + thud), then the typed line at 34ms per letter with typewriter ticks. Never all at once.
9. **Camera push-in after the hit.** A slow dolly (scale 1 → 1.07, fast then creeping) keeps the end card alive
   and pulls the eye to the wound.
10. **Steps in WAAPI.** `steps(1,end)` set as the OPTION easing holds the first keyframe for the whole run. Put it on each
    keyframe (`held()`), with option easing `linear`.

## Texture and light

11. **Grain is a baked tile that jumps, not a filter.** grain.png moves by translate on twos (12fps), the Locker's
    trick. Source: CSS-Tricks "Grainy Gradients" (feTurbulence noise). Bake that noise to PNG; never run it live on a TV.
12. **Haze in the beam.** A baked fractal-noise tile (public/textures/haze.png, from scripts/bake-shuriken.mjs)
    drifts slowly by transform, inside a static diagonal mask the shape of the moonbeam.
13. **Noir low-key light.** Light the photo the way noir films are lit:
    - one hard key through venetian blinds (high-contrast slats)
    - a cold rim on the photo's lit edges
    - the face falling off to dark on the far side
    - a long shadow cast down-left
    - everything else gone to black
    - one warm source (the bulb), killed on purpose

    Sources: Wikipedia "Low-key lighting"; *The Big Combo* (John Alton).
14. **Make the contact physical.** A stab reads as stuck-in rather than lying on top when there is:
    - a foreshortened buried blade
    - a torn paper lip
    - a dent (a radial shadow) with puckered creases, each a dark fold with a lit edge
    - the blade's own hard shadow on the photo, cast in the key light's direction
15. **Print textures as masks.** The OFF TO THE WHEEL stamp is inked unevenly through a baked mask (stamp-ink.png:
    mottled coverage and dry streaks). It's a static mask, so it costs nothing per frame. The Ben-Day dots are an SVG
    pattern fill, not a filter. The lens vignette is a static radial gradient over everything.

## Scale

- Everything lives on the 1920×1080 stage, scaled whole by `useStageScale`. Raster tiles are drawn at half their pixel
  size (grain 256px → 128px), so a 4K TV (stage ×2) still gets about one texel per pixel. Everything else is vector or
  CSS gradient.
- Keep key content inside a 4% overscan safe area: x 77–1843, y 43–1037.

## References studied (Chrome)
- easings.net: curve shapes.
- css-tricks.com/grainy-gradients: feTurbulence grain.
- artofthetitle.com/title/se7en: hand-made texture, scratched type, held frames.
- en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- en.wikipedia.org/wiki/Low-key_lighting
- en.wikipedia.org/wiki/The_Big_Combo: John Alton's backlit fog silhouettes.
- valdemird.com/blog/game-feel-on-the-web: hitstop, shake with rotation, reduced motion.
- gdcvault (Eiserloh 2016): trauma shake.
- theasc.com (*Kill Bill*): the blue silhouette sequence.
