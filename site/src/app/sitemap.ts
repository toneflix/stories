import type { MetadataRoute } from 'next';
import { releasedStories } from '@/content/stories';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/stories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/watch`, changeFrequency: 'weekly', priority: 0.6 },
    ...releasedStories.map((s) => ({
      url: `${siteUrl}/stories/${s.slug}`,
      lastModified: s.published,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
      videos: [
        {
          title: s.title,
          thumbnail_loc: `${siteUrl}${s.poster}`,
          description: s.caption,
          content_loc: `${siteUrl}${s.video}`,
          duration: s.seconds,
          publication_date: s.published,
        },
      ],
    })),
  ];
}
