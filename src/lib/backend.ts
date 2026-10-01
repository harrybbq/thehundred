// Backend abstraction. Production = Supabase (auth, `api` Edge Function,
// get_state RPC, Realtime broadcast, Storage). `VITE_BACKEND=mock` swaps in a
// local test server that runs the same SQL in PGlite (see server/).
import type { GameState } from './types';
import { createSupabaseBackend } from './supabaseBackend';
import { createMockBackend } from './mockBackend';

export type Kind = 'host' | 'player';

export interface RoomHandlers {
  onChange: () => void;
  onReaction?: (emoji: string) => void;
  onStatus?: (connected: boolean) => void;
}

export interface Backend {
  kind: Kind;
  userId(): Promise<string | null>;
  isAnonymous(): Promise<boolean>;
  email(): Promise<string | null>;
  signInAnon(): Promise<void>;
  signInHost(email: string, password: string): Promise<void>;
  signUpHost(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  api<T = any>(action: string, args?: Record<string, unknown>): Promise<T>;
  getState(code: string): Promise<GameState>;
  subscribe(roomId: string, h: RoomHandlers): () => void;
  sendReaction(roomId: string, emoji: string): void;
  uploadSelfie(blob: Blob): Promise<string>;
  /** Evidence photo: random name under `selfies/ev/`, never the filer's uid, so it can't be traced. */
  uploadEvidence(blob: Blob): Promise<string>;
}

const cache: Partial<Record<Kind, Backend>> = {};
export function getBackend(kind: Kind): Backend {
  if (!cache[kind]) {
    cache[kind] = import.meta.env.VITE_BACKEND === 'mock' ? createMockBackend(kind) : createSupabaseBackend(kind);
  }
  return cache[kind]!;
}

/** Friendly error text from anything thrown by the backend. */
export function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/^.*?ERROR:\s*/, '').replace(/\s*\(SQLSTATE.*$/, '');
}
