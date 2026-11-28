import { beats } from '../../engine/beats';
import { ClipTrack } from '../../engine/clips';
import type { CameraKey } from '../../engine/camera';
import type { Cue } from '../../engine/types';
import { FRONT, level, ROOM } from '../../sets/flats-street';

// The whole film on one page: when things happen, in story seconds.

export const DURATION = 108;

type V3 = [number, number, number];
/** A point in block A (hers, south side) in world space. */
export const A = (x: number, y: number, z: number): V3 => [x, y, z - FRONT];
/** A point in block B (across the street, turned to face her) in world space. */
export const B = (x: number, y: number, z: number): V3 => [-x, y, FRONT - z];
/** Floor height of both flats. */
export const FY = level(ROOM.f);

/** Where things stand in the two flats, in block space. */
export const SPOT = {
  window: [1.75, -0.7] as [number, number],
  lampA: [2.3, -0.45] as [number, number],
  lampB: [2.35, -0.6] as [number, number],
  plugB: [3.2, -1.55] as [number, number],
  socketB: [3.84, -1.9] as [number, number],
  clock: [0.55, 8.35 - FY, -0.27] as V3,
};

export const CUES: Cue[] = [
  { at: 2.5, type: 'voice', id: 'r1' }, { at: 12.5, type: 'voice', id: 'r2' }, { at: 37.0, type: 'voice', id: 'r3' },
  ...[19.5, 20.5, 21.5, 22.5].map((at): Cue => ({ at, type: 'sfx', id: 'tick' })),
  { at: 50.2, type: 'wait', target: 'switch', prompt: 'Answer it' },
  { at: 50.4, type: 'sfx', id: 'switch' },
  { at: 51.1, type: 'sfx', id: 'switch' },
  { at: 67.3, type: 'sfx', id: 'switch' },
  { at: 69.6, type: 'sfx', id: 'gate' },
  { at: 86.6, type: 'sfx', id: 'creak' },
];

/** Scalar beats on a GSAP timeline, seeked to story time every frame. */
export const S = beats({ ceiling: 1, lampA: 0, lampB: 0, minute: 44, cup: 0, reach: 0, roomDoor: 0, gate: 0, gateB: 0 }, (tl, s) => {
  tl.fromTo(s, { minute: 44 }, { minute: 45, duration: 0.12, ease: 'back.out(3)' }, 22.5);
  // the lamp across the way comes on at a quarter to ten, and answers her twice
  tl.fromTo(s, { lampB: 0 }, { lampB: 1, duration: 0.08 }, 24.0);
  for (const at of [56.6, 57.6]) tl.fromTo(s, { lampB: 1 }, { lampB: 0, duration: 0.05 }, at).fromTo(s, { lampB: 0 }, { lampB: 1, duration: 0.05 }, at + 0.45);
  // her light: off and on at the switch, off as she leaves
  tl.fromTo(s, { ceiling: 1 }, { ceiling: 0, duration: 0.05 }, 50.4).fromTo(s, { ceiling: 0 }, { ceiling: 1, duration: 0.05 }, 51.1)
    .fromTo(s, { ceiling: 1 }, { ceiling: 0, duration: 0.05 }, 67.3);
  // her own lamp, in her empty flat
  tl.fromTo(s, { lampA: 0 }, { lampA: 1, duration: 0.08 }, 101.5);
  // the cup goes down on the sill (hand there at 0.5); her hand to the switch as she gets there, and back
  tl.fromTo(s, { cup: 0 }, { cup: 1, duration: 1.6, ease: 'none' }, 46.4);
  tl.fromTo(s, { reach: 0 }, { reach: 1, duration: 0.5, ease: 'sine.out' }, 49.7).fromTo(s, { reach: 1 }, { reach: 0, duration: 0.5 }, 51.35);
  tl.fromTo(s, { gate: 0 }, { gate: 1, duration: 1.2, ease: 'sine.inOut' }, 69.6).fromTo(s, { gate: 1 }, { gate: 0, duration: 1.5 }, 72.5);
  tl.fromTo(s, { gateB: 0 }, { gateB: 1, duration: 1.2, ease: 'sine.inOut' }, 77.2);
  tl.fromTo(s, { roomDoor: 0.12 }, { roomDoor: 1.35, duration: 1.8, ease: 'sine.inOut' }, 86.6);
});

