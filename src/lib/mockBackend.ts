// Local test backend: talks to server/mock-server.mjs (same SQL, run in PGlite).
// Only used when VITE_BACKEND=mock.
import type { Backend, Kind } from './backend';

const BASE = (import.meta.env.VITE_MOCK_URL as string) || `${location.protocol}//${location.hostname}:8787`;

export function createMockBackend(kind: Kind): Backend {
  const key = `thehundred-mock-${kind}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const save = (v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };
  const call = async (path: string, body?: unknown) => {
    const s = load();
    const res = await fetch(BASE + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: s.uid } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  };
  const sources = new Map<string, EventSource>();
  const upload = async (blob: Blob) => {
    const s = load();
    const res = await fetch(BASE + '/upload', { method: 'POST', headers: { Authorization: s?.uid ?? '' }, body: blob });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    return d.url as string;
  };

  return {
    kind,
    async userId() { return load()?.uid ?? null; },
    async isAnonymous() { return !!load()?.anon; },
    async email() { return load()?.email ?? null; },
    async signInAnon() { save(await call('/auth/anon', {})); },
    async signInHost(email, password) { save(await call('/auth/host', { email, password })); },
    async signUpHost(email, password) { save(await call('/auth/host', { email, password })); },
    async signOut() { localStorage.removeItem(key); },
    async api(action, args = {}) { return call('/api', { action, args }); },
    async getState(code) { return call('/state?code=' + encodeURIComponent(code)); },
    subscribe(roomId, h) {
      const es = new EventSource(`${BASE}/events?room=${roomId}`);
      sources.set(roomId, es);
      es.onopen = () => h.onStatus?.(true);
      es.onerror = () => h.onStatus?.(false);
      es.onmessage = m => {
        const d = JSON.parse(m.data);
        if (d.type === 'changed') h.onChange();
        if (d.type === 'react') h.onReaction?.(d.e);
      };
      return () => { es.close(); sources.delete(roomId); };
    },
    sendReaction(roomId, emoji) { call('/react', { room: roomId, e: emoji }).catch(() => {}); },
    uploadSelfie: upload,
    uploadEvidence: upload,       // mock /files/<random id> carries no uid either way
  };
}
