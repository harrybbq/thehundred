// Types for scroogeKit.js (plain JS: SVG markup strings from fixed data, and his handwriting layout).
type Frames = [number, Keyframe, string?][];
type Glyph = { ch: string; tf: string; strokes: string[]; drip: null | { x: number; y: number; w: number; h: number } };
declare const K: {
  normalise(t: string): string;
  defs(): string; hat(w: number): string; glove(): string;
  room(o?: Record<string, unknown>): string; counter(o?: Record<string, unknown>): string;
  ledger(x: number, y: number, k: number, quill?: boolean): string; stacks(x: number, y: number, k: number): string; inkwell(x: number, y: number, k: number): string;
  sting(): string;
  stingTimeline(tl: (el: Element | undefined, f: Frames) => void, q: (s: string) => Element[]): void;
  POP(t: number, d?: number): Frames; STAMP(t: number, r: number, d?: number): Frames;
  write(text: string, box: { w: number; h: number; maxCap?: number; minCap?: number }): { fallback: boolean; raw?: string; cap: number; glyphs: Glyph[]; sig: { tf: string; strokes: string[] }; lines: number };
  rnd(i: number): number; f1(v: number): number;
};
export default K;
