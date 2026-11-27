import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { previewStories } from '@/content/stories';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function hasEarlyAccess(userId?: string) {
  if (!userId) return false;
  const [user] = await db.select({ earlyAccess: users.earlyAccess }).from(users).where(eq(users.id, userId));
  return !!user?.earlyAccess;
}

// Unreleased stories, for accounts with early access only.
export async function previewsForViewer() {
  if (!previewStories.length) return [];
  const session = await auth();
  return (await hasEarlyAccess(session?.user?.id)) ? previewStories : [];
}

export async function findPreview(slug: string) {
  return (await previewsForViewer()).find((s) => s.slug === slug);
}