/** Her moves: a list of [time, x, y, z] in world space, walked in straight lines. Heading follows the walk unless set. */
type Way = { t: number; p: V3; face?: number };
const fA = (x: number, z: number, y = FY): V3 => A(x, y, z);
const fB = (x: number, z: number, y = FY): V3 => B(x, y, z);
/** Facing angles (about +y, 0 = +z). */
export const FACE = { north: 0, south: Math.PI, west: -Math.PI / 2, east: Math.PI / 2 };
export const WAYS: Way[] = [
  { t: 0, p: fA(1.75, -0.75), face: FACE.north },
  { t: 48.0, p: fA(1.75, -0.75), face: FACE.north },
  { t: 50.0, p: fA(0.62, -1.55), face: FACE.west },
  { t: 51.8, p: fA(0.62, -1.55), face: FACE.west },
  { t: 53.8, p: fA(1.7, -0.75), face: FACE.north },
  { t: 66.2, p: fA(1.7, -0.75), face: FACE.north },
  { t: 67.8, p: fA(0.5, -0.85) },
  // out through the street door and across the road to the other block's door
  { t: 70.0, p: A(-1.75, 0.3, -0.6) },
  { t: 70.6, p: A(-1.75, 0.15, 0.4) },
  { t: 71.4, p: A(-1.6, 0.0, 2.0) },
  { t: 77.0, p: B(-1.6, 0.0, 2.0) },
  { t: 77.8, p: B(-1.75, 0.15, 0.4) },
  { t: 79.0, p: B(-1.75, 0.3, -0.6) },
  // the last flight up to the second floor, then the door
  { t: 79.01, p: fB(-2.7, -4.45, level(1) + 1.5) },
  { t: 80.4, p: fB(-0.85, -4.45, level(1) + 1.5) },
  { t: 84.2, p: fB(-0.85, -1.1) },
  { t: 85.4, p: fB(-0.55, -0.85), face: FACE.west },
  { t: 87.4, p: fB(-0.55, -0.85), face: FACE.west },
  { t: 89.6, p: fB(1.1, -1.4) },
  { t: 97.0, p: fB(1.1, -1.4), face: B_FACE(-0.4, -1) },
  { t: 99.4, p: fB(1.35, -0.72), face: FACE.south },
];
/** Heading for looking along block-B direction (dx, dz). */
function B_FACE(dx: number, dz: number) { return Math.atan2(-dx, -dz); }

export const HER_CLIPS = new ClipTrack([
  { clip: 'Cup_Idle_Loop', at: 0 },
  { clip: 'Cup_Drink', at: 14.2, fade: 0.5 },
  { clip: 'Cup_Idle_Loop', at: 19.0, fade: 0.6 },
  { clip: 'Idle_Loop', at: 47.2, fade: 0.6 },
  { clip: 'Walk_Slow_Loop', at: 48.0, fade: 0.4 },
  { clip: 'Idle_Loop', at: 50.0, fade: 0.4 },
  { clip: 'Walk_Slow_Loop', at: 51.8, fade: 0.4 },
  { clip: 'Nervous_Loop', at: 53.8, fade: 0.5 },
  { clip: 'Walk_Slow_Loop', at: 66.2, fade: 0.4 },
  { clip: 'Walk_Loop', at: 70.0, fade: 0 },
  { clip: 'Walk_Slow_Loop', at: 79.0, fade: 0 },
  { clip: 'Push_Door', at: 85.4, fade: 0.4 },
  { clip: 'Walk_Slow_Loop', at: 87.4, fade: 0.5 },
  { clip: 'Look_Around', at: 89.6, fade: 0.5 },
  { clip: 'Walk_Slow_Loop', at: 97.0, fade: 0.4 },
  { clip: 'Idle_Loop', at: 99.4, fade: 0.5 },
]);

