// THE BOOKIE (phone): a cap bet on a summoned mini-game (Dodge, Walk the Plank, Jack-in-the-Box), for the people
// watching it. You bet 5, 10, 20 or all your caps; the winners share the pot in proportion to their stakes. Bets open when
// the game is called to the TV and close at GO (the server keeps both). One decision per screen:
// PICK → HOW MANY CAPS → CHECK (YES arms after 0.6s) → BET IN · WATCH THE TV.
// The result waits until the TV's own reveal is over, the same hold the phones use for the game's queue rows.
import { useState, type ReactNode } from 'react';
import type { Book, GameState, Player } from '../lib/types';
import { CapIcon, Facts, Key, Photo, PlayerRow, Row, type Fact, type Outcome } from './kit';
import { miniRevealEnd } from './PhoneGames';

export type BetOption = Book['options'][number];
/** If the game isn't on this phone any more, how long after settling to wait for the TV (its reveal). */
const FALLBACK_MS: Record<Book['kind'], number> = { dodge: 7000, plank: 16000, jack: 7000 };

/** The one being thrown at (Dodge has only them; the book's options are DODGES IT / TAKES THE HIT). */
export const dodgeTarget = (s: GameState, book: Book) =>
  s.minigame?.id === book.game_id ? s.players.find(p => p.id === s.minigame!.players[0]) ?? null : null;

export function betTitle(s: GameState, book: Book) {
  if (book.kind === 'plank') return 'WHO WALKS THE PLANK?';
  if (book.kind === 'jack') return 'WHO POPS JACK?';
  const t = dodgeTarget(s, book);
  return `DOES ${t ? t.name.toUpperCase() : 'THEY'} DODGE IT?`;
}

/** Who or what the pick is, in caps: "KAI" / "TOM DODGES IT" */
export function betPickName(s: GameState, book: Book, o: BetOption) {
  if (o.player_id) return (s.players.find(p => p.id === o.player_id)?.name ?? o.label).toUpperCase();
  const t = dodgeTarget(s, book);
  return `${t ? t.name.toUpperCase() + ' ' : ''}${o.label}`;
}

/** The check question for one option: "BET 10 CAPS ON KAI?" / "BET 10 CAPS: TOM DODGES IT?" */
export function betAsk(s: GameState, book: Book, o: BetOption, stake: number) {
  return o.player_id ? `BET ${stake} CAPS ON ${betPickName(s, book, o)}?` : `BET ${stake} CAPS: ${betPickName(s, book, o)}?`;
}

/** The stake keys: 5, 10, 20 (the ones you can afford) and ALL IN when it's more than the biggest of those. */
export function stakeChoices(caps: number, min = 5): { n: number; label: string }[] {
  if (caps < min) return [];
  const steps = [5, 10, 20].filter(n => n >= min && n < caps);
  return [...steps.map(n => ({ n, label: `${n} CAPS` })), { n: caps, label: `ALL IN · ${caps}` }];
}

/** When this phone may show how the bet went: once the TV has finished the game's reveal. */
export function betResultAt(s: GameState, book: Book): number {
  const g = s.minigame?.id === book.game_id ? s.minigame : null;
  const end = miniRevealEnd(g);
  if (end) return end + 700;                      // just after the TV's CALLED IT banner
  return book.settled_at ? Date.parse(book.settled_at) + FALLBACK_MS[book.kind] : 0;
}

