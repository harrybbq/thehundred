// TAG TEAM CHESS on the TV (the Tag Team Chess canvas: Main, TvPlay, TvEnd). Three beats:
//   intro  the teams in their move order (colours drawn at random) and the three rules, 15 s (START THE CLOCKS)
//   play   the board big (the last move lit, a king in check marked, the piece the player to move has touched and
//          where it can go), both teams' rosters with NOW / NEXT, both clocks, the 30-second bar, what each side has
//          taken (+N for the side ahead) and the last few moves
//   end    CHECKMATE / FLAG / DRAW, who wins, the losing team's polaroids, then the usual GAME OVER (CONTINUE, or 20 s)
// The top centre stays clear for the framework's END GAME key.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ChessGame, Player } from '../../lib/types';
import type { AppTvProps } from './AppGameTV';
import { Pol, TopLine, secsTo, tiltOf } from './kit';
import { Board, SIDE_NAME, Taken, clockLeft, fmtClock, gameMarks, glyphOf, other, parseFen, turnSecs, type ChessMove, type Pos, type Side } from './chessKit';
import { initials } from '../../lib/util';
import { Sound } from '../../fx/sound';

type ById = (id?: string | null) => Player | undefined;
const upName = (byId: ById, id?: string | null) => (byId(id)?.name ?? '?').toUpperCase();

const RULES = [
  { h: 'THE MOVE GOES ROUND', b: "Your team's next move is made by your next player, then the next, and back to the start." },
  { h: '10 MINUTES A TEAM', b: 'Run out and you lose. 30 seconds a move, or a random move is played for you.' },
  { h: 'NO CONFERRING', b: 'Play your own move in silence. Checkmate, or flag their clock, and they drink.' },
];

export function ChessTV({ state, g, now, host }: AppTvProps<ChessGame>) {
  const byId: ById = id => (id ? state.players.find(p => p.id === id) : undefined);
  const t = now();
  const pos = useMemo(() => parseFen(g.fen), [g.fen]);
  useChessSounds(g, t);
  if (g.phase === 'intro') return <Intro g={g} byId={byId} secs={secsTo(g.until, t)} host={host} />;
  if (g.phase === 'end' && g.result) return <End g={g} pos={pos} byId={byId} secs={secsTo(g.until, t)} host={host} />;
  return <Play g={g} pos={pos} byId={byId} t={t} />;
}

/** A sting on each beat, a clunk for every move, and a tick in the last 5 seconds of a turn. */
function useChessSounds(g: ChessGame, t: number) {
  const seen = useRef<{ phase: string; ply: number } | null>(null);
  useEffect(() => {
    const was = seen.current;
    seen.current = { phase: g.phase, ply: g.ply };
    if (!was) { if (g.phase === 'intro') Sound.drumroll(); return; }      // a refresh mid-game doesn't replay a sting
    if (g.ply > was.ply) {
      const m = g.moves.at(-1);
      Sound.clunk();
      if (m?.auto) Sound.down(); else if (m?.check) Sound.stamp();
    }
    if (g.phase !== was.phase) {
      if (g.phase === 'play') Sound.whoosh();
      else if (g.phase === 'end') { if (g.result?.winner) Sound.gavel(); else Sound.thud(); }
    }
  }, [g.phase, g.ply]);
  const secs = turnSecs(g, t);
  const ticked = useRef(-1);
  useEffect(() => {
    if (g.phase === 'play' && secs > 0 && secs <= 5 && secs !== ticked.current) Sound.tick();
    ticked.current = secs;
  }, [secs, g.phase]);
}

const Room = ({ kind }: { kind: string }) => <><div className={'tc-room ' + kind} /><div className="ag-vig" /></>;
const Chip = ({ side, className = '' }: { side: Side; className?: string }) => <div className={`tc-chip ${side} ${className}`}>{side === 'w' ? 'WHITE' : 'BLACK'}</div>;

