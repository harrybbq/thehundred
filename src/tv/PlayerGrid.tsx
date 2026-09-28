// TV "Suspects" board: one manila case card per player — pinned polaroid, seat no.,
// beers, punishments, curse burn, public role stamp, REHAB tag, and red string
// between revealed Lovebirds. Grid auto-sizes to fit the panel.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { ROLES, levelFor } from '../lib/roles';
import { Polaroid, tiltFor } from '../components/ui';

export function PlayerGrid({ players, revealMask, onCard, onExpose, onEmpty }: {
  players: Player[]; revealMask: Set<string>; onCard: (id: string) => void; onExpose: (id: string) => void; onEmpty: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ c: 1, r: 1, u: 24 });
  const [links, setLinks] = useState('');

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

  // red string between publicly revealed Lovebirds
  useEffect(() => {
    const draw = () => {
      const w = wrap.current?.getBoundingClientRect(); if (!w) return;
      const seen = new Set<string>(); let out = '';
      for (const p of players) {
        const q = players.find(x => x.id === p.love_partner_id);
        if (!q || seen.has(p.id) || p.public_role !== 'lovebird' || q.public_role !== 'lovebird' || revealMask.has(p.id) || revealMask.has(q.id)) continue;
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
          return (
            <div key={p.id} data-id={p.id} className={'case' + (role ? ' exposed' : '') + (p.cursed ? ' cursed' : '') + (p.rehab && role ? ' rehab' : '') + (role && p.public_role === 'intruder' ? ' burnt' : '')}
              style={{ ['--tilt' as any]: tiltFor(p.name, 1.2) }} onClick={() => onCard(p.id)}>
              <div className="case-head">
                <Polaroid url={p.selfie_url} name={p.name} pin />
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
              {role && <div className="idstamp" style={{ ['--sc' as any]: role.color }}>IDENTIFIED:<b>{role.label.toUpperCase()}</b></div>}
              {p.rehab && role && <div className="rehab-tag">REHAB</div>}
              {p.cursed && <span className="skull" title="Cursed">☠</span>}
            </div>
          );
        })}
      </div>
      <svg className="love-links" dangerouslySetInnerHTML={{ __html: links }} />
    </div>
  );
}
