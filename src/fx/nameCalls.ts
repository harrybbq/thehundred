// NAME CALLS: the TV summons players by name with real audio clips (public/assets/names/, see the README
// there), falling back to the speech voice for any name without one. Clips play through the shared
// AudioContext, so they go through the master compressor and obey the TV's sound switch.
//
//   preloadNameCalls()   fetch the manifest and every clip that exists (safe to call many times)
//   summon(names)        play each name in turn (~250ms apart), then the closing "TO THE TV"
//   stopSummon()         cut it off at once
//
// A summon never overlaps itself: a new summon() cuts off the one still playing and starts over with the
// fresh list. Every clip is capped at 3.5s so an over-long file can't drag on.
import { audioCtx, audioOut, soundEnabled } from './sound';
import { say, stopSpeaking } from './speak';

const DIR = '/assets/names/';
const GAP_MS = 250;          // between names
const STINGER_GAP_MS = 350;  // before the closing line
const CAP_S = 3.5;           // longest any one clip may play
const FADE_S = 0.08;         // fade at a cap, so a cut-off clip doesn't click
const STINGER_TEXT = 'To the TV. Now.';
const STINGER_KEY = '_stinger';   // optional manifest entry: a clip to play instead of the spoken closing line

type FileSpec = string | { file: string; start?: number; end?: number; gain?: number };
type Entry = { files?: FileSpec[]; aliases?: string[] };
type Clip = { url: string; start: number; end: number | null; gain: number; bytes: ArrayBuffer; buf?: Promise<AudioBuffer | null> };

/** lower case, accents dropped, letters and digits only: "Zoë" → "zoe", "O'Brien" → "obrien" */
export const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

let loading: Promise<void> | null = null;
const clips = new Map<string, Clip[]>();   // manifest key (normalised) → clips that actually exist
const lookup = new Map<string, string>();  // normalised name or alias → manifest key

const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);

async function fetchClip(spec: FileSpec): Promise<Clip | null> {
  const s = typeof spec === 'string' ? { file: spec } : spec;
  if (!s?.file) return null;
  const url = DIR + s.file.split('/').map(encodeURIComponent).join('/');
  try {
    const r = await fetch(url);   // default caching: a file added later is picked up on the next reload
    if (!r.ok) return null;
    // the SPA answers a missing file with index.html (200, text/html), so only real audio counts
    const type = (r.headers.get('content-type') ?? '').toLowerCase();
    if (!type.startsWith('audio/') && !type.startsWith('application/octet-stream')) return null;
    const bytes = await r.arrayBuffer();
    if (!bytes.byteLength) return null;
    const start = Math.max(0, num(s.start, 0));
    const end = typeof s.end === 'number' && s.end > start ? s.end : null;
    return { url, start, end, gain: Math.max(0, num(s.gain, 1)), bytes };
  } catch { return null; }
}

/** Load the manifest and every clip in it that exists. Missing or broken files are simply skipped. */
export function preloadNameCalls(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    let manifest: Record<string, Entry> = {};
    try {
      const r = await fetch(DIR + 'manifest.json', { cache: 'no-cache' });
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) manifest = await r.json();
    } catch { /* no manifest: everything falls back to speech */ }
    const jobs: Promise<void>[] = [];
    for (const [rawKey, entry] of Object.entries(manifest ?? {})) {
      if (!entry || typeof entry !== 'object') continue;
      const key = rawKey === STINGER_KEY ? STINGER_KEY : normName(rawKey);
      if (!key) continue;
      jobs.push(Promise.all((entry.files ?? []).map(fetchClip)).then(cs => {
        const ok = cs.filter((c): c is Clip => !!c);
        if (ok.length) clips.set(key, [...(clips.get(key) ?? []), ...ok]);
      }));
      if (key === STINGER_KEY) continue;
      lookup.set(key, key);   // a real entry always beats someone else's alias
      for (const a of entry.aliases ?? []) { const n = normName(String(a)); if (n && !lookup.has(n)) lookup.set(n, key); }
    }
    // aliases were added in manifest order; make sure no alias shadows a later real key
    for (const k of Object.keys(manifest ?? {})) { const n = normName(k); if (n && k !== STINGER_KEY) lookup.set(n, n); }
    await Promise.all(jobs);
  })();
  return loading;
}

