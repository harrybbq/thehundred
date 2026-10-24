// ODD ONE OUT on the TV (the Odd One Out canvas). The board only ever has public facts: who has checked in, read,
// spoken or voted, never what anyone's card says or who they voted for. The odd one out comes out when they're
// caught (or at the end of the round), the name at REVEAL THE NAME (or at the end of the round).
//   intro    the rules while everyone taps I'M IN on their phone (START ANYWAY)
//   card     CHECK YOUR PHONE: who has read their card (START THE CLUES)
//   clues    whose turn it is under the light, the 20 seconds, who's next (SKIP)
//   vote     WHO'S THE ODD ONE OUT? and who is still to vote (END VOTING NOW)
//   caught   CAUGHT: the odd one out and the counts; one guess out loud, then the host's REVEAL THE NAME (no clock)
//   answer   the name, declassified: THEY GOT IT / THEY DIDN'T
//   pick     they named it: they're picking who takes it, on their phone
//   result   who loses the round, the odd one out and the name (NEXT ROUND)
//   final    CASE CLOSED: every round, and who goes in the queue (CONTINUE)
import { useEffect, useRef, type ReactNode } from 'react';
import type { OddGame, OddRound, Player } from '../../lib/types';
import type { AppTvProps } from './AppGameTV';
import { Pol, TopLine, secsTo, tiltOf } from './kit';
import { Sound } from '../../fx/sound';
import '../../styles/odd.css';

/** The biggest type (px, up to `max`) that sets `text` in `lines` lines of `width` px. The display faces run about
 *  half an em a letter in capitals; this errs on the small side so a long name never runs off the board. */
export function fitPx(text: string, width: number, max: number, lines = 2, em = 0.54) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map(w => w.length));
  let size = Math.min(max, width / (longest * em));
  const rows = (px: number) => {
    let n = 1, cur = 0;
    for (const w of words) {
      const len = w.length * px * em;
      if (cur > 0 && cur + px * em + len > width) { n++; cur = len; } else cur = cur ? cur + px * em + len : len;
    }
    return n;
  };
  while (size > 16 && rows(size) > lines) size *= 0.94;
  return Math.floor(size);
}
const ordinal = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'));
const votesTxt = (n: number) => `${n} VOTE${n === 1 ? '' : 'S'}`;
/** "Jamie", "Jamie and Sol", "Jamie, Sol and Kyle" */
export const andList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const TIMES = ['', '', 'twice', 'three times', 'four times'];

/** What happened in a round, in a line (the CASE CLOSED ledger and the phones' result). */
export function roundWhat(r: Pick<OddRound, 'outcome' | 'accused' | 'picked' | 'odd'> & { random?: boolean }, nm: (id?: string | null) => string) {
  if (r.outcome === 'wrong') return 'Caught. Guessed wrong.';
  if (r.outcome === 'named') return r.picked ? `Caught, but named it. ${nm(r.odd)} picked ${nm(r.picked)}.` : 'Caught, but named it.';
  if (!r.accused.length) return 'Got away with it. Nobody voted.';
  return `Got away with it. The room voted out ${andList(r.accused.map(id => nm(id)))}.`;
}

