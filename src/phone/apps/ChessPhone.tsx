// TAG TEAM CHESS on the phone (the Tag Team Chess canvas: PhoneWait, PhoneTurn, PhonePick, PhoneConfirm,
// PhonePromote). One decision per screen:
//   intro    which team you're on and where you are in its order; look at the TV
//   wait     not your turn: the board (black's turned round), the clocks, who's moving and how soon you're up
//   turn     your move: tap one of your pieces, every square it can go to lights up (a ring where it takes), tap one;
//            tap another piece to change your mind. The squares are ~46px (agreed): the check screen catches mis-taps
//   promote  a pawn reaches the end: which piece it becomes
//   check    the move in words, the board after it, NO / YES (arms after 0.6 s). Once it's moved, it's moved
//   end      you won, you lost (your team goes in the queue) or a draw
// It buzzes and rings when it becomes your turn. Only the player to move can move (the server checks everything).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChessGame } from '../../lib/types';
import type { AppPhoneProps } from './AppGamePhone';
import { Facts, Key, buzz } from '../kit';
import { Board, GLYPH, PIECE_NAME, SIDE_NAME, Taken, advOf, applyMove, attacked, clockLeft, fmtClock, gameMarks, isWhitePc, kingOf, other,
  parseFen, turnSecs, type Side } from '../../tv/apps/chessKit';
import { errText } from '../../lib/backend';
import { toast } from '../../fx/effects';
import { Sound } from '../../fx/sound';

// 46px squares (the agreed exception to 64px), a little less on a phone narrower than 390
const boardSize = () => Math.min(368, Math.max(280, (typeof window === 'undefined' ? 390 : window.innerWidth) - 22));
const listNames = (ns: string[]) => (ns.length <= 1 ? ns.join('') : ns.length === 2 ? `${ns[0]} and ${ns[1]}` : `${ns.slice(0, -1).join(', ')} and ${ns.at(-1)}`);

