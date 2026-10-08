// Printable role cards (A4, 4 per page, cut lines) styled as case files, each with the role's booking mugshot. One card per role slot with a
// unique single-use code. Every blurb is a similar length so reading time gives
// nothing away. Modifiers (Lovebird, Cursed) are extra lines on top of a card's real role.
import { useEffect, useState } from 'react';
import { errText, getBackend } from '../lib/backend';
import type { Role } from '../lib/types';
import { CARD_TEXT, MODIFIER_TEXT, ROLES, TEAMS } from '../lib/roles';
import { Mugshot } from '../components/Mugshot';
import { ConfirmButton } from '../components/ui';
import { MOD_BADGES, MOD_ICONS } from './mugshots.js';

const backend = getBackend('host');
type Card = { code: string; role: Role; lovebird: boolean; cursed: boolean };

export function CardsPage({ code }: { code: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [redeemed, setRedeemed] = useState(0);
  // unused late cards: the late pile (any role the deck left out) and plain-Drinker spare codes, both made from the TV's
  // Roles & Cards. Printed apart from the deck
  const [spares, setSpares] = useState<Card[]>([]);
  const [showSpares, setShowSpares] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [randomDeal, setRandomDeal] = useState<number | null>(null);   // PICK AT RANDOM: the mix is only on the cards
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      if (!(await backend.userId()) || (await backend.isAnonymous())) { setMsg('Log in as the host first (open /tv), then come back.'); return; }
      const s = await backend.getState(code);
      if (s.error || !s.me.is_host) { setMsg('Room not found, or not yours.'); return; }
      setRoomId(s.room.id); setCounts(s.room.settings.role_counts); setRandomDeal(s.room.settings.random_deal ?? null);
      const r = await backend.api('get_cards', { room_id: s.room.id });
      setCards(r.cards); setRedeemed(r.redeemed); setSpares(r.spares ?? []);
    } catch (e) { setMsg(errText(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [code]);

  const generate = async () => {
    try { const r = await backend.api('generate_cards', { room_id: roomId, role_counts: counts }); setCards(r.cards); setMsg(''); }
    catch (e) { setMsg(errText(e)); }
  };
  // A real A4 PDF of the sheets, so the cards can be printed from a phone (or sent to a print shop).
  const [saving, setSaving] = useState('');
  const savePdf = async () => {
    const sheets = [...document.querySelectorAll<HTMLElement>('.sheet')];
    if (!sheets.length) return;
    setSaving('Making the PDF…');
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      await document.fonts.ready;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < sheets.length; i++) {
        setSaving(`Making the PDF… page ${i + 1} of ${sheets.length}`);
        const img = await toJpeg(sheets[i], { quality: 0.92, pixelRatio: 2.5, backgroundColor: '#fff', style: { margin: '0', boxShadow: 'none', zoom: '1' } });
        if (i) pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, 0, 210, 297);
      }
      pdf.save(`the-hundred-${showSpares ? 'spare' : 'role'}-cards-${code}.pdf`);
      setSaving('');
    } catch (e) { setSaving("Couldn't make the PDF: " + errText(e)); }
  };
  const site = location.host;
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (innerWidth - 24) / 794));   // 210mm ≈ 794px
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);
  const pages: Card[][] = [];
  const shown = showSpares ? spares : (cards ?? []);
  // A random deal and the late pile are secret from the host too: their sheets print and go into the PDF, but stay
  // face down on screen unless the host deliberately peeks (two taps).
  const [peek, setPeek] = useState(false);
  const sealed = (!!randomDeal || showSpares) && !peek;
  shown.forEach((c, i) => { if (i % 4 === 0) pages.push([]); pages[pages.length - 1].push(c); });
  const total = counts ? Object.entries(counts).reduce((a, [k, v]) => a + (k === 'lovebird' || k === 'cursed' ? 0 : v), 0) : 0;

  return (
    <div className="cards-page">
      <div className="no-print cards-toolbar">
        <h1>Role cards · room {code}</h1>
        {msg && <p className="err">{msg}</p>}
        {/* the TV never shows a spare (it's in the room's view): the host reads it here, on their own phone */}
        {spares.length > 0 && <div className="spare-list" style={{ margin: '12px 0 18px', padding: '14px 16px', border: '3px solid currentColor', borderRadius: 10 }}>
          <div className="spare-list-k" style={{ fontWeight: 800, letterSpacing: '.08em', fontSize: 15 }}>UNUSED LATE CODE{spares.length === 1 ? '' : 'S'} · for a late guest only</div>
          {spares.map(c => <div key={c.code} className="spare-list-code" style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontWeight: 800, fontSize: 'clamp(40px, 13vw, 64px)', letterSpacing: '.06em', lineHeight: 1.15, margin: '6px 0', userSelect: 'all' }}>{c.code}</div>)}
          <div className="muted">They join the room, then type it in YOUR FILE. Single use. A used one drops off this list.</div>
          <button className="btn" style={{ marginTop: 8 }} onClick={load}>REFRESH</button>
        </div>}
        {randomDeal && <p><b>Dealt at random: {randomDeal} sealed cards.</b> Nobody knows the mix, you included. The roles print on the cards,
          so print and cut without reading them (or ask someone who isn't playing). To re-deal, use the TV's Setup → Roles & Cards.</p>}
        {counts && !randomDeal && <p>In play: {Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => k === 'lovebird' ? `${v} Lovebird pair${v === 1 ? '' : 's'} (modifier on ${v * 2} of the cards)` : k === 'cursed' ? `${v} Cursed (modifier on ${v} of the cards)` : `${v}× ${ROLES[k as Role].label}`).join(', ')} = <b>{total} cards</b>. Change counts in the TV's Setup → Roles & Cards.</p>}
        {cards && <p>{cards.length} cards ready · {redeemed} redeemed so far. Print on A4 (100% scale, no headers), cut on the dashed lines, one per envelope, shuffle.</p>}
        <div className="row">
          <button className="btn primary" onClick={savePdf} disabled={!shown.length || saving.startsWith('Making')}>SAVE PDF</button>
          <button className="btn" onClick={() => print()} disabled={!shown.length}>PRINT</button>
          {!cards?.length && <button className="btn" onClick={generate} disabled={!roomId || redeemed > 0}>GENERATE CODES</button>}
        </div>
        {/* re-dealing kills every card already printed: kept apart from PRINT, and it takes two taps */}
        {!!cards?.length && redeemed === 0 && !randomDeal && <div className="row" style={{ marginTop: 18 }}>
          <ConfirmButton className="btn danger" onConfirm={generate} disabled={!roomId} confirmText="PRINTED CARDS STOP WORKING · TAP AGAIN">RE-DEAL: NEW CODES</ConfirmButton>
        </div>}
        {(spares.length > 0 || showSpares) && <div className="row spare-row">
          <button className={'btn' + (showSpares ? ' primary' : '')} onClick={() => { setShowSpares(!showSpares); setPeek(false); }}>
            {showSpares ? 'BACK TO THE DECK' : `PRINT LATE CARDS (${spares.length})`}</button>
          <span className="muted">{showSpares ? 'Showing only the unused late cards (the late pile and any spare codes). They print exactly like any other card: keep them in their own pile.' : 'The late pile and spare codes for late guests, made on the TV. Keep them apart from the main deck.'}</span>
        </div>}
        {sealed && shown.length > 0 && <div className="sealed-note">
          <p><b>{shown.length} {shown.length === 1 ? 'card is' : 'cards are'} face down</b> so you don't see the mix. PRINT and SAVE PDF still include {shown.length === 1 ? 'it' : 'them'}.
            The print preview and the PDF show the roles, so look away from those.</p>
          <ConfirmButton className="btn" confirmText="YOU'LL SEE THE ROLES · TAP AGAIN" onConfirm={() => setPeek(true)}>PEEK AT THE CARDS</ConfirmButton>
        </div>}
        {saving && <p className="muted">{saving}</p>}
        {cards && <p className="muted">The PDF has every secret code in it. Print it, then delete it, and don't share it in a group chat.</p>}
        {redeemed > 0 && <p className="muted">Codes are locked because someone already redeemed one.</p>}
      </div>
      <div className={'sheets' + (sealed ? ' sealed' : '')} aria-hidden={sealed || undefined}>
      {pages.map((pg, i) => (
        <div className="sheet" key={i} style={zoom < 1 ? { zoom } : undefined}>
          {pg.map(c => {
            const R = ROLES[c.role];
            return (
              <div className="role-card" key={c.code}>
                <div className="rc-top"><span>THE HUNDRED · 10 OCTOBER</span><b>FILE 100</b></div>
                <div className="rc-id">
                  <Mugshot role={c.role} className="rc-frame" />
                  <div className="rc-meta">
                    <div className="rc-subj">SUBJECT: YOU<br />ROLE:</div>
                    <div className="rc-role">{R.label.toUpperCase()}</div>
                    <div className="rc-team">TEAM: {TEAMS[R.team].label.toUpperCase()}</div>
                    <div className="rc-conf">CONFIDENTIAL</div>
                    <div className="rc-badges">
                      {c.lovebird && <div className="rc-badge"><span dangerouslySetInnerHTML={{ __html: MOD_BADGES.lovebird }} /><b>LOVEBIRD</b></div>}
                      {c.cursed && <div className="rc-badge"><span dangerouslySetInnerHTML={{ __html: MOD_BADGES.cursed }} /><b>CURSED</b></div>}
                    </div>
                  </div>
                </div>
                <p className={'rc-text' + (c.lovebird || c.cursed ? ' love' : '') + (c.lovebird && c.cursed ? ' both' : '')}>{CARD_TEXT[c.role]}</p>
                {c.lovebird && <p className="rc-mod"><span dangerouslySetInnerHTML={{ __html: MOD_ICONS.lovebird }} /><span>{MODIFIER_TEXT.lovebird}</span></p>}
                {c.cursed && <p className="rc-mod"><span dangerouslySetInnerHTML={{ __html: MOD_ICONS.cursed }} /><span>{MODIFIER_TEXT.cursed}</span></p>}
                <div className="rc-bottom">
                  <div className="rc-code">{c.code}</div>
                  <div className="rc-code-side"><div className="rc-code-label">YOUR SECRET CODE</div><div className="rc-foot">Enter it at {site}/join · single use · keep this card hidden</div></div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
