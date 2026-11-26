import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water as MirrorWater } from 'three/addons/objects/Water.js';
import { useStoryFrame } from '../../engine/clock';
import { MOBILE } from '../../engine/Player';
import { noiseNormalMap } from '../../engine/look';
import { smoothstep } from '../../engine/timeline';
import { B, BUS_S } from './script';
import { C, ROUTE_LENGTH, routePose } from './world';
import { colored, mergedMesh } from './city';
import { rng } from '../../engine/random';
import { SKY, SUN_DIR, col } from './Scene';

// The realistic look for Route 7 (`?look=real`): a scattering sky that also lights the
// scene, a reflective flood, and weathered surfaces on the buildings and the bus.

/** Sky with sun and clouds, the image-based light made from it, haze and the sun lamp. */
export function RealAtmosphere() {
  const { scene, gl } = useThree((s) => ({ scene: s.scene, gl: s.gl }));
  const { sky, envScene, pmrem } = useMemo(() => {
    const make = () => {
      const s = new Sky();
      s.scale.setScalar(1000);
      const u = s.material.uniforms;
      u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
      u.cloudCoverage.value = 0.45; u.cloudDensity.value = 0.5; u.cloudScale.value = 0.00035;
      // the scattering model is far brighter than the lit scene: bring it down to match
      s.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * 0.17, 1.0 );'); };
      return s;
    };
    const sky = make(), envSky = make(), envScene = new THREE.Scene();
    envScene.add(envSky);
    return { sky, envScene, envSky, pmrem: new THREE.PMREMGenerator(gl) };
  }, [gl]);
  const sun = useRef<THREE.DirectionalLight>(null), hemi = useRef<THREE.HemisphereLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const state = useMemo(() => ({ day: -1, env: null as THREE.WebGLRenderTarget | null, d: new THREE.Vector3(), c: new THREE.Color() }), []);
  useMemo(() => {
    scene.fog = new THREE.FogExp2('#c9b9b0', 0.0032);
    scene.add(target);
    scene.environmentIntensity = 2.4;
  }, [scene, target]);

  useStoryFrame(({ t }) => {
    const { day } = B.at(t);
    const dir = state.d.fromArray(SUN_DIR.sample(day)).normalize();
    for (const s of [sky, envScene.children[0] as Sky]) s.material.uniforms.sunPosition.value.copy(dir);
    // rebuild the image-based light only when the light has moved enough to show
    if (Math.abs(day - state.day) > 0.04) {
      state.day = day;
      state.env?.dispose();
      state.env = pmrem.fromScene(envScene as unknown as THREE.Scene, 0, 0.1, 1000);
      scene.environment = state.env.texture;
    }
    col(SKY.fog, day, (scene.fog as THREE.FogExp2).color).lerp(state.c.set('#a9b4bd'), 0.35);
    const lowSun = 1 - smoothstep(0.05, 0.6, dir.y);
    sun.current!.color.copy(col(SKY.sun, day, state.c)).lerp(new THREE.Color('#fff4e6'), 1 - lowSun);
    sun.current!.intensity = 3.2 - lowSun * 1.2;
    hemi.current!.intensity = 0.35;
    const p = routePose(BUS_S.sample(t)).pos;
    target.position.copy(p);
    sun.current!.position.copy(p).addScaledVector(dir, 80);
  });
  return (
    <>
      <primitive object={sky} />
      <hemisphereLight ref={hemi} args={['#cfd8e6', '#3a3a30', 0.35]} />
      <directionalLight ref={sun} target={target} castShadow
        shadow-mapSize={MOBILE ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.02}
        shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-near={1} shadow-camera-far={220} />
    </>
  );
}

/** Murky floodwater that mirrors the street, with small ripples and a sun path. */
export function RealWater() {
  const water = useMemo(() => {
    const normals = noiseNormalMap(256, 11, 1.2);
    const w = new MirrorWater(new THREE.PlaneGeometry(900, 900), {
      textureWidth: MOBILE ? 512 : 1024, textureHeight: MOBILE ? 512 : 1024,
      waterNormals: normals, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: '#ffffff',
      waterColor: '#2b2a1c', distortionScale: 0.55, fog: true, alpha: 1,
    });
    w.rotation.x = -Math.PI / 2;
    const c = routePose(ROUTE_LENGTH / 2).pos;
    w.position.set(c.x, 0, c.z);
    w.material.uniforms.size.value = 7;
    return w;
  }, []);
  useStoryFrame(({ t, idle }) => {
    const { day } = B.at(t);
    const u = water.material.uniforms;
    u.time.value = idle * 0.35;
    u.sunDirection.value.fromArray(SUN_DIR.sample(day)).normalize();
    col(SKY.sun, day, u.sunColor.value).multiplyScalar(0.45);
  });
  return <primitive object={water} />;
}

