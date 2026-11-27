import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { publicUrl } from '../../engine/types';
import type { BusModel } from './bus';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water as MirrorWater } from 'three/addons/objects/Water.js';
import { useStoryFrame } from '../../engine/clock';
import { MOBILE } from '../../engine/Player';
import { noiseNormalMap } from '../../engine/look';
import { smoothstep } from '../../engine/timeline';
import { B, BUS_S } from './script';
import { BUS, C, ROUTE_LENGTH, routePose } from './world';
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
      u.turbidity.value = 4; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
      u.cloudCoverage.value = 0.45; u.cloudDensity.value = 0.5; u.cloudScale.value = 0.00035;
      // the scattering model is far brighter than the lit scene: bring it down to match
      s.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * 0.11, 1.0 );'); };
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
    scene.environmentIntensity = 1.5;
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
    sun.current!.intensity = 2.5 - lowSun * 0.9;
    hemi.current!.intensity = 0.25;
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

/** Wake samples: where the bus was, every WAKE_DT seconds, for the last WAKE_N of them. */
const WAKE_N = 48, WAKE_DT = 0.25;

/**
 * The bus's wake, worked out from its own path (no fluid simulation, so every render
 * matches). Each past position sends out a ring of ripples; because the bus outruns the
 * ripples, the rings stack into the V behind it. Starting and stopping send bigger rings,
 * and a band of foam hugs the hull, heaviest at the bow when it moves.
 */
const WAKE_GLSL = /* glsl */ `
uniform vec4 uWake[${WAKE_N}];   // xz position, age (s), strength
uniform vec4 uHull;              // xz centre, heading, speed
float wakeFoam;
vec2 wakeSlope(vec2 p) {
  vec2 g = vec2(0.0);
  wakeFoam = 0.0;
  for (int i = 0; i < ${WAKE_N}; i++) {
    vec4 w = uWake[i];
    if (w.w <= 0.0) continue;
    vec2 d = p - w.xy;
    float r = length(d) + 1e-4;
    float front = 0.25 + w.z * 1.15;           // ripples travel about a metre a second
    float x = r - front;
    // churned water left on the bus's track, fading over a few seconds
    wakeFoam += w.w * smoothstep(1.1, 0.2, r) * exp(-w.z * 0.9) * 0.9;
    if (abs(x) > 1.2) continue;
    // thin rings: they only pile up where neighbours touch, which is the V's two arms
    float env = exp(-x * x * 5.0) * w.w * exp(-w.z * 0.18) / (1.0 + r * 0.25);
    float k = 6.0;
    // slope of env * sin(k x), along the ring's outward direction
    float dh = env * (k * cos(k * x) - 10.0 * x * sin(k * x));
    g += dh * d / r;
    wakeFoam += env * max(0.0, sin(k * x)) * smoothstep(2.0, 0.0, w.z) * 0.8;
  }
  // foam round the hull: a band just outside the body, wider at the bow when moving
  vec2 q = p - uHull.xy;
  float c = cos(uHull.z), s = sin(uHull.z);
  vec2 l = vec2(c * q.x - s * q.y, s * q.x + c * q.y);   // x across the bus, y along it
  vec2 e = abs(l) - vec2(1.0, 2.4);
  float out_ = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);
  float bow = smoothstep(0.5, 2.4, l.y) * uHull.w;
  wakeFoam += smoothstep(0.25 + bow * 0.12, 0.0, out_) * (0.35 + min(uHull.w, 4.0) * 0.18);
  return g;
}
`;

