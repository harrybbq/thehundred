// TV scenes for the v5 powers, on the same scaled 1920×1080 stage as Jester's Revenge:
//   HolyNovaOverlay  the Angel's Holy Nova: blackout, golden rays and shockwaves, "+10 BEERS"
//   ShameOverlay     Judge Dredd's Walk of Shame: spotlit photo, the caption, "SHAME!" x3
//   PlateOverlay     Aaron's Plate: a grill of sausages, one lying sideways (the dirty one)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameState, Plate, Player } from '../lib/types';
import type { Act } from './TvRoom';
import { initials } from '../lib/util';
import { Sound } from '../fx/sound';

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1920, innerHeight / 1080));
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);
  return scale;
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateAll(root: HTMLElement | null, sel: string, kf: Keyframe[], o: KeyframeAnimationOptions & { stagger?: number }) {
  root?.querySelectorAll<HTMLElement>(`[data-fx="${sel}"]`).forEach((el, i) =>
    el.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)', ...o, delay: ((o.delay as number) || 0) + (o.stagger || 0) * i }));
}
function Photo({ p }: { p?: Player }) {
  return p?.selfie_url
    ? <img className="jr-photo" src={p.selfie_url} alt={p.name} draggable={false} />
    : <div className="jr-photo jr-blank">{initials(p?.name ?? '?')}</div>;
}
const POP: Keyframe[] = [{ opacity: 0, transform: 'scale(.2) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1.18) rotate(4deg)', offset: .6 }, { opacity: 1, transform: 'scale(.95) rotate(-2deg)', offset: .8 }, { opacity: 1, transform: 'none' }];

