// Bakes the mini-game textures into public/textures/ as small PNGs (no dependencies: a tiny
// rasteriser + zlib). Baked once so the TV never runs an SVG noise filter per frame.
// Run: node scripts/bake-textures.mjs   (deterministic: same seeds, same files)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/textures/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- PNG
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(img, gray = false) {
  const { w, h, d } = img, ch = gray ? 2 : 4;              // gray: luminance + alpha
  const raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * ch + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = y * (w * ch + 1) + 1 + x * ch, a = d[i + 3];
      const un = v => Math.round(Math.max(0, Math.min(255, a > 0 ? v / a * 255 : 0)));   // un-premultiply
      if (gray) { raw[o] = un(d[i]); raw[o + 1] = Math.round(a); }
      else { raw[o] = un(d[i]); raw[o + 1] = un(d[i + 1]); raw[o + 2] = un(d[i + 2]); raw[o + 3] = Math.round(a); }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = gray ? 4 : 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- tiny rasteriser (premultiplied, 0..255)
const image = (w, h) => ({ w, h, d: new Float32Array(w * h * 4) });
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function put(img, x, y, [r, g, b], a, wrap = true) {
  if (wrap) { x = ((x % img.w) + img.w) % img.w; y = ((y % img.h) + img.h) % img.h; }
  else if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  if (a <= 0) return;
  const i = (y * img.w + x) * 4, k = 1 - a;
  img.d[i] = r * a + img.d[i] * k; img.d[i + 1] = g * a + img.d[i + 1] * k; img.d[i + 2] = b * a + img.d[i + 2] * k;
  img.d[i + 3] = 255 * a + img.d[i + 3] * k;
}
const fill = (img, c, a = 1) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) put(img, x, y, c, a); };
/** An anti-aliased thick segment (wraps around the tile edges). */
function seg(img, x0, y0, x1, y1, width, c, a, wrap = true) {
  const r = width / 2 + 1, minX = Math.floor(Math.min(x0, x1) - r), maxX = Math.ceil(Math.max(x0, x1) + r);
  const minY = Math.floor(Math.min(y0, y1) - r), maxY = Math.ceil(Math.max(y0, y1) + r);
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const t = Math.max(0, Math.min(1, ((x + .5 - x0) * dx + (y + .5 - y0) * dy) / L2));
    const px = x0 + t * dx - x - .5, py = y0 + t * dy - y - .5, dist = Math.sqrt(px * px + py * py);
    const cov = Math.max(0, Math.min(1, width / 2 + .5 - dist));
    if (cov > 0) put(img, x, y, c, a * cov, wrap);
  }
}
/** A polyline through points, as segments. */
const poly = (img, pts, width, c, a, wrap = true) => { for (let i = 1; i < pts.length; i++) seg(img, ...pts[i - 1], ...pts[i], width, c, a, wrap); };
function blob(img, cx, cy, rx, ry, c, a, wrap = true) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const q = Math.hypot((x + .5 - cx) / rx, (y + .5 - cy) / ry);
    const cov = Math.max(0, Math.min(1, (1 - q) * Math.min(rx, ry) + .5));
    if (cov > 0) put(img, x, y, c, a * cov, wrap);
  }
}
// seeded randomness + tileable value noise
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function noise2(w, h, cell, s) {
  seed = s; const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), g = Array.from({ length: gw * gh }, rnd);
  const at = (i, j) => g[((j % gh + gh) % gh) * gw + ((i % gw + gw) % gw)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), u = sm(fx - i), v = sm(fy - j);
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v; };
}
const save = (name, img, gray) => { const b = png(img, gray); writeFileSync(new URL(name, OUT), b); console.log(`${name.padEnd(16)} ${img.w}×${img.h}  ${(b.length / 1024).toFixed(1)} KB`); return b.length; };

// ---------------------------------------------------------------- grain: light specks, used with `screen`, so it shows in the shadows only
{
  const img = image(256, 256); seed = 11;
  for (let n = 0; n < 5200; n++) { const x = Math.floor(rnd() * 256), y = Math.floor(rnd() * 256); put(img, x, y, [255, 255, 255], .25 + rnd() * .55); }
  for (let n = 0; n < 700; n++) blob(img, rnd() * 256, rnd() * 256, .9, .9, [255, 255, 255], .35 + rnd() * .4);
  save('grain.png', img, true);
}

