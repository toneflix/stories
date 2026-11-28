import * as THREE from 'three';

/**
 * What the narrator's lens is doing this frame, written by NarratorCamera and read by the
 * camera-feel passes (focus and motion blur). Without a NarratorCamera, focus stays at
 * `focus` and there is no motion blur.
 */
export const lens = {
  /** Distance to the subject in focus, in metres. */
  focus: 4,
  /** Where the camera was when the shutter opened (view-projection), for motion blur. */
  prevViewProj: new THREE.Matrix4(),
  /** False on the first frame of a shot, so a cut never smears. */
  hasPrev: false,
};

/** Seconds the shutter stays open: a 180° shutter at 30 fps. */
export const SHUTTER = 1 / 60;
