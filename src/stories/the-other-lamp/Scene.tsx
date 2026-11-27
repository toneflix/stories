import * as THREE from 'three';
import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useStoryFrame, useHitTarget } from '../../engine/clock';
import { useCharacter, lookAt } from '../../engine/character';
import { solveTwoBone } from '../../engine/ik';
import { NarratorCamera } from '../../engine/camera';
import { publicUrl } from '../../engine/types';
import { MOBILE } from '../../engine/Player';
import { smoothstep } from '../../engine/timeline';
import {
  buildFlatsStreet, Neighbours, NightSky, buildLamp, buildSideTable, buildSettee, buildChair, buildClock,
  buildCurtains, buildSocket, buildRug, LIGHTS, LIGHT_Y, STAIR, level, ROOM,
} from '../../sets/flats-street';
import { A, B, CAMERA, FY, HER_CLIPS, S, SPOT, herAt } from './script';

const asset = (p: string) => publicUrl(`assets/${p}`);
const v = (p: [number, number, number]) => new THREE.Vector3(...p);

export function Scene() {
  const set = useMemo(() => buildFlatsStreet(), []);
  return (
    <>
      <NarratorCamera keys={CAMERA} shake={0.35} />
      <Night />
      <NightSky />
      <primitive object={set.group} />
      <Neighbours />
      <StreetLights />
      <Flats set={set} />
      <Her set={set} />
    </>
  );
}

/** Moonlight, the city's glow, haze. */
function Night() {
  const { scene } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []);
  useMemo(() => {
    scene.fog = new THREE.FogExp2('#141a26', 0.018);
    scene.background = new THREE.Color('#05070c');
    scene.add(target);
  }, [scene, target]);
  return (
    <>
      <hemisphereLight args={['#6a7ea8', '#3a2c22', 1.3]} />
      {/* the city's glow from the south, so the north block's front isn't black */}
      <directionalLight color="#c79a7a" intensity={0.7} position={[10, 18, -40]} />
      <directionalLight color="#9fb4dd" intensity={1.5} position={[-30, 40, 45]} target={target} castShadow
        shadow-mapSize={MOBILE ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={25} shadow-camera-bottom={-25} shadow-camera-near={1} shadow-camera-far={140} />
    </>
  );
}

/** Sodium lamps over the road: a pool of orange under each, one of them flickering. */
function StreetLights() {
  const items = useMemo(() => LIGHTS.map(([x, z], i) => {
    const s = Math.sign(z);
    const head = new THREE.Vector3(x, LIGHT_Y + 0.05, z - s * 1.5);
    const spot = new THREE.SpotLight('#ffa040', 900, 30, 1.0, 0.7, 2);
    spot.position.copy(head);
    spot.target.position.set(x, 0, z - s * 2.5);
    spot.castShadow = i < 2;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0005;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb060').multiplyScalar(5), toneMapped: false }));
    glow.position.copy(head).add(new THREE.Vector3(0, -0.04, 0));
    return { spot, glow, flicker: i === 1 };
  }), []);
  useStoryFrame(({ idle }) => {
    for (const it of items) if (it.flicker) {
      const f = Math.sin(idle * 23) * Math.sin(idle * 3.1) > 0.92 ? 0.25 : 1;
      it.spot.intensity = 900 * f;
      (it.glow.material as THREE.MeshBasicMaterial).color.set('#ffb060').multiplyScalar(5 * f);
    }
  });
  return <>{items.map((it, i) => <group key={i}><primitive object={it.spot} /><primitive object={it.spot.target} /><primitive object={it.glow} /></group>)}</>;
}

