// TV vote screen: live bars while open, then a drum-roll reveal of the winner(s).
// Ties: everyone tied is punished (the server queues them all).
import { useEffect, useRef, useState } from 'react';
import type { GameState, Vote } from '../lib/types';
import type { Act } from './TvRoom';
import { Avatar } from '../components/ui';
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
  // closed → drum roll → reveal
  const revealing = useRef(false);
  useEffect(() => {
    if (vote.status !== 'closed' || revealing.current || stage !== 'live') return;
    revealing.current = true;
    setStage('drum'); Sound.drumroll();
    setTimeout(() => {
      setStage('result'); Sound.fanfare();
      burst(innerWidth / 2, innerHeight * 0.45, { count: 180, speed: 20 });
    }, 1900);
  }, [vote.status, stage]);

  if (dismissed.has(vote.id)) return null;
  if (vote.status === 'closed' && !revealing.current && now() - Date.parse(vote.ends_at) > 90e3) return null;   // old result on reload

  const byId = (id: string) => state.players.find(p => p.id === id);
  const rows = vote.options.map(id => ({ id, p: byId(id), n: vote.counts[id] ?? 0 })).filter(r => r.p).sort((a, b) => b.n - a.n || a.p!.seat - b.p!.seat);
  const max = Math.max(1, ...rows.map(r => r.n));
  const winners = (vote.result ?? []).map(byId).filter(Boolean);

  return (
    <div className="overlay vote-overlay">
      <div className="vote-kicker">🗳️ VOTE ON YOUR PHONES</div>
      <div className="vote-title">{vote.title.toUpperCase()}</div>
      {stage === 'live' && <div className="vote-timer">{Math.ceil(left / 1000)}s · {vote.voters} VOTED</div>}
      {stage !== 'result' && (
        <div className={'vote-bars' + (stage === 'drum' ? ' drum' : '')}>
          {rows.slice(0, 12).map(r => (
            <div key={r.id} className="vote-row">
              <Avatar url={r.p!.selfie_url} name={r.p!.name} />
              <div className="vote-name">{r.p!.name}</div>
              <div className="vote-bar"><div style={{ width: (r.n / max) * 100 + '%' }} /></div>
              <div className="vote-n">{r.n}</div>
            </div>
          ))}
        </div>
      )}
      {stage === 'result' && (
        <div className="vote-result">
          {winners.length === 0 ? <div className="vote-title">NOBODY VOTED 🤷</div> : <>
            <div className="vote-winners">{winners.map(p => (
              <div key={p!.id} className="vote-winner"><Avatar url={p!.selfie_url} name={p!.name} /><div>{p!.name.toUpperCase()}</div></div>
            ))}</div>
            <div className="vote-sub">{winners.length > 1 ? "IT'S A TIE — ALL OF YOU" : 'THE ROOM HAS SPOKEN'} → PUNISHMENT QUEUE</div>
          </>}
          <button className="big-btn plain" onClick={() => { dismiss(vote.id); force(x => x + 1); }}>CLOSE</button>
        </div>
      )}
      {stage === 'live' && <button className="btn vote-end" onClick={() => act('close_vote', { vote_id: vote.id }).catch(() => {})}>END VOTE NOW</button>}
    </div>
  );
}