/** Murky floodwater that mirrors the street, with small ripples, a sun path and the bus's wake. */
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
    const m = w.material;
    m.uniforms.size.value = 7;
    m.uniforms.uWake = { value: Array.from({ length: WAKE_N }, () => new THREE.Vector4()) };
    m.uniforms.uHull = { value: new THREE.Vector4() };
    m.fragmentShader = m.fragmentShader
      .replace('void main() {', WAKE_GLSL + 'void main() {')
      .replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );', `vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
        vec2 wg = wakeSlope( worldPosition.xz );
        surfaceNormal = normalize( surfaceNormal + vec3( -wg.x, 0.0, -wg.y ) * 0.3 );`)
      .replace('vec3 outgoingLight = albedo;', `vec3 outgoingLight = albedo;
        // foam: broken up by the ripple texture, lit by the sky
        float froth = smoothstep(0.2, 0.7, wakeFoam * (0.7 + 0.9 * noise.x));
        outgoingLight = mix( outgoingLight, vec3(0.78, 0.8, 0.78) * (0.5 + 0.5 * sunColor), clamp(froth, 0.0, 0.85) );`);
    m.needsUpdate = true;
    return w;
  }, []);
  useStoryFrame(({ t, idle }) => {
    const { day } = B.at(t);
    const u = water.material.uniforms;
    u.time.value = idle * 0.35;
    u.sunDirection.value.fromArray(SUN_DIR.sample(day)).normalize();
    col(SKY.sun, day, u.sunColor.value).multiplyScalar(0.45);
    // wake samples on a fixed grid of story time, so a frame is the same however you reach it
    const speed = (tt: number) => (BUS_S.sample(tt + 0.1) - BUS_S.sample(tt - 0.1)) / 0.2;
    const t0 = Math.floor(t / WAKE_DT) * WAKE_DT;
    (u.uWake.value as THREE.Vector4[]).forEach((v, i) => {
      const te = t0 - i * WAKE_DT;
      if (te < 0) { v.set(0, 0, 0, 0); return; }
      const p = routePose(BUS_S.sample(te));
      const sp = Math.abs(speed(te)), acc = Math.abs(speed(te + 0.2) - speed(te - 0.2)) / 0.4;
      // a slow rocking ring even at rest, more with speed, more again when it starts or stops
      v.set(p.pos.x, p.pos.z, t - te, 0.05 + Math.min(sp, 5) * 0.06 + Math.min(acc, 3) * 0.08);
    });
    const p = routePose(BUS_S.sample(t));
    u.uHull.value.set(p.pos.x, p.pos.z, p.heading, Math.abs(speed(t)));
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

const prop = (name: string) => publicUrl(`assets/props/${name}.glb`);

/**
 * The VW T3 body in place of the panel-built one. The cabin (seats, dash, wheel) stays,
 * so the people inside still sit where the script puts them; the painted windows are made
 * see-through so you can see them.
 */
const CABIN_DROP = 0.42;
/** The T3's sliding door, cut from its body, for the scene to slide open. */
export const doorPanels = new WeakMap<BusModel, THREE.Group>();
/** Where the T3's texture paints its windows (a grey-green): 1 on glass, 0 on bodywork. */
const GLASSY = `float glassy(vec3 c) {
  return smoothstep(0.0, 0.03, c.g - c.r) * smoothstep(-0.01, 0.02, c.b - c.r) * step(max(c.g, c.b), 0.8);
}
`;
/** Half turns to put the T3's nose at bus-space +z. */
const T3_TURN = Math.PI;
export function RealBusBody({ model }: { model: BusModel }) {
  const gltf = useGLTF(prop('vw-t3'));
  useMemo(() => {
    for (const c of model.shell.children) if (c !== model.cabin) c.visible = false;
    // the T3 is lower than the panel bus: drop the cabin and the seats with it
    model.cabin.position.y = -CABIN_DROP;
    model.driverSeat.y -= CABIN_DROP; model.passengerSeat.y -= CABIN_DROP;
    model.door.visible = false;
    // no front bench on the kerb side: it would stand between the doorway and the driver
    for (const c of model.cabin.children) if (Math.abs(c.position.x + 0.45) < 0.01) c.visible = false;
    // daylight bouncing in through the glass: a soft fill at the windscreen and one down the
    // aisle, so faces and hands inside read in every shot (no shadows; the body still shades)
    for (const [x, y, z, i] of [[0.2, 1.75, 2.0, 2.2], [0, 1.85, -0.4, 1.6]]) {
      const l = new THREE.PointLight('#fff1dd', i * 1.4, 3.2, 1.6);
      l.position.set(x, y, z);
      model.cabin.add(l);
    }
    for (const c of model.group.children) if ((c as THREE.Mesh).isMesh) c.visible = false;
    const body = gltf.scene.clone();
    // measure the body alone: the details mesh carries a wide ground-shadow card
    const shape = () => { let o: THREE.Object3D = body; body.traverse((x) => { if (/body/i.test(x.name) && (x as THREE.Mesh).isMesh) o = x; }); return new THREE.Box3().setFromObject(o, true); };
    // the model stands at an angle in its own file: turn it square (smallest footprint),
    // then so its long side runs along z
    let best = 0, area = Infinity;
    for (let a = 0; a < 180; a += 1) {
      body.rotation.y = THREE.MathUtils.degToRad(a); body.updateMatrixWorld(true);
      const sz = shape().getSize(new THREE.Vector3());
      if (sz.x * sz.z < area) { area = sz.x * sz.z; best = body.rotation.y; }
    }
    body.rotation.y = best; body.updateMatrixWorld(true);
    { const sz = shape().getSize(new THREE.Vector3()); if (sz.x > sz.z) body.rotation.y += Math.PI / 2; }
    body.rotation.y += T3_TURN;
    body.updateMatrixWorld(true);
    const b2 = shape(), s2 = b2.getSize(new THREE.Vector3());
    const k = (BUS.length + 0.1) / s2.z;
    body.scale.multiplyScalar(k);
    body.updateMatrixWorld(true);
    const b3 = shape(), c3 = b3.getCenter(new THREE.Vector3());
    body.position.set(-c3.x, -b3.min.y - 0.05, -c3.z);
    const meshes: THREE.Mesh[] = [];
    body.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    meshes.forEach((m) => {
      m.castShadow = m.receiveShadow = true;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      // the body is cut away where the windows are painted; a glass skin fills the holes
      mat.alphaTest = 0.5;
      mat.onBeforeCompile = (sh) => {
        sh.fragmentShader = GLASSY + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= 1.0 - glassy(diffuseColor.rgb);');
      };
      mat.customProgramCacheKey = () => 't3body';
      m.material = mat;
      const glass = new THREE.MeshStandardMaterial({ map: mat.map, color: '#d9e3e3', metalness: 1, roughness: 0.07, transparent: true, depthWrite: false, envMapIntensity: 1.4 });
      glass.onBeforeCompile = (sh) => {
        sh.fragmentShader = GLASSY + sh.fragmentShader
          .replace('#include <map_fragment>', `#include <map_fragment>
            float g = glassy(diffuseColor.rgb);
            // the painted dust on the glass, kept faintly
            float dust = clamp(dot(diffuseColor.rgb, vec3(0.33)) * 1.6 - 0.45, 0.0, 1.0);
            diffuseColor.rgb = vec3(0.86, 0.9, 0.9);`)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.05 + dust * 0.35;')
          .replace('#include <opaque_fragment>', `
            // reflections strongest at grazing angles, the cabin visible head on
            float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
            diffuseColor.a = g * clamp(0.14 + fres * 0.6 + dust * 0.12, 0.0, 0.9);
            #include <opaque_fragment>`);
      };
      glass.customProgramCacheKey = () => 't3glass';
      const skin = new THREE.Mesh(m.geometry, glass);
      skin.renderOrder = 2;
      m.add(skin);
    });
    model.group.add(body);
    model.headlights.visible = false;
    // the sliding door: a rectangle on the kerb side is cut out of the body, and a copy of the
    // body that keeps only that rectangle is the door panel, free to slide back along the side
    body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.group.matrixWorld).invert();
    // bus-space z from, z to, y from, y to: from behind the front door's pillar to the gutter
    const doorRect = { value: new THREE.Vector4(-0.3, 0.72, 0.1, 1.66) };
    const panel = new THREE.Group();
    const cutAway = (mat: THREE.Material, rel: THREE.Matrix4, keepInside: boolean, key: string) => {
      const prev = mat.onBeforeCompile.bind(mat);
      mat.onBeforeCompile = (sh, r) => {
        prev(sh, r);
        sh.uniforms.uRel = { value: rel };
        sh.uniforms.uDoor = doorRect;
        sh.vertexShader = 'uniform mat4 uRel;\nvarying vec3 vBus;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBus = (uRel * vec4(position, 1.0)).xyz;');
        sh.fragmentShader = 'uniform vec4 uDoor;\nvarying vec3 vBus;\n' + sh.fragmentShader.replace('void main() {', `void main() {
          bool inDoor = vBus.x < ${(-BUS.width / 2 + 0.35).toFixed(3)} && vBus.z > uDoor.x && vBus.z < uDoor.y && vBus.y > uDoor.z && vBus.y < uDoor.w;
          if (inDoor != ${keepInside}) discard;`);
      };
      mat.customProgramCacheKey = () => key;
    };
    for (const m of meshes) {
      const rel = inv.clone().multiply(m.matrixWorld);
      const skin = m.children[0] as THREE.Mesh;
      const dm = (m.material as THREE.Material).clone(), ds = (skin.material as THREE.Material).clone();
      dm.onBeforeCompile = (m.material as THREE.Material).onBeforeCompile; ds.onBeforeCompile = (skin.material as THREE.Material).onBeforeCompile;
      cutAway(m.material as THREE.Material, rel, false, 't3body-cut');
      cutAway(skin.material as THREE.Material, rel, false, 't3glass-cut');
      cutAway(dm, rel, true, 't3body-door');
      cutAway(ds, rel, true, 't3glass-door');
      const d = new THREE.Mesh(m.geometry, dm);
      d.applyMatrix4(rel);
      d.castShadow = d.receiveShadow = true;
      const sk = new THREE.Mesh(m.geometry, ds); sk.renderOrder = 2; d.add(sk);
      panel.add(d);
    }
    model.group.add(panel);
    doorPanels.set(model, panel);
  }, [gltf, model]);
  return null;
}