/** Everything inside the two flats and their stairwells, and the lights in them. */
function Flats({ set }: { set: ReturnType<typeof buildFlatsStreet> }) {
  const f = useMemo(() => {
    const inA = (o: THREE.Object3D, x: number, z: number, y = FY, ry = 0) => { o.position.set(...A(x, y, z)); o.rotation.y = ry; return o; };
    const inB = (o: THREE.Object3D, x: number, z: number, y = FY, ry = 0) => { o.position.set(...B(x, y, z)); o.rotation.y = ry + Math.PI; return o; };
    const g = new THREE.Group();

    // her flat: lived in
    const lampA = buildLamp([new THREE.Vector3(0.1, 0.01, -0.12), new THREE.Vector3(0.27, -0.02, -0.15), new THREE.Vector3(0.3, -0.75, -0.2), new THREE.Vector3(1.2, -0.76, -0.4), new THREE.Vector3(1.5, -0.55, -0.45)], new THREE.Vector3(1.52, -0.415, -0.45));
    const tableA = buildSideTable('#5b4330', 0.75);
    const clock = buildClock();
    g.add(
      inA(tableA, SPOT.lampA[0], SPOT.lampA[1]),
      inA(lampA.group, SPOT.lampA[0], SPOT.lampA[1], FY + 0.765),
      inA(clock.group, SPOT.clock[0], SPOT.clock[2], FY + SPOT.clock[1], Math.PI),
      inA(buildSettee(), 2.0, -4.15),
      inA(buildRug(2.0, 1.4, '#6a2c26'), 2.0, -2.6),
      inA(buildCurtains(1.4, 2.6, '#6b3a2a'), 1.75, -0.32, FY, Math.PI),
      inA(buildChair(), 3.4, -2.2, FY, -2.2),
      inA(buildSocket(), 3.84, -0.9, FY + 0.35, -Math.PI / 2),
    );
    // cup, left on the sill later
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16), new THREE.MeshStandardMaterial({ color: '#e9e2d0', roughness: 0.4 }));
    cup.castShadow = true;
    const sill = v(A(1.95, FY + 0.95 + 0.045, -0.4));
    // ceiling bulb under a paper shade
    const bulbA = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false }));
    bulbA.position.set(...A(2.0, level(ROOM.f + 1) - 0.65, -2.4));
    const wireA = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4), new THREE.MeshStandardMaterial({ color: '#111' }));
    wireA.position.copy(bulbA.position).add(new THREE.Vector3(0, 0.36, 0));
    g.add(bulbA, wireA);
    const ceil = new THREE.PointLight('#ffd7a0', 14, 10, 1.5);
    ceil.position.copy(bulbA.position).add(new THREE.Vector3(0, -0.2, 0));
    ceil.castShadow = true; ceil.shadow.mapSize.set(512, 512); ceil.shadow.bias = -0.002;
    const lampLightA = new THREE.PointLight('#ffb468', 0, 6, 1.6);
    lampLightA.position.set(...A(SPOT.lampA[0], FY + 1.23, SPOT.lampA[1]));

    // the empty flat: dust sheets, newspapers, the lamp by the window, its plug on the floor
    const lp = SPOT.plugB, lb = SPOT.lampB;
    // cord in lamp-local space (the lamp group is turned with the block)
    const floor = -0.85;
    const toLamp = (x: number, z: number, y = floor) => new THREE.Vector3(x - lb[0], y, z - lb[1]);
    const lampB = buildLamp([new THREE.Vector3(0.1, 0.01, -0.12), new THREE.Vector3(0.27, -0.02, -0.15), new THREE.Vector3(0.3, floor + 0.01, -0.25),
      toLamp(lb[0] + 0.55, lb[1] - 0.6, floor + 0.005), toLamp(lp[0] - 0.25, lp[1] + 0.1, floor + 0.005)], toLamp(lp[0], lp[1], floor + 0.013));
    const stool = buildSideTable('#4a4038', 0.85);
    g.add(
      inB(stool, lb[0], lb[1]),
      inB(lampB.group, lb[0], lb[1], FY + 0.865),
      inB(buildChair(true), 2.9, -3.3),
      inB(buildChair(true), 1.1, -3.9),
      inB(buildRug(0.55, 0.4, '#bdb6a3'), 1.5, -2.2, FY, 0.4),
      inB(buildRug(0.5, 0.38, '#a9a28f'), 1.8, -2.5, FY + 0.009, -0.3),
      inB(buildSocket(), SPOT.socketB[0], SPOT.socketB[1], FY + 0.35, -Math.PI / 2),
    );
    // the lamp's cord ends here, at a plug, a step short of the socket
    const lampLightB = new THREE.PointLight('#ffb468', 0, 7, 1.5);
    lampLightB.position.set(...B(lb[0], FY + 1.33, lb[1]));
    lampLightB.castShadow = true; lampLightB.shadow.mapSize.set(512, 512); lampLightB.shadow.bias = -0.002;

    // stairwell bulbs: the ground floors bright, the landings dim
    const stairs = [set.a, set.b].map((_, i) => {
      const at = i === 0 ? A : B;
      const l = new THREE.PointLight('#ffcf8a', 6, 9, 1.6);
      l.position.set(...at(STAIR.x0 + 0.6, i === 0 ? 2.8 : level(2) + 2.5, STAIR.front - 0.4));
      return l;
    });
    const mid = new THREE.PointLight('#ffcf8a', 3, 6, 1.6);
    mid.position.set(...B(STAIR.x0 + 1.0, level(1) + 1.5 + 2.2, STAIR.z0 + 0.6));
    stairs.push(mid);
    g.add(ceil, lampLightA, lampLightB, ...stairs);
    return { g, lampA, lampB, clock, cup, sill, bulbA, ceil, lampLightA, lampLightB };
  }, [set]);

  // the switch she taps: a generous invisible target over the plate
  const hit = useMemo(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(set.a.group.localToWorld(set.a.switchAt.clone()));
    return m;
  }, [set]);
  useHitTarget('switch', hit);

  useStoryFrame(({ t }) => {
    const s = S.at(t);
    f.lampA.set(s.lampA); f.lampB.set(s.lampB);
    f.lampLightA.intensity = s.lampA * 6;
    f.lampLightB.intensity = s.lampB * 6;
    f.ceil.intensity = s.ceiling * 14;
    (f.bulbA.material as THREE.MeshBasicMaterial).color.set('#4a4036').lerp(new THREE.Color('#fff2d8').multiplyScalar(4), s.ceiling);
    f.clock.set(21, s.minute);
    set.b.roomDoor.rotation.y = -s.roomDoor;
    set.a.entranceDoor.rotation.y = s.gate * 1.4;
    set.b.entranceDoor.rotation.y = s.gateB * 1.4;
  });
  return (
    <>
      <primitive object={f.g} />
      <primitive object={hit} />
      <Cup cup={f.cup} sill={f.sill} />
    </>
  );
}