/** How your bet went (your own bet only; the copy is the same for every role). */
export function betOutcome(book: Book): Outcome {
  const stake = book.mine?.stake ?? book.stake ?? 5;
  if (book.status === 'void') return { tone: 'wait', kicker: 'CAPS BACK', title: 'CALLED OFF', line: `The game was called off. Your ${stake} caps are back.`, back: 'OK', count: 5 };
  if (!book.winners?.length) return { tone: 'wait', kicker: 'CAPS BACK', title: 'NOBODY CALLED IT', line: `Nobody got it right, so everyone gets their ${stake} caps back.`, back: 'OK', count: 5 };
  const won = !!book.mine && (book.winning ?? []).includes(book.mine.option);
  if (won) {
    const n = Math.max(0, (book.mine!.payout ?? stake) - stake);
    return { tone: 'ok', kicker: `+${n} CAPS`, title: 'CALLED IT', line: `You called it. ${n ? `+${n} caps on top of your ${stake} back.` : `Your ${stake} caps are back.`}`, back: 'OK', count: 5 };
  }
  return { tone: 'no', kicker: `−${stake} CAPS`, title: 'NOT THIS TIME', line: `Your pick didn't come in. The ${stake} caps are gone.`, back: 'OK', count: 5 };
}

/** The server's refusal, in plain words. "Bets are closed" becomes TOO LATE · IT STARTED. */
export function betRefused(msg: string): Outcome {
  if (/closed|started|too late/i.test(msg)) return { tone: 'no', kicker: 'TOO LATE', title: 'IT STARTED', line: 'Bets closed at GO. No caps were taken.', back: 'OK', count: 5 };
  return { tone: 'no', kicker: 'NO BET', title: "DIDN'T GO THROUGH", line: msg, back: 'OK', count: 5 };
}

/** Step 1: pick an outcome, or NOT BETTING. */
export function BetPick({ s, book, caps, onPick, onSkip }: { s: GameState; book: Book; caps?: number | null; onPick: (o: BetOption) => void; onSkip: () => void }) {
  const target = book.kind === 'dodge' ? dodgeTarget(s, book) : null;
  const byId = (id?: string) => s.players.find(p => p.id === id);
  const rows: ReactNode = book.kind === 'dodge'
    ? <>
        {target && <div className="pu-bigface pu-bet-face"><Photo p={target} /><div className="cap">{target.name}</div></div>}
        <div className="pu-bet-keys">
          {book.options.map(o => <Key key={o.id} lg variant={o.id === 'hit' ? 'red' : ''} className="pu-bet-opt" onClick={() => onPick(o)}>{o.label}</Key>)}
        </div>
      </>
    : <div className="pu-list pu-bet-list">{book.options.map(o => {
        const p: Player | undefined = byId(o.player_id);
        return p ? <PlayerRow key={o.id} p={p} onPick={() => onPick(o)} />
          : <Key key={o.id} lg className="pu-bet-opt" onClick={() => onPick(o)}>{o.label}</Key>;
      })}</div>;
  return (<>
    <Row title="THE BOOKIE" sub={`${book.n} bet${book.n === 1 ? '' : 's'} in`} slot={typeof caps === 'number' ? <span className="pu-chip pu-bet-chip"><CapIcon size={20} />{caps}</span> : undefined} />
    <div className="pu-bet-head">
      <CapIcon size={64} />
      <div>
        <div className="pu-h1">{betTitle(s, book)}</div>
        <div className="pu-small" style={{ color: 'var(--bone)' }}>Bet {book.stake} caps or more. Winners share the pot.</div>
      </div>
    </div>
    <div className="pu-small pu-center">Tap who you think. Bets close at GO.</div>
    {rows}
    <div className="pu-keys"><Key variant="ghost" icon="cross" className="pu-bet-skip" onClick={onSkip}>NOT BETTING</Key></div>
  </>);
}

