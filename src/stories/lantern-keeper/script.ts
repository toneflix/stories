import { beats } from '../../engine/beats';
import { ClipTrack } from '../../engine/clips';
import { progress } from '../../engine/timeline';
import type { CameraKey } from '../../engine/camera';
import type { Cue } from '../../engine/types';
import { LANTERN, PATH, STAND, VILLAGE } from './world';

// The whole film on one page: when things happen, in story seconds.

export const DURATION = 45;

export const CUES: Cue[] = [
  { at: 1.5, type: 'voice', id: 'l1' },
  { at: 9.0, type: 'voice', id: 'l2' },
  { at: 21.0, type: 'voice', id: 'l3' },
  { at: 21.35, type: 'sfx', id: 'spark' },
  { at: 22.15, type: 'sfx', id: 'spark' },
  { at: 22.5, type: 'sfx', id: 'fizzle' },
  { at: 24.6, type: 'wait', target: 'lantern', prompt: 'Tap the lantern to help Pip' },
  { at: 25.0, type: 'sfx', id: 'gather' },
  { at: 25.6, type: 'voice', id: 'l4' },
  { at: 30.0, type: 'sfx', id: 'bloom' },
  { at: 31.2, type: 'sfx', id: 'windows' },
  { at: 33.2, type: 'voice', id: 'l5' },
];

/** Scalar beats on a GSAP timeline, seeked to story time every frame. */
export const B = beats({ night: 0, glow: 0, flicker: 0, ember: 1, look: 0 }, (tl, s) => {
  tl.fromTo(s, { night: 0 }, { night: 1, duration: 24, ease: 'sine.inOut' }, 0);
  // two failed strikes, then Pip's own little flame gutters out
  tl.fromTo(s, { flicker: 0 }, { flicker: 1, duration: 0.12, ease: 'power2.out' }, 21.35)
    .fromTo(s, { flicker: 1 }, { flicker: 0, duration: 0.45, ease: 'power2.in' }, 21.5)
    .fromTo(s, { flicker: 0 }, { flicker: 0.8, duration: 0.12 }, 22.15)
    .fromTo(s, { flicker: 0.8 }, { flicker: 0, duration: 0.35, ease: 'power2.in' }, 22.3);
  tl.fromTo(s, { ember: 1 }, { ember: 0.05, duration: 0.6, ease: 'steps(6)' }, 22.4);
  // fireflies fill the lantern, then it blooms; Pip's lantern catches from it
  tl.fromTo(s, { glow: 0 }, { glow: 0.45, duration: 4, ease: 'sine.in' }, 25.8)
    .fromTo(s, { glow: 0.45 }, { glow: 1.25, duration: 0.9, ease: 'back.out(2.5)' }, 30.0);
  tl.fromTo(s, { ember: 0.05 }, { ember: 1, duration: 0.5 }, 30.3);
  // where Pip looks
  tl.fromTo(s, { look: 0 }, { look: 1, duration: 0.8 }, 19.4)
    .fromTo(s, { look: 1 }, { look: 0.2, duration: 0.6 }, 23.2)
    .fromTo(s, { look: 0.2 }, { look: 1, duration: 1.0 }, 25.3)
    .fromTo(s, { look: 1 }, { look: 0, duration: 0.8 }, 30.4);
});

/** Pip's walk: start and end of the path, in story seconds. */
export const pathProgress = (t: number) => progress(t, 8.2, 19.4, (k) => k);

