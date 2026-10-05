// TV "Suspects" board (approved mockup: design/mockups/Board.dc.html): one manila case card per player. The name sits up top
// and is never covered; public facts are solid bands under it (the IDENTIFIED role, the Angel, Davy Jones' Locker with its
// countdown, SHIVVED BY); a dark plate carries beers + level and the punishment count. Cursed = a burnt top-right corner
// with the skull; rehab greys the photo and tapes it; the Champ wears a crown, the Angel a halo; red string joins revealed
// Lovebirds. Cards are sized to fit the panel and centred; long names shrink to fit two lines. EXPOSE lives in the
// card-tap detail modal, not on the board.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Player } from '../lib/types';
import { ROLES, levelOf } from '../lib/roles';
import { tiltFor } from '../components/ui';
import { initials } from '../lib/util';
import { CurseFx, type Box, type Rect } from './CurseFx';

const fmtLeft = (ms: number) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

// ---------- curse pass (TV-17): CurseFx.tsx plays it across the board, between the two measured cards ----------

export function PlayerGrid({ players, revealMask, onCard, onEmpty, champs = [], now = Date.now(), curse = null }: {
  players: Player[]; revealMask: Set<string>; onCard: (id: string) => void; onEmpty: () => void;
  champs?: string[]; now?: number; curse?: { from: string; to: string; key: number } | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ cw: 300, ch: 200 });
  const [links, setLinks] = useState({ str: '', pins: '' });
  // curse pass: measure both cards when it starts
  const [cbox, setCbox] = useState<null | { from: Box | null; to: Box | null; names: Rect[]; key: number }>(null);
  useLayoutEffect(() => {
    if (!curse) { setCbox(null); return; }
    const w = wrap.current?.getBoundingClientRect();
    // a name's ink box (its text, not its padded block), relative to the wrap
    const nameBox = (el: Element | null | undefined): Rect | undefined => {
      if (!el || !w) return undefined;
      const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect();
      return b.width ? { x: b.left - w.left, y: b.top - w.top, w: b.width, h: b.height } : undefined;
    };
    const m = (id: string): Box | null => {
      const card = grid.current?.querySelector(`[data-id="${id}"]`), b = card?.getBoundingClientRect();
      if (!b || !w) return null;
      // the board's own resting skull on that card (laid out even while hidden), so the pass lands exactly on it
      const sk = card?.querySelector('.curse .skull')?.getBoundingClientRect(), nm = nameBox(card?.querySelector('.name'));
      return { x: b.left - w.left, y: b.top - w.top, w: b.width, h: b.height, ...(nm ? { nm } : {}), ...(sk && sk.width ? { sk: { x: sk.left + sk.width / 2 - w.left, y: sk.top + sk.height / 2 - w.top } } : {}) };
    };
    // every name on the board: the shadow figure never holds over one
    const names = [...(grid.current?.querySelectorAll('.case .name') ?? [])].map(nameBox).filter((r): r is Rect => !!r);
    setCbox({ from: m(curse.from), to: m(curse.to), names, key: curse.key });
  }, [curse?.key, size.cw, size.ch]);     // re-measured if the board re-lays out mid-pass (window or fullscreen change)

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
        const x1 = a.left + a.width / 2 - w.left, y1 = a.top + 2 - w.top, x2 = b.left + b.width / 2 - w.left, y2 = b.top + 2 - w.top;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + Math.min(70, Math.hypot(x2 - x1, y2 - y1) * 0.14);
        const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
        str += `<path class="str-shadow" d="${d}" transform="translate(3,5)"/><path class="str" d="${d}"/><path class="str-hi" d="${d}" transform="translate(-1,-1.5)"/>`;
        // a red map pin at each polaroid, with a little heart (the pair is public once revealed)
        const pin = (x: number, y: number) => `<circle class="pinhead" cx="${x}" cy="${y}" r="15"/><path class="pinheart" d="M${x} ${y + 6} l-6.5 -6.5 a3.6 3.6 0 0 1 6.5 -4.4 a3.6 3.6 0 0 1 6.5 4.4 z"/><circle class="pinhi" cx="${x - 6}" cy="${y - 7}" r="2.4"/>`;
        pins += pin(x1, y1) + pin(x2, y2);
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
          const lvl = levelOf(p);
          const shivBy = p.shivved_by ? (players.find(q => q.id === p.shivved_by)?.name ?? '?').toUpperCase() : null;
          const cls = ['case', cbox && curse?.to === p.id && 'curse-in', cbox && curse?.from === p.id && 'curse-out', role && 'exposed', p.cursed && 'cursed', rehab && 'rehab',
            role && p.public_role === 'intruder' && 'burnt', angel && 'angel', lockLeft > 0 && 'locked'].filter(Boolean).join(' ');
          return (
            <div key={p.id} data-id={p.id} className={cls} style={{ ['--tilt' as any]: tiltFor(p.name, 1.1) }} onClick={() => onCard(p.id)}>
              <div className="case-in">
                <div className="case-top">
                  <div className="cph">
                    <div className="cpol">
                      <div className="cphoto">
                        {p.selfie_url ? <img src={p.selfie_url} alt={p.name} draggable={false} /> : initials(p.name)}
                        {lockLeft > 0 && <div className="sea">{!still && [0, 1, 2].map(i => <i key={i} className="bub" style={{ left: `${20 + i * 28}%`, ['--i' as any]: i }} />)}</div>}
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
      {cbox && curse && <CurseFx key={`${cbox.key}:${size.cw}x${size.ch}`} from={cbox.from} to={cbox.to} fromId={curse.from} toId={curse.to} wrap={wrap.current} names={cbox.names}
        fromName={players.find(p => p.id === curse.from)?.name ?? ''} toName={players.find(p => p.id === curse.to)?.name ?? ''} />}
    </div>
  );
}
