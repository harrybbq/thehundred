// One scaling model for the whole TV, whatever the laptop's CSS viewport (1280×720 at 150% Windows scaling up to
// 4K) and however much the TV overscans.
//
//  • The safe area: the host picks a TV EDGE MARGIN (OFF / SMALL / LARGE = 0 / 3 / 5 vmin, SETUP → ROOM, saved in
//    localStorage). Nothing that matters is drawn inside it.
//  • Fixed stages (the Trial, the Jester, the mini-games, the film scenes, Announce, NOW PLAYING) are laid out once at
//    1920×1080 and scaled by fitScale(): the viewport minus the margin on every side.
//  • Everything else that used to be sized in vh/vw/px (the lobby, the generic modals, the case file, banners, the
//    host's room picker) is laid out in 1920×1080 "stage pixels" and put on the same scale with CSS `zoom:var(--tv-z)`.
//    A zoomed `position:fixed; inset:0` layer still covers the screen, at a logical size of --tv-lw × --tv-lh, so on a
//    16:10 laptop those layouts get the extra height instead of letterboxing. (Inside a zoomed element vh/vw are
//    multiplied by the zoom too, so zoomed CSS uses px and these variables, never vh/vw.)
//
// Root variables (written on <html> by applyTvStage):
//   --safe       the margin as a length (e.g. 3vmin), for unzoomed CSS
//   --tv-safe    the margin in device px
//   --tv-z       the zoom that puts a 1920×1080 stage inside the safe area
//   --tv-safe-z  the margin in stage px (for padding inside a zoomed layer)
//   --tv-lw/lh   the whole viewport in stage px
import { useEffect, useLayoutEffect, useState } from 'react';

export const STAGE_W = 1920, STAGE_H = 1080;
export type EdgeMargin = 'off' | 'small' | 'large';
export const EDGE_MARGINS: { id: EdgeMargin; label: string; vmin: number }[] = [
  { id: 'off', label: 'OFF', vmin: 0 }, { id: 'small', label: 'SMALL', vmin: 3 }, { id: 'large', label: 'LARGE', vmin: 5 },
];
const KEY = 'thehundred-tv-edge';
const EVT = 'tv-stage';
let margin: EdgeMargin | null = null;

export function getEdgeMargin(): EdgeMargin {
  if (margin) return margin;
  let v: string | null = null;
  try { v = localStorage.getItem(KEY); } catch { /* private window: default */ }
  margin = v === 'off' || v === 'small' || v === 'large' ? v : 'small';
  return margin;
}
export function setEdgeMargin(m: EdgeMargin) {
  margin = m;
  try { localStorage.setItem(KEY, m); } catch { /* not saved: still applies this session */ }
  applyTvStage();
  dispatchEvent(new Event(EVT));
}
const marginVmin = () => EDGE_MARGINS.find(x => x.id === getEdgeMargin())!.vmin;
/** The safe margin in device px. */
export const safePx = () => marginVmin() * Math.min(innerWidth, innerHeight) / 100;

/** The scale that fits a w×h stage inside the viewport minus the safe margin (fw/fh: use only that share of it). */
export function fitScale(w = STAGE_W, h = STAGE_H, fw = 1, fh = 1) {
  const s = safePx();
  return Math.max(0.05, Math.min(((innerWidth - 2 * s) * fw) / w, ((innerHeight - 2 * s) * fh) / h));
}

export function applyTvStage() {
  const r = document.documentElement.style, s = safePx(), z = fitScale();
  r.setProperty('--safe', marginVmin() + 'vmin');
  r.setProperty('--tv-safe', s.toFixed(2) + 'px');
  r.setProperty('--tv-z', z.toFixed(5));
  r.setProperty('--tv-safe-z', (s / z).toFixed(2) + 'px');
  r.setProperty('--tv-lw', (innerWidth / z).toFixed(2) + 'px');
  r.setProperty('--tv-lh', (innerHeight / z).toFixed(2) + 'px');
  // the stages are drawn at 1920×1080 and scaled: past 1.25 device pixels per stage pixel (a 4K TV, or a laptop at
  // 150% scaling on 1080p) the 1x sea and wood tiles go soft, so the @2x bakes take over (src/lib/textures.ts)
  document.documentElement.classList.toggle('tex-2x', (devicePixelRatio || 1) * z > 1.25);
}

/** Call once at the top of the TV app: keeps the root variables in step with the window and the margin setting. */
export function useTvStage() {
  useLayoutEffect(() => {   // before the first paint, so nothing draws one frame at the unscaled size
    const html = document.documentElement;
    html.classList.add('tv-root');
    applyTvStage();
    addEventListener('resize', applyTvStage);
    return () => { removeEventListener('resize', applyTvStage); html.classList.remove('tv-root'); };
  }, []);
}

/** A live fitScale() for components that scale a fixed stage with a transform. */
export function useFitScale(w = STAGE_W, h = STAGE_H, fw = 1, fh = 1) {
  const [scale, setScale] = useState(() => fitScale(w, h, fw, fh));
  useEffect(() => {
    const fit = () => setScale(fitScale(w, h, fw, fh));
    fit(); addEventListener('resize', fit); addEventListener(EVT, fit);
    return () => { removeEventListener('resize', fit); removeEventListener(EVT, fit); };
  }, [w, h, fw, fh]);
  return scale;
}

/** Re-renders when the margin changes (for a control that shows the current setting). */
export function useEdgeMargin(): [EdgeMargin, (m: EdgeMargin) => void] {
  const [m, setM] = useState(getEdgeMargin);
  useEffect(() => { const f = () => setM(getEdgeMargin()); addEventListener(EVT, f); return () => removeEventListener(EVT, f); }, []);
  return [m, setEdgeMargin];
}
