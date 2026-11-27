#!/usr/bin/env node
// Renders a story to video from the narrator's camera, frame by frame.
//
//   npm run export -- lantern-keeper                # 720x1280, 30 fps → out/lantern-keeper.mp4
//   npm run export -- lantern-keeper --hd           # 1080x1920
//   npm run export -- lantern-keeper --from 20 --to 26 --no-subs
//
// How: starts Vite, opens the story in headless Chromium with ?capture, and for every
// frame calls window.__story.renderAt(t) and takes a screenshot (canvas + subtitles/title
// overlays), piping frames into ffmpeg. The soundtrack (music, narration, effects) is
// mixed in the page with an OfflineAudioContext, sample-exact, and muxed in.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const MAX_DURATION = 213; // 3:33
const launched = Date.now();
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!id) { console.error('usage: npm run export -- <story-id> [--hd] [--fps 30] [--from s] [--to s] [--no-subs] [--chunk i/n] [--out file]'); process.exit(1); }

const [W, H] = flag('hd') ? [1080, 1920] : (opt('size', '720x1280').split('x').map(Number));
const fps = Number(opt('fps', 30));
// --chunk i/n (e.g. 3/8) renders the i-th of n equal frame ranges without sound; part 0 also writes the
// soundtrack and poster so tools/stitch.mjs can assemble the film.
const chunk = opt('chunk')?.split('/').map(Number);
const out = path.resolve(opt('out', chunk
  ? `out/${id}-parts/part-${String(chunk[0]).padStart(3, '0')}.mp4`
  : `out/${id}${flag('hd') ? '-hd' : ''}.mp4`));
fs.mkdirSync(path.dirname(out), { recursive: true });

// no HMR or file watching: an edit mid-export must not reload the page
const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
// Headless machines usually have no GPU: SwiftShader renders WebGL on the CPU. Pass --gpu on a desktop.
const browser = await chromium.launch({ args: flag('gpu') ? ['--use-angle=default', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}stories/${id}/?capture&w=${W}&h=${H}${flag('no-subs') ? '&subs=0' : ''}${opt('look') ? '&look=' + opt('look') : ''}`);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 180_000 });
const info = await page.evaluate(() => ({ duration: window.__story.duration, title: window.__story.title }));
if (info.duration > MAX_DURATION) throw new Error(`${id} is ${info.duration}s; stories must be under 3:33 (${MAX_DURATION}s)`);

let first, last;
if (chunk) {
  const [i, n] = chunk;
  if (!(n >= 1 && i >= 0 && i < n)) throw new Error(`--chunk ${opt('chunk')}: expected i/n with 0 <= i < n`);
  const total = Math.round(info.duration * fps);
  [first, last] = [Math.floor((i * total) / n), Math.floor(((i + 1) * total) / n)];
} else {
  first = Math.round(Number(opt('from', 0)) * fps);
  last = Math.round(Math.min(info.duration, Number(opt('to', info.duration))) * fps);
}
const frames = last - first;
const from = first / fps;
console.log(`${info.title}: frames ${first}-${last} (${(frames / fps).toFixed(2)}s) at ${W}x${H}, ${fps} fps`);

// soundtrack first (fast): trimmed to the range, or whole for chunked renders
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
const wav = chunk ? path.join(path.dirname(out), 'soundtrack.wav') : path.join(tmp, 'soundtrack.wav');
if (!chunk || chunk[0] === 0) {
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => window.__story.soundtrackWav()), 'base64'));
}

const audioIn = chunk ? [] : ['-ss', String(from), '-t', String(frames / fps), '-i', wav];
const audioOut = chunk ? ['-an'] : ['-c:a', 'aac', '-b:a', '192k', '-shortest'];
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  ...audioIn,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  ...audioOut, '-movflags', '+faststart',
  '-metadata', `title=${info.title}`, out,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));

const started = Date.now();
for (let i = 0; i < frames; i++) {
  const t = (first + i) / fps;
  await page.evaluate((t) => window.__story.renderAt(t), t);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 94 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0 || i === frames - 1) {
    const per = (Date.now() - started) / (i + 1);
    process.stdout.write(`\r  frame ${i + 1}/${frames}  ${(per / 1000).toFixed(2)}s/frame  ~${Math.round(((frames - i - 1) * per) / 60000)} min left   `);
  }
}
ff.stdin.end();
await done;
// poster: a frame from the bloom
if (!chunk || chunk[0] === 0) {
  const poster = chunk ? path.join(path.dirname(out), 'poster.jpg') : out.replace(/\.mp4$/, '.jpg');
  await page.evaluate((t) => window.__story.renderAt(t), Number(opt('poster', Math.min(31.5, info.duration / 2))));
  await page.screenshot({ path: poster, type: 'jpeg', quality: 90 });
}
await browser.close();
await server.close();
fs.rmSync(tmp, { recursive: true });
console.log(`\nwrote ${path.relative(process.cwd(), out)}`);
const took = Math.round((Date.now() - launched) / 1000);
console.log(`took ${Math.floor(took / 60)}m ${took % 60}s`);
