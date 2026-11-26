import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useStoryFrame, useHitTarget } from '../../engine/clock';
import { useCharacter, lookAt } from '../../engine/character';
import { solveTwoBone } from '../../engine/ik';
import { NarratorCamera } from '../../engine/camera';
import { publicUrl } from '../../engine/types';
import { MOBILE } from '../../engine/Player';
import { toon, toonify } from '../../engine/toon';
import { rng } from '../../engine/random';
import { Track, smoothstep, lerp, clamp } from '../../engine/timeline';
import { B, BUS_S, BOARDED, CAMERA, DRIVER_CLIPS, PASSENGER_CLIPS, FARE } from './script';
import { BUS, ROUTE_LENGTH, routePose, shelterPose, glowTexture } from './world';
import { buildCity, buildPalms, buildPoles, buildShelter, SHELTERS } from './city';
import { buildBus, type BusModel } from './bus';
import { REAL } from '../../engine/look';
import { RealAtmosphere, RealWater, Skyline, RealStreet, RealBusBody, weather, polishBus } from './real';

const asset = (p: string) => publicUrl(`assets/${p}`);

export function Scene() {
  const model = useMemo(() => { const m = buildBus(); if (REAL) polishBus(m.group); return m; }, []);
  return (
    <>
      <NarratorCamera keys={CAMERA} shake={0.5} />
      {REAL ? <RealAtmosphere /> : <Atmosphere />}
      {REAL ? <RealWater /> : <Water />}
      <City />
      {REAL && <Skyline />}
      {REAL && <RealStreet />}
      {REAL && <RealBusBody model={model} />}
      {SHELTERS.map((i) => <Shelter key={i} i={i} />)}
      <Debris />
      <Bus model={model} />
      <Wake />
      <Driver model={model} />
      <Passenger model={model} />
    </>
  );
}

// ------------------------------------------------------------------ time of day
/** Palettes at day = 0 (dawn), 1 (midday), 2 (sunset), 2.4 (dusk). */
const DAY = [0, 1, 2, 2.4];
const palette = (cols: string[]) => new Track<number[]>(cols.map((c, i) => ({ t: DAY[i], v: new THREE.Color(c).toArray(), ease: 'linear' })));
export const SKY = {
  top: palette(['#5b6fa8', '#3f8fd8', '#4b4f8f', '#2a2a5a']),
  horizon: palette(['#f3b7a0', '#bfe3f2', '#ff9d5c', '#e0704f']),
  sun: palette(['#ffc9a3', '#fff6e0', '#ffb070', '#ff8a5a']),
  hemi: palette(['#b9b6e0', '#d6ecff', '#e9b6a6', '#9d88b8']),
  ground: palette(['#3b4a5a', '#5b6a60', '#5a3d4a', '#2c2438']),
  fog: palette(['#c8b2bb', '#bcd8e3', '#e0947a', '#8a5a6a']),
  shallow: palette(['#6f97a6', '#3fa0a8', '#c07a68', '#7a4d5c']),
  deep: palette(['#34586e', '#1f6475', '#4b3a5c', '#2e2440']),
};
const SUN_I = new Track<number>([{ t: 0, v: 1.3 }, { t: 1, v: 2.4 }, { t: 2, v: 1.8 }, { t: 2.4, v: 1.0 }].map((k) => ({ ...k, ease: 'linear' })));
/** Sun direction: low behind the bus at dawn, high at noon, low ahead of it at sunset. */
export const SUN_DIR = new Track<number[]>([
  { t: 0, v: [0.35, 0.18, 1] }, { t: 1, v: [0.4, 1.6, 0.3] }, { t: 2, v: [-0.08, 0.1, -1] }, { t: 2.4, v: [-0.08, 0.02, -1] },
].map((k) => ({ ...k, ease: 'linear' })));
export const col = (tr: Track<number[]>, d: number, out = new THREE.Color()) => out.fromArray(tr.sample(d));