/** The clips for a display name: its first word, then the whole name, then each other word, each tried as a
 *  name or an alias. "James Munro" → james, then jamesmunro, then munro. */
export function clipsFor(displayName: string): Clip[] | null {
  const words = displayName.trim().split(/\s+/).map(normName).filter(Boolean);
  const tries = [words[0], words.join(''), ...words.slice(1)].filter(Boolean);
  for (const t of tries) {
    const key = lookup.get(t);
    const cs = key ? clips.get(key) : undefined;
    if (cs?.length) return cs;
  }
  return null;
}

// ---------------------------------------------------------------- playback
let run = 0;                                   // bumped by every summon/stop; a stale sequence stops itself
let playing: AudioBufferSourceNode | null = null;
let wake: (() => void) | null = null;          // resolves whatever the sequence is waiting on, on stop

function decode(c: AudioContext, clip: Clip) {
  // decodeAudioData detaches its input, so hand it a copy and keep the bytes for a later context
  clip.buf ??= c.decodeAudioData(clip.bytes.slice(0)).catch(() => null);
  return clip.buf;
}

function wait(ms: number) {
  return new Promise<void>(res => { const t = setTimeout(() => { wake = null; res(); }, ms); wake = () => { clearTimeout(t); wake = null; res(); }; });
}

/** Play one clip through the master bus; resolves when it ends (or hits the cap). false if it couldn't play. */
async function playClip(clip: Clip, id: number): Promise<boolean> {
  const c = audioCtx(), dest = audioOut(); if (!c || !dest) return false;
  const buf = await decode(c, clip);
  if (!buf || id !== run) return !!buf;
  const start = Math.min(clip.start, Math.max(0, buf.duration - 0.05));
  const len = Math.min(CAP_S, (clip.end ?? buf.duration) - start);
  if (len <= 0.02) return false;
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf;
  const t = c.currentTime, vol = clip.gain;
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + Math.max(0, len - FADE_S));
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  src.connect(g).connect(dest);
  playing = src;
  await new Promise<void>(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; clearTimeout(cap); wake = null; res(); };
    const cap = setTimeout(fin, len * 1000 + 150);   // in case `ended` never comes
    src.onended = fin; wake = () => { try { src.stop(); } catch { /* ignore */ } fin(); };
    src.start(t, start, len);
  });
  if (playing === src) playing = null;
  try { src.disconnect(); g.disconnect(); } catch { /* ignore */ }
  return true;
}

/** Speech, but cancellable by stopSummon(). */
async function sayLine(text: string) {
  await Promise.race([say(text), new Promise<void>(res => { wake = () => { wake = null; stopSpeaking(); res(); }; })]);
  wake = null;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Call these players to the TV: each name's clip in turn (speech for any name without one), then the closing
 *  line. Cuts off a summons still playing. Resolves when it has finished or been stopped. */
export async function summon(names: string[]): Promise<void> {
  stopSummon();
  const id = run;
  const list = names.map(n => n.trim()).filter(Boolean);
  if (!list.length || !soundEnabled()) return;
  await preloadNameCalls();
  for (let i = 0; i < list.length; i++) {
    if (id !== run) return;
    if (i) await wait(GAP_MS);
    if (id !== run) return;
    const cs = clipsFor(list[i]);
    const played = cs ? await playClip(pick(cs), id) : false;
    if (id !== run) return;
    if (!played) await sayLine(list[i] + '.');
  }
  if (id !== run) return;
  await wait(STINGER_GAP_MS);
  if (id !== run) return;
  const sting = clips.get(STINGER_KEY);
  if (!(sting?.length && await playClip(pick(sting), id)) && id === run) await sayLine(STINGER_TEXT);
}

/** Stop a summons at once (the clip, the voice and anything still queued). */
export function stopSummon() {
  run++;
  const w = wake; wake = null;
  if (w) w();
  if (playing) { try { playing.stop(); } catch { /* ignore */ } playing = null; }
  stopSpeaking();
}
