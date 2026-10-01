# Side bets for The Hundred: research and design

*1 Oct 2026. A research note, with no code changed. This is Roadmap feature #6 ("Side bets for spectators"), with #7 (end-of-night awards) folded in as the Bookie's Ledger.*
*Mockup sketch: [`mockup.html`](mockup.html) (phone flow and the TV strip).*

---

## 0. TL;DR

**Recommended MVP: "THE BOOKIE", one-tap side bets on the three summoned mini-games (Dodge, Walk the Plank, Jack-in-the-Box), plus one "Will we hit 100?" market for the whole night.**

- **Who bets:** everyone who isn't playing that game.
- **Stake:** a fixed **10 chips** per bet, one bet per market, no balance to manage.
- **Odds:** "**split the pot**" (parimutuel). The TV shows **only the count and the pot** while bets are open.
- **When betting closes:** the server closes it **in the same transaction that starts the game** (GO), so nothing can be placed late.
- **Drinking:** chips only, with **no drinking stakes by default**. A host toggle can turn on "losers take one sip".
- **End of night:** a **Bookie's Ledger** award.
- **Size:** two tables, one player action, about six hooks in the existing mini-game functions, and one phone screen reusing `PlayerRow`, `Check` and `Result`.

The wheel, the Trial, the Champ and Bomb/Penny bets come later or not at all, for the reasons below.

---

## 1. The finding that shapes everything: this game has fewer spectators than you'd think

From the server rules:

| Moment | Who's *in* it (code) | Spectators left (12 guests) |
|---|---|---|
| **Bomb** | `_mg_eligible`: **everyone** except the Angel and anyone in the Locker (rehab included) | 0–2 |
| **Penny Drop** | `_mg_eligible`: **everyone** | 0–2. Penny Drop **already is** a bet. |
| **The Trial** | `cast_vote`: everyone except rehab and the Locker (the Angel votes) | 0–3 (rehab, Locker) |
| **Champ / Slacker** | everyone (beer counts since the last game) | 0. Everyone is a runner. |
| **Dodge** | 1 target | **~11** |
| **Walk the Plank** | 3 walkers | **~9** |
| **Jack-in-the-Box** | 4 crankers | **~8** |
| **The wheel** | 1 victim (2 with Lovebirds) | **~10** |
| **"Will we hit 100?"** | it's about the whole group | everyone, as a *prediction* |

So the brief's list splits in two:
- **Real spectator moments:** Dodge, Plank, Jack, the wheel. The MVP goes here.
- **Moments where the "spectators" are also the players:** Bomb, Penny, Trial, Champ. Betting there means betting on something you can steer. That's match-fixing, or worse, a reason to drink faster. They need special handling, or should be skipped.

---

## 2. What to bet on, per moment

**Global rules for every market:**
1. **The game's players can't bet on it.** Participants are public, so excluding them leaks nothing.
2. **The person who started it *can* bet.** `started_by` is never sent anywhere. If the Kraken's, Pennywise's or Assassin's phone were the one phone with no bet button, a glance over the shoulder or a missing chip in the pool would give them away. That's only safe because **none of the starters knows the outcome**:
   - the pop number, the fuse and the coin are in `minigames.secret`;
   - the Kraken can't pick themselves for the plank;
   - the Assassin's one secret (the throw direction) is never a market (see Dodge).
3. **Only offer markets decided by server randomness or by a player's skill, never by hidden roles.** Any market whose answer depends on a hidden role is a free win for whoever holds that role (Saboteurs, the Detective, the Medic, the Skank).
4. **Close in the same server transaction as the moment that creates information.** Every action already locks the room row (`select … for update` in `_exec`), so a bet and `_mg_live` are strictly ordered. There is no "last-second" race to argue about.
5. **The TV shows only `n bets · pot`** while bets are open. This follows the Trial's existing `counts`-hidden-while-open, `voters`-count-live rule and Aaron's Plate's "? TAKEN" chips.

