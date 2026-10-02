// The mini-games' baked textures (scripts/bake-textures.mjs → public/textures/), fetched and decoded once, early,
// so a game's first frame isn't drawn while its wall or sea is still downloading. The TV preloads them with its
// clips when a room opens; a phone preloads them when it's called to the TV.
const TEXTURES = ['grain', 'wood', 'wood-plank', 'wood-hull', 'brick', 'brick-bw', 'rain', 'sea-far', 'sea-mid', 'sea-near', 'led-off', 'led-off-gold', 'dither', 'hazard', 'concrete', 'paper',
  'curse-char', 'curse-ember', 'curse-smoke',     // the curse pass (scripts/bake-curse.mjs)
  'haze', 'stamp-ink'];                           // the shuriken's moonbeam haze and the stamp mask (scripts/bake-shuriken.mjs; SETUP's stamps too)
/** Tiles that also come baked at twice the pixels (name@2x.png), for a stage scaled up past 1.25 device px per stage px. */
const HI = new Set(['wood', 'wood-plank', 'wood-hull', 'sea-far', 'sea-mid', 'sea-near']);
/** html.tex-2x is set by src/tv/stage.ts from devicePixelRatio × the stage scale (image-set() alone only sees the DPR). */
const hiRes = () => typeof document !== 'undefined' && document.documentElement.classList.contains('tex-2x');
/** The URL of a baked texture, @2x when the screen needs it and one was baked. Use it for SVG <image> and inline styles. */
export const tex = (name: string) => `/textures/${name}${HI.has(name) && hiRes() ? '@2x' : ''}.png`;
const LOADED = new Map<string, HTMLImageElement>();
export function preloadTextures() {
  for (const t of TEXTURES) {
    const src = tex(t);
    if (LOADED.has(src)) continue;
    const img = new Image();
    img.decoding = 'async'; img.src = src;
    img.decode?.().catch(() => LOADED.delete(src));    // missing: try again next time
    LOADED.set(src, img);
  }
}
