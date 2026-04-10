'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavigationProps {
  variant?: 'light' | 'dark';
  className?: string;
}

const NAV_LINKS = [
  { label: 'Brief', href: '/daily-update' },
  { label: 'Super Brief', href: '/super-brief' },
  { label: 'Archive', href: '/archive' },
  { label: 'Models', href: '/models' },
  { label: 'About', href: '/about' },
];

export function Navigation({ variant = 'light', className = '' }: NavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const bgClass = variant === 'light'
    ? 'bg-white'
    : 'bg-transparent';

  const textClass = variant === 'light'
    ? 'text-[#555555]'
    : 'text-[#888888]';

  const navLinkClass = (href: string) => {
    const active = isActive(href);
    const baseClass = `font-mono text-xs transition-colors hover:text-ct-yellow`;

    if (variant === 'light') {
      return `${baseClass} ${active ? 'text-ct-dark border-b-2 border-ct-dark font-bold' : 'text-[#555555]'}`;
    } else {
      return `${baseClass} ${active ? 'text-white border-b border-ct-yellow' : 'text-[#888888]'}`;
    }
  };

  return (
    <nav className={`h-[44px] ${bgClass} ${className}`}>
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-screen-2xl mx-auto">
        {/* Logo Area */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          {/* CT Pill */}
          <div className="bg-ct-dark text-ct-yellow px-2 py-0.5 rounded font-mono text-xs font-bold">
            CT
          </div>
          {/* cosmic_trex text - hidden on very small screens */}
          <span className={`font-mono text-xs font-bold hidden sm:block ${variant === 'light' ? 'text-ct-dark' : 'text-white'}`}>
            cosmic_trex
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navLinkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
          {/* Subscribe Button */}
          <Link
            href="/subscribe"
            className="font-mono text-xs font-bold text-ct-pink hover:opacity-80 transition-opacity"
          >
            Subscribe
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1 hover:opacity-80 transition-opacity"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X size={20} className={variant === 'light' ? 'text-ct-dark' : 'text-white'} />
          ) : (
            <Menu size={20} className={variant === 'light' ? 'text-ct-dark' : 'text-white'} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden border-t ${variant === 'light' ? 'border-gray-200 bg-white' : 'border-gray-800 bg-black/50'}`}>
          <div className="px-4 sm:px-6 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block font-mono text-xs transition-colors ${navLinkClass(link.href)}`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/subscribe"
              className="block font-mono text-xs font-bold text-ct-pink hover:opacity-80 transition-opacity"
            >
              Subscribe
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navigation;
