#!/usr/bin/env node
// Turns the downloaded CC0 source packs into small web-ready .glb files.
//  - characters: keep base-colour textures only (cel shading ignores normal/roughness maps), resize to 1024px
//  - animations: keep only the clips a story uses, drop the mannequin mesh
//
// Usage: node tools/prepare-assets.mjs <config.json>
// See assets/README.md for where the source packs come from.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const base = path.dirname(path.resolve(process.argv[2]));
const r = (p) => path.resolve(base, p);

function resize(bytes, size, mime) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tex-'));
  const src = path.join(dir, 'in.png'), dst = path.join(dir, mime === 'image/jpeg' ? 'out.jpg' : 'out.png');
  fs.writeFileSync(src, bytes);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale=${size}:${size}:flags=lanczos`, ...(mime === 'image/jpeg' ? ['-q:v', '3'] : []), dst]);
  const out = fs.readFileSync(dst);
  fs.rmSync(dir, { recursive: true });
  return out;
}

// The source .gltf files reference normal/roughness maps we don't download (cel shading
// ignores them). Give the loader a 1x1 stand-in so it can parse the file.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
function fillMissingImages(file) {
  if (!file.endsWith('.gltf')) return;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const img of json.images ?? []) {
    const p = path.join(path.dirname(file), decodeURIComponent(img.uri ?? ''));
    if (img.uri && !fs.existsSync(p)) fs.writeFileSync(p, PIXEL);
  }
}

// ---- hide the base body wherever an outfit covers it ----------------------------
// Outfits are worn over the full base body. Triangles of the body that sit under the
// cloth would poke through when animated, so drop them: a body vertex is "covered" if
// it lies behind (or within a few mm of) the nearest outfit surface.
const xf = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
const xn = (m, v) => { const o = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]; const l = Math.hypot(...o) || 1; return o.map((x) => x / l); };
function surfacePoints(doc) {
  const pts = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
      for (let i = 0; i < P.getCount(); i++) pts.push({ p: xf(m, P.getElement(i, [])), n: xn(m, N.getElement(i, [])) });
    }
  }
  return pts;
}
function cullCovered(doc, coverDocs, { distance = 0.012, reach = 0.06, keepBones = [] } = {}) {
  const cell = reach, grid = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const d of coverDocs) for (const s of surfacePoints(d)) {
    const k = key(...s.p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s);
  }
  const nearest = (p) => {
    let best = null, bd = Infinity;
    const [cx, cy, cz] = p.map((x) => Math.floor(x / cell));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const s of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        const d = Math.hypot(s.p[0] - p[0], s.p[1] - p[1], s.p[2] - p[2]); if (d < bd) { bd = d; best = s; }
      }
    return best ? { s: best, d: bd } : null;
  };
  let removed = 0, total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(), skin = node.getSkin(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    const keepJoints = new Set((skin?.listJoints() ?? []).map((j, i) => (keepBones.includes(j.getName()) ? i : -1)).filter((i) => i >= 0));
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), idx = prim.getIndices();
      if (!idx) continue;
      const covered = new Uint8Array(P.getCount());
      for (let i = 0; i < P.getCount(); i++) {
        if (J && keepJoints.size) {
          const j = J.getElement(i, []), w = W.getElement(i, []);
          if (keepJoints.has(j[w.indexOf(Math.max(...w))])) continue;
        }
        const p = xf(m, P.getElement(i, [])), hit = nearest(p);
        if (!hit) continue;
        const behind = (p[0] - hit.s.p[0]) * hit.s.n[0] + (p[1] - hit.s.p[1]) * hit.s.n[1] + (p[2] - hit.s.p[2]) * hit.s.n[2];
        if (hit.d < distance || behind < 0.002) covered[i] = 1;
      }
      const src = idx.getArray(), keep = [];
      for (let t = 0; t < src.length; t += 3) {
        total++;
        if (covered[src[t]] && covered[src[t + 1]] && covered[src[t + 2]]) { removed++; continue; }
        keep.push(src[t], src[t + 1], src[t + 2]);
      }
      idx.setArray(new Uint32Array(keep));
    }
  }
  console.log(`  culled ${removed}/${total} covered triangles`);
}

for (const c of cfg.characters ?? []) {
  fillMissingImages(r(c.src));
  const doc = await io.read(r(c.src));
  if (c.cullUnder) {
    const covers = [];
    for (const f of c.cullUnder) { fillMissingImages(r(f)); covers.push(await io.read(r(f))); }
    cullCovered(doc, covers, c.cull ?? {});
  }
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
    if (c.textures?.[m.getName()]) {
      const t = doc.createTexture(m.getName()).setImage(new Uint8Array(fs.readFileSync(r(c.textures[m.getName()])))).setMimeType('image/png');
      m.setBaseColorTexture(t);
    }
  }
  await doc.transform(prune(), dedup());
  for (const t of doc.getRoot().listTextures()) {
    const jpg = !c.keepAlpha?.includes(t.getName());
    t.setImage(new Uint8Array(resize(Buffer.from(t.getImage()), c.textureSize ?? 1024, jpg ? 'image/jpeg' : 'image/png')));
    t.setMimeType(jpg ? 'image/jpeg' : 'image/png');
  }
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(prune());
  await io.write(r(c.out), doc);
  console.log(c.out, (fs.statSync(r(c.out)).size / 1024).toFixed(0), 'KB');
}

for (const a of cfg.animations ?? []) {
  const doc = await io.read(r(a.src));
  const keep = new Set(a.clips);
  const used = new Set(doc.getRoot().listAnimations().filter((x) => keep.has(x.getName()))
    .flatMap((x) => x.listSamplers().flatMap((s) => [s.getInput(), s.getOutput()])));
  for (const anim of doc.getRoot().listAnimations()) {
    if (keep.has(anim.getName())) continue;
    for (const s of anim.listSamplers()) for (const acc of [s.getInput(), s.getOutput()]) if (acc && !used.has(acc)) acc.dispose();
    anim.dispose();
  }
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { n.setMesh(null); n.setSkin(null); }
  for (const m of doc.getRoot().listMeshes()) m.dispose();
  await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
  await io.write(r(a.out), doc);
  const got = doc.getRoot().listAnimations().map((x) => x.getName());
  const missing = a.clips.filter((x) => !got.includes(x));
  if (missing.length) throw new Error(`missing clips in ${a.src}: ${missing}`);
  console.log(a.out, (fs.statSync(r(a.out)).size / 1024).toFixed(0), 'KB', got.join(', '));
}
