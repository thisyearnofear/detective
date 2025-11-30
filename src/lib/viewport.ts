/**
 * SINGLE SOURCE OF TRUTH for viewport/mobile detection and responsive behavior
 * Consolidates all mobile detection logic and responsive utilities
 */

import { useState, useEffect } from 'react';

// Farcaster mini app specific breakpoints
export const BREAKPOINTS = {
  mobile: 480,     // Farcaster mobile frame
  tablet: 768,     // Standard tablet
  desktop: 1024,   // Desktop and above
} as const;

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

/**
 * Single hook for all viewport detection - replaces all scattered mobile detection
 */
export function useViewport() {
  const [size, setSize] = useState<ViewportSize>('mobile'); // Default mobile-first
  const [dimensions, setDimensions] = useState({ width: 480, height: 800 });

  useEffect(() => {
    // SSR-safe detection
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setDimensions({ width, height });
      
      if (width < BREAKPOINTS.mobile) {
        setSize('mobile');
      } else if (width < BREAKPOINTS.tablet) {
        setSize('tablet');
      } else {
        setSize('desktop');
      }
    };

    // Initial detection
    updateViewport();

    // Listen for changes
    window.addEventListener('resize', updateViewport, { passive: true });
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return {
    size,
    isMobile: size === 'mobile',
    isTablet: size === 'tablet', 
    isDesktop: size === 'desktop',
    isMobileOrTablet: size === 'mobile' || size === 'tablet',
    dimensions,
    // Farcaster mini app specific
    isFarcasterFrame: dimensions.width <= BREAKPOINTS.mobile,
  };
}

/**
 * Responsive class utilities - replaces scattered conditional classes
 */
export const responsive = {
  // Container classes
  container: 'w-full max-w-md mx-auto px-4 safe-area-inset',
  fullContainer: 'min-h-screen w-full overflow-x-hidden',
  
  // Common responsive patterns
  padding: {
    small: 'p-2 sm:p-3',
    medium: 'p-3 sm:p-4 lg:p-6', 
    large: 'p-4 sm:p-6 lg:p-8',
  },
  
  text: {
    small: 'text-xs sm:text-sm',
    medium: 'text-sm sm:text-base',
    large: 'text-lg sm:text-xl lg:text-2xl',
    heading: 'text-xl sm:text-2xl lg:text-3xl',
  },
  
  spacing: {
    small: 'gap-2 sm:gap-3',
    medium: 'gap-3 sm:gap-4 lg:gap-6',
    large: 'gap-4 sm:gap-6 lg:gap-8',
  },
  
  grid: {
    autoFit: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    stack: 'grid grid-cols-1 lg:grid-cols-2',
    inline: 'grid grid-cols-1 sm:grid-cols-3',
  },
} as const;

/**
 * Farcaster mini app optimizations
 */
export const farcaster = {
  // Frame constraints
  maxWidth: BREAKPOINTS.mobile,
  safeArea: 'pb-safe pt-safe',
  
  // Touch targets (44px minimum)
  touchTarget: 'min-h-[44px] min-w-[44px]',
  
  // Common mini app patterns
  bottomNav: 'fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-white/10',
  stickyHeader: 'sticky top-0 z-20 bg-slate-900/95 backdrop-blur-lg border-b border-white/10',
} as const;