### Dodge (MVP)
- **Market:** **"DODGES IT" / "TAKES THE HIT"**. Two options, two huge keys.
- **Never offer "where's it coming from? L/H/R".** The Assassin knows `secret.dir`.
- **Open:** when `dodge_throw` creates the game (muster, "WANTED AT THE TV").
- **Close:** in `_mg_live`, when the status leaves `muster`. The target is checked in and the 3-2-1 starts.
- **Resolves:** in `_mg_settle` → `result.dodged`.
- **Void:** if the game is called off, or if it's a no-show (the result wasn't played; see Integrity).
- **TV while open:** the WANTED poster plus the bet strip (count and pot). Nothing about the direction.

### Walk the Plank (MVP)
- **Market:** **"WHO WALKS?"** Three mugshots, pick one.
- **Resolves:** you win if your pick is in `result.losers`. That's one, two or all three people, so the pot is split across every winning bettor.
- **Close:** in `_mg_live`.
- **TV:** unchanged. The plank already shows no positions until the reveal (the fairness rule). Bets closed at GO, so the shared-curve walk loses nothing.

### Jack-in-the-Box (MVP)
- **Market:** **"WHO POPS JACK?"** Four mugshots, in the **turn order**.
- `state.order` is public and shuffled at creation, so the order is real information. "Fourth in line is a safer bet" is a fun drunk heuristic and doesn't leak the pop number.
- **Close:** in `_mg_live`.
- **Resolves:** `result.popper`.
- **Later idea:** in-play "does the NEXT crank pop it?". The count is public, but the pop number is secret, so this is safe. It still adds a betting window inside a 15-second turn, which is too fiddly for now.

### The wheel (v1.1)
- **The trap:** landings are rolled in the `spin` action and shipped in `get_state` during `phase = 'spinning'`. **Phones receive the result while the TV is still animating.** A wheel market **must close in the `spin` transaction** (or earlier) and must show results only once `phase = 'revealed'`.
- **Market:** **"LET OFF?" (lands SAFE) / "PUNISHED"**. That's about 10% SAFE, a proper longshot.
  - Or an over/under on the number of logged punishments (1 vs 2+: "Spin again, doubled" or a Cursed double spin).
  - A cleaner "heat" over/under would need the host to tag each slice mild/medium/brutal. That's data the wheel doesn't have yet.
- **Settle on the FIRST reveal (`spin_seq = 1`), not on what's accepted.** Otherwise the Scrooge can bet, then **RE-SPIN, PEASANTS** until they win.
- **Medic heal → SAVED → void.** The Medic knew, but a void gives them nothing.
- **A forged heal** still spins, so it settles normally. The Forger never knows whose heal it was.
- **Angel's bless:** it edits `segments` publicly, but the Angel knows it's coming. Void any wheel market that's open when `blessed` fires, or simply bar the Angel from wheel markets.
- **Scrooge swap** changes the victim, not the landing, so it's irrelevant to a landing market.
- **Why not in the MVP:** the wheel happens 20+ times a night. A bet prompt on every spin becomes noise. When it ships, offer it only on **big spins** (×2 or more, Cursed, shivved, or Jester ×3).

