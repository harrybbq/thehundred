# The Hundred 🍺

A Jackbox-style party game for **10 October**: the laptop on the TV is the host screen, and guests join on their phones.
The group has to hit **100 beers** before **01:00**. Some players have secret roles.

| What | URL |
|---|---|
| Landing page | https://gammonbeastshundred.netlify.app |
| **TV / host screen** (log in) | https://gammonbeastshundred.netlify.app/tv |
| **Phones** (the QR code on the TV points here) | https://gammonbeastshundred.netlify.app/join/ROOMCODE |
| Printable role cards | https://gammonbeastshundred.netlify.app/cards/ROOMCODE |

Netlify builds automatically from the `claude/party-dashboard-app-hizebt` branch. The backend is the Supabase project **TheHundred** (`cjtimfbwxbyvvcsmdxyg`).

---

## Before the night (once)

1. **Supabase auth settings:** Authentication → Sign In / Providers
   - **Allow anonymous sign-ins: ON.** Phones use this.
   - **Confirm email: OFF**, or confirm your host email once.
   - URL Configuration → Site URL = `https://gammonbeastshundred.netlify.app`
2. Open **/tv** and create your host account (**CREATE ACCOUNT**, email and password).
3. **Create the room** (＋ CREATE ROOM). The deadline defaults to **01:00 on 11 Oct**, the end of the 10 Oct party night.
4. **Set the roles in play:** ⚙ → *Roles & Cards*. Lovebirds are counted in **pairs**.
   Tap **GENERATE CODES** (tap twice to confirm).
5. **Print the cards:** 🖨 *Role cards* (or `/cards/ROOMCODE`) → **PRINT**.
   Use A4 at 100% scale with headers and footers off. That's 4 cards per page. Cut along the dashed lines, put one card in each envelope and shuffle.
   - All blurbs are about the same length, so reading time gives nothing away.
   - Every code is single-use.
   - Each Lovebird pair is linked on the server, so their cards look normal.
   - Once anyone has redeemed a code, the codes are locked. To re-deal, create a new room.
6. Do a dress rehearsal with 2–3 phones. You can use ⚙ → *Game & Deadline* → **TEST: DEADLINE IN 1 MIN**, then **↺ BACK TO 10 OCT 01:00**.

## On the night

1. Plug the laptop into the TV, open **/tv**, pick the room and press **⛶** (or **F**) for full screen. Tap anywhere once so sound works.
2. The **lobby** shows a huge QR code and the room code. Guests scan it, type their name and take a selfie. Their card appears on the TV.
3. Guests pick an envelope in another room and enter the code on their phone (🔑 *Enter your role code*). The lobby shows a ✓ once they have, but never the role.
4. Tap **LET'S GO 🍻**. Bring the lobby back any time with **📱 JOIN** for late arrivals.
5. **Beers:** guests tap **+1 I FINISHED A BEER** on their phone. There's a 20-second cooldown, and the beer is logged against them.
   The host can also use **+1 / Space**. **−1** is host-only.
6. **Games:**
   - **🎮 GAMES** → name the game → START.
   - When it ends, tap **🏁 GAME OVER** → tap the losers → CONFIRM.
   - Then **START 30s VOTE** for *Biggest Slacker*. Everyone votes on their phone. In a tie, everyone tied gets punished.
7. **Punishments:**
   - **🎡 NEXT UP** calls the next person in the queue. The TV shows *NAME IS FACING THE WHEEL*, and their phone shows a big **SPIN** button.
   - Tap a player's card → **PUNISH NOW** to punish someone directly.
   - While the victim's phone shows SPIN:
     - the Medic can heal them;
     - the Jester can swap the victim;
     - everyone can send reactions (🍺 😈 🙏 😂).
   - After the reveal there's a 10-second *"ANY LAST WORDS…"* window (the Jester's re-spin chance). Then tap **ACCEPT**.
   - If the victim was healed, the TV shows **SAVED!** instead. Tap CONTINUE.
   - If someone's phone dies, use **SPIN FOR THEM**.
