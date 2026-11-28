import * as THREE from 'three';
import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { SplineTrack, Track } from './timeline';
import { noise1 } from './random';
import { useStoryFrame } from './clock';
import { lens, SHUTTER } from './lens';

export interface CameraKey {
  t: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  /** Come to rest at this key instead of flowing through it. */
  hold?: boolean;
  /** Cut to this key: a new shot starts here instead of moving from the last one. */
  cut?: boolean;
  /** Distance to focus at, in metres. By default the lens focuses on `look`. */
  focus?: number;
}

/** Keys grouped into shots, split at every cut. */
function shots(keys: CameraKey[]) {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  const out: CameraKey[][] = [];
  for (const k of sorted) if (k.cut || !out.length) out.push([k]); else out[out.length - 1].push(k);
  return out.map((ks, i) => {
    const ends = { easeIn: i === 0, easeOut: i === out.length - 1 };
    return {
      from: ks[0].t,
      pos: new SplineTrack(ks.map((k) => ({ t: k.t, v: k.pos, hold: k.hold })), ends),
      look: new SplineTrack(ks.map((k) => ({ t: k.t, v: k.look, hold: k.hold })), ends),
      fov: new Track(ks.map((k) => ({ t: k.t, v: k.fov ?? 45 }))),
      focus: ks.some((k) => k.focus) ? new Track(ks.map((k) => ({ t: k.t, v: k.focus ?? 0 }))) : null,
    };
  });
}

/** `?cam=x,y,z,lookX,lookY,lookZ[,fov]` pins the camera, for framing shots while writing a scene. */
const PINNED = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cam')?.split(',').map(Number) : undefined;

/**
 * The narrator's eye: a smooth spline through keyed positions and look targets.
 * Velocity is continuous through keys, so moves read as one camera operator; a `cut` key starts a new shot.
 * `shake` adds a gentle handheld drift (deterministic noise of story time): aim, sway and a slight roll.
 * The lens it writes (focus, shutter) drives depth of field and motion blur.
 */
export function NarratorCamera({ keys, shake = 0.4 }: { keys: CameraKey[]; shake?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const all = useMemo(() => shots(keys), [keys]);
  const ghost = useMemo(() => new THREE.PerspectiveCamera(), []);
  const last = useMemo(() => ({ t: NaN }), []);

  /** Places `cam` where the operator holds it at time t; returns the shot and its focus distance. */
  const place = (cam: THREE.PerspectiveCamera, t: number) => {
    let i = 0;
    all.forEach((s, j) => { if (s.from <= t) i = j; });
    const tracks = all[i];
    const p = tracks.pos.sample(t), l = tracks.look.sample(t);
    // handheld: the aim wanders, the body sways and breathes, the horizon tips a little
    const s = shake * 0.02, b = shake * 0.006;
    cam.position.set(p[0] + noise1(t * 0.23, 4) * b, p[1] + noise1(t * 0.29, 5) * b + Math.sin(t * 1.6) * b * 0.4, p[2] + noise1(t * 0.19, 6) * b);
    cam.up.set(0, 1, 0);
    cam.lookAt(l[0] + noise1(t * 0.4, 1) * s, l[1] + noise1(t * 0.37, 2) * s, l[2] + noise1(t * 0.31, 3) * s);
    cam.rotateZ(noise1(t * 0.17, 7) * shake * 0.006);
    const fov = tracks.fov.sample(t);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const focus = tracks.focus?.sample(t) || Math.hypot(l[0] - p[0], l[1] - p[1], l[2] - p[2]);
    return { shot: i, focus };
  };

  useStoryFrame(({ t, live }) => {
    if (PINNED) {
      camera.position.set(PINNED[0], PINNED[1], PINNED[2]);
      camera.lookAt(PINNED[3], PINNED[4], PINNED[5]);
      if (PINNED[6] && camera.fov !== PINNED[6]) { camera.fov = PINNED[6]; camera.updateProjectionMatrix(); }
      lens.focus = camera.position.distanceTo(new THREE.Vector3(PINNED[3], PINNED[4], PINNED[5]));
      lens.hasPrev = false;
      return;
    }
    const now = place(camera, t);
    lens.focus = now.focus;
    // where the camera was when the shutter opened, unless that was the last shot
    ghost.aspect = camera.aspect; ghost.near = camera.near; ghost.far = camera.far;
    const before = place(ghost, t - SHUTTER);
    ghost.updateProjectionMatrix(); ghost.updateMatrixWorld(true);
    // a paused live film holds still instead of freezing mid-smear
    lens.hasPrev = before.shot === now.shot && !(live && t === last.t);
    last.t = t;
    lens.prevViewProj.multiplyMatrices(ghost.projectionMatrix, ghost.matrixWorldInverse);
  });
  return null;
}
