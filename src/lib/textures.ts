// The mini-games' baked textures (scripts/bake-textures.mjs → public/textures/), fetched and decoded once, early,
// so a game's first frame isn't drawn while its wall or sea is still downloading. The TV preloads them with its
// clips when a room opens; a phone preloads them when it's called to the TV.
const TEXTURES = ['grain', 'wood', 'wood-plank', 'wood-hull', 'brick', 'brick-bw', 'rain', 'sea-far', 'sea-mid', 'sea-near', 'led-off', 'led-off-gold', 'dither', 'hazard', 'concrete'];
const LOADED = new Map<string, HTMLImageElement>();
export function preloadTextures() {
  for (const t of TEXTURES) {
    if (LOADED.has(t)) continue;
    const img = new Image();
    img.decoding = 'async'; img.src = `/textures/${t}.png`;
    img.decode?.().catch(() => LOADED.delete(t));    // missing: try again next time
    LOADED.set(t, img);
  }
}
