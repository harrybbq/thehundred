import { chromium } from 'playwright';
const [,, file, out, query = '', clip] = process.argv;
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://localhost:8765/' + file + (query ? '?' + query : ''));
await p.waitForSelector('body[data-ready]', { timeout: 20000 }).catch(() => console.log('no ready'));
await p.waitForTimeout(500);
const opt = { path: out };
if (clip) { const [x, y, w, h] = clip.split(',').map(Number); opt.clip = { x, y, width: w, height: h }; }
await p.screenshot(opt);
await b.close();
