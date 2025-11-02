import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { ThemeProvider } from '@/lib/theme-context';
import ThemeToggle from '@/components/ui/ThemeToggle';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Guided Learning Experience',
    template: '%s | Guided Learning Experience',
  },
  description: 'A comprehensive collection of mental models organized across 40 domains of knowledge with full source transparency.',
  keywords: ['mental models', 'thinking frameworks', 'decision making', 'problem solving', 'cognitive tools'],
  authors: [{ name: 'Guided Learning Experience' }],
  creator: 'Guided Learning Experience',
  publisher: 'Guided Learning Experience',
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
    title: 'Guided Learning Experience',
    description: 'A comprehensive collection of mental models organized across 40 domains of knowledge.',
    siteName: 'Guided Learning Experience',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guided Learning Experience',
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
        <ThemeProvider>
          <div className="flex min-h-full flex-col">
            <header className="p-4 bg-blue-600 dark:bg-[var(--espresso-accent)] text-white dark:text-[var(--espresso-cta-text)] flex justify-between items-center transition-colors duration-300">
              <h1>Guided Learning Experience</h1>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <Link 
                  href="/" 
                  className="bg-white dark:bg-[var(--espresso-surface)] text-blue-600 dark:text-[var(--espresso-accent)] px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--espresso-surface)]/80 transition-colors font-medium"
                >
                  Home
                </Link>
              </div>
            </header>
            <main id="main-content" className="flex-1 p-4">
              {children}
            </main>
            <footer className="p-4 bg-gray-800 dark:bg-[var(--espresso-bg-dark)] text-white dark:text-[var(--espresso-body)] transition-colors duration-300">
              <p>© 2024 Guided Learning Experience</p>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
