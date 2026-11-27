import type { Metadata } from 'next';
import { Feed } from '@/components/Feed';
import { releasedStories } from '@/content/stories';
import { previewsForViewer } from '@/lib/access';

export const metadata: Metadata = { title: 'Watch' };

export default async function WatchPage() {
  return <Feed stories={[...releasedStories, ...(await previewsForViewer())]} />;
}
