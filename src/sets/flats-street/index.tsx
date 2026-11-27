import * as THREE from 'three';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { publicUrl } from '../../engine/types';
import { buildBlock, type Block } from './block';
import { buildGenerator, buildStreet, FRONT, LENGTH } from './street';

export * from './block';
export * from './street';
export * from './props';

// A night street of walk-up flats: two blocks face each other across the road, flanked
// by older buildings. Block A is on the south side (z < 0), its front facing +z; block B
// is on the north side, facing -z. Both can be entered through their stairwells.

export interface FlatsStreet {
  group: THREE.Group;
  a: Block;
  b: Block;
}

/** The two blocks and the street, built once per scene. Positions are world-space. */
export function buildFlatsStreet(): FlatsStreet {
  const group = new THREE.Group();
  const a = buildBlock({ seed: 11, paint: '#b9ad94', trim: '#d3c9b3', lit: 0.35, roomPaint: '#8fa39a', roomFloor: '#7a6a58' });
  a.group.position.set(0, 0, -FRONT);
  const b = buildBlock({ seed: 23, paint: '#a7a89c', trim: '#c4c3b6', lit: 0.12, roomPaint: '#b5a88a', roomFloor: '#6a655c' });
  b.group.position.set(0, 0, FRONT);
  b.group.rotation.y = Math.PI;
  const gen = buildGenerator();
  gen.position.set(4.2, 0.15, -FRONT + 1.0);
  gen.rotation.y = 0.1;
  group.add(a.group, b.group, buildStreet(), gen);
  group.updateMatrixWorld(true);
  return { group, a, b };
}

const prop = (name: string) => publicUrl(`assets/props/${name}.glb`);

/** Older buildings either side of the two blocks, from the Objaverse props, fronts to the street. */
export function Neighbours() {
  const [res, slum] = useGLTF([prop('old-residential'), prop('slum-house')]);
  const g = useMemo(() => {
    const g = new THREE.Group();
    const place = (src: THREE.Object3D, x: number, side: 1 | -1, sink: number) => {
      const o = src.clone();
      o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
      o.position.set(-c.x, -b.min.y - sink, -c.z);
      const holder = new THREE.Group();
      holder.add(o);
      const depth = b.max.z - b.min.z;
      holder.position.set(x, 0, side * (FRONT + depth / 2 + 0.3));
      holder.rotation.y = side > 0 ? Math.PI : 0;
      holder.traverse((m) => { if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true; });
      g.add(holder);
    };
    place(res.scene, 18, -1, 1.2);
    place(slum.scene, -13.5, -1, 0.6);
    place(slum.scene, 13.5, 1, 0.6);
    place(res.scene, -18.5, 1, 1.2);
    place(res.scene, -38, -1, 1.2);
    place(res.scene, 38, 1, 1.2);
    return g;
  }, [res, slum]);
  return <primitive object={g} />;
}

/** A night sky dome: deep blue overhead, the city's orange glow at the horizon, stars, a moon. */
export function NightSky({ moon = new THREE.Vector3(-0.4, 0.55, 0.75) }: { moon?: THREE.Vector3 }) {
  const mesh = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uMoon: { value: moon.clone().normalize() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: /* glsl */ `
        uniform vec3 uMoon; varying vec3 vDir;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          float a = h(vec3(i, 1.)), b = h(vec3(i + vec2(1, 0), 1.)), c = h(vec3(i + vec2(0, 1), 1.)), d = h(vec3(i + 1., 1.));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir);
          float up = clamp(d.y, 0., 1.);
          vec3 col = mix(vec3(0.16, 0.11, 0.09), vec3(0.035, 0.05, 0.1), smoothstep(0.0, 0.35, up));
          col = mix(col, vec3(0.012, 0.018, 0.04), smoothstep(0.3, 1.0, up));
          // stars, fewer near the glowing horizon
          vec3 g = floor(d * 420.);
          float s = step(0.9975, h(g)) * smoothstep(0.15, 0.5, up) * (0.4 + 0.6 * h(g + 3.));
          col += s * 0.5;
          // thin cloud lit from below by the city
          vec2 cp = d.xz / max(d.y, 0.08) * 1.4;
          float cl = smoothstep(0.45, 0.85, vn(cp) * 0.6 + vn(cp * 2.7) * 0.4) * smoothstep(0.02, 0.25, up);
          col = mix(col, vec3(0.09, 0.075, 0.08), cl * 0.7);
          // the moon and its halo
          float m = dot(d, uMoon);
          col += vec3(0.9, 0.92, 1.0) * smoothstep(0.99955, 0.9997, m) * 1.6;
          col += vec3(0.25, 0.3, 0.42) * pow(max(m, 0.), 300.) * 0.6 * (1. - cl * 0.5);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(LENGTH * 6, 32, 16), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }, [moon]);
  return <primitive object={mesh} />;
}
