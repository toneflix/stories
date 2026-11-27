import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../../engine/random';
import { Kit, plain, plaster } from './materials';

// A four-storey walk-up block of flats, built in code so it can be entered: a front
// stairwell climbs every floor, and one flat on the second floor is a real room behind its
// window. Other windows show a shallow lit or curtained box, so the shell can stay hollow.
//
// Local space: the front face is the plane z = 0 facing +z, the block runs back to
// z = -DEPTH, x from -WIDTH/2 to WIDTH/2, ground at y = 0.

export const WIDTH = 14, DEPTH = 10, FLOORS = 4, STOREY = 3, PLINTH = 0.3, WALL = 0.25;
/** Floor level of storey f. */
export const level = (f: number) => PLINTH + STOREY * f;
export const ROOF = level(FLOORS);
/** Window bays along the front. */
export const BAYS = [-5.25, -1.75, 1.75, 5.25];
const WIN = { w: 1.4, h: 1.5, sill: 0.95 };
const DOOR = { w: 1.2, h: 2.3 };

/** The stairwell, behind bay -1.75: up-back flight on the left, up-front flight on the right. */
export const STAIR = { x0: -3.5, x1: 0, z0: -5, z1: -WALL, front: -1.4, back: -3.92, split: -1.75 };
/** Steps in each half-flight. */
export const STAIR_STEPS = 9;
/** The flat behind bay 1.75 on the second floor, and its door from the landing. */
export const ROOM = { x0: 0, x1: 4, z0: -4.75, z1: -WALL, f: 2, door: { z0: -1.3, z1: -0.4, h: 2.1 } };

export interface BlockOptions {
  seed: number;
  /** Render colour of the facade. */
  paint: string;
  /** Trim: ledges, sills, door frames. */
  trim: string;
  /** Fraction of the blind windows that glow. */
  lit: number;
  /** Paint on the room's walls. */
  roomPaint: string;
  /** Floor of the room (tiles, worn cement...). */
  roomFloor: string;
}

export interface Block {
  group: THREE.Group;
  /** Hinged leaf; a negative turn about y opens it into the room. */
  roomDoor: THREE.Object3D;
  /** Hinged leaf; a positive turn about y opens it into the building. */
  entranceDoor: THREE.Object3D;
  /** Pivot of the room's light switch, on the room side of the stair wall by the door. */
  switchAt: THREE.Vector3;
  /** Window glass of the room, for the story to dim or reflect. */
  roomGlass: THREE.Mesh;
}

type Opening = { x: number; f: number; w: number; h: number; sill: number; kind: 'blind' | 'stair' | 'room' | 'door' };

function openings(): Opening[] {
  const out: Opening[] = [];
  for (let f = 0; f < FLOORS; f++) for (const x of BAYS) {
    if (f === 0 && x === STAIR.split) out.push({ x, f, ...DOOR, sill: 0, kind: 'door' });
    else out.push({ x, f, ...WIN, kind: x === STAIR.split ? 'stair' : f === ROOM.f && x === 1.75 ? 'room' : 'blind' });
  }
  return out;
}

