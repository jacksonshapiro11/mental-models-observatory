import React from 'react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-ct-dark border-t-[3px] border-ct-yellow">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top row: brand + tagline */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-8 border-b border-text-on-dark-muted/20">
          <div className="flex items-center gap-2">
            <div className="bg-ct-yellow text-ct-dark px-2 py-0.5 rounded font-mono text-xs font-bold">
              CT
            </div>
            <span className="font-mono text-sm font-bold text-white">cosmic_trex</span>
          </div>
          <div className="font-mono text-sm text-text-on-dark-muted">
            markets. meditations. models.
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 mb-8 pb-8 border-b border-text-on-dark-muted/20">
          <Link href="/daily-update" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">
            Brief
          </Link>
          <Link href="/super-brief" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">
            Super Brief
          </Link>
          <Link href="/archive" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">
            Archive
          </Link>
          <Link href="/models" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">
            Observatory
          </Link>
          <Link href="/about" className="font-mono text-xs text-text-on-dark hover:text-ct-yellow transition-colors">
            About
          </Link>
          <Link href="/subscribe" className="font-mono text-xs text-ct-pink hover:text-ct-yellow transition-colors font-bold">
            Subscribe
          </Link>
        </div>

        {/* Bottom row: copyright + contact */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="font-mono text-xs text-text-on-dark-muted">
            {currentYear} cosmic trex
          </div>
          <div className="flex items-center gap-6">
            <a
              href="mailto:cosmictrex11@gmail.com"
              className="font-mono text-xs text-text-on-dark-muted hover:text-ct-yellow transition-colors"
            >
              cosmictrex11@gmail.com
            </a>
            <a
              href="https://twitter.com/cosmictrex"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-text-on-dark-muted hover:text-ct-yellow transition-colors"
            >
              @cosmictrex
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
