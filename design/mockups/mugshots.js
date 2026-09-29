// MUGSHOTS for the printable role cards. One SVG per role, viewBox 0 0 450 550, booking-photo style:
// front view, head and shoulders, height chart behind, placard at the chest.
// PRINT RULES: pure line art in one ink; tone is hatching / dots, never big solid black; one spot colour per
// role (its ROLES colour) laid on as a light tint, so the art survives a black-and-white home printer.
// Scrooge alone gets the game's purple hat with the pink band plus his gold coin (the user asked for that look).
// Layers per character: back (behind the body) · body (clothes) · head · [placard] · front (hands, props).
(function () {
  const INK = '#1a1714';
  const COL = {
    intruder: '#c2371f', betrayer: '#b8560f', forger: '#5c2a54', medic: '#3f7a14', detective: '#2a4d69',
    lovebird: '#9e2f42', cursed: '#1b1712', skank: '#4f6b1f', davyjones: '#1f5f7a', scrooge: '#8a6a00',
    jester: '#6b2f8f', assassin: '#4a4a52', angel: '#c9a227', drinker: '#1d5a5c',
  };
  const LABEL = {
    intruder: 'INTRUDER', betrayer: 'BETRAYER', forger: 'FORGER', medic: 'MEDIC', detective: 'DETECTIVE',
    lovebird: 'LOVEBIRD', cursed: 'CURSED', skank: 'SKANK', davyjones: 'DAVY JONES', scrooge: 'SCROOGE',
    jester: 'JESTER', assassin: 'ASSASSIN', angel: 'ANGEL', drinker: 'DRINKER',
  };
  const ORDER = Object.keys(LABEL);

  // stroke presets
  const O = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const O4 = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const O3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const O2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const L = (d, o = O4) => `<path d="${d}" fill="none" ${o}/>`;          // a line
  const F = (d, fill = '#fff', o = O) => `<path d="${d}" fill="${fill}" ${o}/>`;   // a filled, outlined shape
  const T = (d, c, op = .42) => `<path d="${d}" fill="${c}" fill-opacity="${op}"/>`; // a spot-colour tint, no line
  const C = (cx, cy, r, fill = '#fff', o = O4) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${o}/>`;
  const dot = (cx, cy, r = 4) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/>`;
  const f1 = n => Math.round(n * 10) / 10;

  // shared tone patterns (ids prefixed by role so several mugshots can share a page)
  const defs = p => `<defs>
    <pattern id="${p}h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="${INK}" stroke-width="2"/></pattern>
    <pattern id="${p}l" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="${INK}" stroke-width="1.3"/></pattern>
    <pattern id="${p}x" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><path d="M0 0V6M0 0H6" stroke="${INK}" stroke-width="1.7"/></pattern>
    <pattern id="${p}d" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="4" cy="4" r="1.5" fill="${INK}"/></pattern>
    <pattern id="${p}s" width="18" height="14" patternUnits="userSpaceOnUse"><path d="M0 14Q9 2 18 14M-9 7Q0-5 9 7M9 7Q18-5 27 7" fill="none" stroke="${INK}" stroke-width="1.6"/></pattern>
  </defs>`;

  // the height chart: light grey rules (cheap on toner), numbers down both edges
  const wall = () => {
    let s = '<rect width="450" height="550" fill="#fff"/>';
    for (let y = 30; y <= 400; y += 15) {
      const major = (y - 30) % 60 === 0;
      s += `<line x1="0" y1="${y}" x2="450" y2="${y}" stroke="${INK}" stroke-opacity="${major ? .55 : .22}" stroke-width="${major ? 2.4 : 1.2}"/>`;
    }
    const marks = ['7\'', '6\'6"', '6\'', '5\'6"', '5\'', '4\'6"', '4\''];
    marks.forEach((m, i) => {
      const y = 30 + i * 60 - 5;
      s += `<text x="8" y="${y}" font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="900" font-size="22" fill="${INK}" fill-opacity=".7">${m}</text>`;
      s += `<text x="442" y="${y}" text-anchor="end" font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="900" font-size="22" fill="${INK}" fill-opacity=".7">${m}</text>`;
    });
    return s;
  };

  // the booking placard, hung from the neck on a string
  const placard = (key, n) => {
    const lab = LABEL[key];
    const fs = lab.length > 8 ? 44 : 50;
    return `<path d="M128 414 L196 356 M322 414 L254 356" fill="none" stroke="${INK}" stroke-width="2.5"/>
    <rect x="98" y="408" width="254" height="124" rx="4" fill="#fff" ${O}/>
    <rect x="106" y="416" width="238" height="108" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <text x="225" y="441" text-anchor="middle" font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="900" font-size="23" letter-spacing="4" fill="${INK}">THE HUNDRED</text>
    <line x1="116" y1="449" x2="334" y2="449" stroke="${INK}" stroke-width="2"/>
    <text x="225" y="${fs > 46 ? 492 : 489}" text-anchor="middle" font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="900" font-size="${fs}" letter-spacing="2" fill="${INK}">${lab}</text>
    <text x="225" y="517" text-anchor="middle" font-family="'Courier Prime','Courier New',monospace" font-weight="700" font-size="16" letter-spacing="1" fill="${INK}">10.10 · No. 100-100</text>`;
  };

  // shoulders every character shares (clothes are drawn over/inside it)
  const SH = 'M16 552 L24 470 C34 404 112 370 225 368 C338 370 416 404 426 470 L434 552 Z';
  const BIRD = 'M140 250 C124 168 168 112 225 112 C282 112 326 168 310 250 C306 282 300 304 312 332 C344 380 404 430 418 552 L32 552 C46 430 106 380 138 332 C150 304 144 282 140 250 Z';
  const SNAKE = 'M150 168 C156 132 190 116 225 116 C260 116 294 132 300 168 C320 188 328 214 318 238 C306 268 270 284 225 288 C180 284 144 268 132 238 C122 214 130 188 150 168 Z';
  // one feather of a wing: a long leaf shape from its root, pointing along angle a (degrees)
  const feather = (x, y, a, len, w, bend = 0) => {
    const d = `M0 ${-w} C${len * .35} ${-w * 1.5} ${len * .8} ${-w * 1.1} ${len} 0 C${len * .8} ${w * 1.1} ${len * .35} ${w * 1.5} 0 ${w} Z`;
    const shaft = `M0 0 L${len * .85} 0`;
    if (!bend) return `<g transform="translate(${x} ${y}) rotate(${a})"><path d="${d}" fill="#fff" ${O3}/><path d="${shaft}" fill="none" ${O2}/></g>`;
    const h = len * .55, d1 = `M0 ${-w} C${h * .5} ${-w * 1.4} ${h} ${-w * 1.2} ${h} ${-w * 1.1} L${h} ${w * 1.1} C${h} ${w * 1.2} ${h * .5} ${w * 1.4} 0 ${w} Z`;
    const t = len - h, d2 = `M0 ${-w * 1.1} C${t * .6} ${-w * 1.2} ${t * .9} ${-w * .6} ${t} 0 C${t * .9} ${w * .6} ${t * .6} ${w * 1.2} 0 ${w * 1.1} Z`;
    return `<g transform="translate(${x} ${y}) rotate(${a})"><path d="${d1}" fill="#fff" ${O3}/><path d="M0 0 L${h} 0" ${O2}/><g transform="translate(${h} 0) rotate(${bend})"><path d="${d2}" fill="#fff" ${O3}/><path d="M0 0 L${t * .85} 0" ${O2}/></g></g>`;
  };
  // a cartoon wing: smooth top edge from the root to the tip, scalloped feather edge back to the root
  const wing = (root, ctl, tip, pts, c, kink) => {
    const all = [tip, ...pts, root];
    const cx = all.reduce((a, q) => a + q[0], 0) / all.length, cy = all.reduce((a, q) => a + q[1], 0) / all.length;
    let d = `M${root[0]} ${root[1]} C${ctl[0][0]} ${ctl[0][1]} ${ctl[1][0]} ${ctl[1][1]} ${tip[0]} ${tip[1]}`;
    let inner = '';
    for (let i = 0; i < all.length - 1; i++) {
      const [x1, y1] = all[i], [x2, y2] = all[i + 1], mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      let nx = y2 - y1, ny = -(x2 - x1); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
      d += ` Q${f1(mx + nx * 16)} ${f1(my + ny * 16)} ${x2} ${y2}`;
      if (i < all.length - 2) { const ix = x2 + (cx - x2) * .45, iy = y2 + (cy - y2) * .45; inner += `M${x2} ${y2} Q${f1((x2 + ix) / 2 + nx * 6)} ${f1((y2 + iy) / 2 + ny * 6)} ${f1(ix)} ${f1(iy)} `; }
    }
    return `<path d="${d} Z" fill="#fff" ${O4}/><path d="${d} Z" fill="${c}" fill-opacity=".22"/><path d="${inner}" fill="none" ${O2}/>${kink ? L(`M${kink[0] - 10} ${kink[1] + 14} L${kink[0]} ${kink[1]} L${kink[0] + 12} ${kink[1] + 12}`, O3) : ''}`;
  };
  const neck = (w = 30, top = 280, bot = 380) => F(`M${225 - w} ${top} L${225 - w - 2} ${bot} L${225 + w + 2} ${bot} L${225 + w} ${top} Z`, '#fff', O4);

  // a tapering tentacle along a cubic bezier (for Davy Jones's beard)
  const tentacle = (p, w0, c, u) => {
    const pt = t => { const m = 1 - t; return [0, 1].map(k => m * m * m * p[0][k] + 3 * m * m * t * p[1][k] + 3 * m * t * t * p[2][k] + t * t * t * p[3][k]); };
    const dv = t => { const m = 1 - t; return [0, 1].map(k => 3 * m * m * (p[1][k] - p[0][k]) + 6 * m * t * (p[2][k] - p[1][k]) + 3 * t * t * (p[3][k] - p[2][k])); };
    const A = [], B = [], S = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, [x, y] = pt(t), [dx, dy] = dv(t), l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = w0 * (1 - t) + 1.2 * t;
      A.push([x + nx * w, y + ny * w]); B.push([x - nx * w, y - ny * w]);
      if (i % 4 === 2 && i < 26) S.push(`<circle cx="${f1(x - nx * w * .45)}" cy="${f1(y - ny * w * .45)}" r="${f1(Math.max(1.6, w * .32))}" fill="#fff" ${O2}/>`);
    }
    const d = 'M' + A.map(q => q.map(f1).join(' ')).join(' L') + ' L' + B.reverse().map(q => q.map(f1).join(' ')).join(' L') + ' Z';
    return `<path d="${d}" fill="#fff" ${O4}/><path d="${d}" fill="${c}" fill-opacity=".45"/><path d="${d}" fill="${u('d')}" fill-opacity=".6"/>${S.join('')}`;
  };
  const star = (cx, cy, r1, r2, n = 5, rot = -90) => 'M' + Array.from({ length: n * 2 }, (_, i) => { const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? r2 : r1; return f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r); }).join(' L') + ' Z';
  const heart = (cx, cy, s) => `M${cx} ${f1(cy - 4 * s)} C${cx} ${f1(cy - 14 * s)} ${f1(cx - 18 * s)} ${f1(cy - 16 * s)} ${f1(cx - 19 * s)} ${f1(cy - 3 * s)} C${f1(cx - 20 * s)} ${f1(cy + 8 * s)} ${f1(cx - 8 * s)} ${f1(cy + 16 * s)} ${cx} ${f1(cy + 24 * s)} C${f1(cx + 8 * s)} ${f1(cy + 16 * s)} ${f1(cx + 20 * s)} ${f1(cy + 8 * s)} ${f1(cx + 19 * s)} ${f1(cy - 3 * s)} C${f1(cx + 18 * s)} ${f1(cy - 16 * s)} ${cx} ${f1(cy - 14 * s)} ${cx} ${f1(cy - 4 * s)} Z`;
  const barnacle = (x, y, r) => `<path d="M${x - r} ${y + r * .5} L${x - r * .45} ${y - r * .7} L${x + r * .45} ${y - r * .7} L${x + r} ${y + r * .5} Z" fill="#fff" ${O2}/><ellipse cx="${x}" cy="${y - r * .7}" rx="${r * .45}" ry="${r * .2}" fill="${INK}"/>`;

  // ------------------------------------------------------------------ the characters
  const DRAW = {
    intruder: ({ c, u, id }) => ({
      body: `<clipPath id="${id('jc')}"><path d="${SH}"/></clipPath>${F(SH)}
        <g clip-path="url(#${id('jc')})">${[380, 424, 468, 512].map(y => `<rect x="0" y="${y}" width="450" height="22" fill="${u('x')}"/>`).join('')}</g>${L(SH, O)}
        ${F('M176 372 C190 396 260 396 274 372 L268 360 C252 378 198 378 182 360 Z', '#fff', O4)}`,
      head: `<!-- the knife, tucked behind the ear: only the blade shows -->
        ${F('M300 196 L356 104 C352 140 336 178 316 204 Z', '#fff', O4)}${L('M312 186 L346 128', O2)}
        ${L('M292 190 L324 208', `stroke="${INK}" stroke-width="9" stroke-linecap="round"`)}
        <!-- the balaclava, knitted -->
        <clipPath id="${id('bc')}"><path d="M152 205 C148 128 184 96 225 96 C266 96 302 128 298 205 C296 250 286 290 270 318 L274 380 C250 392 200 392 176 380 L180 318 C164 290 154 250 152 205 Z"/></clipPath>
        ${F('M152 205 C148 128 184 96 225 96 C266 96 302 128 298 205 C296 250 286 290 270 318 L274 380 C250 392 200 392 176 380 L180 318 C164 290 154 250 152 205 Z')}
        <g clip-path="url(#${id('bc')})"><rect x="140" y="90" width="170" height="310" fill="${c}" fill-opacity=".4"/>
          ${Array.from({ length: 12 }, (_, i) => { const x = 158 + i * 12; return `<path d="M${x} 96 C${x - 6} 200 ${x + 6} 300 ${x} 400" fill="none" stroke="${INK}" stroke-width="1.3" stroke-opacity=".55" stroke-dasharray="5 3"/>`; }).join('')}</g>
        ${L('M152 205 C148 128 184 96 225 96 C266 96 302 128 298 205 C296 250 286 290 270 318 L274 380 C250 392 200 392 176 380 L180 318 C164 290 154 250 152 205 Z', O)}
        ${F('M298 186 C314 184 316 222 297 226', 'none', O4)}${F('M152 186 C136 184 134 222 153 226', 'none', O4)}
        <!-- eye hole -->
        ${F('M164 188 C176 164 274 164 286 188 C290 210 272 220 250 216 L200 216 C178 220 160 210 164 188 Z')}
        ${L('M180 176 L214 186')}${L('M270 176 L236 186')}
        ${C(199, 196, 12)}${dot(207, 198, 6)}${C(251, 196, 12)}${dot(259, 198, 6)}
        ${L('M225 200 L220 212', O3)}
        <!-- mouth hole, teeth gritted -->
        ${F('M200 264 C200 246 250 246 250 264 C250 280 200 280 200 264 Z')}
        ${F('M208 258 L242 258 L242 270 L208 270 Z', '#fff', O3)}${L('M216 258 V270 M225 258 V270 M234 258 V270', O2)}`,
    }),

    betrayer: ({ c, u, id }) => ({
      body: `${F(SH)}${T(SH, c, .45)}
        ${L('M60 430 C70 470 72 510 70 552 M390 430 C380 470 378 510 380 552', O3)}
        ${F('M188 366 L150 382 L176 414 L225 408 Z', '#fff', O4)}${T('M188 366 L150 382 L176 414 L225 408 Z', c, .45)}
        ${F('M262 366 L300 382 L274 414 L225 408 Z', '#fff', O4)}${T('M262 366 L300 382 L274 414 L225 408 Z', c, .45)}
        <text x="62" y="470" font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="900" font-size="20" fill="${INK}" transform="rotate(-8 62 470)">D.O.C.</text>`,
      head: `<!-- the neck: scaled sides, belly plates down the front -->
        ${F('M190 410 C192 360 188 310 196 270 L254 270 C262 310 258 360 260 410 Z', `${u('s')}`, O)}
        ${F('M206 410 C206 360 204 310 210 272 L240 272 C246 310 244 360 244 410 Z', '#fff', O3)}
        ${[296, 314, 332, 350, 368, 386, 404].map(y => L(`M206 ${y} C216 ${y + 5} 234 ${y + 5} 244 ${y}`, O2)).join('')}
        <!-- the head: broad and flat, eyes on the corners, a mouth from ear to ear -->
        <clipPath id="${id('hc')}"><path d="${SNAKE}"/></clipPath>
        ${F(SNAKE)}
        <g clip-path="url(#${id('hc')})"><rect x="110" y="100" width="230" height="200" fill="${u('s')}" opacity=".55"/><rect x="110" y="100" width="230" height="200" fill="${c}" fill-opacity=".3"/>
          <path d="M190 124 L225 118 L260 124 L252 160 L225 170 L198 160 Z" fill="#fff" ${O3}/><path d="M198 160 L225 170 L252 160 L246 196 L225 204 L204 196 Z" fill="#fff" ${O3}/>
          <path d="M160 150 L190 124 L198 160 L182 176 Z M290 150 L260 124 L252 160 L268 176 Z" fill="#fff" ${O3}/>
          <path d="M160 238 C190 266 260 266 290 238 L290 300 L160 300 Z" fill="#fff"/></g>
        ${L(SNAKE, O)}
        <!-- side-eyes: slit pupils hard right, lids half down, brows scheming -->
        ${C(158, 180, 25, '#fff', O)}${C(292, 180, 25, '#fff', O)}
        <ellipse cx="172" cy="187" rx="5" ry="14" fill="${INK}"/><ellipse cx="306" cy="187" rx="5" ry="14" fill="${INK}"/>
        ${F('M133 180 A25 25 0 0 1 183 180 C170 174 146 174 133 180 Z', u('h'), O4)}
        ${F('M267 180 A25 25 0 0 1 317 180 C304 174 280 174 267 180 Z', u('h'), O4)}
        ${L('M126 150 C150 142 176 150 198 172', O)}${L('M324 150 C300 142 274 150 252 172', O)}
        <ellipse cx="213" cy="222" rx="4" ry="6" fill="${INK}" transform="rotate(-25 213 222)"/><ellipse cx="237" cy="222" rx="4" ry="6" fill="${INK}" transform="rotate(25 237 222)"/>
        <!-- the smirk and the forked tongue -->
        ${F('M218 248 L232 248 L232 290 L252 316 L242 320 L225 298 L208 320 L198 316 L218 290 Z', c, O3)}
        ${L('M136 230 C166 252 222 256 262 248 C290 242 306 230 316 216', O)}${L('M310 211 L323 224', O4)}`,
    }),

    forger: ({ c, u, id }) => ({
      body: `${F(SH, u('l'))}
        ${F('M186 366 L160 380 L204 430 L225 400 Z', '#fff', O4)}${F('M264 366 L290 380 L246 430 L225 400 Z', '#fff', O4)}
        ${F('M196 360 L225 400 L254 360 L240 348 L210 348 Z', '#fff', O4)}
        ${F('M212 380 C200 372 200 402 214 398 L225 390 L236 398 C250 402 250 372 238 380 L225 386 Z', c, O3)}`,
      head: `<!-- the quill, behind the ear -->
        ${F('M290 214 C298 160 330 104 378 62 C372 112 344 172 302 218 Z', '#fff', O4)}${T('M290 214 C298 160 330 104 378 62 C372 112 344 172 302 218 Z', c, .45)}
        ${L('M296 216 L376 64', O2)}${[0, 1, 2, 3, 4, 5].map(i => { const x = 306 + i * 11, y = 196 - i * 20; return L(`M${x} ${y} L${x + 14} ${y - 4}`, O2); }).join('')}
        ${neck(24, 280, 370)}
        ${F('M160 200 C158 136 188 112 225 112 C262 112 292 136 290 200 C288 262 260 302 225 304 C190 302 162 262 160 200 Z')}
        ${F('M160 192 C150 128 186 100 225 102 C264 100 300 128 290 192 C282 160 262 142 230 134 L225 120 L220 134 C188 142 168 160 160 192 Z', u('h'))}
        ${F('M290 190 C306 184 308 224 289 228', 'none', O4)}${F('M160 190 C144 184 142 224 161 228', 'none', O4)}
        <!-- monocle on one eye, a squint on the other -->
        ${L('M168 162 C180 150 206 150 216 164', O)}${L('M240 180 L274 176', O)}
        ${C(193, 196, 9, '#fff', O3)}${dot(195, 197, 5)}
        <circle cx="193" cy="196" r="25" fill="none" stroke="${INK}" stroke-width="6"/>${L('M178 184 C182 178 188 175 194 175', O2)}
        ${L('M244 198 C252 190 266 190 272 198', O4)}${dot(258, 196, 3.5)}
        <path d="M196 221 C192 270 168 300 176 372" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/>
        ${L('M227 202 L218 246 L232 248', O4)}
        <!-- pencil moustache, pursed mouth -->
        ${L('M198 262 C210 256 220 256 225 260 C230 256 240 256 252 262 M198 262 C192 262 190 256 194 254 M252 262 C258 262 260 256 256 254', O3)}
        ${L('M214 278 L236 278', O4)}
        <!-- ink blot on the cheek -->
        ${F('M254 236 C258 226 272 228 276 234 C286 232 290 244 280 248 C284 258 270 262 264 254 C254 260 246 246 254 236 Z', c, O2)}
        ${L('M270 258 L271 272', `stroke="${c}" stroke-width="3" stroke-linecap="round"`)}`,
      front: `<!-- ink-black fingertips gripping the placard, prints all over it -->
        ${[112, 125, 138, 151].map(x => `${F(`M${x} 424 L${x} 398 C${x} 390 ${x + 11} 390 ${x + 11} 398 L${x + 11} 424 C${x + 11} 432 ${x} 432 ${x} 424 Z`, '#fff', O3)}<path d="M${x + 1.5} 420 L${x + 1.5} 426 C${x + 1.5} 431 ${x + 9.5} 431 ${x + 9.5} 426 L${x + 9.5} 420 Z" fill="${u('x')}"/>`).join('')}
        ${[288, 301, 314, 327].map(x => `${F(`M${x} 424 L${x} 398 C${x} 390 ${x + 11} 390 ${x + 11} 398 L${x + 11} 424 C${x + 11} 432 ${x} 432 ${x} 424 Z`, '#fff', O3)}<path d="M${x + 1.5} 420 L${x + 1.5} 426 C${x + 1.5} 431 ${x + 9.5} 431 ${x + 9.5} 426 L${x + 9.5} 420 Z" fill="${u('x')}"/>`).join('')}
        ${[[132, 500, -20], [318, 470, 25], [150, 462, 10]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})" fill="none" stroke="${INK}" stroke-width="1.2" stroke-opacity=".6"><ellipse cx="${x}" cy="${y}" rx="9" ry="12"/><ellipse cx="${x}" cy="${y}" rx="6" ry="8.5"/><ellipse cx="${x}" cy="${y}" rx="3" ry="5"/></g>`).join('')}`,
    }),

    medic: ({ c, u, id }) => ({
      body: `${F(SH)}${T(SH, c, .4)}
        ${F('M188 366 L225 412 L262 366 Z', '#fff', O4)}
        ${L('M196 372 C166 380 154 396 150 414', `stroke="${INK}" stroke-width="7" stroke-linecap="round"`)}${L('M196 372 C166 380 154 396 150 414', `stroke="#fff" stroke-width="2" stroke-linecap="round"`)}
        ${L('M254 372 C284 380 296 396 300 414', `stroke="${INK}" stroke-width="7" stroke-linecap="round"`)}${L('M254 372 C284 380 296 396 300 414', `stroke="#fff" stroke-width="2" stroke-linecap="round"`)}
        ${dot(84, 430, 4)}${dot(96, 440, 2.5)}${dot(78, 446, 3)}`,
      head: `${neck(28, 280, 380)}
        ${F('M154 176 C154 252 180 302 225 306 C270 302 296 252 296 176 Z')}
        ${F('M296 196 C312 190 314 228 295 232', 'none', O4)}${F('M154 196 C138 190 136 228 155 232', 'none', O4)}
        <!-- surgical cap -->
        ${F('M142 184 C132 112 176 84 225 84 C274 84 318 112 308 184 C290 170 262 164 225 164 C188 164 160 170 142 184 Z')}${T('M142 184 C132 112 176 84 225 84 C274 84 318 112 308 184 C290 170 262 164 225 164 C188 164 160 170 142 184 Z', c, .45)}
        ${L('M176 100 C170 130 172 150 178 168 M274 100 C280 130 278 150 272 168', O2)}
        ${F('M218 110 L232 110 L232 120 L242 120 L242 134 L232 134 L232 144 L218 144 L218 134 L208 134 L208 120 L218 120 Z', '#fff', O3)}
        ${L('M308 176 C322 186 330 200 326 220 M312 180 C326 184 338 196 340 210', O3)}
        <!-- tired eyes, heavy bags -->
        ${L('M180 190 L214 194', O)}${L('M270 190 L236 194', O)}
        <ellipse cx="200" cy="206" rx="14" ry="9" fill="#fff" ${O3}/>${dot(200, 208, 5)}${F('M186 206 C188 196 212 196 214 206 Z', u('h'), O3)}
        <ellipse cx="250" cy="206" rx="14" ry="9" fill="#fff" ${O3}/>${dot(250, 208, 5)}${F('M236 206 C238 196 262 196 264 206 Z', u('h'), O3)}
        ${L('M186 220 C196 228 206 228 214 220 M188 228 C196 234 206 234 212 228 M236 220 C244 228 254 228 264 220 M238 228 C244 234 254 234 262 228', O2)}
        ${L('M226 212 L218 244 L234 244', O4)}
        <!-- mask pulled under the chin, a cigarette on the go -->
        ${L('M166 284 C150 262 148 236 154 214 M284 284 C300 262 302 236 296 214', `stroke="${INK}" stroke-width="8" stroke-linecap="round" fill="none"`)}${L('M166 284 C150 262 148 236 154 214 M284 284 C300 262 302 236 296 214', `stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"`)}
        ${F('M162 276 C196 298 254 298 288 276 L294 330 C256 350 194 350 156 330 Z')}${T('M162 276 C196 298 254 298 288 276 L294 330 C256 350 194 350 156 330 Z', c, .35)}${L('M162 294 C198 312 252 312 290 294 M160 312 C198 330 252 330 292 312', O3)}
        ${L('M208 266 L240 262', O4)}
        ${F('M238 262 L278 270 L277 278 L237 270 Z', '#fff', O2)}<path d="M272 269 L278 270 L277 278 L271 277 Z" fill="${INK}"/>
        <path d="M282 262 C292 248 278 238 290 222 C302 206 288 196 300 178" fill="none" stroke="${INK}" stroke-width="2" stroke-opacity=".6" stroke-linecap="round"/>`,
      front: `${C(316, 404, 13, '#fff', O4)}${C(316, 404, 6, 'none', O2)}`,
    }),

    detective: ({ c, u, id }) => ({
      body: `${F(SH)}<path d="${SH}" fill="${u('l')}"/>${L(SH, O)}
        ${F('M216 356 L234 356 L242 410 L208 410 Z', c, O3)}
        ${F('M166 400 L160 300 L214 350 L206 410 Z')}${F('M284 400 L290 300 L236 350 L244 410 Z')}`,
      head: `${neck(28, 280, 370)}
        ${F('M156 180 C156 150 186 138 225 138 C264 138 294 150 294 180 L292 250 C288 286 262 308 225 310 C188 308 162 286 158 250 Z')}
        ${F('M294 196 C310 190 312 228 293 232', 'none', O4)}${F('M156 196 C140 190 138 228 157 232', 'none', O4)}
        <path d="M162 252 C168 290 196 308 225 308 C254 308 282 290 288 252 C270 264 250 272 225 272 C200 272 180 264 162 252 Z" fill="${u('d')}"/>
        <path d="M158 166 L292 166 L292 190 C250 180 200 180 158 190 Z" fill="${u('l')}"/>
        <!-- fedora -->
        ${F('M160 150 C160 92 182 70 225 72 C268 70 290 92 290 150 Z', '#fff')}<path d="M162 148 C162 94 184 72 225 74 C266 72 288 94 288 148 Z" fill="${u('l')}"/>
        ${L('M196 80 C210 98 240 98 254 80', O3)}
        ${F('M161 126 C200 134 250 134 289 126 L290 148 C250 156 200 156 160 148 Z', c, O3)}
        ${F('M104 160 C124 136 326 136 346 160 C330 178 300 172 225 172 C150 172 120 178 104 160 Z')}
        <!-- squinting eye -->
        ${L('M176 196 L212 202', O)}${L('M182 214 C192 208 204 208 212 214', O4)}${dot(197, 213, 3.5)}
        ${L('M224 216 L214 252 L230 254', O4)}
        ${L('M198 280 C214 276 234 276 250 280', O4)}
        <!-- the magnifying glass, a huge eye inside -->
        <circle cx="262" cy="212" r="42" fill="#fff"/>
        <ellipse cx="262" cy="214" rx="28" ry="21" fill="#fff" ${O4}/><circle cx="262" cy="216" r="14" fill="${u('h')}" ${O3}/>${dot(262, 216, 7)}<circle cx="256" cy="210" r="3.5" fill="#fff"/>
        ${L('M234 184 C248 172 278 172 292 186', O)}
        ${[240, 252, 264, 276, 286].map((x, i) => L(`M${x} ${196 - (i === 0 || i === 4 ? -2 : 0)} L${x - 2 + i} ${188}`, O2)).join('')}
        <circle cx="262" cy="212" r="42" fill="none" stroke="${INK}" stroke-width="9"/><circle cx="262" cy="212" r="42" fill="none" stroke="#fff" stroke-width="2.5"/>
        ${L('M232 196 C236 186 242 180 250 176', `stroke="${INK}" stroke-width="2" stroke-opacity=".4" stroke-linecap="round"`)}`,
      front: `${F('M292 242 L306 250 L346 324 L330 334 Z', u('h'), O4)}
        ${F('M312 318 C318 300 348 300 356 318 L362 352 C360 372 322 374 316 356 Z')}${L('M320 330 L352 326 M320 342 L354 338 M322 354 L352 352', O2)}`,
    }),

    lovebird: ({ c, u, id }) => ({
      body: `<clipPath id="${id('bc')}"><path d="${BIRD}"/></clipPath>${F(BIRD)}
        <g clip-path="url(#${id('bc')})"><rect x="0" y="100" width="450" height="460" fill="${c}" fill-opacity=".3"/><rect x="0" y="318" width="450" height="240" fill="${u('d')}" fill-opacity=".7"/>
          ${[[150, 330], [185, 340], [225, 344], [265, 340], [300, 330], [168, 362], [205, 370], [245, 370], [282, 362], [186, 392], [225, 398], [264, 392]].map(([x, y]) => `<path d="M${x - 18} ${y} C${x - 12} ${y + 15} ${x + 12} ${y + 15} ${x + 18} ${y}" fill="#fff" ${O2}/>`).join('')}
          ${[[138, 120], [168, 104], [282, 104], [312, 120]].map(([x, y]) => L(`M${x - 12} ${y + 150} C${x - 8} ${y + 160} ${x + 8} ${y + 160} ${x + 12} ${y + 150}`, O2)).join('')}</g>
        ${L(BIRD, O)}
        ${[[1, 44, 112, 132], [-1, 406, 338, 318]].map(([s, x0, x1, x2]) => `${F(`M${x0} 552 C${x0 + s * 8} 470 ${x0 + s * 40} 420 ${x1} 400 C${x1 + s * 12} 396 ${x2} 404 ${x2 + s * 0} 416 L${x2 - s * 4} 552 Z`)}<path d="M${x0} 552 C${x0 + s * 8} 470 ${x0 + s * 40} 420 ${x1} 400 C${x1 + s * 12} 396 ${x2} 404 ${x2} 416 L${x2 - s * 4} 552 Z" fill="${c}" fill-opacity=".3"/>
          ${[0, 1, 2].map(i => L(`M${x0 + s * (18 + i * 22)} 552 C${x0 + s * (22 + i * 22)} 500 ${x0 + s * (34 + i * 20)} 460 ${x0 + s * (52 + i * 16)} 430`, O2)).join('')}`).join('')}`,
      head: `<!-- a round, dazed lovebird -->
        ${F('M214 118 C200 90 206 68 222 56 C222 80 228 98 232 114 Z', '#fff', O3)}${F('M228 116 C230 88 242 72 262 66 C252 88 246 104 240 118 Z', '#fff', O3)}${F('M204 122 C186 104 182 86 190 70 C198 90 206 104 214 116 Z', '#fff', O3)}
        ${C(184, 204, 30, '#fff', O4)}${C(266, 204, 30, '#fff', O4)}
        ${F(heart(186, 210, .7), c, O2)}${F(heart(268, 210, .7), c, O2)}
        ${F('M156 202 C160 176 208 176 214 202 C198 192 172 192 156 202 Z', u('h'), O3)}${F('M238 202 C242 176 290 176 296 202 C280 192 254 192 238 202 Z', u('h'), O3)}
        ${L('M158 196 L148 188 M164 188 L156 178 M290 196 L300 188 M284 188 L292 178', O3)}
        <!-- hooked beak -->
        ${F('M216 270 C216 284 234 284 236 270 Z', '#fff', O3)}
        ${F('M196 240 C198 216 252 216 254 240 C254 262 240 282 222 292 C226 272 212 254 196 240 Z')}<path d="M226 270 C232 262 240 256 246 258 C244 272 234 284 222 292 C226 284 226 276 226 270 Z" fill="${u('h')}"/>
        ${L('M196 240 C198 216 252 216 254 240 C254 262 240 282 222 292 C226 272 212 254 196 240 Z', O4)}${dot(214, 232, 2.8)}${dot(236, 232, 2.8)}
        <!-- heart-shaped plaster on the head -->
        <g transform="rotate(-22 176 138) translate(-4 12)">${F(heart(176, 138, 1.25), '#fff', O4)}<rect x="165" y="128" width="22" height="16" fill="${u('l')}" stroke="${INK}" stroke-width="2"/>
          ${[[160, 124], [192, 124], [176, 158], [158, 142], [194, 142]].map(([x, y]) => dot(x, y, 1.4)).join('')}</g>
        <!-- somebody's lipstick on the cheek -->
        <g transform="rotate(14 290 262)">
          <path d="M270 262 C274 252 282 250 290 256 C298 250 306 252 310 262 C300 266 280 266 270 262 Z" fill="${c}" stroke="${INK}" stroke-width="1.5"/>
          <path d="M270 262 C278 276 302 276 310 262 C300 268 280 268 270 262 Z" fill="${c}" stroke="${INK}" stroke-width="1.5"/>
          ${L('M280 266 L282 270 M290 267 L290 272 M300 266 L298 270', `stroke="#fff" stroke-width="1.2" stroke-linecap="round"`)}</g>
        ${F(heart(344, 120, .55), 'none', O3)}${F(heart(372, 88, .38), 'none', O2)}${F(heart(96, 110, .42), 'none', O2)}`,
      front: `<!-- wing tips grip the placard like fingers -->
        ${[108, 124, 140].map((x, i) => F(`M${x} 390 C${x + 4} 384 ${x + 16} 386 ${x + 16} 396 L${x + 14} ${430 - i * 3} C${x + 10} ${438 - i * 3} ${x + 2} ${436 - i * 3} ${x + 2} ${428 - i * 3} Z`, '#fff', O3)).join('')}
        ${[296, 312, 328].map((x, i) => F(`M${x} 396 C${x} 386 ${x + 12} 384 ${x + 16} 390 L${x + 14} ${428 - (2 - i) * 3} C${x + 14} ${436 - (2 - i) * 3} ${x + 4} ${438 - (2 - i) * 3} ${x} ${430 - (2 - i) * 3} Z`, '#fff', O3)).join('')}`,
    }),

    cursed: ({ c, u, id }) => ({
      back: `<!-- crossbones behind: the head IS the skull -->
        ${[[128, 120, 322, 314], [322, 120, 128, 314]].map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="24" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
          ${[[x1, y1], [x2, y2]].map(([x, y]) => { const sx = x < 225 ? 1 : -1, sy = y < 225 ? 1 : -1; return `${C(x - sx * 7, y + sy * 6, 12, '#fff', O4)}${C(x + sx * 6, y - sy * 7, 12, '#fff', O4)}<line x1="${x}" y1="${y}" x2="${x + sx * 18}" y2="${y + sy * 18}" stroke="#fff" stroke-width="15"/>`; }).join('')}`).join('')}
        <circle cx="225" cy="200" r="150" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round"/>
        <circle cx="225" cy="200" r="136" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="1 7" stroke-linecap="round"/>`,
      body: `${F(SH)}
        ${F('M180 368 C196 392 254 392 270 368', 'none', O4)}
        ${F('M320 440 C330 430 348 436 344 450 C352 458 338 470 330 462 C318 468 312 452 320 440 Z', u('x'), O2)}`,
      head: `<g transform="translate(225 300) scale(1.2) translate(-225 -300)">${neck(22, 280, 378)}${L('M212 320 L208 370 M238 320 L242 370', O2)}
        ${F('M166 180 C164 124 192 104 225 104 C258 104 286 124 284 180 C284 236 272 290 225 308 C178 290 166 236 166 180 Z')}
        <path d="M166 180 C164 124 192 104 225 104 C258 104 286 124 284 180 C284 236 272 290 225 308 C178 290 166 236 166 180 Z" fill="${c}" fill-opacity=".08"/>
        ${F('M164 176 C166 120 198 100 228 102 C262 104 286 128 286 176 C280 156 270 146 264 150 L260 186 L250 146 L240 176 L230 142 L216 174 L206 144 L194 180 L184 150 Z', u('h'), O4)}
        <!-- hollow, sunken eyes -->
        <ellipse cx="201" cy="204" rx="19" ry="21" fill="${u('x')}" ${O4}/><ellipse cx="249" cy="204" rx="19" ry="21" fill="${u('x')}" ${O4}/>
        <ellipse cx="201" cy="206" rx="11" ry="12" fill="${u('x')}"/><ellipse cx="249" cy="206" rx="11" ry="12" fill="${u('x')}"/>
        <circle cx="201" cy="206" r="4" fill="#fff"/><circle cx="249" cy="206" r="4" fill="#fff"/>
        ${L('M180 238 C184 256 190 266 198 274 M270 238 C266 256 260 266 252 274', O2)}
        ${L('M225 222 L218 244 L232 244', O3)}
        ${F('M210 268 C210 290 240 290 240 268 C240 258 210 258 210 268 Z', u('h'), O4)}
        <!-- clammy: sweat, and flies -->
        ${[[272, 150, 1], [178, 158, .8], [290, 214, .9]].map(([x, y, s]) => F(`M${x} ${y} C${x - 6 * s} ${y + 10 * s} ${x - 7 * s} ${y + 18 * s} ${x} ${y + 18 * s} C${x + 7 * s} ${y + 18 * s} ${x + 6 * s} ${y + 10 * s} ${x} ${y} Z`, '#fff', O2)).join('')}
        <path d="M322 110 C340 90 360 120 344 128 C328 136 336 100 366 96" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 4"/>
        ${dot(368, 95, 4)}<ellipse cx="364" cy="89" rx="5" ry="3" fill="#fff" ${O2}/><ellipse cx="373" cy="89" rx="5" ry="3" fill="#fff" ${O2}/>
        <path d="M112 262 C100 240 128 236 124 254 C120 270 96 262 92 244" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 4"/>
        ${dot(92, 242, 4)}<ellipse cx="88" cy="236" rx="5" ry="3" fill="#fff" ${O2}/><ellipse cx="97" cy="236" rx="5" ry="3" fill="#fff" ${O2}/></g>`,
    }),

    skank: ({ c, u, id }) => ({
      body: `${F(SH)}${T(SH, c, .42)}<path d="${SH}" fill="${u('d')}" fill-opacity=".35"/>
        ${F('M124 552 L150 404 C160 392 176 380 182 370 C198 394 252 394 268 370 C274 380 290 392 300 404 L326 552 Z')}
        ${F('M300 430 C312 420 330 428 326 444 C334 456 314 466 306 456 C292 462 288 442 300 430 Z', u('l'), O2)}${F('M150 470 C160 462 172 468 168 478 C170 490 154 490 150 482 C140 482 142 470 150 470 Z', u('l'), O2)}`,
      head: `${neck(30, 280, 380)}
        <!-- enormous ears -->
        ${F('M166 186 C124 162 72 146 34 146 C60 180 104 232 164 244 Z')}${T('M166 186 C124 162 72 146 34 146 C60 180 104 232 164 244 Z', c, .42)}${L('M150 196 C120 180 92 170 70 166 C96 190 124 214 152 224', O2)}
        ${F('M284 186 C326 162 378 146 416 146 C390 180 346 232 286 244 Z')}${T('M284 186 C326 162 378 146 416 146 C390 180 346 232 286 244 Z', c, .42)}${L('M300 196 C330 180 358 170 380 166 C354 190 326 214 298 224', O2)}
        ${F('M300 212 L312 214 M318 200 L326 196', 'none', O2)}
        <!-- lumpy bald head -->
        ${F('M160 204 C150 150 170 112 196 108 C204 100 216 98 225 102 C238 96 252 100 258 108 C286 114 302 150 290 204 C290 262 268 302 225 308 C182 302 160 262 160 204 Z')}
        ${T('M160 204 C150 150 170 112 196 108 C204 100 216 98 225 102 C238 96 252 100 258 108 C286 114 302 150 290 204 C290 262 268 302 225 308 C182 302 160 262 160 204 Z', c, .42)}
        ${L('M212 104 C208 90 214 82 210 72 M226 102 C230 88 224 80 232 70 M240 104 C246 94 244 86 250 80', O2)}
        ${C(182, 150, 5, '#fff', O2)}${C(270, 136, 4, '#fff', O2)}${C(262, 256, 3.5, '#fff', O2)}
        <!-- uneven beady eyes -->
        ${L('M172 176 C184 166 204 170 214 182', O)}${L('M278 170 L238 184', O)}
        ${C(196, 196, 14, '#fff', O4)}${dot(199, 198, 5)}${C(256, 192, 10, '#fff', O4)}${dot(254, 193, 4)}
        ${L('M182 214 C192 220 204 220 212 214 M244 208 C250 214 262 214 268 208', O2)}
        <!-- the nose -->
        ${F('M220 198 C206 222 196 250 212 262 C224 272 246 264 240 248 C236 234 234 214 230 198', '#fff', O4)}${T('M220 198 C206 222 196 250 212 262 C224 272 246 264 240 248 C236 234 234 214 230 198', c, .42)}
        <!-- a grin with four teeth left -->
        ${F('M174 266 C196 300 256 300 282 262 C258 276 198 278 174 266 Z', u('h'), O4)}
        ${F('M192 272 L203 274 L201 288 L191 285 Z', '#fff', O2)}${F('M214 276 L224 276 L225 292 L214 291 Z', c, O2)}${F('M242 275 L254 272 L256 286 L244 289 Z', '#fff', O2)}${F('M262 270 L272 266 L270 280 L263 282 Z', '#fff', O2)}
        ${L('M206 304 L204 312 M225 308 L225 316 M244 304 L246 312', O2)}`,
      front: `<!-- cheap lager, raised -->
        ${F('M388 552 C396 470 392 400 376 360 L338 360 C342 420 346 480 344 552 Z', '#fff')}${T('M388 552 C396 470 392 400 376 360 L338 360 C342 420 346 480 344 552 Z', c, .42)}<path d="M388 552 C396 470 392 400 376 360 L338 360 C342 420 346 480 344 552 Z" fill="${u('d')}" fill-opacity=".35"/>
        ${F('M332 244 L384 244 L386 346 L330 346 Z')}${F('M334 244 C334 234 382 234 382 244', '#fff', O3)}
        <rect x="331" y="270" width="54" height="40" fill="${c}" fill-opacity=".55"/>
        <text x="358" y="298" text-anchor="middle" font-family="'Big Shoulders Display',Impact,sans-serif" font-weight="900" font-size="17" fill="${INK}">LAGER</text>
        ${L('M331 270 L385 270 M331 310 L385 310', O2)}${L('M350 250 L362 262 L356 272', O2)}
        ${F('M322 312 C318 300 336 296 342 306 C340 296 356 294 360 306 C360 296 376 296 378 308 C384 304 392 312 388 322 L386 360 L334 360 C326 348 322 330 322 312 Z')}${T('M322 312 C318 300 336 296 342 306 C340 296 356 294 360 306 C360 296 376 296 378 308 C384 304 392 312 388 322 L386 360 L334 360 C326 348 322 330 322 312 Z', c, .42)}
        ${L('M342 306 L344 324 M360 306 L360 324', O2)}`,
    }),

    davyjones: ({ c, u, id }) => ({
      body: `${F(SH)}<path d="${SH}" fill="${u('l')}"/>${L(SH, O)}
        ${L('M190 370 L170 420 M260 370 L280 420', O3)}
        ${F('M40 420 C50 396 110 384 140 394 C150 404 140 420 110 424 C80 426 54 428 40 420 Z')}${[50, 62, 74, 86, 98, 110, 122].map(x => L(`M${x} ${426} L${x - 2} ${448}`, O2)).join('')}
        ${F('M410 420 C400 396 340 384 310 394 C300 404 310 420 340 424 C370 426 396 428 410 420 Z')}${[328, 340, 352, 364, 376, 388, 400].map(x => L(`M${x} ${426} L${x + 2} ${448}`, O2)).join('')}
        ${barnacle(80, 470, 8)}${barnacle(94, 480, 6)}${barnacle(72, 486, 5)}`,
      head: `${neck(26, 260, 372)}
        <!-- seaweed hair -->
        ${[[160, 1], [290, -1]].map(([x, s]) => `<path d="M${x} 150 C${x - 14 * s} 180 ${x + 4 * s} 210 ${x - 10 * s} 240 C${x - 20 * s} 262 ${x - 4 * s} 282 ${x - 14 * s} 300 L${x - 4 * s} 300 C${x + 8 * s} 280 ${x - 8 * s} 262 ${x + 2 * s} 240 C${x + 16 * s} 210 ${x - 2 * s} 180 ${x + 12 * s} 150 Z" fill="${c}" fill-opacity=".5" ${O3}/>`).join('')}
        ${F('M154 198 C152 150 186 132 225 132 C264 132 298 150 296 198 C298 240 290 266 278 280 L172 280 C160 266 152 240 154 198 Z')}
        <path d="M154 198 C152 150 186 132 225 132 C264 132 298 150 296 198 C298 240 290 266 278 280 L172 280 C160 266 152 240 154 198 Z" fill="${c}" fill-opacity=".12"/>
        <!-- eyes: one drooping, one bulging -->
        ${L('M176 180 L212 188', O)}${L('M242 176 C254 164 272 164 282 176', O)}
        ${F('M182 204 C188 194 208 194 214 204 C208 212 188 212 182 204 Z', '#fff', O3)}${dot(199, 205, 4)}${F('M182 204 C188 194 208 194 214 204 C204 200 190 200 182 204 Z', u('h'), O3)}
        ${C(260, 202, 16, '#fff', O4)}${dot(264, 206, 3.5)}
        ${F('M216 206 C206 232 210 246 225 248 C240 246 244 232 234 206', '#fff', O4)}
        ${F(star(182, 246, 18, 7, 5, -70), c, O3)}${dot(182, 246, 1.4)}
        ${barnacle(284, 238, 6)}${barnacle(274, 250, 4)}
        <!-- the tentacle beard -->
        ${tentacle([[178, 250], [170, 300], [150, 330], [168, 372]], 11, c, u)}
        ${tentacle([[206, 256], [206, 310], [186, 340], [204, 392]], 12, c, u)}
        ${tentacle([[272, 250], [280, 300], [300, 330], [282, 372]], 11, c, u)}
        ${tentacle([[244, 256], [244, 310], [264, 346], [246, 392]], 12, c, u)}
        ${tentacle([[225, 258], [226, 320], [222, 360], [232, 404]], 13, c, u)}
        ${F('M200 256 C212 266 238 266 250 256', 'none', O4)}
        <!-- tricorn hat, barnacled, dripping -->
        ${F('M168 108 C174 64 276 64 282 108 Z', u('l'), O4)}
        ${F('M96 138 C130 124 150 84 225 80 C300 84 320 124 354 138 C318 146 272 150 250 162 L225 180 L200 162 C178 150 132 146 96 138 Z')}<path d="M96 138 C130 124 150 84 225 80 C300 84 320 124 354 138 C318 146 272 150 250 162 L225 180 L200 162 C178 150 132 146 96 138 Z" fill="${u('h')}" fill-opacity=".55"/>
        ${L('M110 136 C150 128 180 144 200 160 L225 174 L250 160 C270 144 300 128 340 136', `stroke="${c}" stroke-width="4" stroke-linecap="round"`)}
        ${barnacle(150, 118, 8)}${barnacle(164, 110, 6)}${barnacle(300, 116, 7)}
        ${[[116, 150], [330, 150], [225, 190]].map(([x, y]) => F(`M${x} ${y} C${x - 4} ${y + 7} ${x - 4} ${y + 12} ${x} ${y + 12} C${x + 4} ${y + 12} ${x + 4} ${y + 7} ${x} ${y} Z`, '#fff', O2)).join('')}`,
    }),

    scrooge: ({ c, u, id }) => ({
      body: `${F(SH)}<path d="${SH}" fill="${u('h')}" fill-opacity=".8"/>${L(SH, O)}
        ${F('M180 362 L225 420 L270 362 Z', '#fff', O4)}
        ${F('M192 352 L178 382 L214 372 Z', '#fff', O3)}${F('M258 352 L272 382 L236 372 Z', '#fff', O3)}
        ${F('M206 376 C198 366 212 360 225 368 C238 360 252 366 244 376 L236 404 L214 404 Z', u('x'), O3)}`,
      head: `${neck(20, 290, 372)}${L('M210 330 L208 366 M240 330 L242 366', O2)}
        <!-- a long, sour face -->
        ${F('M178 156 C176 138 198 132 225 132 C252 132 274 138 272 156 L272 232 C270 282 250 314 225 320 C200 314 180 282 178 232 Z')}
        ${F('M272 196 C290 188 292 236 272 240', 'none', O4)}${F('M178 196 C160 188 158 236 178 240', 'none', O4)}
        <!-- white wisps under the hat, thin chops -->
        ${F('M178 156 C160 150 146 158 142 176 C152 170 158 172 164 180 C156 184 150 196 152 206 C162 196 170 196 176 200 Z', '#fff', O3)}
        ${F('M272 156 C290 150 304 158 308 176 C298 170 292 172 286 180 C294 184 300 196 298 206 C288 196 280 196 274 200 Z', '#fff', O3)}
        <path d="M180 212 L180 262 C186 270 190 266 190 256 L190 214 Z" fill="${u('l')}"/><path d="M270 212 L270 262 C264 270 260 266 260 256 L260 214 Z" fill="${u('l')}"/>
        <!-- a glare -->
        ${L('M184 180 L216 192', O)}${L('M266 180 L234 192', O)}
        ${L('M190 202 C198 196 210 196 216 202', O4)}${L('M234 202 C240 196 252 196 260 202', O4)}${dot(204, 203, 3.5)}${dot(246, 203, 3.5)}
        ${L('M190 212 C198 216 210 216 214 212 M236 212 C242 216 254 216 260 212 M182 196 L176 192 M182 204 L176 206 M268 196 L274 192 M268 204 L274 206', O2)}
        ${L('M196 166 C210 162 240 162 254 166 M204 174 C216 171 234 171 246 174', O2)}
        <!-- hooked nose -->
        ${F('M222 198 C228 222 246 246 238 258 C232 266 220 262 214 254', 'none', O4)}
        ${L('M200 242 C194 258 194 270 198 280 M250 242 C256 258 256 270 252 280', O2)}
        <!-- the coin, clenched in his teeth -->
        ${F('M194 282 C206 272 244 272 256 282 C244 292 206 292 194 282 Z', '#fff', O3)}${L('M200 282 L250 282 M206 278 V286 M214 276 V288 M236 276 V288 M244 278 V286', O2)}
        ${L('M194 282 L186 294 M256 282 L264 294', O4)}
        <circle cx="225" cy="283" r="17" fill="#fff" ${O4}/><circle cx="225" cy="283" r="17" fill="#c9a227" fill-opacity=".75"/><circle cx="225" cy="283" r="12" fill="none" ${O2}/>
        <text x="225" y="290" text-anchor="middle" font-family="'IM Fell English',Georgia,serif" font-size="19" fill="${INK}">£</text>
        ${L('M216 306 C222 310 228 310 234 306', O2)}
        <!-- the purple top hat with the pink band -->
        ${F('M162 136 L170 26 C200 16 250 16 280 26 L288 136 Z', '#fff')}
        <path d="M162 136 L170 26 C200 16 250 16 280 26 L288 136 Z" fill="#6a3a8c" fill-opacity=".5"/><path d="M164 134 L171 28 C200 18 250 18 279 28 L286 134 Z" fill="${u('l')}" fill-opacity=".7"/>
        ${L('M162 136 L170 26 C200 16 250 16 280 26 L288 136', O)}
        ${F('M166 96 L284 96 L286 126 L164 126 Z', '#e27aa8', O4)}
        ${L('M250 40 L262 58 L254 72', O2)}
        ${F('M124 138 C146 122 304 122 326 138 C306 156 144 156 124 138 Z')}<path d="M124 138 C146 122 304 122 326 138 C306 156 144 156 124 138 Z" fill="#6a3a8c" fill-opacity=".5"/>`,
    }),

    jester: ({ c, u, id }) => ({
      body: `<clipPath id="${id('jc')}"><path d="${SH}"/></clipPath>${F(SH)}
        <g clip-path="url(#${id('jc')})">${Array.from({ length: 30 }, (_, i) => { const col = i % 6, row = Math.floor(i / 6); const x = col * 80 + (row % 2) * 40, y = 370 + row * 40; return `<path d="M${x} ${y} L${x + 40} ${y + 40} L${x} ${y + 80} L${x - 40} ${y + 40} Z" fill="${c}" fill-opacity=".45"/>`; }).join('')}</g>${L(SH, O)}
        <!-- the ruff -->
        ${F('M124 352 L146 336 L150 362 L176 338 L178 368 L204 344 L208 372 L225 346 L242 372 L246 344 L272 368 L274 338 L300 362 L304 336 L326 352 L318 380 L300 374 L292 398 L272 382 L256 404 L240 384 L225 408 L210 384 L194 404 L178 382 L158 398 L150 374 L132 380 Z')}`,
      head: `${neck(26, 270, 350)}
        ${F('M158 204 C156 150 186 126 225 126 C264 126 294 150 292 204 C292 262 264 302 225 304 C186 302 158 262 158 204 Z')}
        ${F('M292 200 C306 194 308 228 291 232', 'none', O4)}${F('M158 200 C144 194 142 228 159 232', 'none', O4)}
        <!-- the belled hat -->
        ${F('M152 170 C110 150 76 160 60 200 C84 178 110 176 132 180 C120 150 130 110 176 98 C170 70 196 44 236 36 C216 60 214 84 222 100 C236 84 272 80 286 100 C326 110 334 150 320 180 C340 174 366 178 390 200 C374 160 340 150 298 170 C284 150 166 150 152 170 Z')}
        <path d="M152 170 C110 150 76 160 60 200 C84 178 110 176 132 180 C120 150 130 110 176 98 C200 100 214 110 222 130 C196 140 170 150 152 170 Z" fill="${c}" fill-opacity=".45"/>
        <path d="M298 170 C340 150 374 160 390 200 C366 178 340 174 320 180 C334 150 326 110 286 100 C262 100 240 112 230 130 C256 140 282 150 298 170 Z" fill="${c}" fill-opacity=".45"/>
        ${L('M176 98 C200 100 214 110 224 132 M286 100 C262 100 240 112 228 132', O3)}
        ${C(60, 206, 12, '#fff', O4)}${L('M52 208 L68 208', O3)}${C(390, 206, 12, '#fff', O4)}${L('M382 208 L398 208', O3)}${C(240, 32, 11, '#fff', O4)}${L('M233 34 L247 34', O3)}
        ${F('M150 172 C190 150 260 150 300 172 L302 192 C262 172 188 172 148 192 Z', '#fff', O4)}
        ${[176, 200, 225, 250, 274].map(x => F(`M${x} 166 L${x + 5} 173 L${x} 180 L${x - 5} 173 Z`, INK, O2)).join('')}
        <!-- smeared diamonds, staring eyes -->
        ${F('M199 184 L212 206 L199 244 L186 206 Z', u('x'), O2)}${F('M251 184 L264 206 L251 244 L238 206 Z', u('x'), O2)}
        <path d="M188 236 L182 256 M194 240 L190 262 M206 238 L204 252 M246 238 L244 256 M256 240 L256 262" stroke="${INK}" stroke-width="1.6" stroke-opacity=".6" stroke-linecap="round"/>
        ${C(199, 206, 11, '#fff', O3)}${dot(199, 206, 3)}${C(251, 206, 11, '#fff', O3)}${dot(251, 206, 3)}
        ${L('M218 214 L214 238 L228 238', O3)}
        <!-- the grin, painted past the mouth -->
        <path d="M160 244 C176 292 274 292 290 244 C280 262 170 262 160 244 Z" fill="${c}" fill-opacity=".5"/>
        ${F('M172 252 C190 286 260 286 278 252 C256 262 194 262 172 252 Z')}
        ${L('M178 258 C196 266 254 266 272 258 M190 260 L192 276 M204 262 L204 280 M218 263 L218 283 M232 263 L232 283 M246 262 L246 280 M260 260 L258 276', O2)}
        ${L('M160 244 L154 236 M290 244 L296 236', O3)}`,
    }),

    assassin: ({ c, u, id }) => ({
      body: `${F(SH, u('h'))}
        ${F('M170 368 L262 552 L302 552 L206 368 Z', '#fff', O4)}${F('M280 368 L188 552 L148 552 L244 368 Z', '#fff', O4)}`,
      head: `<!-- hood and mask: only the eyes -->
        ${F('M146 210 C140 130 180 96 225 96 C270 96 310 130 304 210 C302 270 294 330 286 372 L164 372 C156 330 148 270 146 210 Z', u('h'))}
        ${L('M176 250 C200 262 250 262 274 250 M172 290 C200 302 250 302 278 290 M174 330 C200 340 250 340 276 330', `stroke="#fff" stroke-width="3" stroke-linecap="round"`)}
        ${F('M150 164 C200 150 250 150 300 164 L302 184 C250 170 200 170 148 184 Z', '#fff', O4)}${T('M150 164 C200 150 250 150 300 164 L302 184 C250 170 200 170 148 184 Z', c, .6)}
        ${F('M300 168 C328 150 356 160 384 140 C376 168 346 180 304 180 Z', '#fff', O3)}${T('M300 168 C328 150 356 160 384 140 C376 168 346 180 304 180 Z', c, .6)}
        ${F('M300 176 C326 178 350 196 380 196 C360 208 330 200 302 184 Z', '#fff', O3)}${T('M300 176 C326 178 350 196 380 196 C360 208 330 200 302 184 Z', c, .6)}
        ${F('M166 192 C200 182 250 182 284 192 L282 226 C250 234 200 234 168 226 Z')}
        ${F('M182 212 C192 200 208 200 216 210 C208 218 192 220 182 212 Z', '#fff', O3)}${dot(204, 210, 5)}
        ${F('M268 212 C258 200 242 200 234 210 C242 218 258 220 268 212 Z', '#fff', O3)}${dot(246, 210, 5)}
        ${L('M178 198 L216 206', O)}${L('M272 198 L234 206', O)}
        ${L('M225 212 L225 226', O2)}`,
      front: `<!-- a shuriken on the placard string -->
        <g transform="rotate(20 160 384)">${F('M160 360 L166 378 L184 384 L166 390 L160 408 L154 390 L136 384 L154 378 Z', '#fff', O3)}${C(160, 384, 4, '#fff', O2)}</g>`,
    }),

    angel: ({ c, u, id }) => ({
      back: `<!-- wings, crumpled in the scuffle: the left one fanned, the right one bent at odd angles -->
        ${wing([178, 398], [[150, 300], [90, 228]], [40, 212], [[48, 280], [76, 326], [110, 358], [146, 384]], c)}
        ${wing([272, 396], [[300, 320], [330, 270]], [352, 262], [[400, 286], [426, 340], [400, 366], [362, 382], [322, 394]], c, [352, 262])}
        ${F('M370 150 C382 142 396 150 392 166 C388 180 372 182 364 190 C362 174 360 158 370 150 Z', '#fff', O2)}${L('M366 186 L386 152', O2)}
        ${F('M58 120 C70 112 84 120 80 136 C76 150 60 152 52 160 C50 144 48 128 58 120 Z', '#fff', O2)}${L('M54 156 L74 122', O2)}`,
      body: `${F(SH)}${L('M140 400 C150 450 150 500 146 552 M310 400 C300 450 300 500 304 552 M80 440 C90 480 92 520 90 552 M370 440 C360 480 358 520 360 552', O2)}
        ${F('M186 368 C200 392 250 392 264 368', 'none', O4)}`,
      head: `${neck(26, 280, 372)}
        ${F('M150 210 C150 146 184 118 225 118 C266 118 300 146 300 210 C300 270 268 306 225 308 C182 306 150 270 150 210 Z')}
        <!-- curls -->
        ${F('M146 196 C132 180 140 160 154 158 C146 138 162 122 180 128 C184 108 206 102 218 114 C228 98 252 100 258 116 C274 106 294 118 290 136 C308 136 316 156 304 170 C316 180 310 198 300 200 C290 180 270 164 250 170 C236 158 210 158 196 170 C176 162 156 178 146 196 Z')}
        ${[[170, 146], [200, 128], [236, 124], [270, 136], [292, 160], [158, 172]].map(([x, y]) => L(`M${x} ${y} c4 -6 12 -2 8 4 c-3 4 -8 2 -6 -2`, O2)).join('')}
        <!-- halo, knocked askew -->
        <ellipse cx="236" cy="84" rx="74" ry="17" transform="rotate(-9 236 84)" fill="none" stroke="${INK}" stroke-width="13"/>
        <ellipse cx="236" cy="84" rx="74" ry="17" transform="rotate(-9 236 84)" fill="none" stroke="#fff" stroke-width="7"/>
        <ellipse cx="236" cy="84" rx="74" ry="17" transform="rotate(-9 236 84)" fill="none" stroke="${c}" stroke-width="7"/>
        ${L('M318 58 L326 50 M324 74 L336 74 M146 58 L136 50', O2)}
        <!-- big, wet, innocent eyes rolled heavenward -->
        ${L('M178 188 C186 178 202 176 212 182', O4)}${L('M272 188 C264 178 248 176 238 182', O4)}
        ${C(197, 212, 18, '#fff', O4)}${C(253, 212, 18, '#fff', O4)}
        ${C(199, 202, 10, INK, 'stroke="none"')}${C(255, 202, 10, INK, 'stroke="none"')}
        <circle cx="195" cy="198" r="4" fill="#fff"/><circle cx="251" cy="198" r="4" fill="#fff"/><circle cx="203" cy="206" r="2" fill="#fff"/><circle cx="259" cy="206" r="2" fill="#fff"/>
        ${L('M180 204 L172 198 M182 196 L176 188 M270 204 L278 198 M268 196 L274 188', O3)}
        ${L('M225 226 C222 236 222 240 228 242', O3)}
        <path d="M172 244 L184 238 M176 252 L188 246 M180 258 L190 254 M262 238 L274 244 M262 246 L274 252 M264 254 L272 258" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
        ${F('M216 262 C220 270 230 270 234 262', 'none', O4)}`,
      front: `<!-- big praying hands: who, me? -->
        ${F('M225 414 L225 312 C214 300 190 304 188 326 L184 384 C182 404 200 414 225 414 Z')}
        ${F('M225 414 L225 312 C236 300 260 304 262 326 L266 384 C268 404 250 414 225 414 Z')}
        ${F('M186 372 C194 350 214 352 216 370 L216 402', '#fff', O4)}${F('M264 372 C256 350 236 352 234 370 L234 402', '#fff', O4)}
        ${L('M206 306 L204 336 M244 306 L246 336', O3)}`,
    }),

    drinker: ({ c, u, id }) => ({
      body: `${F(SH)}${T(SH, c, .4)}
        ${F('M184 366 L200 400 L225 382 L250 400 L266 366 C250 376 200 376 184 366 Z', '#fff', O4)}
        ${F('M312 440 C320 426 340 432 336 446 C344 456 326 466 318 456 C306 460 302 446 312 440 Z', u('l'), O2)}`,
      head: `${neck(28, 280, 372)}
        ${F('M150 205 C148 140 184 112 225 112 C266 112 302 140 300 205 C300 268 270 310 225 312 C180 310 150 268 150 205 Z')}
        ${F('M300 200 C316 194 318 232 299 236', 'none', O4)}${F('M150 200 C134 194 132 232 151 236', 'none', O4)}
        <!-- the bald patch and the three hairs that stayed -->
        <path d="M152 196 C148 160 158 140 172 130 C168 160 170 180 176 196 Z" fill="${u('h')}"/><path d="M298 196 C302 160 292 140 278 130 C282 160 280 180 274 196 Z" fill="${u('h')}"/>
        ${L('M200 116 C220 104 250 112 262 130 M210 114 C226 122 236 132 240 148 M196 120 C210 132 214 146 212 156', O2)}
        <path d="M162 262 C170 292 196 310 225 310 C254 310 280 292 288 262 C270 272 250 278 225 278 C200 278 180 272 162 262 Z" fill="${u('d')}"/>
        <!-- bleary, not quite pointing the same way -->
        ${L('M178 184 C188 180 204 182 214 188', O4)}${L('M238 190 C248 184 262 184 272 190', O4)}
        ${C(197, 206, 13, '#fff', O3)}${dot(201, 209, 5)}${C(253, 208, 13, '#fff', O3)}${dot(250, 211, 5)}
        ${F('M184 206 A13 13 0 0 1 210 206 C204 200 190 200 184 206 Z', u('h'), O3)}${F('M240 206 A13 13 0 0 1 266 206 C258 202 246 202 240 206 Z', u('h'), O3)}
        ${F('M184 202 C190 198 206 198 210 204 L210 206 L184 206 Z', u('h'), 'stroke="none"')}${F('M240 202 C246 198 262 198 266 206 L240 206 Z', u('h'), 'stroke="none"')}
        ${L('M184 224 C194 230 204 230 212 224 M238 226 C246 232 256 232 266 226', O2)}
        <!-- flushed nose and cheeks -->
        ${F('M216 212 C206 232 206 250 225 252 C244 250 244 232 234 212', '#fff', O4)}<path d="M212 236 C210 248 220 252 226 250 C236 250 240 244 238 236 Z" fill="${u('l')}"/>
        <path d="M168 236 L180 232 M170 244 L184 240 M174 252 L186 248 M270 232 L282 236 M268 240 L280 244 M266 248 L276 252" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
        <!-- a lopsided grin under a foam moustache -->
        ${L('M200 280 C214 292 240 290 256 274', O4)}
        ${F('M194 266 C194 254 206 252 212 258 C216 250 230 250 234 258 C240 250 254 254 256 264 C246 270 206 272 194 266 Z', '#fff', O3)}
        ${F('M232 268 C230 274 232 280 236 280 C240 280 240 274 238 268 Z', '#fff', O2)}`,
      front: `<!-- the pint -->
        ${F('M392 552 C398 470 394 390 380 330 L336 330 C338 400 344 480 342 552 Z', '#fff')}${T('M392 552 C398 470 394 390 380 330 L336 330 C338 400 344 480 342 552 Z', c, .4)}
        ${F('M316 206 L380 206 L372 350 L324 350 Z')}
        <path d="M319 236 L377 236 L372 348 L324 348 Z" fill="${u('d')}" fill-opacity=".9"/>
        ${F('M314 214 C310 198 326 192 334 200 C338 188 356 188 360 198 C368 190 386 196 382 212 C386 226 370 236 360 230 C354 240 336 240 332 230 C322 238 310 228 314 214 Z', '#fff', O3)}
        ${L('M328 250 L332 330', `stroke="#fff" stroke-width="5" stroke-linecap="round"`)}
        ${F('M318 300 C314 290 328 286 334 294 C334 284 350 282 354 292 C356 282 372 282 374 294 C382 290 390 300 386 312 L384 334 C380 350 330 352 322 336 Z')}
        ${L('M334 294 L336 316 M354 292 L354 316 M374 294 L372 316', O2)}`,
    }),
  };

  const build = (key, i) => {
    const p = 'mg-' + key + '-';
    const u = k => `url(#${p}${k})`;
    const id = k => p + k;
    const d = DRAW[key]({ c: COL[key], u, id });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 550" role="img" aria-label="${LABEL[key]} mugshot">${defs(p)}${wall()}${d.back || ''}${d.body || ''}${d.head || ''}${placard(key, i + 1)}${d.front || ''}</svg>`;
  };
  window.MUGSHOTS = Object.fromEntries(ORDER.map((k, i) => [k, build(k, i)]));
  window.MUGSHOT_ORDER = ORDER;
  window.MUGSHOT_LABEL = LABEL;
})();
