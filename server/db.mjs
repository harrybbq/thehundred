// Loads the real Supabase migrations into an in-process PGlite database (local testing only).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export async function createDb() {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'server/mock-prelude.sql'), 'utf8'));
  const dir = join(root, 'supabase/migrations');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql') && !f.includes('storage')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return db;
}
/** Run api_exec as a user. */
export async function api(db, uid, action, args = {}) {
  const r = await db.query('select public.api_exec($1, $2, $3::jsonb) as res', [uid, action, JSON.stringify(args)]);
  return r.rows[0].res;
}
/** Run get_state as a user (sets the JWT claim like PostgREST does). */
export async function state(db, uid, code) {
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
    const r = await tx.query('select public.get_state($1) as s', [code]);
    return r.rows[0].s;
  });
}
export async function addUser(db, id, anon = true, email = null) {
  await db.query('insert into auth.users (id, is_anonymous, email) values ($1, $2, $3) on conflict do nothing', [id, anon, email]);
}