/** One street-facing building from a prop, its front on its local +z. */
interface Lot { url: string; part?: RegExp; width: number; depth: number; scale: number; sink: number; turn: number }
const LOTS: Lot[] = [
  { url: 'old-residential', width: 19.5, depth: 11.5, scale: 1, sink: 1.2, turn: 0 },
  { url: 'slum-house', width: 11.4, depth: 9.4, scale: 1, sink: 0.6, turn: 0 },
  ...['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => ({ url: 'modular-slums', part: new RegExp(`^${l}\\d`), width: 2.3 * 1.5, depth: 6.6 * 1.5, scale: 1.5, sink: 0.9, turn: 0 })),
];

/** Pull one building out of a prop: the whole model, or the pieces of a kit whose names match. */
function lotObject(scene: THREE.Object3D, lot: Lot) {
  let obj: THREE.Object3D;
  if (!lot.part) obj = scene.clone();
  else {
    obj = new THREE.Group();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (lot.part!.test(o.name)) { const c = o.clone(); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); obj.add(c); } });
  }
  const holder = new THREE.Group();
  obj.scale.multiplyScalar(lot.scale);
  obj.rotation.y = lot.turn;
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -b.min.y - lot.sink, -c.z);
  holder.add(obj);
  holder.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
  return { holder, width: b.max.x - b.min.x, depth: b.max.z - b.min.z };
}

