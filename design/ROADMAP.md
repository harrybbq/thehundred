# Roadmap

The backlog the user calls "Roadmap". Check items against the code before presenting them.
When the user says **"Roadmap"**, this is the list they mean. Party is 2026-10-10. Last updated 2026-10-02 after commit
836ed73 (TAKE IT FOR THEM, new Shuriken / curse pass on the board / NOW PLAYING marquee / SETUP, TV scaling 720p-4K with
a TV EDGE MARGIN setting) and 869c6a1 (logic fixes, Plank reveal, security, spare codes, name-clip summons) — DONE. Re-verify against the code before presenting.

**After party night 1 (24 Oct)**
- Beer pong with 10: a 3 v 3, then a 2 v 2 that had to be picked by hand. Fix: GAMES → WHO PLAYS → EVERYONE, MATCH
  AFTER MATCH (src/tv/Matchups.tsx drawAll; sides stored in pairs, one pair per match). SQL: _curse_targets only offers
  losers of the Cursed player's own match (live sync: supabase/sync/20261024/1_curse_targets.sql; after it the 56
  functions aggregate to 7f3fa5ffbf71ef0809d353c5889f2f95). NOT YET APPLIED on live (24 Oct): the Supabase connector
  in that session only saw another project; the user pastes the file in the SQL editor or reconnects. Until then the
  curse can pass to a loser of any match in a several-match game.
- APP GAMES BUILT (24 Oct): THE HERD, ODD ONE OUT and TAG TEAM CHESS, picked from GAMES → LET THE TV RUN ONE
  (README "App games"; screens: https://claude.ai/artifact/AFXSRoDTEtT3xSTSwojSX7). Each is a normal games row (app,
  app_state, app_secret) so GAME OVER, Champ, Slacker, Trial, levels, caps and undo all follow; per-kind SQL in
  supabase/migrations/20261024000004-7, the chess rules engine in ...0003 (perft-tested). Tests: test:logic (the Herd and
  the framework), test:odd, test:chess. LIVE SYNC PENDING: supabase/sync/20261024/2_app_games.sql (one paste, includes
  _curse_targets; after it 121 functions, aggregate 9c49c1a16d404267e8085c38af5612b6). Next: Web Push alerts (below),
  the host's own Herd questions (settings.herd_questions is read already; no screen to type them yet), bots that play
  along in the Test Lab.
