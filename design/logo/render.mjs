// Renders the favicon PNGs from the SVG masters with Playwright + local Chrome.
// Needs the repo served on :8766 (python -m http.server 8766 from the repo root).
//   node design/logo/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:8766/design/logo/';
const jobs = [
  // [output, source svg, size, opaque background?]
  ['favicon-16.png', 'favicon-16.svg', 16, false], // hand-tuned pixel master
  ['favicon-32.png', 'favicon.svg', 32, false],
  ['apple-touch-icon.png', 'favicon.svg', 180, true], // iOS wants no transparency
  ['icon-192.png', 'favicon.svg', 192, false],
  ['icon-512.png', 'favicon.svg', 512, false],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(base);
for (const [out, src, size, opaque] of jobs) {
  // Opaque: fill behind the rounded plate with the plate's own gradient so the corners vanish.
  const bg = opaque ? 'linear-gradient(#1a2226,#07090b)' : 'transparent';
  await page.setContent(`<style>html,body{margin:0;background:transparent}
    #box{width:${size}px;height:${size}px;background:${bg}}
    img{display:block;width:${size}px;height:${size}px;image-rendering:${size <= 16 ? 'pixelated' : 'auto'}}</style>
    <div id="box"><img src="${base}${src}"></div>`);
  await page.waitForFunction(() => document.querySelector('img').complete);
  await page.locator('#box').screenshot({ path: path.join(here, out), omitBackground: !opaque });
  console.log('wrote', out);
}
await browser.close();
