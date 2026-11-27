#!/usr/bin/env node
// Turns the Microsoft Rocketbox sources (tools/fetch-sources.sh) into web-ready .glb files:
// avatars with PBR materials and 1024px textures, and clips renamed to the names the
// story scripts use. Runs three.js's FBX loader in headless Chromium.
//
// Usage: node tools/convert-rocketbox.mjs tools/rocketbox.config.json
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import path from 'node:path';

const cfgPath = path.resolve(process.argv[2]);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const r = (p) => path.resolve(path.dirname(cfgPath), p);
const server = await createServer({ server: { port: 0, hmr: false, watch: null, fs: { strict: false } }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${server.resolvedUrls.local[0]}tools/convert/rocketbox.html`);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
const fsUrl = (p) => '/@fs' + r(p);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
/** Colour and normal maps as JPEG unless they carry alpha. */
const jpeg = (bytes) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
  fs.writeFileSync(path.join(dir, 'in.png'), bytes);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, 'in.png'), '-q:v', '3', path.join(dir, 'out.jpg')]);
  const out = fs.readFileSync(path.join(dir, 'out.jpg')); fs.rmSync(dir, { recursive: true }); return out;
};
/** Write the exported file, then slim it: drop redundant keyframes, JPEG the opaque textures. */
const write = async (out, b64) => {
  fs.mkdirSync(path.dirname(r(out)), { recursive: true });
  const doc = await io.readBinary(new Uint8Array(Buffer.from(b64, 'base64')));
  const alpha = new Set(doc.getRoot().listMaterials().filter((m) => m.getAlphaMode() !== 'OPAQUE').map((m) => m.getBaseColorTexture()));
  for (const t of doc.getRoot().listTextures()) if (!alpha.has(t) && t.getMimeType() === 'image/png' && t.getImage()?.[1] === 0x50) t.setImage(new Uint8Array(jpeg(Buffer.from(t.getImage())))).setMimeType('image/jpeg');
  await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
  await io.write(r(out), doc);
  console.log(out, (fs.statSync(r(out)).size / 1024).toFixed(0), 'KB');
};

for (const a of cfg.avatars ?? []) await write(a.out, await page.evaluate(([d, n, o]) => window.avatar(d, n, o), [fsUrl(a.dir), a.name, { greyHair: !!a.greyHair, homeClothes: a.homeClothes }]));
for (const c of cfg.clips ?? []) await write(c.out, await page.evaluate(([u, n, p]) => window.clip(u, n, p), [fsUrl(c.src), c.name, !!c.inPlace]));
await browser.close(); await server.close();
