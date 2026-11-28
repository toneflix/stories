#!/usr/bin/env node
// Turns the Microsoft Rocketbox sources (tools/fetch-sources.sh) into web-ready .glb files:
// avatars with PBR materials and 1024px textures, and clips renamed to the names the
// story scripts use. Runs three.js's FBX loader in headless Chromium.
//
// Usage: node tools/convert-rocketbox.mjs tools/rocketbox.config.json
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import path from 'node:path';
import { jpegOpaqueTextures } from './lib/slim.mjs';

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
/** Write the exported file, then slim it: drop redundant keyframes, JPEG the opaque textures. */
const write = async (out, b64) => {
  fs.mkdirSync(path.dirname(r(out)), { recursive: true });
  const doc = await io.readBinary(new Uint8Array(Buffer.from(b64, 'base64')));
  jpegOpaqueTextures(doc);
  await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup());
  await io.write(r(out), doc);
  console.log(out, (fs.statSync(r(out)).size / 1024).toFixed(0), 'KB');
};

for (const a of cfg.avatars ?? []) await write(a.out, await page.evaluate(([d, n, o]) => window.avatar(d, n, o), [fsUrl(a.dir), a.name, { greyHair: !!a.greyHair }]));
for (const c of cfg.clips ?? []) await write(c.out, await page.evaluate(([u, n, p]) => window.clip(u, n, p), [fsUrl(c.src), c.name, !!c.inPlace]));
await browser.close(); await server.close();
