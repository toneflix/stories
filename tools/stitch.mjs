#!/usr/bin/env node
// Joins the parts from `npm run export -- <id> --chunk i/n` into one film with its soundtrack.
//
//   npm run stitch -- lantern-keeper                 # out/lantern-keeper-parts/ → out/lantern-keeper.mp4
//   npm run stitch -- lantern-keeper --parts dir --out file
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!id) { console.error('usage: npm run stitch -- <story-id> [--parts dir] [--out file]'); process.exit(1); }

const dir = path.resolve(opt('parts', `out/${id}-parts`));
const out = path.resolve(opt('out', `out/${id}.mp4`));
const parts = fs.readdirSync(dir).filter((f) => /^part-\d+\.mp4$/.test(f)).sort();
const wav = path.join(dir, 'soundtrack.wav');
if (!parts.length) throw new Error(`no parts in ${dir}`);
if (!fs.existsSync(wav)) throw new Error(`no soundtrack.wav in ${dir} (it comes with part 0)`);

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags=title', '-of', 'default=nw=1:nk=1', path.join(dir, parts[0])]);
const title = probe.stdout?.toString().trim() ?? '';
const list = path.join(dir, 'parts.txt');
fs.writeFileSync(list, parts.map((f) => `file '${f}'\n`).join(''));
fs.mkdirSync(path.dirname(out), { recursive: true });
const ff = spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'concat', '-safe', '0', '-i', list, '-i', wav,
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
  '-movflags', '+faststart', '-metadata', `title=${title}`, out,
], { stdio: 'inherit' });
if (ff.status !== 0) throw new Error(`ffmpeg exited ${ff.status}`);
const poster = path.join(dir, 'poster.jpg');
if (fs.existsSync(poster)) fs.copyFileSync(poster, out.replace(/\.mp4$/, '.jpg'));
console.log(`stitched ${parts.length} parts → ${path.relative(process.cwd(), out)}`);