/** Shared between her and the cup: her right hand's world position. */
const hand = new THREE.Vector3();

function Cup({ cup, sill }: { cup: THREE.Mesh; sill: THREE.Vector3 }) {
  useStoryFrame(({ t }) => {
    const s = S.at(t);
    cup.position.copy(hand).add(new THREE.Vector3(0, -0.02, 0)).lerp(sill, smoothstep(0.75, 1, s.cup));
    cup.visible = t < 66;
  }, 1);
  return <primitive object={cup} />;
}

const RB_BONES = {
  Head: 'Bip01_Head', neck_01: 'Bip01_Neck', pelvis: 'Bip01_Pelvis',
  hand_l: 'Bip01_L_Hand', hand_r: 'Bip01_R_Hand', upperarm_l: 'Bip01_L_UpperArm', upperarm_r: 'Bip01_R_UpperArm',
  lowerarm_l: 'Bip01_L_Forearm', lowerarm_r: 'Bip01_R_Forearm',
};
const HER = {
  parts: [asset('characters/rb-neighbour.glb')], boneMap: RB_BONES,
  animations: ['cup', 'drink', 'look', 'nervous', 'door', 'think', 'walk', 'idle'].map((c) => asset(`animations/rb-neighbour-${c}.glb`)),
};

function Her({ set }: { set: ReturnType<typeof buildFlatsStreet> }) {
  const her = useCharacter(HER);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const sw = useMemo(() => set.a.group.localToWorld(set.a.switchAt.clone()), [set]);
  useStoryFrame(({ t, idle }) => {
    const s = S.at(t);
    her.pose(HER_CLIPS.sample(t, idle));
    her.root.getObjectByName('Bip01')!.position.z = 0;
    const { p, face } = herAt(t);
    her.root.position.set(...p);
    her.root.rotation.set(0, face, 0);
    her.root.visible = !(t > 67.8 && t < 69.95);
    her.root.updateMatrixWorld(true);
    // eyes on the other window while she stands at hers, then on what she's doing
    let look: THREE.Vector3 | null = null;
    if (t < 44 || (t > 55.5 && t < 66.2)) look = tmp.a.set(...B(1.9, FY + 1.0, -0.4));
    else if (t > 49 && t < 53.6) look = tmp.a.copy(sw);
    else if (t > 91 && t < 97) look = tmp.a.set(...B(SPOT.lampB[0], FY + 0.6, SPOT.lampB[1]));
    else if (t > 99.4) look = tmp.a.set(...A(1.75, FY + 1.0, -0.5));
    if (look) {
      lookAt(her.bone('neck_01'), her.root, look, 0.5, 0.6);
      lookAt(her.bone('Head'), her.root, look, 0.7, 0.8);
    }
    // the cup to the sill, the hand to the switch
    if (s.cup > 0 && s.cup < 1) {
      const sh = her.bone('upperarm_r').getWorldPosition(tmp.b);
      const target = new THREE.Vector3(...A(1.95, FY + 1.06, -0.4));
      const pole = sh.clone().add(new THREE.Vector3(0.4, -0.5, -0.3));
      solveTwoBone(her.bone('upperarm_r'), her.bone('lowerarm_r'), her.bone('hand_r'), target, pole, Math.sin(s.cup * Math.PI));
    }
    if (s.reach > 0) {
      const sh = her.bone('upperarm_r').getWorldPosition(tmp.b);
      const pole = sh.clone().add(new THREE.Vector3(0.1, -0.6, 0.4));
      solveTwoBone(her.bone('upperarm_r'), her.bone('lowerarm_r'), her.bone('hand_r'), sw.clone().add(new THREE.Vector3(0.06, 0, 0)), pole, s.reach);
    }
    hand.copy(her.bone('hand_r').getWorldPosition(tmp.b));
  });
  return <primitive object={her.root} />;
}
