import * as THREE from 'three';
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useClock } from './clock';

// Baked bounce light, the way games light their interiors: a grid of light probes per room,
// each holding the light arriving from every direction (L1 spherical harmonics). Lit
// materials inside a volume take their indirect light from the grid instead of the flat
// hemisphere fill, so a lamp warms the floor and walls around it and corners fall dark.
//
// Each light group is baked on its own, so a story can switch lamps on and off and the
// bounce follows. A bake can be saved and shipped with the set.

type V3 = [number, number, number];

export interface ProbeVolume {
  /** Interior bounds of the room, wall face to wall face. */
  min: V3;
  max: V3;
  /** Probe spacing in metres. */
  spacing?: number;
}

export interface LightGroup {
  name: string;
  /** Each light with the intensity it has when the group is fully on. */
  lights?: [THREE.Light, number][];
  /** This group is every other light in the scene, at its current intensity (fill lights excepted). */
  rest?: boolean;
  /** Indexes of the volumes this group's light reaches (default: all). */
  volumes?: number[];
  /** Times light bounces before it's stored (default 2). */
  bounces?: number;
}

const MAX_VOLUMES = 4;
/** Probes sit this far in from the walls, so their view isn't half wall. */
const INSET = 0.12;

interface Layout { min: THREE.Vector3; max: THREE.Vector3; n: THREE.Vector3; z0: number; count: number; offset: number }

export class ProbeField {
  readonly layouts: Layout[];
  readonly atlas: THREE.Vector3;
  readonly probeCount: number;
  /** Per group: 12 floats (4 RGB coefficients) per probe. */
  private baked = new Map<string, Float32Array>();
  private level = new Map<string, number>();
  private textures: THREE.Data3DTexture[];
  private dirty = true;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(volumes: ProbeVolume[], readonly groups: LightGroup[]) {
    if (volumes.length > MAX_VOLUMES) throw new Error(`at most ${MAX_VOLUMES} probe volumes`);
    let z0 = 0, offset = 0;
    this.layouts = volumes.map((v) => {
      const min = new THREE.Vector3(...v.min), max = new THREE.Vector3(...v.max), sp = v.spacing ?? 0.5;
      const size = max.clone().sub(min).subScalar(INSET * 2);
      const n = new THREE.Vector3(Math.max(2, Math.round(size.x / sp) + 1), Math.max(2, Math.round(size.y / sp) + 1), Math.max(2, Math.round(size.z / sp) + 1));
      const l = { min, max, n, z0, count: n.x * n.y * n.z, offset };
      z0 += n.z; offset += l.count;
      return l;
    });
    this.probeCount = offset;
    this.atlas = new THREE.Vector3(Math.max(...this.layouts.map((l) => l.n.x)), Math.max(...this.layouts.map((l) => l.n.y)), z0);
    for (const g of groups) this.level.set(g.name, 1);
    const { x, y, z } = this.atlas;
    this.textures = [0, 1, 2].map(() => {
      const t = new THREE.Data3DTexture(new Float32Array(x * y * z * 4), x, y, z);
      t.format = THREE.RGBAFormat; t.type = THREE.FloatType;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
      t.unpackAlignment = 1;
      return t;
    });
    const pad = <T,>(a: T[], fill: T) => [...a, ...Array(MAX_VOLUMES - a.length).fill(fill)];
    this.uniforms = {
      uProbe0: { value: this.textures[0] }, uProbe1: { value: this.textures[1] }, uProbe2: { value: this.textures[2] },
      uPvMin: { value: pad(this.layouts.map((l) => l.min.clone().addScalar(INSET)), new THREE.Vector3()) },
      uPvMax: { value: pad(this.layouts.map((l) => l.max.clone().subScalar(INSET)), new THREE.Vector3()) },
      uPvBoxMin: { value: pad(this.layouts.map((l) => l.min), new THREE.Vector3(1e9, 1e9, 1e9)) },
      uPvBoxMax: { value: pad(this.layouts.map((l) => l.max), new THREE.Vector3(-1e9, -1e9, -1e9)) },
      uPvN: { value: pad(this.layouts.map((l) => l.n), new THREE.Vector3(2, 2, 2)) },
      uPvZ0: { value: pad(this.layouts.map((l) => l.z0), 0) },
      uPvAtlas: { value: this.atlas },
      uPvOn: { value: 0 },
    };
  }

