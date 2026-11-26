import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, toonify } from '../../engine/toon';
import { BUS, C, glowTexture, signTexture } from './world';

// The danfo: a yellow minibus with black stripes, built from panels so the inside is real
// (we shoot the fare scene from in there). Bus space: +z front, +x driver's side, y up
// from the bottom of the body.

export interface BusModel {
  group: THREE.Group;
  door: THREE.Group;
  headlights: THREE.MeshBasicMaterial;
  headGlow: THREE.Sprite[];
  brake: THREE.MeshBasicMaterial;
  /** Where the driver's seat cushion is, in bus space. */
  driverSeat: THREE.Vector3;
  passengerSeat: THREE.Vector3;
  wheelMount: THREE.Group;
  tin: THREE.Group;
}

export function buildBus(): BusModel {
  const { length: L, width: W, floor: F, belt: B, roof: R, door: D } = BUS;
  const group = new THREE.Group();
  const shell = new THREE.Group();
  const paint = toon(C.bus), black = toon(C.busStripe), trim = toon(C.busTrim), dark = toon('#2b2a2a'), inside = toon(C.interior), seat = toon(C.seat);
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
  };
  const panel = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const t = 0.06;
  const low = B - 0.15;

  // lower body: sides (the right side split around the sliding door), nose and tail
  add(shell, panel(t, low, L), paint, W / 2 - t / 2, 0.15 + low / 2, 0);
  const rearLen = D.z0 + L / 2, frontLen = L / 2 - D.z1;
  add(shell, panel(t, low, rearLen), paint, -W / 2 + t / 2, 0.15 + low / 2, -L / 2 + rearLen / 2);
  add(shell, panel(t, low, frontLen), paint, -W / 2 + t / 2, 0.15 + low / 2, L / 2 - frontLen / 2);
  add(shell, new RoundedBoxGeometry(W, low + 0.1, 0.16, 3, 0.07), paint, 0, 0.15 + low / 2, L / 2 - 0.08);
  add(shell, new RoundedBoxGeometry(W, low + 0.1, 0.12, 3, 0.05), paint, 0, 0.15 + low / 2, -L / 2 + 0.06);
  add(shell, panel(W - 0.04, 0.1, L - 0.1), inside, 0, F - 0.05, 0);
  add(shell, panel(W - 0.1, F - 0.2, L - 0.3), dark, 0, 0.1 + (F - 0.2) / 2, 0);
  // stripes and bumpers
  for (const y of [0.62, B - 0.04]) {
    add(shell, panel(0.02, 0.09, L - 0.1), black, W / 2 + 0.005, y, 0);
    add(shell, panel(0.02, 0.09, rearLen - 0.05), black, -W / 2 - 0.005, y, -L / 2 + rearLen / 2);
    add(shell, panel(0.02, 0.09, frontLen - 0.05), black, -W / 2 - 0.005, y, L / 2 - frontLen / 2);
    add(shell, panel(W - 0.1, 0.09, 0.02), black, 0, y, L / 2 + 0.005);
    add(shell, panel(W - 0.1, 0.09, 0.02), black, 0, y, -L / 2 - 0.005);
  }
  add(shell, new RoundedBoxGeometry(W + 0.06, 0.16, 0.16, 2, 0.05), dark, 0, 0.3, L / 2 + 0.04);
  add(shell, new RoundedBoxGeometry(W + 0.06, 0.16, 0.16, 2, 0.05), dark, 0, 0.3, -L / 2 - 0.04);
  add(shell, panel(0.9, 0.18, 0.03), dark, 0, 0.5, L / 2 + 0.01);

  // upper body: pillars, roof, rear panel, windscreen frame
  const upH = R - B;
  const pillar = (x: number, z: number, w = 0.09) => add(shell, panel(t, upH, w), paint, x, B + upH / 2, z);
  for (const z of [-L / 2 + 0.06, -1.2, 0.0, 0.95, L / 2 - 0.06]) pillar(W / 2 - t / 2, z, 0.12);
  for (const z of [-L / 2 + 0.06, -1.2, D.z0 - 0.05, D.z1 + 0.05, 1.7, L / 2 - 0.06]) pillar(-W / 2 + t / 2, z, 0.12);
  add(shell, panel(W, upH * 0.45, t), paint, 0, R - upH * 0.225, -L / 2 + t / 2);
  add(shell, panel(t, upH, 0.08), paint, 0, B + upH / 2, L / 2 - 0.05);
  add(shell, new RoundedBoxGeometry(W + 0.04, 0.12, L + 0.02, 3, 0.05), trim, 0, R + 0.04, 0);
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) add(shell, panel(0.04, 0.05, L), black, x, B + 0.02, 0);
  // roof rack with a few bundles
  for (const x of [-0.75, 0.75]) add(shell, panel(0.04, 0.04, L * 0.7), dark, x, R + 0.2, -0.3);
  for (const z of [-1.6, -0.8, 0, 0.8]) add(shell, panel(1.55, 0.04, 0.04), dark, 0, R + 0.2, z);
  add(shell, new RoundedBoxGeometry(0.7, 0.32, 0.9, 2, 0.12), toon('#5d7a9a'), 0.3, R + 0.36, -1.1);
  add(shell, new RoundedBoxGeometry(0.55, 0.26, 0.6, 2, 0.1), toon('#b0603f'), -0.35, R + 0.33, -0.2);

  // side mirrors
  for (const s of [1, -1]) {
    add(shell, panel(0.04, 0.04, 0.3), dark, s * (W / 2 + 0.12), B + 0.2, L / 2 - 0.25).rotation.y = s * 0.6;
    add(shell, new RoundedBoxGeometry(0.06, 0.24, 0.16, 2, 0.03), dark, s * (W / 2 + 0.26), B + 0.3, L / 2 - 0.3);
  }

  // wheels (mostly under water) and arches
  for (const z of [-L / 2 + 0.9, L / 2 - 0.85]) for (const s of [1, -1]) {
    add(shell, new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16).rotateZ(Math.PI / 2), toon('#1d1d1d'), s * (W / 2 - 0.12), 0.3, z);
  }

  // inside: driver's seat, steering wheel, dashboard, benches
  const driverSeat = new THREE.Vector3(0.45, F + 0.44, 1.35);
  const passengerSeat = new THREE.Vector3(0.42, F + 0.44, 0.3);
  const benchAt = (x: number, z: number, w: number) => {
    add(shell, new RoundedBoxGeometry(w, 0.12, 0.5, 2, 0.04), seat, x, F + 0.38, z);
    add(shell, new RoundedBoxGeometry(w, 0.55, 0.1, 2, 0.04), seat, x, F + 0.7, z - 0.27);
    add(shell, panel(w * 0.8, 0.32, 0.3), dark, x, F + 0.16, z);
  };
  benchAt(driverSeat.x, driverSeat.z, 0.55);
  benchAt(-0.45, driverSeat.z, 0.7);
  benchAt(0.42, passengerSeat.z, 0.85);
  benchAt(0.12, -1.05, 1.6);
  benchAt(0.12, -1.95, 1.6);
  add(shell, new RoundedBoxGeometry(W - 0.1, 0.22, 0.4, 2, 0.06), dark, 0, B - 0.02, L / 2 - 0.3);
  const wheelMount = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), dark);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.25), dark);
  wheelMount.add(wheel, column);
  shell.add(wheelMount);
  // the fare tin on the dash and the route card in the windscreen
  const tin = new THREE.Group();
  tin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.11, 16, 1, true), toon('#b5b9bc', { side: THREE.DoubleSide })));
  add(tin, new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16), toon('#8d9194'), 0, -0.05, 0);
  tin.position.set(0.05, B + 0.15, L / 2 - 0.4);
  shell.add(tin);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), new THREE.MeshBasicMaterial({ map: signTexture('ROUTE 7', '#fff8e8', '#1b1b1b', 512, 165) }));
  card.position.set(-0.45, B + 0.2, L / 2 - 0.12);
  card.rotation.x = -0.15;
  shell.add(card);

  toonify(shell, { outline: 0.012 });
  group.add(shell);
  const glass = new THREE.MeshBasicMaterial({ color: '#9fd0e0', transparent: true, opacity: 0.15, depthWrite: false });
  add(group, new THREE.PlaneGeometry(W - 0.15, upH - 0.1), glass, 0, B + upH / 2, L / 2 - 0.03);

  // the sliding door (pulls back along the side when open)
  const door = new THREE.Group();
  const dw = D.z1 - D.z0;
  add(door, panel(t, low, dw), paint, 0, 0.15 + low / 2, 0);
  add(door, panel(t, 0.12, dw), paint, 0, R - 0.06, 0);
  add(door, panel(0.02, 0.09, dw - 0.04), black, -0.04, 0.62, 0);
  add(door, panel(0.02, 0.09, dw - 0.04), black, -0.04, B - 0.04, 0);
  add(door, panel(0.03, 0.05, 0.2), dark, -0.05, 0.8, dw / 2 - 0.15);
  toonify(door, { outline: 0.012 });
  door.position.set(-W / 2 + t / 2, 0, (D.z0 + D.z1) / 2);
  group.add(door);

  // lights: emissive faces plus a glow sprite that blooms after dark
  const headlights = new THREE.MeshBasicMaterial({ color: '#fff3c9', toneMapped: false });
  const headGlow: THREE.Sprite[] = [];
  for (const x of [-0.66, 0.66]) {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), headlights);
    lamp.position.set(x, 0.78, L / 2 + 0.005);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.14, 20), trim);
    ring.position.copy(lamp.position).setZ(L / 2 + 0.004);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffe3a0', 0.25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
    glow.position.set(x, 0.78, L / 2 + 0.1);
    glow.scale.setScalar(1.2);
    group.add(lamp, ring, glow);
    headGlow.push(glow);
  }
  const brake = new THREE.MeshBasicMaterial({ color: '#5a1010', toneMapped: false });
  for (const x of [-0.75, 0.75]) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.3), brake);
    tail.position.set(x, 0.85, -L / 2 - 0.005);
    tail.rotation.y = Math.PI;
    group.add(tail);
  }
  return { group, door, headlights, headGlow, brake, driverSeat, passengerSeat, wheelMount, tin };
}
