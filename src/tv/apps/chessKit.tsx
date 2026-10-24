// TAG TEAM CHESS, shared by the TV board and the phones (src/styles/chess.css, class prefix tc-): the position from a
// FEN, the pieces (U+265A-F + U+FE0E in 'Noto Sans Symbols 2': the filled glyphs for both sides, white in light ink
// with a dark outline), the board, the clocks and the captured pieces, plus a small move maker for the phone's check
// screen. The server is the referee: this only draws what a move from its legal list will look like.
import type { CSSProperties } from 'react';
import type { ChessGame } from '../../lib/types';
import '../../styles/chess.css';

export type Side = 'w' | 'b';
export type Pos = Record<string, string>;                  // 'e4' -> 'P' (upper case white, lower case black)
export type ChessMove = ChessGame['moves'][number];

const FILES = 'abcdefgh';
export const GLYPH: Record<string, string> = { k: '♚︎', q: '♛︎', r: '♜︎', b: '♝︎', n: '♞︎', p: '♟︎' };
export const PIECE_NAME: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const SIDE_NAME = { w: 'white', b: 'black' } as const;
export const isWhitePc = (pc: string) => pc === pc.toUpperCase();
export const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');
export const glyphOf = (name: string) => GLYPH[name === 'knight' ? 'n' : name[0]] ?? '';

export function parseFen(fen: string): Pos {
  const pos: Pos = {};
  fen.split(' ')[0].split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { pos[FILES[f] + (8 - i)] = ch; f += 1; } }
  });
  return pos;
}

/** The 64 squares top-left to bottom-right as this viewer sees them (black's phones turn the board round). */
export const squaresFor = (flip: boolean) => {
  const out: string[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) out.push(flip ? FILES[7 - c] + (r + 1) : FILES[c] + (8 - r));
  return out;
};
const xy = (sq: string, flip: boolean) => {
  const f = FILES.indexOf(sq[0]), r = +sq[1];
  return flip ? { x: 7 - f, y: r - 1 } : { x: f, y: 8 - r };
};
const isLight = (sq: string) => (FILES.indexOf(sq[0]) + +sq[1]) % 2 === 0;     // a1 is dark, h1 light

/** The position after a legal move: castling moves the rook too, en passant takes the pawn beside, a pawn on the last
 *  rank becomes the piece named (a queen when none is). */
export function applyMove(pos: Pos, uci: string): Pos {
  const p = { ...pos };
  const from = uci.slice(0, 2), to = uci.slice(2, 4), pc = p[from];
  if (!pc) return p;
  const kind = pc.toLowerCase(), white = isWhitePc(pc);
  if (kind === 'p' && from[0] !== to[0] && !p[to]) delete p[to[0] + from[1]];
  if (kind === 'k' && Math.abs(FILES.indexOf(to[0]) - FILES.indexOf(from[0])) === 2) {
    const ks = to[0] === 'g', rf = (ks ? 'h' : 'a') + from[1], rt = (ks ? 'f' : 'd') + from[1];
    if (p[rf]) { p[rt] = p[rf]; delete p[rf]; }
  }
  delete p[from];
  const promo = uci[4] || (kind === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : '');
  p[to] = promo ? (white ? promo.toUpperCase() : promo.toLowerCase()) : pc;
  return p;
}

/** Is `sq` attacked by white (byWhite) or black? (For the CHECK tag on the phone's check screen.) */
export function attacked(pos: Pos, sq: string, byWhite: boolean): boolean {
  const f = FILES.indexOf(sq[0]), r = +sq[1];
  const at = (df: number, dr: number) => { const ff = f + df, rr = r + dr; return ff >= 0 && ff < 8 && rr >= 1 && rr <= 8 ? FILES[ff] + rr : null; };
  const is = (s: string | null, kinds: string) => { const pc = s ? pos[s] : undefined; return !!pc && isWhitePc(pc) === byWhite && kinds.includes(pc.toLowerCase()); };
  const pr = byWhite ? -1 : 1;                              // a white pawn attacks from the rank below
  if (is(at(-1, pr), 'p') || is(at(1, pr), 'p')) return true;
  if ([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].some(([a, b]) => is(at(a, b), 'n'))) return true;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => is(at(a, b), 'k'))) return true;
  const ray = (dirs: number[][], kinds: string) => dirs.some(([a, b]) => {
    for (let k = 1; k < 8; k++) { const s = at(a * k, b * k); if (!s) return false; const pc = pos[s]; if (pc) return isWhitePc(pc) === byWhite && kinds.includes(pc.toLowerCase()); }
    return false;
  });
  return ray([[1, 0], [-1, 0], [0, 1], [0, -1]], 'rq') || ray([[1, 1], [1, -1], [-1, 1], [-1, -1]], 'bq');
}
export const kingOf = (pos: Pos, white: boolean) => Object.keys(pos).find(s => pos[s] === (white ? 'K' : 'k')) ?? null;

/** White's material minus black's (pawn 1, knight and bishop 3, rook 5, queen 9). */
export const advOf = (pos: Pos) => Object.values(pos).reduce((n, pc) => n + (isWhitePc(pc) ? 1 : -1) * VALUE[pc.toLowerCase()], 0);

