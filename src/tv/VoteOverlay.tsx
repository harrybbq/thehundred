// TV Trial: live bars (plus a NO TRIAL row) with submitted evidence pinned down
// both sides, then a drum roll and the verdict — GUILTY (caught → rehab),
// NOT GUILTY (the accusers drink) or no verdict (no clear majority).
import { useEffect, useRef, useState } from 'react';
import type { GameState, Vote } from '../lib/types';
import { NO_TRIAL } from '../lib/types';
import type { Act } from './TvRoom';
import { Polaroid, tiltFor } from '../components/ui';
import { ROLES } from '../lib/roles';
import { Sound } from '../fx/sound';
import { burst } from '../fx/effects';

// dismissed results survive a TV refresh
const DKEY = 'thehundred-dismissed-votes';
const dismissed = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(DKEY) || '[]'); } catch { return []; } })());
const dismiss = (id: string) => { dismissed.add(id); try { localStorage.setItem(DKEY, JSON.stringify([...dismissed].slice(-50))); } catch { /* ignore */ } };

export function VoteOverlay({ state, vote, act, now }: { state: GameState; vote: Vote; act: Act; now: () => number }) {
  const [, force] = useState(0);
  const [stage, setStage] = useState<'live' | 'drum' | 'result'>(vote.status === 'open' ? 'live' : 'result');
  const closing = useRef(false);
  const left = Math.max(0, Date.parse(vote.ends_at) - now());

  // time's up → close (server validates the time)
  useEffect(() => {
    if (vote.status === 'open' && left <= 0 && !closing.current) {
      closing.current = true;
      act('close_vote', { vote_id: vote.id }).catch(() => { closing.current = false; });
    }
  });
  // closed → drum roll → verdict
  const revealing = useRef(false);
  useEffect(() => {
    if (vote.status !== 'closed' || revealing.current || stage !== 'live') return;
    revealing.current = true;
    setStage('drum'); Sound.drumroll();
    setTimeout(() => {
      setStage('result'); Sound.gavel();
      const r = vote.outcome?.result;
      if (r === 'guilty') { Sound.siren(); burst(innerWidth / 2, innerHeight * 0.4, { count: 140, speed: 18, colors: ['#ff4a2e', '#ffe2b8', '#5c0c10'] }); }
      else if (r === 'innocent') Sound.lose();
    }, 1900);
  }, [vote.status, stage, vote.outcome]);

  if (dismissed.has(vote.id)) return null;
  if (vote.status === 'closed' && !revealing.current && now() - Date.parse(vote.ends_at) > 90e3) return null;   // old result on reload

  const byId = (id?: string) => state.players.find(p => p.id === id);
  const rows = vote.options.map(id => ({ id, p: byId(id), n: vote.counts[id] ?? 0 })).filter(r => r.p).sort((a, b) => b.n - a.n || a.p!.seat - b.p!.seat);
  const noTrial = vote.counts[NO_TRIAL] ?? 0;
  const max = Math.max(1, noTrial, ...rows.map(r => r.n));
  const ev = (state.evidence ?? []).filter(e => !e.hidden).slice(-6).reverse();
  const evL = ev.filter((_, i) => i % 2 === 0), evR = ev.filter((_, i) => i % 2 === 1);
  const o = vote.outcome;
  const accused = byId(o?.accused);

  return (
    <div className="overlay vote-overlay">
      <div className="kicker">{stage === 'result' ? 'THE VERDICT' : 'VOTE ON YOUR PHONES'}</div>
      <div className="vote-title">{vote.title.toUpperCase()}</div>
      {stage === 'live' && <>
        <div className="vote-sub">A clear majority sends someone to the dock. Get it wrong and everyone who accused them drinks.</div>
        <div className="vote-timer"><div className="box">00:{String(Math.min(99, Math.ceil(left / 1000))).padStart(2, '0')}</div><div className="n">{vote.voters} VOTED</div></div>
      </>}
      {stage !== 'result' && (
        <div className={'trial-body' + (ev.length ? '' : ' noev')}>
          {ev.length > 0 && <EvidenceCol items={evL} />}
          <div className={'vote-bars' + (stage === 'drum' ? ' drum' : '')}>
            {rows.slice(0, 13).map(r => (
              <div key={r.id} className="vote-row">
                <Polaroid url={r.p!.selfie_url} name={r.p!.name} tilt="0deg" />
                <div className="nm">{r.p!.name.toUpperCase()}</div>
                <div className="vote-bar"><div style={{ width: (r.n / max) * 100 + '%' }} /></div>
                <div className="vote-n">{r.n}</div>
              </div>
            ))}
            <div className="vote-row none">
              <div />
              <div className="nm">NO TRIAL</div>
              <div className="vote-bar"><div style={{ width: (noTrial / max) * 100 + '%' }} /></div>
              <div className="vote-n">{noTrial}</div>
            </div>
          </div>
          {ev.length > 0 && <EvidenceCol items={evR} offset={1} />}
        </div>
      )}
      {stage === 'result' && (
        <div className="verdict">
          <div className="spot" />
          {!o || o.result === 'none' ? <>
            <div className="vname">NO VERDICT</div>
            <div className="vline ok">{o?.total ? `NO CLEAR MAJORITY (${o.votes ?? 0} OF ${o.total}). EVERYONE WALKS… FOR NOW.` : 'NOBODY VOTED.'}</div>
          </> : <>
            <div style={{ position: 'relative' }}>
              {accused && <Polaroid url={accused.selfie_url} name={accused.name} caption={accused.name.toUpperCase()} pin />}
              {o.result === 'guilty'
                ? <div className="vstamp" style={{ ['--sc' as any]: 'var(--rust)' }}>GUILTY</div>
                : <div className="vstamp" style={{ ['--sc' as any]: '#1d5a5c' }}>NOT GUILTY</div>}
            </div>
            {o.result === 'guilty'
              ? <div className="vline">CAUGHT: {(o.role ? ROLES[o.role].label : 'SABOTEUR').toUpperCase()} · POWERS GONE · OFF TO REHAB → PUNISHMENT QUEUE</div>
              : <div className="vline">WRONG ACCUSATION: {(o.accusers ?? []).map(id => byId(id)?.name.toUpperCase()).filter(Boolean).join(', ') || 'THE ACCUSERS'} DRINK</div>}
          </>}
          <button className="key" onClick={() => { dismiss(vote.id); force(x => x + 1); }}>CLOSE</button>
        </div>
      )}
      {stage === 'live' && <button className="key vote-end" onClick={() => act('close_vote', { vote_id: vote.id }).catch(() => {})}>END VOTE NOW</button>}
    </div>
  );
}

function EvidenceCol({ items, offset = 0 }: { items: GameState['evidence']; offset?: number }) {
  return (
    <div className="evidence-col">
      {items.map((e, i) => (
        <div key={e.id} className="ev" style={{ ['--tilt' as any]: tiltFor(e.id, 4), animationDelay: `${(i * 2 + offset) * 0.15}s` }}>
          <span className="tag">EXHIBIT</span>
          <img src={e.image_url} alt="" />
          {e.caption && <div className="cap">{e.caption}</div>}
        </div>
      ))}
    </div>
  );
}
