# Phone UI v2: findings and proposed system

Board: `design/mockups/PhoneUI.dc.html` (http://localhost:8766/design/mockups/PhoneUI.dc.html, `?motion=false` to freeze).
Before: `design/research/current/phone-*.png`, taken from a practice room (8 bots, TV Test Lab, a bot's phone at 390×844).
After: `design/research/after/phone-ui-screens.png` (whole board, half scale), `phone-ui-1-join.png` … `phone-ui-8-spin.png`, `phone-ui-components.png`.

## 1. What's wrong with the current phone

| # | Problem | Where (screenshot) |
|---|---|---|
| 1 | **Tap-again confirm changes the label under your thumb.** `ConfirmButton` turns into "TAP AGAIN: …", so a drunk double tap fires a once-a-night power. | Moves (`phone-moves-open.png`) |
| 2 | **One tap on a face casts a Trial vote** with no check and no undo. "NO TRIAL. NOT SURE YET." is the biggest key on the screen and sits above every face. | `phone-vote.png` |
| 3 | **The Moves folder gives your role away once open.** Every ability has its own colour (green heal, purple forge, gold Scrooge, teal Davy) and glow, readable from across the room. | `phone-moves-open.png` |
| 4 | **The role file opens below the fold** and stays open 10s after one tap; you scroll to read it and it can be left open on the table. | `phone-rolefile.png` |
| 5 | **Success is a 3-second toast** hidden behind the reactions bar; errors show "⚠" plus raw server text. | `phone-heal-toast.jpg` |
| 6 | **The tally disappears during the cooldown** ("NICE ONE / NEXT IN 20s") and otherwise lives in the beer key's small print. | `phone-cooldown.png`, `phone-home.png` |
| 7 | **Cryptic level badge**: "LV1 +3" (3 what?). The perks for each level are only in the file. | `phone-home.png` |
| 8 | **Grammar bug**: "YOU IS SPINNING. WATCH THE TV" when you're the victim of a free spin. | `phone-round-banner.png` |
| 9 | **Notices close on "tap anywhere"**, so a stray tap dismisses them unread. Level-ups print your perk ("2 heals") full screen: a peek risk. | `phone-notice-levelup.png` |
| 10 | **Join**: the default key reads "JOIN WITHOUT SELFIE" in grey (looks disabled, wraps to two lines); the card-code entry is a box in the middle of Home. | `phone-join-selfie.png`, `phone-home-nocode.png` |
| 11 | **Nothing says what's happening or what to do** except a red banner that only appears during a round. | `phone-home.png` |
| 12 | **Emoji reactions** and emoji in every ability label (🍺 😈 🙏 😂, ✚ 🔍 ⚓ …). They're to be replaced by drawings. | all |
| 13 | **Pickers**: 3-up polaroids with italic names ~20px, and excluded players vanish so the grid reshuffles. | `phone-picker.png` |

What already works and stays: the beer key's size and sodium keycap, the peek-proof closed folder, the manila file, the hazard-box SPIN screen (`phone-spin.png`).

## 2. The proposed system

**Layout.** 390×844, iOS safe areas (47px status, 34px home indicator). 16px gutters, 8px grid; 12px between cards and between tap targets.
Every screen after you join = **the same top bar** (64px: you, level, room + LIVE; only the sub-line changes, e.g. IN REHAB) → **a screen row** under it for the title, back key and timer/count → **one question** → **one primary key at the bottom**. The three join steps come before you exist, so they use a step bar instead.

**Type scale** (4 families, each with one job):

| Role | Face | Size |
|---|---|---|
| Hero (takeover title) | Big Shoulders Display 900 | 60 |
| Display (result) | BSD 900 | 48 |
| H1 (screen question) | BSD 900 | 36 |
| H2 / key info (names, tally, move titles) | BSD 900 | 28–32 |
| Key labels | Big Shoulders Stencil Display 900 | 28–34 |
| Body | Courier Prime 700 | 20 |
| Small | Courier Prime 700 | 18 |
| Label (caps, +12% tracking) | Courier Prime 700 | 16 (nothing on a phone is under 16px) |
| Role name only (in ink, inside the file) | Special Elite | 40 |
| Handwritten captions | Permanent Marker | 24 |

**Colour** (each means one thing; always paired with an icon or word): Ink `#07090b` page · Steel `#262f34` rows and quiet keys · Bone `#f1e8d4` text · Bone 2 `#d2c8b0` supporting text · **Sodium `#ff8a1e` your action, now** · Alarm `#e8412a` accuse/stab/spin · Phosphor `#8dff9a` done/safe · Hazard `#e8c53a` wait/busy · Sea `#8fd3e6` the Locker · Manila `#efe3c6` your secret file only.

**Components** (component strip on the board):
- **Keys**: primary sodium keycap, 88px, full width, one per screen; secondary steel 64–88px; red for accuse/stab; outline "quiet" key 64px; back key 64×64. States: pressed (drops 6px), snap (sodium ring + click sound), disabled (dark steel, and the label says why: "JOIN (2 more letters)").
- **Beer key** 136px; cooling down shows a tick, LOGGED and a draining bar, never hides the tally.
- **Two-step confirm**: step 1 taps a face; step 2 is its own screen with the face big, a neutral question ("USE IT ON SAM?"), the cost at body size, NO (outline, top) and YES (bottom). YES arms after 0.6s. Secret moves say "YES, USE IT"; the public Trial vote says "YES, VOTE SAM".
- **NOW strip** (96px, first on Home): what's on the TV + "You: …" what to do. Opens a sheet with TV / Queue / Beers tabs (64px segmented).
- **Rows**: player 80px (58px photo, 30px name; hatched, photo dimmed, reason in 16px bone when not pickable), move 88px (icon, name at 20px body size, one line, one status chip style for every row), feed 64px.
- **Cards**: tally (seven-segment LED + "38 TO GO" + 20-cell LED bar), level (one plain bar + "3 more beers → Level 3"), file tile and moves tile (identical on every phone), fact row (icon + one line + detail, used on every notice).
- **Result screens**: a 120px lamp (green tick / red cross / amber TV) and a neutral headline (DONE, DIDN'T GO THROUGH, THE TV IS BUSY) that are identical for every role; what happened is one body-size sentence; one key; auto-return with a visible count.
- **Icons**: 24px grid, 2.2px round stroke, drawn as SVG paths (stand-ins until the drawings arrive). No emoji.
- **Motion**: transform/opacity only (key press, "+1" float, LED blink, arming bar, glow pulse), opt-in `.pu-motion`, off under `prefers-reduced-motion`. No filters, no feTurbulence. Textures are the baked `dither.png` / `hazard.png`.

**Peek-proofing kept and tightened.** Home shows the same two tiles on every phone. The Moves list is neutral steel for every role, move names are 20px body text (not headlines), and it always contains Evidence and "Ask for a rest", so its length says little. Display-size text on the move flow is the same for every role: "PICK A PLAYER", "USE IT ON SAM?", "YES, USE IT", "DONE", "DIDN'T GO THROUGH". The verb ("Heal") appears only once per screen, at body size, readable at arm's length but not from 2–3m. The role name appears only inside the file, in ink at 40px. Notices that would name your role say "Your file has changed" instead.

## 3. Built for drunk thumbs

The players will be very drunk by the end of the night. Every board meets these rules; each board's annotation has a "Built for drunk thumbs" box saying how.

| Rule | How the system meets it |
|---|---|
| **Huge tap targets** | Nothing tappable is under 64px. The primary key is 88px and full width; the beer key 136px; player rows 80px; move rows 88px; reactions 72px. 12px+ between targets, and the NO/YES pair is 16px apart with different shapes (outline vs solid). |
| **One decision per screen, one verb per key** | Pick a player → a separate check screen → a result screen. Keys say the verb and the object: JOIN AS MEG, YES, HEAL SAM, YES, VOTE SAM, GOT IT, OK. |
| **Plain words** | "38 TO GO", "3 more beers → Level 3", "Your heal wasn't used". No "PUN.", "LV1 +3", raw error text or jargon. |
| **High contrast, big type** | Nothing on a phone is under 16px (labels, chips, reasons, reaction labels, LIVE); body 20px bold (18px minimum) in bone on ink (about 16:1); key info (names, tally, headlines) 28px+. Colour never alone: ticks, crosses, clocks and words (DONE, LIVE, OFFLINE, NOW, IN THE LOCKER) carry the meaning. |
| **Irreversible actions confirm** | Abilities and Trial votes: tap a face, then YES on its own screen, placed away from where you just tapped. YES arms after 0.6s so the second half of a double tap can't land on it. Harmless actions (a beer, a reaction, SPIN) stay one tap. |
| **Re-orient in one glance** | The top bar (you, level, room, LIVE) is the same on every screen after joining; titles, back keys and timers sit on a row under it. Home starts with the NOW strip: what's happening and "You: …". The Locker and Rehab replace the strip with their own state card; the Trial shows the question and timer at the top. Your role is always one tap away, in the same tile. |
| **Forgiving input** | No long-presses (the old "hold to read" is gone), no drags, no small toggles. A second tap within 600ms is ignored everywhere (1.5s on the beer key). A back swipe never leaves the game: on a check screen it means NO, elsewhere it goes Home. Typed codes accept lower case, spaces and O/0 mix-ups. |
| **Calm timers** | Timers are big amber seven-segment digits, not flashing red. Screens say what happens if you run out ("Not voting is fine. Nothing happens to you."; "No rush. The host can spin for you."). Waiting for the TV never costs you your move. |

## 4. Open questions for the user

1. **Role reminder vs peek-proofing.** The drunk-thumbs brief asks for a persistent role reminder, and peek-proofing forbids one on Home. The board keeps the role one tap away (file tile) rather than on screen. OK, or should the top bar show something neutral like your team colour?
2. **Hold-to-read file dropped.** It was a peek guard, but it breaks the no-long-press rule. Tap to open with a 12s auto-hide replaces it. Acceptable?
3. **Level-up and evolution notices** now say only "Your file has changed". Is losing the celebration worth the privacy?
4. **Undo instead of confirm for votes?** A 5-second "UNDO" after voting is lighter than a check screen but harder to hit drunk. The board uses the check screen.
5. **Sound.** The "click" on every tap needs a sound on by default and a mute in the NOW sheet. Is sound on by default acceptable at a party?

## 5. Changes after the design review

The design critic's must-fixes are applied on the board:
1. Move names no longer leak at display size: the flow uses neutral headlines and keys (PICK A PLAYER, USE IT ON SAM?, YES, USE IT, DONE, DIDN'T GO THROUGH). "Heal" appears only at body size. The result lamps mean the same for every role.
2. The role name in the file is set in ink at 40px.
3. Everything on a phone is 16px or larger, bold, in bone: the reasons on pickers, chips, LIVE, reaction labels, "/100".
4. The same top bar is on every screen after joining. Screen titles, back keys and Trial timers sit on a row under it; Rehab keeps the bar and changes its sub-line to IN REHAB.
5. "Not sure yet: no trial" is a full-width quiet key under the faces, not a grid cell.

Also applied: the TV-busy screen's only key is "BACK TO HOME", with the countdown as a label; the picker has one way out (back); REHAB is set in Big Shoulders; the level is one plain bar; every move row has the same chip style; the envelope art no longer shows a real-looking code.
