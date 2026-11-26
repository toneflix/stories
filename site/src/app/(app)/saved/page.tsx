import type { Metadata } from 'next';
import { auth } from '@/auth';
import { SignInPrompt } from '@/components/SignInPrompt';
import { StoryGrid } from '@/components/StoryGrid';
import { findReleased, type ReleasedStory } from '@/content/stories';
import { savedStoryIds } from '@/lib/social';

export const metadata: Metadata = { title: 'Saved' };

export default async function SavedPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const saved = userId
    ? (await savedStoryIds(userId)).map(findReleased).filter((s): s is ReleasedStory => !!s)
    : [];

  return (
    <div className="page">
      <header className="page-head">
        <h1>Saved</h1>
      </header>
      {!userId ? (
        <SignInPrompt />
      ) : saved.length ? (
        <StoryGrid stories={saved} filters={false} />
      ) : (
        <p className="muted">Nothing saved yet.</p>
      )}
    </div>
  );
}
