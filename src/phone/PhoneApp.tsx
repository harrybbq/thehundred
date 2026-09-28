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

function CodeEntry({ onCode }: { onCode: (c: string) => void }) {
  const [c, setC] = useState('');
  return (
    <form className="phone center" onSubmit={e => { e.preventDefault(); if (c.trim().length >= 4) onCode(c.trim().toUpperCase()); }}>
      <Logo className="big" />
      <label className="p-label">ROOM CODE</label>
      <input className="p-input code" value={c} onChange={e => setC(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} placeholder="ABCD" autoCapitalize="characters" autoFocus />
      <button className="p-btn big" disabled={c.length < 4}>JOIN</button>
    </form>
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
    if (!name.trim()) { setMsg('Enter your name'); return; }
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
    <div className="phone join">
      <Logo />
      <div className="p-room">ROOM <b>{code}</b> <button className="link" onClick={onLeave}>change</button></div>
      <label className="selfie-pick">
        <div className="shot">{preview ? <img src={preview} alt="selfie" /> : <><div className="cam" /><b>TAP FOR SELFIE</b></>}</div>
        <div className="cap">{name.trim() ? name.trim() : 'you'}</div>
        <input type="file" accept="image/*" capture="user" onChange={e => pick(e.target.files?.[0])} hidden />
      </label>
      <label className="link upload-link">or upload a photo<input type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} hidden /></label>
      <input className="p-input" placeholder="YOUR NAME" value={name} maxLength={20} onChange={e => setName(e.target.value)} />
      {msg && <p className="err">{msg}</p>}
      <button className="p-btn big" disabled={busy || !name.trim()} onClick={join}>{busy ? 'JOINING…' : photo ? "I'M IN" : 'JOIN WITHOUT SELFIE'}</button>
    </div>
  );
}
