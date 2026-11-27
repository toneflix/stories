import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CubeIcon, GitHubIcon, PlayIcon } from '@/components/Icons';
import { findReleased, releasedStories, themeLabel } from '@/content/stories';
import { siteUrl } from '@/lib/site';

export function generateStaticParams() {
  return releasedStories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<'/stories/[slug]'>): Promise<Metadata> {
  const story = findReleased((await params).slug);
  if (!story) return {};
  return {
    title: story.title,
    description: story.caption,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: {
      type: 'video.other',
      url: `/stories/${story.slug}`,
      title: story.title,
      description: story.caption,
      images: [{ url: story.poster, width: 720, height: 1280 }],
      videos: [{ url: story.video, type: 'video/mp4', width: 720, height: 1280 }],
    },
    twitter: { card: 'summary_large_image', title: story.title, description: story.caption, images: [story.poster] },
  };
}

export default async function StoryPage({ params }: PageProps<'/stories/[slug]'>) {
  const story = findReleased((await params).slug);
  if (!story) notFound();

  const videoData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: story.title,
    description: story.caption,
    thumbnailUrl: [`${siteUrl}${story.poster}`],
    contentUrl: `${siteUrl}${story.video}`,
    embedUrl: `${siteUrl}/s/${story.slug}`,
    uploadDate: story.published,
    duration: `PT${story.seconds}S`,
    genre: themeLabel(story.theme),
    publisher: { '@type': 'Organization', name: 'Toneflix Stories', logo: { '@type': 'ImageObject', url: `${siteUrl}/brand/mark.png` } },
  };

  return (
    <article className="page story-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoData).replace(/</g, '\\u003c') }} />
      <div className="feature">
        <video className="story-video" src={story.video} poster={story.poster} controls playsInline preload="metadata" />
        <div className="feature-copy">
          <div className="tags">
            {story.narrated && <span>Narrated</span>}
            <span>{themeLabel(story.theme)}</span>
          </div>
          <h1>{story.title}</h1>
          <blockquote>“{story.caption}”</blockquote>
          <div className="stills">
            {story.stills.map((src, i) => (
              <Image key={src} src={src} alt={`${story.title}, still ${i + 1}`} width={180} height={320} />
            ))}
          </div>
          <div className="actions">
            <Link href={`/s/${story.slug}`} className="btn btn-primary">
              <PlayIcon />
              Watch in the feed
            </Link>
            <a href={story.liveUrl} className="btn btn-outline" target="_blank" rel="noopener">
              <CubeIcon size={18} />
              Play it live
            </a>
            <a href={story.sourceUrl} className="btn btn-outline" target="_blank" rel="noopener">
              <GitHubIcon size={18} />
              Read the code
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
