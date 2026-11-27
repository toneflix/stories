import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion();

/** Rotate `bone` (in world space) so the direction to `child` points along `dir`. */
function aim(bone: THREE.Bone, child: THREE.Object3D, dir: THREE.Vector3, weight: number) {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _c.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_c, dir);
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(_q);
  bone.parent!.getWorldQuaternion(_qp);
  _qw.premultiply(_qp.invert());
  bone.quaternion.slerp(_qw, weight);
  bone.updateMatrixWorld(true);
}

/**
 * Analytic two-bone IK (shoulder-elbow-hand, hip-knee-foot).
 * `pole` is a world point the middle joint should bend towards.
 */
export function solveTwoBone(
  upper: THREE.Bone, lower: THREE.Bone, end: THREE.Object3D,
  target: THREE.Vector3, pole: THREE.Vector3, weight = 1,
) {
  if (weight <= 0) return;
  upper.updateMatrixWorld(true);
  const S = upper.getWorldPosition(new THREE.Vector3());
  // lengths in world space, so rigs under a scaled parent (e.g. centimetre skeletons) solve too
  const M = lower.getWorldPosition(new THREE.Vector3());
  const lenA = S.distanceTo(M), lenB = M.distanceTo(end.getWorldPosition(new THREE.Vector3()));
  const toT = new THREE.Vector3().subVectors(target, S);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(lenA - lenB) + 1e-3, lenA + lenB - 1e-3);
  const dir = toT.normalize();
  const cosA = (lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const toP = new THREE.Vector3().subVectors(pole, S);
  const bend = toP.sub(dir.clone().multiplyScalar(toP.dot(dir))).normalize();
  const E = S.clone().addScaledVector(dir, cosA * lenA).addScaledVector(bend, sinA * lenA);
  aim(upper, lower, E.clone().sub(S).normalize(), weight);
  const T = S.clone().addScaledVector(dir, d);
  const Ew = lower.getWorldPosition(new THREE.Vector3());
  aim(lower, end, T.sub(Ew).normalize(), weight);
}
