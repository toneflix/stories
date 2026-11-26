import type { Metadata } from 'next';
import Image from 'next/image';
import { StoryGrid } from '@/components/StoryGrid';
import { stories } from '@/content/stories';

export const metadata: Metadata = { title: 'All stories' };

export default function StoriesPage() {
  return (
    <div className="page">
      <header className="page-head">
        <Image src="/brand/mark.png" alt="" width={88} height={88} className="page-avatar" />
        <h1>All stories</h1>
      </header>
      <StoryGrid stories={stories} />
    </div>
  );
}
