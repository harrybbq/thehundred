// TV: the Scrooge's three abilities (design "Scrooge Abilities"). Each opens with a
// 0.4s static sting and the old "BAH, HUMBUG!", then the lights come up gold with
// falling £ coins:
//   swap     SWAPSIES!: the two photos trade places under a bouncing top hat
//   respin   a giant coin flips in: AGAIN! AGAIN! AGAIN! / RE-SPIN, PEASANTS
//   graffiti ON YOUR WHEEL: the text is scrawled onto a riveted plate and drips.
//            Shown at the start of the next punishment, not when it was written.
// Built on a fixed 1920×1080 stage scaled to the screen, like the design.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { initials } from '../lib/util';
import { Sound } from '../fx/sound';

export type ScroogeFx =
  | { kind: 'swap'; from?: Player; to?: Player }
  | { kind: 'respin' }
  | { kind: 'graffiti'; text: string };

/** How long each animation holds the screen (ms). */
export const SCROOGE_MS = { swap: 4300, respin: 3900, graffiti: 4500 } as const;

const COINS = Array.from({ length: 16 }, (_, i) => { const s = 50 + (i * 37) % 60; return { x: (i * 131) % 1860, s, f: Math.round(s * 0.55) }; });
const AGAINS = [{ s: 110, r: -8 }, { s: 150, r: 5 }, { s: 110, r: -4 }];
const RIVETS = [[16, 16], [1370, 16], [16, 330], [1370, 330]];
const DRIPS = [[330, 250, 12, 70], [560, 262, 10, 110], [790, 246, 14, 60], [1040, 258, 10, 90]];
const POP: Keyframe[] = [{ opacity: 0, transform: 'scale(.2) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1.18) rotate(4deg)', offset: .6 }, { opacity: 1, transform: 'scale(.95) rotate(-2deg)', offset: .8 }, { opacity: 1, transform: 'none' }];
const WIGGLE: Keyframe[] = [{ transform: 'rotate(-3deg) scale(1)' }, { transform: 'rotate(3deg) scale(1.04)' }];

function Photo({ p }: { p?: Player }) {
  return p?.selfie_url
    ? <img className="jr-photo" src={p.selfie_url} alt={p.name} draggable={false} />
    : <div className="jr-photo jr-blank sg-blank">{initials(p?.name ?? '?')}</div>;
}

