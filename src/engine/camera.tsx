import * as THREE from 'three';
import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { SplineTrack, Track } from './timeline';
import { noise1 } from './random';
import { useStoryFrame } from './clock';

export interface CameraKey {
  t: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  /** Come to rest at this key instead of flowing through it. */
  hold?: boolean;
}

/**
 * The narrator's eye: a smooth spline through keyed positions and look targets.
 * Velocity is continuous through keys, so moves read as one camera operator.
 * `shake` adds a gentle handheld drift (deterministic noise of story time).
 */
export function NarratorCamera({ keys, shake = 0.4 }: { keys: CameraKey[]; shake?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const tracks = useMemo(() => ({
    pos: new SplineTrack(keys.map((k) => ({ t: k.t, v: k.pos, hold: k.hold }))),
    look: new SplineTrack(keys.map((k) => ({ t: k.t, v: k.look, hold: k.hold }))),
    fov: new Track(keys.map((k) => ({ t: k.t, v: k.fov ?? 45 }))),
  }), [keys]);
  useStoryFrame(({ t }) => {
    const p = tracks.pos.sample(t), l = tracks.look.sample(t);
    camera.position.set(p[0], p[1], p[2]);
    const s = shake * 0.02;
    camera.lookAt(l[0] + noise1(t * 0.4, 1) * s, l[1] + noise1(t * 0.37, 2) * s, l[2] + noise1(t * 0.31, 3) * s);
    const fov = tracks.fov.sample(t);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  });
  return null;
}
