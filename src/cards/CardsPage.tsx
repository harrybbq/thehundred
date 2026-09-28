// Printable role cards (A4, 4 per page, cut lines) styled as case files. One card per role slot with a
// unique single-use code. Every blurb is a similar length so reading time gives
// nothing away. Modifiers (Lovebird, Cursed) are extra lines on top of a card's real role.
import { useEffect, useState } from 'react';
import { errText, getBackend } from '../lib/backend';
import type { Role } from '../lib/types';
import { CARD_TEXT, MODIFIER_TEXT, ROLES, TEAMS } from '../lib/roles';

const backend = getBackend('host');
type Card = { code: string; role: Role; lovebird: boolean; cursed: boolean };

export function CardsPage({ code }: { code: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [redeemed, setRedeemed] = useState(0);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      if (!(await backend.userId()) || (await backend.isAnonymous())) { setMsg('Log in as the host first (open /tv), then come back.'); return; }
      const s = await backend.getState(code);
      if (s.error || !s.me.is_host) { setMsg('Room not found, or not yours.'); return; }
      setRoomId(s.room.id); setCounts(s.room.settings.role_counts);
      const r = await backend.api('get_cards', { room_id: s.room.id });
      setCards(r.cards); setRedeemed(r.redeemed);
    } catch (e) { setMsg(errText(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);

  const generate = async () => {
    try { const r = await backend.api('generate_cards', { room_id: roomId, role_counts: counts }); setCards(r.cards); setMsg(''); }
    catch (e) { setMsg(errText(e)); }
  };
  const site = location.host;
  const pages: Card[][] = [];
  (cards ?? []).forEach((c, i) => { if (i % 4 === 0) pages.push([]); pages[pages.length - 1].push(c); });
  const total = counts ? Object.entries(counts).reduce((a, [k, v]) => a + (k === 'lovebird' || k === 'cursed' ? 0 : v), 0) : 0;

  return (
    <div className="cards-page">
      <div className="no-print cards-toolbar">
        <h1>Role cards · room {code}</h1>
        {msg && <p className="err">{msg}</p>}
        {counts && <p>In play: {Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => k === 'lovebird' ? `${v} Lovebird pair${v === 1 ? '' : 's'} (modifier on ${v * 2} of the cards)` : k === 'cursed' ? `${v} Cursed (modifier on ${v} of the cards)` : `${v}× ${ROLES[k as Role].label}`).join(', ')} = <b>{total} cards</b>. Change counts in the TV's Setup → Roles & Cards.</p>}
        {cards && <p>{cards.length} cards ready · {redeemed} redeemed so far. Print on A4 (100% scale, no headers), cut on the dashed lines, one per envelope, shuffle.</p>}
        <div className="row">
          <button className="btn primary" onClick={() => print()} disabled={!cards?.length}>PRINT</button>
          <button className="btn" onClick={generate} disabled={!roomId || redeemed > 0}>{cards?.length ? 'RE-GENERATE CODES' : 'GENERATE CODES'}</button>
        </div>
        {redeemed > 0 && <p className="muted">Codes are locked because someone already redeemed one.</p>}
      </div>
      {pages.map((pg, i) => (
        <div className="sheet" key={i}>
          {pg.map(c => {
            const R = ROLES[c.role];
            return (
              <div className="role-card" key={c.code}>
                <div className="rc-top"><span>THE HUNDRED · 10 OCTOBER</span><b>FILE 100</b></div>
                <div className="rc-id">
                  <div className="rc-frame"><span>{R.icon}</span></div>
                  <div className="rc-meta">
                    <div className="rc-subj">SUBJECT: YOU<br />ROLE:</div>
                    <div className="rc-role">{R.label.toUpperCase()}</div>
                    <div className="rc-team">TEAM: {TEAMS[R.team].label}</div>
                    <div className="rc-conf">CONFIDENTIAL</div>
                  </div>
                </div>
                <p className={'rc-text' + (c.lovebird || c.cursed ? ' love' : '') + (c.lovebird && c.cursed ? ' both' : '')}>{CARD_TEXT[c.role]}</p>
                {c.lovebird && <p className="rc-love">♥ {MODIFIER_TEXT.lovebird}</p>}
                {c.cursed && <p className="rc-love">☠ {MODIFIER_TEXT.cursed}</p>}
                <div className="rc-code-label">YOUR SECRET CODE</div>
                <div className="rc-code">{c.code}</div>
                <div className="rc-foot">Enter it at {site}/join · single use · keep this card hidden</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
