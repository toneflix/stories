import * as THREE from 'three';
import { publicUrl } from './types';

// Real surface detail from photographed textures (CC0, AmbientCG), projected from world
// position so they need no UVs: merged boxes and kit pieces tile at true scale and line up
// across seams. The colour texture is used as detail around its own average, so a
// material keeps its painted (vertex) colour and gains grain, wear, grout and weave.

/** Texture loads the film must wait for before its first frame. */
export const surfaceLoads: Promise<unknown>[] = [];

interface Maps { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture; mean: THREE.Vector4 }
const cache = new Map<string, Maps>();
const loader = new THREE.TextureLoader();

/** The average colour (rgb) and roughness (w) of an image, so detail can sit around 1. */
function average(img: HTMLImageElement | ImageBitmap) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img as CanvasImageSource, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  const s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k];
  return s.map((v) => v / (255 * 256));
}

function maps(id: string): Maps {
  if (cache.has(id)) return cache.get(id)!;
  const mean = new THREE.Vector4(0.5, 0.5, 0.5, 0.5);
  const load = (name: string, srgb: boolean, onImage?: (img: HTMLImageElement) => void) => {
    let done!: () => void;
    surfaceLoads.push(new Promise<void>((r) => (done = r)));
    const t = loader.load(publicUrl(`assets/textures/${id}/${name}.jpg`), (tex) => { try { onImage?.(tex.image as HTMLImageElement); } finally { done(); } }, undefined, () => done());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const m: Maps = {
    color: load('color', true, (img) => {
      // the mean in linear light, to match how the shader sees the texture
      const [r, g, b] = average(img).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      mean.x = r; mean.y = g; mean.z = b;
    }),
    normal: load('normal', false),
    rough: load('rough', false, (img) => { mean.w = average(img)[0]; }),
    mean,
  };
  cache.set(id, m);
  return m;
}

export interface SurfaceOptions {
  /** Metres covered by one repeat of the texture. */
  size?: number;
  /** How much of the texture's colour variation shows (0..1). */
  detail?: number;
  /** Depth of the surface relief from the normal map. */
  relief?: number;
  /** How much the texture varies the roughness (0..1). */
  sheen?: number;
}

/** Gives a lit material the photographed surface `id` (a folder in public/assets/textures). */
export function surface<M extends THREE.MeshStandardMaterial>(mat: M, id: string, { size = 1, detail = 1, relief = 1, sheen = 1 }: SurfaceOptions = {}) {
  const m = maps(id);
  const uniforms = {
    uSurfColor: { value: m.color }, uSurfNormal: { value: m.normal }, uSurfRough: { value: m.rough },
    uSurfMean: { value: m.mean }, uSurfSize: { value: size }, uSurfAmt: { value: new THREE.Vector3(detail, relief, sheen) },
  };
  const prev = mat.onBeforeCompile.bind(mat), prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vSurfP;\nvarying vec3 vSurfN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vSurfP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vSurfN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = SURFACE_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 surfW = surfWeights();
        vec3 surfC = surfTri(uSurfColor, surfW).rgb / max(uSurfMean.rgb, vec3(.02));
        diffuseColor.rgb *= mix(vec3(1.), surfC, uSurfAmt.x);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1., surfTri(uSurfRough, surfW).r / max(uSurfMean.w, .05), uSurfAmt.z), .04, 1.);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(surfNormal(surfW), 0.)).xyz);`);
  };
  mat.customProgramCacheKey = () => prevKey() + '|surface';
  mat.needsUpdate = true;
  return mat;
}

const SURFACE_GLSL = /* glsl */ `
uniform sampler2D uSurfColor, uSurfNormal, uSurfRough;
uniform vec4 uSurfMean;
uniform float uSurfSize;
uniform vec3 uSurfAmt;
varying vec3 vSurfP;
varying vec3 vSurfN;
vec3 surfWeights() { vec3 w = pow(abs(normalize(vSurfN)), vec3(4.)); return w / (w.x + w.y + w.z); }
vec4 surfTri(sampler2D t, vec3 w) {
  vec3 p = vSurfP / uSurfSize;
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
/** Whiteout-blended triplanar normal, in world space. */
vec3 surfNormal(vec3 w) {
  vec3 n = normalize(vSurfN), p = vSurfP / uSurfSize;
  vec3 tx = texture2D(uSurfNormal, p.zy).xyz * 2. - 1., ty = texture2D(uSurfNormal, p.xz).xyz * 2. - 1., tz = texture2D(uSurfNormal, p.xy).xyz * 2. - 1.;
  tx.xy *= uSurfAmt.y; ty.xy *= uSurfAmt.y; tz.xy *= uSurfAmt.y;
  vec3 s = sign(n);
  vec3 nx = vec3(tx.z * s.x, tx.y, tx.x * s.x);
  vec3 ny = vec3(ty.x, ty.z * s.y, ty.y * s.y);
  vec3 nz = vec3(tz.x * s.z, tz.y, tz.z * s.z);
  return normalize(nx * w.x + ny * w.y + nz * w.z);
}
`;
