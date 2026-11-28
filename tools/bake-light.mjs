#!/usr/bin/env node
// Bakes a story's bounce light (see src/engine/probes.tsx) and saves it next to the story,
// so the player and the renderers load it instead of baking. Run again after moving
// walls, furniture or lights.
//
//   node tools/bake-light.mjs the-other-lamp      → public/stories/the-other-lamp/light.bin
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';

const id = process.argv[2];
if (!id) { console.error('usage: node tools/bake-light.mjs <story-id>'); process.exit(1); }
const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
page.on('console', (m) => { if (m.text().startsWith('probes:') || m.text().includes('baked')) console.log(m.text()); });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${server.resolvedUrls.local[0]}stories/${id}/?capture&rebake&w=360&h=640`);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 0 });
const b64 = await page.evaluate(() => {
  const b = window.__probeBake;
  if (!b) return null;
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
});
if (!b64) throw new Error(`${id} has no light to bake`);
const out = `public/stories/${id}/light.bin`;
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`wrote ${out}`);
await browser.close();
await server.close();
