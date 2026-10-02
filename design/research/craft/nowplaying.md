# NOW PLAYING: craft notes

The scene (`src/tv/NowPlaying.tsx`, `src/styles/nowplaying.css`): a 1940s picture-house marquee lights up, the game's
name is hung on it letter by letter, the house lights go down and the lit name flies up into the top-bar chip.
Reference captures are in `nowplaying-refs/`.

## What the references taught, and where it went

1. **The marquee is the only light (Apollo, Gottlieb c.1947, ref 01).** Black letters on a blazing white panel are
   brighter than anything else on the street. Applied: the milk glass is the one warm surface in a cool, scrimmed frame.
2. **Halation.** The panel blooms past its own frame. Applied: `.np-halo` is a baked radial gradient behind the box,
   never a `filter: blur`.
3. **The soffit throws a pool of light on the street, and the rain only shows inside it (ref 01, noir low-key
   lighting).** Applied: `.np-cone` is a masked pool with `rain.png` sliding through it, on transform only.
4. **Hand-hung letters are never true.** Each letter sits a little off its rail, with slightly worn paint. Applied:
   fixed per-letter jitter (±1.4°, ±4px) and `--wear` opacity 0.88–1. Both copies use the same jitter, so the
   crossfade doesn't jump.
5. **Irradiation.** A backlit panel eats into the edges of dark letters. Applied: a cream `text-shadow` on the ink letters.
6. **Chasers are wired in channels (bulb 1, 4, 7… on channel 1).** Applied: 3 channel layers per strip, each one
   `repeating radial-gradient` background with only opacity animated. That's 12 layers, not 90 nodes. The bottom and left
   strips run their channels backwards, so the chase goes round the frame.
7. **Filaments have thermal inertia.** They flare on and then cool off. Applied: each channel snaps on and eases off
   over 90ms.
8. **Fluorescent tubes behind milk glass stutter on.** Applied: `steps(1,end)` flicker (0, 0.7, 0.2, 1), and the same
   flicker going off at the hand-off.
9. **Saul Bass (Anatomy of a Murder, Vertigo, ref 04).** Flat, hard-edged shapes in one or two colours. Applied: three
   skewed flat bars (teal, ink, a thin sodium rule) cut across as the stinger, the way a broadcast wipe covers a cut.
10. **Kyle Cooper (Se7en, ref 03).** Grain and handmade imperfection make type feel physical. Applied: `grain.png`
    over the whole viewport at 7%, jumped at 12fps with `steps()` like a projected print rather than slid.
11. **Anticipation and follow-through (the 12 principles, ref 05).** Applied: letters drop with an overshoot and
    counter-swing before settling. The flying name dips 18px before it rises. The chip catches it with a
    squash (`scale(1.07,.9)` springing back).
12. **Easing (easings.net, ref 02).** No linear moves. Applied: x and y take different curves in flight (y leads, so
    the path arcs), drops ease out, and fades ease in.
13. **FLIP / shared element (View Transitions, ref 06).** Measure *First* and *Last*, *Invert* with a transform, and
    *Play*. Applied: the chip's `.np-g` is measured live at the moment of flight (the state may land after the event),
    and the name is scaled by the font-size ratio, so it lands on the chip's own glyphs (within 2px at 1280×720,
    1920×889 and 2560×1440). Then it crossfades.
14. **Split-flap (ref 07).** Considered and rejected for this scene. Its cascade reads as "departures board", and the
    user dislikes clock-like faces. The letterboard "hang" gives the same one-by-one rhythm in the house face.

15. **The sign stays lit until the name has left it (critic pass 2).** The name lifts off the lit glass and turns to
    lit type with a hard ink edge, so it reads on the cream glass and on the dark. Only once it's clear (`OFF`,
    FLY+240) do the bulbs drop out, the last one flares and pops (`.np-pop`, with `Sound.tick`), and the glass stutters off.
16. **No two bulbs alike.** Each bulb is its own gradient, baked once per render in `NowPlaying.tsx`: three warmths
    (white-hot, warm, amber), a spread of core size and halo, two tired bulbs, and one on the fritz (`.np-flick`).
17. **The wet street.** `.np-wet` mirrors the box, the glass, the bottom bulbs and the hung letters about the kerb at
    62% height, masked to fade, with ripple bands sliding on transform. The rain is three sheets of `rain.png` at three scales.
18. **The chip reads from 3 m.** The kicker sits over the name (3.9cqh name, 1.8cqh kicker, in board units), so long
    names fit beside the host keys at 1280x720. The name's box is its own text (`justify-self:center`), so the FLIP
    lands on the glyphs. If a name is still too long and gets an ellipsis, the flight scales to the chip's box instead.

## Performance and access
- Motion uses transform and opacity only. Textures are the baked `grain.png` and `rain.png`, and glows are static gradients.
- Reduced motion: the DOM's own styles are the lit end frame, held for 2.6s, and then the chip appears.

## What still isn't world class
- Kerning is lost because each letter is its own inline-block, so the flying line is about 1.5% wider than the chip.
  The crossfade hides this, but it isn't a true glyph-for-glyph morph.
- The neon script doesn't take part in the hand-off; it just goes dark.
- The bulbs have no glass envelope or specular highlight when they're off.
- The reduced-motion still shows only the dim bulbs and the bad one, not a chase frame.
- There's no motion blur in flight (filters are banned on the TV).

## Sources
- Art of the Title: Anatomy of a Murder https://www.artofthetitle.com/title/anatomy-of-a-murder/ , Vertigo
  https://www.artofthetitle.com/title/vertigo/ , Se7en https://www.artofthetitle.com/title/se7en/
- Apollo Theatre marquee, William P. Gottlieb (public domain), Wikimedia Commons
- Chase (lighting) https://en.wikipedia.org/wiki/Chase_(lighting)
- Split-flap display https://en.wikipedia.org/wiki/Split-flap_display ; Solari split-flap https://hvpandya.com/solari/
- FLIP, Paul Lewis / CSS-Tricks https://css-tricks.com/animating-layouts-with-the-flip-technique/
- View Transitions https://developer.chrome.com/docs/web-platform/view-transitions/same-document
- Twelve basic principles of animation https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- Easing functions https://easings.net/
- Grainy gradients https://css-tricks.com/grainy-gradients/
- Stinger anatomy https://www.iart.ai/glossary/stinger-transition
