import { NextResponse } from 'next/server';
import { currentUserId, error, storyFrom, type SlugContext } from '@/lib/api';
import { addComment, COMMENT_MAX, listComments } from '@/lib/social';

export async function GET(_req: Request, ctx: SlugContext) {
  const story = await storyFrom(ctx);
  if (!story) return error(404, 'Story not found');
  return NextResponse.json(await listComments(story.slug, await currentUserId()));
}

export async function POST(req: Request, ctx: SlugContext) {
  const story = await storyFrom(ctx);
  if (!story) return error(404, 'Story not found');
  const userId = await currentUserId();
  if (!userId) return error(401, 'Sign in first');
  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  const text = (body ?? '').trim();
  if (!text) return error(400, 'Write something first');
  if (text.length > COMMENT_MAX) return error(400, `Keep it under ${COMMENT_MAX} characters`);
  await addComment(story.slug, userId, text);
  return NextResponse.json(await listComments(story.slug, userId), { status: 201 });
}