/** Step 2: how many caps. One decision: 5, 10, 20 or ALL IN (only what you can afford). */
export function BetStake({ pick, caps, min, onStake, onBack }: { pick: string; caps: number; min: number; onStake: (n: number) => void; onBack: () => void }) {
  const choices = stakeChoices(caps, min);
  return (<>
    <Row onBack={onBack} title="THE BOOKIE" sub={`You have ${caps} caps`} slot={<span className="pu-chip pu-bet-chip"><CapIcon size={20} />{caps}</span>} />
    <div className="pu-bet-head">
      <CapIcon size={64} />
      <div>
        <div className="pu-h1">HOW MANY CAPS?</div>
        <div className="pu-small" style={{ color: 'var(--bone)' }}>On {pick}. Bet more, win a bigger share.</div>
      </div>
    </div>
    <div className="pu-keys pu-stake-keys">
      {choices.map(c => <Key key={c.n} lg variant={c.label.startsWith('ALL IN') ? 'red' : ''} className="pu-stake" onClick={() => onStake(c.n)}>{c.label}</Key>)}
    </div>
  </>);
}

/** A little pyramid of caps (top row first): the bigger stake's pile is twice the size, no numbers. */
const CapPile = ({ rows }: { rows: number[] }) => (
  <span className="pu-bx-pile">{rows.map((n, r) => <span key={r}>{Array.from({ length: n }, (_, k) => <CapIcon key={k} size={30} />)}</span>)}</span>
);

/** THE BOOKIE IS OPEN, on the phone: 3 cards, once, on the TV's CHECK YOUR PHONE beat (design/research/betting/
 *  unlock-findings.md §4). One key moves on (no swipes, no auto-advance; the key ignores a second tap for 600 ms); the
 *  stake tokens are flat so nobody mistakes them for buttons. The same on every phone: no roles, players or caps. */
export function BookieExplainer({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const cards: { art: ReactNode; h1: string; body: string; facts?: Fact[]; key: string }[] = [
    { art: <div className="pu-bx-open"><span className="pu-bx-tin">OPEN</span><CapIcon size={110} /></div>,
      h1: 'THE BOOKIE IS OPEN', body: "When someone's called to the TV for a mini-game, everyone else can bet caps on how it goes.", key: 'HOW DO I BET?' },
    { art: <div className="pu-bx-tokens">{['5', '10', '20', 'ALL IN'].map(t => <span key={t}>{t}</span>)}</div>,
      h1: 'PICK IT. STAKE IT.', body: 'A bet pops up on your phone. Pick who or what, then 5, 10, 20 or ALL IN (whatever you can afford). Bets close at GO.',
      facts: [{ icon: 'cross', text: 'Not feeling it?', small: 'Tap NOT BETTING.' }], key: 'AND IF I WIN?' },
    { art: <div className="pu-bx-split"><div><span className="pu-bx-stub"><CapIcon size={34} /><CapIcon size={34} /></span><CapPile rows={[1, 2, 3]} /></div>
        <div><span className="pu-bx-stub"><CapIcon size={34} /></span><CapPile rows={[1, 2]} /></div></div>,
      h1: 'CALL IT, SPLIT THE POT', body: 'Everyone who called it shares the whole pot. Bigger bet, bigger share.',
      facts: [{ icon: 'swap', text: 'Nobody called it?', small: 'Everyone gets their caps back.' }, { icon: 'pint', text: 'No drinks at stake.', small: 'Relax.' },
        { icon: 'eyeoff', text: 'Your caps stay on your phone.', small: 'Never on the TV.' },
        { icon: 'ticket', text: 'The caps shop is open too.', small: 'YOUR MOVES → CAPS SHOP.' }], key: 'GOT IT' },
  ];
  const c = cards[i];
  return (<>
    <Row onBack={i ? () => setI(i - 1) : undefined} title="THE BOOKIE" sub={`${i + 1} of 3`} />
    <div className="pu-bx-art" aria-hidden="true">{c.art}</div>
    <div className="pu-h1 pu-center">{c.h1}</div>
    <div className="pu-body pu-center pu-c-bone2">{c.body}</div>
    {c.facts && <Facts facts={c.facts} />}
    <div className="pu-keys"><Key lg className="pu-ok" onClick={() => (i < 2 ? setI(i + 1) : onDone())}>{c.key}</Key></div>
  </>);
}