// ---------------------------------------------------------------- wood: dark grain streaks for planks and the hull (used with `multiply`)
{
  const W = 512, H = 96, img = image(W, H), n1 = noise2(W, H, 64, 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const band = Math.sin((y + n1(x, y) * 26) * .55) * .5 + .5;              // long wavy fibres
    put(img, x, y, [40, 22, 10], .18 * band * band);
  }
  seed = 5;
  for (let i = 0; i < 70; i++) {                                              // darker fibres
    const y = rnd() * H, x = rnd() * W, len = 60 + rnd() * 220, pts = [];
    for (let k = 0; k <= 8; k++) pts.push([x + len * k / 8, y + Math.sin(k * .9 + i) * 1.4]);
    poly(img, pts, .8 + rnd() * 1.2, [26, 13, 5], .22 + rnd() * .25);
  }
  for (let i = 0; i < 6; i++) {                                               // knots with rings
    const cx = rnd() * W, cy = rnd() * H;
    for (let r = 2; r < 9; r += 2.2) { const pts = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; pts.push([cx + Math.cos(a) * r * 2.4, cy + Math.sin(a) * r]); } poly(img, pts, 1, [26, 13, 5], .3); }
    blob(img, cx, cy, 3, 1.6, [20, 10, 4], .6);
  }
  save('wood.png', img);
}

// ---------------------------------------------------------------- brick: a wet wall with each brick different, grime and mortar (tiles 512×256)
{
  const W = 512, H = 256, img = image(W, H), blot = noise2(W, H, 48, 9), fine = noise2(W, H, 6, 13);
  fill(img, hex('#0b0706'));
  seed = 21;
  const BW = 128, BH = 32;
  for (let row = 0; row < H / BH; row++) for (let col = -1; col < W / BW + 1; col++) {
    const x0 = col * BW + (row % 2 ? 64 : 0) + 3, y0 = row * BH + 3, bw = BW - 6, bh = BH - 6;
    const base = hex(['#3a2119', '#331c16', '#3f251b', '#2e1914', '#44281d', '#361f17'][Math.floor(rnd() * 6)]);
    const tint = .82 + rnd() * .3;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
      const e = Math.min(x - x0, x0 + bw - 1 - x, y - y0, y0 + bh - 1 - y);
      const k = tint * (.86 + fine(x, y) * .28) * (e < 1 ? .8 : 1) * (y - y0 < 2 ? 1.25 : 1) * (y0 + bh - y < 3 ? .7 : 1);
      put(img, x, y, base.map(v => v * k), 1);
    }
    if (rnd() < .25) { const cx = x0 + rnd() * bw, cy = y0 + rnd() * bh; blob(img, cx, cy, 4 + rnd() * 8, 2 + rnd() * 3, [12, 7, 5], .55); }   // chips
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const b = blot(x, y); put(img, x, y, [4, 2, 2], Math.max(0, b - .45) * 1.1); }   // damp blotches
  for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H, len = 40 + rnd() * 160; seg(img, x, y, x, y + len, 3 + rnd() * 6, [3, 2, 2], .22 + rnd() * .2); }   // grime runs
  save('brick.png', img);
}

// ---------------------------------------------------------------- rain: one angle for every streak, tiles vertically (512×512)
{
  const W = 512, H = 512, img = image(W, H), lean = .2;
  seed = 31;
  for (let i = 0; i < 150; i++) {
    const x = rnd() * W, y = rnd() * H, len = 18 + rnd() * 46, a = .18 + rnd() * .4;
    seg(img, x, y, x - len * lean, y + len, rnd() < .15 ? 2.2 : 1.3, [220, 234, 240], a);
  }
  save('rain.png', img, true);
}

// ---------------------------------------------------------------- sea: hand-drawn wave lines in three depths, foam cut-outs on the near crests
function sea(name, W, H, rows, amp, period, lw, a, foam) {
  const img = image(W, H);
  seed = 40 + W + H;
  for (let r = 0; r < rows; r++) {
    const y0 = (r + .5) * H / rows, ph = rnd() * Math.PI * 2, pts = [];
    for (let x = 0; x <= W; x += 4) pts.push([x, y0 + Math.sin(x / period * Math.PI * 2 + ph) * amp + Math.sin(x / (period * .37) + ph) * amp * .25]);
    // broken strokes, like ink: dashes of different lengths
    let i = 0;
    while (i < pts.length - 1) { const run = 4 + Math.floor(rnd() * 14), gap = 1 + Math.floor(rnd() * 5); poly(img, pts.slice(i, Math.min(pts.length, i + run + 1)), lw * (.7 + rnd() * .6), [214, 244, 238], a * (.6 + rnd() * .4)); i += run + gap; }
    if (foam) for (let k = 0; k < 4; k++) {                                 // flat foam on a crest
      const cx = rnd() * W, cy = y0 - amp * .8;
      blob(img, cx, cy, 14 + rnd() * 18, 4 + rnd() * 3, [226, 248, 244], .85);
      blob(img, cx + 16, cy + 3, 8 + rnd() * 8, 3, [226, 248, 244], .75);
      blob(img, cx - 20, cy + 2, 6, 2.4, [226, 248, 244], .7);
    }
  }
  return save(name, img, true);
}
sea('sea-far.png', 1024, 96, 6, 2, 96, 1.4, .34, false);
sea('sea-mid.png', 1024, 160, 5, 5, 192, 2.4, .42, false);
sea('sea-near.png', 1024, 240, 4, 9, 320, 3.6, .5, true);