// ---------------------------------------------------------------- Holy Nova
export const NOVA_MS = 5200;
export function HolyNovaOverlay({ angel, n, tally, target }: { angel?: Player; n: number; tally: number; target: number }) {
  const root = useRef<HTMLDivElement>(null);
  const scale = useStageScale();
  useLayoutEffect(() => {
    if (reduced()) return;
    const r = root.current;
    Sound.heal();
    animateAll(r, 'dark', [{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], { duration: 1100, easing: 'linear' });
    animateAll(r, 'rays', [{ opacity: 0, transform: 'scale(.2) rotate(0)' }, { opacity: 1, transform: 'scale(1.1) rotate(40deg)', offset: .3 }, { opacity: .85, transform: 'scale(1) rotate(160deg)' }], { duration: 5200, delay: 700, easing: 'cubic-bezier(.2,.7,.3,1)' });
    animateAll(r, 'ring', [{ opacity: .95, transform: 'scale(.1)' }, { opacity: 0, transform: 'scale(4.5)' }], { duration: 1500, delay: 900, stagger: 260, easing: 'cubic-bezier(.1,.7,.3,1)' });
    animateAll(r, 'flash', [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 850, easing: 'ease-out' });
    animateAll(r, 'angel', [{ opacity: 0, transform: 'translateY(60px) scale(.7)' }, { opacity: 1, transform: 'translateY(-10px) scale(1.05)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 1000 });
    animateAll(r, 'title', [{ opacity: 0, letterSpacing: '.8em', filter: 'blur(12px)' }, { opacity: 1, letterSpacing: '.12em', filter: 'blur(0)' }], { duration: 900, delay: 1400 });
    animateAll(r, 'plus', POP, { duration: 600, delay: 2200, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    animateAll(r, 'tally', [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2800 });
    animateAll(r, 'feather', [{ opacity: 0, transform: 'translateY(-80px) rotate(0)' }, { opacity: .9, offset: .15 }, { opacity: 0, transform: 'translateY(900px) rotate(260deg)' }], { duration: 4200, delay: 1100, stagger: 140, easing: 'cubic-bezier(.3,.1,.7,1)' });
    const t1 = setTimeout(() => Sound.fanfare(), 900);
    const t2 = setTimeout(() => Sound.pop(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="jr-ov hn-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="hn-scene">
          <div className="hn-rays" data-fx="rays" />
          {[0, 1, 2].map(i => <div key={i} className="hn-ring" data-fx="ring" />)}
          {Array.from({ length: 14 }, (_, i) => <div key={i} className="hn-feather" data-fx="feather" style={{ left: 120 + ((i * 263) % 1680), top: -60 - (i % 4) * 40 }}>🪶</div>)}
          <div className="hn-angel" data-fx="angel">
            <div className="hn-halo" />
            <div className="hn-photo"><Photo p={angel} /></div>
          </div>
          <div className="hn-title" data-fx="title">HOLY NOVA</div>
          <div className="hn-plus" data-fx="plus">+{n} BEERS</div>
          <div className="hn-tally" data-fx="tally">{angel?.name ?? 'The Angel'} blessed the tally · {tally} / {target}</div>
        </div>
        <div className="hn-flash" data-fx="flash" />
        <div className="hn-dark" data-fx="dark" />
        <div className="jr-grain top" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Walk of Shame
export const SHAME_MS = 5600;
export function ShameOverlay({ victim, caption }: { victim?: Player; caption: string }) {
  const root = useRef<HTMLDivElement>(null);
  const scale = useStageScale();
  useLayoutEffect(() => {
    if (reduced()) return;
    const r = root.current;
    animateAll(r, 'kick', [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200 });
    animateAll(r, 'spot', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 300 });
    animateAll(r, 'photo', [{ opacity: 0, transform: 'translateY(-700px) rotate(-30deg)' }, { opacity: 1, transform: 'translateY(20px) rotate(4deg)', offset: .7 }, { opacity: 1, transform: 'rotate(-3deg)' }], { duration: 800, delay: 500, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    animateAll(r, 'caption', [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, delay: 1300, easing: 'steps(16,jump-end)' });
    animateAll(r, 'shame', POP, { duration: 420, delay: 2500, stagger: 520, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    animateAll(r, 'tomato', [{ opacity: 0, transform: 'translate(0,0) scale(.5)' }, { opacity: 1, transform: 'translate(var(--dx),var(--dy)) scale(1)', offset: .8 }, { opacity: 1, transform: 'translate(var(--dx),var(--dy)) scale(1.4,.6)' }], { duration: 520, delay: 2700, stagger: 380, easing: 'cubic-bezier(.4,0,.8,.6)' });
    const ts = [0, 520, 1040].map(d => setTimeout(() => Sound.gavel(), 2500 + d));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="jr-ov sh-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="sh-scene">
          <div className="sh-spot" data-fx="spot" />
          <div className="sh-kick" data-fx="kick">By order of Judge Dredd · Walk of Shame</div>
          <div className="sh-photo" data-fx="photo">
            <Photo p={victim} /><div className="sh-name">{victim?.name.toUpperCase()}</div>
            {[{ dx: '-260px', dy: '-40px', x: 90, y: 60 }, { dx: '240px', dy: '10px', x: 150, y: 170 }, { dx: '-200px', dy: '120px', x: 60, y: 240 }].map((t, i) => (
              <div key={i} className="sh-tomato" data-fx="tomato" style={{ left: t.x, top: t.y, ['--dx' as any]: t.dx, ['--dy' as any]: t.dy }}>🍅</div>
            ))}
          </div>
          <div className="sh-caption" data-fx="caption">“{caption}”</div>
          <div className="sh-chants">{['SHAME!', 'SHAME!', 'SHAME!'].map((c, i) => <span key={i} data-fx="shame">{c}</span>)}</div>
        </div>
        <div className="jr-grain top" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Aaron's Plate
// Clean sausages lie flat (with a little jitter); the dirty one is turned sideways —
// "he placed it sideways, so obviously it was the dirty one". Only the TV shows it.
const jitter = (i: number) => ((i * 53) % 13) - 6;
export function PlateOverlay({ state, plate, act, now, onClose }: { state: GameState; plate: Plate; act: Act; now: () => number; onClose: () => void }) {
  const scale = useStageScale();
  const closing = useRef(false);
  const open = plate.status === 'open';
  const left = Math.max(0, Date.parse(plate.ends_at) - now());
  const byIdx = new Map(Object.entries(plate.picks).map(([pid, i]) => [i, state.players.find(p => p.id === pid)]));
  const loser = state.players.find(p => p.id === plate.loser);
  const cols = plate.n <= 6 ? 3 : plate.n <= 12 ? 4 : 5;

  // time's up → serve (the server fills in anyone who didn't pick)
  useEffect(() => {
    if (open && left <= 0 && !closing.current) {
      closing.current = true;
      act('bbq_close', { plate_id: plate.id }).catch(() => { closing.current = false; });
    }
  });
  const played = useRef(false);
  useEffect(() => {
    if (!open && !played.current) { played.current = true; Sound.lose(); setTimeout(() => Sound.thud(), 500); }
  }, [open]);
  useEffect(() => { Sound.fanfare(); }, []);

  return (
    <div className="jr-ov bbq-ov">
      <div className="jr-stage" style={{ transform: `scale(${scale})` }}>
        <div className={'bbq-scene' + (open ? '' : ' served')}>
          <div className="bbq-head">
            <div className="bbq-kick">{open ? 'Someone has fired up the BBQ' : 'Served'}</div>
            <div className="bbq-title">AARON'S PLATE</div>
            <div className="bbq-sub">{open
              ? <>One of these fell on the balcony. <b>Pick a sausage on your phone</b> before they're gone.</>
              : <>“Aaron swears it's fine.”</>}</div>
          </div>
          <div className="bbq-grill" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: plate.n }, (_, i) => {
              const dirty = plate.dirty === i;
              const who = byIdx.get(i);
              return (
                <div key={i} className={'bbq-cell' + (who ? ' taken' : '') + (!open && dirty ? ' reveal' : '') + (!open && !dirty ? ' clean' : '')}>
                  <div className={'sausage' + (dirty ? ' side' : '')} style={{ ['--j' as any]: `${dirty ? 90 : jitter(i)}deg` }}>
                    <i className="mark" /><i className="mark" /><i className="mark" />
                    {!open && dirty && <><i className="dirt a" /><i className="dirt b" /><i className="dirt c" /></>}
                  </div>
                  <div className="bbq-num">{i + 1}</div>
                  {who && <div className="bbq-who"><Photo p={who} /><span>{who.name.toUpperCase()}</span></div>}
                  {!open && dirty && <div className="bbq-flies">🪰</div>}
                </div>
              );
            })}
          </div>
          {open
            ? <div className="bbq-timer"><b>{Math.ceil(left / 1000)}</b>s · {Object.keys(plate.picks).length} / {plate.n} taken</div>
            : <div className="bbq-result">
                {loser ? <><div className="bbq-loser"><Photo p={loser} /></div><div><div className="bbq-ate">{loser.name.toUpperCase()}</div><div className="bbq-ate-sub">ATE THE DIRTY SAUSAGE · INTO THE QUEUE</div></div></> : <div className="bbq-ate-sub">NOBODY ATE IT. AARON'S DISAPPOINTED.</div>}
                <button className="jr-btn inline" onClick={onClose}>CLOSE</button>
              </div>}
        </div>
        <div className="jr-grain top" />
      </div>
    </div>
  );
}