export function ScroogeOverlay({ fx }: { fx: ScroogeFx }) {
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(innerWidth / 1920, innerHeight / 1080));
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);

  useLayoutEffect(() => {
    const q = (s: string) => [...(root.current?.querySelectorAll<HTMLElement>(`[data-fx="${s}"]`) ?? [])];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { q('coin').forEach(el => (el.style.opacity = '0')); return; }
    const A = (s: string, kf: Keyframe[], o: KeyframeAnimationOptions & { stagger?: number }) =>
      q(s).forEach((el, i) => el.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)', ...o, delay: ((o.delay as number) || 0) + (o.stagger || 0) * i }));
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));

    // shared: static sting with the old "BAH, HUMBUG!", then the lights come up gold
    Sound.staticNoise();
    A('static', [{ opacity: 1 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: 420, easing: 'steps(3,jump-none)' });
    A('humbug', [{ opacity: 1, transform: 'skewX(-10deg)' }, { opacity: 1, transform: 'skewX(8deg) translateX(20px)', offset: .5 }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 480, easing: 'steps(4,jump-none)' });
    A('stage', [{ opacity: 0, filter: 'brightness(2)' }, { opacity: 1, filter: 'none' }], { duration: 350, delay: 380 });
    A('coin', [{ transform: 'translateY(0) rotateY(0) rotate(0)' }, { transform: 'translateY(1300px) rotateY(1080deg) rotate(160deg)' }], { duration: 1700, delay: 450, stagger: 90, easing: 'cubic-bezier(.4,0,.8,.6)' });
    later(420, () => Sound.scrooge());

    if (fx.kind === 'swap') {
      A('kick', [{ opacity: 0, letterSpacing: '1em' }, { opacity: 1, letterSpacing: '.3em' }], { duration: 500, delay: 450 });
      A('title', POP, { duration: 520, delay: 550, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      A('a', [{ opacity: 0, transform: 'translate(580px,0) rotate(4deg)' }, { opacity: 1, transform: 'translate(580px,0) rotate(4deg)', offset: .25 }, { transform: 'translate(290px,-260px) rotate(-190deg)', offset: .6 }, { opacity: 1, transform: 'rotate(-5deg)' }], { duration: 900, delay: 900 });
      A('b', [{ opacity: 0, transform: 'translate(-580px,0) rotate(-5deg)' }, { opacity: 1, transform: 'translate(-580px,0) rotate(-5deg)', offset: .25 }, { transform: 'translate(-290px,220px) rotate(170deg)', offset: .6 }, { opacity: 1, transform: 'rotate(4deg)' }], { duration: 900, delay: 900 });
      A('hat', [{ opacity: 0, transform: 'translateY(-500px)' }, { opacity: 1, transform: 'translateY(0) scaleY(.7)', offset: .3 }, { transform: 'translateY(-160px) rotate(-30deg)', offset: .5 }, { transform: 'translateY(0) scaleY(.8)', offset: .7 }, { transform: 'translateY(-60px) rotate(20deg)', offset: .85 }, { opacity: 1, transform: 'none' }], { duration: 1100, delay: 700 });
      A('off', POP, { duration: 400, delay: 1850 });
      A('you', POP, { duration: 400, delay: 2000 });
      A('sub', [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 2200 });
      later(900, () => Sound.pop());
      later(2600, () => {
        A('title', WIGGLE, { duration: 260, iterations: 6, direction: 'alternate', easing: 'ease-in-out', fill: 'none' });
        A('hat', [{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg) translateY(-20px)' }], { duration: 300, iterations: 6, direction: 'alternate', fill: 'none' });
      });
    }
    if (fx.kind === 'respin') {
      A('bigcoin', [{ opacity: 0, transform: 'translateY(600px) rotateX(0) scale(.4)' }, { opacity: 1, transform: 'translateY(-120px) rotateX(1440deg) scale(1.1)', offset: .65 }, { transform: 'translateY(20px) rotateX(1800deg) scale(.95)', offset: .85 }, { opacity: 1, transform: 'rotateX(1800deg)' }], { duration: 1300, delay: 450, easing: 'cubic-bezier(.25,.8,.4,1)' });
      A('again', POP, { duration: 380, delay: 700, stagger: 160, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      A('title', [{ opacity: 0, transform: 'scaleX(2.4) scaleY(.2)' }, { opacity: 1, transform: 'scaleX(.9) scaleY(1.2)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 1600 });
      A('sub', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 2000 });
      later(2500, () => {
        A('again', WIGGLE, { duration: 180, iterations: 8, direction: 'alternate', stagger: 60, fill: 'none' });
        A('bigcoin', [{ transform: 'rotateY(0)' }, { transform: 'rotateY(360deg)' }], { duration: 900, iterations: 2, fill: 'none', easing: 'linear' });
      });
    }
    if (fx.kind === 'graffiti') {
      A('kick', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 450 });
      A('title', POP, { duration: 480, delay: 550, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      A('ink', [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 62% 0 0)', offset: .3 }, { clipPath: 'inset(0 58% 0 0)', offset: .4 }, { clipPath: 'inset(0 20% 0 0)', offset: .75 }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1300, delay: 900, easing: 'steps(14,jump-end)' });
      A('drip', [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1200, delay: 2000, stagger: 180, easing: 'cubic-bezier(.5,0,.2,1)' });
      A('tee', POP, { duration: 400, delay: 2250 });
      A('sub', [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 2400 });
      later(2900, () => A('tee', WIGGLE, { duration: 200, iterations: 8, direction: 'alternate', fill: 'none' }));
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graffitiLen = fx.kind === 'graffiti' ? fx.text.length : 0;
  return (
    <div className="jr-ov sg-ov">
      <div className="jr-stage" ref={root} style={{ transform: `scale(${scale})` }}>
        <div className="sg-scene" data-fx="stage">
          <div className="sg-vignette" />
          {COINS.map((c, i) => <div key={i} className="sg-coin" data-fx="coin" style={{ left: c.x, width: c.s, height: c.s, fontSize: c.f }}>£</div>)}

          {fx.kind === 'swap' && <>
            <div className="sg-head">
              <div className="sg-kick" data-fx="kick">The Scrooge says</div>
              <div className="sg-title swap" data-fx="title">SWAPSIES!</div>
            </div>
            <div className="sg-card a" data-fx="a">
              <Photo p={fx.from} /><div className="sg-cap">{fx.from?.name.toUpperCase()}</div>
              <div className="sg-off" data-fx="off">off the hook!</div>
            </div>
            <div className="sg-card b" data-fx="b">
              <Photo p={fx.to} /><div className="sg-cap">{fx.to?.name.toUpperCase()}</div>
              <div className="sg-you" data-fx="you">YOU'RE UP!</div>
            </div>
            <div className="sg-hat" data-fx="hat">🎩</div>
            <div className="sg-sub" data-fx="sub">“{fx.from?.name ?? 'Them'}? Bah! {fx.to?.name ?? 'You'} looks far more <span>punishable</span>.”</div>
          </>}

          {fx.kind === 'respin' && <>
            <div className="sg-bigcoin" data-fx="bigcoin"><div><span className="h">🎩</span><span className="t">ONE MORE</span></div></div>
            <div className="sg-agains">{AGAINS.map((a, i) => <div key={i} className="sg-again" data-fx="again" style={{ fontSize: a.s, transform: `rotate(${a.r}deg)` }}>AGAIN!</div>)}</div>
            <div className="sg-respin-title" data-fx="title">RE-SPIN, PEASANTS</div>
            <div className="sg-sub" data-fx="sub">“Didn't fancy that one. <span>Spin it again.</span>”</div>
          </>}

          {fx.kind === 'graffiti' && <>
            <div className="sg-head">
              <div className="sg-kick" data-fx="kick">The Scrooge has been scribbling</div>
              <div className="sg-title graf" data-fx="title">ON YOUR WHEEL</div>
            </div>
            <div className="sg-plate">
              <div className="sg-plate-grain" />
              {RIVETS.map(([x, y], i) => <div key={i} className="sg-rivet" style={{ left: x, top: y }} />)}
              <div className="sg-ink" data-fx="ink" style={{ fontSize: graffitiLen > 22 ? 84 : graffitiLen > 14 ? 104 : 130 }}>{fx.text}</div>
              {DRIPS.map(([x, y, w, h], i) => <div key={i} className="sg-drip" data-fx="drip" style={{ left: x, top: y, width: w, height: h }} />)}
            </div>
            <div className="sg-tee" data-fx="tee">tee-hee!</div>
            <div className="sg-sub" data-fx="sub">“It's on the wheel now. <span>Pray it isn't you.</span>”</div>
          </>}
        </div>
        <div className="sg-static" data-fx="static" />
        <div className="sg-humbug" data-fx="humbug">BAH, HUMBUG!</div>
        <div className="jr-grain top" />
      </div>
    </div>
  );
}
