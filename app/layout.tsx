import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { SkipToContent } from '@/components/ui/AccessibilityEnhanced';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Mental Models Observatory',
    template: '%s | Mental Models Observatory',
  },
  description: 'A comprehensive collection of mental models organized across 40 domains of knowledge with full source transparency.',
  keywords: ['mental models', 'thinking frameworks', 'decision making', 'problem solving', 'cognitive tools'],
  authors: [{ name: 'Mental Models Observatory' }],
  creator: 'Mental Models Observatory',
  publisher: 'Mental Models Observatory',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'Mental Models Observatory',
    description: 'A comprehensive collection of mental models organized across 40 domains of knowledge.',
    siteName: 'Mental Models Observatory',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mental Models Observatory',
    description: 'A comprehensive collection of mental models organized across 40 domains of knowledge.',
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
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-neutral-25 text-neutral-800 antialiased`}>
        <div className="flex min-h-full flex-col">
          <header className="p-4 bg-blue-600 text-white">
            <h1>Mental Models Observatory</h1>
          </header>
          <main id="main-content" className="flex-1 p-4">
            {children}
          </main>
          <footer className="p-4 bg-gray-800 text-white">
            <p>© 2024 Mental Models Observatory</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
