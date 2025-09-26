'use client';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    BookOpen,
    Brain,
    ChevronDown,
    Home,
    Info,
    Menu,
    Search,
    Target,
    X
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface NavigationProps {
  currentPath?: string;
  transparent?: boolean;
}

const tierMenuItems = [
  {
    tier: 1,
    label: 'Foundational',
    description: 'Core thinking frameworks',
    href: '/domains?tier=1',
    color: 'text-foundational-600'
  },
  {
    tier: 2,
    label: 'Practical',
    description: 'Applied decision-making tools',
    href: '/domains?tier=2',
    color: 'text-practical-600'
  },
  {
    tier: 3,
    label: 'Specialized',
    description: 'Domain-specific models',
    href: '/domains?tier=3',
    color: 'text-specialized-600'
  }
];

export function Navigation({ currentPath, transparent = false }: NavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tierDropdownOpen, setTierDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);

  const effectivePath = currentPath || pathname;

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setTierDropdownOpen(false);
  }, [pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setTierDropdownOpen(false);
    };

    if (tierDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [tierDropdownOpen]);

  const isActive = (path: string) => {
    if (path === '/') return effectivePath === '/';
    return effectivePath?.startsWith(path);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const navClasses = `
    sticky top-0 z-50 w-full transition-all duration-300
    ${transparent 
      ? 'bg-transparent' 
      : 'bg-white/95 backdrop-blur-sm border-b border-neutral-200'
    }
  `;

  return (
    <nav className={navClasses}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-foundational-500 to-accent-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-neutral-800 hidden sm:block">
                Mental Models Observatory
              </span>
              <span className="text-xl font-bold text-neutral-800 sm:hidden">
                MMO
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {/* Home */}
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') && effectivePath === '/'
                  ? 'text-foundational-600 bg-foundational-50'
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              <Home className="w-4 h-4 md:hidden" />
              <span className="hidden md:block">Home</span>
            </Link>

            {/* Explore with tier dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTierDropdownOpen(!tierDropdownOpen);
                }}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/domains')
                    ? 'text-foundational-600 bg-foundational-50'
                    : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'
                }`}
              >
                <span>Explore</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${tierDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Tier dropdown */}
              {tierDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-50">
                  <div className="px-3 py-2 border-b border-neutral-100">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                      Browse by Tier
                    </p>
                  </div>
                  
                  {tierMenuItems.map((item) => (
                    <Link
                      key={item.tier}
                      href={item.href}
                      className="block px-3 py-2 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${
                          item.tier === 1 ? 'from-foundational-400 to-foundational-600' :
                          item.tier === 2 ? 'from-practical-400 to-practical-600' :
                          'from-specialized-400 to-specialized-600'
                        }`} />
                        <div>
                          <p className={`text-sm font-medium ${item.color}`}>
                            Tier {item.tier}: {item.label}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  
                  <div className="border-t border-neutral-100 mt-2 pt-2">
                    <Link
                      href="/domains"
                      className="block px-3 py-2 text-sm text-foundational-600 hover:bg-foundational-50 transition-colors"
                    >
                      View All Domains →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Models */}
            <Link
              href="/models"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/models')
                  ? 'text-foundational-600 bg-foundational-50'
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              Models
            </Link>

            {/* About */}
            <Link
              href="/about"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about')
                  ? 'text-foundational-600 bg-foundational-50'
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              About
            </Link>
          </div>

          {/* Search and Mobile Menu */}
          <div className="flex items-center space-x-2">
            {/* Desktop Search */}
            <div className="hidden md:block">
              <form onSubmit={handleSearch} className="relative">
                <div className={`flex items-center transition-all duration-300 ${
                  searchExpanded ? 'w-80' : 'w-64'
                }`}>
                  <Input
                    type="search"
                    placeholder="Search models, domains..."
                    value={searchQuery}
                    onChange={(value) => setSearchQuery(value)}
                    onFocus={() => setSearchExpanded(true)}
                    onBlur={() => setSearchExpanded(false)}
                    className="pl-10 pr-4"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                </div>
              </form>
            </div>

            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              onClick={() => {
                // Navigate to search page on mobile
                window.location.href = '/search';
              }}
            >
              <Search className="w-4 h-4" />
            </Button>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Mobile search */}
              <div className="px-3 py-2">
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <Input
                      type="search"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(value) => setSearchQuery(value)}
                      className="pl-10"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  </div>
                </form>
              </div>

              {/* Mobile nav links */}
              <Link
                href="/"
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/') && effectivePath === '/'
                    ? 'text-foundational-600 bg-foundational-50'
                    : 'text-neutral-600'
                }`}
              >
                <Home className="w-5 h-5" />
                <span>Home</span>
              </Link>

              <Link
                href="/domains"
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/domains')
                    ? 'text-foundational-600 bg-foundational-50'
                    : 'text-neutral-600'
                }`}
              >
                <Target className="w-5 h-5" />
                <span>Domains</span>
              </Link>

              <Link
                href="/models"
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/models')
                    ? 'text-foundational-600 bg-foundational-50'
                    : 'text-neutral-600'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                <span>Models</span>
              </Link>

              <Link
                href="/about"
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/about')
                    ? 'text-foundational-600 bg-foundational-50'
                    : 'text-neutral-600'
                }`}
              >
                <Info className="w-5 h-5" />
                <span>About</span>
              </Link>

              {/* Mobile tier links */}
              <div className="pt-4 border-t border-neutral-200 mt-4">
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Browse by Tier
                  </p>
                </div>
                {tierMenuItems.map((item) => (
                  <Link
                    key={item.tier}
                    href={item.href}
                    className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm"
                  >
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${
                      item.tier === 1 ? 'from-foundational-400 to-foundational-600' :
                      item.tier === 2 ? 'from-practical-400 to-practical-600' :
                      'from-specialized-400 to-specialized-600'
                    }`} />
                    <div>
                      <p className={`font-medium ${item.color}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator for framework exploration */}
      <div className="h-1 bg-neutral-100">
        <div 
          className="h-full bg-gradient-to-r from-foundational-500 via-practical-500 to-specialized-500 transition-all duration-500"
          style={{ width: '0%' }} // This would be calculated based on user progress
        />
      </div>
    </nav>
  );
}

export default Navigation;