/** Her position at time t, and where she faces. */
export function herAt(t: number): { p: V3; face: number } {
  const w = WAYS;
  if (t <= w[0].t) return { p: w[0].p, face: w[0].face ?? 0 };
  let i = 0;
  while (i < w.length - 2 && t > w[i + 1].t) i++;
  const a = w[i], b = w[i + 1];
  const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const p = a.p.map((x, j) => x + (b.p[j] - x) * k) as V3;
  const dx = b.p[0] - a.p[0], dz = b.p[2] - a.p[2];
  const moving = Math.hypot(dx, dz) > 0.05 && k < 1;
  const walk = Math.atan2(dx, dz);
  let face = moving ? turn(a.face ?? walk, walk, Math.min(1, k / 0.2)) : (b.face ?? a.face ?? walk);
  // turn into a set facing over the last part of a walk
  if (moving && b.face !== undefined) face = turn(walk, b.face, Math.max(0, (k - 0.6) / 0.4));
  if (!moving && a.face !== undefined && b.face !== undefined) face = turn(a.face, b.face, k);
  return { p, face };
}
/** Metres she has walked by time t, so her steps can keep pace with the ground. */
const DIST = WAYS.reduce<number[]>((d, w, i) => {
  const p = WAYS[i - 1]?.p;
  d.push(i === 0 ? 0 : d[i - 1] + (w.t - WAYS[i - 1].t < 0.05 ? 0 : Math.hypot(w.p[0] - p![0], w.p[2] - p![2])));
  return d;
}, []);
export function walkedAt(t: number) {
  let i = 0;
  while (i < WAYS.length - 2 && t > WAYS[i + 1].t) i++;
  const k = Math.min(1, Math.max(0, (t - WAYS[i].t) / (WAYS[i + 1].t - WAYS[i].t)));
  return DIST[i] + (DIST[i + 1] - DIST[i]) * k;
}
/** How far each walk clip carries her in one second of its own time. */
export const STRIDE: Record<string, number> = { Walk_Slow_Loop: 1.34 / 1.5, Walk_Loop: 1.43 / 1.2 };
const turn = (a: number, b: number, k: number) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; };

