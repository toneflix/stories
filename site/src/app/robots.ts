import type { MetadataRoute } from 'next';
import { isProduction, siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/saved'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
