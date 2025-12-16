/**
 * MOBILE & FARCASTER MINI APP OPTIMIZATIONS
 * Touch interactions, gestures, and mobile-first features
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useViewport } from './viewport';

// TOUCH GESTURE DETECTION
export interface TouchGestureEvent {
  type: 'swipe' | 'tap' | 'longpress' | 'pinch' | 'swipe-progress';
  direction?: 'left' | 'right' | 'up' | 'down';
  distance?: number;
  duration?: number;
  scale?: number;
  progress?: number; // 0-100 for swipe progress feedback
}

export function useTouchGestures(
  onGesture: (gesture: TouchGestureEvent) => void,
  options: {
    swipeThreshold?: number;
    longPressDelay?: number;
    tapTimeout?: number;
  } = {}
) {
  const { swipeThreshold = 50, longPressDelay = 500, tapTimeout = 200 } = options;
  
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout>();

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      onGesture({ type: 'longpress' });
    }, longPressDelay);
  }, [onGesture, longPressDelay]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Only emit swipe progress for horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY) && distance > 5) {
      const progress = Math.min((distance / swipeThreshold) * 100, 150);
      onGesture({
        type: 'swipe-progress',
        direction: deltaX > 0 ? 'right' : 'left',
        progress,
        distance,
      });
    }
  }, [onGesture, swipeThreshold]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Tap detection
    if (distance < 10 && duration < tapTimeout) {
      onGesture({ type: 'tap' });
      return;
    }

    // Swipe detection
    if (distance > swipeThreshold) {
      let direction: 'left' | 'right' | 'up' | 'down';
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      onGesture({ 
        type: 'swipe', 
        direction, 
        distance,
        duration 
      });
    }

    touchStartRef.current = null;
  }, [onGesture, swipeThreshold, tapTimeout]);

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}

// HAPTIC FEEDBACK
export function useHaptics() {
  const { isFarcasterFrame } = useViewport();

  return useCallback((type: 'light' | 'medium' | 'heavy' | 'error' | 'success' = 'light') => {
    if (!isFarcasterFrame || !navigator.vibrate) return;

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [40],
      error: [100, 50, 100],
      success: [50, 50, 50],
    };

    try {
      navigator.vibrate(patterns[type]);
    } catch (e) {
      // Silently fail if vibration not supported
    }
  }, [isFarcasterFrame]);
}

// VIRTUAL KEYBOARD DETECTION
export function useVirtualKeyboard(onToggle?: (isOpen: boolean) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const initialViewportHeight = useRef<number>();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    initialViewportHeight.current = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const heightDifference = (initialViewportHeight.current || 0) - currentHeight;
      const threshold = 150; // Assume keyboard if height reduces by more than 150px
      
      const keyboardOpen = heightDifference > threshold;
      
      if (keyboardOpen !== isOpen) {
        setIsOpen(keyboardOpen);
        onToggle?.(keyboardOpen);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onToggle]);

  return isOpen;
}

// PULL-TO-REFRESH
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: {
    threshold?: number;
    resistance?: number;
    enabled?: boolean;
  } = {}
) {
  const { threshold = 80, resistance = 0.5, enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;
    startY.current = e.touches[0].clientY;
  }, [enabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || isRefreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    
    // Only allow pull down when at top of scroll
    if (deltaY > 0 && window.scrollY === 0) {
      e.preventDefault();
      const distance = Math.min(deltaY * resistance, threshold * 1.5);
      setPullDistance(distance);
    }
  }, [enabled, isRefreshing, resistance, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || isRefreshing) return;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [enabled, isRefreshing, pullDistance, threshold, onRefresh]);

  return {
    pullDistance,
    isRefreshing,
    isPulling: pullDistance > 0,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

// OPTIMIZED IMAGE LOADING FOR MOBILE
export function useLazyImage(src: string) {
  const [imageSrc, setImageSrc] = useState<string>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => setError(true);
    
    // Start loading when image comes into view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return { imageSrc, isLoaded, error, imgRef };
}

// FARCASTER FRAME COMMUNICATION
export function useFarcasterFrame() {
  const [isInFrame, setIsInFrame] = useState(false);

  useEffect(() => {
    // Detect if running in Farcaster frame
    try {
      setIsInFrame(window.parent !== window && window.location !== window.parent.location);
    } catch (e) {
      // Cross-origin frame - likely Farcaster
      setIsInFrame(true);
    }
  }, []);

  const postMessage = useCallback((action: string, data?: any) => {
    if (!isInFrame) return;

    try {
      window.parent.postMessage({
        type: 'fc_frame',
        action,
        data,
      }, '*');
    } catch (e) {
      console.warn('Failed to post message to parent frame:', e);
    }
  }, [isInFrame]);

  return { isInFrame, postMessage };
}

// NETWORK OPTIMIZATION FOR MOBILE
export function useNetworkOptimization() {
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnection = () => {
        setConnectionType(connection.effectiveType || 'unknown');
        setIsSlowConnection(['slow-2g', '2g'].includes(connection.effectiveType));
      };

      updateConnection();
      connection.addEventListener('change', updateConnection);
      
      return () => connection.removeEventListener('change', updateConnection);
    }
  }, []);

  return {
    connectionType,
    isSlowConnection,
    shouldOptimizeForBandwidth: isSlowConnection,
  };
}

// SAFE AREA UTILITIES
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
      });
    };

    updateSafeArea();
    window.addEventListener('orientationchange', updateSafeArea);
    
    return () => window.removeEventListener('orientationchange', updateSafeArea);
  }, []);

  return safeArea;
}