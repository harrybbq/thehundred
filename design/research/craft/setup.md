# Craft notes: the SETUP modal (motion and texture)

What the references teach and how SETUP (`src/tv/TvModals.tsx` → `SettingsModal`, `src/styles/setup.css`) uses it.
Reference screenshots are in `setup-refs/`.

## Motion
- **Short and tied to the press.** Feedback for frequent actions stays brief and precise, and never makes anyone
  wait (Apple HIG, Motion). The role steppers press in (`scale(.92)`, 80 ms), and the number rolls up or down
  like a counter wheel in 140 ms, in the direction it moved.
- **Real curves and durations.** Material 3's tokens set selection controls at about 200 ms on the standard curve
  `cubic-bezier(.2,0,0,1)`, and entrances on emphasized-decelerate `cubic-bezier(.05,.7,.1,1)`. The switch knob and
  the index marker use standard at 180–200 ms; the deal-in uses emphasized-decelerate (`setup-refs/03`).
- **Ease-out for arrivals, never linear.** easings.net shows why things that arrive should decelerate
  (`setup-refs/02`). Nothing in SETUP uses linear easing.
- **One orchestrated moment.** Opening the Roles section deals it in: the card backs drop onto the ledger one by
  one (14 ms apart), then the role tokens follow (22 ms apart). It plays once per open, not on every click.
- **Motion that shows what changed.** A newly added card back lands in its own team's place (it's keyed by team
  and number, so only the new card animates). Changed-but-not-dealt counts slam a NOT DEALT rubber stamp beside
  the button, using the house `stamp` keyframes.
- **No layout shift under the pointer.** Checks that change while the host clicks (the Lovebird and Cursed limits,
  "no Saboteurs", "not dealt") appear in place, and the stamp is absolutely positioned, so the steppers never
  jump. An early version moved every token down a line on the first click and made the second click miss.
- **Transform and opacity only.** No animated `box-shadow`, `filter` or layout (house rule 4, a cheap TV browser).
  The index marker is a `::before` that scales; it is not an animated inset shadow.
- **Reduced motion.** Under `prefers-reduced-motion`, the deal-in, the stagger, the counter roll and the stamp slam
  are off, and the transitions are none. Everything still renders in its end state.

## Texture
- **A case file, not a SaaS form.** BotC's script tool lays the roles out by team on aged paper, with a hairline
  rule and a count per team, e.g. "TOWNSFOLK (0)" (`setup-refs/01`). SETUP's deck ledger is a manila sheet
  (the baked `/textures/paper.png`) with the team counts stamped in the role-card inks.
- **Torn from a pad.** Persona 5 frames its menus with torn paper edges and halftone (`setup-refs/06`). The ledger's
  bottom edge is a perforated tear-off, cut with a static CSS mask (no filter, no runtime noise).
- **Halftone card stock.** The card backs are dot halftone in the team ink inside a white printed border, the way a
  real deck's backs are printed. They're drawn with a static radial-gradient, not an SVG filter.
- **Broken stamp ink.** The NOT DEALT and CAN'T DEAL stamps are masked with the baked `/textures/stamp-ink.png`, so
  the ink breaks up like a real rubber stamp. The house `.stamp` already multiplies onto the paper.
- **Grain is baked, and only once.** CSS-Tricks' grainy gradients use live `feTurbulence` (`setup-refs/04`). We
  get the same film grain from the global baked overlay (`body::after`, `/assets/grain.svg` at 7%), which already
  sits over the modal, so SETUP adds no extra grain layer.
- **A desk lamp in a dark room.** The modal has a warm sodium pool falling from above the index, and a vignette
  into the corners. Both are static gradients. Only the lamp is warm; the rest is cool gunmetal (the house rule:
  one warm light in a cool scene).
- **Prints, slightly askew.** The mugshots sit on polaroid stock, tilted −1.6° and +1.2° alternately, so the deck
  reads as cards on a desk rather than icons in a grid. Two or more copies show a second card peeking out behind,
  with the count stamped on its corner.

## Scale
- **One stage, zoomed to the screen.** SETUP is laid out once at 1600×960 and zoomed (`zoom: var(--su-z)`) to 96%
  of the width or 95% of the height, whichever is smaller. It looks the same on a 1280×720 laptop at 150% scaling,
  a 1920×1080 TV and a 4K panel, and the Roles section fits without scrolling. Below 1000 px wide it falls back to
  the fluid layout.

## Still not world class
- The counter roll clips inside a 46 px window. It reads as a slot machine, not a true split-flap.
- There's no sound. A soft card-slap on deal and a stamp thunk would carry it on a TV across a room.
- The Wheel and Evidence sections are restyled but plain: no texture beyond the shared panel.

## Sources
- Apple Human Interface Guidelines, Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Material Design 3, Easing and duration tokens: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- easings.net, easing cheat sheet: https://easings.net/
- Blood on the Clocktower script tool: https://script.bloodontheclocktower.com/
- CSS-Tricks, Grainy Gradients: https://css-tricks.com/grainy-gradients/
- Persona 5 menus with personality and readability (J. Samson): https://medium.com/@fruitcupkun/persona-5-menus-with-personality-and-readability-d6db2e0b253e
- NN/g, Design guidelines for input steppers: https://www.nngroup.com/articles/input-steppers/