/** The street from real buildings: a run of blocks, shacks and old flats down both sides. */
export function RealStreet() {
  const urls = ['old-residential', 'slum-house', 'modular-slums'];
  const gltfs = useGLTF(urls.map(prop));
  const g = useMemo(() => {
    const scenes = Object.fromEntries(urls.map((u, i) => [u, gltfs[i].scene]));
    const r = rng(53), g = new THREE.Group();
    for (const side of [1, -1] as const) {
      let s = -30;
      while (s < ROUTE_LENGTH + 40) {
        const pick = r();
        const lot = pick < 0.22 ? LOTS[0] : pick < 0.34 ? LOTS[1] : LOTS[2 + Math.floor(r() * 7)];
        const { holder, width, depth } = lotObject(scenes[lot.url], lot);
        const mid = s + width / 2;
        const p = routePose(THREE.MathUtils.clamp(mid, 0, ROUTE_LENGTH));
        const at = p.pos.clone().addScaledVector(p.right, side * (8.4 + depth / 2 + r() * 0.8));
        if (mid > ROUTE_LENGTH) at.addScaledVector(p.forward, mid - ROUTE_LENGTH);
        if (mid < 0) at.addScaledVector(p.forward, mid);
        holder.position.copy(at);
        // local +z (the front) faces the road
        holder.rotation.y = p.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        g.add(holder);
        s += width + 0.2 + r() * 0.8;
      }
    }
    return g;
  }, [gltfs]);
  return <primitive object={g} />;
}