- Game 2 was skipped (nobody drove it). Planned: app-run host games of 5-10 minutes that end in the normal GAME OVER.
  First: ODD ONE OUT (the user's idea: everyone gets the same famous person except one; up to 3 words each, out loud;
  vote; caught = one guess said out loud, host judges; right = they pick who takes it, wrong = them; not caught = the
  wrongly accused goes in the queue; 3 rounds; no head start). Screens: https://claude.ai/artifact/SHfZsEjQRupcLPuPwGjMWL
  (awaiting the user's OK). Next: THE HERD (the user liked it).
- TAG TEAM CHESS (the user's friends' idea, 24 Oct): two teams, classic chess, each team's move made by its next
  player in turn. Agreed: chess clocks 5 min a team + 30 s a move (a random legal move if it runs out); no conferring
  (honour system, a sign on the TV); phones show a board you tap, a picked piece lights up its legal moves, then a
  check screen (squares ~46px: the user's choice over the 64px rule); the whole losing team to the queue, a draw =
  nobody. Every move checked on the server. Screens: https://claude.ai/artifact/G4iZq3qcZxhg719Gh7KvVk (awaiting OK).
  Changed 24 Oct: 10 minutes a team (a game can run ~20 min), live material like chess.com (pieces taken + "+N"),
  colours drawn at random in the matchmaking.
- REAL PHONE ALERTS (asked 24 Oct, for everything that alerts a player): Web Push. A TURN ON ALERTS step asks for
  notification permission and saves a push subscription; the server (the `api` Edge Function, VAPID keys as Supabase
  secrets) sends a notification on summons, your turn, the Trial, the wheel. Android: works from the browser. iPhone:
  only for the web app added to the Home Screen (iOS 16.4+), which has its own storage, so iPhone players add it
  before joining. Lock-screen text stays generic (never a role or secret). Needs Supabase access to deploy.
- Evidence photos were cropped to landscape frames (phones mostly shoot upright). Fix: every Trial frame takes the photo's
  own shape (src/tv/VoteOverlay.tsx useRatios/fitIn); the phone preview and the host's evidence list show photos whole.
- The finished board cut cards off on a short, wide screen. Fix: THE REEL (src/tv/PlayerGrid.tsx): once the night is
  over, one row rolling past on a loop (reduced motion: pages).

**Party night 1 (10 Oct, room BYXY): what went wrong, and the fixes (DEPLOYED 11 Oct)**
- Phones forgot their player: 23 anonymous sign-ins and 19 joins for 7 final players; the only way back was kick + spare
  code (a plain Drinker). Fixes: the phone never swaps a saved login for a new one (src/lib/supabaseBackend.ts: refresh it,
  or TRY AGAIN on a network error), and REJOIN (above).
- Both Trials closed on the 30-second timer with 5 and 3 of 10 votes in. Fix: Trials wait for every vote (no clock), the TV
  shows WAITING ON N and names the last three; END VOTE NOW stays for a dead phone.
- DEPLOYED 2026-10-11 (user said "deploy"): live Supabase synced with supabase/sync/20261011/1-5
  (sync_20261011_rejoin_trial_wait_1..5): players.rejoin_uid/rejoin_at/rejoin_code; new _vote_waiting (revoked);
  changed _a_setup, _a_games, _state and _exec. All 56 functions md5 = repo (aggregate 590f1dd4ecb523b85855874133961264),
  no _ function open to anon/authenticated. Front end pushed in the same deploy.

**Must do before the party**
- DEPLOYED 2026-10-10 (user said "Deploy"): front end pushed, and live Supabase fully synced (the user pasted
  supabase/sync/20261009/2b in the SQL editor; all 55 functions md5 = repo, aggregate 832118aba337907a9a6830040d787c1c). Open question:
  late pile in BY HAND mode too, or random deals only (user getting final head count first).
  Also in this deploy: THE BOOKIE IS OPEN (TV scene + phone cards after game 1's aftermath; no SQL), and the
  games cap removed (_plevel = _blevel, no level_cap event: SQL, so it joins the same sync), and THE SKANK HAS BEEN AT
  WORK (finish_game sends an empty 'skank_work' tease from public facts only: random deal, Skank in the counts, or a late pile, until the Skank is unmasked; the stash still goes in at
  the deadline, now animated on the TV before the result; changed _a_games (finish_game): same sync). The host chose
  the tease over paying in after each game (9 Oct): exact per-game amounts plus the board's beer counts gave the Skank away.
- Decide: the Bookie opens after game 1 but the bettable mini-games need LV4 roles (the Kraken's Plank, Pennywise's Jack)
  or the Assassin's Dodge, so at a steady pace the first bet may not come until ~23:30 (see the night canvas,
  https://claude.ai/artifact/HVMP3qSuBSbbpTT9re2A1j). Options: a host-called mini-game from GAMES, or Plank/Jack earlier.
- Live Supabase (cjtimfbwxbyvvcsmdxyg) is synced to commit 13517c7 (2026-10-05: sync_20261005_levels_caps_bets_shop_1..9
  for levels 1-4, caps, betting and the shop; all 52 functions md5-verified against the repo, `_` functions closed to
  anon/authenticated). Anything committed later must be applied the same way: only the changed functions + new columns. Still to do: HOST_EMAILS secret.
- Do NOT switch off "Allow new users to sign up" (may block anonymous phone joins); raise Auth → Rate Limits for anonymous
  sign-ins (~30/hour/IP by default; the whole party shares one IP).
- Laptop on UK time (the TV shows the deadline in the laptop's local time).
- The TV is 60"+ (likely 4K). Set the laptop's output to 1920x1080 (or Windows scaling 200%) so the TV renders a
  1920x1080 viewport: same look, far less GPU work (the Locker dive layer doubles to 3840x4800 at a 4K viewport).
  Set the TV's picture size to "Just Scan" / "Screen Fit" and pick TV EDGE MARGIN in SETUP so nothing is cut off.
- Name-clip summons: the user picks clips from design/research/names/NAMES-A.md / NAMES-B.md and trims them into
  public/assets/names/ (guide in its README). Decide: keep clips out of git (local laptop only) or deploy like davy-jones.mp4.

**Open decisions**
- Levels 1-4 + caps + betting with caps: BUILT (2026-10-05), see README "Levels 1–4" and "Caps and betting". REPLACES the
  4/8-beer levels and the ARC's acts (retention.md) and the sips/chips betting spec. Level 1 pacified; no games cap (dropped 9 Oct: levels by beers alone); caps private.
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
1. ~~Move a player to a new phone~~ DONE 11 Oct as REJOIN: type the same name → "Is that you?" → the host approves on the
   TV (no codes on screen). Built after party night 1 (10 Oct), where 12 re-joins and 5 spare codes cost people their role.
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

