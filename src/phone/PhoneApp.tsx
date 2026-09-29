// Player phone: anonymous Supabase sign-in (persists across refresh / phone lock),
// join with name + selfie, unlock a private role with a code, log beers, react,
// vote, and use abilities. Built for drunk one-handed use.
import { useEffect, useState } from 'react';
import { errText, getBackend } from '../lib/backend';
import { useRoom, useTicker } from '../lib/useRoom';
import { compressImage } from '../lib/util';
import { floatEmoji } from '../fx/effects';
import { PhoneHome } from './PhoneHome';
import { Logo } from '../components/ui';
import { Icon, Key } from './kit';

const backend = getBackend('player');
const ROOM_KEY = 'thehundred-room';

export function PhoneApp({ initialCode }: { initialCode: string | null }) {
  const [ready, setReady] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [code, setCode] = useState<string | null>(() => {
    const c = initialCode || (() => { try { return localStorage.getItem(ROOM_KEY); } catch { return null; } })();
    return c ? c.toUpperCase() : null;
  });

  useEffect(() => {
    (async () => {
      try { if (!(await backend.userId())) await backend.signInAnon(); setReady(true); }
      catch (e) { setAuthErr(errText(e)); }
    })();
  }, []);
  useEffect(() => { if (code) { try { localStorage.setItem(ROOM_KEY, code); } catch { /* ignore */ } } }, [code]);

  if (authErr) return <div className="phone center"><p className="err">Can't connect: {authErr}</p><button className="p-btn" onClick={() => location.reload()}>TRY AGAIN</button></div>;
  if (!ready) return <div className="phone center"><Logo className="big" /></div>;
  if (!code) return <CodeEntry onCode={c => { setCode(c); history.replaceState(null, '', `/join/${c}`); }} />;
  return <PhoneRoom code={code} onLeave={() => { try { localStorage.removeItem(ROOM_KEY); } catch { /* ignore */ } setCode(null); history.replaceState(null, '', '/join'); }} />;
}

// Step 1 of 3: the room code (the 4 letters on the TV)
function CodeEntry({ onCode }: { onCode: (c: string) => void }) {
  const [c, setC] = useState('');
  const go = () => { if (c.length === 4) onCode(c); };
  return (
    <div className="pu-app">
      <div className="pu-tb"><div className="pu-step"><i className="on" /><i /><i /></div><span className="pu-grow" /><span className="pu-label">STEP 1 OF 3</span></div>
      <div className="pu-logo" style={{ marginTop: 32 }}><span className="the">The</span><span className="h">HUNDRED</span></div>
      <div className="pu-h1 pu-center" style={{ marginTop: 24 }}>Join the game</div>
      <div className="pu-small pu-center">Type the 4 letters on the TV.</div>
      <div className="pu-boxes" style={{ marginTop: 12 }}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={'pu-lbox' + (i === c.length ? ' cur' : '')}>{c[i] ?? (i === c.length ? <span className="caret" /> : '')}</div>)}
        <input className="code" aria-label="Room code" value={c} autoCapitalize="characters" autoComplete="off" autoFocus
          onChange={e => setC(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      </div>
      <div className="pu-small pu-center">No code? Point your camera at the QR code on the TV.</div>
      <div className="pu-keys"><Key lg disabled={c.length < 4} onClick={go}>{c.length < 4 ? <>JOIN <span className="pu-why">({4 - c.length} more letter{4 - c.length === 1 ? '' : 's'})</span></> : 'JOIN'}</Key></div>
    </div>
  );
}

function PhoneRoom({ code, onLeave }: { code: string; onLeave: () => void }) {
  const room = useRoom(backend, code, floatEmoji);
  useTicker(500);
  const { state, error } = room;
  if (!state) return <div className="phone center"><Logo className="big" /><p className="muted">{error ?? 'Connecting…'}</p></div>;
  if (state.error === 'no_room') return <div className="phone center"><p className="err">No room called {code}.</p><button className="p-btn" onClick={onLeave}>TRY ANOTHER CODE</button></div>;
  if (!state.me.joined) return <JoinForm code={code} onJoined={room.refresh} onLeave={onLeave} />;
  return <PhoneHome backend={backend} state={state} room={room} />;
}

function JoinForm({ code, onJoined, onLeave }: { code: string; onJoined: () => void; onLeave: () => void }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('thehundred-name') ?? ''; } catch { return ''; } });
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const pick = async (f?: File | null) => {
    if (!f) return;
    try { const b = await compressImage(f); setPhoto(b); setPreview(URL.createObjectURL(b)); setMsg(''); }
    catch { setMsg("Couldn't read that photo. Try another."); }
  };
  const join = async () => {
    if (!name.trim()) { setMsg('Type your name'); return; }
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      let url: string | undefined;
      if (photo) url = await backend.uploadSelfie(photo);
      await backend.api('join', { code, name: name.trim(), selfie_url: url });
      try { localStorage.setItem('thehundred-name', name.trim()); } catch { /* ignore */ }
      onJoined();
    } catch (e) { setMsg(errText(e)); setBusy(false); }
  };

  return (
    <div className="pu-app">
      <div className="pu-tb">
        <button type="button" className="pu-back" aria-label="Change room" onClick={onLeave}><Icon n="back" /></button>
        <div className="pu-step"><i className="on" /><i className="on" /><i /></div><span className="pu-grow" /><span className="pu-label">STEP 2 OF 3</span>
      </div>
      <div className="pu-h1">Who are you?</div>
      <div className="pu-small">Your photo and name go up on the TV. Room <b style={{ color: 'var(--bone)' }}>{code}</b>.</div>
      <label className="pu-polar">
        {preview ? <img src={preview} alt="Your selfie" /> : <span className="ph"><Icon n="camera" /></span>}
        <span className="cap">{name.trim() || (preview ? 'you' : 'Tap for a selfie')}</span>
        <input type="file" accept="image/*" capture="user" onChange={e => pick(e.target.files?.[0])} hidden />
      </label>
      <label className="pu-key ghost" style={{ width: 'auto', alignSelf: 'center', padding: '0 24px', cursor: 'pointer' }}><Icon n="camera" />{preview ? 'New photo' : 'Upload a photo'}
        <input type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} hidden /></label>
      <div><div className="pu-label" style={{ marginBottom: 8 }}>YOUR NAME</div>
        <input className="pu-field" placeholder="YOUR NAME" value={name} maxLength={20} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') join(); }} /></div>
      {msg && <div className="pu-body pu-c-red">{msg}</div>}
      <div className="pu-keys"><Key lg disabled={busy || !name.trim()} className="pu-join" onClick={join}>{busy ? 'JOINING…' : name.trim() ? `JOIN AS ${name.trim().toUpperCase()}` : <>JOIN <span className="pu-why">(type your name)</span></>}</Key></div>
    </div>
  );
}
