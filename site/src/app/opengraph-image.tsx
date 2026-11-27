import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { siteDescription } from '@/lib/site';

export const alt = 'Toneflix Stories';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const mark = await readFile(join(process.cwd(), 'public/brand/mark.png'));
  const src = `data:image/png;base64,${mark.toString('base64')}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#0A0C10',
          color: '#F2F4F7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src={src} width={88} height={88} style={{ borderRadius: 22 }} alt="" />
          <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '0.22em' }}>STORIES</span>
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', maxWidth: 980 }}>
          {siteDescription}
        </div>
        <div style={{ display: 'flex', height: 10, width: 220, borderRadius: 999, background: '#56BCF9' }} />
      </div>
    ),
    size,
  );
}
