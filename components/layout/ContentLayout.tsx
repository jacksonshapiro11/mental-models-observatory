'use client';

import Button from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ContentLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarPosition?: 'left' | 'right';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'sm' | 'md' | 'lg';
  showMobileSidebarToggle?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-8xl',
  full: 'max-w-full'
};

const paddingClasses = {
  sm: 'px-4 py-6',
  md: 'px-6 py-8',
  lg: 'px-8 py-12'
};

export function ContentLayout({
  children,
  sidebar,
  sidebarPosition = 'right',
  maxWidth = 'lg',
  padding = 'md',
  showMobileSidebarToggle = true
}: ContentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Calculate reading progress
  useEffect(() => {
    const calculateScrollProgress = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);
    };

    window.addEventListener('scroll', calculateScrollProgress);
    return () => window.removeEventListener('scroll', calculateScrollProgress);
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarElement = document.getElementById('mobile-sidebar');
      const toggleButton = document.getElementById('sidebar-toggle');
      
      if (sidebarOpen && 
          sidebarElement && 
          !sidebarElement.contains(event.target as Node) &&
          toggleButton &&
          !toggleButton.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const hasSidebar = !!sidebar;

  return (
    <div className="min-h-screen bg-neutral-25">
      {/* Reading progress indicator */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-neutral-200 z-40">
        <div 
          className="h-full bg-gradient-to-r from-foundational-500 to-practical-500 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && hasSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" />
      )}

      <div className={`mx-auto ${maxWidthClasses[maxWidth]} ${paddingClasses[padding]}`}>
        <div className={`flex ${hasSidebar ? 'gap-8' : ''}`}>
          {/* Sidebar - Left */}
          {hasSidebar && sidebarPosition === 'left' && (
            <>
              {/* Desktop sidebar */}
              <aside className="hidden lg:block w-80 flex-shrink-0">
                <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto">
                  {sidebar}
                </div>
              </aside>

              {/* Mobile sidebar */}
              <aside 
                id="mobile-sidebar"
                className={`fixed top-0 left-0 bottom-0 w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 lg:hidden ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              >
                <div className="h-full overflow-y-auto p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-neutral-800">Navigation</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSidebarOpen(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {sidebar}
                </div>
              </aside>
            </>
          )}

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Mobile sidebar toggle */}
            {hasSidebar && showMobileSidebarToggle && (
              <div className="lg:hidden mb-6">
                <Button
                  id="sidebar-toggle"
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="flex items-center space-x-2"
                >
                  <Menu className="w-4 h-4" />
                  <span>
                    {sidebarPosition === 'left' ? 'Navigation' : 'Table of Contents'}
                  </span>
                </Button>
              </div>
            )}

            {/* Content wrapper */}
            <div className="prose prose-neutral prose-lg max-w-none">
              {children}
            </div>
          </main>

          {/* Sidebar - Right */}
          {hasSidebar && sidebarPosition === 'right' && (
            <>
              {/* Desktop sidebar */}
              <aside className="hidden lg:block w-80 flex-shrink-0">
                <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto">
                  {sidebar}
                </div>
              </aside>

              {/* Mobile sidebar */}
              <aside 
                id="mobile-sidebar"
                className={`fixed top-0 right-0 bottom-0 w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 lg:hidden ${
                  sidebarOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
              >
                <div className="h-full overflow-y-auto p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-neutral-800">Table of Contents</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSidebarOpen(false)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {sidebar}
                </div>
              </aside>
            </>
          )}
        </div>
      </div>

      {/* Floating action buttons for mobile */}
      {hasSidebar && (
        <div className="fixed bottom-6 right-6 lg:hidden">
          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-12 w-12 rounded-full shadow-lg bg-foundational-600 hover:bg-foundational-700 text-white p-0"
          >
            {sidebarPosition === 'left' ? (
              sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
            ) : (
              sidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ContentLayout;
