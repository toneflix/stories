import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findReleased } from '@/content/stories';
import { findPreview } from './access';

export type SlugContext = { params: Promise<{ slug: string }> };
export type IdContext = { params: Promise<{ id: string }> };

export const error = (status: number, message: string) => NextResponse.json({ error: message }, { status });

export async function currentUserId() {
  const session = await auth();
  return session?.user?.id;
}

export async function storyFrom(ctx: SlugContext) {
  const { slug } = await ctx.params;
  return findReleased(slug) ?? (await findPreview(slug));
}
