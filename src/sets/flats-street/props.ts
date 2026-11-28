import * as THREE from 'three';
import { Kit, plain } from './materials';
import { surface } from '../../engine/surface';

const wood = () => surface(plain(0.6), 'wood060', { size: 0.7, detail: 0.8 });
const weave = (size = 0.4) => surface(plain(0.95), 'fabric030', { size, detail: 0.7, relief: 0.8 });

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
  const kit = new Kit({ wood: wood() });
  kit.box('wood', top, 0.5, 0.03, 0.4, 0, h, 0);
  for (const [x, z] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17]]) kit.box('wood', top, 0.035, h, 0.035, x, h / 2, z);
  return kit.build();
}

/** A two-seat settee with cushions, facing +z. */
export function buildSettee(cloth = '#5a3f36') {
  const kit = new Kit({ cloth: weave(), wood: wood() });
  kit.box('cloth', cloth, 1.5, 0.22, 0.75, 0, 0.32, 0).box('cloth', cloth, 1.5, 0.5, 0.18, 0, 0.62, -0.3)
    .box('cloth', cloth, 0.16, 0.3, 0.75, -0.76, 0.5, 0).box('cloth', cloth, 0.16, 0.3, 0.75, 0.76, 0.5, 0);
  for (const x of [-0.35, 0.35]) kit.box('cloth', '#6b4c41', 0.68, 0.1, 0.6, x, 0.48, 0.05);
  for (const [x, z] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) kit.box('wood', '#2a1d14', 0.05, 0.21, 0.05, x, 0.105, z);
  return kit.build();
}

/** A wooden chair; with `sheet` a dust sheet is thrown over it. */
export function buildChair(sheet = false) {
  const kit = new Kit({ wood: wood(), cloth: weave() });
  if (sheet) {
    kit.add('cloth', new THREE.CylinderGeometry(0.3, 0.38, 0.92, 9, 2).translate(0, 0.46, 0), '#c9c2b2');
    kit.add('cloth', new THREE.SphereGeometry(0.3, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1).translate(0, 0.92, 0), '#c9c2b2');
  } else {
    kit.box('wood', '#4b3524', 0.45, 0.04, 0.42, 0, 0.45, 0).box('wood', '#4b3524', 0.45, 0.45, 0.03, 0, 0.7, -0.2);
    for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) kit.box('wood', '#4b3524', 0.035, 0.45, 0.035, x, 0.225, z);
  }
  return kit.build();
}

/**
 * The round wall clock ("Basic Clock Rigged" by Blender3D, CC BY 4.0), `d` across, facing +z.
 * Pass the loaded glTF scene. Its own hands sit behind the dial, so it gets new ones, set
 * by `set(hours, minutes, seconds)`.
 */
export function fitWallClock(src: THREE.Object3D, d = 0.3) {
  // bake the skinned model into a still mesh without its glass and hands (model x is out of the dial)
  src.updateMatrixWorld(true);
  const parts: THREE.Mesh[] = [];
  src.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const g = m.geometry.clone();
    g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight');
    const n = g.attributes.position.count, p = new THREE.BufferAttribute(new Float32Array(n * 3), 3), v = new THREE.Vector3(), drop = new Set<number>();
    g.setAttribute('position', p); g.deleteAttribute('normal');
    const sw = m.geometry.attributes.skinWeight, si = m.geometry.attributes.skinIndex;
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      p.setXYZ(i, v.x, v.y, v.z);
      let best = 0, w = 0;
      for (let j = 0; j < 4; j++) if (sw.getComponent(i, j) > w) { w = sw.getComponent(i, j); best = si.getComponent(i, j); }
      if (v.x > 18 || /hand/.test(m.skeleton.bones[best].name)) drop.add(i);
    }
    const idx = g.index!, keep: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const tri = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      if (!tri.every((i) => drop.has(i))) keep.push(...tri);
    }
    g.setIndex(keep);
    g.computeVertexNormals();
    g.rotateY(-Math.PI / 2);
    parts.push(new THREE.Mesh(g, m.material));
  });
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.add(...parts);
  const box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = d / size.y;
  body.scale.setScalar(k);
  body.position.set(-c.x * k, -c.y * k, -box.min.z * k);
  body.traverse((o) => { o.castShadow = true; });
  g.add(body);
  // the dial is 3 model units behind the front of the rim
  const dial = (box.max.z - box.min.z - 3) * k;
  const ink = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 });
  const hand = (len: number, w: number, z: number, mat = ink) => {
    const p = new THREE.Group();
    p.position.z = dial + z;
    p.add(new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.002).translate(0, len / 2 - len * 0.15, 0), mat));
    g.add(p);
    return p;
  };
  const r = d / 2;
  const hr = hand(r * 0.55, 0.009, 0.003), mn = hand(r * 0.8, 0.006, 0.005);
  const sc = hand(r * 0.85, 0.002, 0.007, new THREE.MeshStandardMaterial({ color: '#a01d16', roughness: 0.5 }));
  return {
    group: g,
    set(h: number, m: number, s = 0) {
      mn.rotation.z = -(m / 60) * Math.PI * 2;
      hr.rotation.z = -((h % 12) / 12 + m / 720) * Math.PI * 2;
      sc.rotation.z = -(s / 60) * Math.PI * 2;
    },
  };
}

/** Curtains either side of a window w wide, hung from a rod at height h (local x across, facing +z). */
export function buildCurtains(w: number, h: number, cloth = '#6b2f2a') {
  const kit = new Kit({ cloth: surface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }), 'fabric030', { size: 0.5, detail: 0.6 }), rod: plain(0.4, 0.6) });
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

/** A rug, newspapers or any flat thing on the floor: a thin box. Woven unless `flat`. */
export function buildRug(w: number, d: number, color: string, flat = false) {
  const kit = new Kit({ c: flat ? plain(0.95) : weave(0.3) });
  kit.box('c', color, w, 0.008, d, 0, 0.004, 0);
  return kit.build();
}
