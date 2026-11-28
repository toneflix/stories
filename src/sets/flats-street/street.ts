import * as THREE from 'three';
import { rng } from '../../engine/random';
import { Kit, ground, plain, plaster } from './materials';
import { DEPTH, WIDTH } from './block';

// The street between the two blocks: tarmac, kerbs, open drains with slab covers,
// streetlights and electricity poles strung with wires. x runs along the street.

/** Half the width of the road; pavements run from here to the building fronts. */
export const ROAD = 4;
/** Distance from the street's centre line to each block's front. */
export const FRONT = 6;
/** Street extends this far each way along x. */
export const LENGTH = 70;
/** Streetlight positions (x, z) and the height of their lamps. */
export const LIGHTS: [number, number][] = [[-6, 4.6], [6.5, -4.6], [24, 4.6], [-25, -4.6]];
export const LIGHT_Y = 6.2;

export function buildStreet(seed = 3) {
  const r = rng(seed);
  const kit = new Kit({ ground: ground(), kerb: plaster(), metal: plain(0.5, 0.5), wood: plain(0.8), rubbish: plain(0.7) });
  kit.span('ground', '#3a3936', -LENGTH, -0.05, -ROAD, LENGTH, 0, ROAD);
  for (const side of [-1, 1]) {
    // kerb, drain, pavement out to the fronts and beyond (yards between buildings)
    const z = (a: number, b: number) => side > 0 ? [a, b] : [-b, -a];
    const [k0, k1] = z(ROAD, ROAD + 0.2);
    kit.span('kerb', '#8b877c', -LENGTH, 0, k0, LENGTH, 0.18, k1);
    const [d0, d1] = z(ROAD + 0.2, ROAD + 0.75);
    kit.span('kerb', '#1e1d1a', -LENGTH, -0.35, d0, LENGTH, -0.3, d1);
    kit.span('kerb', '#6e6a60', -LENGTH, -0.35, z(ROAD + 0.75, ROAD + 0.85)[0], LENGTH, 0.18, z(ROAD + 0.75, ROAD + 0.85)[1]);
    // concrete slabs over the drain, a few missing
    for (let x = -LENGTH; x < LENGTH; x += 1.0) if (r() > 0.18) kit.box('kerb', '#7d796f', 0.96, 0.08, 0.6, x + 0.5, 0.14, side * (ROAD + 0.475), (r() - 0.5) * 0.03);
    const [p0, p1] = z(ROAD + 0.85, FRONT + DEPTH + 6);
    kit.span('ground', '#55524b', -LENGTH, 0, p0, LENGTH, 0.15, p1);
  }
  // streetlights: concrete post, steel arm, a sodium lamp over the road
  for (const [x, z] of LIGHTS) {
    const s = Math.sign(z);
    kit.box('kerb', '#8a857a', 0.22, LIGHT_Y + 0.3, 0.22, x, (LIGHT_Y + 0.3) / 2, z);
    kit.box('metal', '#3b3934', 0.08, 0.08, 1.6, x, LIGHT_Y + 0.25, z - s * 0.8);
    kit.box('metal', '#2a2926', 0.3, 0.12, 0.6, x, LIGHT_Y + 0.15, z - s * 1.5);
  }
  // wooden electricity poles and sagging wires along the north pavement, a drop to each block
  const poles = [-35, -21, -8, 8, 22].map((x) => new THREE.Vector3(x + (r() - 0.5) * 2, 0, ROAD + 1.4));
  for (const p of poles) {
    kit.add('wood', new THREE.CylinderGeometry(0.11, 0.14, 9, 8).translate(p.x, 4.5, p.z), '#4a3c2d');
    kit.box('wood', '#3c3126', 1.6, 0.1, 0.1, p.x, 8.4, p.z);
    kit.box('metal', '#5a5a55', 0.5, 0.6, 0.4, p.x, 7.4, p.z + 0.25);
  }
  const wire = (a: THREE.Vector3, b: THREE.Vector3, sag: number) => {
    const m = a.clone().lerp(b, 0.5); m.y -= sag;
    kit.add('metal', new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 20, 0.012, 4), '#111111');
  };
  for (let i = 0; i < poles.length - 1; i++) for (const dx of [-0.7, 0, 0.7]) {
    const a = poles[i].clone().setY(8.45).add(new THREE.Vector3(dx, 0, 0)), b = poles[i + 1].clone().setY(8.45).add(new THREE.Vector3(dx, 0, 0));
    wire(a, b, 0.6 + r() * 0.3);
  }
  wire(poles[3].clone().setY(8.4), new THREE.Vector3(4, 11.8, FRONT + 0.1), 0.4);
  wire(poles[2].clone().setY(8.4), new THREE.Vector3(-4, 11.8, -FRONT - 0.1), 0.8);
  // rubbish by the drains: bags, a crate, cans
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * LENGTH * 1.6, side = r() > 0.5 ? 1 : -1, z = side * (ROAD + 1.0 + r() * 0.6);
    if (Math.abs(x) < 7 && r() < 0.6) continue;
    const k = r();
    if (k < 0.5) kit.add('rubbish', new THREE.SphereGeometry(0.22 + r() * 0.12, 8, 6).scale(1, 0.75, 1).translate(x, 0.3, z), ['#151515', '#1d2a3a', '#2c2c2c'][Math.floor(r() * 3)]);
    else if (k < 0.75) kit.box('rubbish', '#6b5a3c', 0.5, 0.3, 0.35, x, 0.3, z, r() * 3);
    else kit.add('rubbish', new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8).rotateZ(Math.PI / 2).rotateY(r() * 3).translate(x, 0.19, z), '#a83a2a');
  }
  return kit.build();
}

/** A shared-yard generator on the pavement in front of a block, with its exhaust pipe. */
export function buildGenerator() {
  const kit = new Kit({ metal: plain(0.45, 0.4), dark: plain(0.8) });
  kit.box('metal', '#c8a03a', 1.1, 0.75, 0.7, 0, 0.53, 0).box('dark', '#1a1a1a', 1.16, 0.08, 0.76, 0, 0.12, 0)
    .box('dark', '#222', 0.5, 0.35, 0.02, 0.15, 0.6, 0.36).box('metal', '#555', 0.08, 0.4, 0.08, -0.45, 1.05, -0.2);
  return kit.build();
}

/** The block footprint, for anything placed beside the blocks. */
export const BLOCK_SPAN = { half: WIDTH / 2 };