  /** Where probe i of volume v sits. */
  private probeAt(l: Layout, i: number, out: THREE.Vector3) {
    const ix = i % l.n.x, iy = Math.floor(i / l.n.x) % l.n.y, iz = Math.floor(i / (l.n.x * l.n.y));
    const a = l.min.clone().addScalar(INSET), b = l.max.clone().subScalar(INSET);
    return out.set(a.x + ((b.x - a.x) * ix) / (l.n.x - 1), a.y + ((b.y - a.y) * iy) / (l.n.y - 1), a.z + ((b.z - a.z) * iz) / (l.n.z - 1));
  }

  /** How much of a group's light is on (0..1); call every frame the lights change. */
  set(group: string, k: number) {
    if (this.level.get(group) !== k) { this.level.set(group, k); this.dirty = true; }
  }

  /** Mixes the groups at their levels into the textures the materials sample. */
  update() {
    if (!this.dirty || !this.baked.size) return;
    this.dirty = false;
    const sum = new Float32Array(this.probeCount * 12);
    for (const [name, data] of this.baked) {
      const k = this.level.get(name) ?? 0;
      if (k) for (let i = 0; i < sum.length; i++) sum[i] += data[i] * k;
    }
    const { x: ax, y: ay } = this.atlas;
    for (const l of this.layouts) {
      for (let i = 0; i < l.count; i++) {
        const ix = i % l.n.x, iy = Math.floor(i / l.n.x) % l.n.y, iz = Math.floor(i / (l.n.x * l.n.y));
        const dst = ((l.z0 + iz) * ay * ax + iy * ax + ix) * 4, src = (l.offset + i) * 12;
        for (let t = 0; t < 3; t++) (this.textures[t].image.data as Float32Array).set(sum.subarray(src + t * 4, src + t * 4 + 4), dst);
      }
    }
    for (const t of this.textures) t.needsUpdate = true;
    this.uniforms.uPvOn.value = 1;
  }

