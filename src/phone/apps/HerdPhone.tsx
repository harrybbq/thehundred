// THE HERD on the phone (the App Games canvas: HerdPhoneAnswer, HerdPhoneResult). One decision per screen:
//   intro   what the game is, and to look at the TV
//   ask     the question and four huge answers in the TV's colours; tap one, tap another to change it (no Check:
//           nothing is final until the time runs out)
//   reveal  STRIKE or WITH THE HERD, what the herd went for and what you went for, your strikes
//   final   whether you go in the queue
import { useEffect, useRef, useState } from 'react';
import type { HerdGame } from '../../lib/types';
import type { AppPhoneProps } from './AppGamePhone';
import { Facts, buzz } from '../kit';
import { ANSWER_INK, answerVars, secsTo } from '../../tv/apps/kit';
import { errText } from '../../lib/backend';
import { toast } from '../../fx/effects';
import { Sound } from '../../fx/sound';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function HerdPhone({ g, me, now, bar, move }: AppPhoneProps<HerdGame>) {
  const secs = secsTo(g.until, now);
  const mine = g.mine?.pick ?? null;
  // the tap shows straight away; the server's answer (mine.pick) takes over when it arrives
  const [tapped, setTapped] = useState<{ n: number; i: number } | null>(null);
  const pick = tapped && tapped.n === g.n ? tapped.i : mine;
  useEffect(() => { if (g.phase === 'ask' && pick === null) buzz([120, 80, 120]); }, [g.n, g.phase === 'ask']);   // a new question: a buzz
  const strikes = g.mine?.strikes ?? g.strikes[me.id] ?? 0;
  const lastPhase = useRef(g.phase);
  useEffect(() => {
    if (lastPhase.current !== 'reveal' && g.phase === 'reveal' && g.last) {
      if (g.last.struck.includes(me.id)) { buzz(300); Sound.down(); } else if (g.last.herd !== null) Sound.win();
    }
    lastPhase.current = g.phase;
  }, [g.phase]);

  const tap = (i: number) => {
    if (i === pick) return;
    setTapped({ n: g.n, i }); buzz(30); Sound.tick();
    move({ pick: i }).catch(e => { setTapped(null); toast(errText(e), 3000); });
  };
  const sub = g.n > 0 ? `THE HERD · ${g.n}/${g.of}` : 'THE HERD';
  const shell = (body: JSX.Element, cls = '') => <div className={'pu-app ag-phone ' + cls}>{bar(sub)}{body}</div>;

  if (g.phase === 'intro') {
    return shell(<>
      <div className="pu-kick pu-c-sodium" style={{ marginTop: 8 }}>THE HERD · {g.of} QUESTIONS</div>
      <div className="pu-hero">PICK WHAT<br />EVERYONE<br />ELSE WILL</div>
      <div className="pu-body pu-c-bone2">Don't pick what you think. The most-picked answer is the herd: everyone else gets a strike. Most strikes at the end goes in the punishment queue.</div>
      <Facts facts={[{ icon: 'tv', text: 'Look at the TV', small: `The first question comes up in ${secs}s` }, { icon: 'tap', text: 'Answer here, on your phone' }]} />
    </>);
  }

  if (g.phase === 'ask' && g.q) {
    return shell(<>
      <div className="ag-ph-row"><div className="pu-kick">QUESTION {g.n} OF {g.of}</div><div className="ag-ph-clock">0:{String(secs).padStart(2, '0')}</div></div>
      <div className="ag-ph-q">{g.q.q.toUpperCase()}</div>
      <div className="hd-opts">
        {g.q.a.map((a, i) => (
          <button key={i} type="button" className={'hd-opt' + (pick === i ? ' sel' : '')} style={{ ...answerVars(i), ['--op' as any]: pick === null || pick === i ? 1 : .62 }}
            onClick={() => tap(i)} aria-pressed={pick === i}>
            <span className="hd-lt">{ANSWER_INK[i].l}</span><span className="tx">{a.toUpperCase()}</span>
            {pick === i && <span className="tag">YOUR PICK</span>}
          </button>
        ))}
      </div>
      <div className="ag-ph-foot">
        <b>{pick === null ? 'Tap the one most people will pick.' : 'Tap another to change it.'}</b>
        <span>It locks when the time runs out.</span>
      </div>
    </>);
  }

  if (g.phase === 'reveal' && g.q && g.last) {
    const L = g.last;
    const mineI = L.picks[me.id];
    const struck = L.struck.includes(me.id);
    const herdN = L.herd !== null ? L.counts[L.herd] : 0;
    return shell(<>
      <div className="hd-ph-stamp">
        <div className="ag-stamp slam" style={L.herd === null ? { ['--sc' as any]: '#ffd84a', ['--sg' as any]: 'rgba(255,216,74,.3)', fontSize: 64 } as any
          : struck ? undefined : { ['--sc' as any]: '#a4ff5a', ['--sg' as any]: 'rgba(164,255,90,.4)', fontSize: 64 } as any}>
          {L.herd === null ? 'A TIE' : struck ? 'STRIKE' : <>WITH THE<br />HERD</>}
        </div>
      </div>
      <div className="pu-body pu-center" style={{ fontFamily: 'var(--rough)', fontWeight: 400, fontSize: 24 }}>
        {L.herd === null ? 'A tie at the top: nobody gets a strike.' : struck ? (mineI === undefined ? 'No answer counts as a strike.' : 'You strayed from the herd.') : 'Safe. You read the room.'}
      </div>
      {L.herd !== null && <>
        <div className="pu-kick">THE HERD WENT FOR</div>
        <div className="hd-line" style={answerVars(L.herd)}><span className="hd-lt">{ANSWER_INK[L.herd].l}</span><span className="tx">{g.q.a[L.herd].toUpperCase()}</span><span className="n">{herdN}</span></div>
      </>}
      {mineI !== undefined && mineI !== L.herd && <>
        <div className="pu-kick">YOU WENT FOR</div>
        <div className="hd-line" style={answerVars(mineI)}><span className="hd-lt">{ANSWER_INK[mineI].l}</span><span className="tx">{g.q.a[mineI].toUpperCase()}</span><span className="n">{L.counts[mineI]}</span></div>
      </>}
      <div className="ag-ph-row" style={{ marginTop: 6 }}>
        <div className="pu-kick">YOUR STRIKES</div>
        {strikes > 0 ? <div style={{ display: 'flex', gap: 14 }}>{Array.from({ length: Math.ceil(strikes / 5) }, (_, k) => (
          <div key={k} className="hd-ph-gate">{Array.from({ length: Math.min(5, strikes - k * 5) }, (_, j) => <i key={j} />)}</div>))}</div>
          : <div className="pu-kick" style={{ color: 'var(--green)' }}>NONE</div>}
      </div>
      <div className="ag-ph-box ag-ph-foot"><b>Look at the TV.</b><span>{g.n >= g.of ? 'The results are next.' : 'The next question comes up in a moment.'}</span></div>
    </>, struck ? 'pu-red' : '');
  }

  // final
  const lost = (g.losers ?? []).includes(me.id);
  return shell(<>
    <div className="pu-kick pu-c-sodium pu-center" style={{ marginTop: 16 }}>AFTER {g.n} QUESTION{g.n === 1 ? '' : 'S'}</div>
    <div className="hd-ph-stamp">
      <div className="ag-stamp slam" style={lost ? { fontSize: 76 } : { ['--sc' as any]: '#a4ff5a', ['--sg' as any]: 'rgba(164,255,90,.4)', fontSize: 76 } as any}>{lost ? 'A STRAY' : 'SAFE'}</div>
    </div>
    <div className="pu-body pu-center pu-c-bone2">{lost
      ? `You had the most strikes (${strikes}). You go in the punishment queue.`
      : `${plural(strikes, 'strike')}. Not the most: you're safe.`}</div>
    <div className="ag-ph-box ag-ph-foot"><b>Look at the TV.</b><span>Next: the Champ, the Slacker, then the Trial.</span></div>
  </>, lost ? 'pu-red' : '');
}
