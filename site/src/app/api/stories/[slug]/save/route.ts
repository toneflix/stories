import { NextResponse } from 'next/server';
import { currentUserId, error, storyFrom, type SlugContext } from '@/lib/api';
import { getStoryState, setSave } from '@/lib/social';

async function update(ctx: SlugContext, on: boolean) {
  const story = await storyFrom(ctx);
  if (!story) return error(404, 'Story not found');
  const userId = await currentUserId();
  if (!userId) return error(401, 'Sign in first');
  await setSave(story.slug, userId, on);
  return NextResponse.json(await getStoryState(story.slug, userId));
}

export const PUT = (_req: Request, ctx: SlugContext) => update(ctx, true);
export const DELETE = (_req: Request, ctx: SlugContext) => update(ctx, false);
