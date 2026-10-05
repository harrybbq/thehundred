# The Hundred: working notes for Claude

A noir social-deduction drinking party game. The **party is 10 Oct 2026**. One TV (a laptop on a 40"+ screen) is the
host screen, and about 12–17 guests play on their phones. Read README.md for the rules, URLs and setup.
The backlog is design/ROADMAP.md ("Roadmap" means that file).

## Git and deploy rules
- Work and push only on `claude/party-dashboard-app-hizebt`. Netlify auto-deploys the front end from it. Never open a PR unless asked.
- No model identifiers in commits. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Committing and pushing means deploying. Run the tests first, and show the user new phone and TV screens before committing a feature.
- **Live database:** Supabase project `cjtimfbwxbyvvcsmdxyg` ("TheHundred"). Netlify does NOT apply SQL.
  - **Changing it needs the user's go-ahead.**
  - The migrations in supabase/migrations are edited in place (`create or replace`), so `supabase db push` won't re-run them.
  - **To sync,** apply only the changed functions and new columns (via the Supabase MCP `apply_migration`, named `sync_YYYYMMDD_*`).
  - **Then verify:** `md5(prosrc)` per function matches the repo, and the `_` functions are not executable by anon/authenticated.
  - **Status:** live is synced to commit 13517c7.

## Hard game rules (never break)
- Secret roles and secret info never reach the TV or the public realtime channel. Every ability is validated server-side.
- Walk the Plank and Dodge fairness: nobody's stop, position or result appears before the reveal.
- No browser alert/confirm/prompt; use the in-app Check screen (YES arms after 0.6s).
- TV performance: animate transform/opacity only, bake textures, and give every animation a prefers-reduced-motion path.
- Phones are used by very drunk people:
  - huge targets (64px+), 16px+ text
  - one decision per screen, with a "what do I do now" line
  - no drags or long-presses (except the existing hold-to-read)
- Never reward drinking faster: no consumption streaks or leaderboards. Two agreed exceptions, with guards:
  - drink levels (LV1-4 at 0/3/6/9 beers) are capped at games finished + 1 (lifted 2 h before the deadline);
  - caps (+1 per logged beer) stay private on each phone: never on the TV, in events or in any ranking.
- **Extend, don't replace.** Only replace an existing feature if the replacement is clearly world class and fits the
  existing logic. Mark it "REPLACES: X". Keep what players love: the evidence photos, the Trial, the big TV scenes.

## The user's vision
- A **world-class** experience, full of the group's **inside jokes**. The party is meant to **reignite future meet-ups**,
  so the night should end by setting up the next one (finale, cliffhanger, keepsake, saving the night).
- **"Retention" means one night that stays satisfying for up to 7 hours,** with three acts:
  1. **Act 1, the first ~hour:** build-up. No major abilities; people learn the game.
  2. **Act 2, after the first game/Trial:** it picks up. 1–2 roles earn something fun.
  3. **Act 3, after the third game:** it gets mental.

  Built as levels 1-4 (0/3/6/9 beers) with a games cap (games finished + 1), not separate "acts". Level 1 is pacified
  (no active powers). Level announcements must never reveal who holds a role.
  The plan is in design/research/games/retention.md; the other research is in design/research/games/*.md.
- **Inside jokes:**
  - **Nicknames:** Aaron = "Gloopstein", Munro = "Bogarde", Joshua = "Blub".
  - **Catchphrases:** "one maybe two", "relax", "PULEASE".
  - **No beef between anyone;** keep every joke affectionate.
  - **Existing gags:** Aaron's Plate / the dirty sausage, the Skank, Davy Jones.
  - **Guests:** Aaron, Harry, Aidan, Sol, Joshua, Jamie, Kyle, James, Beth, Emma, Matthew, Thomas, Munro, Jenkins, Luke, Jimmy, Eva.
  - **Ask the user for more jokes;** never invent personal ones.
- **Phone UI decisions:**
  - keep hold-to-read
  - votes use the Check screen
  - level-up notices say only "your file has changed"
  - mugshot role cards everywhere
  - tap sound off by default

## Running it
- `npm install`, then two terminals:
  1. `npm run mock-server`: the PGlite backend on :8787 (loads every migration). Use `MOCK_ALLOW_SQL=1` for the e2e.
  2. `VITE_BACKEND=mock npx vite`: the app.
- Open `/tv`. The local test host login (mock/localhost only): host@party.test / party123. The Test Lab in /tv can play every TV moment.
- **Tests:**
  - `npm run test:logic`: the server rules, in-process.
  - `npx tsc --noEmit -p .`
  - `npm run build`
  - The full night e2e needs both servers running: `APP_URL=http://localhost:5173 npm run test:e2e`. Set `CHROME=<path>` if Playwright's browser isn't installed.
- The design-critic and rules-auditor agents live in .claude/agents. Run rules-auditor before committing anything that touches the TV or a mini-game.
