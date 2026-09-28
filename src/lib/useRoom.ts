// Live room state: fetch get_state(), re-fetch on every realtime "changed" ping,
// poll as a safety net, and re-sync on reconnect / tab focus / phone unlock.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Backend } from './backend';
import type { GameState } from './types';

export function useRoom(backend: Backend, code: string | null, onReaction?: (e: string) => void) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const offset = useRef(0);             // server clock − local clock
  const inflight = useRef(false);
  const again = useRef(false);
  const lastPing = useRef(0);
  const subscribed = useRef(false);
  const reactRef = useRef(onReaction);
  reactRef.current = onReaction;

  const refresh = useCallback(async () => {
    if (!code) return;
    if (inflight.current) { again.current = true; return; }
    inflight.current = true;
    try {
      const t0 = Date.now();
      const s = await backend.getState(code);
      offset.current = Date.parse(s.server_now) - (t0 + Date.now()) / 2;
      setState(prev => (prev?.room?.version != null && s.room?.version != null && s.room.version < prev.room.version ? prev : s));
      setError(null);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnected(false);
    } finally {
      inflight.current = false;
      if (again.current) { again.current = false; refresh(); }
    }
  }, [backend, code]);

  useEffect(() => { setState(null); refresh(); }, [refresh]);

  const roomId = state?.room?.id;
  const joined = !!(state?.me?.joined || state?.me?.is_host);
  useEffect(() => {
    if (!roomId || !joined) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = backend.subscribe(roomId, {
      onChange: () => { lastPing.current = Date.now(); clearTimeout(t); t = setTimeout(refresh, 40); },
      onReaction: e => reactRef.current?.(e),
      onStatus: ok => { subscribed.current = ok; if (ok) refresh(); },
    });
    return () => { clearTimeout(t); unsub(); };
  }, [backend, roomId, joined, refresh]);

  // Safety-net polling: fast if realtime has gone quiet, slow otherwise.
  useEffect(() => {
    // Realtime pings make updates instant; this 3s poll guarantees progress even if
    // pings are lost (bad Wi-Fi, a sleeping phone, Realtime hiccups). ~5 req/s for 15 phones.
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') refresh(); }, subscribed.current ? 3000 : 2500);
    const wake = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
    };
  }, [refresh]);

  const now = useCallback(() => Date.now() + offset.current, []);
  return { state, error, connected, refresh, now };
}

/** Re-render every `ms` (for countdowns). */
export function useTicker(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set(x => x + 1), ms); return () => clearInterval(id); }, [ms]);
}
