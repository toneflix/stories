import * as THREE from 'three';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { toonify } from './toon';
import type { ClipSample } from './clips';

export interface CharacterSpec {
  /** Skinned parts sharing one rig, e.g. base body + outfit. The first one is the body. */
  parts: string[];
  /** Static attachments parented to a bone at load (hair, hats, props). */
  attach?: { url: string; bone: string; tint?: THREE.ColorRepresentation }[];
  /** glTF files whose animations drive the rig (matched by bone name). */
  animations: string[];
  /** Recolour meshes by name, e.g. eyebrows. Multiplies the texture. */
  tints?: Record<string, THREE.ColorRepresentation>;
  /** Repaint meshes by name in a flat colour, dropping their texture (e.g. to restyle an outfit). */
  paint?: Record<string, THREE.ColorRepresentation>;
  outline?: number;
}

export interface Character {
  root: THREE.Group;
  bone(name: string): THREE.Bone;
  clips: string[];
  /** Pose the rig from clip samples (see ClipTrack). Deterministic: no deltas involved. */
  pose(samples: ClipSample[]): void;
}

/**
 * Loads a character assembled from separate glTF parts (Quaternius-style modular
 * characters: base body, outfit, hair), cel-shades and outlines it, and drives every
 * part from the same clips so they move as one.
 */
export function useCharacter(spec: CharacterSpec): Character {
  const parts = useGLTF(spec.parts);
  const attachments = useGLTF((spec.attach ?? []).map((a) => a.url));
  const anims = useGLTF(spec.animations);

  return useMemo(() => {
    const root = new THREE.Group();
    const roots = parts.map((g) => cloneSkinned(g.scene) as THREE.Group);
    roots.forEach((r) => root.add(r));
    root.updateMatrixWorld(true);

    const bones = new Map<string, THREE.Bone>();
    roots[0].traverse((o) => { if ((o as THREE.Bone).isBone && !bones.has(o.name)) bones.set(o.name, o as THREE.Bone); });
    const bone = (n: string) => { const b = bones.get(n); if (!b) throw new Error(`no bone ${n}`); return b; };
    // every part follows the body's bones, so IK and lookAt on the body move the clothes too
    roots.slice(1).forEach((r) => r.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (!sm.isSkinnedMesh) return;
      sm.bind(new THREE.Skeleton(sm.skeleton.bones.map((b) => bones.get(b.name) ?? b), sm.skeleton.boneInverses), sm.bindMatrix);
    }));

    // attachments are authored in rest pose, so parent them before any animation runs
    (spec.attach ?? []).forEach((a, i) => {
      const obj = attachments[i].scene.clone(true);
      if (a.tint) obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color.set(a.tint!); m.material = mat; }
      });
      root.add(obj);
      root.updateMatrixWorld(true);
      bone(a.bone).attach(obj);
    });

    if (spec.tints) root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && spec.tints![m.name]) { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.MeshStandardMaterial).color.set(spec.tints![m.name]); }
    });
    if (spec.paint) root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && spec.paint![m.name]) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.map = null; mat.color.set(spec.paint![m.name]); m.material = mat; }
    });
    toonify(root, { outline: spec.outline ?? 0.008 });

    // rest orientation of each bone relative to the character, used by lookAt
    const rootInv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    bones.forEach((b) => { b.userData.rest = rootInv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())); });

    const clips = anims.flatMap((g) => g.animations);
    const mixers = [new THREE.AnimationMixer(roots[0])];
    const actions = mixers.map((mx) => new Map(clips.map((c) => [c.name, mx.clipAction(c)])));
    actions.forEach((m) => m.forEach((a) => { a.play(); a.setEffectiveWeight(0); }));

    return {
      root,
      bone,
      clips: clips.map((c) => c.name),
      pose(samples: ClipSample[]) {
        actions.forEach((map, i) => {
          map.forEach((a) => { a.setEffectiveWeight(0); a.enabled = false; });
          for (const s of samples) {
            const a = map.get(s.clip);
            if (!a) throw new Error(`no clip ${s.clip}`);
            const d = a.getClip().duration;
            a.enabled = true;
            a.setEffectiveWeight(s.weight);
            a.time = s.loop ? ((s.time % d) + d) % d : Math.min(s.time, d - 1e-4);
          }
          mixers[i].update(0);
        });
        root.updateMatrixWorld(true);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, attachments, anims]);
}

const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _w = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qt = new THREE.Quaternion();
/**
 * Turn a bone (head, neck, chest) towards a world point on top of the animated pose.
 * The turn is measured from where the bone currently aims (the character's facing,
 * carried through the animated pose), limited to `max` radians and blended in by `weight`.
 * Called on neck then head, the head only closes what the neck left, so turns never stack.
 */
export function lookAt(bone: THREE.Bone, facing: THREE.Object3D, target: THREE.Vector3, weight = 1, max = 0.9) {
  if (weight <= 0) return;
  bone.updateWorldMatrix(true, false);
  bone.getWorldPosition(_p);
  const world = bone.getWorldQuaternion(_qb);
  const rest: THREE.Quaternion | undefined = bone.userData.rest;
  if (rest) _f.set(0, 0, 1).applyQuaternion(_qa.copy(rest).invert()).applyQuaternion(world);
  else _f.set(0, 0, 1).applyQuaternion(facing.getWorldQuaternion(_qa));
  _w.copy(target).sub(_p).normalize();
  _qt.setFromUnitVectors(_f, _w);
  const angle = 2 * Math.acos(Math.min(1, Math.abs(_qt.w)));
  if (angle > max) _qt.slerp(_qa.identity(), 1 - max / angle).normalize();
  _qt.slerp(_qa.identity(), 1 - weight);
  world.premultiply(_qt);
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(_qa).invert().multiply(world));
  bone.updateMatrixWorld(true);
}