// ---------------------------------------------------------------- brick-bw: the same wall drained to grey (Dodge's hit freeze cross-fades to it by opacity)
// Same seeds and layout as brick.png; every colour goes through `grey` (luminance, lifted and stretched so the freeze reads two-tone).
{
  const grey = ([r, g, b]) => { const l = (.3 * r + .59 * g + .11 * b); const v = Math.max(0, Math.min(255, (l - 8) * 2.3)); return [v, v, v * 1.02]; };
  const W = 512, H = 256, img = image(W, H), blot = noise2(W, H, 48, 9), fine = noise2(W, H, 6, 13);
  fill(img, grey(hex('#0b0706')));
  seed = 21;
  const BW = 128, BH = 32;
  for (let row = 0; row < H / BH; row++) for (let col = -1; col < W / BW + 1; col++) {
    const x0 = col * BW + (row % 2 ? 64 : 0) + 3, y0 = row * BH + 3, bw = BW - 6, bh = BH - 6;
    const base = grey(hex(['#3a2119', '#331c16', '#3f251b', '#2e1914', '#44281d', '#361f17'][Math.floor(rnd() * 6)]));
    const tint = .82 + rnd() * .3;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
      const e = Math.min(x - x0, x0 + bw - 1 - x, y - y0, y0 + bh - 1 - y);
      const k = tint * (.86 + fine(x, y) * .28) * (e < 1 ? .8 : 1) * (y - y0 < 2 ? 1.25 : 1) * (y0 + bh - y < 3 ? .7 : 1);
      put(img, x, y, base.map(v => Math.min(255, v * k)), 1);
    }
    if (rnd() < .25) { const cx = x0 + rnd() * bw, cy = y0 + rnd() * bh; blob(img, cx, cy, 4 + rnd() * 8, 2 + rnd() * 3, [6, 6, 6], .6); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const b = blot(x, y); put(img, x, y, [2, 2, 2], Math.max(0, b - .45) * 1.1); }
  for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H, len = 40 + rnd() * 160; seg(img, x, y, x, y + len, 3 + rnd() * 6, [2, 2, 2], .22 + rnd() * .2); }
  save('brick-bw.png', img);
}

// ---------------------------------------------------------------- wood-plank / wood-hull: the same grain as wood.png, PRE-TINTED
// (the colour already multiplied in), so Walk the Plank draws wood with normal blending: no mix-blend-mode on the TV.
function woodTinted(name, base) {
  const W = 512, H = 96, img = image(W, H), n1 = noise2(W, H, 64, 3), c = hex(base);
  fill(img, c);
  const mul = k => c.map(v => v * k);                                         // a dark fibre = the base colour multiplied down
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const band = Math.sin((y + n1(x, y) * 26) * .55) * .5 + .5;
    put(img, x, y, mul(.55), .3 * band * band);
  }
  seed = 5;
  for (let i = 0; i < 70; i++) {
    const y = rnd() * H, x = rnd() * W, len = 60 + rnd() * 220, pts = [];
    for (let k = 0; k <= 8; k++) pts.push([x + len * k / 8, y + Math.sin(k * .9 + i) * 1.4]);
    poly(img, pts, .8 + rnd() * 1.2, mul(.4), .3 + rnd() * .3);
  }
  for (let i = 0; i < 6; i++) {
    const cx = rnd() * W, cy = rnd() * H;
    for (let r = 2; r < 9; r += 2.2) { const pts = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; pts.push([cx + Math.cos(a) * r * 2.4, cy + Math.sin(a) * r]); } poly(img, pts, 1, mul(.4), .4); }
    blob(img, cx, cy, 3, 1.6, mul(.3), .7);
  }
  save(name, img);
}
woodTinted('wood-plank.png', '#a0703f');
woodTinted('wood-hull.png', '#2a1c12');
