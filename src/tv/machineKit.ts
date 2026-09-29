// THE MACHINE KIT (Machine Party round: The Bomb, Penny Drop, Jack-in-the-Box), ported from design/mockups/machine-kit.js.
// Every function returns DATA (numbers and SVG path strings); the look lives in src/styles/machine.css (mk- classes).
//   marquee(text, pitch, opts)  the LED dot-matrix: every lit dot as ONE path, drawn once and slid as a whole strip
//   segments(text, opts)        seven-segment digits: lit and ghost ("8") paths
//   stations(n, area, opts)     one plate per player (3–14): one row up to 9, two rows from 10, polaroids never under 110px

// ------------------------------------------------------------------ 5×7 dot font
const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '##', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};
export const glyph = (ch: string) => G[ch] || G[ch.toUpperCase()] || G['?'];
export const f1 = (v: number) => +v.toFixed(1);
export const rnd = (i: number) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const circle = (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${f1(2 * r)} 0a${r} ${r} 0 1 0 ${f1(-2 * r)} 0`;

export type Marquee = { d: string; r: number; pitch: number; cols: number; textCols: number; rows: number; width: number; textWidth: number; height: number; period: number };
/** The LED marquee. opts.loop lays the text out again after `gap` blank columns until it covers `fill` columns plus a period. */
export function marquee(text: string, pitch = 14, opts: { loop?: boolean; gap?: number; pad?: number; dot?: number; fill?: number } = {}): Marquee {
  const gap = opts.gap ?? 6, pad = opts.pad ?? 1, r = f1(pitch * (opts.dot ?? .36));
  const chars = [...text.toUpperCase()];
  const cols: [number, number][] = [];
  let c = 0;
  const lay = () => { chars.forEach((ch, k) => { const g = glyph(ch); g.forEach((row, y) => [...row].forEach((b, x) => { if (b === '#') cols.push([c + x, y + pad]); })); c += g[0].length + (k < chars.length - 1 ? 1 : 0); }); };
  lay();
  const one = c;
  let period = 0;
  if (opts.loop) { c += gap; period = c * pitch; const need = (opts.fill ?? 0) + c; while (c < need) { lay(); c += gap; } }
  const d = cols.map(([x, y]) => circle(f1((x + .5) * pitch), f1((y + .5) * pitch), r)).join('');
  return { d, r, pitch, cols: c, textCols: one, rows: 7 + pad * 2, width: c * pitch, textWidth: one * pitch, height: (7 + pad * 2) * pitch, period };
}

// ------------------------------------------------------------------ seven-segment
const MASK: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', _: 'd' };
export type Segments = { lit: string; ghost: string; width: number; height: number };
/** Seven-segment digits ('0'-'9', '-', ' ', ':'). opts.h is the digit height in px, opts.slant the italic lean. */
export function segments(text: string, opts: { h?: number; slant?: number } = {}): Segments {
  const H = opts.h ?? 100, W = H * .56, T = H * .13, g = H * .018, sl = opts.slant ?? .1;
  const adv = W + H * .16, colonAdv = H * .28;
  const P = (x: number, y: number) => `${f1(x - (y - H / 2) * sl)} ${f1(y)}`;
  const hseg = (x0: number, x1: number, y: number) => { const h = T / 2; x0 += g; x1 -= g; return `M${P(x0, y)}L${P(x0 + h, y - h)}L${P(x1 - h, y - h)}L${P(x1, y)}L${P(x1 - h, y + h)}L${P(x0 + h, y + h)}Z`; };
  const vseg = (x: number, y0: number, y1: number) => { const h = T / 2; y0 += g; y1 -= g; return `M${P(x, y0)}L${P(x + h, y0 + h)}L${P(x + h, y1 - h)}L${P(x, y1)}L${P(x - h, y1 - h)}L${P(x - h, y0 + h)}Z`; };
  const segPath = (ox: number, s: string) => {
    const l = ox + T / 2, r = ox + W - T / 2, t = T / 2, m = H / 2, b = H - T / 2;
    return ({ a: hseg(l, r, t), b: vseg(r, t, m), c: vseg(r, m, b), d: hseg(l, r, b), e: vseg(l, m, b), f: vseg(l, t, m), g: hseg(l, r, m) } as Record<string, string>)[s];
  };
  const sq = (x: number, y: number, s: number) => `M${P(x - s / 2, y - s / 2)}L${P(x + s / 2, y - s / 2)}L${P(x + s / 2, y + s / 2)}L${P(x - s / 2, y + s / 2)}Z`;
  let x = H * .08, lit = '', ghost = '';
  for (const ch of text) {
    if (ch === ':') { const cx = x + colonAdv / 2 - H * .04, s = T * .95, on = sq(cx, H * .3, s) + sq(cx, H * .7, s); lit += on; ghost += on; x += colonAdv; continue; }
    const m = MASK[ch] ?? '';
    lit += [...m].map(s => segPath(x, s)).join('');
    ghost += [...'abcdefg'].filter(s => !m.includes(s)).map(s => segPath(x, s)).join('');
    x += adv;
  }
  return { lit, ghost, width: f1(x - H * .08 + H * .16), height: H };
}

// ------------------------------------------------------------------ stations
export type Station = { i: number; row: number; cx: number; x: number; y: number; w: number; h: number; photo: number; photoX: number; photoY: number; polH: number; nameY: number; band: number; tilt: number; z: number };
export type Stations = Station[] & { rows: number; size: number; plateW: number; plateH: number; top: number; height: number };
/** One plate per player along the bottom of `area`. Up to 9 in one row, two rows from 10 (the back row gets the odd one). */
export function stations(n: number, area = { x: 80, y: 760, w: 1760, h: 300 }, opts: { stagger?: boolean; maxCell?: number; gapY?: number; band?: number; maxPhoto?: number } = {}): Stations {
  n = Math.max(1, Math.min(14, n | 0));
  const rows = n <= 9 ? 1 : 2, back = Math.ceil(n / rows), front = n - back, per = Math.max(back, front);
  const stagger = rows === 2 && back === front && opts.stagger !== false;
  const cellW = Math.min(opts.maxCell ?? 420, area.w / (per + (stagger ? .5 : 0))), gapY = opts.gapY ?? 14, pad = 12, band = opts.band ?? 66, lip = 26;
  const maxPhoto = opts.maxPhoto ?? (rows === 1 ? 180 : 124);
  const rowH = (area.h - (rows - 1) * gapY) / rows;
  const byW = cellW - 44, byH = rowH - pad - (lip - 8) - band - 6;
  const size = Math.round(Math.max(110, Math.min(maxPhoto, byW, byH)));
  const polH = size - 8 + lip, plateH = pad + polH + band + 6;
  const plateW = Math.round(Math.min(cellW - 8, Math.max(size + 40, 224)));
  const out: Station[] = [];
  const counts = rows === 1 ? [n] : [back, front];
  let i = 0;
  counts.forEach((count, row) => {
    const y = area.y + area.h - (rows - row) * plateH - (rows - 1 - row) * gapY;
    const x0 = area.x + (area.w - count * cellW) / 2 + (stagger ? (row === 0 ? cellW / 4 : -cellW / 4) : 0);
    for (let k = 0; k < count; k++, i++) {
      const cx = x0 + (k + .5) * cellW;
      out.push({ i, row, cx: Math.round(cx), x: Math.round(cx - plateW / 2), y: Math.round(y), w: plateW, h: plateH, photo: size, photoX: Math.round((plateW - size) / 2), photoY: pad, polH, nameY: pad + polH + 2, band, tilt: +((rnd(i + 3) - .5) * 5).toFixed(1), z: row === 0 ? 1 : 2 });
    }
  });
  const top = Math.min(...out.map(s => s.y));
  return Object.assign(out, { rows, size, plateW, plateH, top, height: area.y + area.h - top });
}
