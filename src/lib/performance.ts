/**
 * PERFORMANCE OPTIMIZATION LAYER
 * Consolidates all performance utilities for mobile/Farcaster mini apps
 */

import { useCallback, useRef, useEffect, useMemo, useState } from 'react';

// DEBOUNCE UTILITIES
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

// THROTTLE FOR HIGH-FREQUENCY EVENTS (scroll, resize)
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  
  return useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    }
  }, [callback, delay]) as T;
}

// MEMOIZED REGEX CACHE - Prevents recompilation
class RegexCache {
  private cache = new Map<string, RegExp>();
  
  get(pattern: string, flags?: string): RegExp {
    const key = `${pattern}:${flags || ''}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, new RegExp(pattern, flags));
    }
    return this.cache.get(key)!;
  }
  
  clear() {
    this.cache.clear();
  }
}

export const regexCache = new RegexCache();

// EMOJI PROCESSING OPTIMIZATION
export function useOptimizedEmojiProcessor() {
  return useCallback((text: string, emojiMap: Record<string, string>): string => {
    // Batch process all emoji replacements in single pass
    return text.replace(/:[a-z_]+:/g, (match) => {
      return emojiMap[match] || match;
    });
  }, []);
}

// INTERSECTION OBSERVER FOR LAZY LOADING
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [callback, options]);
}

// ADAPTIVE POLLING BASED ON VISIBILITY
export function useAdaptivePolling(
  pollFn: () => void,
  baseInterval: number = 2000
) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const isVisible = useRef(true);

  useEffect(() => {
    // Detect page visibility for battery optimization
    const handleVisibilityChange = () => {
      isVisible.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      // Adaptive intervals: faster when visible, slower when hidden
      const interval = isVisible.current ? baseInterval : baseInterval * 3;
      
      intervalRef.current = setInterval(() => {
        if (isVisible.current || Math.random() < 0.3) { // 30% chance when hidden
          pollFn();
        }
      }, interval);
    };

    startPolling();

    // Restart polling when visibility changes
    const visibilityHandler = () => {
      startPolling();
    };
    
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [pollFn, baseInterval]);
}

// REQUEST DEDUPLICATION
class RequestCache {
  private pending = new Map<string, Promise<any>>();
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  async fetch<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttl: number = 30000
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Check if request is already pending (deduplication)
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Start new request
    const promise = fetchFn().then((data) => {
      this.cache.set(key, { data, timestamp: Date.now(), ttl });
      this.pending.delete(key);
      return data;
    }).catch((error) => {
      this.pending.delete(key);
      throw error;
    });

    this.pending.set(key, promise);
    return promise;
  }

  invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      this.pending.clear();
      return;
    }

    // Pattern-based invalidation
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const requestCache = new RequestCache();

// OPTIMIZED SCROLL HANDLER
export function useOptimizedScroll(
  callback: (e: Event) => void,
  options: { 
    throttle?: number;
    passive?: boolean;
    element?: React.RefObject<Element>;
  } = {}
) {
  const { throttle = 16, passive = true, element } = options; // 60fps throttling
  
  const throttledCallback = useThrottle(callback, throttle);

  useEffect(() => {
    const target = element?.current || window;
    target.addEventListener('scroll', throttledCallback, { passive });
    
    return () => target.removeEventListener('scroll', throttledCallback);
  }, [throttledCallback, passive, element]);
}

// FRAME-RATE AWARE ANIMATIONS
export function useFrameRateOptimization() {
  const rafId = useRef<number>();
  
  const scheduleUpdate = useCallback((callback: () => void) => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    
    rafId.current = requestAnimationFrame(callback);
  }, []);

  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return scheduleUpdate;
}

// BUNDLE SIZE OPTIMIZATION - Dynamic imports
export const dynamicImports = {
  EmojiPicker: () => import('../components/EmojiPicker'),
  Leaderboard: () => import('../components/Leaderboard'),
  GameLobby: () => import('../components/game/GameLobby'),
};

// MEMORY MANAGEMENT
export function useMemoryOptimization() {
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const safeSetState = useCallback((setter: () => void) => {
    if (mounted.current) {
      setter();
    }
  }, []);

  return { mounted: mounted.current, safeSetState };
}

// BATTERY API DETECTION (for aggressive optimization)
export function useBatteryOptimization() {
  const [isLowBattery, setIsLowBattery] = useState(false);

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBatteryStatus = () => {
          setIsLowBattery(battery.level < 0.2 && !battery.charging);
        };
        
        battery.addEventListener('levelchange', updateBatteryStatus);
        battery.addEventListener('chargingchange', updateBatteryStatus);
        updateBatteryStatus();
      });
    }
  }, []);

  return {
    isLowBattery,
    shouldReduceAnimations: isLowBattery,
    shouldReducePolling: isLowBattery,
  };
}