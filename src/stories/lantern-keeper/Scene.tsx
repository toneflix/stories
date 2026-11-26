import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStoryFrame, useHitTarget } from '../../engine/clock';
import { useCharacter, lookAt } from '../../engine/character';
import { NarratorCamera } from '../../engine/camera';
import { publicUrl } from '../../engine/types';
import { MOBILE } from '../../engine/Player';
import { toon, toonify, addOutline } from '../../engine/toon';
import { rng } from '../../engine/random';
import { smoothstep, lerp, clamp } from '../../engine/timeline';
import { B, PIP_CLIPS, pathProgress, CAMERA } from './script';
import { C, LANTERN, WICK, WICK_Y, PATH, STAND, height, terrainGeometry, treeSpots, houseSpots, glowTexture } from './world';

const asset = (p: string) => publicUrl(`assets/${p}`);

export function Scene() {
  return (
    <>
      <NarratorCamera keys={CAMERA} />
      <Atmosphere />
      <Terrain />
      <Trees />
      <Village />
      <GreatLantern />
      <Pip />
      <Fireflies />
      <Sparks />
    </>
  );
}

// ------------------------------------------------------------------ sky, light, fog
function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(C.skyTop) }, uMid: { value: new THREE.Color(C.skyMid) }, uHorizon: { value: new THREE.Color(C.horizon) }, uNight: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uTop,uMid,uHorizon; uniform float uNight; varying vec3 vP;
      void main(){ float y = vP.y;
        vec3 hz = mix(uHorizon, uMid * 0.95, uNight * 0.7);
        vec3 c = mix(hz, uMid, smoothstep(-0.02, 0.25, y));
        c = mix(c, uTop * (1.0 - 0.35 * uNight), smoothstep(0.2, 0.8, y));
        float sun = pow(max(dot(vP, normalize(vec3(0.2, 0.04, -1.))), 0.), 5.);
        c += vec3(1.0, 0.6, 0.4) * sun * 0.4 * (1.0 - uNight);
        gl_FragColor = vec4(c, 1.); }`,
  }), []);
  const stars = useMemo(() => {
    const r = rng(3), pos: number[] = [];
    for (let i = 0; i < 1600; i++) {
      const a = r() * Math.PI * 2, y = 0.08 + Math.pow(r(), 0.7) * 0.9, s = Math.sqrt(1 - y * y);
      pos.push(Math.cos(a) * s * 450, y * 450, Math.sin(a) * s * 450);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  const starMat = useRef<THREE.PointsMaterial>(null);
  const moon = useRef<THREE.Sprite>(null);
  const hemi = useRef<THREE.HemisphereLight>(null), moonLight = useRef<THREE.DirectionalLight>(null), sun = useRef<THREE.DirectionalLight>(null);
  const moonTex = useMemo(() => glowTexture('#fff3d6', 0.42), []);
  const fogDusk = useMemo(() => new THREE.Color(C.fog), []), fogNight = useMemo(() => new THREE.Color('#251f44'), []);
  useMemo(() => { scene.fog = new THREE.Fog(C.fog, 40, 200); }, [scene]);

  useStoryFrame(({ t }) => {
    const { night } = B.at(t);
    sky.uniforms.uNight.value = night;
    starMat.current!.opacity = smoothstep(0.3, 0.95, night);
    moon.current!.material.opacity = smoothstep(0.1, 0.7, night);
    (scene.fog as THREE.Fog).color.copy(fogDusk).lerp(fogNight, night * 0.8);
    hemi.current!.intensity = lerp(1.9, 1.0, night);
    sun.current!.intensity = lerp(1.6, 0, night);
    moonLight.current!.intensity = lerp(0.6, 1.4, night);
  });
  return (
    <>
      <mesh material={sky}><sphereGeometry args={[500, 32, 16]} /></mesh>
      <points geometry={stars}><pointsMaterial ref={starMat} color="#fff4dd" size={1.7} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} /></points>
      <sprite ref={moon} position={[-110, 150, -330]} scale={70}><spriteMaterial map={moonTex} fog={false} depthWrite={false} transparent opacity={0} toneMapped={false} /></sprite>
      <hemisphereLight ref={hemi} args={['#a99cf0', '#1e2c33', 1.9]} />
      <directionalLight ref={sun} color="#ff9a6e" position={[10, 6, -60]} intensity={1.6} />
      <directionalLight ref={moonLight} color="#b3c2ff" position={[-25, 40, 25]} intensity={0.6} castShadow
        shadow-mapSize={MOBILE ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0006}
        shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-near={1} shadow-camera-far={120}>
        <object3D attach="target" position={[1, 0, 2]} />
      </directionalLight>
    </>
  );
}

// ------------------------------------------------------------------ land
function Terrain() {
  const geo = useMemo(terrainGeometry, []);
  return <mesh geometry={geo} material={useMemo(() => toon('#ffffff', { vertexColors: true }), [])} receiveShadow />;
}

function colored(geo: THREE.BufferGeometry, color: string) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Round, puffy trees: a trunk and three overlapping canopy blobs, all merged into one mesh. */
function Trees() {
  const obj = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const r = rng(19);
    for (const t of treeSpots()) {
      const s = t.s;
      parts.push(colored(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.2 * s, 8).translate(t.x, t.y + 0.6 * s, t.z), C.trunk));
      for (let k = 0; k < 3; k++) {
        const bx = (r() - 0.5) * 0.7 * s, by = (1.5 + k * 0.45 + r() * 0.2) * s, bz = (r() - 0.5) * 0.7 * s;
        const rad = (0.75 - k * 0.12) * s;
        const c = new THREE.Color(t.color).offsetHSL(0, 0, (k - 1) * 0.03);
        parts.push(colored(new THREE.IcosahedronGeometry(rad, 3).scale(1, 0.9, 1).translate(t.x + bx + t.lean * by, t.y + by, t.z + bz), '#' + c.getHexString()));
      }
    }
    const geo = mergeGeometries(parts)!;
    const mesh = new THREE.Mesh(geo, toon('#ffffff', { vertexColors: true }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    addOutline(mesh, 0.035);
    return mesh;
  }, []);
  return <primitive object={obj} />;
}

/** Cottages in the valley. Windows stay dark until the lantern is lit. */
function Village() {
  const houses = useMemo(houseSpots, []);
  const { group, windows } = useMemo(() => {
    const group = new THREE.Group();
    const windows: { mat: THREE.MeshBasicMaterial; at: number }[] = [];
    for (const h of houses) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.w * 0.85), toon(h.wall));
      body.position.y = h.h / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(h.w * 0.82, h.h * 0.75, 4), toon(h.roof));
      roof.position.y = h.h + h.h * 0.37; roof.rotation.y = Math.PI / 4;
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), toon('#7c6a73'));
      chimney.position.set(h.w * 0.25, h.h + 0.45, 0);
      g.add(body, roof, chimney);
      toonify(g, { outline: 0.03 });
      h.lightAt.forEach((at, i) => {
        const mat = new THREE.MeshBasicMaterial({ color: '#2a2036', toneMapped: false });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.34), mat);
        win.position.set((i ? 1 : -1) * h.w * 0.22, h.h * 0.55, h.w * 0.425 + 0.01);
        g.add(win);
        windows.push({ mat, at });
      });
      g.position.set(h.x, h.y, h.z);
      g.rotation.y = h.rot;
      group.add(g);
    }
    return { group, windows };
  }, [houses]);
  const dark = useMemo(() => new THREE.Color('#2a2036'), []), lit = useMemo(() => new THREE.Color(C.window).multiplyScalar(2.4), []);
  useStoryFrame(({ t, idle }) => {
    for (const w of windows) {
      const k = smoothstep(w.at, w.at + 0.35, t);
      w.mat.color.copy(dark).lerp(lit, k * (0.92 + 0.08 * Math.sin(idle * 3 + w.at * 9)));
    }
  });
  return <primitive object={group} />;
}

// ------------------------------------------------------------------ the great lantern
function GreatLantern() {
  const { group, glass, flame, halo, light, hit } = useMemo(() => {
    const group = new THREE.Group();
    group.position.copy(LANTERN);
    const brass = toon(C.brass), post = toon(C.post);
    const add = (g: THREE.BufferGeometry, m: THREE.Material, y: number, x = 0, z = 0) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); group.add(o); return o;
    };
    add(new THREE.CylinderGeometry(0.34, 0.42, 0.22, 24), toon('#71687d'), 0.08);
    add(new THREE.CylinderGeometry(0.075, 0.1, WICK_Y - 0.3, 16), post, (WICK_Y - 0.3) / 2);
    add(new THREE.TorusGeometry(0.11, 0.025, 8, 20).rotateX(Math.PI / 2), brass, WICK_Y - 0.55);
    add(new THREE.CylinderGeometry(0.25, 0.18, 0.07, 24), brass, WICK_Y - 0.27);
    add(new THREE.ConeGeometry(0.36, 0.32, 24), brass, WICK_Y + 0.4);
    add(new THREE.SphereGeometry(0.06, 16, 12), brass, WICK_Y + 0.62);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), brass, WICK_Y, Math.cos(a) * 0.22, Math.sin(a) * 0.22);
    }
    toonify(group, { outline: 0.018 });
    const glassMat = new THREE.MeshBasicMaterial({ color: '#2a2233', transparent: true, opacity: 0.6, toneMapped: false });
    const glass = add(new THREE.CylinderGeometry(0.2, 0.2, 0.48, 24, 1, true), glassMat, WICK_Y);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffd38a', 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    flame.position.y = WICK_Y - 0.02;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff9d4a', 0.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
    halo.position.y = WICK_Y;
    group.add(flame, halo);
    const light = new THREE.PointLight('#ffb15a', 0, 26, 1.4);
    light.position.y = WICK_Y;
    group.add(light);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.0, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = WICK_Y - 0.3;
    group.add(hit);
    return { group, glass: glassMat, flame, halo, light, hit };
  }, []);
  useHitTarget('lantern', hit);
  const dim = useMemo(() => new THREE.Color('#2a2233'), []), warm = useMemo(() => new THREE.Color('#ffc978').multiplyScalar(1.15), []);
  useStoryFrame(({ t, idle }) => {
    const s = B.at(t);
    const wobble = 1 + 0.06 * Math.sin(idle * 13.0) + 0.04 * Math.sin(idle * 21.7);
    const g = s.glow * wobble + s.flicker * (0.55 + 0.45 * Math.sin(idle * 47));
    light.intensity = g * 16;
    flame.material.opacity = Math.min(1, g * 1.4);
    flame.scale.setScalar(0.22 + 0.5 * Math.min(g, 1.3));
    halo.material.opacity = Math.min(0.85, s.glow * 0.55);
    halo.scale.setScalar(2 + s.glow * 3);
    glass.color.copy(dim).lerp(warm, Math.min(1, g));
  });
  return <primitive object={group} />;
}

// ------------------------------------------------------------------ Pip
function Pip() {
  const pip = useCharacter({
    parts: [asset('characters/pip-body.glb'), asset('characters/pip-outfit.glb')],
    attach: [{ url: asset('characters/hair-buns.glb'), bone: 'Head', tint: '#2b1a12' }],
    tints: { Eyebrows: '#24150f' },
    animations: [asset('animations/ual1.glb'), asset('animations/ual2.glb')],
  });
  const lamp = useMemo(() => {
    const g = new THREE.Group();
    const brass = toon(C.brass);
    const frame = new THREE.Group();
    const piece = (g: THREE.BufferGeometry, y: number) => { const m = new THREE.Mesh(g, brass); m.position.y = y; frame.add(m); };
    piece(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 16), -0.09);
    piece(new THREE.ConeGeometry(0.075, 0.07, 16), 0.1);
    piece(new THREE.TorusGeometry(0.035, 0.008, 6, 16), 0.16);
    toonify(frame, { outline: 0.006 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffcf80', transparent: true, opacity: 0.85, toneMapped: false }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffb35c', 0.35), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.scale.setScalar(0.5);
    const light = new THREE.PointLight('#ffa552', 2, 4, 1.5);
    g.add(frame, core, glow, light);
    return { g, core, glow, light };
  }, []);
  const holder = useMemo(() => {
    // the lantern hangs from Pip's right hand; it stays upright whatever the hand does
    const h = new THREE.Object3D();
    pip.bone('hand_r').add(h);
    h.position.set(0, 0.09, 0.02);
    return h;
  }, [pip]);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), tan: new THREE.Vector3() }), []);

  useStoryFrame(({ t, idle }) => {
    const s = B.at(t);
    const u = pathProgress(t);
    PATH.getPoint(u, tmp.p);
    pip.root.position.copy(tmp.p);
    pip.root.position.y = height(tmp.p.x, tmp.p.z);
    PATH.getTangent(Math.min(u, 0.999), tmp.tan);
    const walkHeading = Math.atan2(tmp.tan.x, tmp.tan.z);
    const faceLantern = Math.atan2(LANTERN.x - STAND.x, LANTERN.z - STAND.z) + 0.35;
    pip.root.rotation.y = lerp(walkHeading, faceLantern, smoothstep(18.6, 19.8, t));
    pip.pose(PIP_CLIPS.sample(t, idle));
    // eyes on the lantern (and then the fireflies) on top of the animation
    pip.root.updateMatrixWorld(true);
    lookAt(pip.bone('neck_01'), pip.root, WICK, s.look * 0.5, 0.5);
    lookAt(pip.bone('Head'), pip.root, WICK, s.look * 0.6, 0.6);
    // keep the hand lantern hanging straight down
    holder.updateWorldMatrix(true, false);
    holder.getWorldPosition(tmp.p);
    lamp.g.position.copy(tmp.p).add(new THREE.Vector3(0, -0.12, 0));
    const e = s.ember * (0.88 + 0.12 * Math.sin(idle * 29) * Math.sin(idle * 13));
    lamp.glow.material.opacity = e;
    lamp.glow.scale.setScalar(0.12 + 0.45 * e);
    (lamp.core.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.6 * e;
    lamp.light.intensity = e * 2.5;
  });
  return (
    <>
      <primitive object={pip.root} />
      <primitive object={lamp.g} />
    </>
  );
}

// ------------------------------------------------------------------ fireflies & sparks
const fireflyMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uScale: { value: 1 } },
  vertexShader: `attribute float aSize; attribute float aGlow; varying float vGlow;
    void main(){ vGlow = aGlow; vec4 mv = modelViewMatrix * vec4(position,1.);
      gl_PointSize = min(aSize * 300. / max(-mv.z, 0.1), 48.); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vGlow; void main(){ float d = length(gl_PointCoord - .5);
      float a = smoothstep(.5, 0., d); a = a * a; gl_FragColor = vec4(vec3(1.0, .85, .45) * (1.5 + a * 2.), a * vGlow); }`,
});

function Fireflies() {
  const N = 90;
  const { geo, data } = useMemo(() => {
    const r = rng(23);
    const data = [...Array(N)].map(() => {
      const x = (r() - 0.4) * 14, z = -4 + r() * 14;
      return { x, z, y: 0.4 + r() * 1.6, f: 0.3 + r() * 0.5, ph: r() * 6.28, delay: r() * 3.6, blink: 1 + r() * 2, side: r() > 0.5 ? 1 : -1 };
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(N), 1));
    return { geo, data };
  }, []);
  const mat = useMemo(fireflyMat, []);
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), []);
  useStoryFrame(({ t, idle }) => {
    const P = geo.attributes.position as THREE.BufferAttribute, S = geo.attributes.aSize as THREE.BufferAttribute, G = geo.attributes.aGlow as THREE.BufferAttribute;
    const appear = smoothstep(9, 17, t);
    data.forEach((d, i) => {
      // wandering over the meadow
      const wx = d.x + Math.sin(idle * d.f + d.ph) * 0.8, wz = d.z + Math.cos(idle * d.f * 0.8 + d.ph) * 0.8;
      v.a.set(wx, height(wx, wz) + d.y + Math.sin(idle * d.f * 1.7 + d.ph) * 0.25, wz);
      // drawn to the lantern, each in its turn, on a looping arc
      const s0 = 25 + d.delay, k = smoothstep(s0, s0 + 2.4, t);
      if (k > 0) {
        const swirl = (1 - k) * 0.6;
        v.c.copy(WICK).add(v.b.set(Math.cos(idle * 2 + d.ph) * swirl, Math.sin(idle * 3 + d.ph) * swirl * 0.5, Math.sin(idle * 2 + d.ph) * swirl));
        v.b.copy(v.a).lerp(v.c, 0.5).add(new THREE.Vector3(d.side * 1.2, 1.6, 0));
        const u = k, iu = 1 - u;
        v.a.multiplyScalar(iu * iu).addScaledVector(v.b, 2 * iu * u).addScaledVector(v.c, u * u);
      }
      P.setXYZ(i, v.a.x, v.a.y, v.a.z);
      const blink = 0.55 + 0.45 * Math.sin(idle * d.blink + d.ph * 3);
      const gone = 1 - smoothstep(s0 + 2.1, s0 + 2.5, t);
      G.setX(i, appear * blink * gone * (1.4 + k));
      S.setX(i, 0.3 + 0.1 * k);
    });
    P.needsUpdate = S.needsUpdate = G.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** Two failed strikes: little sprays of sparks from the wick that die at once. */
function Sparks() {
  const N = 40, bursts = [21.35, 22.15];
  const { geo, dirs } = useMemo(() => {
    const r = rng(31);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N).fill(0.07), 1));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(N), 1));
    const dirs = [...Array(N)].map(() => new THREE.Vector3(r() - 0.5, r() * 0.9 + 0.2, r() - 0.5).normalize().multiplyScalar(0.8 + r() * 1.4));
    return { geo, dirs };
  }, []);
  const mat = useMemo(fireflyMat, []);
  useStoryFrame(({ t }) => {
    const P = geo.attributes.position as THREE.BufferAttribute, G = geo.attributes.aGlow as THREE.BufferAttribute;
    dirs.forEach((d, i) => {
      const b = bursts[i % 2], age = t - b;
      const live = age >= 0 && age < 0.6;
      const a = clamp(age, 0, 0.6);
      P.setXYZ(i, WICK.x + d.x * a, WICK.y - 0.05 + d.y * a - 4.9 * a * a, WICK.z + d.z * a);
      G.setX(i, live ? 1 - a / 0.6 : 0);
    });
    P.needsUpdate = G.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
