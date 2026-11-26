import { NextResponse } from 'next/server';
import { error } from '@/lib/api';
import { subscribe } from '@/lib/social';

export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const value = (email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 200) return error(400, 'Enter a valid email address');
  await subscribe(value);
  return NextResponse.json({ ok: true });
}
