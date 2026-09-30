// TV "Suspects" board (approved mockup: design/mockups/Board.dc.html): one manila case card per player. The name sits up top
// and is never covered; public facts are solid bands under it (the IDENTIFIED role, the Angel, Davy Jones' Locker with its
// countdown, SHIVVED BY); a dark plate carries beers + level and the punishment count. Cursed = a burnt top-right corner
// with the skull; rehab greys the photo and tapes it; the Champ wears a crown, the Angel a halo; red string joins revealed
// Lovebirds. Cards are sized to fit the panel and centred; long names shrink to fit two lines. EXPOSE lives in the
// card-tap detail modal, not on the board.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { ROLES, levelFor } from '../lib/roles';
import { tiltFor } from '../components/ui';
import { initials } from '../lib/util';

const fmtLeft = (ms: number) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

// ---------- curse pass (TV-17): the skull leaves as smoke, drifts over, thorns smother the new card ----------
// Every vine starts at an edge, twists across the card and ends in the top-right corner (where the curse burns).
const VINE_STARTS = [[-8, 20], [-8, 90], [-8, 160], [-8, 222], [60, 222], [130, 222], [200, 222], [262, 200], [262, 120], [40, -8], [120, -8], [-8, 60]];
const VINES = VINE_STARTS.map(([x, y], i) => {
  const mx = 60 + ((i * 47) % 150), my = 40 + ((i * 61) % 150), nx = 150 + ((i * 29) % 80), ny = 20 + ((i * 37) % 90);
  return { d: `M ${x} ${y} C ${mx} ${y + (i % 2 ? -50 : 40)}, ${mx + 30} ${my}, ${nx} ${ny} S 240 ${10 + (i % 3) * 8}, 252 4`, w: [14, 11, 9, 12][i % 4] };
});
const THORNS = VINE_STARTS.flatMap(([x, y], i) => [.3, .55, .8].map((t, k) => {
  const mx = 60 + ((i * 47) % 150), my = 40 + ((i * 61) % 150), nx = 150 + ((i * 29) % 80), ny = 20 + ((i * 37) % 90);
  const px = x + (nx - x) * t + (mx - (x + nx) / 2) * .6 * (1 - Math.abs(t - .5) * 2), py = y + (ny - y) * t + (my - (y + ny) / 2) * .5 * (1 - Math.abs(t - .5) * 2);
  const r = (i + k) % 2 ? 1 : -1;
  return `M ${px - 5} ${py} L ${px + 5} ${py} L ${px + r * 6} ${py - 14} Z`;
}));
type Box = { x: number; y: number; w: number; h: number };