  /**
   * Renders the scene from every probe, once per light group, `bounces` times (each pass
   * sees the bounce baked by the one before). Glowing bulbs and shades are hidden, since
   * their light is already in the lights themselves.
   */
  async bake(renderer: THREE.WebGLRenderer, scene: THREE.Scene, { bounces = 2, size = 8 } = {}) {
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.FloatType });
    const project = shProjector(size), pixels = new Float32Array(size * size * 4);
    const cam = new THREE.CubeCamera(0.03, 200, rt);
    const lights: THREE.Light[] = [];
    scene.traverse((o) => { if ((o as THREE.Light).isLight) lights.push(o as THREE.Light); });
    const saved = lights.map((l) => l.intensity);
    const hidden: THREE.Object3D[] = [], glow: [THREE.MeshStandardMaterial, number][] = [];
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material & { emissiveIntensity?: number };
      if (!m || Array.isArray(m)) return;
      if (m.toneMapped === false && o.visible) { hidden.push(o); o.visible = false; }
      if (m.emissiveIntensity) { glow.push([m as THREE.MeshStandardMaterial, m.emissiveIntensity]); m.emissiveIntensity = 0; }
    });
    // only what's near the rooms shows in their probes
    const reach = new THREE.Box3();
    for (const l of this.layouts) reach.expandByPoint(l.min).expandByPoint(l.max);
    reach.expandByScalar(4);
    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh || !o.visible || (o as THREE.SkinnedMesh).isSkinnedMesh) return;
      if (!reach.intersectsBox(box.setFromObject(o))) { hidden.push(o); o.visible = false; }
    });
    const tm = renderer.toneMapping, shadowAuto = renderer.shadowMap.autoUpdate;
    renderer.toneMapping = THREE.NoToneMapping;
    // shadow maps depend only on where things are: draw them once, not for every cube face
    renderer.render(scene, cam.children[0] as THREE.Camera);
    renderer.shadowMap.autoUpdate = false;
    const named = new Set(this.groups.flatMap((g) => (g.lights ?? []).map(([l]) => l)));
    const fill = (l: THREE.Light) => (l as THREE.HemisphereLight).isHemisphereLight || (l as THREE.AmbientLight).isAmbientLight;
    const p = new THREE.Vector3();
    try {
      for (const g of this.groups) {
        lights.forEach((l, i) => (l.intensity = g.rest && !named.has(l) && !fill(l) ? saved[i] : 0));
        for (const [l, k] of g.lights ?? []) l.intensity = k;
        let prev: Float32Array | null = null;
        for (let b = 0; b < (g.bounces ?? bounces); b++) {
          // light the scene with only this group's previous bounce
          if (prev) { this.baked = new Map([[g.name, prev]]); for (const n of this.level.keys()) this.level.set(n, n === g.name ? 1 : 0); this.dirty = true; this.update(); }
          else this.uniforms.uPvOn.value = 0;
          const out = new Float32Array(this.probeCount * 12);
          for (const [vi, l] of this.layouts.entries()) {
            if (g.volumes && !g.volumes.includes(vi)) continue;
            for (let i = 0; i < l.count; i++) {
              cam.position.copy(this.probeAt(l, i, p));
              cam.update(renderer, scene);
              const o = (l.offset + i) * 12;
              for (let face = 0; face < 6; face++) {
                renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels, face);
                project(face, pixels, out, o);
              }
            }
          }
          prev = out;
          await new Promise((r) => setTimeout(r));
          console.warn(`probes: ${g.name} bounce ${b + 1} done`);
        }
        this.bakedAll.set(g.name, prev!);
      }
    } finally {
      lights.forEach((l, i) => (l.intensity = saved[i]));
      hidden.forEach((o) => (o.visible = true));
      glow.forEach(([m, k]) => (m.emissiveIntensity = k));
      renderer.toneMapping = tm;
      renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.shadowMap.needsUpdate = true;
      rt.dispose();
    }
    this.baked = this.bakedAll;
    for (const g of this.groups) this.level.set(g.name, 1);
    this.dirty = true;
    this.update();
  }
  private bakedAll = new Map<string, Float32Array>();

  /** The bake as bytes: a JSON header line, then each group's floats. */
  serialize() {
    const head = new TextEncoder().encode(JSON.stringify({ key: this.key(), groups: [...this.baked.keys()] }) + '\n');
    const pad = (4 - (head.length % 4)) % 4;
    const body = new Float32Array(this.baked.size * this.probeCount * 12);
    [...this.baked.values()].forEach((d, i) => body.set(d, i * this.probeCount * 12));
    const out = new Uint8Array(head.length + pad + body.byteLength);
    out.set(head); out.fill(32, head.length, head.length + pad); out.set(new Uint8Array(body.buffer), head.length + pad);
    return out;
  }

  /** Loads a saved bake; false if it was made for different volumes or groups. */
  load(bytes: ArrayBuffer) {
    const u8 = new Uint8Array(bytes), nl = u8.indexOf(10);
    const head = JSON.parse(new TextDecoder().decode(u8.subarray(0, nl)));
    if (head.key !== this.key()) return false;
    let at = nl + 1;
    at += (4 - (at % 4)) % 4;
    const body = new Float32Array(bytes, at);
    head.groups.forEach((n: string, i: number) => this.baked.set(n, body.slice(i * this.probeCount * 12, (i + 1) * this.probeCount * 12)));
    this.dirty = true;
    this.update();
    return true;
  }

  /** Identifies the layout and groups a bake belongs to. */
  key() {
    return JSON.stringify([this.layouts.map((l) => [l.min.toArray(), l.max.toArray(), l.n.toArray()]), this.groups.map((g) => g.name)]);
  }

  /** Makes every lit material under `root` take its indirect light from the probes. */
  apply(root: THREE.Object3D) {
    root.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) this.patch(m);
    });
  }

  private patch(m: THREE.Material) {
    if (m.userData.probes || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial && !(m as THREE.MeshLambertMaterial).isMeshLambertMaterial) return;
    m.userData.probes = true;
    const prev = m.onBeforeCompile.bind(m), prevKey = m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = 'varying vec3 vProbeP;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nvProbeP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = PROBE_GLSL + sh.fragmentShader.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        {
          float pw;
          vec3 pe = probeIrradiance(vProbeP, inverseTransformDirection(normal, viewMatrix), pw);
          irradiance = irradiance * (1. - pw) + pe;
        }`);
    };
    m.customProgramCacheKey = () => prevKey() + '|probes';
    m.needsUpdate = true;
  }
}

/**
 * Projects cube faces onto L1 spherical harmonics, adding into out[o..o+12] (4 RGB
 * coefficients), weighted by each texel's solid angle. Same convention as three's LightProbe.
 */
function shProjector(size: number) {
  const table = new Float32Array(6 * size * size * 4);
  const c = new THREE.Vector3();
  let total = 0;
  for (let face = 0; face < 6; face++) for (let p = 0; p < size * size; p++) {
    const col = -(1 - ((p % size) + 0.5) * (2 / size)), row = 1 - (Math.floor(p / size) + 0.5) * (2 / size);
    switch (face) {
      case 0: c.set(1, row, -col); break;
      case 1: c.set(-1, row, col); break;
      case 2: c.set(col, 1, -row); break;
      case 3: c.set(col, -1, row); break;
      case 4: c.set(col, row, 1); break;
      default: c.set(-col, row, -1);
    }
    const len2 = c.lengthSq(), w = 4 / (Math.sqrt(len2) * len2);
    total += w;
    c.normalize();
    table.set([0.282095 * w, 0.488603 * c.y * w, 0.488603 * c.z * w, 0.488603 * c.x * w], (face * size * size + p) * 4);
  }
  const norm = (4 * Math.PI) / total;
  for (let i = 0; i < table.length; i++) table[i] *= norm;
  return (face: number, px: Float32Array, out: Float32Array, o: number) => {
    const base = face * size * size * 4;
    for (let p = 0, n = size * size; p < n; p++) {
      const r = px[p * 4], g = px[p * 4 + 1], b = px[p * 4 + 2];
      for (let k = 0; k < 4; k++) {
        const w = table[base + p * 4 + k];
        out[o + k * 3] += r * w; out[o + k * 3 + 1] += g * w; out[o + k * 3 + 2] += b * w;
      }
    }
  };
}

const PROBE_GLSL = /* glsl */ `
precision highp sampler3D;
#define PV ${MAX_VOLUMES}
uniform sampler3D uProbe0, uProbe1, uProbe2;
uniform vec3 uPvMin[PV], uPvMax[PV], uPvBoxMin[PV], uPvBoxMax[PV], uPvN[PV], uPvAtlas;
uniform float uPvZ0[PV], uPvOn;
varying vec3 vProbeP;
vec3 probeIrradiance(vec3 p, vec3 n, out float w) {
  w = 0.;
  if (uPvOn < .5) return vec3(0.);
  for (int i = 0; i < PV; i++) {
    // full weight inside the room and on its walls, none a hand's width beyond
    vec3 out3 = max(uPvBoxMin[i] - p, p - uPvBoxMax[i]);
    float outside = max(out3.x, max(out3.y, out3.z));
    if (outside > .1) continue;
    vec3 l = clamp((p - uPvMin[i]) / (uPvMax[i] - uPvMin[i]), 0., 1.);
    vec3 cell = l * (uPvN[i] - 1.) + .5;
    cell.z += uPvZ0[i];
    vec3 uvw = cell / uPvAtlas;
    vec4 a = texture(uProbe0, uvw), b = texture(uProbe1, uvw), c = texture(uProbe2, uvw);
    vec3 c0 = a.rgb, c1 = vec3(a.a, b.rg), c2 = vec3(b.ba, c.r), c3 = c.gba;
    w = 1. - smoothstep(.02, .1, outside);
    return max(vec3(0.), c0 * .886227 + 1.023328 * (c1 * n.y + c2 * n.z + c3 * n.x)) * w;
  }
  return vec3(0.);
}
`;

/**
 * Lights the scene's interiors from `field`: loads the bake at `url` if it matches,
 * otherwise bakes now (slow; exposes the bytes as window.__probeBake for tools/bake-light.mjs).
 * Holds the film's start until the light is ready.
 */
export function BakedLight({ field, url }: { field: ProbeField; url?: string }) {
  const { gl, scene } = useThree();
  const clock = useClock();
  useEffect(() => {
    clock.waitFor((async () => {
      let ok = false;
      if (url && !new URLSearchParams(location.search).has('rebake')) {
        try {
          const res = await fetch(url);
          if (res.ok) ok = field.load(await res.arrayBuffer());
        } catch { /* no bake yet */ }
      }
      if (!ok && new URLSearchParams(location.search).get('bake') === '0') return;
      if (!ok) {
        console.warn('baking light probes…');
        const t0 = performance.now();
        await field.bake(gl, scene);
        console.warn(`light probes baked in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
        (window as unknown as { __probeBake: Uint8Array }).__probeBake = field.serialize();
      }
      field.apply(scene);
    })());
  }, [field, url, gl, scene, clock]);
  useFrame(() => field.update(), -5);
  return null;
}
