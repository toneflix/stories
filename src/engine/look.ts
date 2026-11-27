import * as THREE from 'three';

// A story page with <meta name="tf-look" content="real"> uses lit, physically based materials
// and the sketch pass instead of the house cel look.
export const REAL = typeof document !== 'undefined' && document.querySelector('meta[name="tf-look"]')?.getAttribute('content') === 'real';

/** Tileable noise on a canvas: a sum of sines at whole-number frequencies, so edges match. */
export function tileNoise(size: number, seed: number, octaves = 6) {
  const data = new Float32Array(size * size);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const waves = Array.from({ length: octaves * 6 }, (_, i) => {
    const o = Math.floor(i / 6), f = 2 ** o;
    return { fx: Math.round((r() * 2 - 1) * f * 2), fy: Math.round((r() * 2 - 1) * f * 2), ph: r() * 6.28, a: 1 / f };
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const w of waves) v += Math.sin(((x * w.fx + y * w.fy) / size) * 6.2832 + w.ph) * w.a;
    data[y * size + x] = v;
  }
  return data;
}

/** A tiling normal map made from tileNoise, for ripples or rough plaster. */
export function noiseNormalMap(size = 256, seed = 7, strength = 2) {
  const h = tileNoise(size, seed), px = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize();
    px.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], (y * size + x) * 4);
  }
  const tex = new THREE.DataTexture(px, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