8. **Expose:** tap **EXPOSE** on a card. The server stamps their **real** role, so no mistakes are possible.
9. **Curse passes:** these pop up on the TV. APPROVE or REJECT.
10. At **01:00** the tally freezes and the TV shows who won. Then tap **🎭 REVEAL ALL ROLES**. It shows every role, the Lovebird pairs, any fake heals, and whether the Betrayer joined the Intruder.

### Checklist for the night
- [ ] Anonymous sign-ins ON in Supabase (phones can't join otherwise)
- [ ] Host account works on the party laptop and the room is created
- [ ] Role counts match your guest count, codes generated, cards printed, cut and sealed, plus a pen
- [ ] Deadline shows 01:00 (⚙ → Game & Deadline); target 100
- [ ] Jester and Intruder ability toggles set how you want. The Intruder fake heal is **OFF** by default.
- [ ] Laptop: charger plugged in, sleep/screensaver off, browser zoom 100%, full screen, sound up
- [ ] Wi-Fi password on the wall next to the QR code (phones need internet)
- [ ] A spare phone for anyone whose battery dies (or use SPIN FOR THEM)
- [ ] Hat of shame 🎩

---

## How it works

- **Frontend:** Vite + React + TypeScript (`src/`). `/tv` is the host screen, `/join` the phone, `/cards` the print page. The v1 look is reused: tally, milestones, countdown, canvas wheel with Web Audio ticks, stamps, Lovebird hearts and confetti. The original single file is kept in `legacy/index.html`.
- **Backend (Supabase):**
  - `supabase/migrations/*_schema.sql` creates the tables. RLS is on everywhere, with **no policies and no table grants** for `anon`/`authenticated`.
  - `*_logic.sql` holds all the game rules:
    - `api_exec(uid, action, args)` handles every change: roles, uses left, no self-heal, Betrayer guess limit, once-per-night Jester powers, cooldowns, host-only actions. Each action runs in one transaction with the room row locked. Only `service_role` can execute it.
    - `get_state(code)` is the only way to read data. It returns the public room state plus **only the caller's own secrets**: their role, their Lovebird partner's name, and their team-mate once the Betrayer succeeds. The host/TV view contains no secrets at all.
  - `supabase/functions/api`: the Edge Function checks the caller's session and calls `api_exec` with the verified user id. It's the only way clients can change anything.
  - **Realtime:** each change sends a broadcast "changed" ping on `room:<id>` (with no data), and clients re-fetch `get_state`. Clients also poll every 3 seconds, so a dropped connection or a sleeping phone always catches up. Emoji reactions are sent as broadcast messages.
  - **Storage:** the public `selfies` bucket. Photos are compressed on the phone to roughly 50 KB, and each user can only upload into their own folder.
- **Rulings where the brief left room:**
  - A heal is attached to the player it was cast on. If the Jester swaps the victim, the heal **stays with the original victim** for their next spin. It doesn't transfer.
  - A **fake heal** looks exactly like SAVED. The owed punishment is logged as "Fake heal! …" at the end-of-night reveal.
  - **Cursed** means two server-side spins. **Spin again, doubled** chains up to ×4. **Safe** logs nothing.
  - A wrong Betrayer guess logs a "Penalty drink" and shows *"NAME owes a drink"* on the TV, as specified. The accused is never told.

## Developing & tests

```bash
npm install
npm run dev                  # against the real Supabase project

# fully local (no Supabase needed): the same SQL runs in PGlite
npm run mock-server          # terminal 1
npm run dev:mock             # terminal 2 → http://localhost:5173/tv (any email/password)

npm run test:logic           # full game rules + secrecy checks against the SQL
npm run test:e2e             # 1 TV + 10 phones in Playwright (needs the two servers above)
```

To apply database changes, add a migration in `supabase/migrations/` and apply it with the Supabase CLI (`supabase db push`) or MCP. Redeploy the function with `supabase functions deploy api --no-verify-jwt` (the function checks the session itself).
