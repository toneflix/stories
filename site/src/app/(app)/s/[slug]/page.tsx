import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Feed } from '@/components/Feed';
import { findReleased, releasedStories } from '@/content/stories';

export function generateStaticParams() {
  return releasedStories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<'/s/[slug]'>): Promise<Metadata> {
  const story = findReleased((await params).slug);
  if (!story) return {};
  return {
    title: story.title,
    description: story.caption,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: { url: `/s/${story.slug}`, title: story.title, description: story.caption, images: [story.poster], videos: [story.video] },
    twitter: { card: 'summary_large_image', title: story.title, images: [story.poster] },
  };
}

export default async function SharedStoryPage({ params }: PageProps<'/s/[slug]'>) {
  const story = findReleased((await params).slug);
  if (!story) notFound();
  return <Feed stories={releasedStories} startSlug={story.slug} />;
}
