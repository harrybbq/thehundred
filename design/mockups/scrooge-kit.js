// THE SCROOGE KIT: the counting house for the Scrooge's TV scenes (Swapsies, Re-spin, Graffiti).
// Plain JS, no build step. Load after support.js and machine-kit.js.
// The static art is returned as MARKUP STRINGS and poured into placeholders by ScroogeKit.fill() from a board's
// renderVals() (support.js escapes {{ }} holes, so markup can't go through them). Nothing here is templated.
//
//   ScroogeKit.defs()                  -> <svg> of shared gradients + coin faces (#sg-coin-heads / -tails / -blank)
//   ScroogeKit.hat(w)                  -> the Scrooge's top hat (purple, pink band), drawn in SVG, w px wide
//   ScroogeKit.glove()                 -> his white glove on a purple sleeve; pinch point at (0,0), fingers down, sleeve up
//   ScroogeKit.room(o)                 -> the counting-house wall: panelling, ledger shelves, the hanging lamp and its cone
//   ScroogeKit.counter(o)              -> his leather-topped mahogany counter with a brass rail
//   ScroogeKit.ledger / stacks / inkwell(x, y, k)  -> props on the counter (Penny's ledger and coin stacks)
//   ScroogeKit.sting()                 -> the shared opening: TV static + "BAH, HUMBUG!"
//   ScroogeKit.polaroid(player)        -> a big polaroid (face + name)
//   ScroogeKit.fill({ name: html })    -> innerHTML into every [data-sg="name"]
//   ScroogeKit.timeline(comp, P)       -> { tl, A }: one-shot keyframe timeline (ms), play once and hold; ?t=ms freezes it
//   ScroogeKit.write(text, box)        -> his handwriting: single-stroke marker capitals laid out in a box
(function () {
  const f1 = v => +(+v).toFixed(1);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------------------------------------------------------------- shared defs (gradients, coin faces)
  function defs() {
    const leaves = [], stem = side => { const pts = []; for (let t = 0; t <= 6; t++) { const a = (98 + t * 19) * Math.PI / 180; pts.push([Math.cos(a) * 66 * side, Math.sin(a) * 66]); } return 'M' + pts.map(p => p.map(f1).join(' ')).join('L'); };
    [-1, 1].forEach(side => { for (let t = 0; t <= 6; t++) { const deg = 98 + t * 19, a = deg * Math.PI / 180; [-1, 1].forEach(o => {
      const x = Math.cos(a) * (66 + o * 8), y = Math.sin(a) * (66 + o * 8), r0 = deg + 90 + o * 32;
      leaves.push(`<ellipse cx="${f1(side === 1 ? x : -x)}" cy="${f1(y)}" rx="12" ry="5.2" transform="rotate(${f1(side === 1 ? r0 : 180 - r0)} ${f1(side === 1 ? x : -x)} ${f1(y)})" fill="#7a5a00" stroke="#4a3600" stroke-width="1.5"/>`); }); } });
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <radialGradient id="sg-gold" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff3c0"/><stop offset=".45" stop-color="#e0b458"/><stop offset=".9" stop-color="#8a6a00"/></radialGradient>
      <linearGradient id="sg-brass-v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2c00"/><stop offset=".18" stop-color="#8a6a10"/><stop offset=".36" stop-color="#fff0b0"/><stop offset=".52" stop-color="#e0b458"/><stop offset=".82" stop-color="#8a6a10"/><stop offset="1" stop-color="#2a1e00"/></linearGradient>
      <linearGradient id="sg-brass-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".3" stop-color="#e0b458"/><stop offset=".75" stop-color="#8a6a10"/><stop offset="1" stop-color="#3a2c00"/></linearGradient>
      <linearGradient id="sg-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0906"/><stop offset=".55" stop-color="#3a1410"/><stop offset="1" stop-color="#4a1a12"/></linearGradient>
      <linearGradient id="sg-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e170c"/><stop offset=".4" stop-color="#1e0e06"/><stop offset="1" stop-color="#0c0603"/></linearGradient>
      <linearGradient id="sg-wood-panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1409"/><stop offset="1" stop-color="#170a04"/></linearGradient>
      <symbol id="sg-coin-blank" viewBox="-100 -100 200 200" overflow="visible">
        <circle r="99" fill="#2a1e00"/><circle r="95" fill="url(#sg-gold)"/>
        <circle r="89" fill="none" stroke="#7a5a00" stroke-width="6" stroke-dasharray="3 3.2"/>
        <circle r="82" fill="none" stroke="#fff3c0" stroke-width="2" opacity=".45"/>
        <circle r="78" fill="none" stroke="#5a4400" stroke-width="2.5" opacity=".7"/>
      </symbol>
      <symbol id="sg-coin-heads" viewBox="-100 -100 200 200" overflow="visible">
        <use href="#sg-coin-blank" x="-100" y="-100" width="200" height="200"/>
        <g stroke="#1e1230" stroke-linejoin="round">
          <ellipse cx="0" cy="36" rx="64" ry="15" fill="#3e2b58" stroke-width="4"/>
          <path d="M-38 36 L-44 -44 Q0 -56 44 -44 L38 36 Q0 44 -38 36 Z" fill="#6a4f8f" stroke-width="4"/>
          <path d="M-40 8 Q0 16 40 8 L38 32 Q0 40 -38 32 Z" fill="#ff4f9a" stroke-width="3"/>
          <ellipse cx="0" cy="-44" rx="44" ry="11" fill="#8a6db3" stroke-width="4"/>
          <path d="M-64 36 Q0 62 64 36 Q0 47 -64 36 Z" fill="#4a3566" stroke-width="3"/>
        </g>
        <path d="M-32 -36 L-35 2 L-25 4 L-21 -39 Z" fill="#fff" opacity=".2"/>
        <path d="M-34 14 L-33 28 L-24 29 L-25 16 Z" fill="#fff" opacity=".35"/>
      </symbol>
      <symbol id="sg-coin-tails" viewBox="-100 -100 200 200" overflow="visible">
        <use href="#sg-coin-blank" x="-100" y="-100" width="200" height="200"/>
        <g fill="none" stroke="#6a4e00" stroke-width="3.5" stroke-linecap="round"><path d="${stem(1)}"/><path d="${stem(-1)}"/></g>
        ${leaves.join('')}
        <text x="2" y="38" text-anchor="middle" font-family="'IM Fell English', serif" font-size="112" fill="#fff3c0" opacity=".55">£</text>
        <text x="0" y="36" text-anchor="middle" font-family="'IM Fell English', serif" font-size="112" fill="#5a4400">£</text>
      </symbol>
    </defs></svg>`;
  }

  // ---------------------------------------------------------------- the top hat (drawn; the coin's heads face, standing up)
  // local box: x -70..70, y -78..34 (brim centre at 0,22). Returns an <svg> w px wide.
  function hatG() {
    return `<ellipse cx="0" cy="30" rx="58" ry="7" fill="#000" opacity=".45"/>
      <g stroke="#140b20" stroke-linejoin="round">
        <ellipse cx="0" cy="18" rx="66" ry="15" fill="#3e2b58" stroke-width="5"/>
        <path d="M-40 18 L-46 -62 Q0 -76 46 -62 L40 18 Q0 28 -40 18 Z" fill="#6a4f8f" stroke-width="5"/>
        <path d="M-42 -12 Q0 -3 42 -12 L40 14 Q0 24 -40 14 Z" fill="#ff4f9a" stroke-width="4"/>
        <ellipse cx="0" cy="-63" rx="46" ry="12" fill="#8a6db3" stroke-width="5"/>
        <path d="M-66 18 Q0 46 66 18 Q0 31 -66 18 Z" fill="#4a3566" stroke-width="4"/>
      </g>
      <path d="M-33 -56 L-36 -16 L-26 -14 L-22 -58 Z" fill="#fff" opacity=".2"/>
      <path d="M-35 -6 L-34 10 L-25 11 L-26 -4 Z" fill="#fff" opacity=".4"/>
      <path d="M22 -58 L26 12" stroke="#000" stroke-width="7" opacity=".18"/>`;
  }
  const hat = w => `<svg viewBox="-72 -80 144 116" width="${w}" height="${f1(w * 116 / 144)}" style="display:block;overflow:visible" aria-hidden="true">${hatG()}</svg>`;

  // ---------------------------------------------------------------- his glove: pinch at (0,0), fingers down, sleeve up (to -1500)
  function glove() {
    // back of the hand, fingers hanging down over the thing it holds (the thumb is behind it), sleeve up
    const fing = [[-40, 8], [-14, 20], [12, 18], [38, 4]].map(([x, len]) =>
      `<path d="M${x - 13} -96 V${len - 12} Q${x - 13} ${len + 2} ${x} ${len + 2} Q${x + 13} ${len + 2} ${x + 13} ${len - 12} V-96 Z" fill="#f4efe4" stroke="#000" stroke-width="5.5"/>
       <path d="M${x + 7} -80 V${len - 12}" stroke="#c9c2b2" stroke-width="6" opacity=".9"/>`).join('');
    return `<g stroke-linejoin="round" stroke-linecap="round">
      <path d="M-60 -1500 V-252 Q-60 -238 -46 -238 H46 Q60 -238 60 -252 V-1500 Z" fill="#3e2b58" stroke="#000" stroke-width="6"/>
      <path d="M-36 -1500 V-262" stroke="#6a4f8f" stroke-width="12" opacity=".7"/>
      <path d="M30 -1500 V-262" stroke="#1e1230" stroke-width="14" opacity=".6"/>
      <rect x="-66" y="-268" width="132" height="34" rx="7" fill="#ff4f9a" stroke="#000" stroke-width="6"/>
      <path d="M-56 -258 H40" stroke="#ffb3d3" stroke-width="5" opacity=".7"/>
      <path d="M-52 -236 L-66 -178 Q0 -166 66 -178 L52 -236 Z" fill="#f4efe4" stroke="#000" stroke-width="6"/>
      <path d="M-58 -206 Q0 -196 58 -206" stroke="#a9a192" stroke-width="3" fill="none" stroke-dasharray="7 6"/>
      <path d="M-66 -150 Q-92 -128 -88 -96 Q-86 -76 -70 -70" fill="#e6dfd0" stroke="#000" stroke-width="5.5"/>
      <path d="M-58 -182 H58 Q66 -182 66 -170 V-100 Q66 -84 50 -84 H-50 Q-66 -84 -66 -100 V-170 Q-66 -182 -58 -182 Z" fill="#f4efe4" stroke="#000" stroke-width="6"/>
      <path d="M40 -176 Q58 -150 54 -96" stroke="#c9c2b2" stroke-width="12" fill="none"/>
      ${fing}
      <path d="M-24 -168 V-120 M0 -170 V-120 M24 -168 V-120" stroke="#1b1712" stroke-width="6"/>
    </g>`;
  }

  // ---------------------------------------------------------------- the room
  // o: { lampX=960, lampTop, floor (y the cone reaches), spread (cone half-width at floor), shelfTop, shelfBot }
  function room(o = {}) {
    const lx = o.lampX ?? 960, top = o.lampTop ?? 250, bulb = top + 85, floor = o.floor ?? 760, sp = o.spread ?? 560;
    const sT = o.shelfTop ?? 110, sB = o.shelfBot ?? floor;
    // ledger shelves left and right, dim: spines in oxblood, bottle green, brown and his purple, gold bands
    const COLS = ['#3a1410', '#2a1e10', '#1d3a36', '#3e2b58', '#4a3208', '#2c1a0e'];
    const shelf = (x0, x1, seed) => {
      let s = `<rect x="${x0 - 14}" y="${sT - 20}" width="${x1 - x0 + 28}" height="${sB - sT + 20}" fill="#120904" stroke="#000" stroke-width="4"/>`;
      const rows = Math.max(1, Math.floor((sB - sT) / 170));
      const rh = (sB - sT) / rows;
      for (let r = 0; r < rows; r++) {
        const y1 = sT + (r + 1) * rh; let x = x0 + 4, i = 0;
        while (x < x1 - 20) {
          const k = seed + r * 31 + i * 7, w = 26 + Math.round(rnd(k) * 22), h = Math.round(rh * (.62 + rnd(k + 3) * .26)), lean = rnd(k + 5) < .08 && x < x1 - 70;
          if (x + w > x1 - 4) break;
          const c = COLS[Math.floor(rnd(k + 9) * COLS.length)];
          const g = `<rect x="0" y="${-h}" width="${w}" height="${h}" fill="${c}" stroke="#000" stroke-width="2.5"/><rect x="3" y="${-h + 12}" width="${w - 6}" height="5" fill="#8a6a10"/><rect x="3" y="-20" width="${w - 6}" height="5" fill="#8a6a10"/><rect x="${w / 2 - 6}" y="${-h / 2 - 12}" width="12" height="22" fill="#a57a22" opacity=".6"/>`;
          s += lean ? `<g transform="translate(${x + 8} ${f1(y1 - 8)}) rotate(14)">${g}</g>` : `<g transform="translate(${x} ${f1(y1 - 8)})">${g}</g>`;
          x += w + (lean ? 16 : 2); i++;
        }
        s += `<rect x="${x0 - 14}" y="${f1(y1 - 8)}" width="${x1 - x0 + 28}" height="14" fill="#2a1409" stroke="#000" stroke-width="3"/><rect x="${x0 - 14}" y="${f1(y1 - 8)}" width="${x1 - x0 + 28}" height="3" fill="#6a3a1a"/>`;
      }
      return s;
    };
    return `
      <div class="sg-layer" style="background:repeating-linear-gradient(90deg,#0c0a05 0 60px,#120e06 60px 62px)"></div>
      <div class="sg-layer mk-concrete" style="opacity:.16"></div>
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" class="sg-layer" style="opacity:.62" aria-hidden="true">
        ${o.shelves === false ? '' : shelf(40, 400, 11) + shelf(1520, 1880, 57)}
      </svg>
      <div class="sg-layer" style="background:radial-gradient(ellipse 46% 54% at ${lx}px ${f1(bulb + 180)}px,rgba(224,180,88,.2),rgba(4,4,4,.55) 62%,rgba(3,2,1,.86) 100%)"></div>
      ${o.lamp === false ? '' : `<div data-fx="beam" class="sg-layer" style="clip-path:polygon(${lx - 38}px ${bulb}px,${lx + 38}px ${bulb}px,${lx + sp}px ${floor}px,${lx - sp}px ${floor}px);background:linear-gradient(180deg,rgba(255,232,170,.2) ${bulb}px,rgba(255,200,90,.08) ${f1((bulb + floor) / 2)}px,rgba(255,190,80,.04) ${floor}px)"></div>
      <div class="sg-layer" style="left:${lx - 110}px;top:${bulb - 60}px;width:220px;height:130px;inset:auto;border-radius:50%;background:radial-gradient(ellipse closest-side,rgba(255,244,210,.5),rgba(255,200,90,.16) 50%,transparent)"></div>
      <div style="position:absolute;left:${lx - 80}px;top:${top}px;width:160px;height:96px;pointer-events:none">
        <svg viewBox="0 0 200 120" width="160" height="96" style="position:absolute;inset:0;overflow:visible" aria-hidden="true">
          <path d="M100 ${f1((o.cordTop ?? -40) - top) * 1.25} V44" stroke="#000" stroke-width="7"/><path d="M100 ${f1((o.cordTop ?? -40) - top) * 1.25} V44" stroke="#2c3033" stroke-width="3"/>
          <rect x="90" y="34" width="20" height="22" fill="#1a1e21" stroke="#000" stroke-width="3"/>
          <path d="M40 104 Q46 62 100 56 Q154 62 160 104 Z" fill="#1d3a36" stroke="#000" stroke-width="4"/>
          <path d="M54 94 Q60 70 98 64" stroke="#79ada3" stroke-width="4" fill="none" opacity=".55"/>
          <path d="M40 104 Q100 98 160 104" stroke="#000" stroke-width="6" fill="none"/>
          <ellipse cx="100" cy="106" rx="50" ry="8" fill="#fff6e2"/><ellipse cx="100" cy="104" rx="24" ry="5" fill="#ffffff"/>
        </svg>
      </div>`}`;
  }

  // ---------------------------------------------------------------- the counter: leather top (back..front), brass rail, mahogany front
  function counter(o = {}) {
    const back = o.back ?? 700, front = o.front ?? 820, lx = o.lampX ?? 960, inset = o.inset ?? 160;
    const panels = [[40, 420], [460, 1000], [1040, 1460], [1500, 1880]].map(([a, b]) => `
      <rect x="${a}" y="${front + 44}" width="${b - a}" height="${1080 - front - 20}" fill="url(#sg-wood-panel)" stroke="#000" stroke-width="3"/>
      <path d="M${a + 4} ${front + 48} H${b - 4}" stroke="#5a2e14" stroke-width="3"/>`).join('');
    return `<svg viewBox="0 0 1920 1080" width="1920" height="1080" class="sg-layer" aria-hidden="true">
      <defs><radialGradient id="sg-pool" cx="${lx}" cy="${f1(back + (front - back) * .45)}" r="620" gradientUnits="userSpaceOnUse" gradientTransform="translate(${lx} ${f1(back + (front - back) * .45)}) scale(1 .32) translate(${-lx} ${-f1(back + (front - back) * .45)})">
        <stop offset="0" stop-color="#ffd98a" stop-opacity=".42"/><stop offset=".4" stop-color="#e0a050" stop-opacity=".16"/><stop offset="1" stop-color="#e0a050" stop-opacity="0"/></radialGradient></defs>
      <path d="M${inset} ${back} H${1920 - inset} L1960 ${front} H-40 Z" fill="url(#sg-leather)" stroke="#000" stroke-width="4"/>
      <path d="M${inset + 34} ${back + 12} H${1920 - inset - 34} L${1920 - 40} ${front - 14} H40 Z" fill="none" stroke="#a57a22" stroke-width="3" opacity=".55" stroke-dasharray="14 5"/>
      <path d="M${inset} ${back} H${1920 - inset} L1960 ${front} H-40 Z" fill="url(#sg-pool)"/>
      <path d="M${inset} ${back} H${1920 - inset}" stroke="#000" stroke-width="10" opacity=".6"/>
      <rect x="-10" y="${front - 4}" width="1940" height="${1080 - front + 10}" fill="url(#sg-wood)" stroke="#000" stroke-width="4"/>
      ${panels}
      <rect x="-10" y="${front - 6}" width="1940" height="20" fill="url(#sg-brass-h)" stroke="#000" stroke-width="3"/>
      <path d="M-10 ${front + 16} H1930" stroke="#000" stroke-width="8" opacity=".6"/>
      <g stroke="#000" stroke-width="2.5">${[240, 730, 1250, 1690].map(x => `<circle cx="${x}" cy="${front + 4}" r="5" fill="#fff0b0"/>`).join('')}</g>
    </svg>`;
  }

  // ---------------------------------------------------------------- props (Penny's ledger and coin stacks)
  const LEDGER_LINES = [0, 1, 2, 3, 4, 5].flatMap(j => [`M${f1(18 + j * -1.6)} ${66 + j * 16} L152 ${58 + j * 16}`, `M184 ${58 + j * 16} L${f1(326 + j * 1.8)} ${68 + j * 16}`]).slice(0, 11);
  function ledgerG(quill = true) {
    return `<ellipse cx="170" cy="170" rx="200" ry="22" fill="#000" opacity=".5"/>
      <path d="M-6 50 L168 26 L346 50 L358 172 L168 160 L-18 172 Z" fill="#3a1410" stroke="#000" stroke-width="4" stroke-linejoin="round"/>
      <path d="M8 54 L166 36 L166 154 L-4 164 Z" fill="#e8dcc0"/>
      <path d="M170 36 L332 54 L344 164 L170 154 Z" fill="#d6c8a8"/>
      <path d="M168 34 V156" stroke="#6a5a40" stroke-width="3"/>
      <g stroke="#4a3208" stroke-width="3.2" stroke-linecap="round" opacity=".7" stroke-dasharray="16 6 26 7 10 5">${LEDGER_LINES.map(d => `<path d="${d}"/>`).join('')}</g>
      <path d="M190 128 L324 138" stroke="#b01e10" stroke-width="3" opacity=".8"/>
      ${quill ? `<path d="M240 156 L256 140 Q330 62 396 26 Q354 92 266 152 Z" fill="#f1e8d4" stroke="#1b1712" stroke-width="3" stroke-linejoin="round"/><path d="M232 164 L380 40" stroke="#1b1712" stroke-width="2.5"/>` : ''}`;
  }
  const ledger = (x, y, k, quill) => `<g transform="translate(${x} ${y}) scale(${k})">${ledgerG(quill)}</g>`;
  const STACKS = [{ dx: 40, dy: -26, n: 6 }, { dx: 118, dy: -34, n: 10 }, { dx: 196, dy: -18, n: 4 }, { dx: 84, dy: 4, n: 3 }, { dx: 170, dy: 12, n: 1 }];
  function stackG(s) {
    return Array.from({ length: s.n }, (_, j) => `<ellipse cx="${s.dx}" cy="${s.dy - j * 9 + 7}" rx="34" ry="10" fill="#5a4400" stroke="#1e1500" stroke-width="2"/><ellipse cx="${s.dx}" cy="${s.dy - j * 9}" rx="34" ry="10" fill="url(#sg-brass-h)" stroke="#3a2c00" stroke-width="2"/>`).join('');
  }
  // each stack in its own <g data-fx="stack"> so a board can make them jump
  const stacks = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="110" cy="10" rx="150" ry="20" fill="#000" opacity=".5"/>${STACKS.map(s => `<g data-fx="stack" style="transform-box:fill-box;transform-origin:50% 100%">${stackG(s)}</g>`).join('')}</g>`;
  const inkwell = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">
      <ellipse cx="0" cy="4" rx="54" ry="12" fill="#000" opacity=".5"/>
      <path d="M-40 0 L-34 -52 Q0 -62 34 -52 L40 0 Q0 10 -40 0 Z" fill="#101a1c" stroke="#000" stroke-width="4"/>
      <path d="M-28 -46 L-26 -8" stroke="#79ada3" stroke-width="5" opacity=".45"/>
      <rect x="-18" y="-72" width="36" height="20" rx="3" fill="url(#sg-brass-h)" stroke="#000" stroke-width="3"/>
      <path d="M4 -70 Q30 -150 92 -200 Q60 -130 14 -66 Z" fill="#f1e8d4" stroke="#1b1712" stroke-width="3" stroke-linejoin="round"/>
      <path d="M2 -60 L84 -190" stroke="#1b1712" stroke-width="2.5"/></g>`;

  // ---------------------------------------------------------------- the sting
  const sting = () => `<div data-fx="stStatic" class="sg-static"><i data-fx="stNoise"></i></div><div data-fx="stHumbug" class="sg-humbug">BAH, HUMBUG!</div>`;

  // ---------------------------------------------------------------- a big polaroid
  function polaroid(p) {
    const F = window.MachineKit.FACE;
    return `<div class="sg-ph"><svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${p.bg}"/>
      <path d="${F.body}" fill="#15120f"/><path d="${F.collar}" fill="#d8cfbd"/><path d="${F.head}" fill="${p.skin}"/><path d="${F.hair}" fill="${p.hair}"/><path d="${F.eyes}" fill="#1b1712" opacity=".8"/></svg></div>
      <div class="sg-nm" style="font-size:${p.fs || 58}px;line-height:.92;text-align:center">${p.name}</div>`;
  }

  function fill(map) {
    for (const [k, html] of Object.entries(map)) document.querySelectorAll(`[data-sg="${k}"]`).forEach(el => { el.innerHTML = html; });
  }

  // ---------------------------------------------------------------- the one-shot timeline (Penny's tl): keyframes at absolute ms
  // frames: [[ms, {props}, easing?], ...]. Plays once over P ms and HOLDS (fill both). replay=true loops with a rest.
  // ?t=<ms> pauses everything at that moment (for stills).
  function timeline(comp, P) {
    const replay = comp.props.replay === true, D = replay ? P + 1600 : P, A = [];
    const tl = (el, frames) => {
      if (!el) return;
      const kf = frames.map(([t, p, e]) => ({ ...p, offset: Math.min(1, Math.max(0, t / D)), ...(e ? { easing: e } : {}) }));
      if (kf[0].offset > 0) kf.unshift({ ...frames[0][1], offset: 0 });
      if (kf[kf.length - 1].offset < 1) kf.push({ ...frames[frames.length - 1][1], offset: 1 });
      A.push(el.animate(kf, { duration: D, iterations: replay ? Infinity : 1, fill: 'both' }));
    };
    const seek = () => { const t = comp.props.t; if (typeof t === 'number') A.forEach(a => { a.pause(); a.currentTime = Math.min(t, D - 1); }); };
    return { tl, A, seek };
  }
  // the shared opening: static (0-420, stepped) and "BAH, HUMBUG!", then the lights come up gold (the stage, 380-730)
  function stingTimeline(tl, q) {
    tl(q('stStatic')[0], [[0, { opacity: 1 }], [290, { opacity: 1 }, 'steps(1,end)'], [300, { opacity: .6 }, 'steps(1,end)'], [360, { opacity: .9 }, 'steps(1,end)'], [420, { opacity: 0 }]]);
    tl(q('stNoise')[0], [0, 70, 140, 210, 280, 350].map((t, i) => [t, { transform: `translate(${[0, 60, -40, 90, -70, 30][i]}px,${[0, -50, 70, 20, -80, 40][i]}px)` }, 'steps(1,end)']));
    tl(q('stHumbug')[0], [[0, { opacity: 1, transform: 'skewX(-10deg)' }, 'steps(1,end)'], [120, { opacity: 1, transform: 'skewX(8deg) translateX(20px)' }, 'steps(1,end)'], [240, { opacity: 1, transform: 'skewX(-4deg) translateX(-14px)' }, 'steps(1,end)'], [360, { opacity: 1, transform: 'scale(1.2)' }, 'steps(1,end)'], [480, { opacity: 0, transform: 'scale(1.3)' }]]);
    tl(q('stage')[0], [[0, { opacity: 0 }], [380, { opacity: 0 }, 'ease-out'], [730, { opacity: 1 }]]);
  }
  const POP = (t, d = 520) => [[t, { opacity: 0, transform: 'scale(.2) rotate(-12deg)' }, 'cubic-bezier(.3,1.5,.5,1)'], [t + d * .6, { opacity: 1, transform: 'scale(1.18) rotate(4deg)' }], [t + d * .8, { opacity: 1, transform: 'scale(.95) rotate(-2deg)' }], [t + d, { opacity: 1, transform: 'none' }]];
  // a marker stamp: slams from big, keeps its own base rotation r
  const STAMP = (t, r, d = 240) => [[t, { opacity: 0, transform: `rotate(${r}deg) scale(1.8)` }, 'cubic-bezier(.3,1.4,.5,1)'], [t + d, { opacity: 1, transform: `rotate(${r}deg) scale(1)` }]];

  // ---------------------------------------------------------------- his handwriting: single-stroke marker capitals
  // Glyphs on a cap height of 10 units, y down; w = advance width. Strokes are drawn in order (stroke-dashoffset).
  const GL = {
    A: [7, 'M0 10 L3.5 0 L7 10', 'M1.4 6.3 H5.6'], B: [6.5, 'M0 10 V0 H3.4 Q6 0 6 2.5 Q6 5 3.4 5 H0', 'M0 5 H3.8 Q6.5 5 6.5 7.5 Q6.5 10 3.8 10 H0'],
    C: [6.5, 'M6.5 1.5 Q5 0 3.5 0 Q0 0 0 5 Q0 10 3.5 10 Q5 10 6.5 8.5'], D: [6.5, 'M0 10 V0 H2.4 Q6.5 0 6.5 5 Q6.5 10 2.4 10 H0'],
    E: [5.5, 'M5.5 0 H0 V10 H5.5', 'M0 5 H4.4'], F: [5.5, 'M5.5 0 H0 V10', 'M0 5 H4.4'],
    G: [7, 'M6.5 1.5 Q5 0 3.5 0 Q0 0 0 5 Q0 10 3.5 10 Q7 10 7 5.6 H4'], H: [6.5, 'M0 0 V10', 'M6.5 0 V10', 'M0 5 H6.5'],
    I: [1.6, 'M0.8 0 V10'], J: [5, 'M5 0 V7 Q5 10 2.5 10 Q0 10 0 7.5'], K: [6, 'M0 0 V10', 'M6 0 L0 6', 'M2 4.2 L6 10'],
    L: [5, 'M0 0 V10 H5'], M: [8, 'M0 10 V0 L4 7 L8 0 V10'], N: [6.5, 'M0 10 V0 L6.5 10 V0'],
    O: [7.5, 'M3.75 0 Q0 0 0 5 Q0 10 3.75 10 Q7.5 10 7.5 5 Q7.5 0 3.75 0'], P: [6, 'M0 10 V0 H3.4 Q6 0 6 2.75 Q6 5.5 3.4 5.5 H0'],
    Q: [7.5, 'M3.75 0 Q0 0 0 5 Q0 10 3.75 10 Q7.5 10 7.5 5 Q7.5 0 3.75 0', 'M4.6 7 L7.6 10.6'], R: [6.2, 'M0 10 V0 H3.4 Q6 0 6 2.75 Q6 5.5 3.4 5.5 H0', 'M3 5.5 L6.2 10'],
    S: [6, 'M6 1.5 Q5 0 3 0 Q0 0 0 2.6 Q0 5 3 5 Q6 5 6 7.5 Q6 10 3 10 Q1 10 0 8.5'], T: [6.5, 'M0 0 H6.5', 'M3.25 0 V10'],
    U: [6.5, 'M0 0 V6.5 Q0 10 3.25 10 Q6.5 10 6.5 6.5 V0'], V: [7, 'M0 0 L3.5 10 L7 0'], W: [9.5, 'M0 0 L2.3 10 L4.75 2.6 L7.2 10 L9.5 0'],
    X: [6.5, 'M0 0 L6.5 10', 'M6.5 0 L0 10'], Y: [7, 'M0 0 L3.5 5 L7 0', 'M3.5 5 V10'], Z: [6.5, 'M0 0 H6.5 L0 10 H6.5'],
    0: [6, 'M3 0 Q0 0 0 5 Q0 10 3 10 Q6 10 6 5 Q6 0 3 0'], 1: [3.4, 'M0 2 L2.6 0 V10'], 2: [6, 'M0 2 Q0.5 0 3 0 Q6 0 6 2.8 Q6 5 0 10 H6'],
    3: [6.2, 'M0 1.2 Q1 0 3 0 Q5.8 0 5.8 2.5 Q5.8 5 2.6 5 Q6.2 5 6.2 7.5 Q6.2 10 3 10 Q1 10 0 8.8'], 4: [6.5, 'M5 10 V0 L0 7 H6.5'],
    5: [6, 'M5.8 0 H0.8 L0.3 4.6 Q1.5 4 3 4 Q6 4 6 7 Q6 10 3 10 Q1 10 0 8.8'], 6: [6, 'M5.5 0.8 Q4.5 0 3 0 Q0 0 0 5.5 Q0 10 3 10 Q6 10 6 7 Q6 4.2 3 4.2 Q0.8 4.2 0 6'],
    7: [6, 'M0 0 H6 L2 10'], 8: [6, 'M3 5 Q0.3 5 0.3 2.5 Q0.3 0 3 0 Q5.7 0 5.7 2.5 Q5.7 5 3 5 Q0 5 0 7.5 Q0 10 3 10 Q6 10 6 7.5 Q6 5 3 5'],
    9: [6, 'M6 4 Q5.2 5.8 3 5.8 Q0 5.8 0 3 Q0 0 3 0 Q6 0 6 4.5 Q6 10 3 10 Q1.5 10 0.5 9.2'],
    '!': [1.6, 'M0.8 0 V6.6', 'M0.8 9.5 V10'], '?': [5.5, 'M0 1.8 Q0.8 0 2.8 0 Q5.5 0 5.5 2.6 Q5.5 4.6 2.8 5.5 V7', 'M2.8 9.5 V10'],
    '.': [1.6, 'M0.8 9.5 V10'], ',': [1.6, 'M1.1 9.3 L0.4 11.2'], "'": [1.6, 'M0.8 0 V2.6'], '-': [4, 'M0 5.5 H4'],
    '&': [6.5, 'M6.5 10 L1.3 3.8 Q0.4 2.7 0.6 1.6 Q1 0 2.6 0 Q4.3 0 4.4 1.6 Q4.6 3.2 2.6 4.6 L0.9 6 Q0 6.9 0 8 Q0 10 2.4 10 Q4.4 10 6.3 6.4'],
    '+': [5, 'M2.5 2.5 V7.5', 'M0 5 H5'], '#': [6.5, 'M2 0 L1.2 10', 'M5.3 0 L4.5 10', 'M0 3.3 H6.5', 'M0 6.7 H6.5'],
    ':': [1.6, 'M0.8 3.1 V3.6', 'M0.8 9.5 V10'], '/': [5, 'M5 -0.3 L0 10.3'], '(': [3, 'M3 -0.6 Q0 2 0 5 Q0 8 3 10.6'], ')': [3, 'M0 -0.6 Q3 2 3 5 Q3 8 0 10.6'],
    '%': [7, 'M6.6 0 L0.4 10', 'M1.5 0.2 Q0 0.2 0 1.9 Q0 3.6 1.5 3.6 Q3 3.6 3 1.9 Q3 0.2 1.5 0.2', 'M5.5 6.4 Q4 6.4 4 8.1 Q4 9.8 5.5 9.8 Q7 9.8 7 8.1 Q7 6.4 5.5 6.4'],
    '"': [3.4, 'M0.8 0 V2.8', 'M2.6 0 V2.8'],
    '£': [6, 'M5.6 1.3 Q4.8 0 3.4 0 Q1.4 0 1.4 2.4 V8.4 Q1.4 9.6 0 10 H6', 'M0 5.4 H4'],
  };
  // parse a glyph stroke into its points (absolute M/L/H/V/Q only) -> for drips and bounds
  const pts = d => { const t = d.match(/[MLHVQZ]|-?[\d.]+/g), P = []; let i = 0, c = '', x = 0, y = 0; const n = () => +t[i++];
    while (i < t.length) { if (/[A-Z]/.test(t[i])) c = t[i++]; if (c === 'M' || c === 'L') { x = n(); y = n(); } else if (c === 'H') x = n(); else if (c === 'V') y = n(); else if (c === 'Q') { n(); n(); x = n(); y = n(); } else break; P.push([x, y]); } return P; };
  
  // what the phone may send -> what his hand can write: accents stripped (NFD minus combining marks), curly quotes and dashes straightened
  const normalise = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201a\u2032`\u00b4]/g, "'").replace(/[\u201c\u201d\u201e\u2033]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...').replace(/\u00df/g, 'SS').replace(/[\u00c6\u00e6]/g, 'AE').replace(/[\u00d8\u00f8]/g, 'O')
    .toUpperCase().replace(/\s+/g, ' ').trim();

  // write(text, {w, h, maxCap, minCap, sign}) -> { cap, glyphs:[{tf, strokes:[d]}], drips:[{x,y}], lines } in box px (0,0 top-left)
  function write(text, box) {
    const SP = 5.6, GAP = 2.1, LG = 4.2;
    const clean = normalise(text);
    const words = clean.split(' ').filter(Boolean);
    // anything still without a glyph (emoji, other scripts) -> the board falls back to a Permanent Marker wipe of the raw text
    const unsupported = !words.length || [...clean].some(ch => ch !== ' ' && !GL[ch]);
    if (unsupported) return { fallback: true, raw: String(text || '').trim() || '…', cap: 0, glyphs: [], sig: { tf: '', strokes: [] }, lines: 0 };
    const wW = w => [...w].reduce((s, ch, i) => s + GL[ch][0] + (i ? GAP : 0), 0);
    const lineW = ws => ws.reduce((s, w, i) => s + wW(w) + (i ? SP : 0), 0);
    // best split into 1-3 lines: the one that gives the biggest cap height
    const fitCap = ls => 10 * Math.min(box.w / Math.max(...ls.map(lineW)), box.h / (ls.length * 10 + (ls.length - 1) * LG + 3));   // cap height in px
    // every split into 1-3 lines; keep the fewest lines that reach 95% of the biggest possible size, then the most even lines
    const split = (ws, k) => { if (k === 1) return [[ws]]; const out = []; for (let i = 1; i <= ws.length - k + 1; i++) split(ws.slice(i), k - 1).forEach(r => out.push([ws.slice(0, i), ...r])); return out; };
    const cands = [1, 2, 3].filter(n => words.length >= n).flatMap(n => split(words, n)).map(ls => ({ ls, c: fitCap(ls), spread: Math.max(...ls.map(lineW)) - Math.min(...ls.map(lineW)) }));
    const top = Math.max(...cands.map(c => c.c)), ok = cands.filter(c => c.c >= top * .95), nMin = Math.min(...ok.map(c => c.ls.length));
    const best = ok.filter(c => c.ls.length === nMin).sort((x, y) => x.spread - y.spread)[0].ls;
    const cap = Math.max(box.minCap || 40, Math.min(box.maxCap || 130, fitCap(best)));
    const s = cap / 10, lines = best.length, totalH = (lines * 10 + (lines - 1) * LG + 3) * s, glyphs = [];
    let gi = 0;
    best.forEach((ws, li) => {
      let x = (box.w - lineW(ws) * s) / 2; const y = (box.h - totalH) / 2 + li * (10 + LG) * s;
      ws.forEach((w, wi) => {
        if (wi) x += SP * s;
        [...w].forEach((ch, ci) => {
          if (ci) x += GAP * s;
          const [adv, ...strokes] = GL[ch], k = gi * 3 + 17, r = f1((rnd(k) - .5) * 7), dy = f1((rnd(k + 1) - .5) * .9 * s);
          glyphs.push({ ch, tf: `translate(${f1(x)} ${f1(y + dy)}) rotate(${r} ${f1(adv * s / 2)} ${f1(5 * s)}) scale(${f1(s * 100) / 100}) skewX(-7)`, strokes, x, y: y + dy, adv: adv * s });
          // a drip hangs off some letters' feet, drawn in the glyph's own units so it stays attached to the stroke
          let drip = null;
          if (strokes.length && gi % 3 === 1) {
            const feet = strokes.flatMap(pts).filter(p => p[1] >= 9.8).sort((a, b) => Math.abs(a[0] - adv / 2) - Math.abs(b[0] - adv / 2));
            if (feet[0]) drip = { x: f1(feet[0][0] - .45), y: 9.2, w: .9, h: f1(2.2 + rnd(k + 2) * 2.4) };
          }
          glyphs[glyphs.length - 1].drip = drip;
          x += adv * s; gi++;
        });
      });
    });
    // his flourish: one underline swoosh under the last line, with a hook back at the end
    const last = best[best.length - 1], W = lineW(last), lastX = (box.w - W * s) / 2, lastY = (box.h - totalH) / 2 + (lines - 1) * (10 + LG) * s;
    const sig = { tf: `translate(${f1(lastX)} ${f1(lastY + 12 * s)}) scale(${f1(s * 100) / 100})`,
      strokes: [`M-0.5 0.9 Q${f1(W * .45)} -0.7 ${f1(W + .5)} 0.1 Q${f1(W + 2.6)} 0.3 ${f1(W - 1.8)} 1.9`] };
    return { fallback: false, cap: f1(cap), glyphs, sig, lines };
  }

  window.ScroogeKit = { normalise, defs, hat, hatG, glove, room, counter, ledger, stacks, inkwell, sting, polaroid, fill, timeline, stingTimeline, POP, STAMP, write, GL, rnd, f1 };
})();
