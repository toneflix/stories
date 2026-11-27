import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Feed } from '@/components/Feed';
import { findReleased, releasedStories } from '@/content/stories';
import { findPreview, previewsForViewer } from '@/lib/access';

export function generateStaticParams() {
  return releasedStories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<'/s/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const story = findReleased(slug);
  if (!story) {
    const preview = await findPreview(slug);
    return preview ? { title: preview.title, robots: { index: false } } : {};
  }
  return {
    title: story.title,
    description: story.caption,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: { url: `/s/${story.slug}`, title: story.title, description: story.caption, images: [story.poster], videos: [story.video] },
    twitter: { card: 'summary_large_image', title: story.title, images: [story.poster] },
  };
}

export default async function SharedStoryPage({ params }: PageProps<'/s/[slug]'>) {
  const { slug } = await params;
  const story = findReleased(slug);
  if (story) return <Feed stories={releasedStories} startSlug={story.slug} />;
  const previews = await previewsForViewer();
  if (!previews.some((s) => s.slug === slug)) notFound();
  return <Feed stories={[...releasedStories, ...previews]} startSlug={slug} />;
}
