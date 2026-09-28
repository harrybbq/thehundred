// TV: Jester's Revenge. Plays when a Trial convicts the Jester (design TV-13).
// Lights die, two eyes open, a strobe, then the Jester's own selfie (in jester makeup)
// slams into a gilded arch. While they pick on their phone, their accusers shiver along
// the bottom; once they pick, strings shoot out and yank the victim up: "TAKES A ×3".
// Built on a fixed 1920×1080 stage scaled to the screen, like the design.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameState, Player, Vote } from '../lib/types';
import type { Act } from './TvRoom';
import { initials } from '../lib/util';
import { Sound } from '../fx/sound';

type Fx = (sel: string, kf: Keyframe[], o: KeyframeAnimationOptions & { stagger?: number }) => void;

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const CROCKETS = Array.from({ length: 6 }, (_, i) => {
  const t = (i + 1) / 7 * 71 * Math.PI / 180;
  return [{ x: Math.round(495 - Math.cos(t) * 495), y: Math.round(480 - Math.sin(t) * 495) },
          { x: Math.round(165 + Math.cos(t) * 495), y: Math.round(480 - Math.sin(t) * 495) }];
}).flat();
const LAUGHS = [{ x: 640, y: 170, s: 44, r: -12 }, { x: 700, y: 250, s: 32, r: 8 }, { x: 60, y: 300, s: 38, r: -6 }, { x: 610, y: 560, s: 30, r: 14 }];
const TILTS = ['-3deg', '2deg', '-1deg', '3deg', '-2deg', '1deg'];
const SWAYS = ['-8deg', '6deg', '-4deg', '9deg', '-6deg', '5deg'];

function Photo({ p, className = '' }: { p?: Player; className?: string }) {
  return p?.selfie_url
    ? <img className={'jr-photo ' + className} src={p.selfie_url} alt={p.name} draggable={false} />
    : <div className={'jr-photo jr-blank ' + className}>{initials(p?.name ?? '?')}</div>;
}

