'use client';

import React, { useState, useEffect } from 'react';
import { List, ChevronDown, ChevronRight } from 'lucide-react';

interface HeadingItem {
  id: string;
  text: string;
  level: number; // 1-6 for h1-h6
  children?: HeadingItem[];
}

interface TableOfContentsProps {
  headings: HeadingItem[];
  activeSection?: string;
  sticky?: boolean;
  collapsible?: boolean;
  maxDepth?: number;
}

export function TableOfContents({ 
  headings, 
  activeSection, 
  sticky = true,
  collapsible = true,
  maxDepth = 3
}: TableOfContentsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Auto-detect active section based on scroll position
  const [detectedActiveSection, setDetectedActiveSection] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings.map(h => document.getElementById(h.id)).filter(Boolean);
      
      if (headingElements.length === 0) return;

      // Find the heading that's currently closest to the top of the viewport
      let currentSection = '';
      const scrollPosition = window.scrollY + 100; // Add offset for better UX

      for (let i = headingElements.length - 1; i >= 0; i--) {
        const element = headingElements[i];
        if (element && element.offsetTop <= scrollPosition) {
          currentSection = element.id;
          break;
        }
      }

      setDetectedActiveSection(currentSection);
    };

    // Initial check
    handleScroll();

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const effectiveActiveSection = activeSection || detectedActiveSection;

  // Auto-expand sections that contain the active section
  useEffect(() => {
    if (effectiveActiveSection) {
      const newExpanded = new Set(expandedSections);
      
      // Find and expand parent sections
      const findAndExpandParents = (items: HeadingItem[], targetId: string): boolean => {
        for (const item of items) {
          if (item.id === targetId) {
            return true;
          }
          if (item.children && findAndExpandParents(item.children, targetId)) {
            newExpanded.add(item.id);
            return true;
          }
        }
        return false;
      };

      findAndExpandParents(headings, effectiveActiveSection);
      setExpandedSections(newExpanded);
    }
  }, [effectiveActiveSection, headings]);

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Account for sticky header
      const elementPosition = element.offsetTop - offset;
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  };

  const renderHeading = (heading: HeadingItem, depth: number = 0) => {
    if (depth >= maxDepth) return null;

    const hasChildren = heading.children && heading.children.length > 0;
    const isExpanded = expandedSections.has(heading.id);
    const isActive = effectiveActiveSection === heading.id;
    const paddingLeft = depth * 16; // 16px per level

    return (
      <li key={heading.id}>
        <div 
          className={`flex items-center group py-1 ${
            isActive 
              ? 'text-foundational-600 font-medium' 
              : 'text-neutral-600 hover:text-neutral-800'
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                toggleSection(heading.id);
              }}
              className="mr-1 p-0.5 rounded hover:bg-neutral-100 transition-colors"
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <div className="w-4 mr-1" /> // Spacer for alignment
          )}

          {/* Section link */}
          <button
            onClick={() => scrollToSection(heading.id)}
            className={`flex-1 text-left text-sm leading-relaxed transition-colors hover:underline ${
              isActive ? 'font-medium' : ''
            }`}
          >
            {heading.text}
          </button>

          {/* Active indicator */}
          {isActive && (
            <div className="w-1 h-4 bg-foundational-500 rounded-full ml-2 flex-shrink-0" />
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <ul className="mt-1">
            {heading.children!.map(child => renderHeading(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav 
      className={`bg-white rounded-lg border border-neutral-200 ${
        sticky ? 'sticky top-20' : ''
      }`}
      aria-label="Table of contents"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-100">
        <div className="flex items-center space-x-2">
          <List className="w-4 h-4 text-neutral-600" />
          <h3 className="text-sm font-medium text-neutral-800">Table of Contents</h3>
        </div>
        
        {collapsible && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-neutral-100 transition-colors"
            aria-label={collapsed ? 'Expand table of contents' : 'Collapse table of contents'}
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3 text-neutral-600" />
            ) : (
              <ChevronDown className="w-3 h-3 text-neutral-600" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 max-h-96 overflow-y-auto">
          <ul className="space-y-1">
            {headings.map(heading => renderHeading(heading))}
          </ul>
        </div>
      )}

      {/* Footer with reading progress */}
      {!collapsed && effectiveActiveSection && (
        <div className="border-t border-neutral-100 p-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Reading Progress</span>
            <span>
              {headings.findIndex(h => h.id === effectiveActiveSection) + 1} of {headings.length}
            </span>
          </div>
          <div className="mt-2 w-full bg-neutral-200 rounded-full h-1">
            <div 
              className="bg-foundational-500 h-1 rounded-full transition-all duration-300"
              style={{ 
                width: `${((headings.findIndex(h => h.id === effectiveActiveSection) + 1) / headings.length) * 100}%` 
              }}
            />
          </div>
        </div>
      )}
    </nav>
  );
}

export default TableOfContents;
