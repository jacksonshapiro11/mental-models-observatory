import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={`${inter.className} h-full bg-white text-gray-900 antialiased`}>
        <div className="flex min-h-full flex-col">
          <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 items-center justify-between">
                <div className="flex items-center">
                  <a href="/" className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🧠</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900">Mental Models Observatory</span>
                  </a>
                </div>
                <nav className="hidden md:flex items-center space-x-8">
                  <a href="/domains" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Domains
                  </a>
                  <a href="/models" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Models
                  </a>
                  <a href="/about" className="text-gray-600 hover:text-gray-900 transition-colors">
                    About
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-gray-200 bg-gray-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Mental Models Observatory</h3>
                  <p className="text-gray-600">
                    A comprehensive collection of mental models organized across 40 domains of knowledge.
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h4>
                  <ul className="space-y-2">
                    <li><a href="/domains" className="text-gray-600 hover:text-gray-900">Domains</a></li>
                    <li><a href="/models" className="text-gray-600 hover:text-gray-900">Models</a></li>
                    <li><a href="/about" className="text-gray-600 hover:text-gray-900">About</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Connect</h4>
                  <ul className="space-y-2">
                    <li><a href="https://github.com/yourusername/mental-models-observatory" className="text-gray-600 hover:text-gray-900">GitHub</a></li>
                    <li><a href="mailto:your-email@example.com" className="text-gray-600 hover:text-gray-900">Contact</a></li>
                  </ul>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-center text-gray-500 text-sm">
                  © {new Date().getFullYear()} Mental Models Observatory. Built with ❤️ for the mental models community.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
