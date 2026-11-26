import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// The house look: flat cel shading (a few hard light bands) plus ink outlines.

/** Light ramp for MeshToonMaterial: each value is one hard band of light. */
export function toonRamp(steps = [0.45, 0.75, 1.0]) {
  const data = new Uint8Array(steps.map((s) => Math.round(s * 255)));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
export const RAMP = toonRamp();
export const INK = new THREE.Color('#1c1226');

export const toon = (color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...extra });

/** Convert any glTF (PBR) material to cel shading, keeping its colour texture. */
export function toToon(m: THREE.Material): THREE.MeshToonMaterial {
  const s = m as THREE.MeshStandardMaterial;
  const out = new THREE.MeshToonMaterial({
    name: s.name, map: s.map ?? null, color: s.color?.clone() ?? new THREE.Color('#fff'), gradientMap: RAMP,
    transparent: s.transparent, alphaTest: s.alphaTest || (s.map && s.transparent ? 0.5 : 0), side: s.side,
  });
  if (out.alphaTest) out.transparent = false;
  return out;
}

const outlineMats = new Map<string, THREE.MeshBasicMaterial>();
/**
 * Ink outline by the inverted-hull trick: a back-face copy of the mesh pushed out along
 * its normals. Works for skinned meshes too (the push happens before skinning).
 * `thickness` is in world units.
 */
export function outlineMaterial(thickness: number, color: THREE.Color = INK) {
  const key = `${thickness.toFixed(5)}:${color.getHexString()}`;
  if (outlineMats.has(key)) return outlineMats.get(key)!;
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uInk = { value: thickness };
    sh.vertexShader = 'uniform float uInk;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * uInk;');
  };
  m.customProgramCacheKey = () => 'ink' + key;
  outlineMats.set(key, m);
  return m;
}

export function addOutline(mesh: THREE.Mesh, thickness: number, color?: THREE.Color) {
  if (!mesh.geometry.attributes.normal) return null;
  mesh.updateWorldMatrix(true, false);
  const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x || 1;
  const mat = outlineMaterial(thickness / scale, color);
  let hull: THREE.Mesh;
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
    const sm = mesh as THREE.SkinnedMesh;
    const h = new THREE.SkinnedMesh(sm.geometry, mat);
    h.bind(sm.skeleton, sm.bindMatrix);
    hull = h;
  } else {
    // hard-edged shapes (boxes, cones) need averaged normals or the hull cracks at corners
    hull = new THREE.Mesh(toCreasedNormals(mesh.geometry, Math.PI), mat);
  }
  hull.name = mesh.name + '_ink';
  hull.frustumCulled = false;
  hull.userData.ink = true;
  hull.raycast = () => {};
  mesh.add(hull); // inherits the mesh's transform; for skinned meshes the skeleton drives it
  if ((hull as THREE.SkinnedMesh).isSkinnedMesh) { hull.position.set(0, 0, 0); hull.quaternion.identity(); hull.scale.set(1, 1, 1); }
  return hull;
}

/** Cel-shade and outline everything under `root`. */
export function toonify(root: THREE.Object3D, { outline = 0.012, shadows = true }: { outline?: number; shadows?: boolean } = {}) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.ink) meshes.push(m); });
  for (const m of meshes) {
    m.material = Array.isArray(m.material) ? m.material.map(toToon) : toToon(m.material);
    m.castShadow = shadows; m.receiveShadow = shadows;
    m.frustumCulled = false;
    if (outline > 0) addOutline(m, outline);
  }
  return root;
}
