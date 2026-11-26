// Seeded randomness. Never use Math.random() in a story: the export must
// produce the same frames every run.

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i + seed * 57.3) * (1 - u) + hash(i + 1 + seed * 57.3) * u) * 2 - 1;
}

/** Cheap smooth 2D noise in roughly [-1, 1] (sum of rotated sines). */
export function noise2(x: number, z: number) {
  return (
    Math.sin(x * 0.31 + z * 0.17) * 0.5 +
    Math.sin(x * -0.23 + z * 0.41 + 1.3) * 0.3 +
    Math.sin(x * 0.71 - z * 0.63 + 2.1) * 0.2
  );
}