// ---------- intro: the teams and the rules ----------
function Intro({ g, byId, secs, host }: { g: ChessGame; byId: ById; secs: number; host: AppTvProps<ChessGame>['host'] }) {
  const n = Math.max(g.white.length, g.black.length);
  const perRow = n > 5 ? Math.ceil(n / 2) : n;                // big teams: two rows a side
  const pw = n > 5 ? Math.min(104, Math.floor((790 - (perRow - 1) * 16) / perRow)) : 118;
  const team = (side: Side) => {
    const ids = side === 'w' ? g.white : g.black;
    return (
      <div className={'tc-team ' + side}>
        <div className="tc-team-h">
          {side === 'w'
            ? <><Chip side="w" /><span className="k">MOVES FIRST</span><span className="m">COLOURS DRAWN AT RANDOM</span></>
            : <><span className="k dim">{fmtClock(g.team_ms)} EACH</span><Chip side="b" /></>}
        </div>
        <div className="tc-pols" style={{ ['--pw' as any]: `${pw}px`, maxWidth: perRow * pw + (perRow - 1) * 16 }}>
          {ids.map((id, i) => (
            <div key={id} className="tc-polw ag-pop" style={{ animationDelay: `${500 + i * 70}ms` }}>
              <Pol p={byId(id)} tilt={tiltOf(i + (side === 'b' ? 3 : 0))} />
              <div className={'tc-num ' + side}>{i + 1}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="ap tc">
      <Room kind="intro" />
      <div className="ag-top">
        <div className="tc-kick">A HOST GAME, UP TO {Math.round((2 * g.team_ms) / 60000)} MINUTES</div>
        <div className="ag-top-r"><button className="ag-key hot" onClick={() => host('next')}>START THE CLOCKS · {secs}</button></div>
      </div>
      <div className="tc-hero ag-in">TAG TEAM CHESS</div>
      <div className="tc-sub ag-in">Two teams. One board. Everyone takes a turn.</div>
      <div className={'tc-rules' + (n > 5 ? ' tight' : '')}>
        {RULES.map((r, i) => (
          <div key={i} className="tc-rulew" style={{ ['--t' as any]: `${[-1.2, .8, -.6][i]}deg` }}>
            <div className="tc-rule ag-pop" style={{ animationDelay: `${150 + i * 120}ms` }}>
              <div className="n">{i + 1}</div><div className="h">{r.h}</div><div className="b">{r.b}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="tc-teams">{team('w')}<div className="tc-vs">VS</div>{team('b')}</div>
    </div>
  );
}

// ---------- play: the board, the clocks, the rosters ----------
function Play({ g, pos, byId, t }: { g: ChessGame; pos: Pos; byId: ById; t: number }) {
  const n = Math.max(g.white.length, g.black.length, 1);
  // the panels (890 tall, 842 inside) fit the bigger team: rows shrink, and the clock with them past 6 a side;
  // whatever's left under the rows shows earlier moves in black's panel
  const compact = n > 6;
  const fixed = compact ? 226 : 276, gap = compact ? 4 : 8;
  const rh = Math.max(34, Math.min(64, Math.floor((842 - fixed - 12 - 136 - (n - 1) * gap) / n)));
  const spare = 842 - fixed - (n * rh + (n - 1) * gap) - 12;
  const earlier = Math.max(0, Math.min(3, Math.floor((spare - 102) / 34)));
  const secs = turnSecs(g, t);
  const moverName = upName(byId, g.mover);
  // the piece the player to move has touched: where it can go (a ring where it takes)
  const touch = g.touch && pos[g.touch] ? g.touch : null;
  const dots = touch ? g.legal.filter(m => m.startsWith(touch)).map(m => m.slice(2, 4)) : [];
  const caps = touch ? dots.filter(sq => pos[sq] || (pos[touch].toLowerCase() === 'p' && sq[0] !== touch[0])) : [];
  const last = g.moves.at(-1) ?? null;
  const flash = last && g.turn_at && (last.auto || last.check) && t - Date.parse(g.turn_at) < 2600 ? (last.auto ? 'TOO SLOW' : 'CHECK') : null;
  const panel = (side: Side) => <Panel g={g} side={side} t={t} byId={byId} rh={rh} gap={gap} compact={compact} earlier={earlier} />;
  return (
    <div className="ap tc">
      <Room kind="play" />
      <TopLine title="TAG TEAM CHESS"><div className="ag-count">MOVE {Math.floor(g.ply / 2) + 1}</div></TopLine>
      <div className="tc-tomove">
        <FitLine className="nm" text={`${moverName} TO MOVE`} max={80} />
        <div className="tc-ttimer">
          <div className={'ag-bar' + (secs <= 5 ? ' low' : '')}><i style={{ transform: `scaleX(${Math.min(1, secs / (g.move_ms / 1000))})` }} /></div>
          <div className={'s' + (secs <= 5 ? ' low' : '')}>0:{String(secs).padStart(2, '0')}</div>
        </div>
      </div>
      <div className="tc-main">
        <Board pos={pos} size={800} coords slide={last} marks={{ ...gameMarks(g, pos), sel: touch, dots, caps }} />
        {flash && <div key={g.ply} className={'tc-flash' + (last?.auto ? ' slow' : '')}><span>{flash}</span></div>}
      </div>
      {panel('w')}
      {panel('b')}
    </div>
  );
}

/** One line of big type, shrunk to fit its box (a long name gets smaller, never cut off). */
function FitLine({ text, max, className }: { text: string; max: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      el.style.fontSize = `${max}px`;
      const k = el.clientWidth / Math.max(1, el.scrollWidth);
      if (k < 1) el.style.fontSize = `${Math.floor(max * k)}px`;
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
  }, [text, max]);
  return <div ref={ref} className={className} style={{ fontSize: max }}>{text}</div>;
}

function Face({ p, size }: { p?: Player; size: number }) {
  return (
    <div className="tc-face" style={{ width: size, height: size }}>
      {p?.selfie_url ? <img src={p.selfie_url} alt="" draggable={false} /> : <span>{initials(p?.name ?? '?')}</span>}
    </div>
  );
}

function Panel({ g, side, t, byId, rh, gap, compact, earlier }: { g: ChessGame; side: Side; t: number; byId: ById; rh: number; gap: number; compact: boolean; earlier: number }) {
  const ids = side === 'w' ? g.white : g.black;
  const running = g.phase === 'play' && g.turn === side;
  const ms = clockLeft(g, side, t);
  const took = side === 'w' ? g.material.white_took : g.material.black_took;
  const adv = side === 'w' ? g.material.white_adv : -g.material.white_adv;
  const nowI = running ? g.idx[side] : -1;
  const nextI = running ? (g.idx[side] + 1) % ids.length : g.idx[side];
  const status = <div className={'tc-status' + (running ? ' on' : '')}>{running ? 'CLOCK RUNNING' : 'WAITING'}</div>;
  const moves = [...g.moves].reverse();
  return (
    <div className={'tc-panel ' + side + (compact ? ' compact' : '')} style={{ ['--rh' as any]: `${rh}px`, ['--gap' as any]: `${gap}px` }}>
      <div className="tc-pn-head">{side === 'w' ? <><Chip side="w" />{status}</> : <>{status}<Chip side="b" /></>}</div>
      <div className={'tc-clock' + (running ? ' on' : '') + (running && ms < 30000 ? ' low' : '')}>{fmtClock(ms)}</div>
      <div className="tc-taken">
        <span className="k">TAKEN</span>
        <Taken took={took} white={side === 'b'} size={compact ? 30 : 34} />
        {adv > 0 && <span className="adv">+{adv}</span>}
      </div>
      <div className="tc-roster">
        {ids.map((id, i) => {
          const tag = i === nowI ? 'NOW' : i === nextI ? 'NEXT' : '';
          return (
            <div key={id} className={'tc-row' + (i === nowI ? ' now' : '')}>
              <div className={'n ' + side}>{i + 1}</div>
              <Face p={byId(id)} size={Math.round(rh * .75)} />
              <div className="nm">{upName(byId, id)}</div>
              {tag && <div className={'tag' + (tag === 'NOW' ? ' now' : '')}>{tag}</div>}
            </div>
          );
        })}
      </div>
      {side === 'w'
        ? <div className="tc-noconfer">NO CONFERRING</div>
        : <div className="tc-moves">
            <div className="tc-mv-h"><div className="k">{moves.length > 1 && earlier > 0 ? 'LAST MOVES' : 'LAST MOVE'}</div>{moves[0] && <MoveTag m={moves[0]} />}</div>
            {moves.length === 0 && <div className="none">None yet. White starts.</div>}
            {moves.slice(0, 1 + earlier).map((m, i) => <MoveLine key={m.ply} m={m} byId={byId} big={i === 0} />)}
          </div>}
    </div>
  );
}

function MoveLine({ m, byId, big }: { m: ChessMove; byId: ById; big?: boolean }) {
  const what = m.castle ? (m.castle === 'kingside' ? 'castles short' : 'castles long')
    : `${m.from} ${m.captures ? 'takes' : 'to'} ${m.to}`;
  return (
    <div className={'tc-mv' + (big ? ' big' : '')}>
      <span className="who">{upName(byId, m.by)}</span>
      <span className={'tc-pc-g ' + m.side}>{glyphOf(m.piece)}</span>
      <span className="what">{what}</span>
      {m.promotes && <span className={'tc-pc-g ' + m.side}>{glyphOf(m.promotes)}</span>}
      {!big && (m.check || m.auto) && <span className="mark">{m.auto ? '(random)' : '+'}</span>}
    </div>
  );
}

/** CHECK / MATE / RANDOM (30 s up) for the latest move. */
function MoveTag({ m }: { m: ChessMove }) {
  const tag = m.auto ? 'RANDOM MOVE' : m.mate ? 'MATE' : m.check ? 'CHECK' : null;
  return tag ? <span className={'tc-mv-tag' + (m.auto ? ' slow' : '')}>{tag}</span> : null;
}

// ---------- end: the result ----------
const DRAW_WHY: Record<string, string> = {
  stalemate: 'STALEMATE', insufficient: 'NOT ENOUGH PIECES LEFT TO MATE', fifty: 'FIFTY MOVES WITHOUT A CAPTURE',
  threefold: 'THE SAME POSITION THREE TIMES', stopped: 'STOPPED BY THE HOST',
};

function End({ g, pos, byId, secs, host }: { g: ChessGame; pos: Pos; byId: ById; secs: number; host: AppTvProps<ChessGame>['host'] }) {
  const r = g.result!;
  const won = r.winner, lost = won ? other(won) : null;
  const full = Math.ceil(g.ply / 2), movesW = `${full} move${full === 1 ? '' : 's'}`;
  const adv = g.material.white_adv;
  const mat = adv === 0 ? 'level on material' : `${adv > 0 ? 'white' : 'black'} +${Math.abs(adv)} on material`;
  const last = g.moves.at(-1);
  const lastBy = last?.by ? byId(last.by)?.name : null;
  const line = r.kind === 'checkmate' ? `Mated in ${movesW}, ${mat}.${lastBy ? ` ${lastBy} played the last one.` : ''}`
    : r.kind === 'flag' ? `${lost === 'w' ? 'White' : 'Black'}'s clock ran out ${g.ply ? `after ${movesW}, ${mat}` : 'before the first move'}.`
    : r.kind === 'stopped' ? (g.ply ? `Stopped by the host after ${movesW}, ${mat}.` : 'Stopped by the host before the first move.')
    : r.kind === 'stalemate' ? `${g.turn === 'w' ? 'White' : 'Black'} had no move and wasn't in check, after ${movesW}.`
    : `A draw after ${movesW}, ${mat}.`;
  const stamp = r.kind === 'checkmate' ? 'CHECKMATE' : r.kind === 'flag' ? 'FLAG' : 'DRAW';
  const losers = r.losers;
  const lw = losers.length <= 6 ? 132 : Math.floor((1040 - (losers.length - 1) * 18) / losers.length);
  const both = (side: Side) => {
    const ids = side === 'w' ? g.white : g.black;
    const pw = Math.min(104, Math.floor((900 - (ids.length - 1) * 14) / Math.max(1, ids.length)));
    return (
      <div className="tc-endteam">
        <Chip side={side} />
        <div className="tc-pols" style={{ ['--pw' as any]: `${pw}px`, gap: 14 }}>{ids.map((id, i) => <Pol key={id} p={byId(id)} tilt={tiltOf(i)} />)}</div>
      </div>
    );
  };
  return (
    <div className="ap tc">
      <Room kind="end" />
      <TopLine title="TAG TEAM CHESS"><button className="ag-key hot" onClick={() => host('next')}>CONTINUE · {secs}</button></TopLine>
      <div className="tc-endboard">
        <Board pos={pos} size={600} marks={gameMarks(g, pos)} />
      </div>
      <div className="tc-endline">{line}</div>
      <div className="tc-endr">
        <div className="tc-bigstamp-w"><div className={'tc-bigstamp ag-stamp slam' + (won ? '' : ' draw')}>{stamp}</div></div>
        {won ? <>
          <div className="tc-wins"><Chip side={won} className="big" /><span>WINS</span></div>
          {r.kind === 'flag' && <div className="tc-why">{SIDE_NAME[lost!].toUpperCase()}'S CLOCK RAN OUT</div>}
          <div className="tc-verdict">{SIDE_NAME[lost!].toUpperCase()} GOES IN THE PUNISHMENT QUEUE</div>
          <div className="tc-pols tc-losers" style={{ ['--pw' as any]: `${lw}px` }}>
            {losers.map((id, i) => <Pol key={id} p={byId(id)} tilt={tiltOf(i)} />)}
          </div>
        </> : <>
          <div className="tc-why big">{DRAW_WHY[r.kind] ?? 'A DRAW'}</div>
          <div className="tc-verdict ok">NOBODY GOES IN THE PUNISHMENT QUEUE</div>
          {both('w')}{both('b')}
        </>}
        <div className="ag-next tc-endnext">NEXT: THE CHAMP, THE SLACKER, THEN THE TRIAL</div>
      </div>
    </div>
  );
}
