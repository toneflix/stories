import * as THREE from 'three';
import { rng } from '../../engine/random';

// Layout of the flooded street: the bus route, the stops, the buildings. Pure data and
// geometry; Scene.tsx puts it on screen. The water surface is y = 0 and the bus drives
// towards -z, with the stops on its right (+x).

/** The bus's line down the street, at water level. Distance along it is in metres. */
export const ROUTE = new THREE.CatmullRomCurve3(
  [[1.6, 40], [1.6, 0], [2.4, -60], [0.8, -130], [2.2, -200], [1.6, -250], [1.0, -320]].map(([x, z]) => new THREE.Vector3(x, 0, z)),
);
ROUTE.arcLengthDivisions = 600;
export const ROUTE_LENGTH = ROUTE.getLength();

/** Where the bus stops: route distance (m) that puts its door at the shelter. */
export const STOPS = [95, 170, 245];

export interface Pose { pos: THREE.Vector3; heading: number; right: THREE.Vector3; forward: THREE.Vector3 }
/** Position and heading of the bus at route distance `s`. */
export function routePose(s: number): Pose {
  const u = THREE.MathUtils.clamp(s / ROUTE_LENGTH, 0, 1);
  const pos = ROUTE.getPointAt(u), forward = ROUTE.getTangentAt(Math.min(u, 0.999)).setY(0).normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  return { pos, heading: Math.atan2(forward.x, forward.z), right, forward };
}

/** Bus measurements (metres, bus space: +z is the front, +x is the driver's side). */
export const BUS = {
  length: 4.7, width: 1.95, floor: 0.5, belt: 1.15, roof: 2.05,
  /** Bus space y that sits on the water line. */
  draft: 0.42,
  door: { z0: 0.05, z1: 1.05 },
};

/** A bus stop shelter beside stop `i`: its bench edge is a step from the open door. */
export function shelterPose(i: number) {
  const p = routePose(STOPS[i]);
  const doorMid = (BUS.door.z0 + BUS.door.z1) / 2;
  const base = p.pos.clone().addScaledVector(p.forward, doorMid).addScaledVector(p.right, BUS.width / 2 + 0.75);
  return { pos: base, heading: p.heading, right: p.right, forward: p.forward };
}

export const C = {
  water: '#3f7f8c', waterDeep: '#24505e',
  bus: '#f7c51e', busStripe: '#1b1b1b', busTrim: '#d8d2c4', seat: '#7a2e2a', interior: '#5b5048',
  walls: ['#e9d8b8', '#d98f6f', '#8fbfb4', '#e3b65a', '#c9c3b5', '#b7d0e0', '#e7a9a0', '#d9cf9a'],
  trim: '#f4efe4', roofRust: '#9a5b3c', tank: '#202326', glassDark: '#2a3540',
  palmTrunk: '#8a6a4a', palm: ['#4f8a4a', '#3f7a46', '#5c9650'],
  sign: ['#2f6fb0', '#c43b32', '#2d8a4e', '#e8a41c', '#6c3f9c'],
};

export interface Block { x: number; z: number; w: number; d: number; floors: number; wall: string; side: 1 | -1; roof: 'flat' | 'tin'; seed: number }

/** Buildings along both sides of the street, set back from the route. */
export function blocks(): Block[] {
  const r = rng(71), out: Block[] = [];
  for (const side of [1, -1] as const) {
    let s = -20;
    while (s < ROUTE_LENGTH + 40) {
      const w = 6 + r() * 7;
      const p = routePose(Math.max(0, Math.min(ROUTE_LENGTH, s + w / 2)));
      const setback = 8.2 + r() * 1.6;
      const d = 7 + r() * 4;
      const at = p.pos.clone().addScaledVector(p.right, side * (setback + d / 2));
      if (s + w / 2 > ROUTE_LENGTH) at.addScaledVector(p.forward, s + w / 2 - ROUTE_LENGTH);
      if (s + w / 2 < 0) at.addScaledVector(p.forward, s + w / 2);
      // a gap now and then: a side street or a sunk lot
      if (r() > 0.12) out.push({
        x: at.x, z: at.z, w, d, floors: 1 + Math.floor(r() * r() * 5) + (r() > 0.7 ? 1 : 0),
        wall: C.walls[Math.floor(r() * C.walls.length)], side, roof: r() > 0.7 ? 'tin' : 'flat', seed: Math.floor(r() * 1e6),
      });
      s += w + 0.3 + r() * 1.2;
    }
  }
  return out;
}

export interface Spot { x: number; z: number; s: number; seed: number }
/** Palm tops in the water and along the kerbs. */
export function palmSpots(): Spot[] {
  const r = rng(13), out: Spot[] = [];
  for (let i = 0; i < 26; i++) {
    const s = r() * (ROUTE_LENGTH + 20) - 10, side = r() > 0.5 ? 1 : -1;
    const p = routePose(Math.max(0, Math.min(ROUTE_LENGTH, s)));
    const at = p.pos.clone().addScaledVector(p.right, side * (5.4 + r() * 2.2));
    if (STOPS.some((q) => Math.abs(q - s) < 9) && side > 0) continue;
    out.push({ x: at.x, z: at.z, s: 0.8 + r() * 0.5, seed: Math.floor(r() * 1e6) });
  }
  return out;
}

/** Electric poles down the left side, wires sagging between them. */
export function poleSpots() {
  const out: THREE.Vector3[] = [];
  for (let s = -10; s < ROUTE_LENGTH; s += 24) {
    const p = routePose(Math.max(0, s));
    out.push(p.pos.clone().addScaledVector(p.right, -5.6).addScaledVector(p.forward, Math.min(0, s)));
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

/** Painted sign board: a texture with bold lettering on a flat colour. */
export function signTexture(text: string, bg: string, fg = '#fff6e0', w = 512, h = 128) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = h * 0.05; g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
  g.fillStyle = fg;
  g.font = `bold ${Math.round(h * 0.5)}px "Arial Black", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.03, w * 0.86);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
