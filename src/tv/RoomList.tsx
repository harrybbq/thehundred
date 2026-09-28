// The host's room list (main menu + Test Lab). Each row opens the room; the bin asks
// in place before deleting the room and everything in it.
import { useState } from 'react';
import type { Backend } from '../lib/backend';
import { errText } from '../lib/backend';
import { fmtClock } from '../lib/util';

export type RoomRow = { id: string; code: string; created_at: string; players: number; practice?: boolean };

export function RoomList({ backend, rooms, title, onOpen, onDeleted }: {
  backend: Backend; rooms: RoomRow[]; title?: string; onOpen: (code: string) => void; onDeleted: (id: string) => void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const del = async (id: string) => {
    setBusy(true); setMsg('');
    try { await backend.api('delete_room', { room_id: id }); onDeleted(id); setAsking(null); }
    catch (e) { setMsg(errText(e)); }
    finally { setBusy(false); }
  };
  if (!rooms.length) return null;
  return (
    <div className="room-list">
      {title && <div className="muted">{title}</div>}
      {rooms.map(r => asking === r.id ? (
        <div key={r.id} className="room-row-wrap asking">
          <span>Delete <b>{r.code}</b> and all {r.players} players, punishments and photos? This can't be undone.</span>
          <button className="btn danger" disabled={busy} onClick={() => del(r.id)}>DELETE</button>
          <button className="btn" disabled={busy} onClick={() => setAsking(null)}>KEEP</button>
        </div>
      ) : (
        <div key={r.id} className="room-row-wrap">
          <button className="btn room-row" onClick={() => onOpen(r.code)}>
            <b>{r.code}</b><span>{r.players} players</span><span className="muted">{new Date(r.created_at).toLocaleDateString()} {fmtClock(Date.parse(r.created_at))}</span>
          </button>
          <button className="btn room-del" title={`Delete room ${r.code}`} onClick={() => { setAsking(r.id); setMsg(''); }}>🗑</button>
        </div>
      ))}
      {msg && <p className="err">{msg}</p>}
    </div>
  );
}
