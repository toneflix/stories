import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared GLSL noise for the weathering shaders. */
const NOISE = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.1; a *= .5; } return s; }
`;

function withWorldPos(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.vertexShader = 'varying vec3 vWp;\nvarying vec3 vWn;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
    '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWn = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = 'varying vec3 vWp;\nvarying vec3 vWn;\n' + NOISE + sh.fragmentShader;
}

/**
 * Painted render on concrete, vertex-coloured: rain streaks under every ledge, damp
 * creeping up from the ground, blotches and patched plaster. All from world position,
 * so walls built in any order weather the same way.
 */
export function plaster() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  m.onBeforeCompile = (sh) => {
    withWorldPos(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // walls facing x use z as their across axis
      float across = abs(vWn.x) > 0.5 ? vWp.z : vWp.x;
      vec2 wall = vec2(across, vWp.y);
      float streak = fbm(vec2(wall.x * 2.3, wall.y * 0.15)) * (0.6 + 0.8 * fbm(vec2(wall.x * 11., wall.y * 0.5)));
      float blotch = fbm(wall * 0.35 + 3.);
      float grime = smoothstep(0.0, 0.9, streak * 1.4 + blotch * 0.7 - 0.85) * 0.75;
      float damp = 1. - smoothstep(0.2, 1.1 + fbm(wall * 1.7) * 0.9, vWp.y);
      float patchy = smoothstep(0.62, 0.66, fbm(wall * 0.6 + 11.));
      float up = step(0.5, vWn.y);
      diffuseColor.rgb *= (0.9 + 0.2 * fbm(wall * 9.)) * mix(1., 0.55, grime * (1. - up));
      diffuseColor.rgb *= mix(1., 0.6, damp);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.05, 0.98), patchy);`);
  };
  m.customProgramCacheKey = () => 'flats-plaster';
  return m;
}

/** Asphalt and paving: tar patches, cracks, wet sheen in the dips. */
export function ground() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    withWorldPos(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 g = vWp.xz;
        float patches = fbm(g * 0.18);
        float grit = fbm(g * 6.);
        float crack = smoothstep(0.03, 0.0, abs(fbm(g * 0.9) - 0.5)) * 0.6;
        diffuseColor.rgb *= (0.75 + 0.45 * patches) * (0.88 + 0.24 * grit) * (1. - crack);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float wet = smoothstep(0.55, 0.7, fbm(vWp.xz * 0.25 + 5.));
        roughnessFactor = mix(0.9, 0.18, wet);`);
  };
  m.customProgramCacheKey = () => 'flats-ground';
  return m;
}

/** Plain vertex-coloured surfaces: furniture, metal, wood. */
export const plain = (roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness });

/** One flat vertex colour on a geometry, so many parts can share one material and one draw. */
export function colored(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/** Collects coloured pieces per material, then merges each set into one mesh. */
export class Kit {
  private sets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  constructor(public mats: Record<string, THREE.Material>) {}
  add(mat: string, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    const m = this.mats[mat];
    if (!this.sets.has(m)) this.sets.set(m, []);
    this.sets.get(m)!.push(colored(geo, color));
    return this;
  }
  box(mat: string, color: THREE.ColorRepresentation, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
    return this.add(mat, new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z), color);
  }
  /** A box given by its min and max corners. */
  span(mat: string, color: THREE.ColorRepresentation, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    return this.box(mat, color, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  build(shadows = true) {
    const g = new THREE.Group();
    for (const [mat, geos] of this.sets) {
      const mesh = new THREE.Mesh(mergeGeometries(geos)!, mat);
      mesh.castShadow = mesh.receiveShadow = shadows;
      g.add(mesh);
    }
    return g;
  }
}
