// Imperative screen effects shared by the TV and phones: confetti canvas,
// banners, toasts, floating reactions, beer bubbles. Ported from v1.
import { rand } from '../lib/util';

// ---------- confetti ----------
type Part = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; age: number; c: string; s: number; shape: string; txt?: string };
let cv: HTMLCanvasElement | null = null, cx: CanvasRenderingContext2D | null = null;
let parts: Part[] = [], running = false, dpr = 1;
const PARTY = ['#ff2d95', '#22e6ff', '#ffb627', '#b04dff', '#39ff88', '#ffffff'];

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'fx-canvas';
  document.body.appendChild(cv);
  cx = cv.getContext('2d');
  const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); cv!.width = innerWidth * dpr; cv!.height = innerHeight * dpr; };
  resize(); addEventListener('resize', resize);
}
function add(p: Part) { ensure(); parts.push(p); if (!running) { running = true; requestAnimationFrame(loop); } }
function heart(s: number) {
  cx!.beginPath(); cx!.moveTo(0, s * 0.3);
  cx!.bezierCurveTo(-s, -s * 0.4, -s * 0.4, -s, 0, -s * 0.35);
  cx!.bezierCurveTo(s * 0.4, -s, s, -s * 0.4, 0, s * 0.3); cx!.fill();
}
function loop() {
  const c = cx!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.age < p.life && p.y < innerHeight + 80);
  for (const p of parts) {
    p.age++; p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = Math.min(1, (p.life - p.age) / 30); c.fillStyle = p.c;
    if (p.shape === 'heart') heart(p.s);
    else if (p.shape === 'cross') { c.fillRect(-p.s / 2, -p.s / 6, p.s, p.s / 3); c.fillRect(-p.s / 6, -p.s / 2, p.s / 3, p.s); }
    else if (p.shape === 'emoji') { c.font = `${p.s}px sans-serif`; c.textAlign = 'center'; c.fillText(p.txt!, 0, 0); }
    else { c.scale(1, Math.cos(p.age * 0.15)); c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
    c.restore();
  }
  if (parts.length) requestAnimationFrame(loop); else { running = false; c.clearRect(0, 0, innerWidth, innerHeight); }
}
export function burst(x: number, y: number, o: { count?: number; colors?: string[]; speed?: number; spread?: number; angle?: number; shape?: string; size?: number; txt?: string } = {}) {
  const { count = 120, colors = PARTY, speed = 14, spread = Math.PI * 2, angle = -Math.PI / 2, shape = 'rect', size = 12, txt } = o;
  for (let i = 0; i < count; i++) {
    const a = angle + rand(-spread / 2, spread / 2), v = rand(speed * 0.35, speed);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, 6), vr: rand(-0.3, 0.3), life: rand(90, 160), age: 0, c: colors[i % colors.length], s: rand(size * 0.5, size), shape, txt });
  }
}
export function rain(count = 220, colors = PARTY) {
  for (let i = 0; i < count; i++)
    add({ x: rand(0, innerWidth), y: rand(-innerHeight * 0.6, -20), vx: rand(-2, 2), vy: rand(2, 7), rot: rand(0, 6), vr: rand(-0.2, 0.2), life: 400, age: 0, c: colors[i % colors.length], s: rand(8, 16), shape: 'rect' });
}
export function centerOf(el: Element | null): [number, number] {
  if (!el) return [innerWidth / 2, innerHeight / 2];
  const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
}

// ---------- banner ----------
export function showBanner({ title, sub = '', color = 'var(--amber)', hold = 3, img }: { title: string; sub?: string; color?: string; hold?: number; img?: string | null }) {
  let layer = document.getElementById('bannerLayer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'bannerLayer'; document.body.appendChild(layer); }
  layer.innerHTML = '';
  const b = document.createElement('div');
  b.className = 'banner';
  b.style.setProperty('--c', color); b.style.setProperty('--hold', hold + 's');
  if (img) { const i = document.createElement('img'); i.src = img; i.className = 'banner-img'; b.appendChild(i); }
  const t = document.createElement('div'); t.className = 'banner-title'; t.textContent = title; b.appendChild(t);
  if (sub) { const s = document.createElement('div'); s.className = 'banner-sub'; s.textContent = sub; b.appendChild(s); }
  b.addEventListener('animationend', e => { if ((e as AnimationEvent).animationName === 'bannerOut') b.remove(); });
  layer.appendChild(b);
  return new Promise<void>(r => setTimeout(r, hold * 1000 + 500));
}

// ---------- toast ----------
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, ms = 2800) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t!.classList.remove('show'), ms);
}

// ---------- floating reactions ----------
export function floatEmoji(e: string) {
  const el = document.createElement('div');
  el.className = 'react-float';
  el.textContent = e;
  el.style.left = rand(4, 92) + 'vw';
  el.style.setProperty('--dx', rand(-60, 60) + 'px');
  el.style.setProperty('--d', rand(2.6, 4) + 's');
  el.addEventListener('animationend', () => el.remove());
  document.body.appendChild(el);
}

// ---------- beer bubbles from an element ----------
export function bubblesFrom(el: Element | null, label = '+1') {
  if (!el) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 16; i++) {
    const s = rand(10, 34), b = document.createElement('span');
    b.className = 'bubble';
    b.style.cssText = `width:${s}px;height:${s}px;left:${r.left + rand(0, r.width)}px;top:${r.top + r.height / 2}px;--d:${rand(0.9, 1.8)}s;--dx:${rand(-40, 40)}px;--dy:${-rand(120, 360)}px`;
    b.addEventListener('animationend', () => b.remove());
    document.body.appendChild(b);
  }
  const f = document.createElement('div');
  f.className = 'plus-float'; f.textContent = label;
  f.style.left = `${r.left + r.width * rand(0.3, 0.7)}px`; f.style.top = `${r.top}px`;
  f.addEventListener('animationend', () => f.remove());
  document.body.appendChild(f);
}

export function restartAnim(el: Element | null | undefined, cls: string) {
  if (!el) return;
  el.classList.remove(cls); void (el as HTMLElement).offsetWidth; el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}
