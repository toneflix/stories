import { NextResponse } from 'next/server';
import { currentUserId, error, storyFrom, type SlugContext } from '@/lib/api';
import { getStoryState } from '@/lib/social';

export async function GET(_req: Request, ctx: SlugContext) {
  const story = await storyFrom(ctx);
  if (!story) return error(404, 'Story not found');
  return NextResponse.json(await getStoryState(story.slug, await currentUserId()));
}
