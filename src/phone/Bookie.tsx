// THE BOOKIE (phone): a cap bet on a summoned mini-game (Dodge, Walk the Plank, Jack-in-the-Box), for the people
// watching it. Every bet is 5 caps; the winners split the pot. Bets open when the game is called to the TV and close at
// GO (the server keeps both). One decision per screen: PICK → CHECK (YES arms after 0.6s) → BET IN · WATCH THE TV.
// The result waits until the TV's own reveal is over, the same hold the phones use for the game's queue rows.
import type { ReactNode } from 'react';
import type { Book, GameState, Player } from '../lib/types';
import { CapIcon, Key, Photo, PlayerRow, Row, type Outcome } from './kit';
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

/** The check question for one option: "BET 5 CAPS ON KAI?" / "BET 5 CAPS: KAI DODGES IT?" */
export function betAsk(s: GameState, book: Book, o: BetOption) {
  if (o.player_id) return `BET ${book.stake} CAPS ON ${(s.players.find(p => p.id === o.player_id)?.name ?? o.label).toUpperCase()}?`;
  const t = dodgeTarget(s, book);
  return `BET ${book.stake} CAPS: ${t ? t.name.toUpperCase() + ' ' : ''}${o.label}?`;
}

/** When this phone may show how the bet went: once the TV has finished the game's reveal. */
export function betResultAt(s: GameState, book: Book): number {
  const g = s.minigame?.id === book.game_id ? s.minigame : null;
  const end = miniRevealEnd(g);
  if (end) return end;
  return book.settled_at ? Date.parse(book.settled_at) + FALLBACK_MS[book.kind] : 0;
}

/** How your bet went (your own bet only; the copy is the same for every role). */
export function betOutcome(book: Book): Outcome {
  const stake = book.stake || 5;
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
        <div className="pu-small" style={{ color: 'var(--bone)' }}>Bet {book.stake} caps. Winners split the pot.</div>
      </div>
    </div>
    <div className="pu-small pu-center">Tap who you think. Bets close at GO.</div>
    {rows}
    <div className="pu-keys"><Key variant="ghost" icon="cross" className="pu-bet-skip" onClick={onSkip}>NOT BETTING</Key></div>
  </>);
}
