import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { enabledProviders } from '@/auth';
import { Providers } from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' });

const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(host ? `https://${host}` : 'http://localhost:3000'),
  title: { default: 'Toneflix Stories', template: '%s · Toneflix Stories' },
  description: 'A collection of short interactive films made with Three.js and WebGL.',
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
