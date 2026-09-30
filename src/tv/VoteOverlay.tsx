// THE TRIAL on the TV (approved mockup: design/mockups/Trial.dc.html). Courtroom noir on a 1920×1080 stage:
//   opening  (the first ~3s of a fresh vote) ALL RISE, THE TRIAL bangs in under the gavel, the three rules, the exhibits dealt
//   live     VOTE ON YOUR PHONE: the evidence on a corkboard (one exhibit at a time, EXHIBIT tags, the anonymous captions),
//            the sealed ballot box (a COUNT only: the room can see who's tapping, so nothing per suspect), the line-up
//   tally    after the vote closes, the first per-suspect numbers: chalk tally marks, the conviction line, TO THE DOCK
//   verdict  GUILTY (one portrait, the role badge, THE CASE AGAINST pinned to the dock) · NOT GUILTY (the exhibits DISMISSED
//            behind the tape, the drinkers as polaroids) · NO VERDICT (the empty dock) · JESTER hands over to JesterRevenge
// Data: only what get_state gives the TV (vote.voters while open; vote.counts and vote.outcome once closed; evidence without
// its submitter). Motion: WAAPI on [data-fx] children, transform/opacity; reduced motion shows the settled frame.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameState, Player, Vote } from '../lib/types';
import { NO_TRIAL } from '../lib/types';
import type { Act } from './TvRoom';
import { ROLES } from '../lib/roles';
import { Sound, cues } from '../fx/sound';
import { initials } from '../lib/util';
import { Mugshot } from '../components/Mugshot';
import { useStageScale } from './Scenes';
import { JesterRevenge } from './JesterRevenge';

// dismissed results survive a TV refresh
const DKEY = 'thehundred-dismissed-votes';
const dismissed = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(DKEY) || '[]'); } catch { return []; } })());
const dismiss = (id: string) => { dismissed.add(id); try { localStorage.setItem(DKEY, JSON.stringify([...dismissed].slice(-50))); } catch { /* ignore */ } };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OPEN_MS = 3200;

// ---- NAMES: never under 44px. One size per row (the whole row shrinks together), 2 lines max, then the surname is cut.
const CW = .47;                                   // Big Shoulders Display 900 caps: average advance per em
function wrap2(name: string, cap: number): [string, string] | null {
  if (name.length <= cap) return [name, ''];
  const words = name.match(/[^ -]+[ -]?/g) || [name];
  let l1 = '', i = 0;
  while (i < words.length && (l1 + words[i]).trimEnd().length <= cap) l1 += words[i++];
  const l2 = words.slice(i).join('').trim();
  return l1 && l2 && l2.length <= cap ? [l1.trimEnd(), l2] : null;
}
function short(name: string, cap: number): [string, string] {
  const w = wrap2(name, cap); if (w) return w;
  const ws = name.split(/[ -]/).filter(Boolean), first = ws[0] ?? name, ini = ws.length > 1 ? ws[ws.length - 1][0] + '.' : '';
  if (ini && first.length + 1 + ini.length <= cap) return [first + ' ' + ini, ''];
  if (first.length <= cap) return [first, ini];
  return [first.slice(0, Math.max(1, cap - 1)) + '…', ''];
}
function layRow(names: string[], w: number, max: number, min = 44) {
  const one = Math.floor(Math.min(...names.map(n => w / (Math.max(1, n.length) * CW))));
  if (one >= Math.max(min, max * .78)) return { fs: Math.min(max, one), ok: true, lines: names.map(n => [n, ''] as [string, string]) };
  let fs = max;
  while (fs > min && !names.every(n => wrap2(n, Math.floor(w / (fs * CW))))) fs -= 2;
  fs = Math.max(fs, min);
  const cap = Math.floor(w / (fs * CW));
  return { fs, ok: names.every(n => wrap2(n, cap)), lines: names.map(n => short(n, cap)) };
}
const markFs = (name: string, w: number, max: number) => Math.floor(Math.min(max, w / (Math.max(1, name.length) * .66)));

function Face({ p, fs = 40 }: { p?: Player; fs?: number }) {
  return <div className="tr-face" style={{ fontSize: fs }}>{p?.selfie_url ? <img src={p.selfie_url} alt={p.name} draggable={false} /> : initials(p?.name ?? '?')}</div>;
}
const Lines = ({ l }: { l: [string, string] }) => <>{l[0]}{l[1] && <><br />{l[1]}</>}</>;