export function buildBlock(o: BlockOptions): Block {
  const r = rng(o.seed);
  const kit = new Kit({
    plaster: plaster(), trim: plaster(), wood: plain(0.75), metal: plain(0.45, 0.6), paint: plain(0.85), tile: plain(0.35),
    inside: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.BackSide }),
  });
  const glow = new Kit({ glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false }) });
  const ops = openings();

  // ---------------------------------------------------------------- the shell
  // front wall, column by column round the openings, one storey at a time
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f === 0 ? 0 : level(f), y1 = level(f + 1);
    const row = ops.filter((p) => p.f === f).sort((a, b) => a.x - b.x);
    let x = -WIDTH / 2;
    for (const p of row) {
      const a = p.x - p.w / 2, b = p.x + p.w / 2;
      kit.span('plaster', o.paint, x, y0, -WALL, a, y1, 0);
      const s = level(f) + p.sill, t = s + p.h;
      if (s > y0) kit.span('plaster', o.paint, a, y0, -WALL, b, s, 0);
      kit.span('plaster', o.paint, a, t, -WALL, b, y1, 0);
      x = b;
    }
    kit.span('plaster', o.paint, x, y0, -WALL, WIDTH / 2, y1, 0);
    // a ledge at every floor: the rain runs off it and streaks the wall below
    if (f > 0) kit.box('trim', o.trim, WIDTH + 0.2, 0.16, 0.14, 0, level(f) - 0.06, 0.07);
  }
  // sides, back, roof and parapet
  kit.span('plaster', o.paint, -WIDTH / 2, 0, -DEPTH, -WIDTH / 2 + WALL, ROOF, -WALL);
  kit.span('plaster', o.paint, WIDTH / 2 - WALL, 0, -DEPTH, WIDTH / 2, ROOF, -WALL);
  kit.span('plaster', o.paint, -WIDTH / 2, 0, -DEPTH, WIDTH / 2, ROOF, -DEPTH + WALL);
  kit.span('plaster', o.paint, -WIDTH / 2, ROOF - 0.25, -DEPTH, WIDTH / 2, ROOF, 0);
  kit.span('trim', o.trim, -WIDTH / 2 - 0.1, ROOF, -0.1, WIDTH / 2 + 0.1, ROOF + 0.9, 0.12);
  kit.span('trim', o.trim, -WIDTH / 2, ROOF, -DEPTH, -WIDTH / 2 + 0.2, ROOF + 0.9, 0);
  kit.span('trim', o.trim, WIDTH / 2 - 0.2, ROOF, -DEPTH, WIDTH / 2, ROOF + 0.9, 0);
  kit.span('trim', o.trim, -WIDTH / 2, ROOF, -DEPTH, WIDTH / 2, ROOF + 0.9, -DEPTH + 0.2);
  kit.box('plaster', o.trim, WIDTH + 0.4, PLINTH, 0.3, 0, PLINTH / 2, 0.15);
  // a black plastic water tank on a steel stand, as on most roofs
  kit.add('metal', new THREE.CylinderGeometry(0.75, 0.8, 1.6, 20).translate(4.5, ROOF + 1.7, -6), '#151515');
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) kit.box('metal', '#3a3530', 0.06, 0.9, 0.06, 4.5 + dx, ROOF + 0.45, -6 + dz);
  kit.box('metal', '#3a3530', 1.4, 0.06, 1.4, 4.5, ROOF + 0.9, -6);

  // ---------------------------------------------------------------- windows
  for (const p of ops) {
    const s = level(p.f) + p.sill, t = s + p.h, a = p.x - p.w / 2, b = p.x + p.w / 2, cy = (s + t) / 2;
    if (p.kind === 'door') {
      // the street door: a steel frame and a painted steel leaf hinged on its left
      kit.span('metal', '#2a2622', a - 0.08, s, -0.08, a, t + 0.08, 0.04).span('metal', '#2a2622', b, s, -0.08, b + 0.08, t + 0.08, 0.04)
        .span('metal', '#2a2622', a - 0.08, t, -0.08, b + 0.08, t + 0.08, 0.04);
      kit.box('trim', o.trim, p.w + 0.5, 0.18, 0.35, p.x, s - 0.09 + PLINTH * 0, 0.2);
      continue;
    }
    // frame, sill and burglar bars
    kit.span('wood', '#3b3a36', a, s, -0.12, a + 0.06, t, -0.06).span('wood', '#3b3a36', b - 0.06, s, -0.12, b, t, -0.06)
      .span('wood', '#3b3a36', a, t - 0.06, -0.12, b, t, -0.06).span('wood', '#3b3a36', a, s, -0.12, b, s + 0.06, -0.06);
    kit.box('trim', o.trim, p.w + 0.2, 0.07, 0.2, p.x, s - 0.035, 0.05);
    for (let bx = a + 0.1; bx < b - 0.05; bx += 0.13) kit.add('metal', new THREE.CylinderGeometry(0.008, 0.008, p.h, 5).translate(bx, cy, 0.03), '#1c1b19');
    for (const by of [s + 0.3, t - 0.3]) kit.box('metal', '#1c1b19', p.w, 0.02, 0.012, p.x, by, 0.03);
    // an air conditioner under a few of them
    if (p.kind === 'blind' && r() < 0.25) {
      kit.box('metal', '#b9b6ad', 0.8, 0.5, 0.3, p.x + (r() - 0.5) * 0.4, s - 0.45, 0.2);
      kit.box('metal', '#3a3a3a', 0.6, 0.3, 0.02, p.x, s - 0.45, 0.36);
    }
    if (p.kind === 'blind') {
      // a shallow box behind the glass: a room glimpsed through curtains, or lit
      const lit = r() < o.lit;
      const curtain = ['#3d2f2a', '#2c3440', '#4a3b25', '#2e2e2e', '#40302f'][Math.floor(r() * 5)];
      const geo = new THREE.BoxGeometry(p.w - 0.1, p.h - 0.1, 0.6).translate(p.x, cy, -WALL - 0.3);
      if (lit) {
        const warm = new THREE.Color(r() < 0.75 ? '#ffb46a' : '#cfe0ff').multiplyScalar(0.35 + r() * 0.5);
        glow.add('glow', geo, warm);
      } else kit.add('inside', geo, curtain);
    }
  }
  // glass for every window
  const glassGeo: THREE.BufferGeometry[] = [];
  let roomGlass!: THREE.Mesh;
  const glassMat = new THREE.MeshStandardMaterial({ color: '#8a9aa6', metalness: 0.9, roughness: 0.08, transparent: true, opacity: 0.18, depthWrite: false });
  for (const p of ops) {
    if (p.kind === 'door') continue;
    const s = level(p.f) + p.sill, g = new THREE.PlaneGeometry(p.w - 0.1, p.h - 0.1).translate(p.x, s + p.h / 2, -0.1);
    if (p.kind === 'room') { roomGlass = new THREE.Mesh(g, glassMat.clone()); roomGlass.renderOrder = 3; }
    else glassGeo.push(g);
  }
  const glass = new THREE.Mesh(mergeGeometries(glassGeo)!, glassMat);
  glass.renderOrder = 3;

  // ---------------------------------------------------------------- stairwell
  const S = STAIR, steps = STAIR_STEPS, rise = STOREY / 2 / steps, run = (S.front - S.back) / steps;
  kit.span('plaster', '#8f8a7e', S.x0, 0, S.z0, S.x0 + 0.15, ROOF - 0.25, S.z1);
  kit.span('plaster', '#8f8a7e', S.x0, 0, S.z0, S.x1, ROOF - 0.25, S.z0 + 0.15);
  // right-hand wall, shared with the room; on the room's storey it has the doorway
  for (let f = 0; f < FLOORS; f++) {
    const y0 = f === 0 ? 0 : level(f), y1 = level(f + 1);
    if (f === ROOM.f) {
      const d = ROOM.door;
      kit.span('plaster', '#8f8a7e', S.x1 - 0.15, y0, S.z0, S.x1, y1, d.z0);
      kit.span('plaster', '#8f8a7e', S.x1 - 0.15, y0, d.z1, S.x1, y1, S.z1);
      kit.span('plaster', '#8f8a7e', S.x1 - 0.15, level(f) + d.h, d.z0, S.x1, y1, d.z1);
    } else kit.span('plaster', '#8f8a7e', S.x1 - 0.15, y0, S.z0, S.x1, y1, S.z1);
  }
  for (let f = 0; f < FLOORS; f++) {
    const y = level(f);
    // landings: at the floor by the front, halfway up at the back
    kit.span('plaster', '#77736a', S.x0, y - 0.2, S.front, S.x1, y, S.z1);
    if (f < FLOORS - 1) {
      kit.span('plaster', '#77736a', S.x0, y + STOREY / 2 - 0.2, S.z0, S.x1, y + STOREY / 2, S.back);
      for (let i = 0; i < steps; i++) {
        // up-back on the left, up-front on the right
        const z = S.front - run * (i + 0.5);
        kit.box('plaster', '#86817a', S.split - 0.1 - S.x0, rise * (i + 1), run, (S.x0 + S.split - 0.1) / 2, y + rise * (i + 1) / 2, z);
        const z2 = S.back + run * (i + 0.5), top = y + STOREY / 2 + rise * (i + 1);
        kit.box('plaster', '#86817a', S.x1 - S.split - 0.1, top - (y + STOREY / 2 - 0.2), run, (S.split + 0.1 + S.x1) / 2, (top + y + STOREY / 2 - 0.2) / 2, z2);
      }
      // a steel rail up the middle
      const rail = new THREE.CatmullRomCurve3([new THREE.Vector3(S.split, y + 0.95, S.front), new THREE.Vector3(S.split, y + STOREY / 2 + 0.95, S.back), new THREE.Vector3(S.split, y + STOREY + 0.95, S.front)], false, 'catmullrom', 0);
      kit.add('metal', new THREE.TubeGeometry(rail, 16, 0.025, 6), '#2a2724');
      kit.box('metal', '#2a2724', 0.04, 0.95, 0.04, S.split, y + 0.475, S.front);
      kit.box('metal', '#2a2724', 0.04, 0.95, 0.04, S.split, y + STOREY / 2 + 0.475, S.back);
    }
    // a bare bulb on each landing
    glow.add('glow', new THREE.SphereGeometry(0.05, 8, 6).translate(S.x0 + 0.6, y + 2.6, S.front - 0.4), new THREE.Color('#ffd9a0').multiplyScalar(f === 0 ? 3 : 0.4));
  }

  // ---------------------------------------------------------------- the flat
  const R = ROOM, fy = level(R.f), cy = level(R.f + 1);
  kit.span('tile', o.roomFloor, R.x0, fy - 0.2, R.z0, R.x1, fy, R.z1);
  kit.span('paint', '#d8d2c4', R.x0, cy - 0.25, R.z0, R.x1, cy - 0.05, R.z1);
  kit.span('paint', o.roomPaint, R.x1 - 0.15, fy, R.z0, R.x1, cy, R.z1);
  kit.span('paint', o.roomPaint, R.x0, fy, R.z0, R.x1, cy, R.z0 + 0.15);
  // the room side of the stair wall, and paint on the inside of the front wall
  kit.span('paint', o.roomPaint, R.x0 + 0.15, fy, R.z0, R.x0 + 0.16, cy, R.door.z0);
  kit.span('paint', o.roomPaint, R.x0 + 0.15, fy, R.door.z1, R.x0 + 0.16, cy, R.z1);
  kit.span('paint', o.roomPaint, R.x0 + 0.15, fy + R.door.h, R.door.z0, R.x0 + 0.16, cy, R.door.z1);
  kit.span('paint', o.roomPaint, R.x0, fy, R.z1 - 0.01, 1.05, cy, R.z1);
  kit.span('paint', o.roomPaint, 2.45, fy, R.z1 - 0.01, R.x1, cy, R.z1);
  kit.span('paint', o.roomPaint, 1.05, fy, R.z1 - 0.01, 2.45, fy + WIN.sill, R.z1);
  kit.span('paint', o.roomPaint, 1.05, fy + WIN.sill + WIN.h, R.z1 - 0.01, 2.45, cy, R.z1);
  kit.span('wood', '#4a3a2c', R.x0, fy, R.z0 + 0.15, R.x1 - 0.15, fy + 0.08, R.z0 + 0.17);
  // door frame
  kit.span('wood', '#5a4632', R.x0 + 0.1, fy, R.door.z0 - 0.06, R.x0 + 0.2, fy + R.door.h + 0.06, R.door.z0);
  kit.span('wood', '#5a4632', R.x0 + 0.1, fy, R.door.z1, R.x0 + 0.2, fy + R.door.h + 0.06, R.door.z1 + 0.06);
  kit.span('wood', '#5a4632', R.x0 + 0.1, fy + R.door.h, R.door.z0, R.x0 + 0.2, fy + R.door.h + 0.06, R.door.z1);
  // light switch plate by the door
  const switchAt = new THREE.Vector3(R.x0 + 0.17, fy + 1.3, R.door.z0 - 0.25);
  kit.box('paint', '#e9e4d8', 0.02, 0.12, 0.08, switchAt.x, switchAt.y, switchAt.z);

  const group = kit.build();
  group.add(glow.build(false), glass, roomGlass);

  // hinged leaves: pivot at the hinge edge
  const leaf = (w: number, h: number, color: string, t = 0.05) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, h, w).translate(0, h / 2, -w / 2), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    m.castShadow = m.receiveShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: '#b8a070', metalness: 0.8, roughness: 0.3 }));
    knob.position.set(t, 1.0, -w + 0.08);
    pivot.add(m, knob);
    return pivot;
  };
  const roomDoor = leaf(R.door.z1 - R.door.z0, R.door.h, '#6b4b2e');
  // hinged at the front edge of the doorway; it swings into the room, towards the window
  roomDoor.position.set(R.x0 + 0.08, fy, R.door.z1);
  const entranceDoor = new THREE.Group();
  const ent = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w, DOOR.h, 0.05).translate(DOOR.w / 2, DOOR.h / 2, 0), new THREE.MeshStandardMaterial({ color: '#3d4a3a', roughness: 0.55, metalness: 0.5 }));
  ent.castShadow = ent.receiveShadow = true;
  entranceDoor.add(ent);
  entranceDoor.position.set(STAIR.split - DOOR.w / 2, PLINTH, -0.15);
  group.add(roomDoor, entranceDoor);
  return { group, roomDoor, entranceDoor, switchAt, roomGlass };
}