/** m:ss, rounded up (a clock showing 0:00 has run out). */
export const fmtClock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** What's left on a side's clock right now (it only runs on that side's turn, during the game). */
export const clockLeft = (g: ChessGame, side: Side, now: number) =>
  g.phase === 'play' && g.turn === side && g.turn_at ? Math.max(0, g.clock[side] - (now - Date.parse(g.turn_at))) : g.clock[side];
/** Whole seconds left on this turn's 30 (or the clock, if that's sooner). */
export const turnSecs = (g: ChessGame, now: number) => (g.phase === 'play' && g.until ? Math.max(0, Math.ceil((Date.parse(g.until) - now) / 1000)) : 0);

/** A move in a few words: { verb: 'BISHOP TAKES', where: 'c4 to d5' }. */
export function moveWords(m: Pick<ChessMove, 'piece' | 'from' | 'to' | 'captures' | 'castle' | 'promotes'>) {
  if (m.castle) return { verb: 'KING CASTLES', where: m.castle === 'kingside' ? 'kingside' : 'queenside' };
  if (m.promotes) return { verb: m.captures ? `PAWN TAKES, MAKES A ${m.promotes.toUpperCase()}` : `PAWN MAKES A ${m.promotes.toUpperCase()}`, where: `${m.from} to ${m.to}` };
  return { verb: `${m.piece.toUpperCase()}${m.captures ? ' TAKES' : ' MOVES'}`, where: `${m.from} to ${m.to}` };
}

/** The captured pieces in a row, like chess.com (the same kind overlapping). `took` is lower case, pawn to queen. */
export function Taken({ took, white, size, className = '' }: { took: string; white: boolean; size: number; className?: string }) {
  const fs = took.length > 8 ? Math.round(size * .82) : size;
  return (
    <span className={'tc-took ' + className} style={{ fontSize: fs }} aria-label={took ? `took ${took.length}` : 'nothing taken'}>
      {[...took].map((c, i) => <span key={i} className={'tc-pc-g ' + (white ? 'w' : 'b') + (i && took[i - 1] === c ? ' same' : '')}>{GLYPH[c]}</span>)}
    </span>
  );
}

export interface Marks { last?: string[]; check?: string | null; mate?: string | null; sel?: string | null; dots?: string[]; caps?: string[]; moved?: string[] }

/** The board: squares (buttons when `onTap` is given) and the pieces over them. `size` is the board's width in px.
 *  The last move's piece slides in from where it was (a transform; reduced motion just places it): `slide`. */
export function Board({ pos, flip = false, size, marks = {}, coords, onTap, slide, className = '', style, label }: {
  pos: Pos; flip?: boolean; size: number; marks?: Marks; coords?: boolean; onTap?: (sq: string) => void;
  slide?: ChessMove | null; className?: string; style?: CSSProperties; label?: (sq: string) => string;
}) {
  const sqs = squaresFor(flip);
  // what slides: the moved piece, and the rook when it castled
  const slides: Record<string, string> = {};
  if (slide) {
    slides[slide.to] = slide.from;
    if (slide.castle) { const r = slide.from[1], ks = slide.castle === 'kingside'; slides[(ks ? 'f' : 'd') + r] = (ks ? 'h' : 'a') + r; }
  }
  return (
    <div className={'tc-board ' + className} style={{ ['--bs' as any]: `${size}px`, ...style }}>
      {sqs.map((sq, i) => {
        const cls = 'tc-sq ' + (isLight(sq) ? 'lt' : 'dk')
          + (marks.last?.includes(sq) ? ' last' : '') + (marks.moved?.includes(sq) ? ' moved' : '')
          + (marks.mate === sq ? ' mate' : marks.check === sq ? ' chk' : '')
          + (marks.sel === sq ? ' sel' : marks.caps?.includes(sq) ? ' cap' : '');
        const inner = <>
          {marks.dots?.includes(sq) && !marks.caps?.includes(sq) && <i className="tc-dot" />}
          {coords && i % 8 === 0 && <span className="tc-co rk">{sq[1]}</span>}
          {coords && i >= 56 && <span className="tc-co fl">{sq[0]}</span>}
        </>;
        return onTap
          ? <button key={sq} type="button" className={cls} onClick={() => onTap(sq)} aria-label={label?.(sq) ?? sq}>{inner}</button>
          : <div key={sq} className={cls}>{inner}</div>;
      })}
      <div className="tc-pcs" aria-hidden="true">
        {Object.entries(pos).map(([sq, pc]) => {
          const { x, y } = xy(sq, flip);
          const from = slides[sq];
          const d = from ? xy(from, flip) : null;
          return (
            <span key={from ? `${sq}:${slide!.ply}` : sq} className={'tc-pc ' + (isWhitePc(pc) ? 'w' : 'b') + (d ? ' slide' : '')}
              style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%`, ...(d ? { ['--dx' as any]: `${(d.x - x) * 100}%`, ['--dy' as any]: `${(d.y - y) * 100}%` } : {}) }}>
              {GLYPH[pc.toLowerCase()]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The marks every viewer's board gets: the last move, and the king in check (or mated). */
export function gameMarks(g: ChessGame, pos: Pos): Marks {
  const m = g.moves.at(-1);
  const king = g.check ? kingOf(pos, g.turn === 'w') : null;
  const mated = g.result?.kind === 'checkmate';
  return { last: m ? [m.from, m.to] : [], check: mated ? null : king, mate: mated ? king : null };
}
