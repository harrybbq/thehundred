// LOCAL TEST SERVER ONLY — lets the real UI run end-to-end without Supabase.
// Runs the real migrations in PGlite and mimics the few Supabase pieces the app
// uses: anonymous/host auth, the `api` function, get_state, realtime pings
// (Server-Sent Events) and selfie uploads. Start: `npm run mock-server`,
// then `VITE_BACKEND=mock npm run dev`.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createDb, api, state, addUser } from './db.mjs';

const PORT = Number(process.env.MOCK_PORT || 8787);
const db = await createDb();
const hosts = new Map();        // email -> { uid, password }
const files = new Map();        // id -> Buffer
const listeners = new Map();    // roomId -> Set(res)

const send = (roomId, msg) => {
  for (const res of listeners.get(roomId) ?? []) res.write(`data: ${JSON.stringify(msg)}\n\n`);
};
await db.listen('room_events', payload => {
  const [topic, event] = payload.split('|');
  if (event === 'changed') send(topic.replace(/^room:/, ''), { type: 'changed' });
});

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (res, status, body) => { res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise(r => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => r(Buffer.concat(chunks))); });
const cleanErr = e => String(e?.message || e).replace(/^error:\s*/i, '');

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const uid = req.headers.authorization || null;
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  try {
    if (url.pathname === '/auth/anon') {
      const id = randomUUID(); await addUser(db, id, true);
      return json(res, 200, { uid: id, anon: true });
    }
    if (url.pathname === '/auth/host') {
      const { email, password } = JSON.parse((await readBody(req)).toString() || '{}');
      let h = hosts.get(email);
      if (!h) { h = { uid: randomUUID(), password }; hosts.set(email, h); await addUser(db, h.uid, false, email); }
      if (h.password !== password) return json(res, 400, { error: 'Invalid login credentials' });
      return json(res, 200, { uid: h.uid, anon: false, email });
    }
    if (url.pathname === '/state') {
      if (!uid) return json(res, 401, { error: 'Not signed in' });
      return json(res, 200, await state(db, uid, url.searchParams.get('code') || ''));
    }
    if (url.pathname === '/api') {
      if (!uid) return json(res, 401, { error: 'Not signed in' });
      const { action, args } = JSON.parse((await readBody(req)).toString() || '{}');
      try { return json(res, 200, await api(db, uid, action, args)); }
      catch (e) { return json(res, 400, { error: cleanErr(e) }); }
    }
    if (url.pathname === '/upload') {
      const id = randomUUID(); files.set(id, await readBody(req));
      return json(res, 200, { url: `http://${req.headers.host}/files/${id}` });
    }
    if (url.pathname.startsWith('/files/')) {
      const f = files.get(url.pathname.slice(7));
      if (!f) { res.writeHead(404, cors); return res.end(); }
      res.writeHead(200, { ...cors, 'Content-Type': 'image/jpeg' }); return res.end(f);
    }
    if (url.pathname === '/events') {
      const room = url.searchParams.get('room');
      res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': hi\n\n');
      if (!listeners.has(room)) listeners.set(room, new Set());
      listeners.get(room).add(res);
      req.on('close', () => listeners.get(room)?.delete(res));
      return;
    }
    if (url.pathname === '/react') {
      const { room, e } = JSON.parse((await readBody(req)).toString() || '{}');
      send(room, { type: 'react', e });
      return json(res, 200, { ok: true });
    }
    // test helper: run SQL (e.g. force a landing) — local only
    if (url.pathname === '/__sql' && process.env.MOCK_ALLOW_SQL) {
      const { sql, params } = JSON.parse((await readBody(req)).toString());
      return json(res, 200, (await db.query(sql, params || [])).rows);
    }
    json(res, 404, { error: 'not found' });
  } catch (e) { json(res, 500, { error: cleanErr(e) }); }
}).listen(PORT, () => console.log(`mock backend on http://localhost:${PORT}`));
