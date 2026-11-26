import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { commentLikes, comments, likes, saves, shares, subscribers, users } from '@/db/schema';

export type StoryState = {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  liked: boolean;
  saved: boolean;
};

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; image: string | null };
  likes: number;
  liked: boolean;
  mine: boolean;
};

export const COMMENT_MAX = 500;

async function total(query: Promise<{ n: number }[]>) {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

export async function getStoryState(storyId: string, userId?: string): Promise<StoryState> {
  const [likeCount, commentCount, saveCount, shareCount, liked, saved] = await Promise.all([
    total(db.select({ n: count() }).from(likes).where(eq(likes.storyId, storyId))),
    total(db.select({ n: count() }).from(comments).where(eq(comments.storyId, storyId))),
    total(db.select({ n: count() }).from(saves).where(eq(saves.storyId, storyId))),
    total(db.select({ n: count() }).from(shares).where(eq(shares.storyId, storyId))),
    userId
      ? total(db.select({ n: count() }).from(likes).where(and(eq(likes.storyId, storyId), eq(likes.userId, userId))))
      : 0,
    userId
      ? total(db.select({ n: count() }).from(saves).where(and(eq(saves.storyId, storyId), eq(saves.userId, userId))))
      : 0,
  ]);
  return {
    likes: likeCount,
    comments: commentCount,
    saves: saveCount,
    shares: shareCount,
    liked: liked > 0,
    saved: saved > 0,
  };
}

export async function setLike(storyId: string, userId: string, on: boolean) {
  if (on) await db.insert(likes).values({ storyId, userId }).onConflictDoNothing();
  else await db.delete(likes).where(and(eq(likes.storyId, storyId), eq(likes.userId, userId)));
}

export async function setSave(storyId: string, userId: string, on: boolean) {
  if (on) await db.insert(saves).values({ storyId, userId }).onConflictDoNothing();
  else await db.delete(saves).where(and(eq(saves.storyId, storyId), eq(saves.userId, userId)));
}

export async function recordShare(storyId: string, channel: string) {
  await db.insert(shares).values({ storyId, channel: channel.slice(0, 20) });
}

export async function savedStoryIds(userId: string) {
  const rows = await db
    .select({ storyId: saves.storyId })
    .from(saves)
    .where(eq(saves.userId, userId))
    .orderBy(desc(saves.createdAt));
  return rows.map((r) => r.storyId);
}

export async function listComments(storyId: string, userId?: string): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      likes: sql<number>`(select count(*) from ${commentLikes} where ${commentLikes.commentId} = ${comments.id})`,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.storyId, storyId))
    .orderBy(desc(comments.createdAt))
    .limit(100);

  const likedIds = new Set<string>();
  if (userId && rows.length) {
    const mine = await db
      .select({ id: commentLikes.commentId })
      .from(commentLikes)
      .where(and(eq(commentLikes.userId, userId), inArray(commentLikes.commentId, rows.map((r) => r.id))));
    mine.forEach((r) => likedIds.add(r.id));
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: { name: r.name ?? r.email?.split('@')[0] ?? 'Viewer', image: r.image },
    likes: Number(r.likes),
    liked: likedIds.has(r.id),
    mine: r.userId === userId,
  }));
}

export async function addComment(storyId: string, userId: string, body: string) {
  const [row] = await db.insert(comments).values({ storyId, userId, body }).returning({ id: comments.id });
  return row.id;
}

export async function deleteComment(id: string, userId: string) {
  const deleted = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.userId, userId)))
    .returning({ id: comments.id });
  return deleted.length > 0;
}

export async function setCommentLike(commentId: string, userId: string, on: boolean) {
  if (on) await db.insert(commentLikes).values({ commentId, userId }).onConflictDoNothing();
  else
    await db.delete(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
}

export async function subscribe(email: string) {
  await db.insert(subscribers).values({ email: email.toLowerCase() }).onConflictDoNothing();
}
