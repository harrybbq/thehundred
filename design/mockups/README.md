# Mockups: Dodge and Walk the Plank

Design mockups for the two mini-games, before they're built into `src/tv/MiniGames.tsx` and `src/phone/PhoneGames.tsx`.
The live, commentable copy is the Design canvas on claude.ai; these files are the same boards.

**View them locally:** from this folder run `python3 -m http.server 8765`, then open
`http://localhost:8765/Plank.dc.html` (add `?moment=reveal` for the reveal, `?motion=false` to freeze it).
`support.js` is a small stand-in renderer for the canvas format ({{ holes }}, `sc-for`, `sc-if`); boards that
only `dc-import` another board (PlankReveal, DodgeHit, …) need the canvas itself; use `?moment=` on the parent instead.

| Board | What it shows | Props |
| --- | --- | --- |
| `Main.dc.html` | Dodge on the TV | `moment`: live, hit, dodged |
| `DodgePhone.dc.html` | Dodge on the phone | `moment`: swipe, hit |
| `Plank.dc.html` | Walk the Plank on the TV (galleon stern, three planks) | `moment`: live, reveal |
| `PlankPhone.dc.html` | Walk the Plank on the phone | `position`: 0–100 |

**Tools**
- `tools/ship.py` regenerates the galleon stern SVG (`tools/ship.svg`), which is pasted into `Plank.dc.html` between
  the `the ship:` comment and the planks.
- `tools/shoot.mjs FILE OUT [query] [x,y,w,h]` screenshots a board at 1920×1080 with Playwright (server on :8765).