function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uTop,uHorizon,uSun,uSunDir; varying vec3 vP;
      void main(){ float y = vP.y;
        vec3 c = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, y));
        float d = max(dot(vP, normalize(uSunDir)), 0.);
        c += uSun * (pow(d, 8.) * 0.35 + pow(d, 60.) * 0.6);
        // banded glow round the sun, in keeping with the cel look
        c += uSun * 0.08 * floor(pow(d, 3.) * 4.) / 4.;
        gl_FragColor = vec4(c, 1.); }`,
  }), []);
  const hemi = useRef<THREE.HemisphereLight>(null), sun = useRef<THREE.DirectionalLight>(null);
  const disc = useRef<THREE.Sprite>(null);
  const discTex = useMemo(() => glowTexture('#fff0c8', 0.55), []);
  const clouds = useMemo(() => {
    const r = rng(9), g = new THREE.Group();
    const mat = toon('#ffffff', { fog: false });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = 260 + r() * 80;
      const c = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + r() * 9, 2), mat);
        m.position.set((k - 2) * 12 + r() * 6, r() * 5, r() * 8);
        m.scale.y = 0.55;
        c.add(m);
      }
      c.position.set(Math.cos(a) * d, 45 + r() * 40, Math.sin(a) * d - 120);
      c.lookAt(0, c.position.y, -120);
      g.add(c);
    }
    return { g, mat };
  }, []);
  const target = useMemo(() => new THREE.Object3D(), []);
  useMemo(() => { scene.fog = new THREE.Fog('#c8b2bb', 60, 330); scene.add(target); }, [scene, target]);
  const tmp = useMemo(() => ({ c: new THREE.Color(), d: new THREE.Vector3() }), []);

  useStoryFrame(({ t }) => {
    const { day } = B.at(t);
    col(SKY.top, day, sky.uniforms.uTop.value);
    col(SKY.horizon, day, sky.uniforms.uHorizon.value);
    col(SKY.sun, day, sky.uniforms.uSun.value);
    const dir = tmp.d.fromArray(SUN_DIR.sample(day)).normalize();
    sky.uniforms.uSunDir.value.copy(dir);
    col(SKY.fog, day, (scene.fog as THREE.Fog).color);
    hemi.current!.color.copy(col(SKY.hemi, day, tmp.c));
    hemi.current!.groundColor.copy(col(SKY.ground, day, tmp.c));
    hemi.current!.intensity = lerp(2.0, 1.5, smoothstep(2, 2.4, day));
    sun.current!.color.copy(col(SKY.sun, day, tmp.c));
    sun.current!.intensity = SUN_I.sample(day);
    clouds.mat.color.copy(col(SKY.horizon, day, tmp.c)).lerp(new THREE.Color('#ffffff'), 0.55);
    // the shadow camera follows the bus
    const p = routePose(BUS_S.sample(t)).pos;
    target.position.copy(p);
    sun.current!.position.copy(p).addScaledVector(dir, 80);
    disc.current!.position.copy(dir).multiplyScalar(420).add(p);
    disc.current!.material.color.copy(col(SKY.sun, day, tmp.c));
    disc.current!.material.opacity = smoothstep(1.4, 1.9, day) + (1 - smoothstep(0.1, 0.5, day));
  });
  return (
    <>
      <mesh material={sky}><sphereGeometry args={[500, 32, 16]} /></mesh>
      <primitive object={clouds.g} />
      <sprite ref={disc} scale={70}><spriteMaterial map={discTex} fog={false} depthWrite={false} transparent toneMapped={false} /></sprite>
      <hemisphereLight ref={hemi} args={['#b9b6e0', '#3b4a5a', 1.5]} />
      <directionalLight ref={sun} target={target} intensity={1.5} castShadow
        shadow-mapSize={MOBILE ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0005}
        shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={1} shadow-camera-far={200} />
    </>
  );
}

// ------------------------------------------------------------------ the flood
function Water() {
  const scene = useThree((s) => s.scene);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSky: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFog: { value: new THREE.Color() }, uFogNear: { value: 60 }, uFogFar: { value: 330 },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT, uFogNear, uFogFar; uniform vec3 uShallow, uDeep, uSky, uSun, uSunDir, uFog; varying vec3 vW;
      float wave(vec2 p){ return sin(p.x*2.6 + uT*0.9 + sin(p.y*0.5 + uT*0.4)*2.2) * sin(p.y*0.9 - uT*0.55 + sin(p.x*0.7)*1.6); }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        float e = 0.08, h = wave(vW.xz);
        vec3 N = normalize(vec3(-(wave(vW.xz + vec2(e,0.)) - h) / e * 0.06, 1., -(wave(vW.xz + vec2(0.,e)) - h) / e * 0.06));
        float fres = pow(1. - max(dot(V, N), 0.), 4.);
        vec3 c = mix(uShallow, uDeep, smoothstep(0., 1., 1. - V.y) * 0.5);
        c = mix(c, uSky, floor(fres * 3.) / 3. * 0.7);
        // cel ripples: hard light and dark streaks
        float fade = 1. - smoothstep(20., 140., dist);
        c = mix(c, uSky * 1.05, step(0.9, h) * 0.35 * fade);
        c = mix(c, uDeep * 0.92, step(h, -0.93) * 0.25 * fade);
        // sun glitter
        vec3 R = reflect(-V, N);
        float g = pow(max(dot(R, normalize(uSunDir)), 0.), 300.);
        c += uSun * step(0.5, g) * 0.6 * fade;
        c = mix(c, uFog, smoothstep(uFogNear, uFogFar, dist));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), []);
  const center = routePose(ROUTE_LENGTH / 2).pos;
  useStoryFrame(({ t, idle }) => {
    const { day } = B.at(t);
    const u = mat.uniforms;
    u.uT.value = idle;
    col(SKY.shallow, day, u.uShallow.value);
    col(SKY.deep, day, u.uDeep.value);
    col(SKY.horizon, day, u.uSky.value);
    col(SKY.sun, day, u.uSun.value);
    u.uSunDir.value.fromArray(SUN_DIR.sample(day)).normalize();
    const fog = scene.fog as THREE.Fog;
    u.uFog.value.copy(fog.color); u.uFogNear.value = fog.near; u.uFogFar.value = fog.far;
  });
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position={[center.x, 0, center.z]} receiveShadow>
      <planeGeometry args={[900, 900]} />
    </mesh>
  );
}

function City() {
  const g = useMemo(() => {
    const g = new THREE.Group();
    g.add(...(REAL ? [] : [buildCity()]), buildPalms(), buildPoles());
    if (REAL) weather(g);
    return g;
  }, []);
  return <primitive object={g} />;
}

function Shelter({ i }: { i: number }) {
  const g = useMemo(() => buildShelter(i), [i]);
  return <primitive object={g} />;
}

/** Things the flood carried off: barrels, tyres, a plastic chair, planks. They bob. */
function Debris() {
  const items = useMemo(() => {
    const r = rng(17), out: { obj: THREE.Object3D; ph: number; y: number }[] = [];
    const g = new THREE.Group();
    const kinds = [
      () => new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14).rotateZ(Math.PI / 2), toon(['#2f6db5', '#c84a2f', '#3a8a4a'][Math.floor(r() * 3)])),
      () => new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 8, 18).rotateX(Math.PI / 2), toon('#1d1d1d')),
      () => new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.28), toon('#8a6a4a')),
      () => {
        const c = new THREE.Group(), m = toon('#e8e2d0');
        c.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), m));
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.05), m); back.position.set(0, 0.22, -0.2); c.add(back);
        return c;
      },
    ];
    for (let i = 0; i < 46; i++) {
      const s = r() * ROUTE_LENGTH, p = routePose(s), side = r() > 0.5 ? 1 : -1;
      const off = side > 0 ? 3.8 + r() * 3.5 : -3.2 - r() * 3.5;
      if (side > 0 && [95, 170, 245].some((q) => Math.abs(q - s) < 7)) continue;
      const obj = kinds[Math.floor(r() * kinds.length)]();
      toonify(obj, { outline: 0.015 });
      obj.position.copy(p.pos).addScaledVector(p.right, off);
      obj.rotation.y = r() * 6.28;
      g.add(obj);
      out.push({ obj, ph: r() * 6.28, y: obj instanceof THREE.Group ? 0.02 : 0.05 });
    }
    return { g, out };
  }, []);
  useStoryFrame(({ idle }) => {
    for (const d of items.out) {
      d.obj.position.y = d.y + Math.sin(idle * 1.3 + d.ph) * 0.05;
      d.obj.rotation.x = Math.sin(idle * 0.9 + d.ph) * 0.08;
      d.obj.rotation.z = Math.cos(idle * 1.1 + d.ph) * 0.08;
    }
  });
  return <primitive object={items.g} />;
}

// ------------------------------------------------------------------ the bus
/** Bus speed in m/s at time t (for the wake and the engine's sway). */
const speed = (t: number) => (BUS_S.sample(t + 0.05) - BUS_S.sample(t - 0.05)) / 0.1;

function placeBus(group: THREE.Object3D, t: number, idle: number) {
  const p = routePose(BUS_S.sample(t));
  const v = speed(t);
  group.position.copy(p.pos).setY(-BUS.draft + Math.sin(idle * 1.6) * 0.025);
  group.rotation.set(Math.sin(idle * 1.1) * 0.008 - clamp(v * 0.004, -0.02, 0.02), p.heading, Math.sin(idle * 1.3 + 1) * 0.012, 'YXZ');
}

function Bus({ model }: { model: BusModel }) {
  const dim = useMemo(() => new THREE.Color('#3a3326'), []), on = useMemo(() => new THREE.Color('#fff3c9').multiplyScalar(2.2), []);
  const brakeOff = useMemo(() => new THREE.Color('#5a1010'), []), brakeOn = useMemo(() => new THREE.Color('#ff3020').multiplyScalar(3), []);
  useStoryFrame(({ t, idle }) => {
    const s = B.at(t);
    placeBus(model.group, t, idle);
    const dw = BUS.door.z1 - BUS.door.z0;
    model.door.position.z = (BUS.door.z0 + BUS.door.z1) / 2 - s.door * (dw + 0.02);
    model.door.position.x = -BUS.width / 2 + 0.03 - Math.min(1, s.door * 4) * 0.08;
    model.headlights.color.copy(dim).lerp(on, s.lights);
    for (const g of model.headGlow) { g.material.opacity = s.lights * 0.9; g.scale.setScalar(1.0 + s.lights * 0.8); }
    model.brake.color.copy(brakeOff).lerp(brakeOn, Math.max(s.brake, s.lights * 0.25));
  }, -1);
  return <primitive object={model.group} />;
}

/** Foam trailing the bus: two arms of a V, built from where the bus has just been. */
function Wake() {
  const N = 40;
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 2 * 3), 3));
    geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N * 2 * 2), 1));
    const idx: number[] = [];
    for (const arm of [0, 1]) for (let i = 0; i < N - 1; i++) {
      const a = arm * N * 2 + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 } },
      vertexShader: `attribute float aA; varying float vA; varying vec2 vP; void main(){ vA = aA; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform float uT; varying float vA; varying vec2 vP; void main(){
        float n = sin(vP.x * 4. + uT * 3.) * sin(vP.y * 3.3 - uT * 2.);
        float a = vA * step(-0.2, n);
        gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a * 0.85); }`,
    });
    return { geo, mat };
  }, []);
  useStoryFrame(({ t, idle }) => {
    mat.uniforms.uT.value = idle;
    const P = geo.attributes.position as THREE.BufferAttribute, A = geo.attributes.aA as THREE.BufferAttribute;
    for (const arm of [0, 1]) {
      const side = arm ? 1 : -1;
      for (let i = 0; i < N; i++) {
        const age = i * 0.12, tt = t - age;
        const p = routePose(BUS_S.sample(tt)), v = Math.abs(speed(tt));
        const spread = BUS.width / 2 + 0.1 + age * 0.55;
        const back = p.pos.clone().addScaledVector(p.forward, -BUS.length / 2 + 0.4);
        const c = back.addScaledVector(p.right, side * spread);
        const w = 0.25 + age * 0.12;
        const k = arm * N * 2 + i * 2;
        P.setXYZ(k, c.x - p.right.x * w * 0.5, 0.03, c.z - p.right.z * w * 0.5);
        P.setXYZ(k + 1, c.x + p.right.x * w * 0.5, 0.03, c.z + p.right.z * w * 0.5);
        const alpha = clamp(v / 2.5) * (1 - i / (N - 1));
        A.setX(k, alpha); A.setX(k + 1, alpha);
      }
    }
    P.needsUpdate = A.needsUpdate = true;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />;
}

// ------------------------------------------------------------------ people
const SEATED_HIP = 0.1;

/** Where a clip puts the pelvis relative to the character root (rest of the pose ignored). */
function pelvisOffset(ch: ReturnType<typeof useCharacter>, clip: string) {
  ch.root.position.set(0, 0, 0); ch.root.rotation.set(0, 0, 0);
  ch.pose([{ clip, time: 0, weight: 1, loop: true }]);
  return ch.bone('pelvis').getWorldPosition(new THREE.Vector3());
}

/** The engine's bone names on the Rocketbox (3ds Max Biped) rig. */
const RB_BONES = {
  Head: 'Bip01_Head', neck_01: 'Bip01_Neck', pelvis: 'Bip01_Pelvis',
  hand_l: 'Bip01_L_Hand', hand_r: 'Bip01_R_Hand', upperarm_l: 'Bip01_L_UpperArm', upperarm_r: 'Bip01_R_UpperArm',
  lowerarm_l: 'Bip01_L_Forearm', lowerarm_r: 'Bip01_R_Forearm',
};
const REAL_AYO = { parts: [asset('characters/rb-ayo.glb')], animations: [asset('animations/rb-ayo-drive.glb')], boneMap: RB_BONES };
const REAL_HER = {
  parts: [asset('characters/rb-passenger.glb')], boneMap: RB_BONES,
  animations: ['walk', 'idle', 'sit', 'sit-talk'].map((c) => asset(`animations/rb-her-${c}.glb`)),
};

function Driver({ model }: { model: BusModel }) {
  const ade = useCharacter(REAL ? REAL_AYO : {
    parts: [asset('characters/driver-body.glb'), asset('characters/driver-outfit.glb')],
    attach: [
      { url: asset('characters/hair-buzzed.glb'), bone: 'Head', paint: '#b9b4ad' },
      { url: asset('characters/hair-beard.glb'), bone: 'Head', paint: '#cdc8c0' },
    ],
    tints: { Eyebrows: '#d9d4cc' },
    paint: { Male_Peasant_Body: '#6d8fa8', Male_Peasant_Arms: '#6d8fa8', Male_Peasant_Legs: '#3b3f4a', Male_Peasant_Feet: '#2b2320' },
    animations: [asset('animations/route-7-ual1.glb'), asset('animations/route-7-ual2.glb')],
  });
  useMemo(() => {
    const hip = pelvisOffset(ade, 'Driving_Loop');
    if (REAL) {
      // a chair pose with the hands brought to a wheel in front of him (see the frame loop)
      const seat = model.driverSeat;
      ade.root.position.set(seat.x - hip.x, seat.y + SEATED_HIP - hip.y, seat.z - hip.z);
      model.group.add(ade.root);
      model.wheelMount.position.set(seat.x, seat.y + 0.42, seat.z + 0.42);
      model.wheelMount.rotation.x = -0.45;
      return;
    }
    const seat = model.driverSeat;
    ade.root.position.set(seat.x - hip.x, seat.y + SEATED_HIP - hip.y, seat.z - hip.z);
    model.group.add(ade.root);
    // the wheel goes where the clip puts his hands
    ade.pose([{ clip: 'Driving_Loop', time: 0, weight: 1, loop: true }]);
    model.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.group.matrixWorld).invert();
    const hands = ade.bone('hand_l').getWorldPosition(new THREE.Vector3()).add(ade.bone('hand_r').getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).applyMatrix4(inv);
    model.wheelMount.position.copy(hands).add(new THREE.Vector3(0, -0.02, 0.06));
    model.wheelMount.rotation.x = -0.45;
    // a flat cap
    const cap = new THREE.Group();
    const cloth = toon('#3d4a3f');
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
    crown.scale.set(1.02, 0.6, 1.12);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.015, 16, 1, false, -Math.PI / 2, Math.PI), cloth);
    brim.position.set(0, 0.0, 0.09);
    cap.add(crown, brim);
    toonify(cap, { outline: 0.006 });
    const head = ade.bone('Head');
    head.add(cap);
    cap.position.set(0, 0.13, 0.015);
  }, [ade, model]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const at = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(x, y, z).applyMatrix4(model.group.matrixWorld);

  useStoryFrame(({ t, idle }) => {
    const s = B.at(t);
    model.group.updateMatrixWorld(true);
    ade.pose(DRIVER_CLIPS.sample(t, idle));
    if (REAL) {
      // both hands on the rim, elbows out and down
      for (const side of [-1, 1]) {
        const grip = model.wheelMount.localToWorld(tmp.a.set(side * 0.17, -0.03, 0));
        const pole = at(model.driverSeat.x + side * 0.6, model.driverSeat.y - 0.2, model.driverSeat.z + 0.1, tmp.b);
        const lr = side > 0 ? 'l' : 'r';
        solveTwoBone(ade.bone(`upperarm_${lr}`), ade.bone(`lowerarm_${lr}`), ade.bone(`hand_${lr}`), grip.clone(), pole.clone(), 1);
      }
    }
    // eyes: the road ahead, the door at each stop, the coin, then a look back at her
    const fare = smoothstep(79.8, 80.4, t) * (1 - smoothstep(85.4, 86.0, t));
    const back = smoothstep(70.2, 71.0, t) * (1 - smoothstep(79.4, 80.0, t)) + smoothstep(86.2, 86.8, t) * (1 - smoothstep(88.8, 89.5, t));
    const look = at(0.2, 1.75, 6, tmp.a);
    if (s.glance > 0) look.lerp(at(-3, 1.4, 0.8, tmp.b), s.glance);
    if (fare > 0) look.lerp(coinWorld, fare);
    if (back > 0) look.lerp(at(-0.4, 1.75, 0.9, tmp.b), back);
    lookAt(ade.bone('neck_01'), ade.root, look, 0.5, 0.7);
    lookAt(ade.bone('Head'), ade.root, look, 0.7, 0.9);
    // a small nod once the coin is in the tin
    const nod = Math.sin(clamp((t - 82.6) / 0.9) * Math.PI) * s.smile;
    ade.bone('Head').rotateX(nod * 0.25);
    ade.bone('Head').updateMatrixWorld(true);
    // his right hand: wheel → her coin → in front of him → the tin
    if (s.take > 0) {
      const meet = at(...FARE.to, tmp.a);
      const view = at(...FARE.view, tmp.b);
      const target = meet.clone().lerp(view, smoothstep(81.0, 81.8, t)).lerp(at(...FARE.tin, new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)), s.tin);
      const pole = at(-0.6, 1.0, 1.25, new THREE.Vector3());
      solveTwoBone(ade.bone('upperarm_r'), ade.bone('lowerarm_r'), ade.bone('hand_r'), target, pole, s.take);
    }
    driverHand.copy(ade.bone('hand_r').getWorldPosition(tmp.a));
  });
  return null;
}

/** Shared between the two characters: where the coin is and his hand. */
const coinWorld = new THREE.Vector3();
const driverHand = new THREE.Vector3();

function Passenger({ model }: { model: BusModel }) {
  const her = useCharacter(REAL ? REAL_HER : {
    parts: [asset('characters/pip-body.glb'), asset('characters/pip-outfit.glb')],
    attach: [{ url: asset('characters/hair-long.glb'), bone: 'Head', tint: '#1e1410' }],
    tints: { Eyebrows: '#1e1410' },
    paint: { Female_Peasant_Body: '#e2683c', Female_Peasant_Arms: '#e2683c', Female_Peasant_Legs: '#2f5e7a', Female_Peasant_Feet: '#3a2a22' },
    animations: [asset('animations/route-7-ual1.glb'), asset('animations/route-7-ual2.glb')],
  });
  const setup = useMemo(() => {
    const seatHip = pelvisOffset(her, 'Sitting_Idle_Loop');
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 18), new THREE.MeshToonMaterial({ color: '#e8b84a', emissive: '#5a3a08' }));
    coin.rotation.x = Math.PI / 2;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 8), new THREE.MeshBasicMaterial({ visible: false }));
    return { seatHip, coin, hit };
  }, [her]);
  useHitTarget('passenger', setup.hit);

  const sh = useMemo(() => shelterPose(2), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), s: new THREE.Vector3() }), []);
  const BENCH_TOP = 0.34;

  useStoryFrame(({ t, idle }) => {
    const s = B.at(t);
    model.group.updateMatrixWorld(true);
    her.pose(PASSENGER_CLIPS.sample(t, idle));
    if (t < BOARDED) {
      // round the end of the shelter and up onto the bench, facing the road; then across the step into the bus
      const face = sh.right.clone().multiplyScalar(-1);
      const at = (out: number, along: number, y: number) => sh.pos.clone().addScaledVector(sh.right, out).addScaledVector(sh.forward, along).setY(y);
      const stand = at(0.05, 0.2, BENCH_TOP);
      const door = tmp.a.set(-BUS.width / 2 + 0.25, BUS.floor, (BUS.door.z0 + BUS.door.z1) / 2).applyMatrix4(model.group.matrixWorld);
      const inside = tmp.b.set(0, BUS.floor, (BUS.door.z0 + BUS.door.z1) / 2 + 0.1).applyMatrix4(model.group.matrixWorld);
      const k = s.step, a = s.arrive;
      let p: THREE.Vector3;
      if (k > 0) {
        p = k < 0.6 ? stand.clone().lerp(door, k / 0.6) : door.clone().lerp(inside, (k - 0.6) / 0.4);
        p.y += Math.sin(clamp(k / 0.6) * Math.PI) * 0.12;
      } else if (a < 0.45) p = at(0.15, 2.7, -0.15).lerp(at(0.1, 1.5, BENCH_TOP), a / 0.45);
      else p = at(0.1, 1.5, BENCH_TOP).lerp(stand, (a - 0.45) / 0.55);
      her.root.position.copy(p);
      const heading = Math.atan2(face.x, face.z), walkIn = heading + angleTo(face, sh.forward.clone().multiplyScalar(-1));
      const busForward = routePose(BUS_S.sample(t)).forward;
      const facing = lerp(walkIn, heading, smoothstep(0.7, 1, a));
      her.root.rotation.set(0, lerp(facing, heading + angleTo(face, busForward), smoothstep(0.55, 0.9, k)), 0);
      her.root.visible = t >= 56.4 && k < 0.98;
      setup.hit.position.copy(stand).add(new THREE.Vector3(0, 1, 0));
    } else {
      // seated behind the driver, riding with the bus
      const seat = model.passengerSeat;
      tmp.m.makeTranslation(seat.x - setup.seatHip.x, seat.y + SEATED_HIP - setup.seatHip.y, seat.z - setup.seatHip.z).premultiply(model.group.matrixWorld);
      tmp.m.decompose(her.root.position, her.root.quaternion, tmp.s);
      her.root.visible = true;
    }
    her.root.updateMatrixWorld(true);
    // the wave: right arm up, hand swinging
    if (s.wave > 0) {
      const sp = her.bone('upperarm_r').getWorldPosition(new THREE.Vector3());
      const face = sh.right.clone().multiplyScalar(-1), side = new THREE.Vector3(-face.z, 0, face.x);
      const swing = Math.sin(idle * 9) * 0.16;
      const target = sp.clone().add(new THREE.Vector3(0, 0.58, 0)).addScaledVector(face, 0.18).addScaledVector(side, -0.22 + swing);
      const pole = sp.clone().addScaledVector(side, -0.6).add(new THREE.Vector3(0, -0.2, 0));
      solveTwoBone(her.bone('upperarm_r'), her.bone('lowerarm_r'), her.bone('hand_r'), target, pole, s.wave);
    }
    // the fare: her hand forward with the coin
    if (s.reach > 0) {
      const target = tmp.a.set(...FARE.to).applyMatrix4(model.group.matrixWorld);
      const from = new THREE.Vector3(...FARE.from).applyMatrix4(model.group.matrixWorld);
      target.lerp(from, 1 - smoothstep(0, 0.6, s.reach));
      const pole = new THREE.Vector3(-0.5, 0.6, 0).applyMatrix4(model.group.matrixWorld);
      solveTwoBone(her.bone('upperarm_r'), her.bone('lowerarm_r'), her.bone('hand_r'), target, pole, Math.min(1, s.reach * 1.5));
    }
    // the coin: her hand, then his, then the tin
    const herHand = her.bone('hand_r').getWorldPosition(tmp.a);
    const handed = smoothstep(80.75, 80.9, t);
    if (t < 84.9) coinWorld.copy(herHand).lerp(driverHand, handed);
    else {
      const tinTop = tmp.b.set(...FARE.tin).applyMatrix4(model.group.matrixWorld);
      const k = smoothstep(84.9, 85.3, t);
      coinWorld.copy(driverHand).lerp(tinTop, k);
    }
    setup.coin.position.copy(coinWorld);
    setup.coin.visible = t > BOARDED && t < 85.35;
  });
  return (
    <>
      <primitive object={her.root} />
      <primitive object={setup.coin} />
      <primitive object={setup.hit} />
    </>
  );
}

/** Signed turn (radians, about +y) from direction a to direction b. */
function angleTo(a: THREE.Vector3, b: THREE.Vector3) {
  const d = Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z);
  return Math.atan2(Math.sin(d), Math.cos(d));
}