function CurseFx({ from, to, toName, wrap }: { from: Box | null; to: Box | null; toName: string; wrap: HTMLElement | null }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = root.current; if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = (s: string) => [...el.querySelectorAll<HTMLElement | SVGElement>(`[data-cfx="${s}"]`)];
    const A = (s: string, kf: Keyframe[], o: KeyframeAnimationOptions & { stagger?: number }) =>
      q(s).forEach((n, i) => n.animate(kf, { fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)', ...o, delay: ((o.delay as number) || 0) + (o.stagger || 0) * i }));
    const dx = from && to ? to.x + to.w / 2 - (from.x + from.w / 2) : 0, dy = from && to ? to.y + to.h / 2 - (from.y + from.h / 2) : 0;
    // 0–0.6s: the skull rises off the old card as smoke; its burnt corner heals
    A('from-skull', [{ opacity: 1, transform: 'none' }, { opacity: 1, transform: 'translateY(-20px) scale(1.4)', offset: .4 }, { opacity: 0, transform: 'translateY(-50px) scale(2.2)' }], { duration: 600 });
    A('from-char', [{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: 200, easing: 'ease-out' });
    // 0.35–1.3s: a smoke wisp carries the skull across the board
    A('wisp', [{ opacity: 0, transform: 'translate(0,0) scale(.5)' }, { opacity: 1, transform: `translate(${dx * .15}px,${dy * .05 - 60}px) scale(1)`, offset: .2 }, { opacity: 1, transform: `translate(${dx * .6}px,${dy * .5 - 80}px) scale(1.2) rotate(-20deg)`, offset: .6 }, { opacity: .9, transform: `translate(${dx}px,${dy}px) scale(1.6)`, offset: .9 }, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(2.6)` }], { duration: 950, delay: 350, easing: 'ease-in-out' });
    // 1.1–2.4s: mist and thorn vines smother the new card
    A('to-mist', [{ opacity: 0, transform: 'scale(1.3) rotate(8deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 900, delay: 1100, easing: 'ease-out' });
    A('vine', [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 750, delay: 1100, stagger: 45, easing: 'cubic-bezier(.3,.6,.4,1)' });
    A('thorn', [{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay: 1350, stagger: 18 });
    A('to-dim', [{ opacity: 0 }, { opacity: .75, offset: .6 }, { opacity: 0 }], { duration: 2000, delay: 1100, easing: 'ease-in-out' });
    // 2.35–3.3s: it all sinks into the corner and burns in as the char and skull
    A('to-vines', [{ transform: 'none', opacity: 1 }, { transform: 'scale(.35)', opacity: 0 }], { duration: 600, delay: 2350, easing: 'cubic-bezier(.6,0,.8,.4)' });
    A('to-mist', [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(90px,-80px) scale(.3)' }], { duration: 600, delay: 2350, easing: 'cubic-bezier(.6,0,.8,.4)' });
    A('to-char', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.15)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2750 });
    A('to-ember', [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)', offset: .3 }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 900, delay: 2750, easing: 'ease-out' });
    A('to-skull', [{ opacity: 0, transform: 'scale(2.4) rotate(-20deg)' }, { opacity: 1, transform: 'scale(.9) rotate(4deg)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2850, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    A('caption', [{ opacity: 0, transform: 'translate(-50%,-30%)' }, { opacity: 1, transform: 'translate(-50%,-50%)', offset: .15 }, { opacity: 1, transform: 'translate(-50%,-50%)', offset: .85 }, { opacity: 0, transform: 'translate(-50%,-50%)' }], { duration: 2000, delay: 1600 });
    // shake the real cards
    const cards = wrap ? [...wrap.querySelectorAll<HTMLElement>('.case')] : [];
    const at = (b: Box | null) => b && cards.find(c => { const r = c.getBoundingClientRect(), w = wrap!.getBoundingClientRect(); return Math.abs(r.left - w.left - b.x) < 3 && Math.abs(r.top - w.top - b.y) < 3; });
    at(from)?.animate([{ translate: '0 0' }, { translate: '-3px 0' }, { translate: '3px 0' }], { duration: 70, iterations: 6 });
    at(to)?.animate([{ translate: '0 0' }, { translate: '-2px 1px' }, { translate: '2px -1px' }], { duration: 80, delay: 1200, iterations: 12 });
  }, [from, to, wrap]);
  const box = (b: Box) => ({ left: b.x, top: b.y, width: b.w, height: b.h });
  return (
    <div className="cfx" ref={root}>
      {from && <div className="cfx-card" style={box(from)}><div className="cfx-char" data-cfx="from-char" /><span className="cfx-skull" data-cfx="from-skull">☠</span></div>}
      {to && (
        <div className="cfx-card" style={box(to)}>
          <div className="cfx-dim" data-cfx="to-dim" />
          <div className="cfx-mist" data-cfx="to-mist" />
          <svg className="cfx-vines" data-cfx="to-vines" viewBox="0 0 254 215" preserveAspectRatio="none">
            <g>
              {VINES.map((v, i) => <path key={i} data-cfx="vine" pathLength={1} strokeDasharray="1" strokeDashoffset="1" d={v.d} fill="none" stroke="#050605" strokeWidth={v.w} strokeLinecap="round" />)}
              {THORNS.map((d, i) => <path key={i} data-cfx="thorn" d={d} fill="#050605" opacity="0" />)}
            </g>
          </svg>
          <div className="cfx-char" data-cfx="to-char" style={{ opacity: 0 }} />
          <div className="cfx-ember" data-cfx="to-ember" />
          <span className="cfx-skull" data-cfx="to-skull" style={{ opacity: 0 }}>☠</span>
        </div>
      )}
      {from && <div className="cfx-wisp" data-cfx="wisp" style={{ left: from.x + from.w / 2, top: from.y + from.h / 2 }}><span>☠</span></div>}
      <div className="cfx-caption" data-cfx="caption">THE CURSE PASSES TO <span>{toName.toUpperCase()}</span></div>
    </div>
  );
}

export function PlayerGrid({ players, revealMask, onCard, onEmpty, champs = [], now = Date.now(), curse = null }: {
  players: Player[]; revealMask: Set<string>; onCard: (id: string) => void; onEmpty: () => void;
  champs?: string[]; now?: number; curse?: { from: string; to: string; key: number } | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ cw: 300, ch: 200 });
  const [links, setLinks] = useState({ str: '', pins: '' });
  // curse pass: measure both cards when it starts
  const [cbox, setCbox] = useState<null | { from: Box | null; to: Box | null; key: number }>(null);
  useLayoutEffect(() => {
    if (!curse) { setCbox(null); return; }
    const w = wrap.current?.getBoundingClientRect();
    const m = (id: string): Box | null => {
      const b = grid.current?.querySelector(`[data-id="${id}"]`)?.getBoundingClientRect();
      return b && w ? { x: b.left - w.left, y: b.top - w.top, w: b.width, h: b.height } : null;
    };
    setCbox({ from: m(curse.from), to: m(curse.to), key: curse.key });
  }, [curse?.key]);

  // the column count giving the biggest cards (never taller than 4:5: the card is a landscape layout)
  useLayoutEffect(() => {
    const fit = () => {
      const n = players.length, el = wrap.current, g = grid.current; if (!n || !el || !g) return;
      const W = el.clientWidth, H = el.clientHeight, cs = getComputedStyle(g);
      const gx = parseFloat(cs.columnGap) || 0, gy = parseFloat(cs.rowGap) || 0;
      let best = { score: -1, cw: W, ch: H };
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c), cw = (W - gx * (c - 1)) / c;
        const ch = Math.min((H - gy * (r - 1)) / r, cw / 1.25);
        const score = Math.min(cw, ch * 1.5);
        if (score > best.score + 0.5) best = { score, cw, ch };
      }
      setSize(sz => (Math.abs(sz.cw - best.cw) < 1 && Math.abs(sz.ch - best.ch) < 1 ? sz : { cw: Math.floor(best.cw), ch: Math.floor(best.ch) }));
    };
    fit();
    const ro = new ResizeObserver(fit); if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [players.length]);

  // names: shrink until each fits two lines (one-word names fit one line)
  const namesKey = players.map(p => p.name).join('|');
  useLayoutEffect(() => {
    grid.current?.querySelectorAll<HTMLElement>('.name').forEach(el => {
      let f = 20; el.style.setProperty('--nf', String(f));
      const over = () => { const lh = parseFloat(getComputedStyle(el).lineHeight); return el.scrollHeight > lh * 2 + 4 || el.scrollWidth > el.clientWidth + 1; };
      while (f > 9 && over()) { f -= .5; el.style.setProperty('--nf', String(f)); }
    });
  }, [namesKey, size]);

  // red string between publicly revealed Lovebirds (linked both ways; roles may still be secret)
  useEffect(() => {
    const draw = () => {
      const w = wrap.current?.getBoundingClientRect(); if (!w) return;
      const seen = new Set<string>(); let str = '', pins = '';
      for (const p of players) {
        const q = players.find(x => x.id === p.love_partner_id);
        if (!q || seen.has(p.id) || q.love_partner_id !== p.id || revealMask.has(p.id) || revealMask.has(q.id)) continue;
        seen.add(p.id); seen.add(q.id);
        const a = grid.current?.querySelector(`[data-id="${p.id}"] .cpol`)?.getBoundingClientRect();
        const b = grid.current?.querySelector(`[data-id="${q.id}"] .cpol`)?.getBoundingClientRect();
        if (!a || !b) continue;
        const x1 = a.left + a.width / 2 - w.left, y1 = a.top + 4 - w.top, x2 = b.left + b.width / 2 - w.left, y2 = b.top + 4 - w.top;
        const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + Math.min(120, Math.abs(x2 - x1) * 0.18 + 30);
        const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
        str += `<path class="str-shadow" d="${d}" transform="translate(2,4)"/><path class="str" d="${d}"/>`;
        pins += `<circle class="pinhead" cx="${x1}" cy="${y1}" r="9"/><circle class="pinhead" cx="${x2}" cy="${y2}" r="9"/>`;
      }
      setLinks({ str, pins });
    };
    const t = setTimeout(draw, 60);
    addEventListener('resize', draw);
    return () => { clearTimeout(t); removeEventListener('resize', draw); };
  }, [players, revealMask, size]);

  if (!players.length) {
    return (
      <div className="grid-wrap" ref={wrap}>
        <div className="empty-state">No suspects yet. Get them to scan the code.<button className="key sodium" onClick={onEmpty}>SHOW JOIN QR</button></div>
      </div>
    );
  }
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div className="grid-wrap" ref={wrap}>
      <svg className="love-links" dangerouslySetInnerHTML={{ __html: links.str }} />
      <div className="grid" ref={grid} style={{ ['--cw' as any]: size.cw + 'px', ['--ch' as any]: size.ch + 'px' }}>
        {players.map(p => {
          const role = p.public_role && !revealMask.has(p.id) ? ROLES[p.public_role] : null;
          const lockLeft = p.locked_until ? Date.parse(p.locked_until) - now : 0;
          const angel = p.public_role === 'angel' && !!role;
          const rehab = p.rehab && !!role;
          const lvl = levelFor(p.beers);
          const shivBy = p.shivved_by ? (players.find(q => q.id === p.shivved_by)?.name ?? '?').toUpperCase() : null;
          const cls = ['case', cbox && curse?.to === p.id && 'curse-in', role && 'exposed', p.cursed && 'cursed', rehab && 'rehab',
            role && p.public_role === 'intruder' && 'burnt', angel && 'angel', lockLeft > 0 && 'locked'].filter(Boolean).join(' ');
          return (
            <div key={p.id} data-id={p.id} className={cls} style={{ ['--tilt' as any]: tiltFor(p.name, 1.1) }} onClick={() => onCard(p.id)}>
              <div className="case-in">
                <div className="case-top">
                  <div className="cph">
                    <div className="cpol">
                      <div className="cphoto">
                        {p.selfie_url ? <img src={p.selfie_url} alt={p.name} draggable={false} /> : initials(p.name)}
                        {lockLeft > 0 && <div className="sea">{!still && [0, 1, 2, 3, 4].map(i => <i key={i} className="bub" style={{ left: `${12 + i * 18}%`, ['--i' as any]: i }} />)}</div>}
                        {rehab && <div className="rehab-tag">REHAB</div>}
                      </div>
                    </div>
                    {angel && <div className="halo" />}
                    {champs.includes(p.id) && <div className="crown" title="Biggest Champ">👑</div>}
                  </div>
                  <div className="idc">
                    <div className="seat">#{p.seat}</div>
                    <div className="name">{p.name.toUpperCase()}</div>
                    <div className="cchips">
                      {p.love_partner_id && <span className="cchip love-tag" title="Lovebird"><i>♥</i><span>LOVEBIRD</span></span>}
                      {p.held && <span className="cchip held-tag" title="A punishment is waiting for them"><i>⏳1</i><span>WAITING</span></span>}
                    </div>
                  </div>
                  {p.cursed && <div className="curse" title="Cursed"><span className="skull">☠</span></div>}
                </div>
                <div className="bands">
                  {role && (angel
                    ? <div className="band angel idstamp"><span className="bi">😇</span><small>NEVER PUNISHED</small><b>ANGEL</b></div>
                    : <div className="band idstamp" style={{ ['--bc' as any]: role.color }}>{rehab && <small>CAUGHT</small>}<b>{role.label.toUpperCase()}</b></div>)}
                  {lockLeft > 0 && <div className="band locker" aria-label="In Davy Jones' Locker"><span className="bi">⚓</span><small>DAVY JONES' LOCKER</small><b>{fmtLeft(lockLeft)}</b></div>}
                  {shivBy && <div className="band shiv-tag" title="Their next punishment counts double"><span className="bi">🔪</span><small>SHIVVED BY</small><b>{shivBy}</b><span className="bt">×2</span></div>}
                </div>
                <div className="case-stats">
                  <span className="st"><span className="ic">🍺</span>{p.beers}<i className={'lvl l' + lvl}>LV{lvl}</i></span>
                  <span className={'st pun' + (p.punishments.length ? '' : ' zero')}><span className="ic">☠</span>{p.punishments.length}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <svg className="love-links love-pins" dangerouslySetInnerHTML={{ __html: links.pins }} />
      {cbox && curse && <div style={{ ['--u' as any]: Math.max(16, Math.min(size.cw / 11, size.ch / 7.4, 44)) + 'px' }}><CurseFx key={cbox.key} from={cbox.from} to={cbox.to} wrap={wrap.current}
        toName={players.find(p => p.id === curse.to)?.name ?? ''} /></div>}
    </div>
  );
}
