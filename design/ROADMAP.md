# Roadmap

The backlog the user calls "Roadmap". Check items against the code before presenting them.
When the user says **"Roadmap"**, this is the list they mean. Party is 2026-10-10. Last updated 2026-10-02 after commit
836ed73 (TAKE IT FOR THEM, new Shuriken / curse pass on the board / NOW PLAYING marquee / SETUP, TV scaling 720p-4K with
a TV EDGE MARGIN setting) and 869c6a1 (logic fixes, Plank reveal, security, spare codes, name-clip summons) — DONE. Re-verify against the code before presenting.

**Must do before the party**
- Live Supabase (cjtimfbwxbyvvcsmdxyg) is synced to commit 13517c7 (2026-10-05: sync_20261005_levels_caps_bets_shop_1..9
  for levels 1-4, caps, betting and the shop; all 52 functions md5-verified against the repo, `_` functions closed to
  anon/authenticated). Anything committed later must be applied the same way: only the changed functions + new columns. Still to do: HOST_EMAILS secret.
- Do NOT switch off "Allow new users to sign up" (may block anonymous phone joins); raise Auth → Rate Limits for anonymous
  sign-ins (~30/hour/IP by default; the whole party shares one IP).
- Laptop on UK time (the TV shows the deadline in the laptop's local time).
- Name-clip summons: the user picks clips from design/research/names/NAMES-A.md / NAMES-B.md and trims them into
  public/assets/names/ (guide in its README). Decide: keep clips out of git (local laptop only) or deploy like davy-jones.mp4.

**Open decisions**
- Levels 1-4 + caps + betting with caps: BUILT (2026-10-05), see README "Levels 1–4" and "Caps and betting". REPLACES the
  4/8-beer levels and the ARC's acts (retention.md) and the sips/chips betting spec. Level 1 pacified; games cap; caps private.
  Betting stakes are chosen (5/10/20/ALL IN; proportional payout). The CAPS SHOP is built: soundboard 5, bribe the wheel 15,
  graffiti 20, golden ticket 30 (README "Caps and betting").
- decide_lock (approved rest) still offers 10/15/20/30 (low risk; lock requests are public).

**Smaller leftovers**
- Plank "NOT SENT · TAP AGAIN" only appears after the server's cut-off (retry already covers the window).
- Realtime is still public (optional private switch in supabase/optional/, untested against real Supabase).
- Locker scene on a 4K smart TV: its 1920x2400 dive layer grows with the stage scale; cap useStageScale if needed.
- phone.css .dossier still uses paper.svg; scripts/bake-textures.mjs lacks the paper.png recipe.
- Trial TV caps at 13 rows / tally at 7 suspects (+N line).

**Features — before the party (not started)**
1. Move a player to a new phone (host one-time relink code).
2. 3-card how-to-play primer on the phone after joining.
3. Pace tracker extras: "on pace" ghost on the beer rack; nudge the host if no game for ~40 min.
4. End-of-night awards after reveal_all.

**Between-nights (deferred; user's "retention" = one 7-hour night, not this)**
- Players exist only per room/per phone (anon auth): nothing links night 1 to night 2. Night data isn't deleted, so before
  night 2 add a regulars link or at least export night 1. Ideas: "Previously on The Hundred" lobby loop, rap sheet / nemesis,
  per-night case files (role/rule presets), RSVP + one-tap "run it back". Only use fully revealed nights (secrecy).
  See design/research/games/machine-party.md.

**Features — longer term**
Spectator /watch/CODE; all-time stats; photo wall + "previously on…" montage; new roles (Informant, Bookie, Fixer);
new mini-games (Wire Cut, Lineup, Last Orders auction); scenario/wheel packs; setup wizard for other hosts.

