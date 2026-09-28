// TV player cards: selfie, number, name, beers, punishments, curse skull,
// public role stamp, Lovebird heart links. Grid auto-sizes to fit the panel.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { ROLES } from '../lib/roles';
import { Avatar } from '../components/ui';

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
      const W = el.clientWidth, H = el.clientHeight, gap = 14;
      let best = { c: 1, r: 1, cw: W, ch: H, score: -1 };
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c), cw = (W - gap * (c - 1)) / c, ch = (H - gap * (r - 1)) / r;
        const score = Math.min(cw, ch * 1.2);
        if (score > best.score + 0.5) best = { c, r, cw, ch, score };
      }
      setLayout({ c: best.c, r: best.r, u: Math.max(16, Math.min(best.cw / 10, best.ch / 8.5, 44)) });
    };
    fit();
    const ro = new ResizeObserver(fit); if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [players.length]);

  // Lovebird heart links (only for publicly revealed pairs)
  useEffect(() => {
    const draw = () => {
      const w = wrap.current?.getBoundingClientRect(); if (!w) return;
      const seen = new Set<string>(); let out = '';
      for (const p of players) {
        const q = players.find(x => x.id === p.love_partner_id);
        if (!q || seen.has(p.id) || p.public_role !== 'lovebird' || q.public_role !== 'lovebird' || revealMask.has(p.id) || revealMask.has(q.id)) continue;
        seen.add(p.id); seen.add(q.id);
        const a = grid.current?.querySelector(`[data-id="${p.id}"]`)?.getBoundingClientRect();
        const b = grid.current?.querySelector(`[data-id="${q.id}"]`)?.getBoundingClientRect();
        if (!a || !b) continue;
        const x1 = a.left + a.width / 2 - w.left, y1 = a.top + a.height / 2 - w.top, x2 = b.left + b.width / 2 - w.left, y2 = b.top + b.height / 2 - w.top;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const bend = Math.min(80, len * 0.18), cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
        const hx = (x1 + 2 * cx + x2) / 4, hy = (y1 + 2 * cy + y2) / 4, s = 26;
        out += `<path class="link" d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}"/>`;
        out += `<path class="heart" d="M${hx},${hy + s * 0.55} C${hx - s * 1.3},${hy - s * 0.2} ${hx - s * 0.6},${hy - s * 1.1} ${hx},${hy - s * 0.35} C${hx + s * 0.6},${hy - s * 1.1} ${hx + s * 1.3},${hy - s * 0.2} ${hx},${hy + s * 0.55}Z"/>`;
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
        <div className="empty-state">Waiting for players to join…<button className="btn primary" onClick={onEmpty}>📱 SHOW JOIN QR</button></div>
      </div>
    );
  }
  return (
    <div className="grid-wrap" ref={wrap}>
      <div className="grid" ref={grid} style={{ gridTemplateColumns: `repeat(${layout.c}, minmax(0,1fr))`, gridTemplateRows: `repeat(${layout.r}, minmax(0,1fr))`, ['--u' as any]: layout.u + 'px' }}>
        {players.map(p => {
          const role = p.public_role && !revealMask.has(p.id) ? ROLES[p.public_role] : null;
          const love = role && p.public_role === 'lovebird' && p.love_partner_id;
          const logs = p.punishments.slice().reverse();
          return (
            <div key={p.id} data-id={p.id} className={'card' + (role ? ' exposed' : '') + (love ? ' love' : '') + (p.cursed ? ' cursed' : '')}
              style={role ? { ['--rc' as any]: role.color } : undefined} onClick={() => onCard(p.id)}>
              <div className="card-head">
                <div className="card-selfie"><Avatar url={p.selfie_url} name={p.name} />{p.cursed && <span className="skull" title="Cursed">💀</span>}</div>
                <div className="card-meta">
                  <div className="card-top"><span className="num">#{p.seat}</span>{love && <span className="love-badge">💘</span>}</div>
                  <div className="name">{p.name}</div>
                  <div className="card-stats"><span>🍺 {p.beers}</span><span className={'pcount' + (p.punishments.length ? '' : ' zero')}>☠ {p.punishments.length}</span></div>
                </div>
              </div>
              {role ? <div className="role" style={{ color: role.color }}>{role.icon} {role.label}</div> : <div className="role hidden-role">ROLE ???</div>}
              <ul className="plog">{logs.map((l, i) => <li key={i}>{l.via_love ? '💘 ' : l.kind === 'penalty' ? '🍺 ' : l.kind === 'fake_heal' ? '🩹 ' : '☠ '}{l.text}</li>)}</ul>
              <button className="expose-btn" onClick={e => { e.stopPropagation(); onExpose(p.id); }}>EXPOSE</button>
            </div>
          );
        })}
      </div>
      <svg className="love-links" dangerouslySetInnerHTML={{ __html: links }} />
    </div>
  );
}