export function JesterRevenge({ state, vote, act, onClose }: { state: GameState; vote: Vote; act: Act; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const o = vote.outcome!;
  const byId = (id?: string) => state.players.find(p => p.id === id);
  const jester = byId(o.accused);
  const victim = byId(o.revenge);
  const times = state.queue.find(q => q.player_id === o.revenge && q.times > 1)?.times ?? 3;
  const allVoters = (o.accusers ?? []).filter(id => id !== o.revenge).map(byId).filter(Boolean) as Player[];
  const voters = allVoters.slice(0, 6);

  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1920, innerHeight / 1080));
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);

  const fx: Fx = (sel, kf, opt) => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>(`[data-fx=${sel}]`) ?? [])];
    els.forEach((el, i) => el.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)', ...opt, delay: (opt.delay as number || 0) + (opt.stagger || 0) * i }));
  };

  // ---- act 1: the unmasking (on mount) ----
  const amb = useRef<number>();
  useLayoutEffect(() => {
    if (reduced()) return;
    fx('black', [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: .9, offset: .5 }, { opacity: 1, offset: .55 }, { opacity: 1, offset: .96 }, { opacity: 0 }], { duration: 2000, easing: 'linear' });
    fx('eyes', [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(.2)', offset: .3 }, { opacity: 1, transform: 'scaleY(1)', offset: .45 }, { opacity: 1, transform: 'scaleY(.1)', offset: .55 }, { opacity: 1, transform: 'scaleY(1.2)', offset: .7 }, { opacity: 0, transform: 'scaleY(1.2)' }], { duration: 1500, delay: 500, easing: 'linear' });
    fx('flash', [{ opacity: 0 }, { opacity: .95 }, { opacity: 0 }, { opacity: .8 }, { opacity: 0 }], { duration: 520, delay: 1950, easing: 'steps(4, jump-none)' });
    fx('stage', [{ transform: 'none' }, { transform: 'translate(-18px,10px) rotate(-.6deg)' }, { transform: 'translate(16px,-8px) rotate(.5deg)' }, { transform: 'translate(-10px,4px)' }, { transform: 'translate(6px,-2px)' }, { transform: 'none' }], { duration: 600, delay: 2000, easing: 'linear', fill: 'none' });
    fx('arch', [{ opacity: 0, transform: 'scale(1.22)', filter: 'brightness(3) contrast(1.6)' }, { opacity: 1, transform: 'scale(.98)', filter: 'brightness(1.6) contrast(1.3)', offset: .45 }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 900, delay: 2000 });
    fx('laugh', [{ opacity: 0, transform: 'scale(.4)' }, { opacity: .9, transform: 'scale(1.5)', offset: .25 }, { opacity: 0, transform: 'translateY(-90px) scale(1)' }], { duration: 1600, delay: 2150, stagger: 140, easing: 'ease-out', fill: 'none' });
    fx('t0', [{ opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.34em' }], { duration: 900, delay: 2700 });
    fx('t1', [{ opacity: 0, transform: 'translateY(-80px) skewX(-8deg)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2850, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    fx('t2', [{ opacity: 0, transform: 'scale(1.6)', textShadow: '-14px 0 0 #c2371f,14px 0 0 #2c6e74' }, { opacity: 1, transform: 'scale(.96)', textShadow: '-6px 0 0 #c2371f,6px 0 0 #2c6e74', offset: .5 }, { opacity: .5, transform: 'translateX(8px)', offset: .62 }, { opacity: 1, transform: 'none', textShadow: '0 3px 0 #3a2414,0 0 2px #fff4d8,0 0 24px #ff8a1e,0 0 80px rgba(255,120,30,.55)' }], { duration: 800, delay: 3150, easing: 'linear' });
    fx('t3', [{ opacity: 0 }, { opacity: 1 }], { duration: 1200, delay: 3900, easing: 'ease-in' });
    fx('voters', [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none', offset: .3 }, { transform: 'translateX(-5px)', offset: .45 }, { transform: 'translateX(5px)', offset: .55 }, { transform: 'translateX(-4px)', offset: .65 }, { transform: 'translateX(3px)', offset: .75 }, { opacity: 1, transform: 'none' }], { duration: 1400, delay: 3400 });
    fx('waiting', [{ opacity: 0 }, { opacity: 1 }], { duration: 800, delay: 4400 });
    const t1 = setTimeout(() => { Sound.staticNoise(); }, 400);
    const t2 = setTimeout(() => { Sound.gavel(); Sound.scrooge(); }, 2000);
    amb.current = window.setTimeout(() => {
      const q = (s: string) => [...(root.current?.querySelectorAll<HTMLElement>(`[data-fx=${s}]`) ?? [])];
      q('candle').forEach((el, i) => el.animate([{ opacity: 1 }, { opacity: .82 }, { opacity: .95 }, { opacity: .75 }, { opacity: 1 }], { duration: 1700 + i * 400, iterations: Infinity }));
      q('t2').forEach(el => el.animate([{ opacity: 1 }, { opacity: 1, offset: .4 }, { opacity: .55, offset: .42 }, { opacity: 1, offset: .45 }, { opacity: 1 }], { duration: 5200, iterations: Infinity, composite: 'add' }));
      q('laugh').forEach((el, i) => el.animate([{ transform: 'translateY(0) scale(.9)', opacity: 0 }, { opacity: .6, offset: .2 }, { transform: 'translateY(-60px) scale(1.1)', opacity: 0 }], { duration: 2600, delay: i * 520, iterations: Infinity, easing: 'ease-out' }));
    }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(amb.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- act 2: the revenge (when the Jester picks; after act 1 if it's already picked) ----
  const mountedAt = useRef(performance.now());
  useLayoutEffect(() => {
    if (!o.revenge || reduced()) return;
    const base = Math.max(0, 4300 - (performance.now() - mountedAt.current));
    fx('bar', [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: base });
    fx('taut', [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 260, delay: base + 100, stagger: 80, easing: 'ease-in' });
    root.current?.querySelectorAll<HTMLElement>('[data-fx=dangle]').forEach(el => {
      el.animate([{ opacity: 0, transform: 'translateY(520px) rotate(-20deg)' }, { opacity: 1, transform: 'translateY(-30px) rotate(10deg)', offset: .55 }, { transform: 'translateY(8px) rotate(1deg)', offset: .78 }, { opacity: 1, transform: 'rotate(4deg)' }], { duration: 750, delay: base + 350, fill: 'backwards', easing: 'cubic-bezier(.2,.9,.3,1)' })
        .finished.then(() => el.animate([{ transform: 'rotate(2deg)' }, { transform: 'rotate(6deg)' }], { duration: 1800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' })).catch(() => {});
    });
    fx('flash', [{ opacity: 0 }, { opacity: .5 }, { opacity: 0 }], { duration: 300, delay: base + 400, easing: 'linear', fill: 'none', composite: 'add' });
    fx('victim', [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: base + 900 });
    fx('mult', [{ opacity: 0, transform: 'scale(3.4) rotate(-14deg)' }, { opacity: 1, transform: 'scale(.9) rotate(-2deg)', offset: .55 }, { transform: 'scale(1.06) rotate(-4deg)', offset: .75 }, { opacity: 1, transform: 'rotate(-3deg)' }], { duration: 650, delay: base + 1500, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    fx('stage', [{ transform: 'none' }, { transform: 'translate(-8px,6px)' }, { transform: 'translate(6px,-4px)' }, { transform: 'none' }], { duration: 320, delay: base + 1850, easing: 'linear', fill: 'none' });
    fx('close', [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: base + 2700 });
    const t1 = setTimeout(() => Sound.thud(), base + 400);
    const t2 = setTimeout(() => Sound.siren(), base + 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.revenge]);

  return (
    <div className="jr-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="jr-scene" data-fx="stage">
          <div className="jr-glow" />
          <div className="jr-candle" data-fx="candle" />

          <div className="jr-arch" data-fx="arch">
            <div className="jr-arch-glow" data-fx="candle" />
            <div className="jr-window">
              {jester?.selfie_url
                ? <>
                    <img className="jr-selfie" src={jester.selfie_url} alt={jester.name} draggable={false} />
                    <img className="jr-makeup" src="/assets/jester-makeup.svg" alt="" draggable={false} />
                  </>
                : <img className="jr-standin" src="/assets/jester.svg" alt="The Jester" draggable={false} />}
              <div className="jr-vignette" />
              <div className="jr-window-candle" data-fx="candle" />
              <div className="jr-grain" />
            </div>
            <svg viewBox="0 0 660 960" className="jr-frame">
              <path d="M 0 960 L 0 480 A 495 495 0 0 1 330 13 A 495 495 0 0 1 660 480 L 660 960" fill="none" stroke="#000" strokeWidth="30" />
              <path d="M 0 960 L 0 480 A 495 495 0 0 1 330 13 A 495 495 0 0 1 660 480 L 660 960" fill="none" stroke="#2a1d14" strokeWidth="24" />
              <path d="M -10 960 L -10 480 A 505 505 0 0 1 330 2 A 505 505 0 0 1 670 480 L 670 960" fill="none" stroke="#e0b458" strokeWidth="2" />
              <path d="M 20 960 L 20 480 A 464 464 0 0 1 330 42 A 464 464 0 0 1 640 480 L 640 960" fill="none" stroke="#e0b458" strokeWidth="3" />
              <g transform="translate(330,80)" fill="#140806" stroke="#e0b458" strokeWidth="3"><circle cx="0" cy="-18" r="16" /><circle cx="0" cy="18" r="16" /><circle cx="-18" cy="0" r="16" /><circle cx="18" cy="0" r="16" /><circle cx="0" cy="0" r="7" fill="#ffd84a" stroke="none" /></g>
              {CROCKETS.map((k, i) => <circle key={i} cx={k.x} cy={k.y} r="6" fill="#e0b458" stroke="#000" strokeWidth="2" />)}
            </svg>
            <div className="jr-plaque">
              <div className="jr-mini"><Photo p={jester} /><div className="jr-mini-stamp">Jester</div></div>
              <div>
                <div className="jr-sc">UNMASKED</div>
                <div className="jr-plaque-name">{jester?.name ?? 'The Jester'}, the Jester</div>
              </div>
            </div>
          </div>

          {o.revenge && (
            <svg viewBox="0 0 1920 1080" className="jr-strings">
              <path d="M 730 480 L 900 612" stroke="#000" strokeOpacity=".6" strokeWidth="6" transform="translate(3,5)" />
              <path d="M 730 480 L 1080 626" stroke="#000" strokeOpacity=".6" strokeWidth="6" transform="translate(3,5)" />
              <path data-fx="taut" pathLength={1} strokeDasharray="1" d="M 730 480 L 900 612" stroke="#c2371f" strokeWidth="3" />
              <path data-fx="taut" pathLength={1} strokeDasharray="1" d="M 730 480 L 1080 626" stroke="#c2371f" strokeWidth="3" />
              <g data-fx="bar" transform="translate(660,480)"><rect x="-110" y="-9" width="180" height="18" fill="#3a2414" stroke="#000" strokeWidth="3" /><rect x="-9" y="-70" width="18" height="140" fill="#3a2414" stroke="#000" strokeWidth="3" /><rect x="-110" y="-9" width="180" height="4" fill="#e0b458" opacity=".7" /><circle cx="70" cy="0" r="9" fill="#e0b458" stroke="#000" strokeWidth="3" /><circle cx="-110" cy="0" r="8" fill="#e0b458" stroke="#000" strokeWidth="3" /><circle cx="0" cy="70" r="8" fill="#e0b458" stroke="#000" strokeWidth="3" /></g>
            </svg>
          )}

          <div className="jr-titles">
            <div className="jr-t0" data-fx="t0">The Verdict · The Trial</div>
            <div className="jr-t1" data-fx="t1">Jester's</div>
            <div className="jr-t2" data-fx="t2">Revenge</div>
            <div className="jr-t3" data-fx="t3">The Jester wanted this.</div>
          </div>

          {o.revenge ? <>
            <div className="jr-dangle" data-fx="dangle">
              <Photo p={victim} />
              <div className="jr-dangle-name">{victim?.name.toUpperCase()}</div>
              <i className="l" /><i className="r" />
            </div>
            <div className="jr-victim" data-fx="victim">
              <div className="jr-sc big">The Jester chooses</div>
              <div className="jr-vname">{victim?.name.toUpperCase()}</div>
              <div className="jr-takes"><span>TAKES A</span><span className="jr-mult" data-fx="mult">×{times}</span><span>PUNISHMENT</span></div>
            </div>
          </> : (
            <div className="jr-waiting" data-fx="waiting">
              <div className="jr-sc big">The Jester is choosing…</div>
              <div className="jr-wait-sub">One of the people who voted them out takes a ×3 punishment.</div>
              <button className="jr-btn inline" onClick={() => act('jester_revenge', { vote_id: vote.id }).catch(() => {})}>PICK AT RANDOM FOR THEM</button>
            </div>
          )}

          <div className="jr-voters" data-fx="voters">
            <div className="jr-sc small">Voted<br />to convict</div>
            {voters.map((v, i) => (
              <div key={v.id} className="jr-voter">
                <div className="jr-thread" style={{ transform: `rotate(${SWAYS[i]})` }} />
                <div className="jr-vcard" style={{ transform: `rotate(${TILTS[i]})` }}><Photo p={v} /></div>
                <div className="jr-vn">{v.name.toUpperCase()}</div>
              </div>
            ))}
            {allVoters.length > voters.length && <div className="jr-vn more">+{allVoters.length - voters.length}</div>}
          </div>

          {o.revenge && <button className="jr-btn" data-fx="close" onClick={onClose}>CLOSE</button>}

          {LAUGHS.map((l, i) => <div key={i} className="jr-laugh" data-fx="laugh" style={{ left: l.x, top: l.y, fontSize: l.s, transform: `rotate(${l.r}deg)` }}>ha!</div>)}
        </div>
        <div className="jr-black" data-fx="black" />
        <div className="jr-eyes" data-fx="eyes"><span /><span /></div>
        <div className="jr-flash" data-fx="flash" />
        <div className="jr-grain top" />
      </div>
    </div>
  );
}
