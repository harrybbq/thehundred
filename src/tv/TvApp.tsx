// TV / host screen entry: host login (Supabase email+password) → pick or create a room → TvRoom.
import { useEffect, useState } from 'react';
import { errText, getBackend } from '../lib/backend';
import { computeDeadline } from '../lib/util';
import { TvRoom } from './TvRoom';
import { TestLab } from './TestLab';
import { RoomList, type RoomRow } from './RoomList';
import { Logo } from '../components/ui';
import { useTvStage } from './stage';

const backend = getBackend('host');

export function TvApp() {
  useTvStage();   // root scale + TV edge margin variables for every TV screen
  const [phase, setPhase] = useState<'loading' | 'login' | 'rooms'>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(() => new URLSearchParams(location.search).get('room'));
  const [lab, setLabState] = useState(() => new URLSearchParams(location.search).has('lab'));
  const setLab = (on: boolean) => {
    setLabState(on);
    const u = new URL(location.href);
    if (on) u.searchParams.set('lab', '1'); else u.searchParams.delete('lab');
    history.replaceState(null, '', u);
  };

  useEffect(() => {
    (async () => {
      const uid = await backend.userId();
      if (uid && !(await backend.isAnonymous())) { setEmail(await backend.email()); setPhase('rooms'); }
      else setPhase('login');
    })();
  }, []);

  const openRoom = (c: string | null) => {
    setCode(c);
    const u = new URL(location.href);
    if (c) u.searchParams.set('room', c); else u.searchParams.delete('room');
    history.replaceState(null, '', u);
  };

  if (phase === 'loading') return <div className="center-screen"><Logo className="big" /></div>;
  if (phase === 'login') return <HostLogin onDone={async () => { setEmail(await backend.email()); setPhase('rooms'); }} />;
  if (code) return <TvRoom backend={backend} code={code} onExit={() => openRoom(null)} />;
  if (lab) return <TestLab backend={backend} onOpen={openRoom} onBack={() => setLab(false)} />;
  return <RoomPicker email={email} onOpen={openRoom} onLab={() => setLab(true)} onSignOut={async () => { await backend.signOut(); setPhase('login'); }} />;
}

function HostLogin({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async (signup: boolean) => {
    setBusy(true); setMsg('');
    try { await (signup ? backend.signUpHost(email.trim(), pw) : backend.signInHost(email.trim(), pw)); onDone(); }
    catch (e) { setMsg(errText(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="center-screen">
      <form className="host-card" onSubmit={e => { e.preventDefault(); go(false); }}>
        <Logo className="big" />
        <p className="muted">Host login — guests join on their phones instead.</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required minLength={6} />
        {msg && <p className="err">{msg}</p>}
        <div className="row">
          <button className="btn primary grow" disabled={busy} type="submit">LOG IN</button>
          <button className="btn" disabled={busy} type="button" onClick={() => go(true)}>CREATE ACCOUNT</button>
        </div>
        <a className="muted small-link" href="/">← I'm a guest</a>
      </form>
    </div>
  );
}

function RoomPicker({ email, onOpen, onLab, onSignOut }: { email: string | null; onOpen: (c: string) => void; onLab: () => void; onSignOut: () => void }) {
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { backend.api<RoomRow[]>('my_rooms').then(r => setRooms(r.filter(x => !x.practice))).catch(e => setMsg(errText(e))); }, []);
  const create = async () => {
    setBusy(true);
    try {
      // Default deadline: 01:00 the morning after the party night (10 Oct) — or 5h from now if that's passed.
      let deadline = computeDeadline('2026-10-10', '01:00');
      if (deadline < Date.now()) deadline = Date.now() + 5 * 3600e3;
      const r = await backend.api<{ code: string }>('create_room', { deadline_at: new Date(deadline).toISOString() });
      onOpen(r.code);
    } catch (e) { setMsg(errText(e)); setBusy(false); }
  };
  return (
    <div className="center-screen">
      <div className="host-card wide">
        <Logo className="big" />
        <p className="muted">Logged in as {email}</p>
        <button className="btn-beer" disabled={busy} onClick={create}>+ CREATE ROOM</button>
        {msg && <p className="err">{msg}</p>}
        {rooms && <RoomList backend={backend} rooms={rooms} title="YOUR ROOMS" onOpen={onOpen} onDeleted={id => setRooms(rs => rs && rs.filter(x => x.id !== id))} />}
        <div className="row">
          <button className="btn grow" onClick={onLab} title="Try the animations and abilities with bots">🧪 TEST LAB</button>
          <button className="btn grow" onClick={onSignOut}>SIGN OUT</button>
        </div>
      </div>
    </div>
  );
}