### The Trial (later, gallery only)
- **The problem:** everyone who could bet also votes. A bet turns your ballot into a wager ("I bet NOT GUILTY, so I'll vote NO TRIAL"). That corrupts the deduction at the heart of the game.
- **Verdict markets ("GUILTY / NOT GUILTY") hand Saboteurs a free edge**, because they know who is guilty. That includes caught Saboteurs in rehab, who see their allies' list.
- **If wanted:** a **Gallery** market for non-voters only (rehab, the Locker, plus the Angel, who does vote and so arguably shouldn't bet). Market: **"WHO GETS THE MOST VOTES?"** That's about the room's mood, not roles. Ties void.
  - **Reveal:** each person sees only their own payout; nothing goes on the TV until `reveal_all`.
  - **Settle:** when the vote closes. Note that `close_vote` **is host-undoable**, so the markets must be in the undo snapshot (§6).
  - The audience is so small that it isn't worth it before 10 Oct.

### Bomb (not recommended)
- **Every eligible player holds the bomb at some point**, so there is no outside audience.
- If players could bet on "who's holding it at the boom", they'd pass it to their pick. `state.holder` and `from` are public and live, so this would be blatant steering.
- **The only clean variant:** a pre-roll ("bets close in 10s, then the bomb lands"). That delays a phone-only game and changes its feel. **Skip it.**
- **The fuse is never involved:** no market may mention time (for example "over/under 30s"), because the TV must never hint at it.

### Penny Drop (not recommended)
- Everyone already calls heads or tails. That *is* the bet, and losers already drink (`punishments kind='penalty'`).
- A spectator bet would be a 50/50 with 0–2 bettors.
- **Possible later twist:** "Over/under: half the room calls it wrong". Calls are secret until the result, so it's clean, but it's dull.

### Champ / Slacker (later, with guard rails)
- **Danger:** "who'll be Champ?" invites people to **bet on themselves and chug**.
- **Rules if it's added:**
  - **No self-bets.**
  - Bets **close when the game starts** (the window runs from the last game's end to this game's end), so most of the drinking happens after betting is locked.
  - **Chips only, never sips.**
- **Existing hard cap:** the 3-minute beer cooldown in `log_beer` limits anyone to 20 logged beers an hour, so even a colluding friend can't run away with it.
- **Never offer a Slacker market.** It rewards *not drinking* in a game about hitting 100, and it would be a cheap grief ("I bet on you, don't log").

### The deadline: "WILL WE HIT 100?" (MVP)
- **Market:** one per night. **"WE MAKE IT" / "WE DON'T"**.
- **Open:** the host taps "OPEN THE BOOK" (or it opens automatically at LET'S GO).
- **Close:** at a fixed time (default 23:00) or when the tally reaches 50, whichever comes first. Nobody can bet once the outcome is obvious.
- **Settle:** in `end_check`, on `result.winner`. That includes the Skank's hidden bonus.
- **Role edges, accepted:**
  - The Skank knows their bonus.
  - Saboteurs know they want a NO.
  - With chips only, that's flavour, not an exploit. A Saboteur betting NO privately is in character.
- **Reveal:** who bet what **only after REVEAL ALL ROLES**. A Drinker who bet "WE DON'T" would otherwise look like a Saboteur mid-game, and that becomes a new, accidental tell.
- **TV while open:** "THE BOOK IS OPEN · 9 BETS". **Never** the split, which would be a live mood poll of who's secretly a Saboteur.

---

## 3. Currency and stakes

| Option | Fun | Fair | Drinking risk | Verdict |
|---|---|---|---|---|
| **Sips as stake** (Horse Race style: bet N sips, losers drink them, winners hand theirs out) | High: it's the classic | Players with a high tolerance bet big | **High.** It stacks on the wheel, Penny Drop and the 100-beer goal. Handing sips out is also a targeting tool. | **No** as the default |
| **"Wrong guessers drink 1"** | Medium | Fine | Medium. Every market becomes a drink tax, and people stop betting. | Only as a host option |
| **Beer chips** (earn chips by logging beers) | Medium | Rewards heavy drinkers twice | **Bad.** Beers already buy drink levels and the Champ's golden ticket. A third incentive is too many. | **No** |
| **Fixed chips, no balance** (every bet is 10 chips; your score is net winnings) | Medium-high, with a ledger and an award | Equal for everyone, sober or not | None | **Yes (MVP)** |

**MVP stake model:**
- Each bet costs **10 chips** from a ledger that starts at **0** and can go negative. Nobody "runs out", so there's no "top up" screen.
- One bet per market, and no changing it (the `Check` arming screen is the commitment).
- **Ledger = Σ payout − Σ stakes.** The phone shows "+30" or "−10". The night's leader wins the Bookie's Ledger.

**Optional host toggle: "Losing bets cost a sip" (default OFF).**
- **Cap:** exactly **1 sip per lost market**. That's not a beer, and it's not a wheel punishment. A natural cap follows: roughly 3 summoned games a night plus one deadline market, so about 4 sips in the worst case.
- **Display:** shown as a phone notice only. **Not** written to `punishments`, so the TV card doesn't fill up. If it's ever logged, use Penny Drop's precedent: `punishments kind='penalty'`.
- **Never** applies to anyone in Davy Jones' Locker (they're "too pished" by definition) or to the Angel (the non-drinker). They bet chips only.
- **No "give out sips"** to other players. It turns betting into a way to bully the drunkest person in the room.

**What's the reward?** In the MVP, just bragging rights and the end-of-night award.
- Resist turning chips into game power (for example "1st place gets a golden ticket"). A Saboteur with role knowledge could farm it, and the Champ already owns the golden ticket.
- **Later (cosmetic only):** the ledger leader gets a top-hat badge on their TV card.

---

## 4. Odds: what a drunk person understands in 2 seconds

- **Fixed odds** (bookie sets ×3): the payout is easy to read, but someone has to price Dodge (about 60/40?) and the Plank (the furthest-back rule?). Wrong prices are exploitable, and nobody will check the maths at 00:30.
- **Parimutuel** (tote, as in Twitch Predictions): self-balancing and needs no pricing. Twitch shows a **live** ratio and percentage split, as in ["33%/67% → 3:1 vs 1.5:1"](https://link.twitch.tv/ChannelPointsPredictions). **We can't**, because a live split causes herding and breaks the counts-only rule.
- **With a fixed 10-chip stake, parimutuel collapses to the simplest rule there is:**

  > **The pot is split between everyone who called it.**
  > 7 bets → pot 70. Two of you called it → each gets 35 back, so **net +25**. The phone and the ledger show net.

- Rounding: round down to whole chips. The house keeps the crumbs.
- If **nobody** called it: void, and everyone gets their stake back. The phone says "NOBODY CALLED IT · STAKE BACK".
- **What the screens say:**
  - **While open:** "7 BETS · 70 IN THE POT". No odds anywhere.
  - **At the result:** "**×3.5**" in a black disc, the multiplier stamped on the winning option (the Quiplash score-disc look, `design/research/party/04`).
- That's two numbers, both readable at a glance. **Recommend parimutuel with a fixed stake.**

**"Wrong guessers drink 1"** is a reasonable *alternative* for the host toggle above. It's not a replacement for chips, because it has no upside.

---

## 5. Integrity and cheating

| Threat | Example | Fix (server-enforced) |
|---|---|---|
| **Betting on your own game** | The Dodge target bets HIT, then guesses wrong. A Jack cranker bets on themselves, then cranks 3. | `markets.excluded` = the game's `players`. `bet` raises `You're in this one`. |
| **Betting on the outcome you steer** | Bomb holders, Trial voters, Champ runners | Don't open those markets (§2). The Gallery and Champ variants have exclusions. |
| **Role knowledge** | The Assassin knows the throw; Saboteurs know who's guilty; the Medic knows a heal; the Skank knows the bonus | Never offer direction or verdict markets. A SAVED wheel is void. Settle on the first spin. The deadline market's edge is accepted (chips only). |
| **Starter identity leak** | Barring the Kraken would reveal the Kraken | Don't bar starters. None has outcome info (checked per game in §2). |
| **Bets leaking secrets after the result** | "Dave bet WE DON'T", so Dave's a Saboteur? | Mini-game markets: winners' mugshots may show (random or skill outcomes). Deadline and Trial: own result only until `reveal_all`. |
| **Last-second bets** | Betting after seeing who's checked in late, or after landings reach phones | Close **inside** `_mg_live` and the `spin` transaction. The room-row lock makes them strictly ordered. The phone greys out 1s early (wifi), but the **server is the truth**: `bet` re-checks `market.status = 'open'` **and** the subject's own phase (`minigames.status = 'muster'`, `rounds.phase = 'waiting'`). |
| **Seeing who's missing** | At 89s, bet that the no-show "loses" | **No-show → void.** Also close the market when `muster_until` passes (`mg_tick` sets `waiting_host`). |
| **Collusion** | A friend throws a game for your bet | Players can't bet, so only a participant could throw it, and that costs them the wheel. The stakes are 10 chips of bragging rights. Not worth it. |
| **Sock puppets** | A second phone farming chips | Same rule as votes and beers: `me.has_role` required. One card, one phone. |
| **Spamming** | 50 taps | `unique(market_id, player_id)` plus a `Key` 600ms guard. A repeat returns `quiet`. |
| **Host undo** | Undo `call_next` after a wheel market opened, or undo `close_vote` after the Trial settled | See §6: add the tables to `_snapshot` or void orphans, and settle only on non-undoable paths in the MVP. |

**Rehab players can bet.** They're out of the vote and powerless, so this is a reason for them to stay engaged. The MVP markets don't touch role knowledge, so their knowing their allies doesn't matter.

**Locker players can bet chips.** It keeps them included at their own pace, with no sips.

---

## 6. Data model and server functions (sketch, following the existing patterns)

```sql
-- the book: one market per moment
create table if not exists public.markets (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  kind        text not null check (kind in ('dodge','plank','jack','wheel','deadline','gallery','champ')),
  subject_id  uuid,                          -- minigames.id / rounds.id / votes.id / games.id; null = the night (deadline)
  status      text not null default 'open' check (status in ('open','closed','settled','void')),
  options     jsonb not null,                -- [{"id":"dodged","label":"DODGES IT"}] or [{"id":"<player uuid>","player":true}]
  excluded    uuid[] not null default '{}',  -- the game's players: can't bet
  closes_at   timestamptz,                   -- a backstop; the real close is the hook in the subject's own transition
  winners     text[],                        -- winning option ids (settled)
  result      jsonb,                         -- {pot, n, split:{opt:n}, mult, void_reason}
  created_at  timestamptz not null default clock_timestamp(),
  settled_at  timestamptz
);
create table if not exists public.bets (
  id         bigint generated always as identity primary key,
  market_id  uuid not null references public.markets(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  option     text not null,
  stake      int  not null default 10,
  payout     int,                            -- null until settled; = stake on void
  created_at timestamptz not null default clock_timestamp(),
  unique (market_id, player_id)
);
-- same lock-down as everything else (the roadmap flags minigames for missing this)
alter table public.markets enable row level security; alter table public.bets enable row level security;
revoke all on public.markets, public.bets from public, anon, authenticated;
```

**Helpers:**

| Function | What it does |
|---|---|
| `_mk_open(room, kind, subject, options, excluded, closes_at)` | Inserts the market; `_event(room,'book_open',{market,kind})`. |
| `_mk_close(subject)` | `update markets set status='closed' where subject_id = … and status='open'`; `_event('book_closed')`. |
| `_mk_settle(market, winners text[])` | `pot = sum(stake)`, `w = count of winning bets`. If `w = 0`, refund (void). Otherwise each winner gets `floor(pot / w)`; losers get `payout = 0`. Writes `result`; `_event('book_settled', {market, winners_n, mult})`. |
| `_mk_void(subject, reason)` | Refunds every stake and sets `status='void'`. |

**Hooks into existing code (MVP):**

| Where | Hook |
|---|---|
| `_a_mini`, after `dodge_throw` / `plank_start` / `jack_start` insert | `_mk_open(…, excluded := g.players)` |
| `_mg_live` | `_mk_close(g.id)`. **This is the close at GO, in the same transaction.** |
| `mg_tick` muster branch, where it sets `waiting_host` | `_mk_close(g.id)` |
| `_mg_finish` | Settle from `p_result`: `dodged`, `losers`, `popper`. **If `p_result ? 'no_show'`, void.** |
| `mg_decide` call-off branch | `_mk_void(g.id,'called_off')` |
| `end_check` | Settle the deadline market on `result.winner` |
| New host action `book_open_deadline` (or automatically at LET'S GO) | Opens the deadline market |
| Deadline close | **The real gate is `bet`'s own `now() < closes_at` check.** `mg_tick` only runs during a live mini-game, so to flip the TV's "BOOK OPEN" chip on time, also close the market lazily in `log_beer` (that's also where the tally-50 rule lives) and in `get_state`'s view (`status = 'open' and now() < closes_at`). |

**The player action `bet`** (new group `_a_book`, dispatched from `_exec`):
- **Checks, in this order:**
  1. The market is in this room, `status = 'open'` and `now() < coalesce(closes_at, 'infinity')`.
  2. **The subject is still in its open phase:**
     - Dodge, Plank, Jack: `minigames.status = 'muster'` and not `waiting_host`;
     - wheel: `rounds.phase = 'waiting'`.
  3. `me.has_role` is true, the room hasn't ended, and `me.id <> all(excluded)`.
  4. The option is one of `options`, and isn't `me.id` (Champ).
- **Insert:** `on conflict do nothing`. A repeat returns `{"ok":true,"no_touch":true}` (quiet).
- **On success:** touch, so the TV's count ticks up. The count is public by design.

**Three snags in `_exec`/undo:**
1. `_exec` marks **every** non-host action as blocking undo (`update undo_log set blocked = true … if not v_host and p_action <> 'log_beer'`). Without an exemption, **every bet would kill the host's UNDO**. Add `'bet'` to the exemption, like phone beers.
2. **`_restore` deletes and re-inserts `players`** (along with `games`, `rounds`, `votes` and the rest it lists). So with `bets.player_id … on delete cascade` as sketched above, **any host UNDO would wipe every bet of the night.** Markets whose subject row is restored under the same id would survive, but bets wouldn't. `minigames` lives outside the snapshot with `started_by … on delete set null`, and that's the existing pattern to copy.
   - **MVP fix (pick one):**
     - Add `markets` and `bets` to `_snapshot`/`_restore`, and carry bets placed since the snapshot over the restore, the way phone beers are carried.
     - Or drop the FK cascade: store `player_id uuid` with no `on delete cascade`, or use `on delete set null` like `minigames`. **Note:** with `set null`, the restore's delete would null every bettor; storing a plain uuid with no FK is the simplest safe choice.
   - **Settle only on non-undoable paths** in the MVP. Mini-game results and `end_check` are not in the host-undo list.
   - After `_restore`, void any open market whose subject no longer exists or isn't in its open phase (for example, undo `call_next` leaves a wheel market on a vanished round).
   - **v1.1** (wheel via `accept`/`call_next`; Gallery via `close_vote`): these settle on host-undoable actions, so they need the full snapshot integration.
3. `bet` must **not** appear in `_ability_hold`. Betting never holds or waits for the stage.

**`get_state` additions** (a `book` key, built like `vote` and `plate`):

```jsonc
"book": {                                 // the latest open market, or one settled in the last ~25s (like minigame)
  "id", "kind", "status", "options", "closes_at", "excluded",
  "n": 7, "pot": 70,                      // public, live
  "mine": {"option": "…", "payout": 35},  // the caller's own bet only
  "split":   /* only when settled/void */ {"opt": n},
  "winners": /* settled AND kind in (dodge,plank,jack,wheel) */ ["player ids of winning bettors"],
  "mult": 3.5
},
"me": { …, "ledger": 25 },                // own net only
"ledger": /* only after r.revealed */ [{"player_id", "net", "bets", "best"}]
```

**The host/TV view gets the same `n` and `pot` and no `mine`, so it contains nothing the TV can't show.** The `split` and `winners` keys are absent while open, not just empty.

**Events:** `book_open`, `book_closed`, `book_settled`, `book_void`. The TV keys its sounds off these, like `mg_live`/`mg_done`.

---

## 7. UX

### Phone (`PhoneHome`, after the existing takeovers)

**Priority:** spinning and voting stay at the top of `PhoneHome`'s takeover order, as now; Jester's revenge, Aaron's Plate and the rest of the existing order follow. **A bet comes after all of those and never covers a required action.** A drunk thumb must never be stuck behind a bet. The mini-game's players never see it.

1. **NOW strip** (`pu-now`): "SIDE BET · WHO WALKS THE PLANK? · 0:41". For a summoned game this is a gentle takeover: the bet screen opens, and a ghost key underneath says **NOT BETTING**. Anything else stays a strip.
2. **Pick** (one idea per screen):
   - **Player markets:** `PlayerRow` mugshots (80px). Jack lists them in turn order with "1ST", "2ND"…
   - **Binary markets:** two `Key lg` buttons ("DODGES IT" / "TAKES THE HIT"), each with an icon as well as a colour.
   - The `Row` slot has a `Seg` countdown.
3. **Arm** (`Check`): the face plus **"KAI WALKS THE PLANK?"**, the cost "10 chips. No changing it.", and **YES, BET 10** with the existing 0.6s in-key arming fill.
   - This is exactly the memory rule "check screen, not undo".
4. **Bet in** (a `Result` with `tone:'wait'`): "BET IN · WATCH THE TV". If the server answers "closed", the screen says "TOO LATE · THE GAME STARTED" and no stake is taken.
5. **Result**, after the TV reveal, never before.
   - **Timing trap:** `_mg_finish` writes `minigames.result` (and would settle the market) in one transaction, and **`result` reaches every phone at once**, while the TV spends seconds on its reveal (the Plank's camera drop, the Jack pop, the Dodge cut-in). A phone saying "CALLED IT, Kai went over" before the camera drops would spoil the moment for the whole room.
   - **Fix:** the phone holds the bet result until `finished_at` plus a per-kind reveal length. Take the lengths from the TV scenes' own timelines.
   - Add a UI check for this to the e2e run.
   - **Always show net, the same number the ledger uses:**
     - **ok:** "CALLED IT · +25 · ×3.5";
     - **no:** "NOT THIS TIME · −10";
     - **void:** "CALLED OFF · STAKE BACK";
     - **everyone picked the winner** (pot ÷ winners = 10, net 0): "EVERYONE CALLED IT · STAKE BACK", never "+10 chips" for nothing;
   - plus a "Your book: +25 tonight" fact.
   - It auto-returns after 5s.
   - **Wheel (v1.1):** gate the result on `round.phase = 'revealed'`, because the phone has the landings early.

### TV

- **The bet strip** (a ticket-stub bar at the bottom of the WANTED poster): **"THE BOOKIE · 7 BETS · 70 IN THE POT · CLOSES AT GO"**.
  - Chips stack up as bets arrive, with one sound per bet (like Penny's `countTick`).
  - **No per-option counts, no names, no faces.**
- **At GO:** a rubber stamp "BETS CLOSED" slams onto the stub. That gives the room a visible cutoff and fits the noir stamps.
- **After the game's own reveal** (never on top of it; wait until the scene has finished):
  - the stub flips to **"3 CALLED IT · ×3.5"**;
  - the winners' mugshots slide in under the disc (mini-game markets only);
  - the split bar appears.
  - The deadline market's split and names wait for REVEAL ALL.
- **Main board:** a small "BOOK OPEN · 9" chip near the tally while the deadline market is open. That's the count only.

### End of night: the Bookie's Ledger (after REVEAL ALL ROLES)
A manila "LEDGER" page in the case-file style:
- **THE BOOKIE:** the best net (top hat).
- **THE MUG:** the worst net.
- **THE LONGSHOT:** the biggest single ×.
- **THE ORACLE:** called the deadline right and won the most mini-game bets.
- Below: the deadline market's full split, now safe to show.
- This can share the screen with the roadmap's #7 awards.

---

## 8. Recommended scope

### MVP before 10 Oct: small and robust (about a day of work plus tests)
1. The `markets` and `bets` tables, revoked.
2. `_mk_open`, `_mk_close`, `_mk_settle`, `_mk_void`, and the `bet` action with the checks above.
3. The undo-block exemption, and voiding orphan markets after `_restore`.
4. Hooks in Dodge, Plank and Jack (open at muster, close in `_mg_live`/`waiting_host`, settle in `_mg_finish`, void on call-off or no-show).
5. The deadline market: host taps OPEN THE BOOK; it closes at 23:00 or a tally of 50; it settles in `end_check`; the reveal comes after `reveal_all`.
6. `get_state.book`, plus `me.ledger`.
7. Phone: the bet screen with `PlayerRow`/two keys → `Check` → wait → `Result`.
8. TV: the stub strip on the mini-game overlay, the BETS CLOSED stamp, the result flip.
9. The Bookie's Ledger card in the reveal.
10. `test:logic` cases:
    - a participant can't bet;
    - a bet after `_mg_live` is refused;
    - **the TV state never contains `split` or `winners` while open**;
    - the pot maths;
    - a void refunds;
    - a no-show voids;
    - a bet doesn't block undo.
11. The Test Lab: a "TV moments" demo of the strip.

**Leave out of the MVP:** sips (keep the toggle off, or don't build it), the wheel, the Trial, the Champ, Bomb and Penny.

### Later
- **The wheel's "LET OFF?" market**, on big spins only (the rules in §2).
- **The Gallery Trial market** (non-voters only), with snapshot integration.
- **A Champ market**: no self-bets, closes at game start.
- **In-play Jack:** "does the next crank pop it?"
- **The Bookie role** (already on the roadmap as a new role): a Chaos card who **sets the odds** (fixed odds that beat the pot). They secretly win the house's crumbs and are trying to finish with the most chips. The Bookie also gets one "fix" a night: they see one market's live split.
- **Markets/props the host types** ("Will Aaron eat the sausage?") with host-settled results. This is risky (the host knows), so make it an opt-in "house props" mode.
- **A Last Orders auction** (roadmap mini-game) that spends Ledger chips.

---

## 9. Risks and open questions for the host

1. **Chips only, or a sip toggle?** We recommend chips only on the night. If you want sips: 1 per lost market, never Locker or Angel, no handing out.
2. **Gentle takeover or strip only?** A takeover gets more bets but costs one extra tap ("NOT BETTING") for every spectator, three times a night.
3. **Should winners' faces show on the TV?** It's fun ("CALLED IT"), and harmless for random or skill games. Say no if you'd rather keep all betting private.
4. **The deadline market's close:** 23:00, a tally of 50, or the first game's end?
5. **Is the deadline market's role edge OK?** The Skank knows the bonus, and Saboteurs know their aim. That's fine with chips. With sips, cut the market.
6. **Does betting distract from the deduction?** Every bet is made by someone *not* in the moment. The bigger risk is phones staying out during the walk to the TV. This works both ways: spectators who watch the TV will also see the players' nerves.
7. **Wifi lag at the close:** a bet sent at 0:00.4 will often be refused. The phone must say "TOO LATE", not show an error.
8. **Undo edge cases:** only mini-games and `end_check` settle in the MVP, so host undo can't unwind a payout. Anything settled on `close_vote`/`accept` needs the snapshot work first.
9. **Apply the SQL to Supabase.** As with every batch, Netlify is front end only (roadmap note).
10. **Load:** one more `get_state` key and a touch per bet means about 10 extra refreshes per game. That's negligible next to the 3-second poll.

---

## Research notes

- **Twitch Channel Points Predictions:** parimutuel, 2–10 outcomes, winners split the losing pool pro rata, and the ratio is shown live (33/67 → 3:1 and 1.5:1). We take the pot-split mechanic but **not** the live ratio. ([Twitch](https://link.twitch.tv/ChannelPointsPredictions))
- **Jackbox Bracketeering:** a "prediction table" before each round, with coins for calling the winning answer, and an audience whose votes count the same as players'. Players can bet on an opponent while voting for themselves. **That conflict is exactly why we keep Trial voters out of Trial bets.** ([Jackboxpedia](https://jackbox.wiki/wiki/Bracketeering), [Jackbox fandom wiki](https://jackboxgames.fandom.com/wiki/Bracketeering))
- **The Horse Race drinking game:** bet N sips on a suit; losers drink their sips, winners hand theirs out. It's fun, but stakes grow without limit, and handing sips out lets people target the drunkest. We keep "one tap, one fixed stake", drop the sip stakes and drop the handing out. ([Wikipedia](https://en.wikipedia.org/wiki/Horserace_(drinking_game)), [Drinking Games Bible](https://drinkinggamesbible.com/horse-race-drinking-game/))
- **Sports-betting UX:** a bet slip, then confirm, then "bet placed" with a reference. Fixed odds come in three formats (fractional, decimal, American), which are unreadable drunk. We use the **×N multiplier**, which is also how Twitch presents its ratios.
- **Precedents in this codebase:**
  - Trial `counts` are hidden while open, with only the `voters` count live;
  - Aaron's Plate shows "? TAKEN" chips;
  - Penny Drop's `punishments kind='penalty'`;
  - the Plank's "nobody's position until the reveal";
  - `no_touch` for quiet moves;
  - the `Check` arming YES.
