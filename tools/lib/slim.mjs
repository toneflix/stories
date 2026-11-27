import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Re-encodes a PNG as JPEG with ffmpeg. */
const jpeg = (bytes) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slim-'));
  fs.writeFileSync(path.join(dir, 'in.png'), bytes);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, 'in.png'), '-q:v', '3', path.join(dir, 'out.jpg')]);
  const out = fs.readFileSync(path.join(dir, 'out.jpg')); fs.rmSync(dir, { recursive: true }); return out;
};

/** JPEGs every PNG texture of a glTF document that no transparent material uses as its colour. */
export function jpegOpaqueTextures(doc) {
  const alpha = new Set(doc.getRoot().listMaterials().filter((m) => m.getAlphaMode() !== 'OPAQUE').map((m) => m.getBaseColorTexture()));
  for (const t of doc.getRoot().listTextures()) {
    if (!alpha.has(t) && t.getMimeType() === 'image/png' && t.getImage()?.[1] === 0x50) t.setImage(new Uint8Array(jpeg(Buffer.from(t.getImage())))).setMimeType('image/jpeg');
  }
}
