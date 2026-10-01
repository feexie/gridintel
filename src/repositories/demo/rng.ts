/* ==========================================================
   DEMO ADAPTER — DETERMINISTIC RANDOM NUMBERS

   Every stream is seeded from a label, so the dataset is identical
   on every build and one part can change without disturbing the
   numbers drawn for another. Nothing here reads the clock or
   Math.random.
========================================================== */

const DATASET_SEED = "gridintel-demo-2026-09";

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A generator of numbers in [0, 1), the same sequence for the same label (mulberry32). */
export function seeded(label: string): () => number {
  let state = hash(`${DATASET_SEED}:${label}`);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
