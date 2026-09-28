import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend, Kind, RoomHandlers } from './backend';
import type { GameState } from './types';

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string;

export function createSupabaseBackend(kind: Kind): Backend {
  // Separate storage keys so the host login and a player identity can live in the same browser.
  const sb: SupabaseClient = createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: `thehundred-${kind}` },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const channels = new Map<string, { ch: RealtimeChannel; handlers: Set<RoomHandlers> }>();

  const user = async () => (await sb.auth.getSession()).data.session?.user ?? null;

  return {
    kind,
    async userId() { return (await user())?.id ?? null; },
    async isAnonymous() { return !!(await user())?.is_anonymous; },
    async email() { return (await user())?.email ?? null; },
    async signInAnon() { const { error } = await sb.auth.signInAnonymously(); if (error) throw error; },
    async signInHost(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signUpHost(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Check your email to confirm the account, then log in.');
    },
    async signOut() { await sb.auth.signOut(); },

    async api(action, args = {}) {
      const { data, error } = await sb.functions.invoke('api', { body: { action, args } });
      if (error) {
        let msg = error.message;
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch { /* keep msg */ }
        throw new Error(msg);
      }
      return data;
    },

    async getState(code) {
      const { data, error } = await sb.rpc('get_state', { p_code: code });
      if (error) throw new Error(error.message);
      return data as GameState;
    },

    subscribe(roomId, h) {
      let entry = channels.get(roomId);
      if (!entry) {
        const handlers = new Set<RoomHandlers>();
        const ch = sb.channel(`room:${roomId}`, { config: { broadcast: { self: true } } })
          .on('broadcast', { event: 'changed' }, () => handlers.forEach(x => x.onChange()))
          .on('broadcast', { event: 'react' }, ({ payload }) => handlers.forEach(x => x.onReaction?.(payload?.e)))
          .subscribe(status => handlers.forEach(x => x.onStatus?.(status === 'SUBSCRIBED')));
        entry = { ch, handlers };
        channels.set(roomId, entry);
      }
      entry.handlers.add(h);
      return () => {
        entry!.handlers.delete(h);
        if (!entry!.handlers.size) { sb.removeChannel(entry!.ch); channels.delete(roomId); }
      };
    },

    sendReaction(roomId, emoji) {
      channels.get(roomId)?.ch.send({ type: 'broadcast', event: 'react', payload: { e: emoji } });
    },

    async uploadSelfie(blob) {
      const uid = (await user())?.id;
      if (!uid) throw new Error('Not signed in');
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('selfies').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      return sb.storage.from('selfies').getPublicUrl(path).data.publicUrl;
    },
  };
}
