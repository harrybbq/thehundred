// Bakes the curse-pass textures into public/textures/ (no dependencies: fBm value noise + zlib), so the TV never
// runs a noise filter or a blur at runtime. Run: node scripts/bake-curse.mjs   (deterministic: same seeds, same files)
//   curse-char.png   the burnt top-right corner of a cursed card: charred black with ash flecks, a ragged scorch
//                    halo (the board's .bd .curse draws it; CurseFx brands with it). 44:40 like the corner box.
//   curse-ember.png  the same ragged edge as a glowing rim plus a few sparks (screen-blended over the char while it
//                    is fresh, then cools away).
//   curse-smoke.png  a 2×2 atlas of wispy smoke puffs the line sheds as it travels.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/textures/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- PNG (RGBA, straight alpha)
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, px) {               // px(x, y) -> [r, g, b, a] in 0..255
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y), o = y * (w * 4 + 1) + 1 + x * 4;
      const q = v => Math.round(Math.max(0, Math.min(255, v)));
      const A = q(a);
      raw[o] = A ? q(r) : 0; raw[o + 1] = A ? q(g) : 0; raw[o + 2] = A ? q(b) : 0; raw[o + 3] = A;   // zero RGB under alpha 0 (compresses)
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- noise
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
}
const fbm = (x, y, s, oct = 5) => { let v = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= .5; f *= 2.03; } return v / n; };   // 0..1
const clamp = v => Math.max(0, Math.min(1, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- the burnt corner (shared shape for char + ember)
// Same proportions as board.css .bd .curse: box 44k × 40k, char solid to 16k, edge ~20k, scorch to ~34k (k = w/44).
const CW = 352, CH = 320, k = CW / 44;
const edgeAt = (x, y) => {                          // ragged distance from the top-right corner, in k
  const dx = CW - x, dy = y, d = Math.hypot(dx, dy) / k;
  const warp = (fbm(x / 38, y / 38, 7) - .5) * 7 + (fbm(x / 11, y / 11, 9) - .5) * 2.2;   // big bites + fine tatter
  return d + warp;
};
writeFileSync(new URL('curse-char.png', OUT), png(CW, CH, (x, y) => {
  const e = edgeAt(x, y), grain = fbm(x / 5, y / 5, 3);
  if (e < 17) {                                      // charred: near black, mottled, with grey ash flecks
    const ash = sstep(.72, .8, fbm(x / 3.2, y / 3.2, 21)) * .55;
    const l = mix(9, 22, grain) + ash * 70;
    return [l * 1.1, l * .85, l * .7, 255];
  }
  if (e < 20.5) {                                    // the burnt lip: dark rust, crisp
    const t = (e - 17) / 3.5;
    return [mix(26, 70, t) + grain * 14, mix(14, 28, t), mix(8, 10, t), 255];
  }
  // the scorch halo: brown stain fading into the paper, blotchy
  const t = clamp((e - 20.5) / 13), blot = fbm(x / 16, y / 16, 33);
  const a = (1 - sstep(0, 1, t)) * mix(.45, .9, blot) * 235;
  return [mix(92, 120, blot), mix(44, 62, blot), mix(12, 22, blot), a];
}));
writeFileSync(new URL('curse-ember.png', OUT), png(CW, CH, (x, y) => {
  const e = edgeAt(x, y), flick = fbm(x / 9, y / 9, 41);
  const rim = Math.exp(-Math.pow((e - 18.6) / 1.5, 2)) * mix(.55, 1, flick);            // the glowing lip
  // embers left in the char: soft round dots on a jittered 12px grid, thicker near the lip
  const gx = Math.floor(x / 12), gy = Math.floor(y / 12), sx = gx * 12 + 2 + hash(gx, gy, 52) * 8, sy = gy * 12 + 2 + hash(gx, gy, 53) * 8;
  const es = edgeAt(sx, sy), live = es < 17 && es > 5 && hash(gx, gy, 51) > (es > 13 ? .55 : .85);
  const spark = live ? Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / (2 * (1.1 + hash(gx, gy, 54) * 1.2) ** 2)) : 0;
  const a = clamp(Math.max(rim, spark));
  const hot = clamp(rim * 1.2);
  return [255, mix(70, 214, hot), mix(30, 140, hot * hot), a * 255];
}));

// ---------------------------------------------------------------- smoke puffs: 2×2 atlas of 256px wisps
const S = 256;
writeFileSync(new URL('curse-smoke.png', OUT), png(S * 2, S * 2, (x, y) => {
  const cell = (y >= S ? 2 : 0) + (x >= S ? 1 : 0), lx = x % S, ly = y % S;
  const cx = lx - S / 2, cy = ly - S / 2, r = Math.hypot(cx, cy) / (S / 2);
  // curl the lookup a little so the wisps swirl rather than blob
  const ang = Math.atan2(cy, cx) + r * .55 * (cell % 2 ? 1 : -1);
  const ux = Math.cos(ang) * r * 2.2 + cx / 60, uy = Math.sin(ang) * r * 2.2 + cy / 45;
  const n = fbm(ux + cell * 9.1, uy - cell * 4.7, 60 + cell, 6);
  const fall = clamp(1 - Math.pow(r, 1.6));
  const a = sstep(.38, .78, n) * fall * fall;
  return [74, 46, 62, a * 255];
}));
console.log('baked curse-char.png, curse-ember.png, curse-smoke.png');
