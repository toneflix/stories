#!/usr/bin/env node
// Rigs static character models with a Rocketbox skeleton (see tools/convert/transfer.html).
//
// Usage: node tools/skin-transfer.mjs tools/skin-transfer.config.json
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import { jpegOpaqueTextures } from './lib/slim.mjs';

const cfgPath = path.resolve(process.argv[2]);
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const r = (p) => path.resolve(path.dirname(cfgPath), p);
const server = await createServer({ server: { port: 0, hmr: false, watch: null, fs: { strict: false } }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${server.resolvedUrls.local[0]}tools/convert/transfer.html`);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
const fsUrl = (p) => '/@fs' + r(p);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const c of cfg.characters) {
  const b64 = await page.evaluate(([d, t, o]) => window.transfer(d, t, o), [fsUrl(c.donor), fsUrl(c.src), c]);
  const doc = await io.readBinary(new Uint8Array(Buffer.from(b64, 'base64')));
  jpegOpaqueTextures(doc);
  await doc.transform(prune({ keepLeaves: true }), dedup());
  fs.mkdirSync(path.dirname(r(c.out)), { recursive: true });
  await io.write(r(c.out), doc);
  console.log(c.out, (fs.statSync(r(c.out)).size / 1024).toFixed(0), 'KB');
}
await browser.close(); await server.close();
