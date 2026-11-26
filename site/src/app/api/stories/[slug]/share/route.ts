import { NextResponse } from 'next/server';
import { currentUserId, error, storyFrom, type SlugContext } from '@/lib/api';
import { getStoryState, recordShare } from '@/lib/social';

const channels = new Set(['link', 'whatsapp', 'x', 'facebook', 'telegram', 'email', 'native']);

export async function POST(req: Request, ctx: SlugContext) {
  const story = await storyFrom(ctx);
  if (!story) return error(404, 'Story not found');
  const { channel } = (await req.json().catch(() => ({}))) as { channel?: string };
  if (!channel || !channels.has(channel)) return error(400, 'Unknown share channel');
  await recordShare(story.slug, channel);
  return NextResponse.json(await getStoryState(story.slug, await currentUserId()));
}
