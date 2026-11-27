import * as THREE from 'three';
import { useMemo } from 'react';
import { useStoryFrame, useHitTarget } from '../../engine/clock';
import { useCharacter, lookAt } from '../../engine/character';
import { solveTwoBone } from '../../engine/ik';
import { NarratorCamera } from '../../engine/camera';
import { publicUrl } from '../../engine/types';
import { toon, toonify } from '../../engine/toon';
import { rng } from '../../engine/random';
import { Track, smoothstep, lerp, clamp } from '../../engine/timeline';
import { B, BUS_S, BOARDED, CAMERA, DRIVER_CLIPS, PASSENGER_CLIPS, FARE, BUS_RAISE } from './script';
import { BUS, ROUTE_LENGTH, routePose, shelterPose } from './world';
import { buildPalms, buildPoles, buildShelter, SHELTERS } from './city';
import { buildBus, type BusModel } from './bus';
import { RealAtmosphere, RealWater, Skyline, RealStreet, RealBusBody, weather, polishBus, doorPanels, T3_DOOR, T3_FLOOR } from './real';

const asset = (p: string) => publicUrl(`assets/${p}`);

export function Scene() {
  const model = useMemo(() => { const m = buildBus(); polishBus(m.group); return m; }, []);
  return (
    <>
      <NarratorCamera keys={CAMERA} shake={0.5} />
      <RealAtmosphere />
      <RealWater />
      <City />
      <Skyline />
      <RealStreet />
      <RealBusBody model={model} />
      {SHELTERS.map((i) => <Shelter key={i} i={i} />)}
      <Debris />
      <Bus model={model} />
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
/** Sun direction: low behind the bus at dawn, high at noon, low ahead of it at sunset. */
export const SUN_DIR = new Track<number[]>([
  { t: 0, v: [0.35, 0.18, 1] }, { t: 1, v: [0.4, 1.6, 0.3] }, { t: 2, v: [-0.08, 0.1, -1] }, { t: 2.4, v: [-0.08, 0.02, -1] },
].map((k) => ({ ...k, ease: 'linear' })));
export const col = (tr: Track<number[]>, d: number, out = new THREE.Color()) => out.fromArray(tr.sample(d));

function City() {
  const g = useMemo(() => {
    const g = new THREE.Group();
    g.add(buildPalms(), buildPoles());
    weather(g);
    return g;
  }, []);
  return <primitive object={g} />;
}

function Shelter({ i }: { i: number }) {
  const g = useMemo(() => { const s = buildShelter(i); weather(s); return s; }, [i]);
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
  group.position.copy(p.pos).setY(-BUS.draft + BUS_RAISE + Math.sin(idle * 1.6) * 0.025);
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
    // the T3's own door: out a little, then back along the side
    const t3door = doorPanels.get(model);
    if (t3door) t3door.position.set(-Math.min(1, s.door * 4) * 0.07, 0, -s.door * 1.0);
    model.headlights.color.copy(dim).lerp(on, s.lights);
    for (const g of model.headGlow) { g.material.opacity = s.lights * 0.9; g.scale.setScalar(1.0 + s.lights * 0.8); }
    model.brake.color.copy(brakeOff).lerp(brakeOn, Math.max(s.brake, s.lights * 0.25));
  }, -1);
  return <primitive object={model.group} />;
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
const AYO = { parts: [asset('characters/rb-ayo.glb')], animations: [asset('animations/rb-ayo-drive.glb')], boneMap: RB_BONES };
const HER = {
  parts: [asset('characters/rb-passenger.glb')], boneMap: RB_BONES,
  animations: ['walk', 'idle', 'sit', 'sit-talk'].map((c) => asset(`animations/rb-her-${c}.glb`)),
};

function Driver({ model }: { model: BusModel }) {
  const ade = useCharacter(AYO);
  useMemo(() => {
    const hip = pelvisOffset(ade, 'Driving_Loop');
    // a chair pose with the hands brought to a wheel in front of him (see the frame loop)
    const seat = model.driverSeat;
    ade.root.position.set(seat.x - hip.x, seat.y + SEATED_HIP - hip.y, seat.z - hip.z);
    model.group.add(ade.root);
    // a big, low-tilted van wheel at chest height; the seat is already lowered with the cabin,
    // so undo the cabin's own drop to place it in cabin space
    model.wheelMount.position.set(seat.x, seat.y - model.cabin.position.y + 0.5, seat.z + 0.4);
    model.wheelMount.rotation.x = 0.95;
    model.wheelMount.scale.setScalar(1.15);
  }, [ade, model]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), f: new THREE.Vector3(), n: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const at = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(x, y, z).applyMatrix4(model.group.matrixWorld);

  useStoryFrame(({ t, idle }) => {
    const s = B.at(t);
    model.group.updateMatrixWorld(true);
    ade.pose(DRIVER_CLIPS.sample(t, idle));
    // the wheel follows the road's bends, with a little constant correcting; hands turn with it
    const s0 = BUS_S.sample(t);
    const bend = routePose(s0 + 3).heading - routePose(s0).heading;
    const steer = clamp(bend * 3, -0.35, 0.35) + Math.sin(idle * 0.9) * 0.05 + Math.sin(idle * 2.3) * 0.02;
    model.wheelMount.children[0].rotation.z = steer;
    // both hands wrapped round the rim, knuckles up the wheel, palms to the hub
    const wq = model.wheelMount.getWorldQuaternion(tmp.q);
    const N = tmp.n.set(0, 0, 1).applyQuaternion(wq);
    for (const side of [-1, 1]) {
      const a = Math.atan2(0.05, side * 0.17) + steer;
      const rim = model.wheelMount.localToWorld(tmp.a.set(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0));
      // R: out from the hub; F: along the rim towards 12 o'clock, tipped a little to the dash
      const R = tmp.f.set(Math.cos(a), Math.sin(a), 0).applyQuaternion(wq);
      const F = new THREE.Vector3(-Math.sin(a) * side, Math.cos(a) * side, 0).applyQuaternion(wq).addScaledVector(N, 0.3).normalize();
      const grip = rim.clone().addScaledVector(F, -0.08).addScaledVector(R, 0.03);
      const pole = at(model.driverSeat.x + side * 0.6, model.driverSeat.y - 0.2, model.driverSeat.z + 0.1, tmp.b);
      const lr = side > 0 ? 'l' : 'r', LR = side > 0 ? 'L' : 'R';
      const hand = ade.bone(`hand_${lr}`);
      const finger = (n: string) => ade.root.getObjectByName(`Bip01_${LR}_Finger${n}`)!;
      const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
      // palm towards the hub, at right angles to the fingers
      const P = R.clone().addScaledVector(F, -R.dot(F)).negate().normalize();
      // the right hand is the left's mirror image: its knuckle frame comes out back to front
      if (LR === 'R') P.negate();
      const want = new THREE.Matrix4().makeBasis(F, new THREE.Vector3().crossVectors(P, F), P);
      const place = (target: THREE.Vector3) => {
        solveTwoBone(ade.bone(`upperarm_${lr}`), ade.bone(`lowerarm_${lr}`), hand, target.clone(), pole.clone(), 1);
        // the hand's own frame, from its knuckles: along the fingers, across them, out of the palm
        const cF = wp(finger('2')).sub(wp(hand)).normalize();
        const cA = wp(finger('1')).sub(wp(finger('4')));
        cA.addScaledVector(cF, -cA.dot(cF)).normalize();
        const cur = new THREE.Matrix4().makeBasis(cF, cA, new THREE.Vector3().crossVectors(cF, cA));
        const turn = new THREE.Quaternion().setFromRotationMatrix(want.clone().multiply(cur.transpose()));
        const world = hand.getWorldQuaternion(new THREE.Quaternion()).premultiply(turn);
        hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
        hand.updateMatrixWorld(true);
      };
      place(grip);
      for (const f of [0, 1, 2, 3, 4]) for (const j of ['', '1', '2']) finger(`${f}${j}`).rotateZ(f ? 1 : 0.4);   // fingers closed, thumb half in
      hand.updateMatrixWorld(true);
      // then shift the arm so the rim runs through the middle of the closed fist
      const fist = ['21', '31', '11', '41'].reduce((c, n) => c.add(wp(finger(n))), new THREE.Vector3()).multiplyScalar(0.25);
      // (and 4 cm to his left: the curled fist sits off-centre from the measured knuckles)
      place(grip.add(rim.clone().sub(fist)).add(new THREE.Vector3(0.04, 0, 0).applyQuaternion(wq)));
      hand.updateMatrixWorld(true);
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
  const her = useCharacter(HER);
  const setup = useMemo(() => {
    const seatHip = pelvisOffset(her, 'Sitting_Idle_Loop');
    // her hair cards are a shade lighter than her skin reads in the evening light
    her.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.alphaTest > 0) m.color.multiplyScalar(0.85);
    });
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
    // Rocketbox walks carry root motion on Bip01; the script moves her instead
    her.root.getObjectByName('Bip01')!.position.z = 0;
    if (t < BOARDED) {
      // round the end of the shelter and up onto the bench, facing the road; then across the step into the bus
      const face = sh.right.clone().multiplyScalar(-1);
      const at = (out: number, along: number, y: number) => sh.pos.clone().addScaledVector(sh.right, out).addScaledVector(sh.forward, along).setY(y);
      const stand = at(0.05, 0.2, BENCH_TOP);
      const dz = (T3_DOOR.z0 + T3_DOOR.z1) / 2, floor = T3_FLOOR;
      const door = tmp.a.set(-BUS.width / 2 + 0.25, floor, dz).applyMatrix4(model.group.matrixWorld);
      const inside = tmp.b.set(0, floor, dz + 0.1).applyMatrix4(model.group.matrixWorld);
      const k = s.step, a = s.arrive;
      let p: THREE.Vector3;
      if (k > 0) {
        // one quick step down from the bench into the doorway, then in along the aisle
        p = k < 0.4 ? stand.clone().lerp(door, smoothstep(0.22, 0.4, k)) : door.clone().lerp(inside, (k - 0.4) / 0.6);
      } else if (a < 0.45) p = at(0.15, 2.7, -0.15).lerp(at(0.1, 1.5, BENCH_TOP), a / 0.45);
      else p = at(0.1, 1.5, BENCH_TOP).lerp(stand, (a - 0.45) / 0.55);
      her.root.position.copy(p);
      const heading = Math.atan2(face.x, face.z), walkIn = heading + angleTo(face, sh.forward.clone().multiplyScalar(-1));
      const busForward = routePose(BUS_S.sample(t)).forward;
      const facing = lerp(walkIn, heading, smoothstep(0.7, 1, a));
      her.root.rotation.set(0, lerp(facing, heading + angleTo(face, busForward), smoothstep(0.55, 0.9, k)), 0);
      her.root.visible = t >= 56.4;
      // the T3's doorway is lower than she is: she ducks through it
      if (k > 0) {
        const duck = smoothstep(0.2, 0.38, k) * (1 - smoothstep(0.92, 1, k));
        her.root.updateMatrixWorld(true);
        for (const n of ['Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2']) her.root.getObjectByName(n)!.rotateZ(duck * 0.13);
        her.root.getObjectByName('Bip01_Neck')?.rotateZ(-duck * 0.2);
        her.root.position.y -= duck * 0.12;
      }
      setup.hit.position.copy(stand).add(new THREE.Vector3(0, 1, 0));
    } else {
      // seated behind the driver, riding with the bus
      const seat = model.passengerSeat;
      tmp.m.makeTranslation(seat.x - setup.seatHip.x, seat.y + SEATED_HIP - setup.seatHip.y, seat.z - setup.seatHip.z).premultiply(model.group.matrixWorld);
      tmp.m.decompose(her.root.position, her.root.quaternion, tmp.s);
      her.root.visible = true;
      // she leans forward to hand over the fare
      const lean = smoothstep(0, 0.7, s.reach) * 0.2;
      if (lean) for (const n of ['Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2']) her.root.getObjectByName(n)!.rotateZ(lean);
    }
    her.root.updateMatrixWorld(true);
    // the wave: right arm up, hand swinging
    if (s.wave > 0) {
      const sp = her.bone('upperarm_r').getWorldPosition(new THREE.Vector3());
      const face = sh.right.clone().multiplyScalar(-1), side = new THREE.Vector3(-face.z, 0, face.x);
      // elbow out at shoulder height, forearm up, swinging from the elbow
      const up = new THREE.Vector3(0, 1, 0), out = side.clone();
      const elbow = sp.clone().addScaledVector(out, 0.2).addScaledVector(up, 0.1).addScaledVector(face, 0.08);
      const a = 0.15 + Math.sin(idle * 7) * 0.35;
      const target = elbow.clone().addScaledVector(up, Math.cos(a) * 0.26).addScaledVector(out, Math.sin(a) * 0.26);
      const pole = elbow.clone().addScaledVector(out, 0.3).addScaledVector(face, -0.2).addScaledVector(up, -0.1);
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

