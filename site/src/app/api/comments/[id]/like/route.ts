import { NextResponse } from 'next/server';
import { currentUserId, error, type IdContext } from '@/lib/api';
import { setCommentLike } from '@/lib/social';

async function update(ctx: IdContext, on: boolean) {
  const userId = await currentUserId();
  if (!userId) return error(401, 'Sign in first');
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return error(404, 'Comment not found');
  await setCommentLike(id, userId, on);
  return NextResponse.json({ ok: true });
}

export const PUT = (_req: Request, ctx: IdContext) => update(ctx, true);
export const DELETE = (_req: Request, ctx: IdContext) => update(ctx, false);
