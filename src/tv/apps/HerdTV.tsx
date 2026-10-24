// THE HERD on the TV (the App Games canvas: HerdQuestion, HerdReveal, HerdFinal). Four beats:
//   intro   the rules, 15 seconds (START NOW)
//   ask     the question and its four answers, a 20-second bar, and everyone's polaroid with IN once they've
//           answered (never what they picked)
//   reveal  the picks come out: how many went for each answer, and who; THE HERD on the winner, STRIKE on the rest
//   final   THE STRAYS: the most strikes go in the punishment queue; the strike ledger on a slate
import { useEffect, useRef } from 'react';
import type { HerdGame, Player } from '../../lib/types';
import type { AppTvProps } from './AppGameTV';
import { Gates, Pol, Timer, TopLine, answerVars, secsTo, tiltOf } from './kit';
import { Sound } from '../../fx/sound';

const LONG = 20;                                   // an answer this long gets the smaller type

export function HerdTV({ state, g, now, host }: AppTvProps<HerdGame>) {
  const byId = (id: string) => state.players.find(p => p.id === id);
  const t = now();
  const secs = secsTo(g.until, t);

  // a sound on each beat (and a tick as each answer comes in)
  const beat = `${g.phase}:${g.n}`;
  const last = useRef('');
  useEffect(() => {
    if (last.current === beat) return;
    const first = !last.current;
    last.current = beat;
    if (first && g.phase !== 'intro') return;      // a refresh mid-game doesn't replay the sting
    if (g.phase === 'intro') Sound.drumroll();
    else if (g.phase === 'ask') Sound.whoosh();
    else if (g.phase === 'reveal') Sound.stamp();
    else if (g.phase === 'final') Sound.gavel();
  }, [beat, g.phase]);
  const inN = g.answered.length;
  const lastIn = useRef(inN);
  useEffect(() => { if (g.phase === 'ask' && inN > lastIn.current) Sound.tick(); lastIn.current = inN; }, [inN, g.phase]);

  const room = <><div className="ap-room" /><div className="ap-vig" /></>;
  const count = g.n > 0 ? <div className="ap-count">QUESTION {g.n} OF {g.of}</div> : null;

  if (g.phase === 'intro') {
    return (
      <div className="ap">
        {room}
        <TopLine title="THE HERD"><button className="ap-key hot" onClick={() => host('next')}>START NOW</button></TopLine>
        <div className="hd-intro ap-in">
          <div className="ap-kick">{g.of} QUESTIONS · PICK ON YOUR PHONE</div>
          <div className="ap-hero" style={{ marginTop: 14 }}>THE HERD</div>
          <div className="hd-rules">
            <div>Don't pick what you think. <b>Pick what everyone else will.</b></div>
            <div>The most-picked answer is <b>the herd</b>. Everyone else gets a strike.</div>
            <div>Most strikes after {g.of} goes in the <b>punishment queue</b>.</div>
          </div>
          <div className="ap-next" style={{ marginTop: 48 }}>FIRST QUESTION IN {secs}</div>
        </div>
        <Strip ids={g.players} byId={byId} strikes={g.strikes} />
      </div>
    );
  }

  if (g.phase === 'ask' && g.q) {
    const long = g.q.q.length > 34;
    return (
      <div className="ap">
        {room}
        <TopLine title="THE HERD">{count}<button className="ap-key" onClick={() => host('skip')}>SKIP</button></TopLine>
        <div className="hd-q">
          <div className="ap-rough">Don't pick what you think. Pick what everyone else will.</div>
          <div key={g.n} className={'ap-hero ap-in' + (long ? ' long' : '')}>{g.q.q.toUpperCase()}</div>
        </div>
        <div className="hd-ans">
          {g.q.a.map((a, i) => (
            <div key={g.n + ':' + i} className="hd-card ap-pop" style={{ ...answerVars(i), ['--t' as any]: `${[-1, .8, -.6, 1][i]}deg`, animationDelay: `${120 + i * 90}ms` }}>
              <div className="hd-lt">{'ABCD'[i]}</div>
              <div className={'hd-tx' + (a.length > LONG ? ' long' : '')}>{a.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <Timer secs={secs} of={20} className="hd-timer"><div className="hd-in">{inN} OF {g.players.length} IN</div></Timer>
        <Strip ids={g.players} byId={byId} strikes={g.strikes} answered={g.answered} />
      </div>
    );
  }

  if (g.phase === 'reveal' && g.q && g.last) {
    const L = g.last;
    const noAnswer = g.players.filter(id => L.picks[id] === undefined);
    const strays = L.struck.length;
    return (
      <div className="ap">
        {room}
        <TopLine title="THE HERD">{count}<button className="ap-key hot" onClick={() => host('next')}>{g.n >= g.of ? 'THE RESULTS' : 'NEXT QUESTION'}</button></TopLine>
        <div className="hd-rq">{g.q.q.toUpperCase()}</div>
        <div className="hd-cols">
          {g.q.a.map((a, i) => {
            const who = g.players.filter(id => L.picks[id] === i);
            const herd = L.herd === i;
            const n = who.length;
            const mw = n <= 6 ? 92 : n <= 12 ? 64 : 54;
            return (
              <div key={i} className={'hd-col' + (herd ? ' herd' : L.herd !== null ? ' stray' : '')}>
                <div className="hd-head" style={answerVars(i)}><div className="hd-lt">{'ABCD'[i]}</div><div className={'hd-tx' + (a.length > LONG ? ' long' : '')}>{a.toUpperCase()}</div></div>
                <div className="hd-body">
                  <div className="hd-n">{n}</div>
                  <div className="hd-who" style={{ ['--mw' as any]: `${mw}px`, gap: n <= 6 ? 14 : 10 }}>
                    {who.map((id, k) => <Pol key={id} p={byId(id)} tilt={tiltOf(k + i)} />)}
                  </div>
                </div>
                {L.herd !== null && (n > 0 || herd) && (
                  <div className="ap-stamp slam" style={{ fontSize: herd ? 74 : 64, ['--sc' as any]: herd ? '#a4ff5a' : '#ff5a44', ['--sg' as any]: herd ? 'rgba(164,255,90,.45)' : 'rgba(255,60,30,.3)',
                    ['--r' as any]: `${[-5, 4, -3, 5][i]}deg`, animationDelay: herd ? '200ms' : '650ms' }}>{herd ? 'THE HERD' : 'STRIKE'}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="hd-foot">
          {L.herd !== null && noAnswer.length > 0 && <>
            <div className="lbl">NO ANSWER, STRIKE:</div>
            {noAnswer.slice(0, 8).map((id, k) => <Pol key={id} p={byId(id)} tilt={tiltOf(k)} />)}
          </>}
          <div className="sum">{L.herd === null
            ? 'A tie at the top. Nobody gets a strike.'
            : strays === 0 ? 'Everyone went with the herd.' : `${g.players.length - strays} went with the herd. ${strays} strayed.`}</div>
        </div>
      </div>
    );
  }

  // final: THE STRAYS
  const losers = g.losers ?? [];
  const ledger = [...g.players].sort((a, b) => (g.strikes[b] ?? 0) - (g.strikes[a] ?? 0));
  const rh = Math.min(64, Math.floor(698 / Math.max(1, ledger.length)));
  const sw = losers.length <= 2 ? 300 : losers.length === 3 ? 250 : losers.length === 4 ? 180 : 140;
  const most = losers.length ? g.strikes[losers[0]] ?? 0 : 0;
  return (
    <div className="ap">
      {room}
      <TopLine title="THE HERD"><button className="ap-key hot" onClick={() => host('next')}>CONTINUE · {secs}</button></TopLine>
      <div className="hd-final">
        <div className="ap-kick">AFTER {g.n} QUESTION{g.n === 1 ? '' : 'S'}</div>
        <div className="ap-hero">{losers.length ? 'THE STRAYS' : 'ONE HERD'}</div>
        {losers.length > 0 ? <>
          <div className="hd-strays" style={{ ['--sw' as any]: `${sw}px` }}>
            {losers.map((id, k) => (
              <div key={id} style={{ position: 'relative' }}>
                <Pol p={byId(id)} tilt={tiltOf(k) * 1.3} />
                <div className="ap-stamp slam" style={{ ['--r' as any]: `${k % 2 ? 6 : -8}deg`, animationDelay: `${400 + k * 250}ms` }}>{most} STRIKE{most === 1 ? '' : 'S'}</div>
              </div>
            ))}
          </div>
          <div className="hd-verdict">{losers.length === 1 ? 'GOES' : losers.length === 2 ? 'BOTH GO' : 'ALL GO'} IN THE PUNISHMENT QUEUE</div>
        </> : <div className="hd-verdict" style={{ color: 'var(--phosphor)' }}>NOBODY STRAYED THE MOST. NOBODY GOES IN THE QUEUE.</div>}
        <div className="ap-next" style={{ marginTop: 22 }}>NEXT: THE CHAMP, THE SLACKER, THEN THE TRIAL</div>
      </div>
      <div className="hd-slate">
        <h4>Strikes</h4>
        {ledger.map(id => {
          const n = g.strikes[id] ?? 0;
          return (
            <div key={id} className={'hd-row' + (losers.includes(id) ? ' top' : '')} style={{ ['--rh' as any]: `${rh}px` }}>
              <div className="nm">{byId(id)?.name ?? '?'}</div>
              {n > 0 ? <Gates n={n} /> : <div className="clean">with the herd every time</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Everyone's polaroid along the bottom: IN once they've answered (never what), and their strikes in chalk. */
function Strip({ ids, byId, strikes, answered }: { ids: string[]; byId: (id: string) => Player | undefined; strikes: Record<string, number>; answered?: string[] }) {
  const n = ids.length;
  const gap = n > 12 ? 14 : 26;
  const pw = Math.min(118, Math.floor((1800 - (n - 1) * gap) / Math.max(1, n)));
  return (
    <div className="hd-strip" style={{ ['--gap' as any]: `${gap}px`, ['--pw' as any]: `${pw}px` }}>
      {ids.map((id, i) => {
        const isIn = !answered || answered.includes(id);
        return (
          <div key={id} className={'hd-seat' + (isIn ? '' : ' out')}>
            <Pol p={byId(id)} tilt={tiltOf(i)} />
            {answered && isIn && <div className="hd-badge ap-pop">IN</div>}
            <div className="ap-tally">{Array.from({ length: Math.min(10, strikes[id] ?? 0) }, (_, k) => <i key={k} />)}</div>
          </div>
        );
      })}
    </div>
  );
}
