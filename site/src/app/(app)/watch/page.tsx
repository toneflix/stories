import type { Metadata } from 'next';
import { Feed } from '@/components/Feed';
import { releasedStories } from '@/content/stories';

export const metadata: Metadata = { title: 'Watch' };

export default function WatchPage() {
  return <Feed stories={releasedStories} />;
}
