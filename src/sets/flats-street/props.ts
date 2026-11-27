import * as THREE from 'three';
import { Kit, plain } from './materials';

// Furniture and small things for the flats, in metres, each standing on y = 0.

/**
 * A table lamp: weighted base, brass stem, cloth shade, bulb. `cord` runs from the base
 * through the given points (base-local) to `plugAt`, where a two-pin plug ends it.
 */
export function buildLamp(cord: THREE.Vector3[], plugAt: THREE.Vector3) {
  const g = new THREE.Group();
  const kit = new Kit({ brass: plain(0.35, 0.8), base: plain(0.4, 0.2), cord: plain(0.6), plug: plain(0.5) });
  kit.add('base', new THREE.CylinderGeometry(0.09, 0.11, 0.05, 24).translate(0, 0.025, 0), '#2a2622');
  kit.add('brass', new THREE.CylinderGeometry(0.012, 0.012, 0.38, 10).translate(0, 0.24, 0), '#b08d4e');
  kit.add('brass', new THREE.TorusGeometry(0.02, 0.006, 6, 12).rotateX(Math.PI / 2).translate(0, 0.43, 0), '#b08d4e');
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.02, -0.08), ...cord, plugAt]);
  kit.add('cord', new THREE.TubeGeometry(path, 48, 0.0045, 5), '#141414');
  kit.box('plug', '#e4dfd2', 0.04, 0.025, 0.045, plugAt.x, plugAt.y, plugAt.z);
  const dir = path.getTangent(1);
  for (const s of [-1, 1]) {
    kit.add('brass', new THREE.CylinderGeometry(0.003, 0.003, 0.02, 5).rotateZ(Math.PI / 2).rotateY(Math.atan2(-dir.z, dir.x)).translate(plugAt.x + dir.x * 0.03 + s * 0.008 * dir.z, plugAt.y, plugAt.z + dir.z * 0.03 - s * 0.008 * dir.x), '#c9a860');
  }
  g.add(kit.build());
  // the shade: cloth, lit from inside
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#e8d6b0', roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffb060', emissiveIntensity: 0 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 28, 1, true).translate(0, 0.46, 0), shadeMat);
  shade.castShadow = true;
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#3a3226', toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8).translate(0, 0.44, 0), bulbMat);
  g.add(shade, bulb);
  return {
    group: g,
    /** 0 off, 1 on. */
    set(on: number) {
      shadeMat.emissiveIntensity = on * 3;
      bulbMat.color.set('#3a3226').lerp(new THREE.Color('#fff0c8').multiplyScalar(6), on);
    },
  };
}

/** A small side table, `h` high to its top. */
export function buildSideTable(top = '#5b4330', h = 0.6) {
  const kit = new Kit({ wood: plain(0.6) });
  kit.box('wood', top, 0.5, 0.03, 0.4, 0, h, 0);
  for (const [x, z] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17]]) kit.box('wood', top, 0.035, h, 0.035, x, h / 2, z);
  return kit.build();
}

/** A two-seat settee with cushions, facing +z. */
export function buildSettee(cloth = '#5a3f36') {
  const kit = new Kit({ cloth: plain(0.95), wood: plain(0.6) });
  kit.box('cloth', cloth, 1.5, 0.22, 0.75, 0, 0.32, 0).box('cloth', cloth, 1.5, 0.5, 0.18, 0, 0.62, -0.3)
    .box('cloth', cloth, 0.16, 0.3, 0.75, -0.76, 0.5, 0).box('cloth', cloth, 0.16, 0.3, 0.75, 0.76, 0.5, 0);
  for (const x of [-0.35, 0.35]) kit.box('cloth', '#6b4c41', 0.68, 0.1, 0.6, x, 0.48, 0.05);
  for (const [x, z] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) kit.box('wood', '#2a1d14', 0.05, 0.21, 0.05, x, 0.105, z);
  return kit.build();
}

/** A wooden chair; with `sheet` a dust sheet is thrown over it. */
export function buildChair(sheet = false) {
  const kit = new Kit({ wood: plain(0.6), cloth: plain(0.95) });
  if (sheet) {
    kit.add('cloth', new THREE.CylinderGeometry(0.3, 0.38, 0.92, 9, 2).translate(0, 0.46, 0), '#c9c2b2');
    kit.add('cloth', new THREE.SphereGeometry(0.3, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1).translate(0, 0.92, 0), '#c9c2b2');
  } else {
    kit.box('wood', '#4b3524', 0.45, 0.04, 0.42, 0, 0.45, 0).box('wood', '#4b3524', 0.45, 0.45, 0.03, 0, 0.7, -0.2);
    for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) kit.box('wood', '#4b3524', 0.035, 0.45, 0.035, x, 0.225, z);
  }
  return kit.build();
}

/** A round wall clock with hands set by `set(hours, minutes)`; it faces +z. */
export function buildClock() {
  const g = new THREE.Group();
  const kit = new Kit({ rim: plain(0.4, 0.3), face: plain(0.6) });
  kit.add('rim', new THREE.TorusGeometry(0.15, 0.015, 8, 32), '#1c1c1c');
  kit.add('face', new THREE.CylinderGeometry(0.15, 0.15, 0.01, 32).rotateX(Math.PI / 2), '#efe9da');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    kit.box('rim', '#1c1c1c', i % 3 ? 0.006 : 0.012, 0.025, 0.004, Math.sin(a) * 0.125, Math.cos(a) * 0.125, 0.008, 0);
  }
  g.add(kit.build(false));
  const hand = (len: number, w: number) => {
    const p = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.004).translate(0, len / 2 - 0.015, 0), new THREE.MeshStandardMaterial({ color: '#141414' }));
    m.position.z = 0.012; p.add(m); g.add(p);
    return p;
  };
  const hr = hand(0.08, 0.012), mn = hand(0.115, 0.008);
  return { group: g, set(h: number, m: number) { mn.rotation.z = -(m / 60) * Math.PI * 2; hr.rotation.z = -((h % 12) / 12 + m / 720) * Math.PI * 2; } };
}

/** Curtains either side of a window w wide, hung from a rod at height h (local x across, facing +z). */
export function buildCurtains(w: number, h: number, cloth = '#6b2f2a') {
  const kit = new Kit({ cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }), rod: plain(0.4, 0.6) });
  kit.add('rod', new THREE.CylinderGeometry(0.012, 0.012, w + 0.6, 8).rotateZ(Math.PI / 2).translate(0, h, 0), '#3a3026');
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.45, h - 0.1, 12, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40) * 0.025);
    geo.computeVertexNormals();
    kit.add('cloth', geo.translate(s * (w / 2 + 0.05), (h - 0.1) / 2 + 0.05, 0), cloth);
  }
  return kit.build();
}

/** A wall socket plate with two holes; faces +z. */
export function buildSocket() {
  const kit = new Kit({ p: plain(0.5) });
  kit.box('p', '#3a3631', 0.095, 0.095, 0.01, 0, 0, 0).box('p', '#ece8de', 0.085, 0.085, 0.014, 0, 0, 0)
    .box('p', '#111', 0.01, 0.02, 0.018, -0.014, -0.012, 0).box('p', '#111', 0.01, 0.02, 0.018, 0.014, -0.012, 0).box('p', '#111', 0.012, 0.012, 0.018, 0, 0.018, 0);
  return kit.build(false);
}

/** A rug, newspapers or any flat thing on the floor: a thin box. */
export function buildRug(w: number, d: number, color: string) {
  const kit = new Kit({ c: plain(0.95) });
  kit.box('c', color, w, 0.008, d, 0, 0.004, 0);
  return kit.build();
}
