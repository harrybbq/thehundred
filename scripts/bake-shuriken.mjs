// Bakes the Shuriken scene's haze (smoke hanging in the moonlight beam) into public/textures/haze.png: a tileable
// fractal value noise, white with the noise in the alpha. Baked once so the TV never runs feTurbulence per frame.
// Run: node scripts/bake-shuriken.mjs   (deterministic: same seed, same file)
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 512, H = 256;
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

let seed = 1717;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
// a tileable value-noise octave: a (cw × ch) lattice, smoothstep-interpolated, wrapping at the tile edge
function octave(cw, ch) {
  const g = Array.from({ length: cw * ch }, rnd), at = (x, y) => g[((y % ch) + ch) % ch * cw + ((x % cw) + cw) % cw];
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / W * cw, fy = y / H * ch, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = s(fx - x0), ty = s(fy - y0);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}
const oct = [[4, 2, .5], [8, 4, .25], [16, 8, .14], [32, 16, .07], [64, 32, .04]].map(([cw, ch, w]) => [octave(cw, ch), w]);
const raw = Buffer.alloc((W * 2 + 1) * H);                 // grey + alpha
for (let y = 0; y < H; y++) {
  raw[y * (W * 2 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    let v = 0; for (const [f, w] of oct) v += f(x, y) * w;
    v = Math.max(0, Math.min(1, (v / 1 - .32) / .5));      // lift the wisps, let the gaps go clear
    const o = y * (W * 2 + 1) + 1 + x * 2;
    raw[o] = 255; raw[o + 1] = Math.round(Math.pow(v, 1.6) * 255);
  }
}
function save(name, w, h, data) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 4;
  const out = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(data, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(new URL('../public/textures/' + name, import.meta.url), out);
  console.log(`${name} ${w}×${h}  ${(out.length / 1024).toFixed(1)} KB`);
}
save('haze.png', W, H, raw);

// stamp-ink.png: a mask for a rubber stamp. Opaque, with the paper showing through where the ink missed: a mottled
// coverage (fine noise thresholded) plus a few dry streaks. Used as a CSS mask-image (static, never animated).
{
  const S = 256, fine = [[16, 16, .5], [32, 32, .3], [64, 64, .2]].map(([cw, ch, w]) => [octave(cw, ch), w]);
  const d = Buffer.alloc((S * 2 + 1) * S), streaks = Array.from({ length: 7 }, () => ({ y: rnd() * S, h: 1 + rnd() * 2.5, x0: rnd() * S, len: 30 + rnd() * 90 }));
  for (let y = 0; y < S; y++) {
    d[y * (S * 2 + 1)] = 0;
    for (let x = 0; x < S; x++) {
      let v = 0; for (const [f, w] of fine) v += f(x * W / S, y * H / S) * w;
      let a = v > .36 ? 1 : v > .3 ? (v - .3) / .06 : 0;                   // mottled: most of it inked, holes where it's thin
      for (const s of streaks) if (Math.abs(y - s.y) < s.h && ((x - s.x0 + S) % S) < s.len) a *= .15;
      const o = y * (S * 2 + 1) + 1 + x * 2; d[o] = 255; d[o + 1] = Math.round(Math.min(1, a * 1.05) * 255);
    }
  }
  save('stamp-ink.png', S, S, d);
}
