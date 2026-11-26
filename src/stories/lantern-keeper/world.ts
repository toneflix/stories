import * as THREE from 'three';
import { rng, noise2 } from '../../engine/random';
import { smoothstep } from '../../engine/timeline';

// Shapes and placements for the valley. Pure data and geometry: the React components
// in Scene.tsx put them on screen.

/** Ground height anywhere in the world. Everything is placed with this. */
export function height(x: number, z: number) {
  const hill = 3.4 * Math.exp(-(x * x + (z + 2) * (z + 2)) / 70);
  const valley = -4.5 * smoothstep(-7, -24, z);
  const farRise = 8 * smoothstep(-55, -100, z);
  const sides = 4 * smoothstep(18, 45, Math.abs(x - 4));
  const roll = 0.25 * noise2(x * 0.8, z * 0.8);
  return hill + valley + farRise + sides + roll;
}
export const ground = (x: number, z: number) => new THREE.Vector3(x, height(x, z), z);

export const LANTERN = ground(0, -2);
/** Height of the great lantern's flame above its base. */
export const WICK_Y = 2.3;
export const WICK = LANTERN.clone().add(new THREE.Vector3(0, WICK_Y, 0));
export const VILLAGE = ground(6, -30);

/** Pip's walk up the hill, ending a step from the lantern, facing it. */
export const PATH = new THREE.CatmullRomCurve3(
  [[5.2, 9.6], [4.1, 6.6], [3.0, 3.8], [1.9, 1.4], [0.85, -0.6]].map(([x, z]) => ground(x, z)),
);
export const STAND = PATH.getPoint(1);

export const C = {
  grassHi: '#6c9a6e', grassLo: '#35574f', path: '#c79a6c', flowers: ['#f6c2d0', '#fff1c4', '#c8b6ff'],
  skyTop: '#0d1236', skyMid: '#43306b', horizon: '#f39a72', fog: '#55427a',
  canopy: ['#3d7a5c', '#4f8f63', '#2f6652'], trunk: '#5a3b2c',
  wall: ['#f1dcc2', '#e8c9b5', '#d9cbe6'], roof: ['#b5485a', '#8e4b6e', '#c8664a'], window: '#ffc56e',
  post: '#3a2a2e', brass: '#d6a14e',
};

/** Smooth rolling terrain, vertex-coloured by height with the path painted in. */
export function terrainGeometry() {
  const g = new THREE.PlaneGeometry(240, 240, 220, 220);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -40);
  const p = g.attributes.position;
  const pathPts = PATH.getSpacedPoints(80);
  const cols = new Float32Array(p.count * 3);
  const hi = new THREE.Color(C.grassHi), lo = new THREE.Color(C.grassLo), pc = new THREE.Color(C.path), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = height(x, z);
    p.setY(i, y);
    c.copy(lo).lerp(hi, THREE.MathUtils.clamp((y + 3) / 7, 0, 1));
    let d = Infinity;
    if (Math.abs(x) < 12 && z > -6 && z < 14) for (const q of pathPts) d = Math.min(d, (q.x - x) ** 2 + (q.z - z) ** 2);
    c.lerp(pc, 1 - smoothstep(0.15, 0.5, d));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

export interface TreeSpot { x: number; y: number; z: number; s: number; color: string; lean: number }
export function treeSpots(): TreeSpot[] {
  const r = rng(11), out: TreeSpot[] = [];
  const pathPts = PATH.getSpacedPoints(60);
  while (out.length < 90) {
    const x = (r() - 0.5) * 80, z = 22 - r() * 75;
    if (pathPts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 6)) continue;
    if (Math.hypot(x, z + 2) < 6.5 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 11) continue;
    if (x > -3 && x < 9 && z > 2 && z < 22) continue; // the camera's corridor up the path
    out.push({ x, y: height(x, z), z, s: 0.8 + r() * 0.9, color: C.canopy[Math.floor(r() * 3)], lean: (r() - 0.5) * 0.15 });
  }
  return out;
}

export interface HouseSpot { x: number; y: number; z: number; w: number; h: number; rot: number; wall: string; roof: string; lightAt: number[] }
export function houseSpots(): HouseSpot[] {
  const r = rng(5), out: HouseSpot[] = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 1.5 + r() * 8;
    const x = VILLAGE.x + Math.cos(a) * d * 1.3, z = VILLAGE.z + Math.sin(a) * d;
    out.push({
      x, z, y: height(x, z) - 0.1, w: 1.3 + r() * 0.8, h: 1.1 + r() * 0.8,
      rot: Math.atan2(LANTERN.x - x, LANTERN.z - z) + (r() - 0.5) * 0.5,
      wall: C.wall[Math.floor(r() * 3)], roof: C.roof[Math.floor(r() * 3)],
      lightAt: [31 + r() * 3.2, 31 + r() * 3.2],
    });
  }
  return out;
}

/** Soft radial glow, drawn once on a canvas. */
export function glowTexture(color: string, core = 0.3) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(Math.max(0.01, core * 0.5), color);
  grd.addColorStop(Math.min(0.99, core + 0.25), color + '55');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
