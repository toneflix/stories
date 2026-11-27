import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, addOutline } from '../../engine/toon';
import { rng } from '../../engine/random';
import { C, palmSpots, poleSpots, shelterPose, signTexture, STOPS } from './world';

// Static set dressing, built once: buildings, palms, poles and wires, bus shelters.
// Each kind is merged into a single vertex-coloured mesh so the frame stays cheap.

/** Give a geometry one flat vertex colour (so many parts can share a material). */
export function colored(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation) =>
  colored(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);

export function mergedMesh(parts: THREE.BufferGeometry[], outline = 0.03) {
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, toon('#ffffff', { vertexColors: true }));
  mesh.castShadow = mesh.receiveShadow = true;
  if (outline > 0) addOutline(mesh, outline);
  return mesh;
}


/** Coconut palms: a curved trunk and a crown of drooping fronds. */
export function buildPalms() {
  const parts: THREE.BufferGeometry[] = [];
  for (const p of palmSpots()) {
    const r = rng(p.seed), h = (7 + r() * 4) * p.s, lean = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(h * 0.18);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(p.x, -2, p.z), new THREE.Vector3(p.x, h * 0.55, p.z), new THREE.Vector3(p.x + lean.x, h, p.z + lean.z));
    parts.push(colored(new THREE.TubeGeometry(curve, 10, 0.17 * p.s, 7), C.palmTrunk));
    const top = curve.getPoint(1);
    const fronds = 8;
    for (let k = 0; k < fronds; k++) {
      const a = (k / fronds) * Math.PI * 2 + r() * 0.4, len = (2.6 + r() * 0.8) * p.s;
      const g = new THREE.PlaneGeometry(len, 0.55 * p.s, 8, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + len / 2, k2 = x / len;
        pos.setXYZ(i, x, -k2 * k2 * len * 0.55, pos.getY(i) * Math.sin(Math.PI * Math.min(1, k2 * 1.1 + 0.05)));
      }
      g.computeVertexNormals();
      g.rotateZ(0.35).rotateY(a).translate(top.x, top.y, top.z);
      parts.push(colored(g, C.palm[k % 3]));
    }
  }
  const mesh = mergedMesh(parts, 0.03);
  (mesh.material as THREE.Material).side = THREE.DoubleSide;
  return mesh;
}

/** Leaning wooden poles with sagging wires between them. */
export function buildPoles() {
  const parts: THREE.BufferGeometry[] = [];
  const spots = poleSpots(), r = rng(7);
  const tops: THREE.Vector3[] = [];
  for (const p of spots) {
    const tilt = (r() - 0.5) * 0.12;
    const g = new THREE.CylinderGeometry(0.11, 0.14, 11, 7).translate(0, 5.5 - 2, 0).rotateZ(tilt);
    parts.push(colored(g.translate(p.x, 0, p.z), '#5b4636'));
    const cross = new THREE.BoxGeometry(1.6, 0.12, 0.12).translate(0, 8.4, 0).rotateZ(tilt);
    parts.push(colored(cross.translate(p.x, 0, p.z), '#5b4636'));
    tops.push(new THREE.Vector3(p.x - Math.sin(tilt) * 8.4, Math.cos(tilt) * 8.4, p.z));
  }
  for (let i = 0; i + 1 < tops.length; i++) for (const dx of [-0.7, 0.7]) {
    const a = tops[i].clone().add(new THREE.Vector3(dx, 0.08, 0)), b = tops[i + 1].clone().add(new THREE.Vector3(dx, 0.08, 0));
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -1.2, 0));
    parts.push(colored(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 12, 0.02, 4), '#1a1a1a'));
  }
  return mergedMesh(parts, 0.012);
}

/**
 * A half-sunk bus shelter at stop i: posts, a tin roof, an advert panel and the bench,
 * its seat just above the water. Local frame: +x away from the road, +z back towards oncoming traffic.
 */
export function buildShelter(i: number) {
  const s = shelterPose(i);
  const g = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  // the realistic look wants weathered paint, a rusted roof and a sun-faded panel
  const steel = '#2f4656', bench = '#8a5a2b';
  const roof = '#6e5a4a', wall = '#8f8573';
  for (const z of [-1.6, 1.6]) for (const x of [-0.2, 0.75]) parts.push(box(0.09, 3.2, 0.09, x, 0.9, z, steel));
  parts.push(colored(new THREE.BoxGeometry(1.5, 0.08, 3.8).rotateZ(-0.12).translate(0.3, 2.55, 0), roof));
  parts.push(box(0.06, 1.7, 3.2, 0.78, 1.15, 0, wall));
  parts.push(box(0.5, 0.08, 3.0, 0.05, 0.3, 0, bench), box(0.08, 0.5, 3.0, 0.3, 0.55, 0, bench));
  for (const z of [-1.3, 0, 1.3]) parts.push(box(0.4, 0.8, 0.07, 0.05, -0.1, z, steel));
  // stop sign on its pole, towards the oncoming bus
  parts.push(box(0.07, 3.2, 0.07, -0.25, 1.0, 2.4, steel));
  const mesh = mergedMesh(parts, 0.018);
  g.add(mesh);
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshToonMaterial({ map: stopSign() }));
  sign.position.set(-0.25, 2.65, 2.44);
  const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = 2.36;
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), new THREE.MeshToonMaterial({ map: signTexture(['DRINK WATER', 'GOD DEY', 'NO WAHALA'][i % 3], ['#1f6fb3', '#c0392b', '#239b56'][i % 3], '#fff6e0', 512, 240) }));
  ad.position.set(0.74, 1.2, 0); ad.rotation.y = -Math.PI / 2;
  g.add(sign, back, ad);
  g.position.copy(s.pos);
  g.rotation.y = Math.atan2(-s.right.z, s.right.x);
  return g;
}

let _stop: THREE.Texture | null = null;
function stopSign() {
  if (_stop) return _stop;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#1d5fa8'; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 44px "Arial Black", Arial, sans-serif'; g.fillText('BUS STOP', 128, 82, 200);
  g.font = 'bold 120px "Arial Black", Arial, sans-serif'; g.fillText('7', 128, 170);
  _stop = new THREE.CanvasTexture(cv);
  _stop.colorSpace = THREE.SRGBColorSpace;
  return _stop;
}

export const SHELTERS = STOPS.map((_, i) => i);