export function OddTV({ state, g, now, host }: AppTvProps<OddGame>) {
  const byId = (id?: string | null) => (id ? state.players.find(p => p.id === id) : undefined);
  const nm = (id?: string | null) => byId(id)?.name ?? '?';
  const NM = (id?: string | null) => nm(id).toUpperCase();
  const secs = secsTo(g.until, now());
  // the host's keys carry the step they were pressed on: a double tap (or a stale board) does nothing on the server
  const key = (op: string, args: Record<string, unknown> = {}) => host(op, { step: g.step, ...args });

  // a sting on each beat (not replayed on a refresh mid-game), and a tick as each check-in, card or vote comes in
  const beat = `${g.phase}:${g.n}:${g.turn}`;
  const last = useRef('');
  useEffect(() => {
    if (last.current === beat) return;
    const first = !last.current;
    last.current = beat;
    if (first && g.phase !== 'intro') return;
    if (g.phase === 'intro') Sound.drumroll();
    else if (g.phase === 'card') Sound.whoosh();
    else if (g.phase === 'clues') Sound.beep();
    else if (g.phase === 'vote') Sound.whoosh(.5, false);
    else if (g.phase === 'caught') Sound.siren();
    else if (g.phase === 'answer') Sound.reveal();
    else if (g.phase === 'pick') Sound.stamp();
    else if (g.phase === 'result') { if (g.last?.outcome === 'escaped') Sound.scratch(); else Sound.stamp(); }
    else if (g.phase === 'final') Sound.gavel();
  }, [beat, g.phase]);
  const ins = g.here.length + g.read.length + g.voted.length;
  const lastIn = useRef(ins);
  useEffect(() => { if (ins > lastIn.current) Sound.tick(); lastIn.current = ins; }, [ins]);

  const feet = ['7 FT', '6 FT', '5 FT'].flatMap((f, i) => [
    <div key={'l' + i} className="oo-ft" style={{ left: 24, top: 226 + i * 240 }}>{f}</div>,
    <div key={'r' + i} className="oo-ft" style={{ right: 24, top: 226 + i * 240 }}>{f}</div>]);
  const room = (spot?: ReactNode) => <><div className="oo-wall" />{spot}<div className="oo-vig" />{feet}</>;
  const round = g.n > 0 ? <div className="ag-count">ROUND {g.n} OF {g.of}</div> : null;
  const top = (keys?: ReactNode) => <TopLine title="ODD ONE OUT">{round}{keys}</TopLine>;
  const L = g.last;

  // ---------------- intro: the rules while everyone checks in ----------------
  if (g.phase === 'intro') {
    const n = g.here.length;
    return (
      <div className="ag">
        {room()}
        <div className="ag-top">
          <div className="oo-topkick">{g.of} ROUNDS, ABOUT 9 MINUTES</div>
          <div className="ag-top-r"><button className="ag-key" onClick={() => key('next')}>START ANYWAY · {secs}</button></div>
        </div>
        <div className="oo-hero ag-in" style={{ top: 104, fontSize: 236, textShadow: '0 8px 0 #000, 0 0 70px rgba(255,138,30,.4)' }}>ODD ONE OUT</div>
        <div className="oo-sub" style={{ top: 330, fontSize: 56 }}>Everyone gets the same famous person. Except one of you.</div>
        <div className="oo-rules">
          {[['1', 'READ YOUR CARD', "Hold to read. Don't show anyone.", -1.2],
            ['2', 'SAY UP TO 3 WORDS', 'Out loud, one at a time. The odd one out has to bluff.', .8],
            ['3', 'VOTE THEM OUT', 'Catch the odd one out and they get one guess at the name.', -.6]].map(([no, hd, tx, t]) => (
            <div key={no as string} className="oo-rule" style={{ ['--t' as any]: `${t}deg` }}>
              <div className="oo-rule-no">{no}</div><div className="oo-rule-hd">{hd}</div><div className="oo-rule-tx">{tx}</div>
            </div>
          ))}
        </div>
        <div className="oo-line" style={{ top: 786 }}>{n} OF {g.players.length} AT THE TV</div>
        <Strip ids={g.players} byId={byId} tag={id => g.here.includes(id) ? { t: 'IN', c: 'oo-on' } : { t: 'NOT YET', c: '' }}
          dim={id => !g.here.includes(id)} />
      </div>
    );
  }

  // ---------------- card: everyone reads theirs ----------------
  if (g.phase === 'card') {
    return (
      <div className="ag">
        {room()}
        {top(<button className="ag-key" onClick={() => key('next')}>START THE CLUES · {secs}</button>)}
        <div key={g.n} className="oo-hero ag-in" style={{ top: 104, fontSize: 168 }}>CHECK YOUR PHONE</div>
        <div className="oo-sub" style={{ top: 262, fontSize: 50 }}>Hold to read your card. Don't show anyone.</div>
        <div className="oo-env">
          <div className="oo-env-flap" /><div className="oo-env-seal" />
          <div className="oo-env-lbl">THE NAME</div>
          <div className="oo-env-stamp">TOP SECRET</div>
        </div>
        <div className="oo-line" style={{ top: 786 }}>{g.read.length} OF {g.players.length} HAVE READ THEIRS</div>
        <Strip ids={g.players} byId={byId} tag={id => g.read.includes(id) ? { t: 'READ', c: 'oo-on' } : { t: 'READING', c: '' }} />
      </div>
    );
  }

  // ---------------- clues: one at a time, out loud ----------------
  if (g.phase === 'clues') {
    const cur = g.order[g.turn], next = g.order[g.turn + 1];
    const name = NM(cur);
    return (
      <div className="ag">
        {room(<div className="oo-spot" style={{ left: 140 }} />)}
        {top(<button className="ag-key" onClick={() => key('next')}>SKIP</button>)}
        <div key={cur} className="oo-bigpol ag-in"><Pol p={byId(cur)} className="oo-ring-now" /></div>
        <div className="oo-say">
          <div className="oo-kick">{ordinal(g.turn + 1)} TO SPEAK</div>
          <div key={cur} className="oo-name ag-in" style={{ fontSize: fitPx(name, 960, 230, 1) }}>{name}</div>
          <div className="oo-say-rule">Up to 3 words. Out loud.</div>
          <Clock secs={secs} of={20} />
          <div className="oo-say-next">{next ? `NEXT: ${NM(next)}` : 'LAST ONE. THEN THE VOTE.'}</div>
        </div>
        <Strip ids={g.order} byId={byId} said={id => g.order.indexOf(id) < g.turn} ring={id => (id === cur ? 'oo-ring-now' : '')}
          tag={id => { const i = g.order.indexOf(id); return i < g.turn ? { t: 'SAID IT', c: 'oo-said' } : i === g.turn ? { t: 'NOW', c: 'oo-now' } : { t: String(i + 1), c: 'oo-num' }; }} />
      </div>
    );
  }

  // ---------------- vote: waits for everyone ----------------
  if (g.phase === 'vote') {
    const waiting = g.players.filter(id => !g.voted.includes(id));
    return (
      <div className="ag">
        {room()}
        {top(<button className="ag-key" onClick={() => key('next')}>END VOTING NOW</button>)}
        <div className="oo-hero ag-in" style={{ top: 110, fontSize: 176 }}>WHO'S THE ODD ONE OUT?</div>
        <div className="oo-sub" style={{ top: 278, fontSize: 50 }}>Vote on your phone. Not for yourself.</div>
        <div className="oo-panel">
          <div className="oo-panel-lbl">WAITING ON</div>
          <div className="oo-panel-n">{waiting.length}</div>
          <div className="oo-panel-who">{waiting.length ? `STILL TO VOTE: ${waiting.map(NM).join(', ')}` : 'EVERYONE HAS VOTED'}</div>
        </div>
        <Strip ids={g.players} byId={byId} tag={id => g.voted.includes(id) ? { t: 'VOTED', c: 'oo-on ag-pop' } : null} />
      </div>
    );
  }

  // ---------------- caught: one guess, out loud ----------------
  if (g.phase === 'caught' && L) {
    const n = L.counts[L.odd] ?? 0;
    const tie = L.tops.length > 1;
    const head = `${NM(L.odd)} WAS THE ODD ONE OUT`;
    return (
      <div className="ag">
        {room(<div className="oo-spot oo-red" style={{ left: 100 }} />)}
        {top()}
        <div className="oo-caughtpol ag-in">
          <Pol p={byId(L.odd)} className="oo-ring-red" />
          <div className="oo-stamp oo-slam" style={{ animationDelay: '350ms' }}>CAUGHT</div>
        </div>
        <div className="oo-col" style={{ left: 790, top: 146, width: 1060 }}>
          <div className="oo-kick oo-red">{tie ? `TIED AT THE TOP WITH ${votesTxt(n)} OF ${L.total}` : `VOTED OUT WITH ${n} OF ${L.total} VOTES`}</div>
          <div className="oo-name" style={{ fontSize: fitPx(head, 1000, 138, 3) }}>{head}</div>
          <div className="oo-col-say">One guess.<br />Say the famous person out loud.</div>
          <button className="oo-bigkey" style={{ marginTop: 34 }} onClick={() => key('next')}>REVEAL THE NAME</button>
        </div>
        <VoteStrip g={g} byId={byId} />
      </div>
    );
  }

  // ---------------- answer / pick: the name, declassified ----------------
  if ((g.phase === 'answer' || g.phase === 'pick') && L) {
    const famous = (L.famous ?? '').toUpperCase();
    const picking = g.phase === 'pick';
    return (
      <div className="ag">
        {room()}
        {top()}
        <div className="oo-oddpol ag-in">
          <Pol p={byId(L.odd)} className={picking ? 'oo-ring-green' : 'oo-ring-red'} />
          <div className={'oo-oddpol-lbl' + (picking ? ' oo-green' : '')}>{picking ? 'NAMED IT' : 'THE ODD ONE OUT'}</div>
        </div>
        <div className="oo-file oo-big ag-in">
          <div className="oo-file-k">THE FAMOUS PERSON WAS</div>
          <div className="oo-file-v" style={{ fontSize: fitPx(famous, 1100, 180, 2) }}>{famous}</div>
          <div className="oo-declass">DECLASSIFIED</div>
        </div>
        {picking ? <>
          <div className="oo-ask" style={{ color: '#8dff9a' }}>{nm(L.odd)} got it. Now they pick who takes it.</div>
          <div className="oo-picking"><Clock secs={secs} of={45}><div className="oo-say-next" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>ON THEIR PHONE</div></Clock></div>
        </> : <>
          <div className="oo-ask">Did {nm(L.odd)} say it?</div>
          <div className="oo-keys">
            <button className="oo-bigkey oo-yes" onClick={() => key('judge', { right: true })}>THEY GOT IT</button>
            <button className="oo-bigkey oo-no" onClick={() => key('judge', { right: false })}>THEY DIDN'T</button>
          </div>
        </>}
      </div>
    );
  }

  // ---------------- result: who loses the round ----------------
  if (g.phase === 'result' && L) {
    const losers = L.losers ?? [];
    const famous = (L.famous ?? '').toUpperCase();
    const lastRound = g.n >= g.of;
    const angelOut = L.outcome === 'escaped' && !losers.length && L.tops.length > 0;
    const who = losers.length ? losers : angelOut ? L.tops : [];
    const rw = who.length <= 1 ? 400 : who.length === 2 ? 300 : who.length === 3 ? 220 : 160;
    const n = who.length ? L.counts[who[0]] ?? 0 : 0;
    const kicker = L.outcome === 'wrong' ? 'CAUGHT, THEN GUESSED WRONG'
      : L.outcome === 'named' ? (L.random ? 'NAMED IT. PICKED AT RANDOM' : `${NM(L.odd)} NAMED IT AND PICKED`)
      : !L.tops.length ? 'NOBODY VOTED'
      : L.tops.length > 1 ? `TIED WITH ${votesTxt(n)} EACH, OF ${L.total}` : `VOTED OUT WITH ${n} OF ${L.total} VOTES`;
    const stamp = L.outcome === 'wrong' ? 'WRONG' : L.outcome === 'named' ? 'PICKED' : angelOut ? 'THE ANGEL' : 'INNOCENT';
    const head = L.outcome === 'wrong' ? 'NO WAY OUT' : L.outcome === 'named' ? (losers.length ? 'TAKES THE FALL' : 'NOBODY TO PICK') : angelOut ? 'NEVER PUNISHED' : !L.tops.length ? 'NOBODY OUT' : 'WRONGLY ACCUSED';
    const line = losers.length
      ? `${andList(losers.map(nm))} ${losers.length === 1 ? 'goes' : 'go'} in the punishment queue.`
      : angelOut ? 'The Angel is never punished. Nobody goes in the queue.' : 'Nobody goes in the punishment queue.';
    const oddName = NM(L.odd);
    return (
      <div className="ag">
        {room()}
        {top(<button className="ag-key" onClick={() => key('next')}>{lastRound ? 'THE RESULTS' : 'NEXT ROUND'} · {secs}</button>)}
        <div className="oo-res-l">
          <div className="oo-kick oo-dim">{kicker}</div>
          {who.length > 0 && (
            <div className={'oo-res-pols' + (who.length > 1 ? ' oo-many' : '')} style={{ ['--rw' as any]: `${rw}px` }}>
              {who.slice(0, 6).map((id, k) => (
                <div key={id} className="oo-res-pol ag-in" style={{ animationDelay: `${k * 120}ms` }}>
                  <Pol p={byId(id)} tilt={who.length === 1 ? 2 : tiltOf(k)} />
                  <div className={'oo-stamp oo-slam' + (L.outcome === 'escaped' ? (angelOut ? ' oo-gold' : '') : ' oo-red')}
                    style={{ animationDelay: `${450 + k * 200}ms` }}>{stamp}</div>
                </div>
              ))}
            </div>
          )}
          <div className={'oo-res-head' + (angelOut ? ' oo-green' : '')} style={!who.length ? { fontSize: 150, marginTop: 60 } : undefined}>{head}</div>
          <div className="oo-res-line">{line}</div>
        </div>
        <div className="oo-res-r">
          {L.outcome !== 'wrong' && <>
            <div className="oo-kick oo-dim">THE ODD ONE OUT WAS</div>
            <div className="oo-res-odd">
              <Pol p={byId(L.odd)} className={L.outcome === 'escaped' || L.outcome === 'named' ? 'oo-ring-green' : 'oo-ring-red'} />
              <div style={{ minWidth: 0 }}>
                <div className="oo-name" style={{ fontSize: fitPx(oddName, 520, 150, 1) }}>{oddName}</div>
                <div className="oo-chip">{L.outcome === 'named' ? 'NAMED IT' : 'GOT AWAY WITH IT'}</div>
              </div>
            </div>
          </>}
          <div className="oo-file oo-small" style={L.outcome === 'wrong' ? { marginTop: 0 } : undefined}>
            <div className="oo-file-k">THE FAMOUS PERSON WAS</div>
            <div className="oo-file-v" style={{ fontSize: fitPx(famous, 720, L.outcome === 'wrong' ? 140 : 104, 2) }}>{famous}</div>
          </div>
          {L.outcome === 'wrong' && <div className="oo-res-line" style={{ marginTop: 40 }}>{nm(L.odd)} was the odd one out, and didn't name it.</div>}
        </div>
      </div>
    );
  }

  // ---------------- final: CASE CLOSED ----------------
  const losers = g.losers ?? [];
  const losses = g.losses ?? {};
  const times = (id: string) => TIMES[losses[id] ?? 1] ?? `${losses[id]} times`;
  const summary = !losers.length ? 'Nobody goes in the punishment queue.'
    : losers.length === 1 ? `${nm(losers[0])} goes in the punishment queue${(losses[losers[0]] ?? 1) > 1 ? ' ' + times(losers[0]) : ''}.`
    : `${andList(losers.map(id => nm(id) + ((losses[id] ?? 1) > 1 ? ` (${times(id)})` : '')))} go in the punishment queue.`;
  return (
    <div className="ag">
      {room()}
      <TopLine title="ODD ONE OUT"><button className="ag-key" onClick={() => key('next')}>CONTINUE · {secs}</button></TopLine>
      <div className="oo-hero ag-in" style={{ top: 104, fontSize: 150 }}>CASE CLOSED</div>
      <div className="oo-ledger ag-in" style={{ animationDelay: '150ms' }}>
        {g.rounds.length ? (
          <table>
            <thead><tr><th style={{ width: 120 }}>ROUND</th><th>THE FAMOUS PERSON</th><th>ODD ONE OUT</th><th>WHAT HAPPENED</th><th>INTO THE QUEUE</th></tr></thead>
            <tbody>
              {g.rounds.map(r => (
                <tr key={r.n}>
                  <td className="oo-led-rn">{r.n}</td>
                  <td className="oo-led-nm" style={{ fontSize: Math.min(50, fitPx(r.famous, 380, 50, 2)) }}>{r.famous.toUpperCase()}</td>
                  <td className="oo-led-nm">{NM(r.odd)}</td>
                  <td className="oo-led-what">{roundWhat(r, nm)}</td>
                  <td className={'oo-led-q' + (r.losers.length ? '' : ' oo-none')}>{r.losers.length ? r.losers.map(nm).join(', ') : 'Nobody'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="oo-led-empty">No round was finished.</div>}
      </div>
      <div className="oo-sub" style={{ top: 900, fontSize: 52 }}>{summary}</div>
      <div className="oo-line" style={{ top: 984, color: 'var(--sodium-300)', letterSpacing: '.2em' }}>NEXT: THE CHAMP, THE SLACKER, THEN THE TRIAL</div>
    </div>
  );
}

/** The seconds left on a bar that runs down (scaleX), and the number beside it. */
function Clock({ secs, of, children }: { secs: number; of: number; children?: ReactNode }) {
  return (
    <div className="oo-timer">
      <div className={'oo-bar' + (secs <= 5 ? ' oo-low' : '')}><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, secs / of))})` }} /></div>
      <div className="oo-secs">{secs}</div>
      {children}
    </div>
  );
}

type Tag = { t: string; c: string } | null;
/** The line-up along the bottom: everyone's polaroid with a tag above it (IN, READ, NOW, VOTED: never what). */
function Strip({ ids, byId, tag, dim, said, ring }: {
  ids: string[]; byId: (id?: string | null) => Player | undefined; tag: (id: string) => Tag;
  dim?: (id: string) => boolean; said?: (id: string) => boolean; ring?: (id: string) => string;
}) {
  const n = ids.length;
  const gap = n > 10 ? 14 : 22;
  const pw = Math.min(150, Math.floor((1800 - (n - 1) * gap) / Math.max(1, n)));
  return (
    <div className="oo-strip" style={{ ['--gap' as any]: `${gap}px`, ['--pw' as any]: `${pw}px` }}>
      {ids.map((id, i) => {
        const tg = tag(id);
        return (
          <div key={id} className={'oo-seat' + (dim?.(id) ? ' oo-dim' : '') + (said?.(id) ? ' oo-said' : '')}>
            <Pol p={byId(id)} tilt={tiltOf(i)} className={ring?.(id) ?? ''} />
            {tg && <div className="oo-tagrow"><div key={tg.t} className={'oo-tag ' + tg.c} style={pw < 110 ? { fontSize: 19, padding: '5px 8px 3px' } : undefined}>{tg.t}</div></div>}
          </div>
        );
      })}
    </div>
  );
}

/** The counts once the vote has closed: how many each got (never who voted for whom), the most in red. */
function VoteStrip({ g, byId }: { g: OddGame; byId: (id?: string | null) => Player | undefined }) {
  const L = g.last!;
  return <Strip ids={g.players} byId={byId} ring={id => (L.tops.includes(id) ? 'oo-ring-red' : '')}
    tag={id => { const n = L.counts[id] ?? 0; return { t: votesTxt(n), c: L.tops.includes(id) ? 'oo-red ag-pop' : n ? 'ag-pop' : 'oo-said' }; }} />;
}