/**
 * Weathers the merged city mesh: plaster grime streaking down from the roofs and windows,
 * a wet dark band at the water line, glossy glass. All in the shader, from world position.
 */
export function weather(root: THREE.Object3D) {
  const glass = new THREE.Color(C.glassDark);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial || !mat.vertexColors) return;
    mat.roughness = 0.9;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGlass = { value: glass };
      sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `varying vec3 vWp; uniform vec3 uGlass;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.1; a *= .5; } return s; }
        ` + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          float isGlass = 1. - smoothstep(0.015, 0.06, distance(vColor.rgb, uGlass));
          vec2 wall = vec2(vWp.x + vWp.z, vWp.y);
          float streak = fbm(vec2(wall.x * 1.7, wall.y * 0.12)) * (0.6 + 0.8 * fbm(vec2(wall.x * 9., wall.y * 0.4)));
          float blotch = fbm(wall * 0.25 + 7.);
          float grime = clamp(streak * 1.8 + blotch * 0.7 - 0.85, 0., 1.);
          float wet = 1. - smoothstep(0.35, 1.6 + fbm(wall * 1.3) * 0.8, vWp.y);
          float plaster = 0.92 + 0.16 * fbm(wall * 7.);
          diffuseColor.rgb *= mix(plaster, 0.5, grime * (1. - isGlass));
          diffuseColor.rgb *= mix(1., 0.5, wet * (1. - isGlass));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 0.93, 0.85), blotch * 0.4);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(mix(0.92, 0.55, wet), 0.06, isGlass);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = isGlass * 0.5;`);
    };
    mat.customProgramCacheKey = () => 'weathered';
    mat.needsUpdate = true;
  });
}

/** Gloss for the bus: painted metal, chrome-ish trim, dull tyres and seats. */
export function polishBus(root: THREE.Object3D) {
  const paint = new THREE.Color(C.bus), stripe = new THREE.Color(C.busStripe), trim = new THREE.Color(C.busTrim);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh ? (m.material as THREE.MeshStandardMaterial) : null;
    if (!mat?.isMeshStandardMaterial) return;
    if (mat.color.equals(paint)) { mat.roughness = 0.38; mat.metalness = 0.15; }
    else if (mat.color.equals(trim)) { mat.roughness = 0.25; mat.metalness = 0.8; }
    else if (mat.color.equals(stripe)) mat.roughness = 0.5;
  });
}

/** The rest of the drowned city, out in the haze: blocks and a few towers in every direction. */
export function Skyline() {
  const mesh = useMemo(() => {
    const r = rng(29), parts: THREE.BufferGeometry[] = [];
    const tones = ['#b9b2a4', '#a7a49c', '#c4b49a', '#9c9a94', '#b7a58e'];
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = 70 + r() * r() * 330;
      const x = Math.cos(a) * d, z = -140 + Math.sin(a) * d * 1.4;
      if (Math.abs(x - 1.5) < 34 && z > -340 && z < 60) continue;
      const tower = r() > 0.9 && Math.abs(x) > 60, w = 8 + r() * 14, dd = 6 + r() * 12, h = tower ? 30 + r() * 45 : 4 + r() * r() * 18;
      const rot = Math.round(r() * 3) * 0.08;
      parts.push(colored(new THREE.BoxGeometry(w, h + 2, dd).rotateY(rot).translate(x, h / 2 - 1, z), tones[Math.floor(r() * tones.length)]));
      // a band of windows round every floor
      for (let y = 1.6; y < h - 1; y += 3) parts.push(colored(new THREE.BoxGeometry(w + 0.08, 1.2, dd + 0.08).rotateY(rot).translate(x, y, z), C.glassDark));
    }
    const m = mergedMesh(parts, 0);
    m.castShadow = false;
    weather(m);
    return m;
  }, []);
  return <primitive object={mesh} />;
}
