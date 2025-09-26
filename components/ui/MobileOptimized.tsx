'use client';

import React, { useState, useEffect } from 'react';

interface MobileOptimizedProps {
  children: React.ReactNode;
  mobileComponent?: React.ReactNode;
  breakpoint?: number; // pixels
}

export function MobileOptimized({ 
  children, 
  mobileComponent, 
  breakpoint = 768 
}: MobileOptimizedProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  // Show mobile component if provided and we're on mobile
  if (isMobile && mobileComponent) {
    return <>{mobileComponent}</>;
  }

  // Otherwise show the regular component
  return <>{children}</>;
}

// Hook for mobile detection
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// Hook for touch device detection
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouch;
}

// Touch-optimized button sizes
export const touchOptimized = {
  button: 'min-h-[44px] min-w-[44px]', // Apple's minimum tap target size
  spacing: 'space-y-2 sm:space-y-1', // More spacing on mobile
  text: 'text-base sm:text-sm', // Larger text on mobile
  padding: 'p-4 sm:p-3' // More padding on mobile
};

export default MobileOptimized;