/** Pip's animation clips (Quaternius Universal Animation Library, CC0). */
export const PIP_CLIPS = new ClipTrack([
  { clip: 'Idle_Loop', at: 0 },
  { clip: 'Walk_Loop', at: 8.2, fade: 0.3 },
  { clip: 'Idle_Lantern_Loop', at: 19.2, fade: 0.5 },
  { clip: 'Spell_Simple_Enter', at: 20.5, fade: 0.3 },
  { clip: 'Spell_Simple_Idle_Loop', at: 21.1, fade: 0.25 },
  { clip: 'Spell_Simple_Exit', at: 22.8, fade: 0.25 },
  { clip: 'Idle_No_Loop', at: 23.3, fade: 0.4 },
  { clip: 'Idle_FoldArms_Loop', at: 24.3, fade: 0.6 },
  { clip: 'Idle_Loop', at: 25.4, fade: 0.6 },
  { clip: 'Yes', at: 29.2, fade: 0.3 },
  { clip: 'Dance_Loop', at: 30.6, fade: 0.5 },
]);

const L = (x: number, y: number, z: number): [number, number, number] => [LANTERN.x + x, LANTERN.y + y, LANTERN.z + z];
/** A point relative to Pip at time t: `ahead` along her walk, `side` to her left, `up`. */
const nearPip = (t: number, ahead: number, side: number, up: number): [number, number, number] => {
  const u = pathProgress(t), p = PATH.getPoint(u), f = PATH.getTangent(Math.min(u, 0.999));
  return [p.x + f.x * ahead + f.z * side, p.y + up, p.z + f.z * ahead - f.x * side];
};
/** A point on the line from Pip (k=0) to the lantern (k=1). */
const between = (y: number, k = 0.4): [number, number, number] =>
  [STAND.x + (LANTERN.x - STAND.x) * k, STAND.y + (LANTERN.y - STAND.y) * k + y, STAND.z + (LANTERN.z - STAND.z) * k];

/** Two-shot of Pip and the lantern: across her line of sight, a little in front of her. */
const twoShot = (dist: number, ahead: number, up: number): [number, number, number] => {
  const dx = LANTERN.x - STAND.x, dz = LANTERN.z - STAND.z, n = Math.hypot(dx, dz);
  const d = [dx / n, dz / n], perp = [-d[1], d[0]];
  const m = between(0, 0.5);
  return [m[0] + perp[0] * dist + d[0] * ahead, m[1] + up, m[2] + perp[1] * dist + d[1] * ahead];
};

/** The narrator's camera. Vertical frame (9:16): favour height, stage in depth, keep Pip's face to us. */
export const CAMERA: CameraKey[] = [
  { t: 0, pos: [3, 13, 24], look: [0, 10, -8], fov: 52 },
  { t: 7.5, pos: [4.5, 6.2, 17], look: L(0, 2.2, 0), fov: 50 },
  { t: 11, pos: nearPip(11, 3.2, 1.3, 1.35), look: nearPip(11, 0, 0, 1.1), fov: 46 },
  { t: 15, pos: nearPip(15, 2.8, -1.5, 1.0), look: nearPip(15, 0, 0, 1.2), fov: 46 },
  { t: 18.5, pos: twoShot(4.6, 1.6, 1.4), look: nearPip(18.5, 0, 0, 1.3), fov: 46 },
  { t: 21, pos: twoShot(4.8, 2.0, 1.5), look: between(1.45), fov: 44 },
  { t: 24.6, pos: twoShot(4.5, 2.1, 1.4), look: between(1.45), fov: 44, hold: true },
  { t: 29.0, pos: twoShot(2.6, 0.8, 0.6), look: L(0.15, 2.0, 0.1), fov: 52 },
  { t: 31.5, pos: twoShot(5.2, 1.2, 1.3), look: between(1.25, 0.3), fov: 48 },
  { t: 33.2, pos: L(3.8, 2.0, 2.2), look: between(1.0, 0.4), fov: 50 },
  { t: 35.5, pos: L(2.4, 2.6, 5.0), look: L(0.6, 0.2, -10), fov: 54 },
  { t: 45, pos: L(1.2, 4.4, 7.8), look: [(LANTERN.x + VILLAGE.x) / 2, VILLAGE.y + 2, VILLAGE.z * 0.6], fov: 56 },
];
