// THE MACHINE KIT (Machine Party round: The Bomb, Penny Drop, Jack-in-the-Box)
// Plain JS, no build step. Load next to support.js:  <script src="./machine-kit.js"></script>
// Every function returns DATA (numbers, arrays, SVG path strings). support.js escapes HTML, so boards
// render with {{ }} holes and <sc-for>. Styling lives in machine-kit.css (classes prefixed mk-).
//
//   MachineKit.marquee(text, pitch = 14, opts)  -> { dots:[{x,y}], d, cols, rows, width, height, period, pitch, r }
//   MachineKit.segments(text, opts)             -> { lit, ghost, width, height, chars:[{ch,x,lit,ghost}] }
//   MachineKit.stations(n, area, opts)          -> [{ i, row, x, y, w, h, photo, cx, tilt, ... }] (+ .rows .size .top)
//   MachineKit.PLAYERS / MachineKit.player(i)   -> demo players (name, photo colours) for mockups
//   MachineKit.rnd(i)                           -> deterministic 0..1
(function () {
  // ------------------------------------------------------------------ 5×7 dot font
  // Each glyph is 7 rows of '#' (lit) / '.' (dark). Width = row length (letters 5, punctuation narrower).
  const G = {
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
    ',': ['..', '..', '..', '..', '##', '.#', '#.'],   // a 2-dot head and a hooked tail, so it never reads as a full stop
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    ':': ['.', '.', '#', '.', '.', '#', '.'],
    ' ': ['...', '...', '...', '...', '...', '...', '...'],
  };
  const glyph = ch => G[ch] || G[String(ch).toUpperCase()] || G['?'];
  const f1 = v => +v.toFixed(1);
  const circle = (x, y, r) => `M${f1(x - r)} ${f1(y)}a${r} ${r} 0 1 0 ${f1(2 * r)} 0a${r} ${r} 0 1 0 ${f1(-2 * r)} 0`;

  /**
   * LED MARQUEE. Lays text out on the dot grid.
   * text   words to show (A–Z 0–9 . , ! ? ' - : and space)
   * pitch  px between dot centres (the unlit tile led-off.png is drawn at background-size: pitch)
   * opts.loop  true: the text twice with opts.gap blank columns, for a seamless scroll by `period` px
   * opts.pad   blank rows above the glyphs (default 1, so the strip sits one dot down in a 9-row screen)
   * Returns dots [{x,y}] (dot centres, px), `d` (every lit dot as ONE path, radius r) and the strip size.
   * Draw the lit strip ONCE (one <svg> with this path); scroll it by translateX in whole-pitch steps.
   */
  function marquee(text, pitch = 14, opts = {}) {
    const gap = opts.gap ?? 6, pad = opts.pad ?? 1, r = f1(pitch * (opts.dot ?? .36));
    const chars = [...String(text).toUpperCase()];
    const cols = []; // column index of each lit dot, row
    let c = 0;
    const lay = () => { chars.forEach((ch, k) => { const g = glyph(ch); g.forEach((row, y) => [...row].forEach((b, x) => { if (b === '#') cols.push([c + x, y + pad]); })); c += g[0].length + (k < chars.length - 1 ? 1 : 0); }); };
    lay();
    const one = c;
    let period = 0;
    // loop: copies separated by `gap` columns until the strip covers opts.fill columns (the screen) plus one period
    if (opts.loop) { c += gap; period = c * pitch; const need = (opts.fill ?? 0) + c; while (c < need) { lay(); c += gap; } }
    const dots = cols.map(([x, y]) => ({ x: f1((x + .5) * pitch), y: f1((y + .5) * pitch) }));
    return {
      dots, r, pitch, cols: c, textCols: one, rows: 7 + pad * 2,
      d: dots.map(p => circle(p.x, p.y, r)).join(''),
      width: c * pitch, textWidth: one * pitch, height: (7 + pad * 2) * pitch, period,
    };
  }

  // ------------------------------------------------------------------ seven-segment
  //    aaa
  //   f   b
  //    ggg
  //   e   c
  //    ddd
  const MASK = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', '_': 'd' };
  const rnd = i => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  // scrambled glyphs: stacked bars and broken frames. None is a digit or a digit's fragment that reads as one
  // (no lone verticals, no L/7/4-like corners), so a scrambled readout never looks like a time or a count.
  const SCRAM = ['adg', 'ad', 'ag', 'dg', 'abfg', 'adef', 'abcd']   // ≡ = ° [ ] and bar pairs.filter(m => !Object.values(MASK).includes(m));

  /**
   * SEVEN-SEGMENT readout.
   * text: digits, '-', ' ', ':' and '?' (a seeded scrambled glyph: 2–4 random segments, never a real digit)
   * opts.h (px, default 100), opts.slant (italic lean, default .1), opts.seed (for '?')
   * Returns { lit, ghost } as ONE path string each (ghost = the faint unlit "8"s and colon dots),
   * width/height for the viewBox, and per-char data if a board wants to flicker one digit.
   */
  function segments(text, opts = {}) {
    const H = opts.h ?? 100, W = H * .56, T = H * .13, g = H * .018, sl = opts.slant ?? .1, seed = opts.seed ?? 1;
    const adv = W + H * .16, colonAdv = H * .28;
    const P = (x, y) => `${f1(x - (y - H / 2) * sl)} ${f1(y)}`;
    const hseg = (x0, x1, y) => { const h = T / 2; x0 += g; x1 -= g; return `M${P(x0, y)}L${P(x0 + h, y - h)}L${P(x1 - h, y - h)}L${P(x1, y)}L${P(x1 - h, y + h)}L${P(x0 + h, y + h)}Z`; };
    const vseg = (x, y0, y1) => { const h = T / 2; y0 += g; y1 -= g; return `M${P(x, y0)}L${P(x + h, y0 + h)}L${P(x + h, y1 - h)}L${P(x, y1)}L${P(x - h, y1 - h)}L${P(x - h, y0 + h)}Z`; };
    const segPath = (ox, s) => {
      const l = ox + T / 2, r = ox + W - T / 2, t = T / 2, m = H / 2, b = H - T / 2;
      return { a: hseg(l, r, t), b: vseg(r, t, m), c: vseg(r, m, b), d: hseg(l, r, b), e: vseg(l, m, b), f: vseg(l, t, m), g: hseg(l, r, m) }[s];
    };
    const sq = (x, y, s) => `M${P(x - s / 2, y - s / 2)}L${P(x + s / 2, y - s / 2)}L${P(x + s / 2, y + s / 2)}L${P(x - s / 2, y + s / 2)}Z`;
    let x = H * .08; const chars = []; let lit = '', ghost = '';
    [...String(text)].forEach((ch, k) => {
      if (ch === ':') {
        const cx = x + colonAdv / 2 - H * .04, s = T * .95, on = sq(cx, H * .3, s) + sq(cx, H * .7, s);
        chars.push({ ch, x: f1(x), lit: on, ghost: on }); lit += on; ghost += on; x += colonAdv; return;
      }
      let m = MASK[ch];
      if (ch === '?') m = SCRAM[Math.floor(rnd(seed * 31 + k * 7) * SCRAM.length)];   // a glitch shape, never a digit
      if (m == null) m = '';
      const all = 'abcdefg'.split('').map(s => segPath(x, s));
      const on = [...m].map(s => segPath(x, s)).join('');
      const off = 'abcdefg'.split('').filter(s => !m.includes(s)).map(s => segPath(x, s)).join('');
      chars.push({ ch, x: f1(x), lit: on, ghost: all.join('') });
      lit += on; ghost += off; x += adv;
    });
    return { lit, ghost, chars, width: f1(x - H * .08 + H * .16), height: H };
  }

  // ------------------------------------------------------------------ stations
  /**
   * STATIONS: one plate per player along the front edge. n = 3..14.
   * area = { x, y, w, h }: the band the stations may use (they sit on its BOTTOM edge).
   * Up to 9 in one row (polaroids 150px+ in a 1760px+ area); from 10, two rows (the back row gets the odd one) with no overlap; equal rows
   * are staggered by half a cell (opts.stagger=false to stop it). opts.maxCell caps the spacing (default 420).
   * Polaroid width (`photo`) is never under 110px, names get a 34px+ band on the plate.
   * Each item: i, row (0 = back), x, y (plate top-left), w, h (plate), photo (polaroid outer width),
   *   photoX/photoY (polaroid top-left, relative to the plate), cx (centre x), tilt (deg), name (px size).
   * The array also carries .rows, .size (photo), .plateW, .plateH and .top (the highest plate's y).
   */
  function stations(n, area = { x: 80, y: 760, w: 1760, h: 300 }, opts = {}) {
    n = Math.max(1, Math.min(14, n | 0));
    const rows = n <= 9 ? 1 : 2, back = Math.ceil(n / rows), front = n - back, per = Math.max(back, front);
    const stagger = rows === 2 && back === front && opts.stagger !== false;
    const cellW = Math.min(opts.maxCell ?? 420, area.w / (per + (stagger ? .5 : 0))), gapY = opts.gapY ?? 14, pad = 12, band = opts.band ?? 66, lip = 26;
    // sized to the rows, not to the area: one row gets big polaroids, two rows compact ones; area.h is only a ceiling
    const maxPhoto = opts.maxPhoto ?? (rows === 1 ? 180 : 124);
    const rowH = (area.h - (rows - 1) * gapY) / rows;
    // polaroid: 8px border, square photo (size - 16), a `lip` bottom border -> height size - 8 + lip
    const byW = cellW - 44, byH = rowH - pad - (lip - 8) - band - 6;
    const size = Math.round(Math.max(110, Math.min(maxPhoto, byW, byH)));
    const polH = size - 8 + lip, plateH = pad + polH + band + 6;
    const plateW = Math.round(Math.min(cellW - 8, Math.max(size + 40, 224)));
    const out = [];
    const rowsCounts = rows === 1 ? [n] : [back, front];
    let i = 0;
    rowsCounts.forEach((count, row) => {
      const y = area.y + area.h - (rows - row) * plateH - (rows - 1 - row) * gapY;
      const rowW = count * cellW, x0 = area.x + (area.w - rowW) / 2 + (stagger ? (row === 0 ? cellW / 4 : -cellW / 4) : 0);
      for (let k = 0; k < count; k++, i++) {
        const cx = x0 + (k + .5) * cellW;
        out.push({
          i, row, cx: Math.round(cx), x: Math.round(cx - plateW / 2), y: Math.round(y), w: plateW, h: plateH,
          photo: size, photoX: Math.round((plateW - size) / 2), photoY: pad,
          polH, nameY: pad + polH + 2, band,
          tilt: +((rnd(i + 3) - .5) * 5).toFixed(1),
          z: row === 0 ? 1 : 2,
        });
      }
    });
    out.rows = rows; out.size = size; out.plateW = plateW; out.plateH = plateH; out.top = Math.min(...out.map(s => s.y));
    out.height = area.y + area.h - out.top;          // how much of the area the stations actually use
    return out;
  }

  // ------------------------------------------------------------------ demo players (mockups only)
  const PLAYERS = [
    ['SAM', '#5d6e6a', '#b98a66', '#2a1a12'], ['TOM', '#4d3a4a', '#6b4a36', '#171210'], ['JOSH', '#6a5a36', '#e2c29e', '#3a2616'],
    ['PRIYA', '#3a4a3a', '#a57452', '#0d0a08'], ['MEG', '#5a3432', '#f0cfb0', '#b58a3a'], ['DAN', '#3c4458', '#d3aa88', '#1b1410'],
    ['AISHA', '#2f5a5e', '#7a5038', '#120c0a'], ['LEO', '#5a4a3a', '#e6c4a2', '#6a3a1a'], ['KAT', '#4a3450', '#d8b090', '#2a1a3a'],
    ['OMAR', '#3a4e44', '#8a6044', '#0e0b09'], ['BEX', '#5e3a2a', '#f2d4b8', '#c2371f'], ['FINN', '#394a56', '#e8c8aa', '#c89a4a'],
    ['ROSIE', '#5a4436', '#c99a78', '#3a1e12'], ['JONNO', '#44403a', '#b88460', '#1a1410'],
  ].map(([name, bg, skin, hair], i) => ({ i, name, bg, skin, hair }));
  // a stand-in selfie (viewBox 0 0 100 100): <rect fill=bg/> <path d=FACE.body/> <path d=FACE.head fill=skin/> <path d=FACE.hair fill=hair/>
  const FACE = {
    body: 'M4 100C8 78 26 70 50 70C74 70 92 78 96 100Z',
    collar: 'M40 70L50 84L60 70Z',
    head: 'M50 20C63 20 71 30 71 45C71 60 62 70 50 70C38 70 29 60 29 45C29 30 37 20 50 20Z',
    hair: 'M28 44C26 26 38 16 52 16C66 16 75 26 72 44C69 34 62 29 52 29C42 29 33 34 28 44Z',
    eyes: 'M40 45h6v3h-6zM54 45h6v3h-6z',
  };
  const player = i => PLAYERS[i % PLAYERS.length];

  window.MachineKit = { marquee, segments, stations, PLAYERS, player, FACE, rnd, glyph, GLYPHS: G };
})();
