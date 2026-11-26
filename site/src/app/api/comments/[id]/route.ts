import { NextResponse } from 'next/server';
import { currentUserId, error, type IdContext } from '@/lib/api';
import { deleteComment } from '@/lib/social';

export async function DELETE(_req: Request, ctx: IdContext) {
  const userId = await currentUserId();
  if (!userId) return error(401, 'Sign in first');
  const { id } = await ctx.params;
  if (!(await deleteComment(id, userId))) return error(404, 'Comment not found');
  return NextResponse.json({ ok: true });
}