export function ChessPhone({ s, g, me, now, bar, move }: AppPhoneProps<ChessGame>) {
  const side: Side = g.mine?.side ?? (g.black.includes(me.id) ? 'b' : 'w');
  const white = side === 'w';
  const name = (id?: string | null) => s.players.find(p => p.id === id)?.name ?? '?';
  const pos = useMemo(() => parseFen(g.fen), [g.fen]);
  const myTurn = !!g.mine?.my_turn;

  // the move being made: a piece picked, a pawn's new piece being chosen, the move being checked
  const [sel, setSel] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSel(null); setPromo(null); setPending(null); setBusy(false); }, [g.ply, myTurn]);

  // your turn: a buzz and the alarm, once (on the turn starting, not on a refresh)
  const wasMine = useRef(myTurn);
  useEffect(() => { if (myTurn && !wasMine.current) { buzz([300, 120, 300, 120, 300]); Sound.alarm(); } wasMine.current = myTurn; }, [myTurn]);
  // too slow: the TV played a random move for you
  const lastPly = useRef(g.ply);
  useEffect(() => {
    const m = g.moves.at(-1);
    if (g.ply > lastPly.current && m?.auto && m.by === me.id) { buzz(400); toast('Too slow: a random move was played for you', 4000); }
    lastPly.current = g.ply;
  }, [g.ply]);
  // the end: a sting
  const lastPhase = useRef(g.phase);
  useEffect(() => {
    if (lastPhase.current !== 'end' && g.phase === 'end' && g.result) {
      if (g.result.losers.includes(me.id)) { buzz(500); Sound.lose(); } else if (g.result.winner === side) Sound.win();
    }
    lastPhase.current = g.phase;
  }, [g.phase]);

  // the piece you've picked up shows on the TV too (best effort: a stale one is refused quietly)
  const relay = (sq: string | null) => { move({ touch: sq, ply: g.ply }).catch(() => {}); };

  const sub = `${white ? 'WHITE' : 'BLACK'} TEAM`;          // (the top bar is narrow: the side is what matters)
  const shell = (body: JSX.Element, cls = '') => <div className={'pu-app ag-phone tc-ph ' + cls}>{bar(sub)}{body}</div>;
  const sign = <div className="tc-ph-sign">NO CONFERRING</div>;
  const secs = turnSecs(g, now);
  const clockText = `0:${String(secs).padStart(2, '0')}`;

  // ---------- intro ----------
  if (g.phase === 'intro') {
    const team = white ? g.white : g.black;
    const i = team.indexOf(me.id);
    const before = team.slice(0, Math.max(0, i)).map(name);
    return shell(<>
      <div className="pu-kick pu-c-sodium" style={{ marginTop: 8 }}>TAG TEAM CHESS</div>
      <div className={'tc-ph-team ' + side}>YOU'RE ON {white ? 'WHITE' : 'BLACK'}</div>
      <div className="pu-body">{i === 0 ? `You make ${white ? 'white' : 'black'}'s first move.` : `You're number ${i + 1}: after ${listNames(before.length > 3 ? [...before.slice(0, 2), `${before.length - 2} more`] : before)}.`}
        {' '}Your team's moves go round in order, then back to the start.</div>
      <Facts facts={[
        { icon: 'tv', text: 'Look at the TV', small: `The clocks start in ${Math.max(0, Math.ceil((Date.parse(g.until ?? '') - now) / 1000)) || 0}s` },
        { icon: 'tap', text: 'Your phone buzzes on your turn', small: 'Tap a piece, then where it goes' },
        { icon: 'clock', text: '30 seconds a move', small: 'Too slow and a random move is played for you' },
      ]} />
      <div className="tc-ph-foot">{sign}</div>
    </>);
  }

  // ---------- end ----------
  if (g.phase === 'end' && g.result) {
    const r = g.result;
    const lost = r.losers.includes(me.id), won = r.winner === side;
    const why = r.kind === 'checkmate' ? (won ? 'Checkmate. Your team won.' : 'Checkmate.')
      : r.kind === 'flag' ? (won ? `${other(side) === 'w' ? 'White' : 'Black'}'s clock ran out. Your team won.` : 'Your team ran out of time.')
      : r.kind === 'stopped' ? 'The host stopped the game. Nobody loses.'
      : 'It\'s a draw. Nobody loses.';
    const stampStyle = lost ? {} : { ['--sc' as any]: won ? '#a4ff5a' : '#ffd84a', ['--sg' as any]: won ? 'rgba(164,255,90,.4)' : 'rgba(255,216,74,.3)' };
    return shell(<>
      <div className="pu-kick pu-c-sodium pu-center" style={{ marginTop: 16 }}>TAG TEAM CHESS · {r.kind === 'checkmate' ? 'CHECKMATE' : r.kind === 'flag' ? 'ON TIME' : 'A DRAW'}</div>
      <div className="hd-ph-stamp tc-ph-endstamp"><div className="ag-stamp slam" style={stampStyle as any}>{lost ? 'YOU LOSE' : won ? 'YOU WIN' : 'A DRAW'}</div></div>
      <div className="pu-body pu-center pu-c-bone2">{why}{lost ? ' Your whole team goes in the punishment queue.' : ''}</div>
      <Board pos={pos} flip={!white} size={232} className="tc-ph-final" marks={gameMarks(g, pos)} />
      <div className="ag-ph-box ag-ph-foot"><b>Look at the TV.</b><span>Next: the Champ, the Slacker, then the Trial.</span></div>
    </>, lost ? 'pu-red' : '');
  }

  // the side rows above and below the board: the other side on top, yours at the bottom
  const sideRow = (sd: Side) => {
    const took = sd === 'w' ? g.material.white_took : g.material.black_took;
    const adv = sd === 'w' ? g.material.white_adv : -g.material.white_adv;
    const running = g.phase === 'play' && g.turn === sd;
    const ms = clockLeft(g, sd, now);
    return (
      <div className="tc-ph-side">
        <span className={'tc-chip sm ' + sd}>{sd === 'w' ? 'WHITE' : 'BLACK'}</span>
        <Taken took={took} white={sd === 'b'} size={24} />
        {adv > 0 && <span className="adv">+{adv}</span>}
        <span className={'clk' + (running ? ' on' : '') + (running && ms < 30000 ? ' low' : '')}>{fmtClock(ms)}</span>
      </div>
    );
  };

  // ---------- promote: which piece the pawn becomes ----------
  if (myTurn && promo && !pending) {
    return shell(<>
      <div className="ag-ph-row"><div className="pu-kick">YOUR PAWN MADE IT</div><div className="ag-ph-clock">{clockText}</div></div>
      <div className="pu-hero pu-c-sodium tc-ph-hero">PICK WHAT IT BECOMES</div>
      <div className="pu-body pu-c-bone2">Tap one. You'll check the move next.</div>
      <div className="tc-ph-promos">
        {(['q', 'r', 'b', 'n'] as const).map(p => (
          <button key={p} type="button" className={'tc-ph-promo' + (p === 'q' ? ' best' : '')} onClick={() => { buzz(30); setPending(promo.from + promo.to + p); }}>
            <span className={'tc-pc-g ' + side}>{GLYPH[p]}</span><span className="t">{PIECE_NAME[p].toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="pu-keys"><Key variant="ghost" icon="back" onClick={() => setPromo(null)}>NO, PICK ANOTHER MOVE</Key></div>
    </>);
  }

  // ---------- check the move ----------
  if (myTurn && pending) {
    const from = pending.slice(0, 2), to = pending.slice(2, 4), pc = pos[from] ?? '';
    const kind = pc.toLowerCase();
    const after = applyMove(pos, pending);
    const theirKing = kingOf(after, !white);
    const check = !!theirKing && attacked(after, theirKing, white);
    const castle = kind === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2 ? (to[0] === 'g' ? 'kingside' : 'queenside') : null;
    const capt = pos[to] ? pos[to].toLowerCase() : kind === 'p' && from[0] !== to[0] ? 'p' : null;
    const promotes = pending[4] ? PIECE_NAME[pending[4]] : null;
    const verb = castle ? 'KING CASTLES' : promotes ? `PAWN BECOMES A ${promotes.toUpperCase()}` : `${PIECE_NAME[kind]?.toUpperCase() ?? 'PIECE'} ${capt ? 'TAKES' : 'MOVES'}`;
    const where = castle ? (castle === 'kingside' ? 'kingside (short)' : 'queenside (long)') : `${from} to ${to}`;
    const mine = (white ? 1 : -1) * advOf(after);
    const matLine = !capt ? '' : `Takes a ${PIECE_NAME[capt]}: ${mine > 0 ? `${SIDE_NAME[side]} goes +${mine}` : mine === 0 ? 'level on material' : `${SIDE_NAME[other(side)]} still +${-mine}`}. `;
    return shell(<>
      <div className="ag-ph-row"><div className="pu-kick">CHECK YOUR MOVE</div><div className={'ag-ph-clock' + (secs <= 5 ? ' tc-low' : '')}>{clockText}</div></div>
      <div className="tc-ph-what">
        <div className={'tc-ph-glyph ' + side}><span className={'tc-pc-g ' + side}>{GLYPH[promotes ? pending[4] : kind] ?? ''}</span></div>
        <div style={{ minWidth: 0 }}>
          <div className={'tc-ph-verb' + (verb.length > 14 ? ' long' : '')}>{verb}</div>
          <div className="tc-ph-where"><span>{where}</span>{check && <span className="tc-ph-tag">CHECK</span>}</div>
        </div>
      </div>
      <Board pos={after} flip={!white} size={264} className="tc-ph-mini" marks={{ moved: [from, to], check: check ? theirKing : null }} />
      <div className="pu-body pu-center pu-c-bone2 tc-ph-line">{matLine}Once it's moved, it's moved.</div>
      <ConfirmKeys busy={busy} onNo={() => setPending(null)} onYes={() => {
        setBusy(true);
        move({ uci: pending, ply: g.ply }).catch(e => { setBusy(false); setPending(null); toast(errText(e), 3500); });
      }} />
    </>);
  }

  // ---------- the board: your move, or watching ----------
  const marks = gameMarks(g, pos);
  const top = sideRow(other(side)), bottom = sideRow(side);
  const flipped = !white;
  if (myTurn) {
    const targets = sel ? g.legal.filter(m => m.startsWith(sel)).map(m => m.slice(2, 4)) : [];
    const selKind = sel ? pos[sel]?.toLowerCase() : null;
    const caps = targets.filter(sq => pos[sq] || (selKind === 'p' && sel && sq[0] !== sel[0]));
    const tap = (sq: string) => {
      if (busy) return;
      const pc = pos[sq];
      if (sel && targets.includes(sq)) {
        buzz(30);
        if (g.legal.includes(sel + sq + 'q')) setPromo({ from: sel, to: sq }); else setPending(sel + sq);
        return;
      }
      if (pc && isWhitePc(pc) === white) { const next = sq === sel ? null : sq; setSel(next); relay(next); buzz(20); return; }
      if (sel) { setSel(null); relay(null); }
    };
    const label = (sq: string) => { const pc = pos[sq]; return pc ? `${isWhitePc(pc) ? 'White' : 'Black'} ${PIECE_NAME[pc.toLowerCase()]} on ${sq}` : sq; };
    const line = !sel ? (g.check ? <><b className="pu-c-red">You're in check.</b><small>Get your king out of it.</small></> : 'Tap a piece to see where it can go.')
      : targets.length ? <>Tap where your {PIECE_NAME[selKind ?? 'p']} goes.<small>Or tap another piece to change.</small></>
      : <>That {PIECE_NAME[selKind ?? 'p']} can't move.<small>Tap another piece.</small></>;
    return shell(<>
      <div className="tc-ph-turn"><div className="tc-ph-big">YOUR MOVE</div><div className={'tc-ph-secs' + (secs <= 5 ? ' low' : '')}>{clockText}</div></div>
      <div className={'tc-ph-bar' + (secs <= 5 ? ' low' : '')}><i style={{ transform: `scaleX(${Math.min(1, secs / (g.move_ms / 1000))})` }} /></div>
      {top}
      <Board pos={pos} flip={flipped} size={boardSize()} className="tc-ph-board" onTap={tap} label={label} slide={g.moves.at(-1)}
        marks={{ ...marks, sel, dots: targets, caps }} />
      {bottom}
      <div className="tc-ph-say">{line}</div>
      <div className="tc-ph-foot">{sign}</div>
    </>, 'tc-ph-myturn');
  }

  // not your turn
  const team = white ? g.white : g.black;
  const myI = team.indexOf(me.id);
  const n = team.length;
  const firstI = g.idx[side];
  const before: string[] = [];
  for (let k = 0; k < n && myI >= 0; k++) { const i = (firstI + k) % n; if (i === myI) break; if (team[i] !== g.mover) before.push(name(team[i])); }
  const upNext = before.length === 0 ? "You're next." : `You're up after ${listNames(before.length > 3 ? [...before.slice(0, 2), `${before.length - 2} more`] : before)}.`;
  return shell(<>
    <div className="tc-ph-wait">
      <div className="pu-kick">NOT YOUR TURN</div>
      <div className="tc-ph-who">{name(g.mover)} is moving for {SIDE_NAME[g.turn]}. {upNext}</div>
    </div>
    {top}
    <Board pos={pos} flip={flipped} size={boardSize()} className="tc-ph-board" slide={g.moves.at(-1)} marks={marks} />
    {bottom}
    {flipped && <div className="tc-ph-note">Your board is turned so black is at the bottom.</div>}
    <div className="tc-ph-foot">{sign}</div>
  </>);
}

/** The check screen's keys (the kit's Check order: NO on top, then YES, which arms after 0.6 s). */
function ConfirmKeys({ busy, onNo, onYes }: { busy: boolean; onNo: () => void; onYes: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 600); return () => clearTimeout(t); }, []);
  return (
    <div className="pu-keys">
      <Key variant="ghost" icon="cross" onClick={onNo} disabled={busy}>NO, PICK AGAIN</Key>
      <Key lg icon="check" className="pu-yes pu-arm-key" disabled={!armed || busy} onClick={onYes}>
        <span className="arm" aria-hidden="true"><i /></span><span className="lbl">{busy ? 'MOVING…' : 'YES, MOVE IT'}</span>
      </Key>
    </div>
  );
}

