// shoot-at.mjs FILE OUT WxH [query]
// Like shoot.mjs, but at any viewport size (for the 1366×768 and 4:3 checks of the TV board).
// BASE defaults to the mockup server on :8765. Serve the REPO ROOT instead (python -m http.server 8766)
// and set BASE=http://127.0.0.1:8766/design/mockups/ so /public/textures/* resolve too.
import { chromium } from 'playwright';
const [,, file, out, size = '1920x1080', query = ''] = process.argv;
const [width, height] = size.split('x').map(Number);
const base = process.env.BASE || 'http://localhost:8765/';
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width, height } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('requestfailed', r => console.log('FAILED', r.url()));
await p.goto(base + file + (query ? '?' + query : ''));
await p.waitForSelector('body[data-ready]', { timeout: 20000 }).catch(() => console.log('no ready'));
await p.waitForTimeout(700);
await p.screenshot({ path: out });
await b.close();