/** Heights for the camera. */
const EYE = FY + 1.6;
export const CAMERA: CameraKey[] = [
  // night over the street, coming down to her lit window
  { t: 0, pos: [-16, 15, 3], look: A(1.0, 7.5, 0), fov: 46 },
  { t: 10.9, pos: A(3.2, 8.4, 4.8), look: A(1.75, 7.8, -0.4), fov: 34 },
  // over her shoulder, the dark window across the street
  { t: 11, pos: A(2.55, EYE + 0.15, -2.6), look: B(1.75, EYE - 0.2, -0.3), fov: 40, cut: true },
  { t: 19, pos: A(2.45, EYE + 0.1, -2.3), look: B(1.75, EYE - 0.25, -0.3), fov: 36 },
  // the clock: a minute to go
  { t: 19.01, pos: A(SPOT.clock[0] + 0.35, FY + SPOT.clock[1] - 0.15, -1.9), look: A(SPOT.clock[0], FY + SPOT.clock[1] - 0.05, -0.27), fov: 30, cut: true },
  { t: 23, pos: A(SPOT.clock[0] + 0.25, FY + SPOT.clock[1] - 0.1, -1.6), look: A(SPOT.clock[0], FY + SPOT.clock[1] - 0.05, -0.27), fov: 28 },
  // the lamp comes on
  { t: 23.01, pos: A(1.85, EYE, 0.25), look: B(1.9, FY + 1.0, -0.4), fov: 26, cut: true },
  { t: 30, pos: A(1.8, EYE, 0.3), look: B(1.9, FY + 1.0, -0.4), fov: 18 },
  // her face, from outside her window
  { t: 30.01, pos: A(1.15, EYE - 0.1, -0.3), look: A(1.75, EYE - 0.1, -0.8), fov: 54, cut: true },
  { t: 36, pos: A(1.2, EYE - 0.1, -0.3), look: A(1.75, EYE - 0.1, -0.8), fov: 50 },
  // what she sees: past her, across the street, pushing in on the lamp
  { t: 36.01, pos: A(2.04, EYE + 0.05, -1.1), look: B(SPOT.lampB[0], FY + 1.0, SPOT.lampB[1]), fov: 30, cut: true },
  { t: 44, pos: A(2.06, EYE + 0.02, -0.95), look: B(SPOT.lampB[0], FY + 1.0, SPOT.lampB[1]), fov: 13 },
  // back with her: she puts the cup down, answers with the switch and hurries back to the window
  { t: 44.01, pos: A(3.55, EYE + 0.2, -3.9), look: A(1.2, FY + 1.2, -0.9), fov: 52, cut: true },
  { t: 46.2, pos: A(3.5, EYE + 0.18, -3.75), look: A(1.2, FY + 1.2, -0.9), fov: 50 },
  // the cup on the sill, the lamp across the way beyond it
  { t: 46.21, pos: A(0.85, FY + 1.3, -1.05), look: A(1.6, FY + 1.0, -0.2), fov: 50, cut: true },
  { t: 48.0, pos: A(0.9, FY + 1.28, -1.0), look: A(1.6, FY + 1.0, -0.2), fov: 46 },
  { t: 48.01, pos: A(3.5, EYE + 0.18, -3.75), look: A(1.2, FY + 1.2, -0.9), fov: 50, cut: true },
  { t: 53.8, pos: A(3.5, EYE + 0.15, -3.6), look: A(0.8, FY + 1.3, -1.3), fov: 48, hold: true },
  // from the window: the answer
  { t: 53.81, pos: A(1.85, EYE, 0.25), look: B(1.9, FY + 1.0, -0.4), fov: 30, cut: true },
  { t: 61, pos: A(1.8, EYE, 0.3), look: B(1.9, FY + 1.0, -0.4), fov: 20 },
  // her face again
  { t: 61.01, pos: A(1.15, EYE - 0.1, -0.3), look: A(1.7, EYE - 0.1, -0.8), fov: 52, cut: true },
  { t: 66.5, pos: A(1.2, EYE - 0.1, -0.3), look: A(1.7, EYE - 0.1, -0.8), fov: 46 },
  // the street: her window goes dark, she comes out and crosses
  { t: 66.51, pos: B(-4.5, 1.2, 2.6), look: A(0.5, 6.2, 0), fov: 50, cut: true },
  { t: 70.5, pos: B(-4.2, 1.3, 2.4), look: A(-1.0, 2.0, 0), fov: 46 },
  { t: 75.5, pos: B(-4.3, 1.4, 2.0), look: B(-0.74, 1.2, 4.1), fov: 46 },
  { t: 77.4, pos: B(-4.35, 1.45, 1.8), look: B(-1.7, 1.2, 1.2), fov: 46 },
  { t: 79, pos: B(-4.4, 1.5, 1.6), look: B(-1.75, 1.3, 0), fov: 46 },
  // up the last flight
  { t: 79.01, pos: fB(-0.3, -0.45, FY + 1.3), look: fB(-0.9, -4.0, FY - 0.4), fov: 58, cut: true },
  { t: 85.3, pos: fB(-0.3, -0.4, FY + 1.35), look: fB(-0.7, -1.6, FY + 1.0), fov: 58 },
  // the door opens: from inside the flat
  { t: 85.31, pos: fB(2.6, -3.2, FY + 1.6), look: fB(0.1, -0.85, FY + 1.2), fov: 50, cut: true },
  { t: 91.5, pos: fB(2.4, -3.0, FY + 1.5), look: fB(0.6, -1.2, FY + 1.1), fov: 46 },
  // the plug, lying on the floor
  { t: 91.51, pos: fB(2.4, -1.15, FY + 0.85), look: fB(3.5, -1.78, FY + 0.1), fov: 46, cut: true },
  { t: 95, pos: fB(2.5, -1.2, FY + 0.8), look: fB(3.5, -1.78, FY + 0.1), fov: 42 },
  // and the lamp still burning
  { t: 95.01, pos: fB(2.75, -2.1, FY + 0.7), look: fB(SPOT.lampB[0], SPOT.lampB[1], FY + 1.0), fov: 50, cut: true },
  { t: 97, pos: fB(2.7, -1.95, FY + 0.85), look: fB(SPOT.lampB[0] + 0.1, SPOT.lampB[1] - 0.1, FY + 1.1), fov: 46 },
  // from behind her: her own window, across the street
  { t: 97.01, pos: fB(2.7, -3.4, EYE + 0.15), look: A(2.0, EYE - 0.4, -0.5), fov: 42, cut: true },
  { t: 101, pos: fB(2.6, -3.1, EYE + 0.1), look: A(2.0, EYE - 0.6, -0.5), fov: 28 },
  { t: 108, pos: fB(2.6, -3.0, EYE + 0.1), look: A(2.0, EYE - 0.6, -0.5), fov: 22 },
];

