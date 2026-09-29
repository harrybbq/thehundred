// TV "Suspects" board: one manila case card per player — pinned polaroid, seat no.,
// beers, punishments, curse burn, public role stamp, REHAB tag, and red string
// between revealed Lovebirds (a bonus: their roles can stay hidden), Davy Jones' Locker (the card
// floods with sea water and a countdown), the Champ's crown and the Angel's halo. Grid auto-sizes to fit the panel.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { ROLES, levelFor } from '../lib/roles';
import { Polaroid, tiltFor } from '../components/ui';

const fmtLeft = (ms: number) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

// ---------- curse pass (TV-17): the skull leaves as smoke, drifts over, thorns smother the new card ----------
// Every vine starts at an edge, twists across the card and ends in the bottom-right corner (where the curse burns).
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
    A('from-skull', [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 1, transform: 'translateY(-20px) scale(1.4)', offset: .4 }, { opacity: 0, transform: 'translateY(-50px) scale(2.2)', filter: 'blur(10px)' }], { duration: 600 });
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
    A('to-mist', [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(90px,80px) scale(.3)' }], { duration: 600, delay: 2350, easing: 'cubic-bezier(.6,0,.8,.4)' });
    A('to-char', [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.15)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 2750 });
    A('to-ember', [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)', offset: .3 }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 900, delay: 2750, easing: 'ease-out' });
    A('to-skull', [{ opacity: 0, transform: 'scale(2.4) rotate(-20deg)', filter: 'blur(6px)' }, { opacity: 1, transform: 'scale(.9) rotate(4deg)', filter: 'blur(0)', offset: .6 }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 500, delay: 2850, easing: 'cubic-bezier(.3,1.5,.5,1)' });
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
            <g transform="translate(0,215) scale(1,-1)">
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

export function PlayerGrid({ players, revealMask, onCard, onExpose, onEmpty, champs = [], now = Date.now(), curse = null }: {
  players: Player[]; revealMask: Set<string>; onCard: (id: string) => void; onExpose: (id: string) => void; onEmpty: () => void;
  champs?: string[]; now?: number; curse?: { from: string; to: string; key: number } | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ c: 1, r: 1, u: 24 });
  const [links, setLinks] = useState('');
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

  // choose the column count giving the biggest cards
  useLayoutEffect(() => {
    const fit = () => {
      const n = players.length, el = wrap.current; if (!n || !el) return;
      const W = el.clientWidth, H = el.clientHeight, gap = 18;
      let best = { c: 1, r: 1, cw: W, ch: H, score: -1 };
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c), cw = (W - gap * (c - 1)) / c, ch = (H - gap * (r - 1)) / r;
        const score = Math.min(cw, ch * 1.45);
        if (score > best.score + 0.5) best = { c, r, cw, ch, score };
      }
      setLayout({ c: best.c, r: best.r, u: Math.max(16, Math.min(best.cw / 11, best.ch / 7.4, 44)) });
    };
    fit();
    const ro = new ResizeObserver(fit); if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [players.length]);

  // red string between publicly revealed Lovebirds (linked both ways; roles may still be secret)
  useEffect(() => {
    const draw = () => {
      const w = wrap.current?.getBoundingClientRect(); if (!w) return;
      const seen = new Set<string>(); let out = '';
      for (const p of players) {
        const q = players.find(x => x.id === p.love_partner_id);
        if (!q || seen.has(p.id) || q.love_partner_id !== p.id || revealMask.has(p.id) || revealMask.has(q.id)) continue;
        seen.add(p.id); seen.add(q.id);
        const a = grid.current?.querySelector(`[data-id="${p.id}"] .polaroid`)?.getBoundingClientRect();
        const b = grid.current?.querySelector(`[data-id="${q.id}"] .polaroid`)?.getBoundingClientRect();
        if (!a || !b) continue;
        const x1 = a.left + a.width / 2 - w.left, y1 = a.top + 4 - w.top, x2 = b.left + b.width / 2 - w.left, y2 = b.top + 4 - w.top;
        const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + Math.min(120, Math.abs(x2 - x1) * 0.18 + 30);
        const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
        out += `<path class="str-shadow" d="${d}" transform="translate(2,4)"/><path class="str" d="${d}"/>`;
        out += `<circle class="pinhead" cx="${x1}" cy="${y1}" r="9"/><circle class="pinhead" cx="${x2}" cy="${y2}" r="9"/>`;
      }
      setLinks(out);
    };
    const t = setTimeout(draw, 60);
    addEventListener('resize', draw);
    return () => { clearTimeout(t); removeEventListener('resize', draw); };
  }, [players, revealMask, layout]);

  if (!players.length) {
    return (
      <div className="grid-wrap" ref={wrap}>
        <div className="empty-state">No suspects yet. Get them to scan the code.<button className="key sodium" onClick={onEmpty}>SHOW JOIN QR</button></div>
      </div>
    );
  }
  return (
    <div className="grid-wrap" ref={wrap}>
      <div className="grid" ref={grid} style={{ gridTemplateColumns: `repeat(${layout.c}, minmax(0,1fr))`, gridTemplateRows: `repeat(${layout.r}, minmax(0,1fr))`, ['--u' as any]: layout.u + 'px' }}>
        {players.map(p => {
          const role = p.public_role && !revealMask.has(p.id) ? ROLES[p.public_role] : null;
          const logs = p.punishments.slice().reverse();
          const lockLeft = p.locked_until ? Date.parse(p.locked_until) - now : 0;
          const angel = p.public_role === 'angel';
          return (
            <div key={p.id} data-id={p.id} className={'case' + (cbox && curse?.to === p.id ? ' curse-in' : '') + (role ? ' exposed' : '') + (p.cursed ? ' cursed' : '') + (p.rehab && role ? ' rehab' : '') + (role && p.public_role === 'intruder' ? ' burnt' : '') + (angel ? ' angel' : '') + (lockLeft > 0 ? ' locked' : '')}
              style={{ ['--tilt' as any]: tiltFor(p.name, 1.2) }} onClick={() => onCard(p.id)}>
              <div className="case-head">
                <div className="ph-wrap">
                  {angel && <div className="halo" />}
                  <Polaroid url={p.selfie_url} name={p.name} pin />
                  {champs.includes(p.id) && <span className="crown" title="Biggest Champ">👑</span>}
                </div>
                <div className="case-meta">
                  <div className="seat">#{p.seat}</div>
                  <div className="name">{p.name.toUpperCase()}</div>
                </div>
              </div>
              <div className="case-stats"><span>🍺 {p.beers} <i className={'lvl l' + levelFor(p.beers)}>LV{levelFor(p.beers)}</i></span><span className={'pun' + (p.punishments.length ? '' : ' zero')}>☠ {p.punishments.length}</span></div>
              <div className="case-foot">
                {logs.length
                  ? <ul className="plog">{logs.slice(0, 2).map((l, i) => <li key={i}>{l.via_love ? '♥ ' : l.kind === 'penalty' ? '+ ' : '☠ '}{l.text}</li>)}</ul>
                  : <div className="redacted">ROLE ▒▒▒▒</div>}
                {!role && <button className="expose-btn" onClick={e => { e.stopPropagation(); onExpose(p.id); }}>EXPOSE</button>}
              </div>
              {role && (angel
                ? <div className="idstamp angel-stamp" style={{ ['--sc' as any]: role.color }}>😇<b>ANGEL</b></div>
                : <div className="idstamp" style={{ ['--sc' as any]: role.color }}>IDENTIFIED:<b>{role.label.toUpperCase()}</b></div>)}
              {p.rehab && role && <div className="rehab-tag">REHAB</div>}
              {p.love_partner_id && <div className="love-tag" title="Lovebird">♥</div>}
              {p.cursed && <span className="skull" title="Cursed">☠</span>}
              {p.shivved_by && <div className="shiv-tag" title="Their next punishment counts double">🔪 SHIVVED BY {(players.find(q => q.id === p.shivved_by)?.name ?? '?').toUpperCase()}<small>NEXT PUNISHMENT ×2</small></div>}
              {p.held && <div className="held-tag" title="A punishment is waiting for them">⏳ 1 WAITING</div>}
              {lockLeft > 0 && (
                <div className="locker" aria-label="In Davy Jones' Locker">
                  <div className="water"><i className="wave" /><i className="wave back" />
                    {[0, 1, 2, 3, 4, 5].map(i => <b key={i} className="bubble" style={{ ['--i' as any]: i }} />)}
                  </div>
                  <div className="lk-label">⚓ Davy Jones' Locker<span>{fmtLeft(lockLeft)}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <svg className="love-links" dangerouslySetInnerHTML={{ __html: links }} />
      {cbox && curse && <div style={{ ['--u' as any]: layout.u + 'px' }}><CurseFx key={cbox.key} from={cbox.from} to={cbox.to} wrap={wrap.current}
        toName={players.find(p => p.id === curse.to)?.name ?? ''} /></div>}
    </div>
  );
}
