import type { Metadata } from 'next';
import { Source_Sans_3, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/layout/Navigation';
import { WebsiteJsonLd } from '@/components/seo/JsonLd';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Cosmic Trex — Markets, Meditations & Mental Models',
    template: '%s | Cosmic Trex',
  },
  description: 'Daily financial intelligence brief. Trading floor credibility meets editorial edge.',
  keywords: ['mental models', 'thinking frameworks', 'markets', 'daily brief', 'investing', 'meditation', 'decision making'],
  authors: [{ name: 'Cosmic Trex' }],
  creator: 'Cosmic Trex',
  publisher: 'Cosmic Trex',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [
        { url: '/feed.xml', title: 'Cosmic Trex — Daily Brief' },
        { url: '/api/podcast/feed', title: 'Cosmic Trex — Podcast' },
      ],
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Cosmic Trex — Markets, Meditations & Mental Models',
    description: 'Daily financial intelligence brief. Trading floor credibility meets editorial edge.',
    siteName: 'Cosmic Trex',
    images: [
      {
        url: '/podcast-cover.jpg',
        width: 1400,
        height: 1400,
        alt: 'Cosmic Trex — Markets, Meditations & Mental Models',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cosmic Trex — Markets, Meditations & Mental Models',
    description: 'Daily financial intelligence brief. Trading floor credibility meets editorial edge.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      style={{
        '--font-body': 'var(--font-body)',
        '--font-display': 'var(--font-display)',
        '--font-mono': 'var(--font-mono)',
      } as React.CSSProperties & Record<string, string>}
    >
      <body className="antialiased">
        <WebsiteJsonLd />
        <Navigation variant="light" className="sticky top-0 z-50" />
        {children}
      </body>
    </html>
  );
}