export function VoteOverlay({ state, vote, act, now }: { state: GameState; vote: Vote; act: Act; now: () => number }) {
  const scale = useStageScale();
  const [, force] = useState(0);
  const fresh = vote.status === 'open' && now() - Date.parse(vote.created_at) < OPEN_MS;
  const [stage, setStage] = useState<'opening' | 'live' | 'tally' | 'result'>(vote.status === 'open' ? (fresh ? 'opening' : 'live') : 'result');
  const closing = useRef(false);
  const left = Math.max(0, Date.parse(vote.ends_at) - now());
  const root = useRef<HTMLDivElement>(null);

  // the opening plays once, then the live board
  useEffect(() => {
    if (stage !== 'opening') return;
    const t = setTimeout(() => setStage(s => (s === 'opening' ? 'live' : s)), Math.max(600, OPEN_MS - (now() - Date.parse(vote.created_at))));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // time's up → close (server validates the time)
  useEffect(() => {
    if (vote.status === 'open' && left <= 0 && !closing.current) {
      closing.current = true;
      act('close_vote', { vote_id: vote.id }).catch(() => { closing.current = false; });
    }
  });
  // closed → the tally → the verdict
  const revealing = useRef(false);
  const o = vote.outcome;
  const byId = (id?: string | null) => state.players.find(p => p.id === id);
  const tallyRows = (() => {
    const ids = Object.keys(vote.counts).filter(id => id !== NO_TRIAL && byId(id)).sort((a, b) => (vote.counts[b] ?? 0) - (vote.counts[a] ?? 0));
    const rows = ids.slice(0, 7).map(id => ({ id, p: byId(id), n: vote.counts[id] ?? 0 }));
    return [...rows, { id: NO_TRIAL, p: undefined, n: vote.counts[NO_TRIAL] ?? 0 }];
  })();
  const tallyMs = 300 + tallyRows.length * 520 + 1500;
  const toVerdict = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(toVerdict.current), []);      // only on unmount: the stage change below re-runs this effect
  useEffect(() => {
    if (vote.status !== 'closed' || revealing.current || (stage !== 'live' && stage !== 'opening')) return;
    revealing.current = true;
    setStage('tally');
    toVerdict.current = setTimeout(() => setStage('result'), reduced() ? 1800 : tallyMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote.status, stage]);

  // sound on the beats
  useEffect(() => {
    if (stage === 'opening') return cues([[680, Sound.gavel], [1300, Sound.countTick], [1460, Sound.countTick], [1620, Sound.countTick]]);
    if (stage === 'tally') {
      const C: [number, () => void][] = [[0, Sound.drumroll]];
      [...tallyRows].reverse().forEach((r, k) => { for (let j = 0; j < Math.min(r.n, 12); j++) C.push([300 + k * 520 + 260 + j * 70, Sound.countTick]); });
      return cues(C);
    }
    if (stage === 'result') {
      const r = o?.result;
      if (r === 'guilty') return cues([[600, Sound.stamp], [640, Sound.gavel], [900, Sound.siren]]);
      if (r === 'innocent') return cues([[600, Sound.stamp], [1050, Sound.slap], [1300, Sound.stamp], [1900, Sound.lose]]);
      if (r === 'none' || !r) return cues([[600, Sound.stamp], [1000, Sound.down]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const ev = (state.evidence ?? []).filter(e => !e.hidden).slice(-6).map((e, i) => ({ ...e, l: LETTERS[i] }));
  const [feat, setFeat] = useState(0);
  // THE ONE LOOP: the corkboard shows one exhibit at a time, 6s each
  useEffect(() => {
    if (stage !== 'live' || ev.length < 2) return;                   // (reduced motion too: the swap has no transition there)
    const t = setInterval(() => setFeat(f => (f + 1) % ev.length), 6000);
    return () => clearInterval(t);
  }, [stage, ev.length]);

  // the entrances: every [data-fx] element is unrotated, so its keyframes are the whole transform
  useLayoutEffect(() => {
    const el = root.current; if (!el || reduced()) return;
    const A: Animation[] = [];
    const run = (sel: string, kf: Keyframe[], o: { dur?: number; delay?: number; stagger?: number; ease?: string } = {}) =>
      el.querySelectorAll(sel).forEach((n, i) => A.push(n.animate(kf, { duration: o.dur ?? 500, delay: (o.delay ?? 0) + i * (o.stagger ?? 0), easing: o.ease ?? 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' })));
    const up = (px: number) => [{ opacity: 0, transform: `translateY(${px}px)` }, { opacity: 1, transform: 'none' }];
    run('[data-fx="steno"]', [{ transform: 'translateY(-60px)' }, { transform: 'none' }], { dur: 400 });
    if (stage === 'opening') {
      run('[data-fx="gavel"]', [{ transform: 'rotate(-38deg)' }, { transform: 'rotate(-38deg)', offset: .6 }, { transform: 'rotate(6deg)', offset: .85 }, { transform: 'none' }], { dur: 800, ease: 'ease-in' });
      run('[data-fx="flash"]', [{ opacity: 0 }, { opacity: .35, offset: .1 }, { opacity: 0 }], { dur: 500, delay: 690, ease: 'ease-out' });
      run('[data-fx="bang"]', [{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'none' }], { dur: 380, delay: 680, ease: 'cubic-bezier(.3,1.5,.5,1)' });
      run('[data-fx="rise"]', up(24), { delay: 1000, stagger: 140 });
      run('[data-fx="plaque"]', up(40), { delay: 1300, stagger: 160 });
      run('[data-fx="deal"]', [{ opacity: 0, transform: 'translateY(140px) rotate(18deg)' }, { opacity: 1, transform: 'none' }], { delay: 1800, stagger: 130, dur: 600 });
    }
    if (stage === 'live') {
      run('[data-fx="cork"]', [{ opacity: 0 }, { opacity: 1 }], { dur: 300 });
      run('[data-fx="thumb"]', up(30), { delay: 500, stagger: 80 });
      run('[data-fx="slip"]', up(-30), { delay: 400, stagger: 60 });
      run('[data-fx="lu"]', up(40), { delay: 600, stagger: 50 });
    }
    if (stage === 'tally') {
      const rows = [...el.querySelectorAll<HTMLElement>('[data-fx="trow"]')].reverse();         // lowest first, the leader last
      rows.forEach((r, k) => {
        const d = 300 + k * 520;
        A.push(r.animate([{ opacity: 0, transform: 'translateX(-60px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: d, fill: 'backwards', easing: 'ease-out' }));
        r.querySelectorAll<HTMLElement>('[data-fx="mark"],[data-fx="strike"]').forEach((i, j) => A.push(i.animate(i.dataset.fx === 'mark' ? [{ transform: 'scaleY(0)' }, { transform: 'none' }] : [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 140, delay: d + 260 + j * 70, fill: 'backwards' })));
      });
      const end = 300 + rows.length * 520 + 400;
      run('[data-fx="maj"]', [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'none' }], { delay: 200, dur: 600, ease: 'ease-out' });
      run('[data-fx="majl"]', [{ opacity: 0 }, { opacity: 1 }], { delay: 500 });
      run('[data-fx="lead"]', [{ opacity: 0, transform: 'scale(1.06)' }, { opacity: 1, transform: 'none' }], { delay: end });
      run('[data-fx="leadtag"]', [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], { delay: end + 200, dur: 320, ease: 'cubic-bezier(.3,1.5,.5,1)' });
    }
    if (stage === 'result') {
      run('[data-fx="spot"]', [{ opacity: 0 }, { opacity: 1 }], { dur: 500 });
      run('[data-fx="dock"]', up(120), { dur: 600 });
      run('[data-fx="drop"]', [{ opacity: 0, transform: 'translateY(-260px)' }, { opacity: 1, transform: 'none' }], { dur: 600 });
      run('[data-fx="stamp"]', [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'none' }], { delay: 600, dur: 220, ease: 'cubic-bezier(.5,0,.8,.4)' });
      A.push(el.animate([{ transform: 'none' }, { transform: 'translate(-10px,8px)' }, { transform: 'translate(8px,-6px)' }, { transform: 'none' }], { duration: 260, delay: 820, easing: 'linear' }));   // the stamp lands: the room shakes
      run('[data-fx="badge"]', [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], { delay: 1300, dur: 260, ease: 'cubic-bezier(.5,0,.8,.4)' });
      run('[data-fx="rise"]', up(26), { delay: 1200, stagger: 150 });
      run('[data-fx="pin"]', up(-80), { delay: 1700, stagger: 140 });
      run('[data-fx="fact"]', up(40), { delay: 1600, stagger: 160 });
      run('[data-fx="band"]', [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'none' }], { delay: 1050, dur: 340, ease: 'ease-out' });
      run('[data-fx="dismiss"]', [{ opacity: 0, transform: 'scale(2)' }, { opacity: 1, transform: 'none' }], { delay: 1300, dur: 220, ease: 'cubic-bezier(.5,0,.8,.4)' });
      run('[data-fx="drinker"]', [{ opacity: 0, transform: 'translateY(-120px) rotate(-8deg)' }, { opacity: 1, transform: 'none' }], { delay: 1400, stagger: 90, dur: 480 });
    }
    return () => A.forEach(a => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // a new featured exhibit swings in
  useLayoutEffect(() => {
    const el = root.current; if (!el || reduced() || stage !== 'live') return;
    const A: Animation[] = [];
    el.querySelectorAll('.lv-feat.on [data-fx="feat"]').forEach(n => A.push(n.animate([{ opacity: 0, transform: 'scale(1.1)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: 200, fill: 'backwards', easing: 'cubic-bezier(.2,1.2,.4,1)' })));
    el.querySelectorAll('.lv-feat.on [data-fx="tag"]').forEach(n => A.push(n.animate([{ transform: 'rotate(12deg)' }, { transform: 'rotate(-3deg)', offset: .6 }, { transform: 'none' }], { duration: 900, delay: 400, fill: 'backwards', easing: 'ease-out' })));
    return () => A.forEach(a => a.cancel());
  }, [feat, stage]);

  if (dismissed.has(vote.id)) return null;
  const jesterWaiting = o?.result === 'jester' && !o.revenge;           // stays up until the Jester picks
  if (vote.status === 'closed' && !revealing.current && !jesterWaiting && now() - Date.parse(vote.ends_at) > 90e3) return null;   // old result on reload
  if (stage === 'result' && o?.result === 'jester') return <JesterRevenge state={state} vote={vote} act={act} onClose={() => { dismiss(vote.id); force(x => x + 1); }} />;
  const close = () => { dismiss(vote.id); force(x => x + 1); };

  const accused = byId(o?.accused);
  const evN = ev.length, ex = evN ? feat % evN : 0;
  const steno = stage === 'opening' ? { tag: 'COURT RECORD', a: 'THE HUNDRED v. PERSON OR PERSONS UNKNOWN', b: ' · CHARGE: SABOTAGE · ', c: `${evN} EXHIBIT${evN === 1 ? '' : 'S'} ENTERED` }
    : stage === 'live' ? { tag: 'THE TRIAL', a: "WHO'S A SABOTEUR?", b: ' · NOT SURE? VOTE NO TRIAL · ', c: 'NOT VOTING IS FINE' }
    : stage === 'tally' ? { tag: 'THE TRIAL', a: 'THE BALLOTS ARE COUNTED', b: ' · ORDER IN THE COURT · ', c: 'THE VERDICT FOLLOWS' }
    : o?.result === 'guilty' ? { tag: 'VERDICT', a: `GUILTY · ${(accused?.name ?? '').toUpperCase()}`, b: ' · SENTENCE: REHAB · ', c: 'POWERS SURRENDERED' }
    : o?.result === 'innocent' ? { tag: 'VERDICT', a: `NOT GUILTY · ${(accused?.name ?? '').toUpperCase()}`, b: ' · WRONG ACCUSATION · ', c: 'THE ACCUSERS DRINK' }
    : { tag: 'VERDICT', a: 'NO VERDICT', b: ' · THE JURY IS HUNG · ', c: 'EVERYONE WALKS' };
  const lamp = stage === 'result' && o?.result === 'guilty' ? 'radial-gradient(ellipse 50% 60% at 22% 50%, rgba(255,70,40,.16), transparent 70%), radial-gradient(ellipse 60% 50% at 66% 30%, rgba(255,60,30,.12), transparent 70%)'
    : stage === 'result' && o?.result === 'innocent' ? 'radial-gradient(ellipse 40% 50% at 14% 30%, rgba(127,227,208,.12), transparent 70%)'
    : 'radial-gradient(ellipse 60% 55% at 50% 12%, rgba(255,170,80,.16), transparent 70%)';

  return (
    <div className="jr-ov trial-ov">
      <div className="jr-stage" style={{ transform: `scale(${scale})` }}>
        <div className="tr" ref={root}>
          <div className="tr-wall" /><div className="tr-wood" />
          <div className="tr-lamp" style={{ background: lamp }} />
          <div className="tr-vig" />
          <div data-fx="steno" className="tr-steno"><b>{steno.tag}</b><span>{steno.a}</span><i>{steno.b}</i><span>{steno.c}</span></div>

          {stage === 'opening' && <Opening ev={ev} />}
          {stage === 'live' && <Live state={state} vote={vote} ev={ev} ex={ex} left={left} onEnd={() => act('close_vote', { vote_id: vote.id }).catch(() => {})} />}
          {stage === 'tally' && <Tally rows={tallyRows} total={o?.total ?? vote.voters} others={vote.options.filter(id => !((vote.counts[id] ?? 0) > 0)).length} more={Math.max(0, Object.keys(vote.counts).filter(id => id !== NO_TRIAL && (vote.counts[id] ?? 0) > 0).length - (tallyRows.length - 1))} />}
          {stage === 'result' && (
            <div className="verdict">
              {(!o || o.result === 'none') && <NoVerdict o={o} />}
              {o?.result === 'guilty' && <Guilty accused={accused} role={o.role} votes={o.votes ?? 0} total={o.total ?? 0} ev={ev} />}
              {o?.result === 'innocent' && <Innocent accused={accused} drinkers={(o.accusers ?? []).map(id => byId(id)).filter(Boolean) as Player[]} total={o.total ?? 0} ev={ev} />}
              <button className="mk-key tr-hostkey" style={{ right: 40, top: 78, height: 64, fontSize: 30, padding: '0 22px 4px' }} onClick={close}>CLOSE</button>
            </div>
          )}

          <div className="tr-grit" />
          <div data-fx="flash" style={{ position: 'absolute', inset: 0, background: '#fff6e8', opacity: 0, pointerEvents: 'none', zIndex: 8 }} />
        </div>
      </div>
    </div>
  );
}

type Ex = { id: string; image_url: string; caption: string; at: string; l: string };
const ExPhoto = ({ e }: { e: Ex }) => <img className="tr-evimg" src={e.image_url} alt="" draggable={false} />;

function Opening({ ev }: { ev: Ex[] }) {
  const n = ev.length;
  return (<>
    {ev.map((e, i) => (
      <div key={e.id} className="rot" style={{ left: Math.round(960 - n * 145 + i * 290 + 20), top: 826 + (i % 2) * 18, width: 250, transform: `rotate(${((i * 37) % 9) - 4}deg)` }}>
        <div data-fx="deal" className="tr-pol" style={{ paddingBottom: 34 }}>
          <div className="ph" style={{ height: 150 }}><ExPhoto e={e} /></div>
          <div className="tr-pin" style={{ left: 111, top: -12 }} />
          <div className="bss" style={{ position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center', fontSize: 26, color: '#c2371f' }}>EXHIBIT {e.l}</div>
        </div>
      </div>
    ))}
    <div className="rot" style={{ right: 40, top: 150, width: 360, height: 300 }}>
      <svg data-fx="gavel" viewBox="0 0 360 300" width="360" height="300" style={{ overflow: 'visible', transformOrigin: '300px 250px' }} aria-label="A judge's gavel">
        <rect x="150" y="54" width="150" height="26" rx="10" transform="rotate(-24 60 110)" fill="#6e3e1c" stroke="#120904" strokeWidth="6" />
        <g transform="rotate(-24 60 110)">
          <rect x="18" y="18" width="130" height="96" rx="16" fill="#8a4e22" stroke="#120904" strokeWidth="6" />
          <rect x="36" y="18" width="16" height="96" fill="#d4a44a" stroke="#120904" strokeWidth="4" />
          <rect x="114" y="18" width="16" height="96" fill="#d4a44a" stroke="#120904" strokeWidth="4" />
          <path d="M28 32 H138" stroke="#f0c890" strokeWidth="5" opacity=".45" />
        </g>
      </svg>
    </div>
    <svg viewBox="0 0 260 110" width="260" height="110" style={{ position: 'absolute', right: 100, top: 400 }} aria-hidden="true">
      <ellipse cx="130" cy="80" rx="122" ry="26" fill="#2a1709" stroke="#000" strokeWidth="5" />
      <rect x="8" y="40" width="244" height="40" fill="#5a3418" stroke="#000" strokeWidth="5" />
      <ellipse cx="130" cy="40" rx="122" ry="26" fill="#7a4a24" stroke="#000" strokeWidth="5" />
    </svg>
    <div data-fx="rise" className="op-kick">ALL RISE · THE COURT IS IN SESSION</div>
    <div data-fx="bang" className="op-title bsd">THE TRIAL</div>
    <div data-fx="rise" className="op-q">Who's a Saboteur?</div>
    <div className="op-rules">
      <div data-fx="plaque" className="tr-plaque bsd"><span className="n">1</span><span className="t">VOTE ON<br />YOUR PHONE</span></div>
      <div data-fx="plaque" className="tr-plaque bsd"><span className="n">2</span><span className="t">CLEAR MAJORITY<br />→ THE DOCK</span></div>
      <div data-fx="plaque" className="tr-plaque bsd"><span className="n">3</span><span className="t">INNOCENT? THE<br />ACCUSERS DRINK</span></div>
    </div>
    <div data-fx="rise" className="op-evline">{n ? 'ENTERED INTO EVIDENCE: ' : 'NO EVIDENCE FILED YET. '}<b>{n ? `${n} ANONYMOUS EXHIBIT${n === 1 ? '' : 'S'}` : 'SNAP ONE ON YOUR PHONE'}</b></div>
  </>);
}

function Live({ state, vote, ev, ex, left, onEnd }: { state: GameState; vote: Vote; ev: Ex[]; ex: number; left: number; onEnd: () => void }) {
  const ps = vote.options.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
  const n = Math.max(1, ps.length);
  const now = Date.now();
  // who can vote: carded, not in rehab, not in the Locker (a count, never a list)
  const total = Math.max(vote.voters, state.players.filter(p => p.has_role && !p.rehab && !(p.locked_until && Date.parse(p.locked_until) > now)).length);
  const secs = Math.ceil(left / 1000);
  const capFs = (c: string) => c.length <= 18 ? 66 : c.length <= 30 ? 56 : c.length <= 50 ? 48 : 42;
  const cellW = Math.min(170, 1800 / n), luS = Math.max(110, Math.min(116, cellW - 14));
  const lay = layRow(ps.map(p => p.name.toUpperCase()), cellW - 6, 44, 44);
  return (<>
    <div className="lv-head bsd">VOTE ON YOUR PHONE</div>
    <div className="lv-timer"><div className={'tr-clock' + (secs <= 10 ? ' danger' : '')}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</div></div>
    <button className="mk-key tr-hostkey" style={{ right: 330, top: 92, height: 64, fontSize: 30, padding: '0 22px 4px' }} onClick={onEnd}>END VOTE NOW</button>

    <div data-fx="cork" className="tr-cork" style={{ left: 66, top: 232, width: 1196, height: 594 }}>
      {ev.length > 0 ? <>
        <div className="lv-label" style={{ left: 30, top: 18, transform: 'rotate(-3deg)' }}>EVIDENCE · {ev.length} EXHIBIT{ev.length === 1 ? '' : 'S'}</div>
        {ev.map((e, i) => (
          <div key={e.id} className={'lv-feat' + (i === ex ? ' on' : '')}>
            <div className="rot" style={{ left: 34, top: 104, width: 574, transform: 'rotate(-2deg)' }}>
              <div data-fx="feat" className="tr-pol" style={{ padding: '16px 16px 40px' }}>
                <div className="ph" style={{ height: 406 }}><ExPhoto e={e} /></div>
                <div className="tr-pin" style={{ left: 273, top: -12 }} />
              </div>
            </div>
            <div className="rot" style={{ left: 652, top: 100, width: 512, transform: 'rotate(2.5deg)', transformOrigin: '30px 50%' }}>
              <div data-fx="tag" className="tr-tag" style={{ padding: '30px 30px 30px 70px', transformOrigin: '30px 50%' }}>
                <div className="hole" />
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}><div className="ex">EXHIBIT</div><div className="letter" style={{ fontSize: 150 }}>{e.l}</div></div>
                <div className="rule" />
                <div className="capt" style={{ fontSize: capFs(e.caption || 'NO CAPTION') }}>{e.caption || 'no caption'}</div>
                <div className="anon">FILED ANONYMOUSLY</div>
              </div>
            </div>
          </div>
        ))}
        <div className="evidence-col">
          {ev.map((e, i) => (
            <div key={e.id} className="rot" style={{ left: 560 + i * 104, top: 12, width: 88, height: 82, transform: `rotate(${((i * 37) % 7) - 3}deg)` }}>
              <div data-fx="thumb" className={'lv-thumb ev' + (i === ex ? ' on' : '')}><div className="ph"><ExPhoto e={e} /></div><div className="l">{e.l}</div></div>
            </div>
          ))}
        </div>
      </> : <>
        <div className="lv-label" style={{ left: 30, top: 18, transform: 'rotate(-3deg)' }}>EVIDENCE · NONE YET</div>
        <div className="rot" style={{ left: 170, top: 110, width: 860, transform: 'rotate(-1.5deg)' }}>
          <div className="lv-empty">
            <div className="tr-pin" style={{ left: 416, top: -12 }} />
            <h3 className="bsd">NO EXHIBITS YET</h3>
            <p>Caught someone pouring a pint away? Tap <b>EVIDENCE</b> on your phone and snap it. It goes up here next Trial. Nobody sees it was you.</p>
          </div>
        </div>
      </>}
    </div>

    {/* the ballot box: a count only, never per suspect */}
    <div className="tr-panel" style={{ left: 1302, top: 232, width: 552, height: 400 }}>
      <div className="lv-bk">BALLOTS IN</div>
      <div className="lv-count"><div className="lv-num">{vote.voters}</div><div className="of bsd">OF {total}</div></div>
      <div className="lv-slips" style={{ top: total > 7 ? 204 : 236 }}>
        {Array.from({ length: Math.min(total, 16) }, (_, i) => <div key={i} data-fx={i < vote.voters ? 'slip' : undefined} className={'tr-slip ' + (i < vote.voters ? 'in' : 'out')} />)}
      </div>
      <div className="lv-slipnote" style={{ top: 354 }}>SECRET BALLOT</div>
    </div>
    <div className="lv-rules" style={{ left: 1302, top: 652, width: 552 }}>
      <div className="tr-plaque bsd"><span className="t">MAJORITY → THE DOCK</span></div>
      <div className="tr-plaque bsd"><span className="t">WRONG? ACCUSERS DRINK</span></div>
    </div>

    {/* the line-up: faces (and names at 44px or more when they all fit). No numbers until the tally. */}
    <div className="lv-lineup">
      <div className="lv-lulabel">{lay.ok ? 'THE LINE-UP · PICK ON YOUR PHONE' : 'THE LINE-UP · NAMES ARE ON YOUR PHONE'}</div>
      {ps.map((p, k) => (
        <div key={p.id} data-fx="lu" className="lv-cell" style={{ left: Math.round(60 + k * cellW + (1800 - n * cellW) / 2), top: lay.ok ? 20 : 44, width: Math.round(cellW) }}>
          <div className="pf" style={{ width: luS, height: luS, transform: `rotate(${((k * 53) % 7) - 3}deg)` }}><Face p={p} fs={48} /></div>
          {lay.ok && <div className="nm bsd" style={{ fontSize: lay.fs }}><Lines l={lay.lines[k]} /></div>}
        </div>
      ))}
    </div>
  </>);
}

function Tally({ rows, total, others, more }: { rows: { id: string; p?: Player; n: number }[]; total: number; others: number; more: number }) {
  const V = Math.max(1, total), need = Math.floor(V / 2) + 1;
  const cols = rows.length > 6 ? 2 : 1, perCol = Math.ceil(rows.length / cols), colW = cols === 1 ? 1680 : 860;
  const rowH = Math.min(128, 620 / perCol), faceS = Math.min(104, rowH - 16);
  const nameW = cols === 1 ? 520 : 320, gate = 136, step = 25;
  const names = rows.map(r => (r.p ? r.p.name.toUpperCase() : 'NO TRIAL'));
  const tLay = layRow(names, nameW - 30, cols === 1 ? 72 : 56, 44);
  const marks = (c: number) => { const out: { x: number; d: string; fx: string; st: CSSProperties }[] = []; for (let k = 0; k < Math.min(c, 15); k++) { const g = k / 5 | 0, p = k % 5; out.push(p < 4 ? { x: g * gate + p * step, d: '', fx: 'mark', st: { transform: `rotate(${((k * 7) % 5) - 2}deg)` } } : { x: g * gate - 12, d: 'd', fx: 'strike', st: { width: 4 * step + 22, transform: 'rotate(-24deg) translateY(18px)' } }); } return out; };
  const markX = (c: number) => { const k = c - 1, g = k / 5 | 0, p = k % 5; return g * gate + Math.min(p, 3) * step + 10; };
  const lay = rows.map((r, k) => { const col = k / perCol | 0, rk = k % perCol; return { ...r, x: 40 + col * (colW + 40), y: 60 + rk * (rowH + 12) }; });
  const lead = lay[0], clear = lead && lead.id !== NO_TRIAL && lead.n >= need && lead.n > (lay[1]?.n ?? -1);
  const mX = 40 + faceS + nameW + markX(Math.min(need, 15)) + 14;
  return (<>
    <div className="ta-head">
      <div><div className="k">THE JURY HAS VOTED</div><div className="t bsd">THE TALLY</div></div>
      <div className="r"><b>{total}</b> VOTE{total === 1 ? '' : 'S'} CAST<br />{need} NEEDED TO SEND SOMEONE TO THE DOCK</div>
    </div>
    <div className="tr-slate">
      {lead && <div data-fx="lead" className={'ta-lead' + (clear ? '' : ' hung')} style={{ left: lead.x - 20, top: lead.y - 8, width: colW + 10, height: rowH + 16 }} />}
      {cols === 1 && need <= 15 && <>
        <div data-fx="maj" className="ta-maj" style={{ left: mX, top: 40, height: 60 + lay.length * (rowH + 12) - 20 }} />
        <div data-fx="majl" className="ta-majl" style={{ left: mX - 110, top: 4 }}>{need} TO CONVICT</div>
      </>}
      {lay.map((r, k) => (
        <div key={r.id} data-fx="trow" className="ta-row" style={{ left: r.x, top: r.y, height: rowH }}>
          {r.p ? <div className="pf" style={{ width: faceS, height: faceS, transform: `rotate(${((k * 53) % 7) - 3}deg)` }}><Face p={r.p} fs={40} /></div>
            : <div className="x bsd" style={{ width: faceS, height: faceS }}>✕</div>}
          <div className={'nm bsd' + (r.p ? '' : ' none')} style={{ width: nameW, fontSize: tLay.fs }}><Lines l={tLay.lines[k]} /></div>
          <div className="ta-marks" style={{ width: 3 * gate }}>{marks(r.n).map((m, j) => <div key={j} className={'ta-mk ' + m.d} style={{ left: m.x, ...m.st }}><i data-fx={m.fx} /></div>)}</div>
          <div className="num bsd" style={{ width: 110 }}>{r.n}</div>
        </div>
      ))}
      {lead && <div className="rot" style={{ left: clear ? 1380 : 1300, top: lead.y + rowH / 2 - 32, transform: 'rotate(-3deg)' }}>
        <div data-fx="leadtag" className={'ta-leadtag bsd' + (clear ? '' : ' hung')}>{clear ? 'TO THE DOCK →' : 'NO CLEAR MAJORITY'}</div>
      </div>}
      {(others > 0 || more > 0) && <div className="ta-foot">{[more > 0 && `+${more} MORE WITH A VOTE OR TWO`, others > 0 && `${others} OTHER${others === 1 ? '' : 'S'}: NO VOTES`].filter(Boolean).join(' · ')}</div>}
    </div>
  </>);
}

const ICONS = { bolt: 'M13 2L4 14h7l-1 8 9-12h-7zM3 3l18 18', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', wheel: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4' };

function Guilty({ accused, role, votes, total, ev }: { accused?: Player; role?: string; votes: number; total: number; ev: Ex[] }) {
  const name = (accused?.name ?? '?').toUpperCase();
  const cap = name.length > 10 ? name.split(/[ -]/)[0] : name;
  const nameFs = Math.floor(Math.min(150, 1120 / (Math.max(1, name.length) * CW)));
  const roleLabel = (role ? ROLES[role as keyof typeof ROLES]?.label ?? 'SABOTEUR' : 'SABOTEUR').toUpperCase();
  const caseEv = ev.slice(-3);
  return (<>
    <div data-fx="spot" className="vd-spot" style={{ background: 'radial-gradient(ellipse 26% 70% at 19% 40%, rgba(255,236,200,.16), transparent 70%)' }} />
    <div className="vd-kick" style={{ left: 90, top: 92 }}>THE TRIAL · THE VERDICT</div>
    <div className="tr-dock" style={{ left: 60, top: 712, width: 600, height: 380 }}><div className="dk-panel" style={{ left: 30, width: 255 }} /><div className="dk-panel" style={{ right: 30, width: 255 }} /></div>
    {caseEv.length > 0 && <div className="tr-brass" style={{ left: 196, top: 738 }}>THE CASE AGAINST</div>}
    {caseEv.map((e, i) => (
      <div key={e.id} className="rot" style={{ left: 84 + i * 196, top: 800 + (i % 2) * 14, width: 180, transform: `rotate(${[-5, 3, -2][i]}deg)` }}>
        <div data-fx="pin" className="tr-pol" style={{ padding: '8px 8px 30px' }}>
          <div className="ph" style={{ height: 124 }}><ExPhoto e={e} /></div>
          <div className="tr-pin" style={{ left: 76, top: -10, width: 24, height: 24 }} />
          <div className="bss" style={{ position: 'absolute', left: 0, right: 0, bottom: 3, textAlign: 'center', fontSize: 24, color: '#c2371f' }}>EXHIBIT {e.l}</div>
        </div>
      </div>
    ))}
    <div className="rot" style={{ left: 150, top: 150, width: 400, transform: 'rotate(-3deg)' }}>
      <div data-fx="drop" className="tr-pol" style={{ padding: '16px 16px 0' }}>
        <div className="ph" style={{ height: 368 }}><Face p={accused} fs={140} /></div>
        <div className="cap" style={{ fontSize: markFs(cap, 290, 64), height: 84, lineHeight: '84px', paddingRight: 60 }}>{cap}</div>
        <div className="tr-pin" style={{ left: 186, top: -12 }} />
      </div>
    </div>
    {role && <div className="rot" style={{ left: 470, top: 400, width: 150, height: 184, transform: 'rotate(7deg)' }}>
      <div data-fx="badge" className="vd-badge"><Mugshot role={role} style={{ display: 'block', width: '100%', height: '100%' }} /></div>
    </div>}
    <div className="rot" style={{ left: 700, top: 116, transform: 'rotate(-4deg)' }}>
      <div data-fx="stamp" className="tr-stamp bss" style={{ ['--sc' as any]: '#ff4a2e', ['--glow' as any]: 'rgba(255,60,30,.35)', fontSize: 300 }}>GUILTY</div>
    </div>
    <div data-fx="rise" className="vd-line" style={{ left: 724, top: 494, fontSize: 40, letterSpacing: '.2em', color: '#ff8a70' }}>CAUGHT</div>
    <div data-fx="rise" className="vd-name bsd" style={{ left: 720, top: 546, fontSize: nameFs }}>{name}</div>
    <div data-fx="rise" className="vd-name bsd" style={{ left: 722, top: 546 + nameFs * .9 + 6, fontSize: 80, color: '#ff4a2e' }}>WAS THE {roleLabel}</div>
    <div data-fx="rise" className="vd-line" style={{ left: 724, top: 546 + nameFs * .9 + 100, fontSize: 36 }}>CONVICTED BY {votes} OF {total} VOTES</div>
    <div className="vd-conseq" style={{ left: 690, right: 60, top: 884 }}>
      {[{ d: ICONS.bolt, t: 'POWERS GONE' }, { d: ICONS.lock, t: 'OFF TO REHAB' }, { d: ICONS.wheel, t: 'TO THE WHEEL' }].map(f => (
        <div key={f.t} data-fx="fact" className="vd-fact"><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="#d2c8b0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={f.d} /></svg></div><div className="tx bsd">{f.t}</div></div>
      ))}
    </div>
  </>);
}

function Innocent({ accused, drinkers, total, ev }: { accused?: Player; drinkers: Player[]; total: number; ev: Ex[] }) {
  const name = (accused?.name ?? '?').toUpperCase();
  const D = drinkers.length, compact = D > 7;
  const ic = compact
    ? { polW: 236, capFs: markFs(name, 200, 48), capH: 52, x: 400, stampFs: 168, lineY: 356, lineFs: 34, bandY: 420, bandH: 88, bandFs: 56, exW: 140, exY: 296, dismX: 1610, dismY: 262 }
    : { polW: 300, capFs: markFs(name, 266, 56), capH: 62, x: 470, stampFs: 230, lineY: 428, lineFs: 44, bandY: 516, bandH: 104, bandFs: 64, exW: 150, exY: 392, dismX: 1620, dismY: 352 };
  const dismissedEv = ev.slice(-2);
  const rowsDr = compact ? [Math.ceil(D / 2), Math.floor(D / 2)] : [D];
  const dS = compact ? 118 : D <= 4 ? 230 : 196;
  const dCell = Math.min(compact ? 250 : 300, 1840 / Math.max(1, rowsDr[0]));
  const dLay = layRow(drinkers.map(p => p.name.toUpperCase()), dCell - 16, compact ? 48 : 64, 44);
  let di = 0;
  const cells: { p: Player; x: number; y: number; k: number }[] = [];
  rowsDr.forEach((cnt, row) => {
    const x0 = (1920 - cnt * dCell) / 2, y = (compact ? 540 : 690) + row * 272;
    for (let k = 0; k < cnt; k++, di++) cells.push({ p: drinkers[di], x: Math.round(x0 + k * dCell), y, k: di });
  });
  return (<>
    <div data-fx="spot" className="vd-spot" style={{ background: 'radial-gradient(ellipse 22% 40% at 13% 26%, rgba(255,236,200,.14), transparent 70%)' }} />
    <div className="rot" style={{ left: 96, top: 96, width: ic.polW, transform: 'rotate(-4deg)' }}>
      <div data-fx="drop" className="tr-pol" style={{ padding: '12px 12px 0' }}>
        <div className="ph" style={{ height: ic.polW - 24 }}><Face p={accused} fs={100} /></div>
        <div className="cap" style={{ fontSize: ic.capFs, height: ic.capH, lineHeight: ic.capH + 'px' }}>{name}</div>
        <div className="tr-pin" style={{ left: ic.polW / 2 - 14, top: -12 }} />
      </div>
    </div>
    <div className="vd-kick" style={{ left: ic.x, top: 88 }}>THE TRIAL · THE VERDICT</div>
    <div className="rot" style={{ left: ic.x - 16, top: 136, transform: 'rotate(-3deg)' }}>
      <div data-fx="stamp" className="tr-stamp bss" style={{ ['--sc' as any]: '#7fe3d0', ['--glow' as any]: 'rgba(127,227,208,.22)', fontSize: ic.stampFs }}>NOT GUILTY</div>
    </div>
    <div data-fx="rise" className="vd-line" style={{ left: ic.x, top: ic.lineY, fontSize: ic.lineFs }}><b>{name}</b> WALKS FREE. {D} OF {Math.max(D, total)} GOT IT WRONG.</div>
    {dismissedEv.map((e, i) => (
      <div key={e.id} className="rot" style={{ left: 1600 + i * (ic.exW - 6), top: ic.exY + i * 10, width: ic.exW, transform: `rotate(${i ? 6 : -5}deg)` }}>
        <div className="tr-pol" style={{ padding: '8px 8px 26px' }}><div className="ph" style={{ height: ic.exW * .7 }}><ExPhoto e={e} /></div>
          <div className="tr-pin" style={{ left: ic.exW / 2 - 12, top: -10, width: 24, height: 24 }} /></div>
      </div>
    ))}
    <div data-fx="band" className="vd-band" style={{ top: ic.bandY, height: ic.bandH }}><span className="bsd" style={{ fontSize: ic.bandFs }}>WRONG ACCUSATION · <b>{D === 1 ? 'THIS ONE DRINKS' : `THESE ${D} DRINK`}</b></span></div>
    {dismissedEv.length > 0 && <div className="rot" style={{ left: ic.dismX, top: ic.dismY, transform: 'rotate(-9deg)' }}><div data-fx="dismiss" className="vd-dismiss bss">DISMISSED</div></div>}
    {cells.map(c => (
      <div key={c.p.id} data-fx="drinker" className="vd-drinker" style={{ left: c.x, top: c.y, width: Math.round(dCell) }}>
        <div className="pf" style={{ width: dS, height: dS, transform: `rotate(${((c.k * 53) % 7) - 3}deg)` }}><div className="ph"><Face p={c.p} fs={60} /></div><div className="dr bss" style={{ fontSize: compact ? 24 : 32 }}>DRINK</div></div>
        <div className="nm bsd" style={{ fontSize: dLay.fs }}><Lines l={dLay.lines[c.k]} /></div>
      </div>
    ))}
  </>);
}

function NoVerdict({ o }: { o: Vote['outcome'] }) {
  const V = o?.total ?? 0;
  return (<>
    <div className="vd-cone" />
    <div className="vd-kick" style={{ left: 0, right: 0, textAlign: 'center', top: 96 }}>THE TRIAL · THE VERDICT</div>
    <div className="rot" style={{ left: 0, right: 0, top: 146, textAlign: 'center', transform: 'rotate(-3deg)' }}>
      <div data-fx="stamp" className="tr-stamp bss" style={{ ['--sc' as any]: '#f1e8d4', ['--glow' as any]: 'rgba(241,232,212,.12)', fontSize: 210 }}>{V ? 'NO VERDICT' : 'NOBODY VOTED'}</div>
    </div>
    <div data-fx="rise" className="vd-line" style={{ left: 0, right: 0, top: 432, textAlign: 'center', fontSize: 44 }}>{V ? `A hung jury: the most anyone got was ${o?.votes ?? 0} of ${V} votes.` : 'Not one ballot was cast.'}</div>
    <div data-fx="rise" className="vd-name bsd" style={{ left: 0, right: 0, top: 500, textAlign: 'center', fontSize: 84, color: '#ffb866' }}>EVERYONE WALKS… FOR NOW</div>
    <div data-fx="dock" className="tr-dock" style={{ left: 460, top: 700, width: 1000, height: 400 }}><div className="dk-panel" style={{ left: 40, width: 290 }} /><div className="dk-panel" style={{ left: 355, width: 290 }} /><div className="dk-panel" style={{ right: 40, width: 290 }} /></div>
    <div className="tr-brass" style={{ left: '50%', top: 770, transform: 'translateX(-50%)', fontSize: 40, padding: '14px 34px 12px' }}>THE DOCK · EMPTY</div>
  </>);
}
