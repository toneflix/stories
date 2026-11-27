import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { enabledProviders } from '@/auth';
import { Providers } from '@/components/Providers';
import { isProduction, siteDescription, siteUrl } from '@/lib/site';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Toneflix Stories', template: '%s · Toneflix Stories' },
  description: siteDescription,
  alternates: { canonical: './' },
  openGraph: { siteName: 'Toneflix Stories', type: 'website', url: './' },
  twitter: { card: 'summary_large_image' },
  robots: isProduction ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0A0C10', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        <Providers providers={enabledProviders}>{children}</Providers>
      </body>
    </html>
  );
}
